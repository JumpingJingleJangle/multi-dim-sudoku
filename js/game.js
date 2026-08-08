/**
 * SudokuGame Model
 * Headless rule engine managing grid arrays, coordinate translation,
 * undo/redo command history, and conflict detection.
 */

export class SudokuGame {
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
