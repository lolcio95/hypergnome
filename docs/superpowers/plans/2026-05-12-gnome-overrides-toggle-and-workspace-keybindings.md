# GNOME Override Toggle + Hyprland-Style Workspace Keybindings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-toggleable master switch for HyperGnome's GNOME-keybinding overrides, and add Hyprland-style workspace keybindings (Super+1..0, Super+Shift+1..0, Super+[/], Super+Shift+[/]).

**Architecture:** Introduce a pure `workspaceActions.js` module for workspace index math (unit-testable without a live shell). Extend `keybindings.js` to gate its existing GNOME-handler overrides behind a single GSettings boolean and to register 24 new workspace bindings. Hot-reload by subscribing to `changed::override-gnome-shortcuts` and re-running `disable()` + `enable()`. Add prefs UI for the new toggle and binding rows.

**Tech Stack:** GJS / GNOME Shell extension. Tests use `node --test` (already in `package.json` as `npm test`). Adw widgets in prefs. `Meta`, `Shell`, `global.workspace_manager` at runtime.

**Spec:** [`docs/superpowers/specs/2026-05-12-gnome-overrides-toggle-and-workspace-keybindings-design.md`](../specs/2026-05-12-gnome-overrides-toggle-and-workspace-keybindings-design.md)

---

## File Structure

- **Create**: `src/core/workspaceActions.js` — pure module with `switchToWorkspace`, `moveActiveToWorkspace`, `cycleWorkspace`, `moveActiveAndCycle`. Takes injectable dependencies (workspace manager, dynamic-workspaces flag) for testability.
- **Create**: `tests/workspaceActions.test.js` — unit tests for the four functions with mock workspace manager.
- **Modify**: `schemas/org.gnome.shell.extensions.hypergnome.gschema.xml` — add 1 boolean + 24 accelerator keys.
- **Modify**: `src/core/keybindings.js` — gate overrides on the new boolean, register new workspace bindings, hot-reload listener.
- **Modify**: `prefs.js` — add "GNOME Integration" group with the master toggle; add "Workspaces" binding group; update `STATIC_OVERRIDES` to include the new `switch-to-application-N` suppressions.
- **No changes to**: `extension.js`, `tilingManager.js`, other core modules.

---

## Task 1: Add the override toggle GSettings key

**Files:**
- Modify: `schemas/org.gnome.shell.extensions.hypergnome.gschema.xml`
- Modify: `Makefile` (verify schema rebuild target exists)

- [ ] **Step 1: Add the key to the schema**

Insert before the first `<key name="tile-focus-left">` block (around line 152):

```xml
    <key name="override-gnome-shortcuts" type="b">
      <default>true</default>
      <summary>Override conflicting GNOME shortcuts</summary>
      <description>When enabled, HyperGnome takes over GNOME shortcuts that conflict with its defaults (e.g. Super+H, Super+1-9). Required for default HyperGnome bindings to work. Turn off if you prefer to use GNOME's native shortcuts and rebind HyperGnome's manually.</description>
    </key>

```

- [ ] **Step 2: Recompile the schema**

Run: `glib-compile-schemas schemas/`
Expected: no output, `schemas/gschemas.compiled` updated.

- [ ] **Step 3: Verify the key is readable**

Run: `gsettings --schemadir schemas/ get org.gnome.shell.extensions.hypergnome override-gnome-shortcuts`
Expected: `true`

- [ ] **Step 4: Commit**

```bash
git add schemas/org.gnome.shell.extensions.hypergnome.gschema.xml schemas/gschemas.compiled
git commit -m "feat(settings): add override-gnome-shortcuts toggle key"
```

---

## Task 2: Add the 24 workspace accelerator GSettings keys

**Files:**
- Modify: `schemas/org.gnome.shell.extensions.hypergnome.gschema.xml`

- [ ] **Step 1: Append workspace keys before the closing `</schema>`**

Insert immediately before `</schema>` (around line 270):

```xml
    <!-- Workspace switching (Hyprland-style) -->
    <key name="tile-workspace-1" type="as">
      <default><![CDATA[['<Super>1']]]></default>
      <summary>Switch to workspace 1</summary>
      <description>Activate workspace 1 (Hyprland-style direct workspace jump)</description>
    </key>

    <key name="tile-workspace-2" type="as">
      <default><![CDATA[['<Super>2']]]></default>
      <summary>Switch to workspace 2</summary>
      <description>Activate workspace 2</description>
    </key>

    <key name="tile-workspace-3" type="as">
      <default><![CDATA[['<Super>3']]]></default>
      <summary>Switch to workspace 3</summary>
      <description>Activate workspace 3</description>
    </key>

    <key name="tile-workspace-4" type="as">
      <default><![CDATA[['<Super>4']]]></default>
      <summary>Switch to workspace 4</summary>
      <description>Activate workspace 4</description>
    </key>

    <key name="tile-workspace-5" type="as">
      <default><![CDATA[['<Super>5']]]></default>
      <summary>Switch to workspace 5</summary>
      <description>Activate workspace 5</description>
    </key>

    <key name="tile-workspace-6" type="as">
      <default><![CDATA[['<Super>6']]]></default>
      <summary>Switch to workspace 6</summary>
      <description>Activate workspace 6</description>
    </key>

    <key name="tile-workspace-7" type="as">
      <default><![CDATA[['<Super>7']]]></default>
      <summary>Switch to workspace 7</summary>
      <description>Activate workspace 7</description>
    </key>

    <key name="tile-workspace-8" type="as">
      <default><![CDATA[['<Super>8']]]></default>
      <summary>Switch to workspace 8</summary>
      <description>Activate workspace 8</description>
    </key>

    <key name="tile-workspace-9" type="as">
      <default><![CDATA[['<Super>9']]]></default>
      <summary>Switch to workspace 9</summary>
      <description>Activate workspace 9</description>
    </key>

    <key name="tile-workspace-10" type="as">
      <default><![CDATA[['<Super>0']]]></default>
      <summary>Switch to workspace 10</summary>
      <description>Activate workspace 10</description>
    </key>

    <!-- Move active window to workspace (Hyprland-style) -->
    <key name="tile-move-to-workspace-1" type="as">
      <default><![CDATA[['<Super><Shift>1']]]></default>
      <summary>Move window to workspace 1</summary>
      <description>Move the focused window to workspace 1</description>
    </key>

    <key name="tile-move-to-workspace-2" type="as">
      <default><![CDATA[['<Super><Shift>2']]]></default>
      <summary>Move window to workspace 2</summary>
      <description>Move the focused window to workspace 2</description>
    </key>

    <key name="tile-move-to-workspace-3" type="as">
      <default><![CDATA[['<Super><Shift>3']]]></default>
      <summary>Move window to workspace 3</summary>
      <description>Move the focused window to workspace 3</description>
    </key>

    <key name="tile-move-to-workspace-4" type="as">
      <default><![CDATA[['<Super><Shift>4']]]></default>
      <summary>Move window to workspace 4</summary>
      <description>Move the focused window to workspace 4</description>
    </key>

    <key name="tile-move-to-workspace-5" type="as">
      <default><![CDATA[['<Super><Shift>5']]]></default>
      <summary>Move window to workspace 5</summary>
      <description>Move the focused window to workspace 5</description>
    </key>

    <key name="tile-move-to-workspace-6" type="as">
      <default><![CDATA[['<Super><Shift>6']]]></default>
      <summary>Move window to workspace 6</summary>
      <description>Move the focused window to workspace 6</description>
    </key>

    <key name="tile-move-to-workspace-7" type="as">
      <default><![CDATA[['<Super><Shift>7']]]></default>
      <summary>Move window to workspace 7</summary>
      <description>Move the focused window to workspace 7</description>
    </key>

    <key name="tile-move-to-workspace-8" type="as">
      <default><![CDATA[['<Super><Shift>8']]]></default>
      <summary>Move window to workspace 8</summary>
      <description>Move the focused window to workspace 8</description>
    </key>

    <key name="tile-move-to-workspace-9" type="as">
      <default><![CDATA[['<Super><Shift>9']]]></default>
      <summary>Move window to workspace 9</summary>
      <description>Move the focused window to workspace 9</description>
    </key>

    <key name="tile-move-to-workspace-10" type="as">
      <default><![CDATA[['<Super><Shift>0']]]></default>
      <summary>Move window to workspace 10</summary>
      <description>Move the focused window to workspace 10</description>
    </key>

    <!-- Cycle workspaces (i3/sway/Hyprland convention) -->
    <key name="tile-workspace-prev" type="as">
      <default><![CDATA[['<Super>bracketleft']]]></default>
      <summary>Cycle to previous workspace</summary>
      <description>Activate the workspace before the current one (clamps at the first workspace)</description>
    </key>

    <key name="tile-workspace-next" type="as">
      <default><![CDATA[['<Super>bracketright']]]></default>
      <summary>Cycle to next workspace</summary>
      <description>Activate the workspace after the current one (clamps at the last workspace)</description>
    </key>

    <key name="tile-move-workspace-prev" type="as">
      <default><![CDATA[['<Super><Shift>bracketleft']]]></default>
      <summary>Move window to previous workspace</summary>
      <description>Move the focused window to the previous workspace and follow</description>
    </key>

    <key name="tile-move-workspace-next" type="as">
      <default><![CDATA[['<Super><Shift>bracketright']]]></default>
      <summary>Move window to next workspace</summary>
      <description>Move the focused window to the next workspace and follow</description>
    </key>

```

- [ ] **Step 2: Recompile the schema**

Run: `glib-compile-schemas schemas/`
Expected: no output, schema file updated.

- [ ] **Step 3: Verify a couple of the new keys**

Run: `gsettings --schemadir schemas/ get org.gnome.shell.extensions.hypergnome tile-workspace-1`
Expected: `['<Super>1']`

Run: `gsettings --schemadir schemas/ get org.gnome.shell.extensions.hypergnome tile-workspace-prev`
Expected: `['<Super>bracketleft']`

- [ ] **Step 4: Commit**

```bash
git add schemas/org.gnome.shell.extensions.hypergnome.gschema.xml schemas/gschemas.compiled
git commit -m "feat(settings): add 24 workspace keybinding keys (Hyprland-style)"
```

---

## Task 3: Workspace actions — `switchToWorkspace` with TDD

**Files:**
- Create: `src/core/workspaceActions.js`
- Create: `tests/workspaceActions.test.js`

The module exposes four pure-ish functions. The workspace manager is passed in (never imported), so tests can pass a plain JS mock. This avoids any `gi://` imports in the test file.

- [ ] **Step 1: Write the failing test**

Create `tests/workspaceActions.test.js`:

```javascript
import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {
    switchToWorkspace,
    moveActiveToWorkspace,
    cycleWorkspace,
    moveActiveAndCycle,
} from '../src/core/workspaceActions.js';

/**
 * Build a minimal mock workspace manager.
 * @param {object} opts
 * @param {number} opts.nWorkspaces - current workspace count
 * @param {number} opts.activeIndex - currently active workspace
 * @param {boolean} opts.dynamic - whether dynamic workspaces are enabled
 */
function mockWsManager({nWorkspaces, activeIndex, dynamic}) {
    const activated = [];
    const appended = [];
    const workspaces = Array.from({length: nWorkspaces}, (_, i) => ({
        index: i,
        activate: (_time) => activated.push(i),
    }));
    return {
        get_n_workspaces: () => workspaces.length,
        get_active_workspace_index: () => activeIndex,
        get_workspace_by_index: (i) =>
            (i >= 0 && i < workspaces.length) ? workspaces[i] : null,
        append_new_workspace: (activate, _time) => {
            const i = workspaces.length;
            const ws = {
                index: i,
                activate: (_t) => activated.push(i),
            };
            workspaces.push(ws);
            appended.push(i);
            if (activate) activated.push(i);
            return ws;
        },
        // Surface state for assertions
        _activated: activated,
        _appended: appended,
        _dynamic: dynamic,
    };
}

describe('switchToWorkspace', () => {
    it('activates an existing workspace in range', () => {
        const wm = mockWsManager({nWorkspaces: 4, activeIndex: 0, dynamic: false});
        switchToWorkspace(wm, 2, /*dynamic=*/false);
        assert.deepEqual(wm._activated, [2]);
        assert.deepEqual(wm._appended, []);
    });

    it('clamps to no-op when target is out of range in fixed mode', () => {
        const wm = mockWsManager({nWorkspaces: 3, activeIndex: 0, dynamic: false});
        switchToWorkspace(wm, 7, /*dynamic=*/false);
        assert.deepEqual(wm._activated, []);
        assert.deepEqual(wm._appended, []);
    });

    it('appends new workspaces in dynamic mode until target exists', () => {
        const wm = mockWsManager({nWorkspaces: 2, activeIndex: 0, dynamic: true});
        switchToWorkspace(wm, 4, /*dynamic=*/true);
        // Should append workspaces 2, 3, 4 and activate 4
        assert.deepEqual(wm._appended, [2, 3, 4]);
        // append_new_workspace(true, ...) activates each as appended; final activation
        // is on workspace 4. So 4 should appear in activated.
        assert.ok(wm._activated.includes(4));
    });

    it('ignores negative index', () => {
        const wm = mockWsManager({nWorkspaces: 3, activeIndex: 1, dynamic: false});
        switchToWorkspace(wm, -1, /*dynamic=*/false);
        assert.deepEqual(wm._activated, []);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --test-name-pattern="switchToWorkspace"`
Expected: FAIL — module `../src/core/workspaceActions.js` not found.

- [ ] **Step 3: Create the module with minimal implementation**

Create `src/core/workspaceActions.js`:

```javascript
/**
 * Workspace actions for HyperGnome's workspace keybindings.
 *
 * Pure-ish module: all dependencies (workspace manager, dynamic-workspaces
 * flag) are passed in, so this is unit-testable without a live GNOME shell.
 *
 * Index semantics: 0-based throughout (workspace 1 in the UI = index 0).
 * Callers from keybinding handlers should convert from the user-facing
 * 1-based binding name (e.g. tile-workspace-1) to a 0-based index.
 */

/**
 * Switch to the given workspace by 0-based index.
 *
 * In dynamic mode: appends workspaces as needed until `index` exists, then
 * activates it. In fixed mode: no-op when `index` is out of range.
 *
 * @param {object} workspaceManager - Meta.WorkspaceManager (or mock)
 * @param {number} index - 0-based target workspace
 * @param {boolean} dynamic - whether dynamic-workspaces is enabled
 * @param {number} [time] - Clutter event time (default global.get_current_time())
 */
export function switchToWorkspace(workspaceManager, index, dynamic, time = 0) {
    if (index < 0) return;
    const n = workspaceManager.get_n_workspaces();
    if (index < n) {
        const ws = workspaceManager.get_workspace_by_index(index);
        if (ws) ws.activate(time);
        return;
    }
    if (!dynamic) return;
    // Dynamic mode: append until index exists, activating the last one.
    let current = n;
    while (current <= index) {
        const shouldActivate = current === index;
        workspaceManager.append_new_workspace(shouldActivate, time);
        current += 1;
    }
}

export function moveActiveToWorkspace(_workspaceManager, _focusedWindow, _index, _dynamic, _time) {
    // Filled in by a later task
}

export function cycleWorkspace(_workspaceManager, _direction, _time) {
    // Filled in by a later task
}

export function moveActiveAndCycle(_workspaceManager, _focusedWindow, _direction, _time) {
    // Filled in by a later task
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --test-name-pattern="switchToWorkspace"`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/workspaceActions.js tests/workspaceActions.test.js
git commit -m "feat(keybinds): add switchToWorkspace action with tests"
```

---

## Task 4: `moveActiveToWorkspace` with TDD

**Files:**
- Modify: `src/core/workspaceActions.js`
- Modify: `tests/workspaceActions.test.js`

- [ ] **Step 1: Add failing tests**

Append to `tests/workspaceActions.test.js`:

```javascript
function mockWindow() {
    const moves = [];
    return {
        _moves: moves,
        change_workspace_by_index: (index, append) => moves.push({index, append}),
    };
}

describe('moveActiveToWorkspace', () => {
    it('moves window to existing workspace and activates it', () => {
        const wm = mockWsManager({nWorkspaces: 4, activeIndex: 0, dynamic: false});
        const win = mockWindow();
        moveActiveToWorkspace(wm, win, 2, /*dynamic=*/false);
        assert.deepEqual(win._moves, [{index: 2, append: false}]);
        assert.deepEqual(wm._activated, [2]);
    });

    it('no-op when window is null', () => {
        const wm = mockWsManager({nWorkspaces: 4, activeIndex: 0, dynamic: false});
        moveActiveToWorkspace(wm, null, 2, /*dynamic=*/false);
        assert.deepEqual(wm._activated, []);
    });

    it('no-op when target out of range in fixed mode', () => {
        const wm = mockWsManager({nWorkspaces: 2, activeIndex: 0, dynamic: false});
        const win = mockWindow();
        moveActiveToWorkspace(wm, win, 7, /*dynamic=*/false);
        assert.deepEqual(win._moves, []);
        assert.deepEqual(wm._activated, []);
    });

    it('appends in dynamic mode then moves and activates', () => {
        const wm = mockWsManager({nWorkspaces: 2, activeIndex: 0, dynamic: true});
        const win = mockWindow();
        moveActiveToWorkspace(wm, win, 4, /*dynamic=*/true);
        assert.deepEqual(wm._appended, [2, 3, 4]);
        assert.deepEqual(win._moves, [{index: 4, append: false}]);
        assert.ok(wm._activated.includes(4));
    });
});
```

- [ ] **Step 2: Run the new tests to verify failure**

Run: `npm test -- --test-name-pattern="moveActiveToWorkspace"`
Expected: FAIL — assertions fail because the function body is empty.

- [ ] **Step 3: Implement `moveActiveToWorkspace`**

Replace the placeholder in `src/core/workspaceActions.js`:

```javascript
/**
 * Move the focused window to the given workspace and follow it there.
 *
 * @param {object} workspaceManager - Meta.WorkspaceManager (or mock)
 * @param {object|null} focusedWindow - Meta.Window or null
 * @param {number} index - 0-based target workspace
 * @param {boolean} dynamic - whether dynamic-workspaces is enabled
 * @param {number} [time] - Clutter event time
 */
export function moveActiveToWorkspace(workspaceManager, focusedWindow, index, dynamic, time = 0) {
    if (!focusedWindow) return;
    if (index < 0) return;
    const n = workspaceManager.get_n_workspaces();
    if (index >= n) {
        if (!dynamic) return;
        // Append placeholders until index exists, without activating intermediates.
        let current = n;
        while (current < index) {
            workspaceManager.append_new_workspace(false, time);
            current += 1;
        }
        // Final workspace at exactly `index`.
        workspaceManager.append_new_workspace(false, time);
    }
    focusedWindow.change_workspace_by_index(index, false);
    const ws = workspaceManager.get_workspace_by_index(index);
    if (ws) ws.activate(time);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --test-name-pattern="moveActiveToWorkspace"`
Expected: PASS — 4 tests pass. Also re-run `switchToWorkspace` block to confirm no regression: `npm test`. Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/workspaceActions.js tests/workspaceActions.test.js
git commit -m "feat(keybinds): add moveActiveToWorkspace action"
```

---

## Task 5: `cycleWorkspace` and `moveActiveAndCycle` with TDD

**Files:**
- Modify: `src/core/workspaceActions.js`
- Modify: `tests/workspaceActions.test.js`

- [ ] **Step 1: Add failing tests**

Append to `tests/workspaceActions.test.js`:

```javascript
describe('cycleWorkspace', () => {
    it('moves forward when not at last workspace', () => {
        const wm = mockWsManager({nWorkspaces: 4, activeIndex: 1, dynamic: false});
        cycleWorkspace(wm, +1);
        assert.deepEqual(wm._activated, [2]);
    });

    it('moves backward when not at first workspace', () => {
        const wm = mockWsManager({nWorkspaces: 4, activeIndex: 2, dynamic: false});
        cycleWorkspace(wm, -1);
        assert.deepEqual(wm._activated, [1]);
    });

    it('clamps at last workspace (no wrap, no append)', () => {
        const wm = mockWsManager({nWorkspaces: 3, activeIndex: 2, dynamic: true});
        cycleWorkspace(wm, +1);
        assert.deepEqual(wm._activated, []);
        assert.deepEqual(wm._appended, []);
    });

    it('clamps at first workspace', () => {
        const wm = mockWsManager({nWorkspaces: 3, activeIndex: 0, dynamic: false});
        cycleWorkspace(wm, -1);
        assert.deepEqual(wm._activated, []);
    });
});

describe('moveActiveAndCycle', () => {
    it('moves window to neighbor and activates it', () => {
        const wm = mockWsManager({nWorkspaces: 4, activeIndex: 1, dynamic: false});
        const win = mockWindow();
        moveActiveAndCycle(wm, win, +1);
        assert.deepEqual(win._moves, [{index: 2, append: false}]);
        assert.deepEqual(wm._activated, [2]);
    });

    it('no-op at boundary', () => {
        const wm = mockWsManager({nWorkspaces: 3, activeIndex: 2, dynamic: false});
        const win = mockWindow();
        moveActiveAndCycle(wm, win, +1);
        assert.deepEqual(win._moves, []);
        assert.deepEqual(wm._activated, []);
    });

    it('no-op when no focused window', () => {
        const wm = mockWsManager({nWorkspaces: 3, activeIndex: 1, dynamic: false});
        moveActiveAndCycle(wm, null, +1);
        assert.deepEqual(wm._activated, []);
    });
});
```

- [ ] **Step 2: Run the new tests to verify failure**

Run: `npm test -- --test-name-pattern="cycleWorkspace|moveActiveAndCycle"`
Expected: FAIL — placeholder bodies do nothing.

- [ ] **Step 3: Implement both functions**

Replace the placeholders in `src/core/workspaceActions.js`:

```javascript
/**
 * Cycle to the previous (-1) or next (+1) workspace.
 *
 * Clamps at the boundaries — no wrap, no appending. Matches GNOME's existing
 * switch-to-workspace-up/down behaviour.
 *
 * @param {object} workspaceManager - Meta.WorkspaceManager (or mock)
 * @param {number} direction - +1 (next) or -1 (prev)
 * @param {number} [time] - Clutter event time
 */
export function cycleWorkspace(workspaceManager, direction, time = 0) {
    const current = workspaceManager.get_active_workspace_index();
    const target = current + direction;
    if (target < 0) return;
    if (target >= workspaceManager.get_n_workspaces()) return;
    const ws = workspaceManager.get_workspace_by_index(target);
    if (ws) ws.activate(time);
}

/**
 * Move the focused window to the neighbouring workspace and follow it.
 *
 * @param {object} workspaceManager - Meta.WorkspaceManager (or mock)
 * @param {object|null} focusedWindow - Meta.Window or null
 * @param {number} direction - +1 (next) or -1 (prev)
 * @param {number} [time] - Clutter event time
 */
export function moveActiveAndCycle(workspaceManager, focusedWindow, direction, time = 0) {
    if (!focusedWindow) return;
    const current = workspaceManager.get_active_workspace_index();
    const target = current + direction;
    if (target < 0) return;
    if (target >= workspaceManager.get_n_workspaces()) return;
    focusedWindow.change_workspace_by_index(target, false);
    const ws = workspaceManager.get_workspace_by_index(target);
    if (ws) ws.activate(time);
}
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: all `workspaceActions` tests pass; no regression in other test files.

- [ ] **Step 5: Commit**

```bash
git add src/core/workspaceActions.js tests/workspaceActions.test.js
git commit -m "feat(keybinds): add cycleWorkspace and moveActiveAndCycle actions"
```

---

## Task 6: Wire workspace bindings into `KeybindingManager`

This task only wires the new bindings to the existing `_addBinding()` path. Override gating comes in Task 7.

**Files:**
- Modify: `src/core/keybindings.js`

- [ ] **Step 1: Add the import**

Update the imports at the top of `src/core/keybindings.js`:

```javascript
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as WorkspaceActions from './workspaceActions.js';
```

- [ ] **Step 2: Add workspace bindings in `enable()`**

In `src/core/keybindings.js`, insert *after* the existing `tile-resize-*` bindings (after line 53) and *before* the `// -- Override conflicting GNOME keybindings --` comment:

```javascript
        // -- Custom keybindings (workspaces, Hyprland-style) --
        const wm = global.workspace_manager;
        const isDynamic = () => {
            try {
                const mutter = new (imports.gi.Gio.Settings)({
                    schema_id: 'org.gnome.mutter',
                });
                return mutter.get_boolean('dynamic-workspaces');
            } catch (_e) {
                return true; // sensible default
            }
        };
        const now = () => global.get_current_time();

        for (let i = 1; i <= 10; i++) {
            const target = i - 1; // 0-based
            this._addBinding(`tile-workspace-${i}`,
                () => WorkspaceActions.switchToWorkspace(wm, target, isDynamic(), now()));
            this._addBinding(`tile-move-to-workspace-${i}`,
                () => WorkspaceActions.moveActiveToWorkspace(
                    wm, global.display.focus_window, target, isDynamic(), now()));
        }
        this._addBinding('tile-workspace-prev',
            () => WorkspaceActions.cycleWorkspace(wm, -1, now()));
        this._addBinding('tile-workspace-next',
            () => WorkspaceActions.cycleWorkspace(wm, +1, now()));
        this._addBinding('tile-move-workspace-prev',
            () => WorkspaceActions.moveActiveAndCycle(
                wm, global.display.focus_window, -1, now()));
        this._addBinding('tile-move-workspace-next',
            () => WorkspaceActions.moveActiveAndCycle(
                wm, global.display.focus_window, +1, now()));
```

Note: replace `imports.gi.Gio` with a clean import. At the top of the file, change the imports to:

```javascript
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as WorkspaceActions from './workspaceActions.js';
```

Then in the closure, use:

```javascript
        const isDynamic = () => {
            try {
                const mutter = new Gio.Settings({schema_id: 'org.gnome.mutter'});
                return mutter.get_boolean('dynamic-workspaces');
            } catch (_e) {
                return true;
            }
        };
```

- [ ] **Step 3: Reload the extension and smoke-test**

Run, in a fresh X11 GNOME session (or nested wayland):

```bash
make install         # rebuilds + symlinks
# In a GUI X11 session: Alt+F2, type 'r', press Enter to restart shell.
gnome-extensions enable hypergnome@hypergnome.dev
```

Test manually:
- Press `Super+2` — should switch to workspace 2 (creating it if dynamic).
- Press `Super+Shift+3` — moves focused window to workspace 3.
- Press `Super+]` — moves to next workspace.
- Press `Super+Shift+[` — moves window to previous workspace.

Note expected limitation at this point: `Super+1..9` will still conflict with GNOME's `switch-to-application-N` (the override is still missing). Either binding may win depending on Mutter; we fix that in the next task. Pressing the brackets and Shift-number bindings should already work cleanly.

Watch logs: `journalctl -f -o cat /usr/bin/gnome-shell` — no JS errors expected.

- [ ] **Step 4: Commit**

```bash
git add src/core/keybindings.js
git commit -m "feat(keybinds): register workspace and move-to-workspace bindings"
```

---

## Task 7: Add `switch-to-application-N` override suppressions

**Files:**
- Modify: `src/core/keybindings.js`

This task only adds the new override calls. The toggle-gating that switches them on and off is in Task 8.

- [ ] **Step 1: Add the suppression block in `enable()`**

In `src/core/keybindings.js`, in `enable()`, append at the end (just before the closing `}` of `enable()`):

```javascript
        // Super+1..9 is GNOME's switch-to-application-N — conflicts with our
        // tile-workspace-N bindings. Suppress with a no-op handler.
        for (let i = 1; i <= 9; i++) {
            this._overrideBinding(`switch-to-application-${i}`, () => {
                // Swallowed — our tile-workspace-N handles Super+N
            });
        }
```

- [ ] **Step 2: Verify cleanup tracks the new overrides**

Re-read the existing `_overrideBinding()` method (lines 143-152). Confirm that every call appends to `this._overriddenBindings`, and that `disable()` iterates `this._overriddenBindings` calling `Meta.keybindings_set_custom_handler(name, null)`. No code change needed — just verify by inspection that the new override calls are tracked.

- [ ] **Step 3: Reload and smoke-test**

```bash
make install
# Restart shell (Alt+F2, r)
```

Test:
- `Super+1` should now reach `tile-workspace-1` (no more app dash launch).
- Disable the extension via `gnome-extensions disable hypergnome@hypergnome.dev`.
- Run `gsettings get org.gnome.shell.keybindings switch-to-application-1` — should still be `['<Super>1']` (the schema default; the custom handler is what we cleared).
- Re-enable: `Super+1` works again. Disable: GNOME's app dash launch returns.

- [ ] **Step 4: Commit**

```bash
git add src/core/keybindings.js
git commit -m "feat(keybinds): suppress GNOME switch-to-application-N on Super+1..9"
```

---

## Task 8: Gate all overrides behind `override-gnome-shortcuts` toggle

**Files:**
- Modify: `src/core/keybindings.js`

This is the central refactor. Split `enable()` so the override calls live in their own private method, gated by the setting.

- [ ] **Step 1: Refactor `enable()` to extract overrides into a private method**

Replace the contents of `src/core/keybindings.js` `enable()` with this structure. Keep all custom-binding code (focus, move, resize, actions, master, workspaces) inside `enable()`. Move all `_overrideBinding()` calls into a new `_installGnomeOverrides()` method:

```javascript
    enable() {
        this._overrideEnabled = this._settings.get_boolean('override-gnome-shortcuts');

        this._registerCustomBindings();
        if (this._overrideEnabled) {
            this._installGnomeOverrides();
        }
        this._connectToggleListener();
    }

    _registerCustomBindings() {
        // -- Custom keybindings (vim-style focus) --
        this._addBinding('tile-focus-left', () => this._tilingManager.focusDirection('left'));
        this._addBinding('tile-focus-down', () => this._tilingManager.focusDirection('down'));
        this._addBinding('tile-focus-up', () => this._tilingManager.focusDirection('up'));
        this._addBinding('tile-focus-right', () => this._tilingManager.focusDirection('right'));

        // -- Custom keybindings (move window) --
        this._addBinding('tile-move-left', () => this._tilingManager.moveDirection('left'));
        this._addBinding('tile-move-down', () => this._tilingManager.moveDirection('down'));
        this._addBinding('tile-move-up', () => this._tilingManager.moveDirection('up'));
        this._addBinding('tile-move-right', () => this._tilingManager.moveDirection('right'));

        // -- Custom keybindings (actions) --
        this._addBinding('tile-toggle-float', () => this._tilingManager.toggleFloat());
        this._addBinding('tile-close-window', () => this._tilingManager.closeWindow());
        this._addBinding('tile-toggle-split', () => this._tilingManager.toggleSplit());
        this._addBinding('tile-equalize', () => this._tilingManager.equalize());

        // -- Custom keybindings (master layout) --
        this._addBinding('tile-swap-master',
            () => this._tilingManager.swapWithMaster());
        this._addBinding('tile-focus-master',
            () => this._tilingManager.focusMaster());
        this._addBinding('tile-cycle-orientation',
            () => this._tilingManager.cycleOrientation());

        // -- Custom keybindings (resize window) --
        this._addBinding('tile-resize-left', () => this._tilingManager.resizeDirection('left'));
        this._addBinding('tile-resize-down', () => this._tilingManager.resizeDirection('down'));
        this._addBinding('tile-resize-up', () => this._tilingManager.resizeDirection('up'));
        this._addBinding('tile-resize-right', () => this._tilingManager.resizeDirection('right'));

        // -- Custom keybindings (workspaces, Hyprland-style) --
        const wm = global.workspace_manager;
        const isDynamic = () => {
            try {
                const mutter = new Gio.Settings({schema_id: 'org.gnome.mutter'});
                return mutter.get_boolean('dynamic-workspaces');
            } catch (_e) {
                return true;
            }
        };
        const now = () => global.get_current_time();

        for (let i = 1; i <= 10; i++) {
            const target = i - 1;
            this._addBinding(`tile-workspace-${i}`,
                () => WorkspaceActions.switchToWorkspace(wm, target, isDynamic(), now()));
            this._addBinding(`tile-move-to-workspace-${i}`,
                () => WorkspaceActions.moveActiveToWorkspace(
                    wm, global.display.focus_window, target, isDynamic(), now()));
        }
        this._addBinding('tile-workspace-prev',
            () => WorkspaceActions.cycleWorkspace(wm, -1, now()));
        this._addBinding('tile-workspace-next',
            () => WorkspaceActions.cycleWorkspace(wm, +1, now()));
        this._addBinding('tile-move-workspace-prev',
            () => WorkspaceActions.moveActiveAndCycle(
                wm, global.display.focus_window, -1, now()));
        this._addBinding('tile-move-workspace-next',
            () => WorkspaceActions.moveActiveAndCycle(
                wm, global.display.focus_window, +1, now()));
    }

    _installGnomeOverrides() {
        // -- Override conflicting GNOME keybindings --

        // Super+H is GNOME minimize — conflicts with our focus-left
        this._overrideBinding('minimize', () => {
            // Swallowed — our tile-focus-left handles Super+H
        });

        // Super+Left/Right is GNOME half-tile — we handle tiling
        this._overrideBinding('toggle-tiled-left', () => {
            this._tilingManager.focusDirection('left');
        });
        this._overrideBinding('toggle-tiled-right', () => {
            this._tilingManager.focusDirection('right');
        });

        // Super+Down is GNOME unmaximize — conflicts with our focus-down
        this._overrideBinding('unmaximize', () => {
            this._tilingManager.focusDirection('down');
        });

        // Super+Shift+Arrow is GNOME move-to-monitor — conflicts with our
        // tile-move-* bindings.
        this._overrideBinding('move-to-monitor-left', () => {
            this._tilingManager.moveDirection('left');
        });
        this._overrideBinding('move-to-monitor-right', () => {
            this._tilingManager.moveDirection('right');
        });
        this._overrideBinding('move-to-monitor-up', () => {
            this._tilingManager.moveDirection('up');
        });
        this._overrideBinding('move-to-monitor-down', () => {
            this._tilingManager.moveDirection('down');
        });

        // Super+1..9 is GNOME's switch-to-application-N — conflicts with our
        // tile-workspace-N bindings.
        for (let i = 1; i <= 9; i++) {
            this._overrideBinding(`switch-to-application-${i}`, () => {
                // Swallowed — our tile-workspace-N handles Super+N
            });
        }
    }

    _connectToggleListener() {
        this._settingsChangedId = this._settings.connect(
            'changed::override-gnome-shortcuts',
            () => {
                try {
                    this._reloadBindings();
                } catch (e) {
                    logError(e, 'HyperGnome: failed to reload bindings on toggle change');
                }
            });
    }

    _reloadBindings() {
        // Tear down everything except the settings listener, then rebuild.
        for (const name of this._customBindings) {
            try { Main.wm.removeKeybinding(name); } catch (_e) {}
        }
        this._customBindings = [];

        for (const name of this._overriddenBindings) {
            try { Meta.keybindings_set_custom_handler(name, null); } catch (_e) {}
        }
        this._overriddenBindings = [];

        this._overrideEnabled = this._settings.get_boolean('override-gnome-shortcuts');
        this._registerCustomBindings();
        if (this._overrideEnabled) {
            this._installGnomeOverrides();
        }
    }
```

- [ ] **Step 2: Update the constructor**

Update `constructor()` to initialise the new fields:

```javascript
    constructor(settings, tilingManager) {
        this._settings = settings;
        this._tilingManager = tilingManager;
        this._customBindings = [];
        this._overriddenBindings = [];
        this._settingsChangedId = 0;
        this._overrideEnabled = false;
    }
```

- [ ] **Step 3: Update `disable()` to disconnect the listener**

Replace the `disable()` method body's beginning:

```javascript
    disable() {
        if (this._settingsChangedId && this._settings) {
            try {
                this._settings.disconnect(this._settingsChangedId);
            } catch (_e) {}
            this._settingsChangedId = 0;
        }

        for (const name of this._customBindings) {
            try {
                Main.wm.removeKeybinding(name);
            } catch (_e) {
                // Already removed
            }
        }
        this._customBindings = [];

        for (const name of this._overriddenBindings) {
            try {
                Meta.keybindings_set_custom_handler(name, null);
            } catch (_e) {
                // Already restored
            }
        }
        this._overriddenBindings = [];

        this._settings = null;
        this._tilingManager = null;
    }
```

- [ ] **Step 4: Reload and test toggle behaviour**

```bash
make install
# Restart shell (Alt+F2, r)
```

Tests:
1. Default state — `Super+H` focuses left, `Super+1` switches to workspace 1. ✓
2. Toggle off:
   ```bash
   gsettings set org.gnome.shell.extensions.hypergnome override-gnome-shortcuts false
   ```
   - `Super+H` should now minimize the window (GNOME behaviour restored).
   - `Super+1` should now open the first app from the dash (GNOME behaviour restored).
   - `Super+[` should still switch workspace (our custom binding, not overridden).
3. Toggle on:
   ```bash
   gsettings set org.gnome.shell.extensions.hypergnome override-gnome-shortcuts true
   ```
   - `Super+H` and `Super+1` resume HyperGnome behaviour without restarting the shell.
4. Watch logs for stale-signal warnings: `journalctl -f -o cat /usr/bin/gnome-shell`. Toggle several times; no warnings expected.
5. Disable the extension: `gnome-extensions disable hypergnome@hypergnome.dev`. Verify `Super+H` minimizes and `Super+1` launches app. Re-enable and re-verify.

- [ ] **Step 5: Commit**

```bash
git add src/core/keybindings.js
git commit -m "feat(keybinds): gate GNOME overrides behind override-gnome-shortcuts toggle"
```

---

## Task 9: Prefs UI — master toggle row

**Files:**
- Modify: `prefs.js`

- [ ] **Step 1: Add the toggle group at the top of the Keybindings page**

In `prefs.js`, inside `_buildKeybindingsPage(page, settings)` (starts at line 480), insert this block as the *first* thing in the method (immediately after the opening `{`), before the existing `const STATIC_OVERRIDES = [...]` declaration:

```javascript
        // -- GNOME Integration (master override toggle) --
        const integrationGroup = new Adw.PreferencesGroup({
            title: _('GNOME Integration'),
            description: _('Control whether HyperGnome takes over conflicting GNOME shortcuts.'),
        });
        page.add(integrationGroup);

        const overrideRow = new Adw.SwitchRow({
            title: _('Override Conflicting GNOME Shortcuts'),
            subtitle: _('Required for default HyperGnome bindings to work. When off, conflicting shortcuts (Super+H, Super+1..9, Super+Arrows, etc.) keep their GNOME meaning; you may need to rebind HyperGnome\'s shortcuts manually.'),
        });
        integrationGroup.add(overrideRow);
        settings.bind('override-gnome-shortcuts', overrideRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
```

- [ ] **Step 2: Open prefs and verify**

```bash
make install
gnome-extensions prefs hypergnome@hypergnome.dev
```

Navigate to the Keybindings tab. Verify:
- "GNOME Integration" group appears at the top.
- Toggle defaults to ON.
- Flipping it writes to GSettings (verify with `gsettings get org.gnome.shell.extensions.hypergnome override-gnome-shortcuts` in another terminal).
- Flipping it hot-reloads the bindings (verify with `Super+H` in another window).

- [ ] **Step 3: Commit**

```bash
git add prefs.js
git commit -m "feat(prefs): add GNOME Integration override-shortcuts switch row"
```

---

## Task 10: Prefs UI — Workspaces binding group

**Files:**
- Modify: `prefs.js`

- [ ] **Step 1: Add a Workspaces entry to `BINDING_GROUPS`**

In `prefs.js`, locate the `BINDING_GROUPS` array (starts at line 510). Append this group as the last entry (after the `Actions` group, before the closing `];`):

```javascript
            {
                title: _('Workspaces'),
                bindings: [
                    {key: 'tile-workspace-1', label: _('Switch to Workspace 1')},
                    {key: 'tile-workspace-2', label: _('Switch to Workspace 2')},
                    {key: 'tile-workspace-3', label: _('Switch to Workspace 3')},
                    {key: 'tile-workspace-4', label: _('Switch to Workspace 4')},
                    {key: 'tile-workspace-5', label: _('Switch to Workspace 5')},
                    {key: 'tile-workspace-6', label: _('Switch to Workspace 6')},
                    {key: 'tile-workspace-7', label: _('Switch to Workspace 7')},
                    {key: 'tile-workspace-8', label: _('Switch to Workspace 8')},
                    {key: 'tile-workspace-9', label: _('Switch to Workspace 9')},
                    {key: 'tile-workspace-10', label: _('Switch to Workspace 10')},
                    {key: 'tile-workspace-prev', label: _('Cycle to Previous Workspace')},
                    {key: 'tile-workspace-next', label: _('Cycle to Next Workspace')},
                    {key: 'tile-move-to-workspace-1', label: _('Move Window to Workspace 1')},
                    {key: 'tile-move-to-workspace-2', label: _('Move Window to Workspace 2')},
                    {key: 'tile-move-to-workspace-3', label: _('Move Window to Workspace 3')},
                    {key: 'tile-move-to-workspace-4', label: _('Move Window to Workspace 4')},
                    {key: 'tile-move-to-workspace-5', label: _('Move Window to Workspace 5')},
                    {key: 'tile-move-to-workspace-6', label: _('Move Window to Workspace 6')},
                    {key: 'tile-move-to-workspace-7', label: _('Move Window to Workspace 7')},
                    {key: 'tile-move-to-workspace-8', label: _('Move Window to Workspace 8')},
                    {key: 'tile-move-to-workspace-9', label: _('Move Window to Workspace 9')},
                    {key: 'tile-move-to-workspace-10', label: _('Move Window to Workspace 10')},
                    {key: 'tile-move-workspace-prev', label: _('Move Window to Previous Workspace')},
                    {key: 'tile-move-workspace-next', label: _('Move Window to Next Workspace')},
                ],
            },
```

- [ ] **Step 2: Add the new `switch-to-application-N` overrides to `STATIC_OVERRIDES`**

Still in `_buildKeybindingsPage`, locate the `STATIC_OVERRIDES` array (line 482). Append nine entries after the existing `unmaximize` entry, before the closing `];`:

```javascript
            {
                gnomeName: 'switch-to-application-1',
                gnomeLabel: 'Activate Favourite App 1',
                schema: 'org.gnome.shell.keybindings',
                replacement: 'Disabled (Super+1 switches workspace)',
            },
            {
                gnomeName: 'switch-to-application-2',
                gnomeLabel: 'Activate Favourite App 2',
                schema: 'org.gnome.shell.keybindings',
                replacement: 'Disabled (Super+2 switches workspace)',
            },
            {
                gnomeName: 'switch-to-application-3',
                gnomeLabel: 'Activate Favourite App 3',
                schema: 'org.gnome.shell.keybindings',
                replacement: 'Disabled (Super+3 switches workspace)',
            },
            {
                gnomeName: 'switch-to-application-4',
                gnomeLabel: 'Activate Favourite App 4',
                schema: 'org.gnome.shell.keybindings',
                replacement: 'Disabled (Super+4 switches workspace)',
            },
            {
                gnomeName: 'switch-to-application-5',
                gnomeLabel: 'Activate Favourite App 5',
                schema: 'org.gnome.shell.keybindings',
                replacement: 'Disabled (Super+5 switches workspace)',
            },
            {
                gnomeName: 'switch-to-application-6',
                gnomeLabel: 'Activate Favourite App 6',
                schema: 'org.gnome.shell.keybindings',
                replacement: 'Disabled (Super+6 switches workspace)',
            },
            {
                gnomeName: 'switch-to-application-7',
                gnomeLabel: 'Activate Favourite App 7',
                schema: 'org.gnome.shell.keybindings',
                replacement: 'Disabled (Super+7 switches workspace)',
            },
            {
                gnomeName: 'switch-to-application-8',
                gnomeLabel: 'Activate Favourite App 8',
                schema: 'org.gnome.shell.keybindings',
                replacement: 'Disabled (Super+8 switches workspace)',
            },
            {
                gnomeName: 'switch-to-application-9',
                gnomeLabel: 'Activate Favourite App 9',
                schema: 'org.gnome.shell.keybindings',
                replacement: 'Disabled (Super+9 switches workspace)',
            },
```

- [ ] **Step 3: Open prefs and verify**

```bash
make install
gnome-extensions prefs hypergnome@hypergnome.dev
```

- "Overridden GNOME Shortcuts" section now lists 13 entries (4 existing + 9 new).
- A new "Workspaces" group appears with 24 binding rows showing the correct default accelerators.
- No JS errors in prefs (run from a terminal to see exceptions).

- [ ] **Step 4: Commit**

```bash
git add prefs.js
git commit -m "feat(prefs): add Workspaces binding group and switch-to-application-N override rows"
```

---

## Task 11: Documentation update

**Files:**
- Modify: `docs/00-project-decisions.md` (or whichever doc file lists keybindings — verify by reading)
- Modify: `README.md`

- [ ] **Step 1: Read the existing keybinding docs**

Run: `grep -rln "Super+H\|tile-focus-left\|keybinding" docs/ README.md`

Identify the file(s) listing the current keybindings.

- [ ] **Step 2: Update the keybinding tables/lists**

Add a new section/table for workspace bindings under "Default Keybindings":

```
| Action                            | Default Accelerator |
| --------------------------------- | ------------------- |
| Switch to Workspace 1..10         | Super+1..9, Super+0 |
| Move Window to Workspace 1..10    | Super+Shift+1..9/0  |
| Cycle to Previous Workspace       | Super+[             |
| Cycle to Next Workspace           | Super+]             |
| Move Window to Previous Workspace | Super+Shift+[       |
| Move Window to Next Workspace     | Super+Shift+]       |
```

Add a paragraph under "GNOME Integration" or similar:

> HyperGnome overrides some GNOME shortcuts that conflict with its defaults (Super+H, Super+1..9, Super+Arrows, Super+Shift+Arrows). This is on by default. To disable, open the extension preferences → Keybindings → GNOME Integration → Override Conflicting GNOME Shortcuts. When off, you'll need to rebind any HyperGnome shortcut whose default accelerator conflicts with a GNOME default.

- [ ] **Step 3: Commit**

```bash
git add docs/ README.md
git commit -m "docs(keybinds): document workspace bindings and override toggle"
```

---

## Task 12: Final integration smoke test

No code changes — purely verification.

- [ ] **Step 1: Run the test suite**

Run: `npm test`
Expected: all tests pass (tree, layout, masterLayout, tilingActions, colorParser, windowBlock, **workspaceActions**).

- [ ] **Step 2: Fresh install and full manual matrix**

```bash
make install
# Restart shell (Alt+F2, r)
gnome-extensions disable hypergnome@hypergnome.dev
gnome-extensions enable  hypergnome@hypergnome.dev
```

Verify with override **ON** (default):

- [ ] Super+1..9 switches workspaces; Super+0 → workspace 10 (creating if dynamic).
- [ ] Super+Shift+1..9, Super+Shift+0 moves the focused window to that workspace and follows.
- [ ] Super+[ / Super+] cycles workspaces; clamps at boundaries.
- [ ] Super+Shift+[ / Super+Shift+] moves window with cycle.
- [ ] Super+H/J/K/L still focuses neighbours.
- [ ] Super+Shift+H/J/K/L still moves windows.
- [ ] Super+Ctrl+H/J/K/L still resizes.

Toggle override **OFF**:

- [ ] `gsettings set org.gnome.shell.extensions.hypergnome override-gnome-shortcuts false`
- [ ] Super+H minimises window (GNOME default restored).
- [ ] Super+1 launches first dash app (GNOME default restored).
- [ ] Super+[ / Super+] still cycles workspaces (no conflict; our binding registered).
- [ ] Super+Shift+1..9 — behaviour depends on user's GNOME config; document as "may need rebinding".

Toggle back **ON**, then disable the extension entirely:

- [ ] `gsettings get org.gnome.shell.keybindings switch-to-application-1` still returns `['<Super>1']`.
- [ ] Super+1 launches the dash app (handler restored).
- [ ] Super+H minimises (handler restored).

- [ ] **Step 3: Check journal for leaks/warnings**

While performing the steps above, tail logs:
`journalctl -f -o cat /usr/bin/gnome-shell`

Toggle the override on/off three times. Expected: no warnings about leaked signals, no JS errors mentioning HyperGnome.

- [ ] **Step 4: Open a PR**

If everything passes, push the branch and open a PR titled `feat(keybinds): add override toggle and Hyprland-style workspace keybindings` with summary bullets and a test plan checklist that mirrors Step 2 above.

```bash
git push -u origin <branch>
gh pr create --title "feat(keybinds): add override toggle and Hyprland-style workspace keybindings" --body "$(cat <<'EOF'
## Summary
- New `override-gnome-shortcuts` master toggle (defaults on) gating all GNOME-keybinding overrides
- Hyprland-style workspace bindings: Super+1..0, Super+Shift+1..0, Super+[/], Super+Shift+[/]
- New `workspaceActions.js` module with unit tests
- Suppresses GNOME's `switch-to-application-1..9` while overrides are on
- Hot-reload: toggling the setting tears down and reinstalls bindings without restarting the shell

## Test plan
- [x] `npm test` — all unit tests pass (including new workspaceActions tests)
- [ ] Manual: Super+N switches workspace; Super+Shift+N moves window
- [ ] Manual: Super+[/] cycles; Super+Shift+[/] moves with cycle
- [ ] Manual: toggle off restores GNOME's Super+H, Super+1..9 behaviour
- [ ] Manual: disable extension fully restores all GNOME defaults
- [ ] journalctl shows no leaked-signal warnings after repeated toggles

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:** All sections of the design doc are covered.

- Settings schema additions → Tasks 1, 2
- Override toggle behaviour (window-management gating) → Task 8
- Override toggle behaviour (workspace `switch-to-application-N`) → Tasks 7, 8
- Workspace action semantics (clamp/create) → Tasks 3, 4, 5
- Hot-reload via `disable()` + `enable()` → Task 8 (`_reloadBindings`)
- Module layout (`workspaceActions.js`) → Task 3
- Prefs UI (toggle, Workspaces group, expanded overrides list) → Tasks 9, 10
- Tests (`workspaceActions.test.js`) → Tasks 3, 4, 5
- Documentation → Task 11
- Cleanup contract (signal disconnect) → Task 8 Step 3
- Final verification → Task 12

**Placeholder scan:** No "TBD"/"TODO"/"add error handling" placeholders. All code blocks are concrete and complete.

**Type consistency:** Function signatures match across tasks:

- `switchToWorkspace(wm, index, dynamic, time)` — Tasks 3, 6, 8.
- `moveActiveToWorkspace(wm, window, index, dynamic, time)` — Tasks 4, 6, 8.
- `cycleWorkspace(wm, direction, time)` — Tasks 5, 6, 8.
- `moveActiveAndCycle(wm, window, direction, time)` — Tasks 5, 6, 8.

GSettings keys are referenced with the same names across schema (Task 2), keybinding registration (Tasks 6, 8), and prefs UI (Task 10).
