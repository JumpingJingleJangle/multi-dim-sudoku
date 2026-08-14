# Multi-Dimensional Sudoku

A web application for playing generalizations of Sudoku allowing for 3d puzzles and 16x16 puzzles in the browser.

## Features

- **Multi-Dimensional Grid Support**:
  - **2D Sudoku**: Classic 9x9 (Base 3), Shi-Doku 4x4 (Base 2), and Hexadecimal 16x16 (Base 4).
  - **3D Cube Grids**: 3D Sudoku cubes with 3D constraint propagation across orthogonal planes and sub-boxes.
- **3D Navigation**:
  - **Plane Pivot Controls**: View grid projections along **XY**, **XZ**, and **YZ** axes.
  - **Layer Shift**: Navigate forward and backward through layers.
  - **Active Box Context**: Display all 3D layers of the selected sub-box simultaneously.
- **Sudoku Generation**:
  - Sudoku generator for 2d and 3d puzzles in the browser and through a cli.

## Generalization Logic

Sudoku is generalized using two parameters: **Base ($b$)** and **Dimension ($D$)**.

### Derived Formulas
- **Side Length & Symbol Count ($N$)**: $N(b, D) = b^D$
- **Sub-box Volume**: $V_{\text{box}}(b, D) = b^D = N$ (with dimensions $b \times \dots \times b$)
- **Total Grid Cells**: $V_{\text{grid}}(b, D) = N^D = b^{D^2}$
- **Sub-box Count**: $C_{\text{box}}(b, D) = \frac{V_{\text{grid}}}{V_{\text{box}}} = b^{D(D-1)}$

### Constraint Rules
- **Orthogonal Constraints**: Every 1D line of length $N$ along any coordinate axis (holding all other $D-1$ coordinates constant) must contain each symbol exactly once.
- **Sub-box Constraints**: Every $D$-dimensional sub-box of volume $b^D$ must contain each symbol exactly once.

### Configurations
- **2D Shi-Doku** ($b=2, D=2$): $N=4$ ($4 \times 4$ grid, $2 \times 2$ sub-boxes, 4 sub-boxes, symbols $1\dots4$).
- **2D Classic** ($b=3, D=2$): $N=9$ ($9 \times 9$ grid, $3 \times 3$ sub-boxes, 9 sub-boxes, symbols $1\dots9$).
- **2D Hexadecimal** ($b=4, D=2$): $N=16$ ($16 \times 16$ grid, $4 \times 4$ sub-boxes, 16 sub-boxes, symbols $0\dots\text{F}$).
- **3D Cube** ($b=2, D=3$): $N=8$ ($8 \times 8 \times 8$ grid, $2 \times 2 \times 2$ sub-boxes, 64 sub-boxes, symbols $1\dots8$).

## Controls

### Navigation & Selection
- **Click**: Select cell on the board or auxiliary box view.
- **Arrow Keys**: Move cell selection.
- **Escape**: Deselect cell or clear digit highlights.

### Input & Editing
- **1–9 / 0–F**: Input digit or candidate note (0–F for 16x16 grid).
- **Backspace / Delete**: Clear cell.
- **M**: Switch to Entry Mode.
- **N**: Switch to Notation Mode.
- **V**: Set Notation Mode to Green (valid candidate).
- **I**: Set Notation Mode to Red (invalid candidate).
- **H**: Toggle Hold Highlight for selected digit.

### 3D Navigation
- **XY / XZ / YZ**: Pivot view plane.
- **Shift Up / Down**: Step forward or backward through 3D layers.

### History
- **Z**: Undo.
- **Y**: Redo.

## Local Development

Run locally using Python's static HTTP server:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in a web browser.

## Running Tests

Run the Node.js unit test suite:

```bash
npm test
```

## Batch CLI Puzzle Generation

Generate puzzles via the command line:

```bash
# Generate 1 medium 3x2 classic puzzle (default)
npm run generate

# Generate 5 hard 2x3 3D hyper-cube puzzles saved to puzzles/ directory
npm run generate -- --preset 2x3 --difficulty high --count 5 --outDir puzzles
```
