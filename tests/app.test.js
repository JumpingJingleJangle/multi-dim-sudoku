import assert from 'assert';
import { test, describe } from 'node:test';
import { SudokuGame } from '../js/game.js';
import { formatDigit, parseDigit } from '../js/utils.js';

describe('SudokuGame Core Engine Tests', () => {
    test('Initialization with 2D puzzle', () => {
        const game = new SudokuGame();
        const dummy2DPuzzle = {
            metadata: { name: "Test 2D", base: 3, dimension: 2 },
            initial_state: [
                { z: 0, y: 0, x: 0, value: 5 },
                { z: 0, y: 0, x: 1, value: 3 }
            ]
        };
        game.initialize(dummy2DPuzzle);
        assert.strictEqual(game.n, 9);
        assert.strictEqual(game.dimension, 2);
        assert.strictEqual(game.nz, 1);
        assert.strictEqual(game.initialBoard[0][0][0], 5);
        assert.strictEqual(game.board[0][0][0], 5);
        assert.strictEqual(game.board[0][0][1], 3);
    });

    test('Conflict Detection in 2D', () => {
        const game = new SudokuGame();
        const dummy2DPuzzle = {
            metadata: { name: "Test 2D Conflict", base: 2, dimension: 2 }, // 4x4
            initial_state: []
        };
        game.initialize(dummy2DPuzzle);
        // Place conflicting values in row 0
        game.execute({ type: 'entry', z: 0, y: 0, x: 0, prev: 0, val: 1 });
        game.execute({ type: 'entry', z: 0, y: 0, x: 2, prev: 0, val: 1 });

        const { errors, isFilled } = game.getConflicts();
        assert.ok(errors.has('0,0,0'));
        assert.ok(errors.has('0,0,2'));
        assert.strictEqual(isFilled, false);
    });

    test('3D Hyper-grid initialization & slicing', () => {
        const game = new SudokuGame();
        const dummy3DPuzzle = {
            metadata: { name: "Test 3D", base: 2, dimension: 3 }, // N = 2^3 = 8
            initial_state: [
                { z: 1, y: 2, x: 3, value: 7 }
            ]
        };
        game.initialize(dummy3DPuzzle);
        assert.strictEqual(game.n, 8);
        assert.strictEqual(game.dimension, 3);
        assert.strictEqual(game.nz, 8);
        assert.strictEqual(game.initialBoard[1][2][3], 7);
    });

    test('Undo and Redo Stack', () => {
        const game = new SudokuGame();
        game.initialize({ metadata: { base: 2, dimension: 2 }, initial_state: [] });

        game.execute({ type: 'entry', z: 0, y: 1, x: 1, prev: 0, val: 4 });
        assert.strictEqual(game.board[0][1][1], 4);

        const undoCoords = game.undo();
        assert.deepStrictEqual(undoCoords, { z: 0, y: 1, x: 1 });
        assert.strictEqual(game.board[0][1][1], 0);

        const redoCoords = game.redo();
        assert.deepStrictEqual(redoCoords, { z: 0, y: 1, x: 1 });
        assert.strictEqual(game.board[0][1][1], 4);
    });

    test('Notation Toggle (Green & Red)', () => {
        const game = new SudokuGame();
        game.initialize({ metadata: { base: 3, dimension: 2 }, initial_state: [] });

        game.execute({ type: 'notation', z: 0, y: 0, x: 0, val: 7, added: true, color: 'green' });
        assert.ok(game.notations[0][0][0].green.has(7));

        game.execute({ type: 'notation', z: 0, y: 0, x: 0, val: 9, added: true, color: 'red' });
        assert.ok(game.notations[0][0][0].red.has(9));
    });

    test('formatDigit and parseDigit handling for Hex (Base 4) and Standard puzzles', () => {
        // formatDigit
        assert.strictEqual(formatDigit(null), "");
        assert.strictEqual(formatDigit(undefined), "");
        assert.strictEqual(formatDigit("0"), "0");
        assert.strictEqual(formatDigit("E"), "E");
        assert.strictEqual(formatDigit(5), "5");

        // parseDigit for Base 4 (Hex)
        assert.strictEqual(parseDigit('0', 4), '0');
        assert.strictEqual(parseDigit('e', 4), 'E');
        assert.strictEqual(parseDigit('E', 4), 'E');
        assert.strictEqual(parseDigit('f', 4), 'F');
        assert.strictEqual(parseDigit(14, 4), 'E');
        assert.strictEqual(parseDigit('clear', 4), null);

        // parseDigit for Non-Hex (Standard)
        assert.strictEqual(parseDigit('5', 3), 5);
        assert.strictEqual(parseDigit('9', 3), 9);
        assert.strictEqual(parseDigit('clear', 3), null);
    });
});
