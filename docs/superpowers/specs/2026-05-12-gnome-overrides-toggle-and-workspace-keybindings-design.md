# GNOME Override Toggle + Hyprland-Style Workspace Keybindings — Design

**Date:** 2026-05-12
**Status:** Approved by user, awaiting implementation plan

## Problem

HyperGnome unconditionally overrides several GNOME built-in keybindings
(`minimize`, `toggle-tiled-left/right`, `unmaximize`, `move-to-monitor-*`)
via `Meta.keybindings_set_custom_handler()`. There is no user-facing way
to opt out. Some users dislike this aggressive behaviour.

Additionally, HyperGnome currently has no workspace-switching keybindings
of its own — it relies on GNOME's default `Super+PageUp` / `Super+PageDown`.
That feels unergonomic compared to Hyprland's `Super+1..9, 0` /
`Super+Shift+1..9, 0` conventions, which are the de facto standard in
tiling WMs.

## Goals

1. Add a single user-facing toggle that gates **all** GNOME-binding
   overrides installed by HyperGnome.
2. Add Hyprland-style workspace keybindings: direct (`Super+N`), move
   (`Super+Shift+N`), cycle (`Super+[` / `Super+]`), and cycle-with-window
   (`Super+Shift+[` / `Super+Shift+]`).
3. Preserve current default behaviour for existing users (toggle defaults
   to `true`).
4. Hot-reload: toggling the setting at runtime takes effect without
   re-enabling the extension.

## Non-Goals

- Per-binding override toggles (rejected as too much UI clutter).
- Automatic remapping of HyperGnome's own accelerators when the toggle
  is off (rejected as too magical).
- Mouse-wheel workspace switching (not in scope; can be a follow-up).
- Forcing dynamic workspaces on the user — we respect GNOME's setting.

## Design

### Settings schema additions

Added to `schemas/org.gnome.shell.extensions.hypergnome.gschema.xml`:

```
override-gnome-shortcuts (b, default true)
  Summary:     "Override conflicting GNOME shortcuts"
  Description: "When enabled, HyperGnome takes over GNOME shortcuts that
                conflict with its defaults (e.g. Super+H, Super+1-9).
                Required for default HyperGnome bindings to work."

tile-workspace-1   default ['<Super>1']
tile-workspace-2   default ['<Super>2']
...
tile-workspace-9   default ['<Super>9']
tile-workspace-10  default ['<Super>0']

tile-move-to-workspace-1   default ['<Super><Shift>1']
...
tile-move-to-workspace-9   default ['<Super><Shift>9']
tile-move-to-workspace-10  default ['<Super><Shift>0']

tile-workspace-prev        default ['<Super>bracketleft']
tile-workspace-next        default ['<Super>bracketright']
tile-move-workspace-prev   default ['<Super><Shift>bracketleft']
tile-move-workspace-next   default ['<Super><Shift>bracketright']
```

Total: 1 boolean + 24 `as` accelerator keys.

### Behaviour of the override toggle

The boolean `override-gnome-shortcuts` gates two override groups:

**Window-management overrides (existing, now gated):**

| GNOME binding         | Default accelerator | New handler                |
| --------------------- | ------------------- | -------------------------- |
| `minimize`            | Super+H             | no-op (frees Super+H)      |
| `toggle-tiled-left`   | Super+Left          | `focusDirection('left')`   |
| `toggle-tiled-right`  | Super+Right         | `focusDirection('right')`  |
| `unmaximize`          | Super+Down          | `focusDirection('down')`   |
| `move-to-monitor-left`   | Super+Shift+Left  | `moveDirection('left')`    |
| `move-to-monitor-right`  | Super+Shift+Right | `moveDirection('right')`   |
| `move-to-monitor-up`     | Super+Shift+Up    | `moveDirection('up')`      |
| `move-to-monitor-down`   | Super+Shift+Down  | `moveDirection('down')`    |

**Workspace overrides (new, gated by the same toggle):**

| GNOME binding             | Default accelerator | New handler |
| ------------------------- | ------------------- | ----------- |
| `switch-to-application-1` | Super+1             | no-op       |
| `switch-to-application-2` | Super+2             | no-op       |
| ...                       | ...                 | no-op       |
| `switch-to-application-9` | Super+9             | no-op       |

(Super+0 has no GNOME default binding so needs no suppression.
Super+Shift+1..9, Super+[, Super+] have no conflicting GNOME defaults.)

**When `override-gnome-shortcuts = true`:**
- All `tile-*` custom bindings are registered (focus, move, resize,
  workspace, etc.).
- Both override groups install.

**When `override-gnome-shortcuts = false`:**
- All `tile-*` custom bindings are still registered.
- Neither override group installs.
- Practical consequence: bindings that share an accelerator with a GNOME
  binding (e.g. `tile-focus-left` on Super+H, `tile-workspace-1` on
  Super+1) will silently fail to register or be eaten by GNOME. The user
  is responsible for resolving conflicts via GNOME's keyboard settings.
  This is documented honestly in the toggle's subtitle.

**Hot-reload:** `KeybindingManager` subscribes to
`changed::override-gnome-shortcuts`. On change, the manager calls its
own `disable()` then `enable()`. All registrations are torn down and
rebuilt in the new state. The subscription is tracked and disconnected
in `disable()`.

### Workspace action semantics

All workspace actions respect `org.gnome.mutter.dynamic-workspaces`:

- **Switch to workspace N** (`tile-workspace-1..10` → Super+1..0):
  - If `dynamic-workspaces = true`: GNOME auto-extends the workspace
    list as the user navigates; switching to N creates intermediate
    workspaces as needed (matches GNOME's natural behaviour).
  - If `dynamic-workspaces = false`: clamp to the configured number of
    workspaces (no-op if N exceeds it).

- **Move active to workspace N** (`tile-move-to-workspace-1..10`
  → Super+Shift+1..0): same clamp/extend semantics. Uses
  `window.change_workspace_by_index(index, false)`.

- **Cycle prev/next** (`tile-workspace-prev/next` → Super+[ / Super+]):
  - Dynamic mode: wraps on next if next workspace is empty *and* current
    is not the last non-empty — but for v1 we keep it simple: clamp at
    boundaries (no wrap). Match the existing GNOME `switch-to-workspace-
    up/down` clamp behaviour.
  - Fixed mode: clamp at 0 and `n_workspaces - 1`.

- **Move active and cycle**
  (`tile-move-workspace-prev/next` → Super+Shift+[ / Super+Shift+]):
  Compose `moveActiveToWorkspace(neighbor)` + workspace activation. The
  active window follows the workspace switch.

### Module layout

**New file: `src/core/workspaceActions.js`**

Pure-ish module containing the four operations above as standalone
functions. Takes the `Meta` / `global` workspace manager as a parameter
rather than importing it, so the clamp/index math is unit-testable
without a live shell.

```js
// Pseudocode
export function switchToWorkspace(workspaceManager, index) { ... }
export function moveActiveToWorkspace(workspaceManager, focusedWindow, index) { ... }
export function cycleWorkspace(workspaceManager, direction) { ... } // direction = +1 | -1
export function moveActiveAndCycle(workspaceManager, focusedWindow, direction) { ... }
```

**Modified: `src/core/keybindings.js`**

- Constructor stores `_settingsChangedId = 0`, `_overrideEnabled = false`.
- `enable()`:
  1. `this._overrideEnabled = this._settings.get_boolean('override-gnome-shortcuts');`
  2. `this._registerCustomBindings()` — registers all `tile-*` bindings.
     Includes the 24 new workspace bindings, each handler delegating to
     `workspaceActions`.
  3. `if (this._overrideEnabled) this._installGnomeOverrides();` — calls
     `_overrideBinding()` for window-management overrides (existing
     calls) plus the 9 new `switch-to-application-N` no-op suppressions.
  4. `this._connectToggleListener()` — subscribes to
     `changed::override-gnome-shortcuts`; handler calls
     `this.disable(); this.enable();`.
- `disable()`: disconnects `_settingsChangedId` (if non-zero), then runs
  current cleanup of `_customBindings` and `_overriddenBindings`.
- Workspace handler bodies are tiny wrappers, e.g.
  `() => workspaceActions.switchToWorkspace(global.workspace_manager, 0)`.

**Modified: `prefs.js`**

- In `_buildKeybindingsPage`, prepend a new `Adw.PreferencesGroup`
  titled "GNOME Integration" containing one `Adw.SwitchRow` bound to
  `override-gnome-shortcuts`. Subtitle: "Required for default HyperGnome
  bindings to work. When off, you may need to rebind conflicting GNOME
  shortcuts manually."
- Add a new "Workspaces" group with `Adw.EntryRow`s for all 24 new
  accelerators (same pattern already used by the existing `tile-*`
  rows).
- The existing conflict-scanner in `prefs.js` (around line 662) already
  reads from `org.gnome.desktop.wm.keybindings`,
  `org.gnome.mutter.keybindings`, and `org.gnome.shell.keybindings`, so
  it will automatically surface conflicts with `switch-to-application-N`
  without further changes.

**Modified: `extension.js`** — no changes. `KeybindingManager.enable()`
and `disable()` are already wired correctly.

### Data flow (toggle change at runtime)

```
User toggles SwitchRow in prefs
  → GSettings writes override-gnome-shortcuts
  → KeybindingManager.changed::override-gnome-shortcuts handler fires
  → manager.disable()           // tears down custom + overridden bindings
  → manager.enable()            // re-reads setting, installs new state
```

### Testing

**New file: `tests/workspaceActions.test.js`**

Mocks a minimal `workspaceManager` interface
(`get_n_workspaces`, `get_active_workspace_index`,
`get_workspace_by_index`, plus `activate`). Verifies:

- `switchToWorkspace`: clamps when fixed mode and N too high; activates
  correctly when in range.
- `cycleWorkspace`: increments/decrements; clamps at boundaries (no
  wrap in v1).
- `moveActiveToWorkspace`: calls `window.change_workspace_by_index` with
  the right index; no-op when focused window is null.
- `moveActiveAndCycle`: moves window then activates target workspace.

Cleanup contract is verified manually (load/unload extension; check
journalctl for stale signal warnings).

## Decisions and trade-offs

- **Single master toggle vs grouped/per-binding:** chose single per user
  preference. Cleanest UX; the existing conflict-scanner in prefs already
  helps users diagnose remaining issues.
- **Default `true`:** preserves current behaviour for existing users;
  fresh installs get the "Hyprland-like" experience that matches the
  extension's name and identity.
- **`Super+[` / `Super+]` for cycle** instead of Hyprland's literal
  `Super+Ctrl+Left/Right`: the latter conflicts with HyperGnome's
  existing `tile-resize-left/right`. The `[`/`]` pattern is widely used
  in i3/sway and intuitively means "prev/next".
- **No-wrap cycle in v1:** matches GNOME's existing
  `switch-to-workspace-up/down` behaviour. Wrap could be a follow-up
  setting.
- **Workspace creation:** delegated to GNOME's dynamic-workspaces
  setting rather than forcing creation. Respects user preference.
- **Hot-reload via disable/enable rather than fine-grained patch:**
  simpler; toggle changes are rare; the manager already has a robust
  cleanup path.

## Risks

- **Existing users who already customised the overridden bindings:**
  unchanged from today — they already accepted the current overrides.
- **Toggle-off footgun:** users may turn the toggle off, find that
  Super+H/Super+1 don't work for them, and be confused. Mitigated by
  the honest subtitle on the toggle and the existing conflict scanner.
- **Signal-cleanup mistake on the toggle listener:** would cause
  cumulative shell leaks. Mitigated by tracking the signal ID on the
  manager and disconnecting in `disable()`.
- **`Meta.keybindings_set_custom_handler` on `switch-to-application-N`:**
  these live in `org.gnome.shell.keybindings`, not the wm schema. Need
  to verify Meta accepts that name (it should — Meta dispatches all
  keybindings regardless of source schema, and Pop Shell uses the same
  technique). If it doesn't, fallback is to grep
  `org.gnome.shell.keybindings` and clear the accelerator there (with
  restore on disable) — but this is a more invasive change to user
  settings, so we prefer the custom-handler approach.

## Open questions

None at design time. Implementation plan will explore the
`switch-to-application-N` override mechanism details.
