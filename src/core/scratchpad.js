/**
 * Scratchpad (Hyprland "special workspace") helpers.
 *
 * GNOME has no hidden workspace, so scratchpad windows are floating windows
 * flagged with `_hypergnomeScratchpad` and hidden by minimizing. Showing the
 * scratchpad pulls every member onto the active workspace, centered on the
 * current monitor.
 *
 * Pure module: windows and rects are passed in, so this is unit-testable
 * without a live GNOME shell.
 */

const MAX_FRACTION = 0.8;

function isVisibleOn(metaWindow, workspace) {
    try {
        if (metaWindow.minimized)
            return false;
        return metaWindow.is_on_all_workspaces() ||
            metaWindow.get_workspace() === workspace;
    } catch (_e) {
        return false;
    }
}

/**
 * Decide what the scratchpad toggle does.
 *
 * Any member already visible on the active workspace → hide those.
 * Otherwise → show every member here.
 *
 * @param {Meta.Window[]} members - windows flagged as scratchpad
 * @param {Meta.Workspace} activeWorkspace
 * @returns {{action: 'hide'|'show'|'none', windows: Meta.Window[]}}
 */
export function planToggle(members, activeWorkspace) {
    if (members.length === 0)
        return {action: 'none', windows: []};
    const visible = members.filter(w => isVisibleOn(w, activeWorkspace));
    if (visible.length > 0)
        return {action: 'hide', windows: visible};
    return {action: 'show', windows: members};
}

/**
 * Center a window on the work area, shrinking it to at most 80% of it.
 * @param {{x: number, y: number, width: number, height: number}} frame
 * @param {{x: number, y: number, width: number, height: number}} workArea
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function centerRect(frame, workArea) {
    const width = Math.round(Math.min(frame.width, workArea.width * MAX_FRACTION));
    const height = Math.round(Math.min(frame.height, workArea.height * MAX_FRACTION));
    return {
        x: workArea.x + Math.round((workArea.width - width) / 2),
        y: workArea.y + Math.round((workArea.height - height) / 2),
        width,
        height,
    };
}
