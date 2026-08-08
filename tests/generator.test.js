import assert from 'assert';
import { test, describe } from 'node:test';
import { generateFullPuzzle, ConstraintSolver, processDigging } from '../js/generator/generator-worker.js';

describe('In-Browser Generator Engine Tests', () => {
    test('Generate 2x2 (Base 2 Dim 2) Full Solution', () => {
        const puzzle = generateFullPuzzle(2, 2);
        assert.ok(puzzle);
        assert.strictEqual(puzzle.metadata.base, 2);
        assert.strictEqual(puzzle.metadata.dimension, 2);
        assert.strictEqual(puzzle.initial_state.length, 16); // 4x4
    });

    test('Generate 3x2 (Base 3 Dim 2) Full Solution', () => {
        const puzzle = generateFullPuzzle(3, 2);
        assert.ok(puzzle);
        assert.strictEqual(puzzle.metadata.base, 3);
        assert.strictEqual(puzzle.metadata.dimension, 2);
        assert.strictEqual(puzzle.initial_state.length, 81); // 9x9
    });

    test('Generate 2x3 (Base 2 Dim 3) Full Solution via 3D Shuffling', () => {
        const puzzle = generateFullPuzzle(2, 3);
        assert.ok(puzzle);
        assert.strictEqual(puzzle.metadata.base, 2);
        assert.strictEqual(puzzle.metadata.dimension, 3);
        assert.strictEqual(puzzle.initial_state.length, 512); // 8x8x8
    });

    test('Clue Digging Engine & Unique Solvability Guarantee', () => {
        const fullPuzzle = generateFullPuzzle(2, 2);
        // Request excessive removals (e.g. 50 removals on a 16-cell board)
        const playable = processDigging(fullPuzzle, { removals: 50, name: "Excessive Dig 2x2" });
        assert.ok(playable);
        assert.strictEqual(playable.metadata.name, "Excessive Dig 2x2");
        
        // Verify unique solvability using ConstraintSolver
        let stateMap = new Map();
        playable.initial_state.forEach(c => stateMap.set(`${c.y},${c.x}`, c.value));
        const solver = new ConstraintSolver(stateMap, 2, 2);
        const res = solver.solve();
        
        assert.strictEqual(res.solvable, true, 'Dug puzzle MUST be uniquely solvable');
    });

    test('Generate & Dig 4x2 (Base 4 Dim 2) Hexadecimal Puzzle in 0-F Range', () => {
        const fullPuzzle = generateFullPuzzle(4, 2);
        assert.ok(fullPuzzle);
        assert.strictEqual(fullPuzzle.metadata.base, 4);
        assert.strictEqual(fullPuzzle.metadata.dimension, 2);
        assert.strictEqual(fullPuzzle.initial_state.length, 256); // 16x16

        const hexSymbols = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
        // Check that all values in full solution are in 0-F range
        const allValuesInRange = fullPuzzle.initial_state.every(c => hexSymbols.includes(String(c.value)));
        assert.strictEqual(allValuesInRange, true, 'Base 4 values MUST be direct Hex 0-F strings');

        // Dig clues
        const playable = processDigging(fullPuzzle, { removals: 80, name: "Hex Test" });
        assert.ok(playable);
        assert.ok(playable.initial_state.length > 0 && playable.initial_state.length < 256);
        
        // Verify values in playable clues are in 0-F range
        const playableValuesInRange = playable.initial_state.every(c => hexSymbols.includes(String(c.value)));
        assert.strictEqual(playableValuesInRange, true, 'Playable clue values MUST be direct Hex 0-F strings');

        // Verify unique solvability
        let stateMap = new Map();
        playable.initial_state.forEach(c => stateMap.set(`${c.y},${c.x}`, c.value));
        const solver = new ConstraintSolver(stateMap, 4, 2);
        const res = solver.solve();
        assert.strictEqual(res.solvable, true, 'Hex puzzle MUST be uniquely solvable');
    });

    test('Max Removal Mode (removals: -1) Digs Until Minimal Puzzle', () => {
        const fullPuzzle = generateFullPuzzle(2, 2);
        const playable = processDigging(fullPuzzle, { removals: -1, name: "Max Removal 2x2" });
        assert.ok(playable);
        assert.ok(playable.initial_state.length > 0 && playable.initial_state.length <= 16);
        
        let stateMap = new Map();
        playable.initial_state.forEach(c => stateMap.set(`${c.y},${c.x}`, c.value));
        const solver = new ConstraintSolver(stateMap, 2, 2);
        const res = solver.solve();
        assert.strictEqual(res.solvable, true, 'Max removal puzzle MUST be uniquely solvable');
    });
});
