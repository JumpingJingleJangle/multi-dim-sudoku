// --- PWA Service Worker Registration ---
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined') {
    const isLocalhost = Boolean(
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '[::1]'
    );

    if (isLocalhost) {
        if ('caches' in window) {
            caches.keys().then((names) => {
                for (let name of names) caches.delete(name);
            });
        }
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
                registration.unregister();
            }
        });
    } else {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('[Service Worker] Registered successfully:', reg.scope))
                .catch(err => console.log('[Service Worker] Registration failed:', err));
        });
    }
}


function formatDigit(val) {
    if (val === null || val === undefined) return "";
    return String(val);
}

function parseDigit(str, base) {
    if (str === null || str === undefined || str === '' || str === 'clear') return null;
    if (base === 4) {
        const hexChars = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
        if (typeof str === 'number' && hexChars[str] !== undefined) return hexChars[str];
        const strVal = String(str).toUpperCase();
        return hexChars.includes(strVal) ? strVal : null;
    }
    const num = parseInt(str);
    return isNaN(num) ? null : num;
}


class SudokuGame {
    constructor() {
        this.reset();
    }

    reset() {
        this.board = [];
        this.initialBoard = [];
        this.notations = [];
        this.undoStack = [];
        this.redoStack = [];
        this.metadata = {};
        this.n = 9;
        this.nz = 1;
        this.ny = 9;
        this.nx = 9;
        this.base = 3;
        this.dimension = 2;
    }

    initialize(puzzle) {
        this.reset();
        if (!puzzle || !puzzle.metadata) return;

        const meta = puzzle.metadata;
        this.metadata = meta;
        this.dimension = meta.dimension || 2;
        this.base = meta.base || 3;
        this.n = this.base ** this.dimension;
        this.nz = this.dimension === 3 ? this.n : 1;
        this.ny = this.n;
        this.nx = this.n;

        this.board = Array(this.nz).fill(null).map(() => Array(this.ny).fill(null).map(() => Array(this.nx).fill(null)));
        this.initialBoard = Array(this.nz).fill(null).map(() => Array(this.ny).fill(null).map(() => Array(this.nx).fill(null)));
        this.notations = Array(this.nz).fill(null).map(() => Array(this.ny).fill(null).map(() => Array(this.nx).fill(null).map(() => ({ green: new Set(), red: new Set() }))));

        if (puzzle.initial_state) {
            puzzle.initial_state.forEach(cell => {
                let z = cell.z || 0;
                if (z < this.nz && cell.y < this.ny && cell.x < this.nx) {
                    if (cell.value !== null && cell.value !== undefined) {
                        this.initialBoard[z][cell.y][cell.x] = cell.value;
                        this.board[z][cell.y][cell.x] = cell.value;
                    }
                }
            });
        }

        if (puzzle.current_state) {
            puzzle.current_state.forEach(cell => {
                let z = cell.z || 0;
                if (z < this.nz && cell.y < this.ny && cell.x < this.nx) {
                    this.board[z][cell.y][cell.x] = cell.value;
                    if (cell.notations) {
                        if (cell.notations.green) cell.notations.green.forEach(v => this.notations[z][cell.y][cell.x].green.add(v));
                        if (cell.notations.red) cell.notations.red.forEach(v => this.notations[z][cell.y][cell.x].red.add(v));
                    }
                }
            });
        }
    }

    execute(cmd, isRedo = false) {
        if (!isRedo) {
            this.undoStack.push(cmd);
            this.redoStack = [];
        }
        const { z, y, x } = cmd;
        if (cmd.type === 'entry') {
            this.board[z][y][x] = cmd.val;
            if (cmd.val !== null && cmd.val !== undefined) {
                this.notations[z][y][x].green.clear();
                this.notations[z][y][x].red.clear();
            } else {
                this.notations[z][y][x].green = new Set(cmd.oldGreen);
                this.notations[z][y][x].red = new Set(cmd.oldRed);
            }
        } else if (cmd.type === 'notation') {
            if (cmd.added) this.notations[z][y][x][cmd.color].add(cmd.val);
            else this.notations[z][y][x][cmd.color].delete(cmd.val);
        } else if (cmd.type === 'clear_all') {
            this.board[z][y][x] = null;
            this.notations[z][y][x].green.clear();
            this.notations[z][y][x].red.clear();
        }
        return { z, y, x };
    }

    undo() {
        if (this.undoStack.length === 0) return null;
        const cmd = this.undoStack.pop();
        const { z, y, x } = cmd;
        if (cmd.type === 'entry') {
            this.board[z][y][x] = cmd.prev;
            this.notations[z][y][x].green = new Set(cmd.oldGreen);
            this.notations[z][y][x].red = new Set(cmd.oldRed);
        } else if (cmd.type === 'notation') {
            if (cmd.added) this.notations[z][y][x][cmd.color].delete(cmd.val);
            else this.notations[z][y][x][cmd.color].add(cmd.val);
        } else if (cmd.type === 'clear_all') {
            this.board[z][y][x] = cmd.prev;
            this.notations[z][y][x].green = new Set(cmd.oldGreen);
            this.notations[z][y][x].red = new Set(cmd.oldRed);
        }
        this.redoStack.push(cmd);
        return { z, y, x };
    }

    redo() {
        if (this.redoStack.length === 0) return null;
        const cmd = this.redoStack.pop();
        return this.execute(cmd, true);
    }

    getConflicts() {
        let errors = new Set();
        let isFilled = true;
        const isEmpty = (v) => v === null || v === undefined;

        for (let z = 0; z < this.nz; z++) {
            for (let y = 0; y < this.ny; y++) {
                let map = new Map();
                for (let x = 0; x < this.nx; x++) {
                    let v = this.board[z][y][x];
                    if (isEmpty(v)) isFilled = false;
                    else {
                        if (map.has(v)) {
                            errors.add(`${z},${y},${x}`);
                            errors.add(`${z},${y},${map.get(v)}`);
                        } else map.set(v, x);
                    }
                }
            }
        }

        for (let z = 0; z < this.nz; z++) {
            for (let x = 0; x < this.nx; x++) {
                let map = new Map();
                for (let y = 0; y < this.ny; y++) {
                    let v = this.board[z][y][x];
                    if (!isEmpty(v)) {
                        if (map.has(v)) {
                            errors.add(`${z},${y},${x}`);
                            errors.add(`${z},${map.get(v)},${x}`);
                        } else map.set(v, y);
                    }
                }
            }
        }

        for (let y = 0; y < this.ny; y++) {
            for (let x = 0; x < this.nx; x++) {
                let map = new Map();
                for (let z = 0; z < this.nz; z++) {
                    let v = this.board[z][y][x];
                    if (!isEmpty(v)) {
                        if (map.has(v)) {
                            errors.add(`${z},${y},${x}`);
                            errors.add(`${map.get(v)},${y},${x}`);
                        } else map.set(v, z);
                    }
                }
            }
        }

        let b = this.base;
        let zBlockSize = this.dimension === 3 ? b : 1;
        let bkz = this.nz / zBlockSize;
        let bky = this.ny / b;
        let bkx = this.nx / b;

        for (let dzi = 0; dzi < bkz; dzi++) {
            for (let dyi = 0; dyi < bky; dyi++) {
                for (let dxi = 0; dxi < bkx; dxi++) {
                    let map = new Map();
                    for (let i = 0; i < zBlockSize; i++) {
                        for (let j = 0; j < b; j++) {
                            for (let k = 0; k < b; k++) {
                                let z = dzi * zBlockSize + i;
                                let y = dyi * b + j;
                                let x = dxi * b + k;
                                let v = this.board[z][y][x];
                                if (!isEmpty(v)) {
                                    if (map.has(v)) {
                                        errors.add(`${z},${y},${x}`);
                                        const prevPos = map.get(v);
                                        errors.add(`${prevPos.z},${prevPos.y},${prevPos.x}`);
                                    } else map.set(v, { z, y, x });
                                }
                            }
                        }
                    }
                }
            }
        }
        return { errors, isFilled };
    }
}

class SudokuUI {
    constructor() {
        this.boardEl = document.getElementById("sudoku-board");
        this.auxContainer = document.getElementById("aux-grids-container");
        this.auxBox = document.getElementById("auxiliary-box");
        this.dimControls = document.getElementById("dim-controls");
        this.layerLabel = document.getElementById("layer-label");
        this.holdLabel = document.getElementById("hold-label");
        this.btnHoldHighlight = document.getElementById("btn-hold-highlight");
        this.selectEl = document.getElementById("puzzle-select");
        this.btnUndo = document.getElementById("btn-undo");
        this.btnRedo = document.getElementById("btn-redo");
        this.btnEntry = document.getElementById("btn-entry");
        this.btnNotation = document.getElementById("btn-notation");
        this.noteColorControls = document.getElementById("notation-color-controls");
        this.btnNoteGreen = document.getElementById("btn-note-green");
        this.btnNoteRed = document.getElementById("btn-note-red");
    }

    renderBoard(game, currentAxis, currentSlice, selectedCell, onCellClick) {
        this.boardEl.innerHTML = "";
        const n = game.n;
        const base = game.base;

        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                const coords = this.map2Dto3D(r, c, game.dimension, currentAxis, currentSlice);
                const { z, y, x } = coords;

                const cell = document.createElement("div");
                cell.className = "cell";
                cell.dataset.z = z;
                cell.dataset.y = y;
                cell.dataset.x = x;

                if (game.initialBoard[z][y][x] !== null && game.initialBoard[z][y][x] !== undefined) cell.classList.add("fixed");
                if ((c + 1) % base === 0 && c !== n - 1) cell.classList.add("border-right-thick");
                if ((r + 1) % base === 0 && r !== n - 1) cell.classList.add("border-bottom-thick");

                this.updateCellContent(cell, game, z, y, x);

                if (selectedCell && selectedCell.z === z && selectedCell.y === y && selectedCell.x === x) {
                    cell.classList.add("selected");
                }

                cell.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onCellClick(z, y, x);
                });

                this.boardEl.appendChild(cell);
            }
        }
    }

    updateCellContent(cell, game, z, y, x) {
        cell.innerHTML = "";
        const initialVal = game.initialBoard[z][y][x];
        const val = game.board[z][y][x];

        const isFixed = initialVal !== null && initialVal !== undefined;
        const hasEntry = !isFixed && val !== null && val !== undefined;

        if (isFixed) {
            cell.innerText = formatDigit(initialVal);
        } else if (hasEntry) {
            const entrySpan = document.createElement("span");
            entrySpan.className = "entry";
            entrySpan.innerText = formatDigit(val);
            cell.appendChild(entrySpan);
        } else {
            const notDiv = document.createElement("div");
            notDiv.className = "notations-list";

            const gNotes = Array.from(game.notations[z][y][x].green).sort();
            const rNotes = Array.from(game.notations[z][y][x].red).sort();

            if (gNotes.length > 0) {
                const gGroup = document.createElement("div");
                gGroup.className = "note-group note-green";
                gGroup.innerHTML = gNotes.map(n => `<span class="note-val" data-note="${n}">${formatDigit(n)}</span>`).join(", ");
                notDiv.appendChild(gGroup);
            }
            if (rNotes.length > 0) {
                const rGroup = document.createElement("div");
                rGroup.className = "note-group note-red";
                rGroup.innerHTML = rNotes.map(n => `<span class="note-val" data-note="${n}">${formatDigit(n)}</span>`).join(", ");
                notDiv.appendChild(rGroup);
            }
            cell.appendChild(notDiv);
        }
    }

    updateCellVisual(game, z, y, x) {
        const cell = this.boardEl.querySelector(`.cell[data-z="${z}"][data-y="${y}"][data-x="${x}"]`);
        if (cell) this.updateCellContent(cell, game, z, y, x);
    }

    renderAuxiliaryBox(game, currentAxis, selectedCell) {
        this.auxContainer.innerHTML = "";

        if (game.dimension === 2) {
            this.auxBox.style.display = 'none';
            return;
        }

        this.auxBox.style.display = 'flex';
        if (!selectedCell) {
            this.auxBox.classList.add('invisible');
            return;
        }
        this.auxBox.classList.remove('invisible');

        const b = game.base;
        const { z: sz, y: sy, x: sx } = selectedCell;
        const boxZ = Math.floor(sz / b) * b;
        const boxY = Math.floor(sy / b) * b;
        const boxX = Math.floor(sx / b) * b;

        for (let layer = 0; layer < b; layer++) {
            const auxGrid = document.createElement("div");
            auxGrid.className = "aux-grid";

            for (let r = 0; r < b; r++) {
                for (let c = 0; c < b; c++) {
                    let z = 0, y = 0, x = 0;
                    if (currentAxis === 'XY') { z = boxZ + layer; y = boxY + r; x = boxX + c; }
                    else if (currentAxis === 'XZ') { y = boxY + layer; z = boxZ + r; x = boxX + c; }
                    else if (currentAxis === 'YZ') { x = boxX + layer; z = boxZ + r; y = boxY + c; }

                    const cell = document.createElement("div");
                    cell.className = "cell";
                    cell.dataset.z = z;
                    cell.dataset.y = y;
                    cell.dataset.x = x;

                    const initialVal = game.initialBoard[z][y][x];
                    const val = game.board[z][y][x];
                    const isFixed = initialVal !== null && initialVal !== undefined;
                    const hasVal = !isFixed && val !== null && val !== undefined;

                    if (isFixed) {
                        cell.innerText = formatDigit(initialVal);
                        cell.classList.add('fixed');
                    } else if (hasVal) {
                        cell.innerText = formatDigit(val);
                    } else if (game.notations[z][y][x].green.size > 0 || game.notations[z][y][x].red.size > 0) {
                        const gNotes = Array.from(game.notations[z][y][x].green).sort();
                        const rNotes = Array.from(game.notations[z][y][x].red).sort();

                        cell.style.display = "flex";
                        cell.style.flexDirection = "column";
                        cell.style.fontSize = "calc(var(--cell-size) * 0.15)";
                        cell.style.lineHeight = "1";
                        cell.style.justifyContent = "center";

                        let html = "";
                        if (gNotes.length > 0) html += `<div style="color:var(--notation-green)">${gNotes.map(n => formatDigit(n)).join(",")}</div>`;
                        if (rNotes.length > 0) html += `<div style="color:var(--notation-red)">${rNotes.map(n => formatDigit(n)).join(",")}</div>`;
                        cell.innerHTML = html;
                    }

                    if (sz === z && sy === y && sx === x) {
                        cell.classList.add("selected");
                        cell.style.backgroundColor = "var(--selected-bg)";
                    }
                    if ((c + 1) % b === 0 && c !== b - 1) cell.classList.add("border-right-thick");
                    if ((r + 1) % b === 0 && r !== b - 1) cell.classList.add("border-bottom-thick");
                    auxGrid.appendChild(cell);
                }
            }

            const wrapped = document.createElement("div");
            wrapped.className = "aux-layer-wrapper";
            wrapped.style.display = "flex";
            wrapped.style.flexDirection = "column";
            wrapped.style.alignItems = "center";
            wrapped.style.gap = "5px";
            wrapped.appendChild(auxGrid);

            let absoluteLayer = 0;
            if (currentAxis === 'XY') absoluteLayer = boxZ + layer;
            else if (currentAxis === 'XZ') absoluteLayer = boxY + layer;
            else if (currentAxis === 'YZ') absoluteLayer = boxX + layer;

            const lbl = document.createElement("div");
            lbl.innerText = `Layer ${absoluteLayer}`;
            lbl.style.fontSize = "0.8rem";
            wrapped.appendChild(lbl);
            this.auxContainer.appendChild(wrapped);
        }
    }

    map2Dto3D(r, c, dimension, axis, slice) {
        if (dimension === 2) return { z: 0, y: r, x: c };
        if (axis === 'XY') return { z: slice, y: r, x: c };
        if (axis === 'XZ') return { z: r, y: slice, x: c };
        if (axis === 'YZ') return { z: r, y: c, x: slice };
    }

    updateDimUI(dimension, axis, slice) {
        if (dimension === 2) {
            this.dimControls.style.display = 'none';
            this.auxBox.style.display = 'none';
            return;
        }
        this.dimControls.style.display = 'flex';
        this.auxBox.style.display = 'flex';

        const axisChar = axis === 'XY' ? 'Z' : (axis === 'XZ' ? 'Y' : 'X');
        this.layerLabel.innerText = `Layer ${slice} (${axisChar})`;

        document.querySelectorAll(".pivot-controls .btn").forEach(btn => {
            btn.classList.toggle('active', btn.dataset.axis === axis);
        });
    }

    updateConflicts(errors, isFilled) {
        document.querySelectorAll(".cell.error").forEach(el => el.classList.remove("error"));
        errors.forEach(err => {
            const [z, y, x] = err.split(',').map(Number);
            document.querySelectorAll(`.cell[data-z="${z}"][data-y="${y}"][data-x="${x}"]`).forEach(cell => {
                cell.classList.add("error");
            });
            if (this.auxContainer) {
                const auxCell = this.auxContainer.querySelector(`.cell[data-z="${z}"][data-y="${y}"][data-x="${x}"]`);
                if (auxCell) auxCell.classList.add("error");
            }
        });

        if (errors.size === 0 && isFilled) this.boardEl.classList.add("solved");
        else this.boardEl.classList.remove("solved");
    }

    updateHistoryBtns(undoLen, redoLen) {
        this.btnUndo.disabled = undoLen === 0;
        this.btnRedo.disabled = redoLen === 0;
    }

    updateModeUI(mode, color) {
        this.btnEntry.classList.toggle("active", mode === 'entry');
        this.btnNotation.classList.toggle("active", mode === 'notation');
        this.noteColorControls.style.display = (mode === 'notation') ? 'flex' : 'none';

        this.btnNoteGreen.classList.toggle("active", color === 'green');
        this.btnNoteRed.classList.toggle("active", color === 'red');
    }

    updateHoldUI(isHold, identifiedNumber) {
        this.btnHoldHighlight.classList.toggle("active-hold", isHold);
        if (isHold && identifiedNumber !== null && identifiedNumber !== undefined) {
            this.holdLabel.innerText = `Holding: ${formatDigit(identifiedNumber)}`;
            this.holdLabel.style.display = 'inline';
        } else {
            this.holdLabel.style.display = 'none';
        }
    }

    renderNumpad(game, onNumpadClick) {
        const numpadEl = document.getElementById("numpad");
        if (!numpadEl) return;
        numpadEl.innerHTML = "";

        const base = game.base;
        const totalVals = game.n;

        numpadEl.className = "numpad";
        const vals = base === 4
            ? ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F']
            : Array.from({ length: totalVals }, (_, i) => i + 1);

        if (base === 4) numpadEl.classList.add("numpad-hex");

        for (let v of vals) {
            const btn = document.createElement("button");
            btn.className = "num-btn";
            btn.dataset.val = v;
            btn.innerText = v;
            btn.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation();
                onNumpadClick(v);
            });
            numpadEl.appendChild(btn);
        }

        const clearBtn = document.createElement("button");
        clearBtn.className = "num-btn clear-btn";
        clearBtn.dataset.val = "clear";
        clearBtn.innerText = "C";
        clearBtn.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onNumpadClick("clear");
        });
        numpadEl.appendChild(clearBtn);

        const enterBtn = document.createElement("button");
        enterBtn.className = "num-btn enter-btn";
        enterBtn.dataset.val = "enter";
        enterBtn.innerText = "Enter";
        enterBtn.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onNumpadClick("enter");
        });
        numpadEl.appendChild(enterBtn);
    }

    updateHighlights(game, identifiedNumber) {
        document.querySelectorAll(".cell.identified").forEach(el => el.classList.remove("identified"));
        document.querySelectorAll(".note-val.identified-note").forEach(el => el.classList.remove("identified-note"));
        document.querySelectorAll(".cell.identified-aux-note").forEach(el => el.classList.remove("identified-aux-note"));

        if (identifiedNumber === null || identifiedNumber === undefined) return;

        document.querySelectorAll(".cell").forEach(cell => {
            const z = parseInt(cell.dataset.z);
            const y = parseInt(cell.dataset.y);
            const x = parseInt(cell.dataset.x);
            if (isNaN(z) || isNaN(y) || isNaN(x)) return;

            const initialVal = game.initialBoard[z][y][x];
            const boardVal = game.board[z][y][x];
            const isFixed = initialVal !== null && initialVal !== undefined;
            const hasVal = !isFixed && boardVal !== null && boardVal !== undefined;

            const activeVal = isFixed ? initialVal : (hasVal ? boardVal : null);

            if (activeVal !== null && String(activeVal) === String(identifiedNumber)) {
                cell.classList.add("identified");
            } else if (activeVal === null) {
                const hasNote = game.notations[z][y][x].green.has(identifiedNumber) || game.notations[z][y][x].red.has(identifiedNumber);
                if (hasNote) {
                    const noteSpan = cell.querySelector(`.note-val[data-note="${identifiedNumber}"]`);
                    if (noteSpan) noteSpan.classList.add("identified-note");
                    if (cell.querySelector('div[style*="color:var(--notation-"]') || cell.classList.contains('identified-aux-note')) {
                        cell.classList.add("identified-aux-note");
                    }
                }
            }
        });
    }


    populatePuzzleList(bundledPuzzles, onLoad, selectedValue = null, generatedPuzzles = []) {
        this.selectEl.innerHTML = "";

        // 1. Dynamically Generated Puzzles
        if (generatedPuzzles.length > 0) {
            const genGroup = document.createElement("optgroup");
            genGroup.label = "✨ Dynamically Generated";
            generatedPuzzles.forEach(p => {
                const opt = document.createElement("option");
                opt.value = `gen:${p.id}`;
                opt.text = `${p.metadata.name || p.id} (${p.metadata.base}x${p.metadata.dimension})`;
                genGroup.appendChild(opt);
            });
            this.selectEl.appendChild(genGroup);
        }

        // 2. Preset Bundled Puzzles
        const bundledGroup = document.createElement("optgroup");
        bundledGroup.label = "🧩 Preset Puzzles";
        bundledPuzzles.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.filename || `${p.id}.json`;
            const name = p.metadata ? (p.metadata.name || p.id) : p.id;
            const diff = p.metadata ? (p.metadata.difficulty || '') : '';
            opt.text = diff ? `${name} - ${diff}` : name;
            bundledGroup.appendChild(opt);
        });
        this.selectEl.appendChild(bundledGroup);

        if (selectedValue) {
            this.selectEl.value = selectedValue;
        } else if (generatedPuzzles.length > 0) {
            const firstVal = `gen:${generatedPuzzles[generatedPuzzles.length - 1].id}`;
            this.selectEl.value = firstVal;
        } else if (bundledPuzzles.length > 0 && onLoad) {
            onLoad(bundledPuzzles[0].filename || `${bundledPuzzles[0].id}.json`);
        }
    }
}

class SudokuApp {
    constructor() {
        this.game = new SudokuGame();
        this.ui = new SudokuUI();

        this.mode = 'entry'; // 'entry', 'notation'
        this.currentNotationColor = 'green';
        this.identifiedNumber = null;
        this.isIdentifyHold = false;

        this.currentAxis = 'XY';
        this.currentSlice = 0;
        this.selectedCell = null;
        this.lastSelectedCell = { z: 0, y: 0, x: 0 };
        this.notationBuffer = "";
        this.generatedPuzzles = [];
        this.bundledPuzzles = [];
        this.worker = null;

        this.init();
    }

    init() {
        this.bindEvents();
        this.fetchPuzzles();
    }

    bindEvents() {
        document.getElementById("btn-load").addEventListener("click", () => this.loadPuzzle(this.ui.selectEl.value));
        document.getElementById("btn-save").addEventListener("click", () => this.savePuzzle());
        document.getElementById("btn-upload").addEventListener("click", () => document.getElementById("puzzle-upload").click());
        document.getElementById("puzzle-upload").addEventListener("change", (e) => this.handleFileUpload(e));

        // Generator Modal & Form Events
        const genModal = document.getElementById("generator-modal");
        const btnGenOpen = document.getElementById("btn-generate-open");
        const btnGenClose = document.getElementById("btn-close-generate");
        const btnGenCancel = document.getElementById("btn-cancel-generate");
        const genPreset = document.getElementById("gen-preset");
        const genDifficulty = document.getElementById("gen-difficulty");
        const genName = document.getElementById("gen-name");
        const genRemovalsInput = document.getElementById("gen-removals-input");
        const genRemovalsHint = document.getElementById("gen-removals-hint");
        const genForm = document.getElementById("generator-form");
        const genProgressWrapper = document.getElementById("gen-progress-wrapper");
        const genProgressText = document.getElementById("gen-progress-text");
        const btnStartGen = document.getElementById("btn-start-generate");

        const REMOVAL_CALIBRATIONS = {
            '2x2': { total: 16, name: 'Custom 2D Shi-Doku', low: 4, medium: 6, high: 8, max: 12 },
            '3x2': { total: 81, name: 'Custom 2D Classic Sudoku', low: 30, medium: 45, high: 55, max: 64 },
            '4x2': { total: 256, name: 'Custom 2D Hexadecimal Sudoku', low: 80, medium: 130, high: 170, max: 200 },
            '2x3': { total: 512, name: 'Custom 3D Hyper-Cube', low: 120, medium: 220, high: 320, max: 420 }
        };

        const updateRemovalsUI = () => {
            if (!genPreset || !genDifficulty || !genRemovalsInput) return;
            const presetKey = genPreset.value;
            const diffKey = genDifficulty.value;
            const config = REMOVAL_CALIBRATIONS[presetKey] || REMOVAL_CALIBRATIONS['3x2'];

            genRemovalsInput.min = 1;
            genRemovalsInput.max = config.max;

            if (diffKey === 'custom') {
                if (genRemovalsHint) genRemovalsHint.innerText = `Custom removal amount (1 to ${config.max} empty cells on ${config.total}-cell grid).`;
            } else {
                const targetVal = config[diffKey];
                genRemovalsInput.value = targetVal;
                if (genRemovalsHint) genRemovalsHint.innerText = `${diffKey.toUpperCase()} difficulty calibrated to ${targetVal} removals (${Math.round((targetVal / config.total) * 100)}% empty cells).`;
            }
        };

        if (btnGenOpen) {
            btnGenOpen.addEventListener("click", () => {
                updateRemovalsUI();
                genModal.style.display = "flex";
            });
        }

        const closeModal = () => {
            if (genModal) genModal.style.display = "none";
            if (genProgressWrapper) genProgressWrapper.style.display = "none";
            if (btnStartGen) btnStartGen.disabled = false;
        };

        if (btnGenClose) btnGenClose.addEventListener("click", closeModal);
        if (btnGenCancel) btnGenCancel.addEventListener("click", closeModal);

        if (genPreset) {
            genPreset.addEventListener("change", () => {
                const config = REMOVAL_CALIBRATIONS[genPreset.value];
                if (config && genName) genName.value = config.name;
                updateRemovalsUI();
            });
        }

        if (genDifficulty) {
            genDifficulty.addEventListener("change", () => {
                updateRemovalsUI();
            });
        }

        if (genRemovalsInput) {
            genRemovalsInput.addEventListener("input", () => {
                if (genDifficulty) genDifficulty.value = "custom";
                const config = REMOVAL_CALIBRATIONS[genPreset.value];
                if (config && genRemovalsHint) {
                    genRemovalsHint.innerText = `Custom removal amount (${genRemovalsInput.value} of ${config.total} cells).`;
                }
            });
        }

        if (genForm) {
            genForm.addEventListener("submit", (e) => {
                e.preventDefault();
                const preset = genPreset.value;
                const name = genName.value.trim() || "Custom Generated Puzzle";
                let removals = parseInt(genRemovalsInput.value) || 40;
                const config = REMOVAL_CALIBRATIONS[preset];
                if (config) {
                    removals = Math.min(Math.max(1, removals), config.max);
                }

                let base = 3, dim = 2;
                if (preset === '2x2') { base = 2; dim = 2; }
                else if (preset === '3x2') { base = 3; dim = 2; }
                else if (preset === '4x2') { base = 4; dim = 2; }
                else if (preset === '2x3') { base = 2; dim = 3; }

                genProgressWrapper.style.display = "flex";
                genProgressText.innerText = "Initializing generator engine...";
                btnStartGen.disabled = true;

                if (typeof Worker !== 'undefined') {
                    if (this.worker) this.worker.terminate();
                    this.worker = new Worker('./generator-worker.js');

                    this.worker.onmessage = (msg) => {
                        const data = msg.data;
                        if (data.type === 'progress') {
                            genProgressText.innerText = data.status;
                        } else if (data.type === 'complete') {
                            closeModal();
                            const puzzle = data.puzzle;
                            this.generatedPuzzles.push(puzzle);
                            const targetVal = `gen:${puzzle.id}`;
                            this.ui.populatePuzzleList(this.bundledPuzzles, null, targetVal, this.generatedPuzzles);
                            this.initializePuzzle(puzzle);
                            this.showToast(`✨ Generated & loaded: ${puzzle.metadata.name}`);
                        } else if (data.type === 'error') {
                            alert("Generation failed: " + data.message);
                            closeModal();
                        }
                    };

                    const genDigStrategy = document.getElementById("gen-dig-strategy");
                    const strategy = genDigStrategy ? genDigStrategy.value : 'entropy';

                    this.worker.postMessage({ base, dim, name, removals, strategy });
                } else {
                    alert("Web Workers are not supported in your browser.");
                    closeModal();
                }
            });
        }


        document.addEventListener("mousedown", (e) => {
            const isInteractive = e.target.closest('#sudoku-board') ||
                e.target.closest('#auxiliary-box') ||
                e.target.closest('.sidebar') ||
                e.target.closest('.dim-controls') ||
                e.target.closest('.controls-top') ||
                e.target.closest('.modal-card');
            if (!isInteractive) this.selectCell(null, null, null);
        });

        this.ui.btnEntry.addEventListener("click", () => this.setMode('entry'));
        this.ui.btnNotation.addEventListener("click", () => this.setMode('notation'));
        this.ui.btnNoteGreen.addEventListener("click", () => this.setNotationColor('green'));
        this.ui.btnNoteRed.addEventListener("click", () => this.setNotationColor('red'));
        this.ui.btnHoldHighlight.addEventListener("click", () => this.toggleHoldHighlight());

        document.getElementById("btn-shift-up").addEventListener("click", () => this.shiftSlice(1));
        document.getElementById("btn-shift-down").addEventListener("click", () => this.shiftSlice(-1));
        document.getElementById("btn-pivot-xy").addEventListener("click", () => this.pivotAxis('XY'));
        document.getElementById("btn-pivot-xz").addEventListener("click", () => this.pivotAxis('XZ'));
        document.getElementById("btn-pivot-yz").addEventListener("click", () => this.pivotAxis('YZ'));

        document.getElementById("btn-undo").addEventListener("click", () => this.undo());
        document.getElementById("btn-redo").addEventListener("click", () => this.redo());

        document.addEventListener("keydown", (e) => this.handleKeyDown(e));

        document.addEventListener("dragover", (e) => e.preventDefault());
        document.addEventListener("drop", (e) => {
            e.preventDefault();
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                this.loadFromFile(e.dataTransfer.files[0]);
            }
        });
    }

    fetchPuzzles() {
        fetch('./puzzles/puzzles.json', { cache: 'no-cache' })
            .then(res => res.json())
            .then(data => {
                this.bundledPuzzles = data;
                this.ui.populatePuzzleList(data, (filename) => this.loadPuzzle(filename), null, this.generatedPuzzles);
            })
            .catch(err => console.error("Failed to load puzzles index:", err));
    }

    loadPuzzle(target) {
        if (!target) return;

        if (target.startsWith('gen:')) {
            const genId = target.substring(4);
            const found = this.generatedPuzzles.find(p => p.id === genId);
            if (found) {
                this.initializePuzzle(found);
                this.showToast(`Loaded generated puzzle: ${found.metadata.name}`);
                return;
            }
        }

        const path = target.startsWith('puzzles/') ? target : `./puzzles/${target}`;
        fetch(path, { cache: 'no-cache' })
            .then(res => res.json())
            .then(data => {
                this.initializePuzzle(Array.isArray(data) ? data[0] : data);
            })
            .catch(err => console.error("Failed to load puzzle file:", err));
    }


    showToast(message) {
        if (typeof document === 'undefined') return;
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
    }



    initializePuzzle(puzzle) {
        this.game.initialize(puzzle);

        document.documentElement.style.setProperty('--grid-size', this.game.n);
        document.documentElement.style.setProperty('--base-size', this.game.base);

        this.selectedCell = null;
        this.currentAxis = 'XY';
        this.currentSlice = 0;
        this.notationBuffer = "";
        this.identifiedNumber = null;
        this.isIdentifyHold = false;

        this.ui.renderNumpad(this.game, (val) => this.handleNumpadClick(val));

        this.refreshAll();
    }

    refreshAll() {
        this.ui.updateDimUI(this.game.dimension, this.currentAxis, this.currentSlice);
        this.ui.renderBoard(this.game, this.currentAxis, this.currentSlice, this.selectedCell, (z, y, x) => this.selectCell(z, y, x));
        this.ui.renderAuxiliaryBox(this.game, this.currentAxis, this.selectedCell);
        this.refreshStatus();
    }

    refreshStatus() {
        const { errors, isFilled } = this.game.getConflicts();
        this.ui.updateConflicts(errors, isFilled);
        this.ui.updateHighlights(this.game, this.identifiedNumber);
        this.ui.updateHistoryBtns(this.game.undoStack.length, this.game.redoStack.length);
        this.ui.updateHoldUI(this.isIdentifyHold, this.identifiedNumber, this.game.base);
    }

    selectCell(z, y, x) {
        if (this.selectedCell) {
            if (this.mode === 'notation' && (this.selectedCell.z !== z || this.selectedCell.y !== y || this.selectedCell.x !== x)) {
                this.flushNotation();
            }
        }

        if (z === null) {
            this.selectedCell = null;
            if (!this.isIdentifyHold) this.identifiedNumber = null;
        } else {
            this.selectedCell = { z, y, x };
            this.lastSelectedCell = { z, y, x };
            if (!this.isIdentifyHold) {
                const initVal = this.game.initialBoard[z][y][x];
                const boardVal = this.game.board[z][y][x];
                const isFixed = initVal !== null && initVal !== undefined;
                const hasVal = !isFixed && boardVal !== null && boardVal !== undefined;
                const val = isFixed ? initVal : (hasVal ? boardVal : null);
                this.identifiedNumber = val;
            }
        }

        this.ui.renderBoard(this.game, this.currentAxis, this.currentSlice, this.selectedCell, (z, y, x) => this.selectCell(z, y, x));
        this.ui.renderAuxiliaryBox(this.game, this.currentAxis, this.selectedCell);
        this.refreshStatus();
    }

    setMode(newMode) {
        if (this.mode === 'notation' && newMode !== 'notation') this.flushNotation();
        this.mode = newMode;
        if (this.mode !== 'notation') this.notationBuffer = "";
        this.ui.updateModeUI(this.mode, this.currentNotationColor);
    }

    setNotationColor(color) {
        this.currentNotationColor = color;
        this.ui.updateModeUI(this.mode, this.currentNotationColor);
    }

    toggleHoldHighlight() {
        this.isIdentifyHold = !this.isIdentifyHold;
        if (!this.isIdentifyHold) {
            if (this.selectedCell) {
                const { z, y, x } = this.selectedCell;
                const initVal = this.game.initialBoard[z][y][x];
                const boardVal = this.game.board[z][y][x];
                const isFixed = initVal !== null && initVal !== undefined;
                const hasVal = !isFixed && boardVal !== null && boardVal !== undefined;
                this.identifiedNumber = isFixed ? initVal : (hasVal ? boardVal : null);
            } else {
                this.identifiedNumber = null;
            }
        }
        this.refreshAll();
    }

    shiftSlice(delta) {
        if (this.game.dimension === 2) return;
        this.currentSlice = (this.currentSlice + delta + this.game.n) % this.game.n;
        this.refreshAll();
    }

    pivotAxis(newAxis) {
        if (this.game.dimension === 2 || this.currentAxis === newAxis) return;
        this.currentAxis = newAxis;
        if (this.selectedCell) {
            if (this.currentAxis === 'XY') this.currentSlice = this.selectedCell.z;
            else if (this.currentAxis === 'XZ') this.currentSlice = this.selectedCell.y;
            else if (this.currentAxis === 'YZ') this.currentSlice = this.selectedCell.x;
        } else {
            this.currentSlice = 0;
        }
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
                const puzzle = Array.isArray(data) ? data[0] : data;
                this.initializePuzzle(puzzle);
                const name = puzzle.metadata ? (puzzle.metadata.name || file.name) : file.name;
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
                    const gNoteArr = Array.from(this.game.notations[z][y][x].green);
                    const rNoteArr = Array.from(this.game.notations[z][y][x].red);
                    if ((val !== null && val !== undefined) || gNoteArr.length > 0 || rNoteArr.length > 0) {
                        currentData.current_state.push({
                            z, y, x, value: val,
                            notations: { green: gNoteArr, red: rNoteArr }
                        });
                    }
                }
            }
        }

        const jsonStr = JSON.stringify(currentData, null, 2);

        // 1. Direct OS Save File Picker (if supported in browser)
        if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'Sudoku Puzzle JSON File',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(jsonStr);
                await writable.close();
                this.showToast(`Saved to disk: ${handle.name}`);
                return;
            } catch (err) {
                if (err.name === 'AbortError') return; // User cancelled dialog
                console.warn("showSaveFilePicker error, falling back to download blob", err);
            }
        }

        // 2. Fallback: Download via anchor element with delayed URL revocation
        if (typeof document !== 'undefined') {
            const blob = new Blob([jsonStr], { type: 'application/json' });
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

// Export for Node tests if running in CJS environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SudokuGame, formatDigit, parseDigit };
} else {
    document.addEventListener("DOMContentLoaded", () => {
        window.app = new SudokuApp();
    });
}
