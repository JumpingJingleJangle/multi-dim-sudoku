/**
 * SudokuApp Main Controller
 * Binds DOM events, keyboard hotkeys, Web Worker background generation,
 * file loading/saving, and coordinates SudokuGame & SudokuUI.
 */

import { SudokuGame } from './game.js';
import { SudokuUI } from './ui.js';
import { UIState } from './state.js';
import { parseDigit } from './utils.js';
import { generatePuzzle } from './generator/generator-core.js';

export class SudokuApp {
    constructor() {
        this.game = new SudokuGame();
        this.ui = new SudokuUI();
        this.state = new UIState();

        this.bundledPuzzles = [];
        this.generatedPuzzles = [];
        this.worker = null;

        this.init();
    }

    get selectedCell() { return this.state.selectedCell; }
    set selectedCell(v) { this.state.selectedCell = v; }
    get lastSelectedCell() { return this.state.lastSelectedCell; }
    set lastSelectedCell(v) { this.state.lastSelectedCell = v; }
    get currentAxis() { return this.state.currentAxis; }
    set currentAxis(v) { this.state.currentAxis = v; }
    get currentSlice() { return this.state.currentSlice; }
    set currentSlice(v) { this.state.currentSlice = v; }
    get mode() { return this.state.mode; }
    set mode(v) { this.state.mode = v; }
    get currentNotationColor() { return this.state.currentNotationColor; }
    set currentNotationColor(v) { this.state.currentNotationColor = v; }
    get notationBuffer() { return this.state.notationBuffer; }
    set notationBuffer(v) { this.state.notationBuffer = v; }
    get identifiedNumber() { return this.state.identifiedNumber; }
    set identifiedNumber(v) { this.state.identifiedNumber = v; }
    get isIdentifyHold() { return this.state.isIdentifyHold; }
    set isIdentifyHold(v) { this.state.isIdentifyHold = v; }

    async init() {
        this.setupEventListeners();
        this.setupModalListeners();
        this.setupWorker();
        await this.loadBundledPuzzles();
    }

    setupWorker() {
        try {
            if (typeof Worker === 'undefined') {
                this.worker = null;
                return;
            }
            this.worker = new Worker('./js/generator/generator-worker.js', { type: 'module' });
            this.worker.onmessage = (e) => {
                const { type, status, puzzle, message } = e.data;
                if (type === 'STATUS') {
                    this.updateGeneratorStatus(message);
                } else if (type === 'RESULT') {
                    if (status === 'SUCCESS' && puzzle) {
                        this.onGenerationSuccess(puzzle);
                    } else {
                        this.hideGeneratorModal();
                        alert(`Generation Failed: ${message}`);
                    }
                }
            };
            this.worker.onerror = (err) => {
                console.error("Worker error:", err);
                this.hideGeneratorModal();
                alert("Puzzle generation encountered a worker error.");
            };
        } catch (err) {
            this.worker = null;
        }
    }

    async loadBundledPuzzles() {
        try {
            const res = await fetch('./puzzles/puzzles.json');
            if (!res.ok) throw new Error("Failed to fetch puzzle list");
            const puzzleItems = await res.json();

            this.bundledPuzzles = [];
            for (let item of puzzleItems) {
                try {
                    const fname = typeof item === 'string' ? item : item.filename;
                    const pRes = await fetch(`./puzzles/${fname}`);
                    if (pRes.ok) {
                        const pData = await pRes.json();
                        this.bundledPuzzles.push({ filename: fname, metadata: pData.metadata || item.metadata, data: pData });
                    }
                } catch (e) {
                    console.warn(`Could not load puzzle file: ${item}`, e);
                }
            }

            this.ui.populatePuzzleList(
                this.bundledPuzzles,
                (val) => this.loadSelectedPuzzle(val),
                null,
                this.generatedPuzzles
            );

            if (this.bundledPuzzles.length > 0) {
                this.initializePuzzle(this.bundledPuzzles[0].data);
            }
        } catch (err) {
            console.error("Error loading bundled puzzles:", err);
            this.initializePuzzle({
                metadata: { name: "Default 2D", base: 3, dimension: 2, difficulty: "Easy" },
                initial_state: []
            });
        }
    }

    async loadSelectedPuzzle(val) {
        if (document.activeElement && typeof document.activeElement.blur === 'function' && document.activeElement !== document.body) {
            document.activeElement.blur();
        }
        if (!val) return;
        if (val.startsWith('gen:')) {
            const genId = val.replace('gen:', '');
            const p = this.generatedPuzzles.find(item => item.id === genId);
            if (p) this.initializePuzzle(p);
        } else {
            try {
                const pRes = await fetch(`./puzzles/${val}`);
                if (pRes.ok) {
                    const pData = await pRes.json();
                    const existing = this.bundledPuzzles.find(item => item.filename === val);
                    if (existing) existing.data = pData;
                    this.initializePuzzle(pData);
                } else {
                    const p = this.bundledPuzzles.find(item => item.filename === val);
                    if (p) this.initializePuzzle(p.data);
                }
            } catch (e) {
                const p = this.bundledPuzzles.find(item => item.filename === val);
                if (p) this.initializePuzzle(p.data);
            }
        }
    }

    setupEventListeners() {
        document.addEventListener("keydown", (e) => this.handleKeyDown(e));

        document.addEventListener("mousedown", (e) => {
            const isInteractive = e.target.closest('#sudoku-board') ||
                e.target.closest('#auxiliary-box') ||
                e.target.closest('.sidebar') ||
                e.target.closest('.dim-controls') ||
                e.target.closest('.controls-top') ||
                e.target.closest('.modal-card');
            if (!isInteractive) this.selectCell(null, null, null);
        });

        this.ui.bindClick("btnEntry", () => this.setMode('entry'));
        this.ui.bindClick("btnNotation", () => this.setMode('notation'));
        this.ui.bindClick("btnNoteGreen", () => this.setNotationColor('green'));
        this.ui.bindClick("btnNoteRed", () => this.setNotationColor('red'));
        this.ui.bindClick("btnHoldHighlight", () => this.toggleHoldHighlight());

        this.ui.bindClick("btnShiftUp", () => this.shiftSlice(1));
        this.ui.bindClick("btnShiftDown", () => this.shiftSlice(-1));
        this.ui.bindClick("btnPivotXY", () => this.pivotAxis('XY'));
        this.ui.bindClick("btnPivotXZ", () => this.pivotAxis('XZ'));
        this.ui.bindClick("btnPivotYZ", () => this.pivotAxis('YZ'));

        this.ui.bindClick("btnUndo", () => this.undo());
        this.ui.bindClick("btnRedo", () => this.redo());
        this.ui.bindClick("btnSave", () => this.savePuzzle());
        
        this.ui.bindClick("btnUpload", () => {
            if (this.ui.elements.puzzleUpload) this.ui.elements.puzzleUpload.click();
        });

        this.ui.bindChange("puzzleUpload", (e) => this.handleFileUpload(e));
        this.ui.bindClick("btnGenerateOpen", () => this.showGeneratorModal());
    }

    setupModalListeners() {
        const modal = this.ui.elements.generatorModal;
        this.ui.bindClick("btnCloseGenerate", () => this.hideGeneratorModal());
        this.ui.bindClick("btnCancelGenerate", () => this.hideGeneratorModal());

        if (modal) {
            modal.onclick = (e) => {
                if (e.target === modal) this.hideGeneratorModal();
            };
        }

        this.ui.bindChange("genPreset", () => this.updateGeneratorCalibration());
        this.ui.bindChange("genDifficulty", () => this.updateGeneratorCalibration());

        this.ui.bindSubmit("generatorForm", (e) => {
            e.preventDefault();
            const presetEl = this.ui.elements.genPreset;
            const presetVal = presetEl ? presetEl.value : "3x2";
            const [base, dim] = presetVal.split("x").map(Number);

            const strategyEl = this.ui.elements.genDigStrategy;
            const strategy = strategyEl ? strategyEl.value : "weighted";
            const diffEl = this.ui.elements.genDifficulty;
            const difficulty = diffEl ? diffEl.value : "medium";
            const nameInput = this.ui.elements.genName;
            const name = nameInput ? nameInput.value : "Custom Generated Puzzle";
            const removalsInput = this.ui.elements.genRemovalsInput;
            const removals = removalsInput ? parseInt(removalsInput.value) : undefined;

            this.requestPuzzleGeneration(base, dim, strategy, difficulty, name, removals);
        });
    }

    updateGeneratorCalibration() {
        const presetEl = this.ui.elements.genPreset;
        const diffEl = this.ui.elements.genDifficulty;
        const removalsInput = this.ui.elements.genRemovalsInput;
        const removalsHint = this.ui.elements.genRemovalsHint;
        const strategyEl = this.ui.elements.genDigStrategy;

        if (!presetEl || !diffEl || !removalsInput) return;

        const preset = presetEl.value; // "2x2", "3x2", "4x2", "2x3"
        const diff = diffEl.value; // "low", "medium", "high", "custom"

        const CALIBRATION_TABLE = {
            "2x2": {
                low: { removals: 4, strategy: "weighted" },
                medium: { removals: 6, strategy: "weighted" },
                high: { removals: 8, strategy: "entropy" },
                name: "2x2 Shi-Doku"
            },
            "3x2": {
                low: { removals: 35, strategy: "weighted" },
                medium: { removals: 45, strategy: "entropy" },
                high: { removals: 53, strategy: "entropy" },
                name: "3x2 Classic"
            },
            "4x2": {
                low: { removals: 110, strategy: "weighted" },
                medium: { removals: 135, strategy: "entropy" },
                high: { removals: 155, strategy: "entropy" },
                name: "4x2 Hexadecimal"
            },
            "2x3": {
                low: { removals: 240, strategy: "weighted" },
                medium: { removals: 300, strategy: "entropy" },
                high: { removals: 360, strategy: "tight" },
                name: "2x3 3D Cube (8x8x8)"
            }
        };

        const config = CALIBRATION_TABLE[preset] || CALIBRATION_TABLE["3x2"];

        if (diff === "max") {
            removalsInput.value = -1;
            if (strategyEl) strategyEl.value = "entropy";
            if (removalsHint) {
                removalsHint.innerText = `Max removal mode active for ${config.name} (-1 = dig until minimal puzzle reached).`;
            }
        } else if (diff !== "custom") {
            const cal = config[diff] || config.medium;
            removalsInput.value = cal.removals;
            if (strategyEl) strategyEl.value = cal.strategy;
            if (removalsHint) {
                const diffName = diff.charAt(0).toUpperCase() + diff.slice(1);
                removalsHint.innerText = `Calibrated for ${config.name} ${diffName} difficulty (${cal.removals} blanks).`;
            }
        } else {
            if (removalsHint) {
                removalsHint.innerText = `Custom removal amount active for ${config.name}.`;
            }
        }
    }

    showGeneratorModal() {
        const modal = this.ui.elements.generatorModal;
        if (modal) {
            modal.style.display = "flex";
            const formContainer = this.ui.elements.generatorForm;
            if (formContainer) {
                formContainer.style.display = "block";
                formContainer.querySelectorAll(".input-group, .advanced-panel, .modal-actions").forEach(el => el.style.display = "");
            }
            const progressContainer = this.ui.elements.genProgressWrapper;
            if (progressContainer) progressContainer.style.display = "none";
            this.updateGeneratorCalibration();
        }
    }

    hideGeneratorModal() {
        const modal = this.ui.elements.generatorModal;
        if (modal) modal.style.display = "none";
    }

    updateGeneratorStatus(msg) {
        const statusEl = this.ui.elements.genProgressText;
        if (statusEl) statusEl.innerText = msg;
    }

    onGenerationSuccess(puzzle) {
        this.hideGeneratorModal();
        if (puzzle) {
            this.generatedPuzzles.unshift(puzzle);
            this.showToast(`✨ Successfully generated ${puzzle.metadata.name}!`);
            this.ui.populatePuzzleList(
                this.bundledPuzzles,
                (val) => this.loadSelectedPuzzle(val),
                `gen:${puzzle.id}`,
                this.generatedPuzzles
            );
            this.initializePuzzle(puzzle);
        }
    }

    requestPuzzleGeneration(base, dim, strategy, difficulty, name, removals) {
        const formContainer = this.ui.elements.generatorForm;
        if (formContainer) {
            formContainer.style.display = "block";
            formContainer.querySelectorAll(".input-group, .advanced-panel, .modal-actions").forEach(el => el.style.display = "none");
        }
        const progressContainer = this.ui.elements.genProgressWrapper;
        if (progressContainer) progressContainer.style.display = "flex";
        this.updateGeneratorStatus("Initializing solver engine...");

        if (this.worker) {
            this.worker.postMessage({
                type: 'GENERATE',
                base,
                dim,
                strategy,
                difficulty,
                name,
                removals
            });
        } else {
            setTimeout(() => {
                try {
                    const puzzle = generatePuzzle(
                        { base, dim, name, removals, strategy, difficulty },
                        (msg) => this.updateGeneratorStatus(msg)
                    );
                    this.onGenerationSuccess(puzzle);
                } catch (err) {
                    this.hideGeneratorModal();
                    alert(`Generation Failed: ${err.message}`);
                }
            }, 50);
        }
    }

    showToast(message) {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
    }

    getCellValue(z, y, x) {
        const initVal = this.game.initialBoard[z][y][x];
        const boardVal = this.game.board[z][y][x];
        const isFixed = initVal !== null && initVal !== undefined;
        const hasVal = !isFixed && boardVal !== null && boardVal !== undefined;
        return isFixed ? initVal : (hasVal ? boardVal : null);
    }

    initializePuzzle(puzzle) {
        this.game.initialize(puzzle);

        document.documentElement.style.setProperty('--grid-size', this.game.n);
        document.documentElement.style.setProperty('--base-size', this.game.base);

        this.state.reset();

        this.ui.renderNumpad(this.game, (val) => this.handleNumpadClick(val));

        this.refreshAll();
    }

    refreshAll() {
        this.ui.updateDimUI(this.game.dimension, this.state.currentAxis, this.state.currentSlice);
        this.ui.renderBoard(this.game, this.state.currentAxis, this.state.currentSlice, this.state.selectedCell, (z, y, x) => this.selectCell(z, y, x));
        this.ui.renderAuxiliaryBox(this.game, this.state.currentAxis, this.state.selectedCell);
        this.refreshStatus();
    }

    refreshStatus() {
        const { errors, isFilled } = this.game.getConflicts();
        this.ui.updateConflicts(errors, isFilled);
        this.ui.updateHighlights(this.game, this.state.identifiedNumber);
        this.ui.updateHistoryBtns(this.game.undoStack.length, this.game.redoStack.length);
        this.ui.updateHoldUI(this.state.isIdentifyHold, this.state.identifiedNumber, this.game.base);
    }

    selectCell(z, y, x) {
        if (document.activeElement && typeof document.activeElement.blur === 'function' && document.activeElement !== document.body) {
            document.activeElement.blur();
        }

        if (this.state.selectedCell) {
            if (this.state.mode === 'notation' && (this.state.selectedCell.z !== z || this.state.selectedCell.y !== y || this.state.selectedCell.x !== x)) {
                this.flushNotation();
            }
        }

        this.state.selectCell(z, y, x, (cz, cy, cx) => this.getCellValue(cz, cy, cx));

        this.ui.renderBoard(this.game, this.state.currentAxis, this.state.currentSlice, this.state.selectedCell, (z, y, x) => this.selectCell(z, y, x));
        this.ui.renderAuxiliaryBox(this.game, this.state.currentAxis, this.state.selectedCell);
        this.refreshStatus();
    }

    setMode(newMode) {
        if (this.state.mode === 'notation' && newMode !== 'notation') this.flushNotation();
        this.state.setMode(newMode);
        this.ui.updateModeUI(this.state.mode, this.state.currentNotationColor);
    }

    setNotationColor(color) {
        this.state.setNotationColor(color);
        this.ui.updateModeUI(this.state.mode, this.state.currentNotationColor);
    }

    toggleHoldHighlight() {
        this.state.toggleHold((cz, cy, cx) => this.getCellValue(cz, cy, cx));
        this.refreshAll();
    }

    shiftSlice(delta) {
        if (this.game.dimension === 2) return;
        this.state.shiftSlice(delta, this.game.n);
        this.refreshAll();
    }

    pivotAxis(newAxis) {
        if (this.game.dimension === 2) return;
        this.state.pivotAxis(newAxis);
        this.refreshAll();
    }

    handleNumpadClick(val) {
        if (val === 'enter') {
            this.handleInput('enter');
            return;
        }
        if (val === 'clear') {
            this.handleInput(null);
            return;
        }

        const numVal = parseDigit(val, this.game.base);

        if (!this.selectedCell) {
            if (this.identifiedNumber === numVal || String(this.identifiedNumber) === String(numVal)) {
                this.identifiedNumber = null;
            } else {
                this.identifiedNumber = numVal;
            }
            this.refreshAll();
            return;
        }

        this.handleInput(numVal);
    }

    handleInput(val) {
        if (!this.selectedCell) {
            if (val === null || val === 'clear' || val === 'enter') {
                this.identifiedNumber = null;
            } else {
                this.identifiedNumber = (String(this.identifiedNumber) === String(val)) ? null : val;
            }
            this.refreshStatus();
            return;
        }

        const { z, y, x } = this.selectedCell;
        const initialVal = this.game.initialBoard[z][y][x];
        const isFixed = initialVal !== null && initialVal !== undefined;
        if (isFixed) return;

        if (val === 'enter') {
            if (this.mode === 'notation') this.flushNotation();
            return;
        }

        if (val === null || val === 'clear') {
            this.notationBuffer = "";
            const prev = this.game.board[z][y][x];
            const oldGreen = new Set(this.game.notations[z][y][x].green);
            const oldRed = new Set(this.game.notations[z][y][x].red);
            const isEmptyAlready = prev === null || prev === undefined;
            if (!isEmptyAlready || oldGreen.size > 0 || oldRed.size > 0) {
                this.game.execute({ type: 'clear_all', z, y, x, prev, oldGreen, oldRed });
            }
            this.ui.updateCellVisual(this.game, z, y, x);
            this.refreshStatus();
            this.ui.renderAuxiliaryBox(this.game, this.currentAxis, this.selectedCell);
            return;
        }

        if (this.mode === 'entry') {
            const prev = this.game.board[z][y][x];
            if (prev !== val) {
                const oldGreen = new Set(this.game.notations[z][y][x].green);
                const oldRed = new Set(this.game.notations[z][y][x].red);
                this.game.execute({ type: 'entry', z, y, x, prev, val, oldGreen, oldRed });
            }
        } else {
            const isFilledCell = this.game.board[z][y][x] !== null && this.game.board[z][y][x] !== undefined;
            if (isFilledCell) return;
            const color = this.currentNotationColor;
            const hasNote = this.game.notations[z][y][x][color].has(val);
            this.game.execute({ type: 'notation', z, y, x, color, val, added: !hasNote });
        }
        this.ui.updateCellVisual(this.game, z, y, x);
        this.refreshStatus();
        this.ui.renderAuxiliaryBox(this.game, this.currentAxis, this.selectedCell);
    }

    flushNotation() {
        this.ui.renderAuxiliaryBox(this.game, this.currentAxis, this.selectedCell);
    }

    undo() {
        const coords = this.game.undo();
        if (coords) {
            this.selectedCell = coords;
            this.refreshAll();
        }
    }

    redo() {
        const coords = this.game.redo();
        if (coords) {
            this.selectedCell = coords;
            this.refreshAll();
        }
    }

    handleKeyDown(e) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;

        const key = e.key;
        const isHex = this.game.base === 4;

        const handledKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Enter', ' '];
        if (handledKeys.includes(key)) {
            e.preventDefault();
        }

        const isValidInputKey = isHex ? /^[0-9a-fA-F]$/.test(key) : /^[1-9]$/.test(key);

        if (isValidInputKey) {
            this.handleNumpadClick(key.toUpperCase());
        } else if (key === 'Enter' || key === 'NumpadEnter') {
            this.handleNumpadClick('enter');
        } else if (key === 'Backspace' || key === 'Delete') {
            this.handleNumpadClick('clear');
        } else if (key === 'Escape') {
            if (this.selectedCell) this.selectCell(null, null, null);
            else { this.identifiedNumber = null; this.refreshStatus(); }
        } else {
            const keyLower = key.toLowerCase();
            if (keyLower === 'm') this.setMode('entry');
            else if (keyLower === 'n') this.setMode('notation');
            else if (keyLower === 'v') { this.setMode('notation'); this.setNotationColor('green'); }
            else if (keyLower === 'i') { this.setMode('notation'); this.setNotationColor('red'); }
            else if (keyLower === 'h') this.toggleHoldHighlight();
            else if (keyLower === 'z') this.undo();
            else if (keyLower === 'y') this.redo();
            else if (key.startsWith('Arrow')) this.handleArrowKey(key);
        }
    }

    handleArrowKey(key) {
        const pos = this.selectedCell || this.lastSelectedCell || { z: 0, y: 0, x: 0 };
        let { z, y, x } = pos;
        const n = this.game.n;
        if (key === 'ArrowUp') {
            if (this.currentAxis === 'XY' && y > 0) y--;
            else if (this.currentAxis === 'XZ' && z > 0) z--;
            else if (this.currentAxis === 'YZ' && z > 0) z--;
        } else if (key === 'ArrowDown') {
            if (this.currentAxis === 'XY' && y < n - 1) y++;
            else if (this.currentAxis === 'XZ' && z < n - 1) z++;
            else if (this.currentAxis === 'YZ' && z < n - 1) z++;
        } else if (key === 'ArrowLeft') {
            if (this.currentAxis === 'XY' && x > 0) x--;
            else if (this.currentAxis === 'XZ' && x > 0) x--;
            else if (this.currentAxis === 'YZ' && y > 0) y--;
        } else if (key === 'ArrowRight') {
            if (this.currentAxis === 'XY' && x < n - 1) x++;
            else if (this.currentAxis === 'XZ' && x < n - 1) x++;
            else if (this.currentAxis === 'YZ' && y < n - 1) y++;
        }
        this.selectCell(z, y, x);
    }

    handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        this.loadFromFile(file, () => { e.target.value = ''; });
    }

    loadFromFile(file, onComplete) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!data || !data.metadata) throw new Error("Invalid puzzle schema");

                const name = data.metadata.name || file.name.replace('.json', '');
                data.id = `loaded-${new Date().getTime()}`;
                data.metadata.name = `${name} (Loaded)`;

                this.generatedPuzzles.unshift(data);
                this.ui.populatePuzzleList(
                    this.bundledPuzzles,
                    (val) => this.loadSelectedPuzzle(val),
                    `gen:${data.id}`,
                    this.generatedPuzzles
                );
                this.initializePuzzle(data);
                this.showToast(`Loaded puzzle from disk: ${name}`);
            } catch (err) {
                alert("Failed to load puzzle file from disk: " + err.message);
            } finally {
                if (onComplete) onComplete();
            }
        };
        reader.readAsText(file);
    }

    async savePuzzle() {
        const baseName = (this.game.metadata.name || "Sudoku").replace(/\s*\(Save\)$/i, '');
        const filename = `${baseName.replace(/\s+/g, '_')}_Save.json`;

        const currentData = {
            id: `save-${new Date().getTime()}`,
            metadata: {
                ...this.game.metadata,
                name: `${baseName} (Save)`,
                saved_at: new Date().toISOString()
            },
            initial_state: [],
            current_state: []
        };

        for (let z = 0; z < this.game.nz; z++) {
            for (let y = 0; y < this.game.ny; y++) {
                for (let x = 0; x < this.game.nx; x++) {
                    if (this.game.initialBoard[z][y][x] !== null && this.game.initialBoard[z][y][x] !== undefined) {
                        currentData.initial_state.push({ z, y, x, value: this.game.initialBoard[z][y][x] });
                    }
                    const val = this.game.board[z][y][x];
                    const gNotes = this.game.notations[z][y][x].green;
                    const rNotes = this.game.notations[z][y][x].red;
                    const gNoteArr = Array.from(gNotes);
                    const rNoteArr = Array.from(rNotes);

                    if ((val !== null && val !== undefined) || gNoteArr.length > 0 || rNoteArr.length > 0) {
                        const cellData = { z, y, x };
                        if (val !== null && val !== undefined) cellData.value = val;
                        if (gNoteArr.length > 0 || rNoteArr.length > 0) {
                            cellData.notations = {};
                            if (gNoteArr.length > 0) cellData.notations.green = gNoteArr;
                            if (rNoteArr.length > 0) cellData.notations.red = rNoteArr;
                        }
                        currentData.current_state.push(cellData);
                    }
                }
            }
        }

        const jsonStr = JSON.stringify(currentData, null, 2);

        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'Sudoku JSON Save File',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(jsonStr);
                await writable.close();
                this.showToast(`Saved puzzle to disk`);
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error("Save Picker error:", err);
                }
            }
        } else {
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                if (a.parentNode) document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 1000);
            this.showToast(`Saved to disk (${filename})`);
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.app = new SudokuApp();

    if ('serviceWorker' in navigator) {
        const isLocalhost = Boolean(
            window.location.hostname === 'localhost' ||
            window.location.hostname === '[::1]' ||
            window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
        );
        if (isLocalhost) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                for (let registration of registrations) {
                    registration.unregister();
                }
            });
            if ('caches' in window) {
                caches.keys().then((names) => {
                    for (let name of names) caches.delete(name);
                });
            }
        } else {
            navigator.serviceWorker.register('./sw.js').catch((err) => {
                console.warn('Service Worker registration failed:', err);
            });
        }
    }
});
