/**
 * Dancing Links (DLX) Exact Cover Matrix Engine & Constraint Solver
 * Used for hyper-grid puzzle generation and unique solvability checking.
 */

export class Node {
    constructor(col = null) {
        this.L = this;
        this.R = this;
        this.U = this;
        this.D = this;
        this.C = col;
        this.row_info = null;
    }
}

export class ColumnNode extends Node {
    constructor(name) {
        super(null);
        this.C = this;
        this.size = 0;
        this.name = name;
    }
}

export class DLX {
    constructor(colNames) {
        this.h = new ColumnNode("header");
        this.cols = [];
        this.colDict = {};

        let prev = this.h;
        for (let name of colNames) {
            let node = new ColumnNode(name);
            this.cols.push(node);
            this.colDict[name] = node;
            node.L = prev;
            prev.R = node;
            prev = node;
        }
        prev.R = this.h;
        this.h.L = prev;
    }

    addRow(rowInfo, colNamesForRow) {
        let first = null;
        for (let name of colNamesForRow) {
            let col = this.colDict[name];
            if (!col) continue;
            let node = new Node(col);
            node.row_info = rowInfo;

            node.D = col;
            node.U = col.U;
            col.U.D = node;
            col.U = node;
            col.size += 1;

            if (first === null) {
                first = node;
            } else {
                node.L = first.L;
                node.R = first;
                first.L.R = node;
                first.L = node;
            }
        }
        return first;
    }

    cover(c) {
        c.R.L = c.L;
        c.L.R = c.R;
        let i = c.D;
        while (i !== c) {
            let j = i.R;
            while (j !== i) {
                j.D.U = j.U;
                j.U.D = j.D;
                j.C.size -= 1;
                j = j.R;
            }
            i = i.D;
        }
    }

    uncover(c) {
        let i = c.U;
        while (i !== c) {
            let j = i.L;
            while (j !== i) {
                j.C.size += 1;
                j.D.U = j;
                j.U.D = j;
                j = j.L;
            }
            i = i.U;
        }
        c.R.L = c;
        c.L.R = c;
    }

    search(solutions) {
        if (this.h.R === this.h) {
            return true;
        }

        let c = this.h.R;
        let minCol = c;
        while (c !== this.h) {
            if (c.size < minCol.size) {
                minCol = c;
            }
            c = c.R;
        }

        if (minCol.size === 0) return false;

        this.cover(minCol);

        let rows = [];
        let r = minCol.D;
        while (r !== minCol) {
            rows.push(r);
            r = r.D;
        }
        rows.sort(() => Math.random() - 0.5);

        for (let rowNode of rows) {
            solutions.push(rowNode.row_info);

            let j = rowNode.R;
            while (j !== rowNode) {
                this.cover(j.C);
                j = j.R;
            }

            if (this.search(solutions)) {
                return true;
            }

            solutions.pop();
            j = rowNode.L;
            while (j !== rowNode) {
                this.uncover(j.C);
                j = j.L;
            }
        }

        this.uncover(minCol);
        return false;
    }

    countSolutions(maxCount = 2) {
        let count = 0;
        const searchCount = () => {
            if (this.h.R === this.h) {
                count++;
                return count >= maxCount;
            }

            let c = this.h.R;
            let minCol = c;
            while (c !== this.h) {
                if (c.size < minCol.size) {
                    minCol = c;
                }
                c = c.R;
            }

            if (minCol.size === 0) return false;

            this.cover(minCol);

            let r = minCol.D;
            while (r !== minCol) {
                let j = r.R;
                while (j !== r) {
                    this.cover(j.C);
                    j = j.R;
                }

                if (searchCount()) {
                    j = r.L;
                    while (j !== r) {
                        this.uncover(j.C);
                        j = j.L;
                    }
                    this.uncover(minCol);
                    return true;
                }

                j = r.L;
                while (j !== r) {
                    this.uncover(j.C);
                    j = j.L;
                }
                r = r.D;
            }

            this.uncover(minCol);
            return false;
        };

        searchCount();
        return count;
    }
}
