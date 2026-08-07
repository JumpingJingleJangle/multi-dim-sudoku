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

        this.board = Array(this.nz).fill(null).map(() => Array(this.ny).fill(null).map(() => Array(this.nx).fill(0)));
        this.initialBoard = Array(this.nz).fill(null).map(() => Array(this.ny).fill(null).map(() => Array(this.nx).fill(0)));
        this.notations = Array(this.nz).fill(null).map(() => Array(this.ny).fill(null).map(() => Array(this.nx).fill(null).map(() => ({ green: new Set(), red: new Set() }))));

        if (puzzle.initial_state) {
            puzzle.initial_state.forEach(cell => {
                let z = cell.z || 0;
                if (z < this.nz && cell.y < this.ny && cell.x < this.nx) {
                    this.initialBoard[z][cell.y][cell.x] = cell.value;
                    this.board[z][cell.y][cell.x] = cell.value;
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
            if (cmd.val !== 0) {
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
            this.board[z][y][x] = 0;
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
        
        for(let z=0; z<this.nz; z++) {
            for(let y=0; y<this.ny; y++) {
                let map = new Map();
                for(let x=0; x<this.nx; x++) {
                    let v = this.board[z][y][x];
                    if(v === 0) isFilled = false;
                    else {
                        if(map.has(v)) {
                            errors.add(`${z},${y},${x}`);
                            errors.add(`${z},${y},${map.get(v)}`);
                        } else map.set(v, x);
                    }
                }
            }
        }
        
        for(let z=0; z<this.nz; z++) {
            for(let x=0; x<this.nx; x++) {
                let map = new Map();
                for(let y=0; y<this.ny; y++) {
                    let v = this.board[z][y][x];
                    if(v!==0) {
                        if(map.has(v)) {
                            errors.add(`${z},${y},${x}`);
                            errors.add(`${z},${map.get(v)},${x}`);
                        } else map.set(v, y);
                    }
                }
            }
        }
        
        for(let y=0; y<this.ny; y++) {
            for(let x=0; x<this.nx; x++) {
                let map = new Map();
                for(let z=0; z<this.nz; z++) {
                    let v = this.board[z][y][x];
                    if(v!==0) {
                        if(map.has(v)) {
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

        for(let dzi=0; dzi<bkz; dzi++) {
            for(let dyi=0; dyi<bky; dyi++) {
                for(let dxi=0; dxi<bkx; dxi++) {
                    let map = new Map();
                    for(let i=0; i<zBlockSize; i++) {
                        for(let j=0; j<b; j++) {
                            for(let k=0; k<b; k++) {
                                let z = dzi*zBlockSize + i;
                                let y = dyi*b + j;
                                let x = dxi*b + k;
                                let v = this.board[z][y][x];
                                if(v!==0) {
                                    if(map.has(v)) {
                                        errors.add(`${z},${y},${x}`);
                                        errors.add(map.get(v));
                                    } else map.set(v, `${z},${y},${x}`);
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

        for(let r = 0; r < n; r++) {
            for(let c = 0; c < n; c++) {
                const coords = this.map2Dto3D(r, c, game.dimension, currentAxis, currentSlice);
                const {z, y, x} = coords;
                
                const cell = document.createElement("div");
                cell.className = "cell";
                cell.dataset.z = z;
                cell.dataset.y = y;
                cell.dataset.x = x;
                
                if (game.initialBoard[z][y][x] !== 0) cell.classList.add("fixed");
                if ((c + 1) % base === 0 && c !== n - 1) cell.classList.add("border-right-thick");
                if ((r + 1) % base === 0 && r !== n - 1) cell.classList.add("border-bottom-thick");

                this.updateCellContent(cell, game, z, y, x);

                if(selectedCell && selectedCell.z === z && selectedCell.y === y && selectedCell.x === x) {
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

        if (initialVal !== 0) {
            cell.innerText = initialVal;
        } else if (val !== 0) {
            const entrySpan = document.createElement("span");
            entrySpan.className = "entry";
            entrySpan.innerText = val;
            cell.appendChild(entrySpan);
        } else {
            const notDiv = document.createElement("div");
            notDiv.className = "notations-list";
            
            const gNotes = Array.from(game.notations[z][y][x].green).sort((a,b) => a-b);
            const rNotes = Array.from(game.notations[z][y][x].red).sort((a,b) => a-b);

            if(gNotes.length > 0) {
                const gGroup = document.createElement("div");
                gGroup.className = "note-group note-green";
                gGroup.innerHTML = gNotes.map(n => `<span class="note-val" data-note="${n}">${n}</span>`).join(", ");
                notDiv.appendChild(gGroup);
            }
            if(rNotes.length > 0) {
                const rGroup = document.createElement("div");
                rGroup.className = "note-group note-red";
                rGroup.innerHTML = rNotes.map(n => `<span class="note-val" data-note="${n}">${n}</span>`).join(", ");
                notDiv.appendChild(rGroup);
            }
            cell.appendChild(notDiv);
        }
    }

    updateCellVisual(game, z, y, x) {
        const cell = this.boardEl.querySelector(`.cell[data-z="${z}"][data-y="${y}"][data-x="${x}"]`);
        if(cell) this.updateCellContent(cell, game, z, y, x);
    }

    renderAuxiliaryBox(game, currentAxis, selectedCell) {
        this.auxContainer.innerHTML = "";
        
        // Handle 2D: Never show
        if (game.dimension === 2) {
            this.auxBox.style.display = 'none';
            return;
        }

        // Handle 3D: Always keep flex to reserve space, but toggle visibility
        this.auxBox.style.display = 'flex';
        if (!selectedCell) {
            this.auxBox.classList.add('invisible');
            return;
        }
        this.auxBox.classList.remove('invisible');

        const b = game.base;
        const {z: sz, y: sy, x: sx} = selectedCell;
        const boxZ = Math.floor(sz / b) * b;
        const boxY = Math.floor(sy / b) * b;
        const boxX = Math.floor(sx / b) * b;

        for(let layer = 0; layer < b; layer++) {
            const auxGrid = document.createElement("div");
            auxGrid.className = "aux-grid";
            
            for(let r=0; r<b; r++) {
                for(let c=0; c<b; c++) {
                    let z=0, y=0, x=0;
                    if(currentAxis === 'XY') { z = boxZ + layer; y = boxY + r; x = boxX + c; }
                    else if(currentAxis === 'XZ') { y = boxY + layer; z = boxZ + r; x = boxX + c; }
                    else if(currentAxis === 'YZ') { x = boxX + layer; z = boxZ + r; y = boxY + c; }
                    
                    const cell = document.createElement("div");
                    cell.className = "cell";
                    cell.dataset.z = z;
                    cell.dataset.y = y;
                    cell.dataset.x = x;
                    
                    if (game.initialBoard[z][y][x] !== 0) {
                        cell.innerText = game.initialBoard[z][y][x];
                        cell.classList.add('fixed');
                    } else if (game.board[z][y][x] !== 0) {
                        cell.innerText = game.board[z][y][x];
                    } else if (game.notations[z][y][x].green.size > 0 || game.notations[z][y][x].red.size > 0) {
                        const gNotes = Array.from(game.notations[z][y][x].green).sort((a,b)=>a-b);
                        const rNotes = Array.from(game.notations[z][y][x].red).sort((a,b)=>a-b);
                        
                        cell.style.display = "flex";
                        cell.style.flexDirection = "column";
                        cell.style.fontSize = "calc(var(--cell-size) * 0.15)";
                        cell.style.lineHeight = "1";
                        cell.style.justifyContent = "center";
                        
                        let html = "";
                        if(gNotes.length > 0) html += `<div style="color:var(--notation-green)">${gNotes.join(",")}</div>`;
                        if(rNotes.length > 0) html += `<div style="color:var(--notation-red)">${rNotes.join(",")}</div>`;
                        cell.innerHTML = html;
                    }

                    if(sz === z && sy === y && sx === x) {
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
            if(currentAxis === 'XY') absoluteLayer = boxZ + layer;
            else if(currentAxis === 'XZ') absoluteLayer = boxY + layer;
            else if(currentAxis === 'YZ') absoluteLayer = boxX + layer;

            const lbl = document.createElement("div");
            lbl.innerText = `Layer ${absoluteLayer}`;
            lbl.style.fontSize = "0.8rem";
            wrapped.appendChild(lbl);
            this.auxContainer.appendChild(wrapped);
        }
    }

    map2Dto3D(r, c, dimension, axis, slice) {
        if(dimension === 2) return { z: 0, y: r, x: c };
        if(axis === 'XY') return { z: slice, y: r, x: c };
        if(axis === 'XZ') return { z: r, y: slice, x: c };
        if(axis === 'YZ') return { z: r, y: c, x: slice };
    }

    updateDimUI(dimension, axis, slice) {
        if(dimension === 2) {
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
            // Also check aux container
            if(this.auxContainer) {
                const auxCell = this.auxContainer.querySelector(`.cell[data-z="${z}"][data-y="${y}"][data-x="${x}"]`);
                if(auxCell) auxCell.classList.add("error");
            }
        });

        if(errors.size === 0 && isFilled) this.boardEl.classList.add("solved");
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
        if (isHold && identifiedNumber) {
            this.holdLabel.innerText = `Holding: ${identifiedNumber}`;
            this.holdLabel.style.display = 'inline';
        } else {
            this.holdLabel.style.display = 'none';
        }
    }

    updateHighlights(game, identifiedNumber) {
        document.querySelectorAll(".cell.identified").forEach(el => el.classList.remove("identified"));
        document.querySelectorAll(".note-val.identified-note").forEach(el => el.classList.remove("identified-note"));
        document.querySelectorAll(".cell.identified-aux-note").forEach(el => el.classList.remove("identified-aux-note"));
        
        if (!identifiedNumber) return;
        
        document.querySelectorAll(".cell").forEach(cell => {
             const z = parseInt(cell.dataset.z);
             const y = parseInt(cell.dataset.y);
             const x = parseInt(cell.dataset.x);
             if (isNaN(z) || isNaN(y) || isNaN(x)) return;
             
             const val = game.initialBoard[z][y][x] !== 0 ? game.initialBoard[z][y][x] : game.board[z][y][x];
             if (val === identifiedNumber) {
                 cell.classList.add("identified");
             } else if (val === 0) {
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

    populatePuzzleList(puzzles, onLoad) {
        this.selectEl.innerHTML = "";
        puzzles.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.text = `${p.metadata.name} - ${p.metadata.difficulty}`;
            this.selectEl.appendChild(opt);
        });
        if(puzzles.length > 0) onLoad(puzzles[0].id);
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
        this.lastSelectedCell = {z: 0, y: 0, x: 0};
        this.notationBuffer = "";

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

        document.addEventListener("mousedown", (e) => {
            const isInteractive = e.target.closest('#sudoku-board') || 
                                  e.target.closest('#auxiliary-box') || 
                                  e.target.closest('.sidebar') || 
                                  e.target.closest('.dim-controls') ||
                                  e.target.closest('.controls-top');
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

        document.querySelectorAll(".num-btn").forEach(btn => {
            btn.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation(); 
                const val = btn.dataset.val === 'enter' ? 'enter' : parseInt(btn.dataset.val);
                this.handleInput(val);
            });
        });

        document.addEventListener("keydown", (e) => this.handleKeyDown(e));
    }

    fetchPuzzles() {
        fetch('/api/puzzles')
            .then(res => res.json())
            .then(data => {
                this.ui.populatePuzzleList(data, (id) => this.loadPuzzle(id));
            });
    }

    loadPuzzle(id) {
        fetch(`/api/puzzle/${id}`)
            .then(res => res.json())
            .then(data => {
                this.initializePuzzle(Array.isArray(data) ? data[0] : data);
            });
    }

    initializePuzzle(puzzle) {
        this.game.initialize(puzzle);
        
        // Sync layout properties
        document.documentElement.style.setProperty('--grid-size', this.game.n);
        document.documentElement.style.setProperty('--base-size', this.game.base);

        this.selectedCell = null;
        this.currentAxis = 'XY';
        this.currentSlice = 0;
        this.notationBuffer = "";

        this.refreshAll();
    }

    refreshAll() {
        this.ui.updateDimUI(this.game.dimension, this.currentAxis, this.currentSlice);
        this.ui.renderBoard(this.game, this.currentAxis, this.currentSlice, this.selectedCell, (z,y,x) => this.selectCell(z,y,x));
        this.ui.renderAuxiliaryBox(this.game, this.currentAxis, this.selectedCell);
        this.refreshStatus();
    }

    refreshStatus() {
        const { errors, isFilled } = this.game.getConflicts();
        this.ui.updateConflicts(errors, isFilled);
        this.ui.updateHighlights(this.game, this.identifiedNumber);
        this.ui.updateHistoryBtns(this.game.undoStack.length, this.game.redoStack.length);
        this.ui.updateHoldUI(this.isIdentifyHold, this.identifiedNumber);
    }

    selectCell(z, y, x) {
        if(this.selectedCell) {
            if(this.mode === 'notation' && (this.selectedCell.z !== z || this.selectedCell.y !== y || this.selectedCell.x !== x)) {
                this.flushNotation();
            }
        }
        
        if (z === null) {
            this.selectedCell = null;
            if (!this.isIdentifyHold) this.identifiedNumber = null;
        } else {
            this.selectedCell = {z, y, x};
            this.lastSelectedCell = {z, y, x}; 
            if (!this.isIdentifyHold) {
                const val = this.game.board[z][y][x] || this.game.initialBoard[z][y][x];
                this.identifiedNumber = val !== 0 ? val : null;
            }
        }
        
        this.ui.renderBoard(this.game, this.currentAxis, this.currentSlice, this.selectedCell, (z,y,x) => this.selectCell(z,y,x));
        this.ui.renderAuxiliaryBox(this.game, this.currentAxis, this.selectedCell);
        this.refreshStatus();
    }

    setMode(newMode) {
        if(this.mode === 'notation' && newMode !== 'notation') this.flushNotation();
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
        if (!this.isIdentifyHold && !this.selectedCell) {
            this.identifiedNumber = null;
        }
        this.refreshStatus();
    }

    shiftSlice(delta) {
        if(this.game.dimension === 2) return;
        this.currentSlice = (this.currentSlice + delta + this.game.n) % this.game.n;
        this.refreshAll();
    }

    pivotAxis(newAxis) {
        if(this.game.dimension === 2 || this.currentAxis === newAxis) return;
        this.currentAxis = newAxis;
        if(this.selectedCell) {
            if(this.currentAxis === 'XY') this.currentSlice = this.selectedCell.z;
            else if(this.currentAxis === 'XZ') this.currentSlice = this.selectedCell.y;
            else if(this.currentAxis === 'YZ') this.currentSlice = this.selectedCell.x;
        } else {
            this.currentSlice = 0;
        }
        this.refreshAll();
    }

    handleInput(val) {
        if(!this.selectedCell) {
            if (val === 0 || val === 'enter') {
                this.identifiedNumber = null;
            } else if (typeof val === 'number') {
                const nextStr = (this.identifiedNumber === null) ? val.toString() : this.identifiedNumber.toString() + val.toString();
                let nextVal = parseInt(nextStr);
                if (nextVal > this.game.n) nextVal = val;
                this.identifiedNumber = (this.identifiedNumber === nextVal) ? null : nextVal;
            }
            this.refreshStatus();
            return;
        }

        const {z, y, x} = this.selectedCell;
        if(this.game.initialBoard[z][y][x] !== 0) return;

        if (val === 'enter') {
            if (this.mode === 'notation') this.flushNotation();
            return;
        }

        if (val === 0) {
            this.notationBuffer = "";
            const prev = this.game.board[z][y][x];
            const oldGreen = new Set(this.game.notations[z][y][x].green);
            const oldRed = new Set(this.game.notations[z][y][x].red);
            if (prev !== 0 || oldGreen.size > 0 || oldRed.size > 0) {
               this.game.execute({ type: 'clear_all', z, y, x, prev, oldGreen, oldRed });
            }
            this.ui.updateCellVisual(this.game, z, y, x);
            this.refreshStatus();
            this.ui.renderAuxiliaryBox(this.game, this.currentAxis, this.selectedCell);
            return;
        }

        if(this.mode === 'entry') {
            const prev = this.game.board[z][y][x];
            const nextVal = prev === 0 ? val : parseInt(prev.toString() + val.toString());
            if(nextVal > this.game.n) return;
            if(prev !== nextVal) {
                const oldGreen = new Set(this.game.notations[z][y][x].green);
                const oldRed = new Set(this.game.notations[z][y][x].red);
                this.game.execute({ type: 'entry', z, y, x, prev, val: nextVal, oldGreen, oldRed });
            }
        } else { 
            if(this.game.board[z][y][x] !== 0) return; 
            this.notationBuffer += val.toString();
            if (this.game.n < 10) this.flushNotation();
        }
        this.ui.updateCellVisual(this.game, z, y, x);
        this.refreshStatus();
        this.ui.renderAuxiliaryBox(this.game, this.currentAxis, this.selectedCell);
    }

    flushNotation() {
        if(this.notationBuffer.length > 0 && this.selectedCell) {
            const num = parseInt(this.notationBuffer);
            this.notationBuffer = "";
            const {z, y, x} = this.selectedCell;
            if(num > 0 && num <= this.game.n) {
                const hasNote = this.game.notations[z][y][x][this.currentNotationColor].has(num);
                this.game.execute({
                    type: 'notation', z, y, x, val: num, added: !hasNote, color: this.currentNotationColor
                });
            }
            this.ui.updateCellVisual(this.game, z, y, x);
            this.refreshStatus();
            this.ui.renderAuxiliaryBox(this.game, this.currentAxis, this.selectedCell);
        }
    }

    undo() {
        const coords = this.game.undo();
        if(coords) {
            this.selectedCell = coords;
            this.refreshAll();
        }
    }

    redo() {
        const coords = this.game.redo();
        if(coords) {
            this.selectedCell = coords;
            this.refreshAll();
        }
    }

    handleKeyDown(e) {
        const key = e.key;
        const handledKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Enter', ' '];
        
        if (handledKeys.includes(key)) {
            const board = document.querySelector('.board-container');
            const rect = board.getBoundingClientRect();
            const isFullyVisible = (rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth);
            if (isFullyVisible) e.preventDefault();
        }

        if(key >= '1' && key <= '9') this.handleInput(parseInt(key));
        else if (key === 'Enter' || key === 'NumpadEnter') this.handleInput('enter');
        else if (key === 'Backspace' || key === 'Delete' || key === '0') this.handleInput(0);
        else if (key === 'Escape') {
            if (this.selectedCell) this.selectCell(null, null, null);
            else { this.identifiedNumber = null; this.refreshStatus(); }
        }
        else if (key.toLowerCase() === 'n') this.setMode('notation');
        else if (key.toLowerCase() === 'e') this.setMode('entry');
        else if (key.toLowerCase() === 'v') { this.setMode('notation'); this.setNotationColor('green'); }
        else if (key.toLowerCase() === 'i') { this.setMode('notation'); this.setNotationColor('red'); }
        else if (key.toLowerCase() === 'h') this.toggleHoldHighlight();
        else if (key.toLowerCase() === 'z') this.undo();
        else if (key.toLowerCase() === 'y') this.redo();
        else if (key.startsWith('Arrow')) this.handleArrowKey(key);
    }

    handleArrowKey(key) {
        const pos = this.selectedCell || this.lastSelectedCell;
        let {z, y, x} = pos;
        const n = this.game.n;
        if (key === 'ArrowUp') {
            if (this.currentAxis === 'XY' && y > 0) y--;
            else if (this.currentAxis === 'XZ' && z > 0) z--;
            else if (this.currentAxis === 'YZ' && z > 0) z--;
        } else if (key === 'ArrowDown') {
            if (this.currentAxis === 'XY' && y < n-1) y++;
            else if (this.currentAxis === 'XZ' && z < n-1) z++;
            else if (this.currentAxis === 'YZ' && z < n-1) z++;
        } else if (key === 'ArrowLeft') {
            if (this.currentAxis === 'XY' && x > 0) x--;
            else if (this.currentAxis === 'XZ' && x > 0) x--;
            else if (this.currentAxis === 'YZ' && y > 0) y--;
        } else if (key === 'ArrowRight') {
            if (this.currentAxis === 'XY' && x < n-1) x++;
            else if (this.currentAxis === 'XZ' && x < n-1) x++;
            else if (this.currentAxis === 'YZ' && y < n-1) y++;
        }
        this.selectCell(z, y, x);
    }

    handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                this.initializePuzzle(Array.isArray(data) ? data[0] : data);
            } catch (err) {
                alert("Failed to load puzzle file: " + err.message);
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    }

    savePuzzle() {
        const currentData = {
            id: `save-${new Date().getTime()}`,
            metadata: {
                ...this.game.metadata,
                name: (this.game.metadata.name || "Sudoku") + " (Save)",
                saved_at: new Date().toISOString()
            },
            initial_state: [],
            current_state: []
        };

        for (let z = 0; z < this.game.nz; z++) {
            for (let y = 0; y < this.game.ny; y++) {
                for (let x = 0; x < this.game.nx; x++) {
                    if (this.game.initialBoard[z][y][x] !== 0) {
                        currentData.initial_state.push({ z, y, x, value: this.game.initialBoard[z][y][x] });
                    } 
                    const val = this.game.board[z][y][x];
                    const gNoteArr = Array.from(this.game.notations[z][y][x].green);
                    const rNoteArr = Array.from(this.game.notations[z][y][x].red);
                    if (val !== 0 || gNoteArr.length > 0 || rNoteArr.length > 0) {
                        currentData.current_state.push({
                            z, y, x, value: val,
                            notations: { green: gNoteArr, red: rNoteArr }
                        });
                    }
                }
            }
        }

        const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${currentData.metadata.name.replace(/\s+/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.app = new SudokuApp();
});
