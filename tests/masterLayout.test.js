import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {Tree} from '../src/core/tree.js';
import {
    Orientation, nextOrientation, getMaster, getMasterLeaf,
    insertMaster,
} from '../src/core/masterLayout.js';

const win = (id) => ({id, toString: () => `win-${id}`});

describe('nextOrientation', () => {
    it('cycles left → right → top → bottom → left', () => {
        assert.equal(nextOrientation(Orientation.LEFT), Orientation.RIGHT);
        assert.equal(nextOrientation(Orientation.RIGHT), Orientation.TOP);
        assert.equal(nextOrientation(Orientation.TOP), Orientation.BOTTOM);
        assert.equal(nextOrientation(Orientation.BOTTOM), Orientation.LEFT);
    });

    it('returns LEFT for unknown input', () => {
        assert.equal(nextOrientation('garbage'), Orientation.LEFT);
    });
});

describe('getMaster', () => {
    it('returns null for empty tree', () => {
        const tree = new Tree();
        assert.equal(getMaster(tree, Orientation.LEFT), null);
        assert.equal(getMasterLeaf(tree, Orientation.LEFT), null);
    });
});

describe('insertMaster — first window', () => {
    it('first window becomes a root leaf', () => {
        const tree = new Tree();
        const w = win(1);
        insertMaster(tree, w, Orientation.LEFT, 0.55);

        assert.equal(tree.root.type, 'leaf');
        assert.equal(tree.root.window, w);
        assert.equal(getMaster(tree, Orientation.LEFT), w);
    });
});

describe('insertMaster — idempotency', () => {
    it('inserting the same window twice is a no-op on the second call', () => {
        const tree = new Tree();
        const w = win('dup');
        insertMaster(tree, w, Orientation.LEFT, 0.55);
        const rootBefore = tree.root;
        insertMaster(tree, w, Orientation.LEFT, 0.55);

        assert.equal(tree.root, rootBefore);
        assert.equal(tree.getWindows().length, 1);
    });
});

describe('insertMaster — second window (each orientation)', () => {
    for (const [orient, splitDir, expectChildA, expectRatio] of [
        [Orientation.LEFT,   'horizontal', true,  0.55],
        [Orientation.RIGHT,  'horizontal', false, 0.45],
        [Orientation.TOP,    'vertical',   true,  0.55],
        [Orientation.BOTTOM, 'vertical',   false, 0.45],
    ]) {
        it(`orientation=${orient}: master stays put, new window becomes stack[0]`, () => {
            const tree = new Tree();
            const wm = win('master');
            const ws = win('stack0');
            insertMaster(tree, wm, orient, 0.55);
            insertMaster(tree, ws, orient, 0.55);

            assert.equal(tree.root.type, 'fork');
            assert.equal(tree.root.splitDirection, splitDir);
            assert.ok(Math.abs(tree.root.splitRatio - expectRatio) < 1e-9);

            const masterChild = expectChildA ? tree.root.childA : tree.root.childB;
            const stackChild  = expectChildA ? tree.root.childB : tree.root.childA;
            assert.equal(masterChild.type, 'leaf');
            assert.equal(masterChild.window, wm);
            assert.equal(stackChild.type, 'leaf');
            assert.equal(stackChild.window, ws);

            assert.equal(getMaster(tree, orient), wm);
        });
    }
});
