/**
 * UIState Model
 * Encapsulates interactive UI state including cell selection,
 * 3D slicing axis/layer, entry/notation modes, and hold identification.
 */

export class UIState {
    constructor() {
        this.reset();
    }

    reset() {
        this.selectedCell = null;
        this.lastSelectedCell = null;
        this.currentAxis = 'XY';
        this.currentSlice = 0;
        this.mode = 'entry';
        this.currentNotationColor = 'green';
        this.notationBuffer = "";
        this.identifiedNumber = null;
        this.isIdentifyHold = false;
    }

    selectCell(z, y, x, getCellValue) {
        if (z === null || z === undefined) {
            this.selectedCell = null;
            if (!this.isIdentifyHold) {
                this.identifiedNumber = null;
            }
        } else {
            this.selectedCell = { z, y, x };
            this.lastSelectedCell = { z, y, x };
            if (!this.isIdentifyHold && getCellValue) {
                this.identifiedNumber = getCellValue(z, y, x);
            }
        }
    }

    setMode(newMode) {
        this.mode = newMode;
        if (this.mode !== 'notation') {
            this.notationBuffer = "";
        }
    }

    setNotationColor(color) {
        this.currentNotationColor = color;
    }

    toggleHold(getCellValue) {
        this.isIdentifyHold = !this.isIdentifyHold;
        if (!this.isIdentifyHold) {
            if (this.selectedCell && getCellValue) {
                const { z, y, x } = this.selectedCell;
                this.identifiedNumber = getCellValue(z, y, x);
            } else {
                this.identifiedNumber = null;
            }
        }
    }

    shiftSlice(delta, maxSlices) {
        if (maxSlices <= 1) return;
        this.currentSlice = (this.currentSlice + delta + maxSlices) % maxSlices;
    }

    pivotAxis(newAxis) {
        if (this.currentAxis === newAxis) return;
        this.currentAxis = newAxis;
        if (this.selectedCell) {
            if (this.currentAxis === 'XY') this.currentSlice = this.selectedCell.z;
            else if (this.currentAxis === 'XZ') this.currentSlice = this.selectedCell.y;
            else if (this.currentAxis === 'YZ') this.currentSlice = this.selectedCell.x;
        } else {
            this.currentSlice = 0;
        }
    }
}
