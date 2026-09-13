import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {planToggle, centerRect} from '../src/core/scratchpad.js';

const WS1 = {name: 'ws1'};
const WS2 = {name: 'ws2'};

function mockWindow(name, {workspace = WS1, minimized = false, sticky = false} = {}) {
    return {
        name,
        minimized,
        get_workspace: () => workspace,
        is_on_all_workspaces: () => sticky,
    };
}

const names = plan => ({action: plan.action, windows: plan.windows.map(w => w.name)});

describe('planToggle', () => {
    it('does nothing without scratchpad windows', () => {
        assert.deepEqual(names(planToggle([], WS1)), {action: 'none', windows: []});
    });

    it('hides members visible on the active workspace', () => {
        const members = [
            mockWindow('here'),
            mockWindow('hidden', {minimized: true}),
            mockWindow('elsewhere', {workspace: WS2}),
        ];
        assert.deepEqual(names(planToggle(members, WS1)), {action: 'hide', windows: ['here']});
    });

    it('treats sticky windows as visible everywhere', () => {
        const members = [mockWindow('sticky', {workspace: WS2, sticky: true})];
        assert.deepEqual(names(planToggle(members, WS1)), {action: 'hide', windows: ['sticky']});
    });

    it('shows all members when none is visible here', () => {
        const members = [
            mockWindow('hidden', {minimized: true}),
            mockWindow('elsewhere', {workspace: WS2}),
        ];
        assert.deepEqual(names(planToggle(members, WS1)),
            {action: 'show', windows: ['hidden', 'elsewhere']});
    });

    it('skips windows that throw (being unmanaged)', () => {
        const broken = mockWindow('broken');
        broken.get_workspace = () => {
            throw new Error('disposed');
        };
        assert.deepEqual(names(planToggle([broken], WS1)), {action: 'show', windows: ['broken']});
    });
});

describe('centerRect', () => {
    const workArea = {x: 100, y: 50, width: 1000, height: 800};

    it('centers a small window without resizing it', () => {
        assert.deepEqual(centerRect({x: 0, y: 0, width: 400, height: 200}, workArea),
            {x: 400, y: 350, width: 400, height: 200});
    });

    it('shrinks an oversized window to 80% of the work area', () => {
        assert.deepEqual(centerRect({x: 0, y: 0, width: 3000, height: 2000}, workArea),
            {x: 200, y: 130, width: 800, height: 640});
    });
});
