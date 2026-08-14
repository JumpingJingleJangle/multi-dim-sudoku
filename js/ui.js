/**
 * SudokuUI Renderer
 * Manages pure DOM visual rendering for board grid, 3D auxiliary box layers,
 * numpad construction, highlights, toast popups, and modals.
 */

import { formatDigit, parseDigit } from './utils.js';

export class SudokuUI {
    constructor() {
        this.elements = {
            // Board & Auxiliary Display
            board: document.getElementById("sudoku-board"),
            auxContainer: document.getElementById("aux-grids-container"),
            auxBox: document.getElementById("auxiliary-box"),
            dimControls: document.getElementById("dim-controls"),
            layerLabel: document.getElementById("layer-label"),
            holdLabel: document.getElementById("hold-label"),

            // Mode & History Controls
            btnEntry: document.getElementById("btn-entry"),
            btnNotation: document.getElementById("btn-notation"),
            btnHoldHighlight: document.getElementById("btn-hold-highlight"),
            btnNoteGreen: document.getElementById("btn-note-green"),
            btnNoteRed: document.getElementById("btn-note-red"),
            noteColorControls: document.getElementById("notation-color-controls"),
            btnUndo: document.getElementById("btn-undo"),
            btnRedo: document.getElementById("btn-redo"),
            selectPuzzle: document.getElementById("puzzle-select"),
            btnLoad: document.getElementById("btn-load"),
            btnSave: document.getElementById("btn-save"),
            btnUpload: document.getElementById("btn-upload"),
            puzzleUpload: document.getElementById("puzzle-upload"),

            // 3D Slicing & Pivot Controls
            btnShiftUp: document.getElementById("btn-shift-up"),
            btnShiftDown: document.getElementById("btn-shift-down"),
            btnPivotXY: document.getElementById("btn-pivot-xy"),
            btnPivotXZ: document.getElementById("btn-pivot-xz"),
            btnPivotYZ: document.getElementById("btn-pivot-yz"),

            // Generator Modal Controls
            btnGenerateOpen: document.getElementById("btn-generate-open"),
            btnCloseGenerate: document.getElementById("btn-close-generate"),
            btnCancelGenerate: document.getElementById("btn-cancel-generate"),
            generatorModal: document.getElementById("generator-modal"),
            generatorForm: document.getElementById("generator-form"),
            genPreset: document.getElementById("gen-preset"),
            genDifficulty: document.getElementById("gen-difficulty"),
            genName: document.getElementById("gen-name"),
            genRemovalsInput: document.getElementById("gen-removals-input"),
            genRemovalsHint: document.getElementById("gen-removals-hint"),
            genDigStrategy: document.getElementById("gen-dig-strategy"),
            genProgressWrapper: document.getElementById("gen-progress-wrapper"),
            genProgressText: document.getElementById("gen-progress-text")
        };

        // Legacy properties pointing to elements dictionary for backwards compatibility
        this.boardEl = this.elements.board;
        this.auxContainer = this.elements.auxContainer;
        this.auxBox = this.elements.auxBox;
        this.dimControls = this.elements.dimControls;
        this.layerLabel = this.elements.layerLabel;
        this.holdLabel = this.elements.holdLabel;
        this.btnHoldHighlight = this.elements.btnHoldHighlight;
        this.selectEl = this.elements.selectPuzzle;
        this.btnUndo = this.elements.btnUndo;
        this.btnRedo = this.elements.btnRedo;
        this.btnEntry = this.elements.btnEntry;
        this.btnNotation = this.elements.btnNotation;
        this.noteColorControls = this.elements.noteColorControls;
        this.btnNoteGreen = this.elements.btnNoteGreen;
        this.btnNoteRed = this.elements.btnNoteRed;
    }

    bindClick(key, handler) {
        const el = this.elements[key];
        if (el) el.addEventListener("click", handler);
    }

    bindChange(key, handler) {
        const el = this.elements[key];
        if (el) el.addEventListener("change", handler);
    }

    bindSubmit(key, handler) {
        const el = this.elements[key];
        if (el) el.addEventListener("submit", handler);
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

            const sortNotes = (arr) => {
                let strMap = new Map();
                Array.from(arr).forEach(v => {
                    let key = String(v);
                    if (!strMap.has(key)) strMap.set(key, v);
                });
                return Array.from(strMap.values()).sort((a, b) => parseDigit(a) - parseDigit(b));
            };
            const gNotes = sortNotes(game.notations[z][y][x].green);
            const rNotes = sortNotes(game.notations[z][y][x].red);

            if (gNotes.length > 0) {
                const gGroup = document.createElement("div");
                gGroup.className = "note-group note-green";
                gGroup.innerHTML = gNotes.map(n => {
                    const isPreset = game.isPresetNotation ? game.isPresetNotation(z, y, x, 'green', n) : false;
                    const cls = isPreset ? 'note-val note-preset note-green' : 'note-val note-user note-green';
                    return `<span class="${cls}" data-note="${n}">${formatDigit(n)}</span>`;
                }).join(", ");
                notDiv.appendChild(gGroup);
            }
            if (rNotes.length > 0) {
                const rGroup = document.createElement("div");
                rGroup.className = "note-group note-red";
                rGroup.innerHTML = rNotes.map(n => {
                    const isPreset = game.isPresetNotation ? game.isPresetNotation(z, y, x, 'red', n) : false;
                    const cls = isPreset ? 'note-val note-preset note-red' : 'note-val note-user note-red';
                    return `<span class="${cls}" data-note="${n}">${formatDigit(n)}</span>`;
                }).join(", ");
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
                        if (gNotes.length > 0) {
                            html += `<div style="color:var(--notation-green)">${gNotes.map(n => {
                                const isPreset = game.isPresetNotation ? game.isPresetNotation(z, y, x, 'green', n) : false;
                                const cls = isPreset ? 'note-val note-preset note-green' : 'note-val note-user note-green';
                                return `<span class="${cls}" data-note="${n}">${formatDigit(n)}</span>`;
                            }).join(",")}</div>`;
                        }
                        if (rNotes.length > 0) {
                            html += `<div style="color:var(--notation-red)">${rNotes.map(n => {
                                const isPreset = game.isPresetNotation ? game.isPresetNotation(z, y, x, 'red', n) : false;
                                const cls = isPreset ? 'note-val note-preset note-red' : 'note-val note-user note-red';
                                return `<span class="${cls}" data-note="${n}">${formatDigit(n)}</span>`;
                            }).join(",")}</div>`;
                        }
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

    updateHoldUI(isHold, identifiedNumber, base) {
        this.btnHoldHighlight.classList.toggle("active", isHold);
        if (isHold) {
            this.holdLabel.style.display = 'inline-block';
            this.holdLabel.innerText = (identifiedNumber !== null && identifiedNumber !== undefined)
                ? `Holding: ${formatDigit(identifiedNumber)}`
                : 'Holding:\n(Select Number)';
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
        document.querySelectorAll(".note-val.identified-note, .note-val.identified-note-green, .note-val.identified-note-red").forEach(el => {
            el.classList.remove("identified-note", "identified-note-green", "identified-note-red");
        });
        document.querySelectorAll(".cell.identified-aux-note, .cell.identified-cell-green, .cell.identified-cell-red, .cell.identified-cell-warning").forEach(el => {
            el.classList.remove("identified-aux-note", "identified-cell-green", "identified-cell-red", "identified-cell-warning");
        });

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
                const hasGreen = game.hasActiveNotation ? game.hasActiveNotation(z, y, x, 'green', identifiedNumber) : game.notations[z][y][x].green.has(identifiedNumber);
                const hasRed = game.hasActiveNotation ? game.hasActiveNotation(z, y, x, 'red', identifiedNumber) : game.notations[z][y][x].red.has(identifiedNumber);

                if (hasGreen && hasRed) {
                    const noteSpansG = cell.querySelectorAll(`.note-val.note-green[data-note="${identifiedNumber}"]`);
                    const noteSpansR = cell.querySelectorAll(`.note-val.note-red[data-note="${identifiedNumber}"]`);
                    noteSpansG.forEach(sp => sp.classList.add("identified-note-green"));
                    noteSpansR.forEach(sp => sp.classList.add("identified-note-red"));
                    cell.classList.add("identified-cell-warning");
                } else if (hasGreen) {
                    const noteSpans = cell.querySelectorAll(`.note-val.note-green[data-note="${identifiedNumber}"]`);
                    noteSpans.forEach(sp => sp.classList.add("identified-note-green"));
                    cell.classList.add("identified-cell-green");
                } else if (hasRed) {
                    const noteSpans = cell.querySelectorAll(`.note-val.note-red[data-note="${identifiedNumber}"]`);
                    noteSpans.forEach(sp => sp.classList.add("identified-note-red"));
                    cell.classList.add("identified-cell-red");
                }
            }
        });
    }

    populatePuzzleList(bundledPuzzles, onLoad, selectedValue = null, generatedPuzzles = []) {
        this.selectEl.innerHTML = "";

        if (generatedPuzzles.length > 0) {
            const genGroup = document.createElement("optgroup");
            genGroup.label = "✨ Dynamically Generated";
            generatedPuzzles.forEach(p => {
                const opt = document.createElement("option");
                opt.value = `gen:${p.id}`;
                opt.innerText = p.metadata.name;
                genGroup.appendChild(opt);
            });
            this.selectEl.appendChild(genGroup);
        }

        if (bundledPuzzles.length > 0) {
            const presetGroup = document.createElement("optgroup");
            presetGroup.label = "📦 Presets";
            bundledPuzzles.forEach(p => {
                const opt = document.createElement("option");
                opt.value = p.filename;
                opt.innerText = `${p.metadata.name} - ${p.metadata.difficulty}`;
                presetGroup.appendChild(opt);
            });
            this.selectEl.appendChild(presetGroup);
        }

        if (selectedValue) {
            this.selectEl.value = selectedValue;
        }

        if (onLoad) {
            if (this.elements.btnLoad) {
                this.elements.btnLoad.onclick = () => {
                    onLoad(this.selectEl.value);
                    if (document.activeElement && typeof document.activeElement.blur === 'function') {
                        document.activeElement.blur();
                    }
                };
            }
        }
    }
}
