/**
 * Active window border overlay.
 *
 * Two modes:
 * - Solid mode (default): St.Bin with CSS border — zero overhead.
 * - Gradient mode: St.DrawingArea with Cairo gradient painting.
 *   Activated when active-border-color-secondary is non-empty
 *   and differs from the primary color.
 *
 * Features:
 * - Focus pulse: brief scale-up on focus change
 * - Gradient rotation: animated angle via Clutter.Timeline
 */

import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {SignalManager} from '../util/signalManager.js';
import {animateBorder} from '../util/animator.js';
import {parseColor} from '../util/colorParser.js';

const PULSE_SCALE = 1.04;
const PULSE_DURATION_MS = 150;
const PULSE_SETTLE_MS = 200;

// Window of time after a keybind handler runs in which the next focus
// change is treated as keybind-driven (and pulses).  Keybind handlers
// call armKeybindPulse() synchronously before invoking; the resulting
// focus change fires within microseconds, so 200ms is plenty of slack.
const KEYBIND_PULSE_ARM_US = 200_000;

export class BorderManager {
    /**
     * @param {Gio.Settings} settings
     */
    constructor(settings) {
        this._settings = settings;
        this._signals = new SignalManager();
        this._windowSignals = new SignalManager();
        this._border = null;
        this._focusWindow = null;
        this._grabActive = false;

        // Gradient mode state
        this._isGradient = false;
        this._timeline = null;
        this._gradientAngle = 0;

        // Pulse only on keybind-driven focus changes.  Mutter consumes
        // keybind KEY_PRESS events before they reach Clutter's stage and
        // app-window clicks bypass Clutter entirely (Wayland routes them
        // straight to the client), so neither is observable via
        // captured-event.  The only reliable signal is the keybind
        // handler itself calling armKeybindPulse().
        this._keybindPulseArmedAt = 0;
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    enable() {
        this._rebuildBorder();

        // Track focus changes
        this._signals.connect(global.display, 'notify::focus-window',
            () => this._onFocusChanged());

        // Track grab operations — snap instantly during drag
        this._signals.connect(global.display, 'grab-op-begin',
            () => { this._grabActive = true; });
        this._signals.connect(global.display, 'grab-op-end',
            () => { this._grabActive = false; });

        // Re-stack when z-order changes
        this._signals.connect(global.display, 'restacked',
            () => this._restack());

        // Slide the border in alongside the windows on workspace switch.
        // TilingManager applies a translate-and-fade to each window on the
        // newly-active workspace; without this the border would appear
        // fully drawn at the destination before the window arrives,
        // briefly flashing the gradient outline against the background.
        this._signals.connect(global.workspace_manager, 'active-workspace-changed',
            () => this._onWorkspaceChanged());

        // Touchpad 3-finger swipes go through GNOME's WorkspaceAnimation
        // controller, which clones the workspaces and only calls
        // newWs.activate() at the very end of the gesture (when the
        // monitor-group ease completes).  By the time active-workspace-
        // changed fires the user has already seen the gesture-end frame,
        // so any residual border position on the real window_group is
        // visible.  Hide the border at swipe-begin so it can't peek
        // through; active-workspace-changed re-shows it.
        //
        // Wrapped in try/catch because _workspaceAnimation is private
        // shell state — if a future GNOME release renames it we fall
        // back gracefully to the existing handlers.
        try {
            const swipeTracker = Main.wm?._workspaceAnimation?._swipeTracker;
            if (swipeTracker) {
                this._signals.connect(swipeTracker, 'begin',
                    () => this._onSwipeBegin());
            }
        } catch (_e) {
            // Internal API moved — keep extension functional without
            // the touchpad-specific path.
        }

        // Live-update on settings change
        this._signals.connect(this._settings, 'changed::active-border-size',
            () => this._onStyleSettingsChanged());
        this._signals.connect(this._settings, 'changed::active-border-color',
            () => this._onStyleSettingsChanged());
        this._signals.connect(this._settings, 'changed::active-border-radius',
            () => this._onStyleSettingsChanged());
        this._signals.connect(this._settings, 'changed::active-border-color-secondary',
            () => this._onGradientSettingsChanged());
        this._signals.connect(this._settings, 'changed::active-border-gradient-angle',
            () => this._onGradientSettingsChanged());
        this._signals.connect(this._settings, 'changed::active-border-gradient-speed',
            () => this._onGradientSpeedChanged());
        // focus-pulse is read at use-time in _onFocusChanged, so it picks up
        // the new value on the next focus event with no subscription needed.

        // Show border on the currently focused window
        this._onFocusChanged();
    }

    disable() {
        this._stopTimeline();
        this._windowSignals.destroy();
        this._signals.destroy();
        this._focusWindow = null;

        if (this._border) {
            global.window_group.remove_child(this._border);
            this._border.destroy();
            this._border = null;
        }

        this._settings = null;
    }

    // =========================================================================
    // Border creation
    // =========================================================================

    _rebuildBorder() {
        const hadFocus = this._focusWindow;

        // Destroy old border
        if (this._border) {
            global.window_group.remove_child(this._border);
            this._border.destroy();
            this._border = null;
        }
        this._stopTimeline();

        const secondary = this._settings.get_string('active-border-color-secondary');
        const primary = this._settings.get_string('active-border-color');
        this._isGradient = secondary !== '' && secondary !== primary;

        if (this._isGradient) {
            this._createGradientBorder();
        } else {
            this._createSolidBorder();
        }

        this._border.hide();
        global.window_group.add_child(this._border);

        if (this._isGradient)
            this._startTimeline();

        // Restore tracking if we had focus
        if (hadFocus) {
            this._updateGeometry();
            this._restack();
            this._border.show();
        }
    }

    _createSolidBorder() {
        this._border = new St.Bin({
            style_class: 'hypergnome-active-border',
            reactive: false,
            can_focus: false,
            track_hover: false,
        });
        this._updateSolidStyle();
    }

    _createGradientBorder() {
        this._border = new St.DrawingArea({
            reactive: false,
        });
        this._border.set_pivot_point(0.5, 0.5);

        this._border.connect('repaint', (area) => {
            try {
                const cr = area.get_context();
                const [width, height] = area.get_surface_size();
                this._paintGradient(cr, width, height);
                cr.$dispose();
            } catch (_e) {
                // Cairo errors shouldn't crash the shell
            }
        });

        this._gradientAngle = this._settings.get_int('active-border-gradient-angle');
    }

    // =========================================================================
    // Gradient painting (Cairo)
    // =========================================================================

    _paintGradient(cr, width, height) {
        if (width <= 0 || height <= 0)
            return;

        // Clear the canvas
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.paint();
        cr.setOperator(Cairo.Operator.OVER);

        const bw = this._settings.get_int('active-border-size');
        const radius = this._settings.get_int('active-border-radius');
        const primary = parseColor(this._settings.get_string('active-border-color'));
        const secondary = parseColor(this._settings.get_string('active-border-color-secondary'));

        // Compute gradient endpoints from angle
        const angle = this._gradientAngle * Math.PI / 180;
        const cx = width / 2;
        const cy = height / 2;
        const len = Math.max(width, height);
        const dx = Math.cos(angle) * len / 2;
        const dy = Math.sin(angle) * len / 2;

        // Create linear gradient
        const pat = new Cairo.LinearGradient(
            cx - dx, cy - dy, cx + dx, cy + dy,
        );
        pat.addColorStopRGBA(0, primary.r, primary.g, primary.b, primary.a);
        pat.addColorStopRGBA(1, secondary.r, secondary.g, secondary.b, secondary.a);

        // Draw rounded rectangle border (stroke only)
        cr.setLineWidth(bw);
        const half = bw / 2;
        this._roundedRectPath(cr, half, half, width - bw, height - bw, Math.max(0, radius - half));
        cr.setSource(pat);
        cr.stroke();
    }

    _roundedRectPath(cr, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        cr.newPath();
        cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
        cr.lineTo(x + w - r, y);
        cr.arc(x + w - r, y + r, r, 1.5 * Math.PI, 2 * Math.PI);
        cr.lineTo(x + w, y + h - r);
        cr.arc(x + w - r, y + h - r, r, 0, 0.5 * Math.PI);
        cr.lineTo(x + r, y + h);
        cr.arc(x + r, y + h - r, r, 0.5 * Math.PI, Math.PI);
        cr.closePath();
    }

    _invalidateCanvas() {
        if (!this._border || !this._isGradient)
            return;
        this._border.queue_repaint();
    }

    // =========================================================================
    // Gradient rotation (Clutter.Timeline)
    // =========================================================================

    _startTimeline() {
        if (this._timeline)
            return;

        const speed = this._settings.get_double('active-border-gradient-speed');
        if (speed <= 0)
            return;

        // Treat `speed` as "degrees per frame at 60fps" to preserve the
        // setting's existing meaning, but advance by real elapsed time so
        // the rotation rate stays consistent across frame drops, throttled
        // compositors, and resume-from-suspend.  GLib.get_monotonic_time
        // returns microseconds and is unambiguous about delta semantics.
        const FPS = 60;
        let lastTickUs = GLib.get_monotonic_time();
        this._timeline = new Clutter.Timeline({
            duration: 1000,
            repeat_count: -1,
        });
        this._timeline.connect('new-frame', () => {
            const nowUs = GLib.get_monotonic_time();
            const deltaSec = (nowUs - lastTickUs) / 1_000_000;
            lastTickUs = nowUs;
            // Clamp catch-up after suspend: a 5-minute pause shouldn't
            // produce a visible spin when the screen wakes up.
            const step = speed * FPS * Math.min(deltaSec, 0.1);
            this._gradientAngle = (this._gradientAngle + step) % 360;
            this._invalidateCanvas();
        });
        this._timeline.start();
    }

    _stopTimeline() {
        if (this._timeline) {
            this._timeline.stop();
            this._timeline = null;
        }
    }

    // =========================================================================
    // Focus tracking
    // =========================================================================

    _onFocusChanged() {
        // Disconnect signals from the previous window
        this._windowSignals.destroy();

        const prevFocus = this._focusWindow;
        const win = global.display.get_focus_window();

        if (!win || win.is_fullscreen() || win.minimized) {
            this._border.hide();
            this._focusWindow = null;
            return;
        }

        this._focusWindow = win;

        this._windowSignals.connect(win, 'position-changed',
            () => this._updateGeometryAnimated());
        this._windowSignals.connect(win, 'size-changed',
            () => this._updateGeometryAnimated());

        // The active border is only valid when the focused window is on
        // the active workspace.  Mutter's notify::focus-window can land
        // momentarily while a workspace transition is still settling
        // (new focus on the about-to-be-active workspace, but active_
        // workspace still points at the previous one).  Hide and bail;
        // _onWorkspaceChanged will re-show when the workspace update
        // lands in the same JS task.
        if (!this._isFocusOnActiveWs()) {
            this._border.hide();
            return;
        }

        this._updateGeometry();
        this._restack();
        this._border.show();

        // Pulse only when a keybind handler armed it (see armKeybindPulse).
        // Mouse clicks bypass Clutter (Wayland routes them straight to the
        // client) and Mutter consumes keybind KEY_PRESS events before
        // captured-event sees them, so the keybind handler is the only
        // reliable place to mark "this focus change is keybind-driven."
        if (this._shouldPulse())
            this._doPulse();
    }

    /**
     * Arm the focus pulse for the *next* focus change.  Called by
     * KeybindingManager before invoking a keybind handler that may
     * change focus.  The arm expires after KEYBIND_PULSE_ARM_US so a
     * keybind that doesn't actually move focus doesn't leak a pulse
     * onto a later click-driven focus change.
     */
    armKeybindPulse() {
        this._keybindPulseArmedAt = GLib.get_monotonic_time();
    }

    _shouldPulse() {
        if (!this._settings.get_boolean('focus-pulse'))
            return false;
        const age = GLib.get_monotonic_time() - this._keybindPulseArmedAt;
        // Consume the arm so a later non-keybind focus change doesn't
        // also pulse (one keybind = at most one pulse).
        this._keybindPulseArmedAt = 0;
        return age < KEYBIND_PULSE_ARM_US;
    }

    /**
     * Hide the border at the start of a touchpad workspace swipe.
     * GNOME's WorkspaceAnimationController clones the workspaces and
     * defers newWs.activate() to the swipe-end onComplete callback, so
     * the real window_group (and the border in it) can briefly peek
     * through at the gesture-end frame.  Hiding eagerly avoids that.
     * The eventual active-workspace-changed handler restores it.
     */
    _onSwipeBegin() {
        if (this._border)
            this._border.hide();
    }

    /**
     * @returns {boolean} true when the currently tracked focus window is on
     * the active workspace.  Used as the invariant gating border visibility:
     * the border must only be shown when its target window is actually on
     * the visible workspace.
     */
    _isFocusOnActiveWs() {
        try {
            if (!this._focusWindow)
                return false;
            const ws = this._focusWindow.get_workspace();
            if (!ws)
                return false;
            return ws.index() ===
                global.workspace_manager.get_active_workspace_index();
        } catch (_e) {
            return false;
        }
    }

    /**
     * Restore the border on workspace change.  GNOME's WorkspaceAnimation
     * already handles the visual transition (cloned workspaces sliding
     * across); we just need to show the border at its canonical position
     * once focus has landed on a window on the active workspace.  If
     * focus hasn't transferred yet (touchpad gesture-commit path), we
     * stay hidden and the subsequent notify::focus-window restores us.
     */
    _onWorkspaceChanged() {
        // Workspace-switching keybinds (Super+[ / Super+] / Super+N)
        // armed the pulse the same way every other keybind does, but
        // the workspace switch itself is the visual cue — a border
        // pulse on top of it just looks like the outline floating
        // detached from the window.  Disarm so the follow-up
        // notify::focus-window doesn't pulse.  This runs before
        // notify::focus-window in Mutter's emit order, so the
        // disarm always lands first.
        this._keybindPulseArmedAt = 0;

        if (!this._settings || !this._border)
            return;

        if (!this._isFocusOnActiveWs()) {
            this._border.hide();
            return;
        }

        this._updateGeometry();
        this._restack();
        this._border.show();
    }

    // =========================================================================
    // Focus pulse
    // =========================================================================

    _doPulse() {
        if (!this._border)
            return;

        this._border.set_pivot_point(0.5, 0.5);
        this._border.remove_all_transitions();

        // First update geometry so border is in the right place
        this._updateGeometry();

        // Pulse the border
        this._border.ease({
            scale_x: PULSE_SCALE,
            scale_y: PULSE_SCALE,
            duration: PULSE_DURATION_MS,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                try {
                    this._border.ease({
                        scale_x: 1.0,
                        scale_y: 1.0,
                        duration: PULSE_SETTLE_MS,
                        mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
                    });
                } catch (_e) {
                    // Border may be destroyed
                }
            },
        });

        // Pulse the window actor too
        this._pulseWindowActor();
    }

    _pulseWindowActor() {
        if (!this._focusWindow)
            return;

        const actor = this._focusWindow.get_compositor_private();
        if (!actor)
            return;

        try {
            actor.set_pivot_point(0.5, 0.5);
            actor.remove_all_transitions();

            actor.ease({
                scale_x: PULSE_SCALE,
                scale_y: PULSE_SCALE,
                duration: PULSE_DURATION_MS,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    try {
                        actor.ease({
                            scale_x: 1.0,
                            scale_y: 1.0,
                            duration: PULSE_SETTLE_MS,
                            mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
                        });
                    } catch (_e) {
                        // Actor may be destroyed
                    }
                },
            });
        } catch (_e) {
            // Window may have been destroyed
        }
    }

    // =========================================================================
    // Geometry & style
    // =========================================================================

    _updateGeometry() {
        if (!this._focusWindow || !this._border)
            return;

        try {
            const rect = this._focusWindow.get_frame_rect();
            const bw = this._settings.get_int('active-border-size');

            this._border.remove_all_transitions();
            this._border.set_position(rect.x - bw, rect.y - bw);
            this._border.set_size(rect.width + bw * 2, rect.height + bw * 2);
            this._border.set_scale(1, 1);
            // Clear any leftover slide-in transform so the border doesn't
            // sit stuck offset/transparent if a prior transition was cut
            // short (e.g. pulse remove_all_transitions during slide-in).
            this._border.translation_x = 0;
            this._border.translation_y = 0;
            this._border.opacity = 255;

            if (this._isGradient)
                this._invalidateCanvas();
        } catch (_e) {
            // Window may have been destroyed
        }
    }

    _updateGeometryAnimated() {
        if (this._grabActive) {
            this._updateGeometry();
            return;
        }

        if (!this._focusWindow || !this._border)
            return;

        try {
            const rect = this._focusWindow.get_frame_rect();
            const bw = this._settings.get_int('active-border-size');
            const dur = this._settings.get_int('animation-duration');

            if (this._isGradient) {
                // For gradient mode, ease position/size directly.  We
                // also ease scale, translation and opacity back to
                // canonical — remove_all_transitions cuts any in-flight
                // pulse or slide-in mid-property, which would otherwise
                // leave the border drawn at e.g. scale 1.03 (looks like
                // the border has grown bigger than the window) for the
                // rest of the resize.
                this._border.remove_all_transitions();
                this._border.ease({
                    x: rect.x - bw,
                    y: rect.y - bw,
                    width: rect.width + bw * 2,
                    height: rect.height + bw * 2,
                    scale_x: 1,
                    scale_y: 1,
                    translation_x: 0,
                    translation_y: 0,
                    opacity: 255,
                    duration: dur,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });
            } else {
                animateBorder(this._border, rect, bw, dur);
            }
        } catch (_e) {
            // Window may have been destroyed
        }
    }

    _updateSolidStyle() {
        if (!this._border || this._isGradient)
            return;

        const color = this._settings.get_string('active-border-color');
        const width = this._settings.get_int('active-border-size');
        const radius = this._settings.get_int('active-border-radius');

        this._border.set_style(
            `border-width: ${width}px; border-color: ${color}; border-radius: ${radius}px;`,
        );
    }

    _onStyleSettingsChanged() {
        if (this._isGradient) {
            // Gradient mode — just repaint the canvas
            this._invalidateCanvas();
        } else {
            this._updateSolidStyle();
        }
        this._updateGeometry();
    }

    _onGradientSettingsChanged() {
        // Mode may have changed — rebuild
        const secondary = this._settings.get_string('active-border-color-secondary');
        const primary = this._settings.get_string('active-border-color');
        const shouldBeGradient = secondary !== '' && secondary !== primary;

        if (shouldBeGradient !== this._isGradient) {
            this._rebuildBorder();
        } else if (this._isGradient) {
            this._gradientAngle = this._settings.get_int('active-border-gradient-angle');
            this._invalidateCanvas();
        }
    }

    _onGradientSpeedChanged() {
        if (!this._isGradient)
            return;
        this._stopTimeline();
        this._startTimeline();
    }

    _restack() {
        if (!this._focusWindow || !this._border)
            return;

        try {
            const actor = this._focusWindow.get_compositor_private();
            if (actor)
                global.window_group.set_child_above_sibling(this._border, actor);
        } catch (_e) {
            // Window may have been destroyed
        }
    }
}
