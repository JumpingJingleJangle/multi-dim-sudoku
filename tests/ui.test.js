import assert from 'assert';
import { test, describe, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('SudokuUI & DOM Integration Tests', () => {
    let dom;
    let document;
    let window;
    let SudokuUI;
    let SudokuApp;

    beforeEach(async () => {
        const htmlPath = path.resolve(process.cwd(), 'index.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');

        dom = new JSDOM(htmlContent, {
            url: 'http://localhost/',
            runScripts: 'outside-only'
        });
        document = dom.window.document;
        window = dom.window;

        global.window = window;
        global.document = document;
        global.navigator = window.navigator;

        global.fetch = async (url) => {
            return {
                ok: true,
                json: async () => {
                    if (url.includes('puzzles.json')) {
                        return [{ id: 'easy-1', filename: 'easy-1.json', metadata: { name: 'Easy 3x2', base: 3, dimension: 2 } }];
                    }
                    return { metadata: { name: 'Easy 3x2', base: 3, dimension: 2 }, initial_state: [] };
                }
            };
        };

        const uiModule = await import('../js/ui.js');
        SudokuUI = uiModule.SudokuUI;

        const appModule = await import('../js/app.js');
        SudokuApp = appModule.SudokuApp;
    });

    test('DOM Selector Registry Integrity - All Registered Elements Exist', () => {
        const ui = new SudokuUI();
        for (const [key, element] of Object.entries(ui.elements)) {
            assert.ok(element !== null && element !== undefined, `DOM element key "${key}" MUST exist in index.html`);
        }
    });

    test('Generator Modal Open / Close Lifecycle', () => {
        const app = new SudokuApp();
        const modal = app.ui.elements.generatorModal;
        const btnOpen = app.ui.elements.btnGenerateOpen;
        const btnClose = app.ui.elements.btnCloseGenerate;
        const btnCancel = app.ui.elements.btnCancelGenerate;

        assert.strictEqual(modal.style.display, 'none');

        // Open modal
        btnOpen.click();
        assert.strictEqual(modal.style.display, 'flex');

        // Close modal via X
        btnClose.click();
        assert.strictEqual(modal.style.display, 'none');

        // Open modal again
        btnOpen.click();
        assert.strictEqual(modal.style.display, 'flex');

        // Close modal via Cancel
        btnCancel.click();
        assert.strictEqual(modal.style.display, 'none');
    });

    test('Generator Modal Dynamic Calibration Updates', () => {
        const app = new SudokuApp();
        const presetEl = app.ui.elements.genPreset;
        const diffEl = app.ui.elements.genDifficulty;
        const removalsInput = app.ui.elements.genRemovalsInput;
        const removalsHint = app.ui.elements.genRemovalsHint;

        // Default: 3x2 Medium
        assert.strictEqual(presetEl.value, '3x2');
        assert.strictEqual(diffEl.value, 'medium');

        // Switch to Max difficulty
        diffEl.value = 'max';
        diffEl.dispatchEvent(new window.Event('change'));
        assert.strictEqual(removalsInput.value, '-1');
        assert.ok(removalsHint.innerText.includes('Max removal mode active'));

        // Switch preset to 2x2 Shi-Doku and Low difficulty
        presetEl.value = '2x2';
        diffEl.value = 'low';
        presetEl.dispatchEvent(new window.Event('change'));
        assert.strictEqual(removalsInput.value, '4');
        assert.ok(removalsHint.innerText.includes('2x2 Shi-Doku Low'));
    });

    test('Input Focus Release - Dropdown Selection Does Not Trap Focus', () => {
        const app = new SudokuApp();
        app.initializePuzzle({ metadata: { base: 3, dimension: 2 }, initial_state: [] });
        const selectEl = app.ui.elements.selectPuzzle;

        selectEl.focus();
        assert.strictEqual(document.activeElement, selectEl);

        // Click grid cell
        app.selectCell(0, 0, 0);
        assert.notStrictEqual(document.activeElement, selectEl, 'Selecting cell MUST release focus from dropdown');
    });

    test('UI Mode Button Toggles', () => {
        const app = new SudokuApp();
        const btnEntry = app.ui.elements.btnEntry;
        const btnNotation = app.ui.elements.btnNotation;
        const btnGreen = app.ui.elements.btnNoteGreen;
        const btnRed = app.ui.elements.btnNoteRed;

        assert.ok(btnEntry.classList.contains('active'));

        app.setMode('notation');
        assert.ok(btnNotation.classList.contains('active'));
        assert.strictEqual(btnEntry.classList.contains('active'), false);

        app.setNotationColor('red');
        assert.ok(btnRed.classList.contains('active'));
        assert.strictEqual(btnGreen.classList.contains('active'), false);
    });

    test('Preset Negative Hint Highlighting in Normal and Hold Mode', () => {
        const app = new SudokuApp();
        const dummyPuzzleWithPreset = {
            metadata: { name: "Test Highlight Preset", base: 2, dimension: 2 },
            initial_state: [
                { z: 0, y: 0, x: 0, notations: { red: [1, 2] } }
            ]
        };
        app.initializePuzzle(dummyPuzzleWithPreset);

        // Verify note-preset class exists on span element
        const cell = app.ui.boardEl.querySelector('.cell[data-z="0"][data-y="0"][data-x="0"]');
        assert.ok(cell, 'Cell MUST exist');
        const presetSpan = cell.querySelector('.note-val.note-preset.note-red[data-note="1"]');
        assert.ok(presetSpan, 'Preset red note span MUST have note-preset and note-red classes');

        // Test normal highlight mode
        app.identifiedNumber = 1;
        app.refreshStatus();
        assert.ok(presetSpan.classList.contains('identified-note-red'), 'Preset red span MUST receive identified-note-red class when number 1 is identified');
        assert.ok(cell.classList.contains('identified-cell-red'), 'Cell container MUST receive identified-cell-red class');

        // Test hold highlight mode
        app.toggleHoldHighlight();
        assert.strictEqual(app.state.isIdentifyHold, true);
        assert.strictEqual(app.state.identifiedNumber, 1);
        assert.ok(presetSpan.classList.contains('identified-note-red'), 'Preset red span MUST remain identified in hold mode');

        // Test notation contradiction yellow highlight during number identification
        app.game.notations[0][0][0].green.add(1);
        app.identifiedNumber = null;
        app.refreshAll();
        const updatedCell = app.ui.boardEl.querySelector('.cell[data-z="0"][data-y="0"][data-x="0"]');
        assert.strictEqual(updatedCell.classList.contains('identified-cell-warning'), false, 'Cell MUST NOT be highlighted yellow when no number is identified');

        app.identifiedNumber = 1;
        app.refreshStatus();
        assert.ok(updatedCell.classList.contains('identified-cell-warning'), 'Cell with both green and red notation 1 MUST receive identified-cell-warning class when number 1 is identified');
    });
});
