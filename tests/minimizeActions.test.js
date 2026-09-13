import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {
    minimizedWindows,
    restoreLast,
    restoreAll,
} from '../src/core/minimizeActions.js';

/**
 * Build a minimal mock Meta.Window.
 * @param {string} name
 * @param {object} opts
 */
function mockWindow(name, {minimized = true, stamp, userTime = 0, type = 0, skipTaskbar = false} = {}) {
    const log = [];
    const w = {
        name,
        minimized,
        get_window_type: () => type,
        is_skip_taskbar: () => skipTaskbar,
        get_user_time: () => userTime,
        unminimize: () => {
            w.minimized = false;
            log.push('unminimize');
        },
        activate: (_time) => log.push('activate'),
        _log: log,
    };
    if (stamp !== undefined)
        w._hypergnomeMinimizedAt = stamp;
    return w;
}

describe('minimizedWindows', () => {
    it('skips non-minimized, non-normal and skip-taskbar windows', () => {
        const ok = mockWindow('ok', {stamp: 1});
        const wins = [
            ok,
            mockWindow('visible', {minimized: false}),
            mockWindow('dialog', {type: 4}),
            mockWindow('hidden', {skipTaskbar: true}),
        ];
        assert.deepEqual(minimizedWindows(wins).map(w => w.name), ['ok']);
    });

    it('orders by minimize stamp, oldest first', () => {
        const wins = [
            mockWindow('c', {stamp: 30}),
            mockWindow('a', {stamp: 10}),
            mockWindow('b', {stamp: 20}),
        ];
        assert.deepEqual(minimizedWindows(wins).map(w => w.name), ['a', 'b', 'c']);
    });

    it('puts unstamped windows before stamped ones, ordered by user time', () => {
        const wins = [
            mockWindow('stamped', {stamp: 5}),
            mockWindow('old2', {userTime: 200}),
            mockWindow('old1', {userTime: 100}),
        ];
        assert.deepEqual(minimizedWindows(wins).map(w => w.name),
            ['old1', 'old2', 'stamped']);
    });

    it('leaves scratchpad windows to the scratchpad toggle', () => {
        const pad = mockWindow('pad', {stamp: 9});
        pad._hypergnomeScratchpad = true;
        assert.deepEqual(minimizedWindows([pad]), []);
    });

    it('treats throwing windows (being unmanaged) as not restorable', () => {
        const broken = mockWindow('broken');
        broken.get_window_type = () => {
            throw new Error('disposed');
        };
        assert.deepEqual(minimizedWindows([broken]), []);
    });
});

describe('restoreLast', () => {
    it('restores and focuses the most recently minimized window only', () => {
        const a = mockWindow('a', {stamp: 1});
        const b = mockWindow('b', {stamp: 2});
        const restored = restoreLast([b, a]);
        assert.equal(restored, b);
        assert.deepEqual(b._log, ['unminimize', 'activate']);
        assert.deepEqual(a._log, []);
    });

    it('returns null when nothing is minimized', () => {
        assert.equal(restoreLast([mockWindow('v', {minimized: false})]), null);
    });

    it('walks back through the stack on repeated calls', () => {
        const a = mockWindow('a', {stamp: 1});
        const b = mockWindow('b', {stamp: 2});
        const wins = [a, b];
        assert.equal(restoreLast(wins), b);
        assert.equal(restoreLast(wins), a);
        assert.equal(restoreLast(wins), null);
    });
});

describe('restoreAll', () => {
    it('restores every minimized window and focuses the last minimized', () => {
        const a = mockWindow('a', {stamp: 1});
        const b = mockWindow('b', {stamp: 2});
        const v = mockWindow('v', {minimized: false});
        assert.equal(restoreAll([b, v, a]), 2);
        assert.deepEqual(a._log, ['unminimize']);
        assert.deepEqual(b._log, ['unminimize', 'activate']);
        assert.deepEqual(v._log, []);
    });

    it('is a no-op on an empty workspace', () => {
        assert.equal(restoreAll([]), 0);
    });
});
