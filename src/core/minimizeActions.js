/**
 * Minimize / restore actions for HyperGnome's restore keybindings.
 *
 * GNOME has a built-in minimize action but no way to bring a minimized
 * window back from the keyboard. These helpers restore minimized windows
 * of the active workspace in LIFO order (last minimized comes back first).
 *
 * Minimize order is read from `_hypergnomeMinimizedAt`, stamped by
 * KeybindingManager on Shell.WM 'minimize'. Windows minimized before the
 * extension was enabled have no stamp — they fall back to user time, so
 * they still restore, just after any stamped ones.
 *
 * Pure-ish module: windows are passed in, so this is unit-testable without
 * a live GNOME shell.
 */

const NORMAL_WINDOW_TYPE = 0; // Meta.WindowType.NORMAL

function isRestorable(metaWindow) {
    try {
        if (!metaWindow.minimized)
            return false;
        if (metaWindow.get_window_type() !== NORMAL_WINDOW_TYPE)
            return false;
        if (metaWindow.is_skip_taskbar())
            return false;
        return true;
    } catch (_e) {
        return false;
    }
}

function minimizedAt(metaWindow) {
    return metaWindow._hypergnomeMinimizedAt ?? 0;
}

function userTime(metaWindow) {
    try {
        return metaWindow.get_user_time() ?? 0;
    } catch (_e) {
        return 0;
    }
}

/**
 * Minimized windows ordered oldest-first.
 * @param {Meta.Window[]} windows
 * @returns {Meta.Window[]}
 */
export function minimizedWindows(windows) {
    return windows
        .filter(isRestorable)
        .sort((a, b) =>
            (minimizedAt(a) - minimizedAt(b)) || (userTime(a) - userTime(b)));
}

/**
 * Restore the most recently minimized window.
 * @param {Meta.Window[]} windows - windows of the active workspace
 * @param {number} [time] - Clutter event time
 * @returns {Meta.Window|null} the restored window
 */
export function restoreLast(windows, time = 0) {
    const ordered = minimizedWindows(windows);
    const target = ordered.at(-1);
    if (!target)
        return null;
    target.unminimize();
    target.activate(time);
    return target;
}

/**
 * Restore every minimized window; the last minimized one ends focused.
 * @param {Meta.Window[]} windows - windows of the active workspace
 * @param {number} [time] - Clutter event time
 * @returns {number} how many windows were restored
 */
export function restoreAll(windows, time = 0) {
    const ordered = minimizedWindows(windows);
    for (const w of ordered)
        w.unminimize();
    ordered.at(-1)?.activate(time);
    return ordered.length;
}
