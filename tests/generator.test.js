import assert from 'assert';
import { test, describe } from 'node:test';
import { generateFullPuzzle, ConstraintSolver, processDigging, generatePuzzle } from '../js/generator/generator-core.js';

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

    test('Synchronous generatePuzzle API Entry Point', () => {
        let statuses = [];
        const puzzle = generatePuzzle({
            base: 2,
            dim: 2,
            name: "API Test 2x2",
            removals: 6,
            difficulty: "medium"
        }, (status) => statuses.push(status));

        assert.ok(puzzle);
        assert.strictEqual(puzzle.metadata.name, "API Test 2x2");
        assert.strictEqual(statuses.length, 2);
        assert.strictEqual(statuses[0], 'Generating solution matrix...');
        assert.strictEqual(statuses[1], 'Digging clues for playable puzzle...');
    });

    test('Negative Hint Reduction Digging Engine (strategy: negative_hint_dig)', () => {
        const fullPuzzle = generateFullPuzzle(2, 2);
        const playable = processDigging(fullPuzzle, { strategy: 'negative_hint_dig', name: 'Negative Hint Dig 2x2' });
        assert.ok(playable);
        assert.strictEqual(playable.metadata.strategy, 'negative_hint_dig');

        // Check that initial_state contains given clues OR notations.red
        let hasGivenClues = playable.initial_state.some(c => c.value !== undefined);
        let hasRedNotations = playable.initial_state.some(c => c.notations && c.notations.red && c.notations.red.length > 0);
        assert.ok(hasGivenClues || hasRedNotations, 'Puzzle MUST contain given clues or red notations');

        // Verify unique solvability
        let stateMap = new Map();
        let redNotationsMap = new Map();
        playable.initial_state.forEach(c => {
            let key = `${c.y},${c.x}`;
            if (c.value !== undefined) stateMap.set(key, c.value);
            if (c.notations && c.notations.red) redNotationsMap.set(key, new Set(c.notations.red));
        });
        const solver = new ConstraintSolver(stateMap, 2, 2, redNotationsMap);
        const res = solver.solve();
        assert.strictEqual(res.solvable, true, 'Negative hint dig puzzle MUST be uniquely solvable');
    });

    test('Spread-Out Negative Hint Reduction Engine (strategy: negative_hint_spread)', () => {
        const fullPuzzle = generateFullPuzzle(2, 2);
        const playable = processDigging(fullPuzzle, { strategy: 'negative_hint_spread', name: 'Spread Negative Hint Dig 2x2' });
        assert.ok(playable);
        assert.strictEqual(playable.metadata.strategy, 'negative_hint_spread');

        let partialHintCells = playable.initial_state.filter(c => c.notations && c.notations.red && c.notations.red.length > 0);
        assert.ok(partialHintCells.length > 0, 'Spread-out strategy MUST create partial hint cells');

        let stateMap = new Map();
        let redNotationsMap = new Map();
        playable.initial_state.forEach(c => {
            let key = `${c.y},${c.x}`;
            if (c.value !== undefined) stateMap.set(key, c.value);
            if (c.notations && c.notations.red) redNotationsMap.set(key, new Set(c.notations.red));
        });
        const solver = new ConstraintSolver(stateMap, 2, 2, redNotationsMap);
        const res = solver.solve();
        assert.strictEqual(res.solvable, true, 'Spread-out negative hint puzzle MUST be uniquely solvable');
    });
});
