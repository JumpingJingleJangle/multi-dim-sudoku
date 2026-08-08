import { DLX } from './dlx-solver.js';

const HEX_SYMBOLS = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];

function getSymbol(v, base) {
    if (base === 4) return HEX_SYMBOLS[v - 1];
    return v;
}

// 3D Seed Generator & Isomorphic Shuffling
function generateAlgebraicSeed3DBase2() {
    const grid = Array(8).fill(null).map(() => Array(8).fill(null).map(() => Array(8).fill(0)));
    const M2 = [0, 2, 4, 6, 3, 1, 7, 5];
    const M4 = [0, 4, 3, 7, 6, 2, 5, 1];

    for (let z = 0; z < 8; z++) {
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                grid[z][y][x] = (x ^ M2[y] ^ M4[z]) + 1;
            }
        }
    }
    return grid;
}

function shuffle3DBase2Grid(grid) {
    // 1. Symbol Relabeling
    let symbols = [1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);
    let symMap = {};
    for (let i = 1; i <= 8; i++) symMap[i] = symbols[i - 1];

    for (let z = 0; z < 8; z++) {
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                grid[z][y][x] = symMap[grid[z][y][x]];
            }
        }
    }

    // 2. Intra-box line swapping
    for (let axis = 0; axis < 3; axis++) {
        for (let block = 0; block < 4; block++) {
            let i1 = block * 2, i2 = block * 2 + 1;
            if (Math.random() > 0.5) {
                for (let a = 0; a < 8; a++) {
                    for (let b = 0; b < 8; b++) {
                        if (axis === 0) {
                            let tmp = grid[a][b][i1]; grid[a][b][i1] = grid[a][b][i2]; grid[a][b][i2] = tmp;
                        } else if (axis === 1) {
                            let tmp = grid[a][i1][b]; grid[a][i1][b] = grid[a][i2][b]; grid[a][i2][b] = tmp;
                        } else if (axis === 2) {
                            let tmp = grid[i1][a][b]; grid[i1][a][b] = grid[i2][a][b]; grid[i2][a][b] = tmp;
                        }
                    }
                }
            }
        }
    }

    // 3. Inter-box block swapping
    for (let axis = 0; axis < 3; axis++) {
        let blocks = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
        let newIdx = [];
        for (let b of blocks) newIdx.push(b * 2, b * 2 + 1);

        let newGrid = Array(8).fill(null).map(() => Array(8).fill(null).map(() => Array(8).fill(0)));
        for (let z = 0; z < 8; z++) {
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    if (axis === 0) newGrid[z][y][x] = grid[z][y][newIdx[x]];
                    else if (axis === 1) newGrid[z][y][x] = grid[z][newIdx[y]][x];
                    else if (axis === 2) newGrid[z][y][x] = grid[newIdx[z]][y][x];
                }
            }
        }
        grid = newGrid;
    }

    return grid;
}

// Full Solution Generator
function generateFullPuzzle(base, dim) {
    if (base === 2 && dim === 3) {
        let grid = generateAlgebraicSeed3DBase2();
        grid = shuffle3DBase2Grid(grid);
        let solutions = [];
        for (let z = 0; z < 8; z++) {
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    solutions.push({ z, y, x, value: grid[z][y][x] });
                }
            }
        }
        return {
            id: `gen-${Math.random().toString(36).substring(2, 10)}`,
            metadata: {
                name: `Generated 3D Base 2 (Full)`,
                base: 2,
                dimension: 3,
                difficulty: "Completed",
                author: "In-Browser JS Engine"
            },
            initial_state: solutions
        };
    }

    const n = base ** dim;
    const colNames = [];

    function generateCoords(d, maxBound) {
        let res = [];
        function loop(currentD, current) {
            if (currentD === d) {
                res.push([...current]);
                return;
            }
            for (let i = 0; i < maxBound; i++) {
                loop(currentD + 1, [...current, i]);
            }
        }
        loop(0, []);
        return res;
    }

    const allCoords = generateCoords(dim, n);

    for (let c of allCoords) {
        colNames.push(`Cell_${c.join(',')}`);
    }

    for (let axis = 0; axis < dim; axis++) {
        const fixedCoords = generateCoords(dim - 1, n);
        for (let fc of fixedCoords) {
            for (let v = 1; v <= n; v++) {
                colNames.push(`Line_A${axis}_${fc.join(',')}_V${v}`);
            }
        }
    }

    const numBoxesPerAxis = Math.floor(n / base);
    const boxCoords = generateCoords(dim, numBoxesPerAxis);
    for (let bc of boxCoords) {
        for (let v = 1; v <= n; v++) {
            colNames.push(`Box_${bc.join(',')}_V${v}`);
        }
    }

    const dlx = new DLX(colNames);

    for (let c of allCoords) {
        for (let v = 1; v <= n; v++) {
            let rowCols = [];
            rowCols.push(`Cell_${c.join(',')}`);

            for (let axis = 0; axis < dim; axis++) {
                let fc = [...c];
                fc.splice(axis, 1);
                rowCols.push(`Line_A${axis}_${fc.join(',')}_V${v}`);
            }

            let bc = c.map(val => Math.floor(val / base));
            rowCols.push(`Box_${bc.join(',')}_V${v}`);

            let rowInfo = { coords: c, value: v };
            dlx.addRow(rowInfo, rowCols);
        }
    }

    let solutions = [];
    let success = dlx.search(solutions);

    if (!success) return null;

    let initialState = solutions.map(s => {
        let val = getSymbol(s.value, base);
        let cellObj = { value: val };
        if (dim === 2) {
            cellObj.y = s.coords[0];
            cellObj.x = s.coords[1];
        } else if (dim === 3) {
            cellObj.z = s.coords[0];
            cellObj.y = s.coords[1];
            cellObj.x = s.coords[2];
        }
        return cellObj;
    });

    return {
        id: `gen-${Math.random().toString(36).substring(2, 10)}`,
        metadata: {
            name: `Generated ${dim}D Base ${base} (Full)`,
            base: base,
            dimension: dim,
            difficulty: "Completed",
            author: "In-Browser JS Engine"
        },
        initial_state: initialState
    };
}

// Constraint Solver & Clue Digging Engine
class ConstraintSolver {
    constructor(stateMap, base, dimension) {
        this.base = base;
        this.dimension = dimension;
        this.N = base ** dimension;
        this.stateMap = new Map(stateMap);

        this.squares = [];
        this.generateSquares([], 0);
        this.units = new Map();
        this.peers = new Map();

        for (let s of this.squares) {
            let key = s.join(',');
            let lines = this.getOrthogonalLines(s);
            let box = [this.getBoxCoords(s)];
            this.units.set(key, [...lines, ...box]);

            let peerSet = new Set();
            for (let u of this.units.get(key)) {
                for (let sq of u) {
                    let sqKey = sq.join(',');
                    if (sqKey !== key) peerSet.add(sqKey);
                }
            }
            this.peers.set(key, peerSet);
        }
    }

    generateSquares(current, depth) {
        if (depth === this.dimension) {
            this.squares.push(current);
            return;
        }
        for (let i = 0; i < this.N; i++) {
            this.generateSquares([...current, i], depth + 1);
        }
    }

    getOrthogonalLines(coords) {
        let lines = [];
        for (let axis = 0; axis < this.dimension; axis++) {
            let line = [];
            for (let v = 0; v < this.N; v++) {
                let c = [...coords];
                c[axis] = v;
                line.push(c);
            }
            lines.push(line);
        }
        return lines;
    }

    getBoxCoords(coords) {
        let origin = coords.map(c => Math.floor(c / this.base) * this.base);
        let box = [];
        let b = this.base;
        let dim = this.dimension;

        function iter(d, current) {
            if (d === dim) {
                box.push(current);
                return;
            }
            for (let v = 0; v < b; v++) {
                iter(d + 1, [...current, origin[d] + v]);
            }
        }
        iter(0, []);
        return box;
    }

    solve() {
        let colNames = [];
        let allCoords = this.squares;
        let n = this.N;
        let base = this.base;
        let dim = this.dimension;

        for (let c of allCoords) colNames.push(`Cell_${c.join(',')}`);

        for (let axis = 0; axis < dim; axis++) {
            let fixedCoords = [];
            function genFixed(d, current) {
                if (d === dim - 1) { fixedCoords.push(current); return; }
                for (let i = 0; i < n; i++) genFixed(d + 1, [...current, i]);
            }
            genFixed(0, []);
            for (let fc of fixedCoords) {
                for (let v = 1; v <= n; v++) colNames.push(`Line_A${axis}_${fc.join(',')}_V${v}`);
            }
        }

        let numBoxes = Math.floor(n / base);
        let boxCoords = [];
        function genBox(d, current) {
            if (d === dim) { boxCoords.push(current); return; }
            for (let i = 0; i < numBoxes; i++) genBox(d + 1, [...current, i]);
        }
        genBox(0, []);
        for (let bc of boxCoords) {
            for (let v = 1; v <= n; v++) colNames.push(`Box_${bc.join(',')}_V${v}`);
        }

        let dlx = new DLX(colNames);

        for (let c of allCoords) {
            let key = c.join(',');
            let fixedVal = this.stateMap.get(key);
            let hasVal = fixedVal !== null && fixedVal !== undefined;
            for (let v = 1; v <= n; v++) {
                let cellVal = getSymbol(v, base);
                if (hasVal && String(fixedVal) !== String(cellVal)) continue;
                let rowCols = [`Cell_${c.join(',')}`];
                for (let axis = 0; axis < dim; axis++) {
                    let fc = [...c];
                    fc.splice(axis, 1);
                    rowCols.push(`Line_A${axis}_${fc.join(',')}_V${v}`);
                }
                let bc = c.map(val => Math.floor(val / base));
                rowCols.push(`Box_${bc.join(',')}_V${v}`);
                dlx.addRow({ coords: c, value: cellVal }, rowCols);
            }
        }

        let numSolutions = dlx.countSolutions(2);
        return { solvable: numSolutions === 1 };
    }
}


function processDigging(fullPuzzle, options = {}) {
    const meta = fullPuzzle.metadata;
    const base = meta.base;
    const dim = meta.dimension;
    const n = base ** dim;
    const targetRemovals = options.removals || (dim === 3 ? 120 : (n === 4 ? 6 : (n === 16 ? 80 : 40)));
    const strategy = options.strategy || 'weighted'; // 'weighted', 'entropy', 'tight'

    let stateMap = new Map();
    fullPuzzle.initial_state.forEach(cell => {
        let key = dim === 3 ? `${cell.z},${cell.y},${cell.x}` : `${cell.y},${cell.x}`;
        stateMap.set(key, cell.value);
    });

    let keys = Array.from(stateMap.keys()).sort(() => Math.random() - 0.5);
    let emptyPeerCounts = new Map();
    keys.forEach(k => emptyPeerCounts.set(k, 0));

    let dummySolver = new ConstraintSolver(stateMap, base, dim);
    let peersMap = dummySolver.peers;

    let removedCount = 0;
    let potentialCoords = [...keys];

    while (potentialCoords.length > 0 && removedCount < targetRemovals) {
        let power = strategy === 'tight' ? 2 : 1;
        let weights = potentialCoords.map(k => Math.pow(1 + emptyPeerCounts.get(k), power));

        let numCandidates = strategy === 'entropy' ? Math.min(5, potentialCoords.length) : 1;
        let candidatePool = [...potentialCoords];
        let poolWeights = [...weights];
        let sampledCandidates = [];

        for (let i = 0; i < numCandidates; i++) {
            let totalW = poolWeights.reduce((a, b) => a + b, 0);
            if (totalW <= 0) break;
            let r = Math.random() * totalW;
            let acc = 0;
            let chosenIdx = 0;
            for (let j = 0; j < poolWeights.length; j++) {
                acc += poolWeights[j];
                if (r <= acc) { chosenIdx = j; break; }
            }
            sampledCandidates.push(candidatePool[chosenIdx]);
            candidatePool.splice(chosenIdx, 1);
            poolWeights.splice(chosenIdx, 1);
        }

        let bestCandidate = null;
        let maxEntropy = -1;
        const emptyVal = null;
        const isEmptyKey = (k) => {
            let v = stateMap.get(k);
            return v === null || v === undefined;
        };

        for (let testKey of sampledCandidates) {
            let origVal = stateMap.get(testKey);
            stateMap.set(testKey, emptyVal);

            let solver = new ConstraintSolver(stateMap, base, dim);
            let res = solver.solve();

            if (res.solvable) {
                if (strategy === 'entropy') {
                    let currentEntropy = 0;
                    let peers = peersMap.get(testKey);
                    if (peers) {
                        for (let pKey of peers) {
                            if (isEmptyKey(pKey)) currentEntropy += 1;
                        }
                    }
                    if (currentEntropy > maxEntropy) {
                        maxEntropy = currentEntropy;
                        bestCandidate = testKey;
                    }
                } else {
                    bestCandidate = testKey;
                    stateMap.set(testKey, origVal);
                    break;
                }
            }
            stateMap.set(testKey, origVal);
        }

        if (bestCandidate) {
            stateMap.set(bestCandidate, emptyVal);
            potentialCoords = potentialCoords.filter(k => k !== bestCandidate);
            removedCount++;
            let peers = peersMap.get(bestCandidate);
            if (peers) {
                for (let pKey of peers) {
                    emptyPeerCounts.set(pKey, emptyPeerCounts.get(pKey) + 1);
                }
            }
        } else {
            potentialCoords.shift();
        }
    }

    let playableInitial = [];
    stateMap.forEach((val, key) => {
        if (val !== null && val !== undefined) {
            let parts = key.split(',').map(Number);
            let cellObj = { value: val };
            if (dim === 2) { cellObj.y = parts[0]; cellObj.x = parts[1]; }
            else if (dim === 3) { cellObj.z = parts[0]; cellObj.y = parts[1]; cellObj.x = parts[2]; }
            playableInitial.push(cellObj);
        }
    });

    const puzzleName = options.name || `${dim}D Base ${base} Custom Puzzle`;
    const puzzleId = `play-${Math.random().toString(36).substring(2, 10)}`;

    return {
        id: puzzleId,
        metadata: {
            name: puzzleName,
            base: base,
            dimension: dim,
            difficulty: options.difficulty || "Custom Generated",
            strategy: strategy,
            author: "In-Browser JS Engine"
        },
        initial_state: playableInitial,
        master_solution: fullPuzzle.initial_state
    };
}


// Worker Communication Interface
if (typeof self !== 'undefined') {
    self.onmessage = function (e) {
        const { base, dim, name, removals, strategy, difficulty } = e.data;
        try {
            self.postMessage({ type: 'STATUS', message: 'Generating solution matrix...' });
            let fullPuzzle = generateFullPuzzle(base, dim);

            if (!fullPuzzle) {
                self.postMessage({ type: 'RESULT', status: 'ERROR', message: 'Failed to generate solution matrix.' });
                return;
            }

            self.postMessage({ type: 'STATUS', message: 'Digging clues for playable puzzle...' });
            let playablePuzzle = processDigging(fullPuzzle, { strategy, difficulty, name, removals });

            self.postMessage({ type: 'RESULT', status: 'SUCCESS', puzzle: playablePuzzle });
        } catch (err) {
            self.postMessage({ type: 'RESULT', status: 'ERROR', message: err.message });
        }
    };
}

export { generateFullPuzzle, ConstraintSolver, processDigging };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateFullPuzzle, ConstraintSolver, processDigging };
}

