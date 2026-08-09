# Multi-Dimensional Sudoku PWA

A sleek, standalone Progressive Web App (PWA) for playing 2D and 3D multi-dimensional Sudoku puzzles offline in your browser. Built for speed, responsiveness, and zero dependencies, servable directly from GitHub Pages or any static web server.

## Features

- **Single Page PWA**: Fully functional offline web application with Web App Manifest (`manifest.json`) and Service Worker (`sw.js`) pre-caching.
- **Multi-Dimensional Grid Support**:
  - **2D Sudoku**: Classic 9x9 (Base 3), Shi-Doku 4x4 (Base 2), and Hexadecimal 16x16 (Base 4).
  - **3D Hyper-Grids**: 3D Sudoku hyper-cubes with 3D block constraint propagation across orthogonal planes and sub-boxes.
- **Dynamic 3D Navigation**:
  - **Plane Pivot Controls**: Toggle view plane dynamically across **XY**, **XZ**, and **YZ** axes.
  - **Layer Shift**: Step forward and backward through layers in real time.
  - **Active Box Context**: Auxiliary visualization displaying all 3D layers of the selected sub-box simultaneously.
- **Dual Interaction Modes**:
  - **Entry Mode (Key `M`)**: Directly enter numbers.
  - **Notation Mode (Key `N`)**: Add custom valid (Green, key `V`) or invalid (Red, key `I`) digit candidates.
  - **Hold Highlight (Key `H`)**: Lock digit selection for fast identification across the entire board.
- **In-Browser & Node DLX Generator Engine**:
  - Asynchronous Web Worker puzzle generator powered by Knuth's **Dancing Links (DLX)** exact cover matrix algorithm.
  - **Max Removal Mode (`-1`)**: Attempt clue removals until a minimal uniquely-solvable puzzle state is reached.
  - **Offline CLI Tool**: Command-line generator script for batch puzzle creation.
- **Full History**: Undo (`Z`) & Redo (`Y`) state stack.
- **File Management**: Load bundled puzzles, upload custom `.json` puzzles, generate custom puzzles, and export saved progress.

## GitHub Pages Deployment

To host on GitHub Pages:
1. Push this repository to GitHub.
2. In your repository settings under **Pages**, select `main` branch and root `/` folder as the source.
3. Your app will be live at `https://<your-username>.github.io/<repository-name>/`.

## Local Development

To run locally using Python's static HTTP server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your web browser.

## Running Tests

Run the automated Node.js unit test suite:

```bash
npm test
```

## Batch CLI Puzzle Generation

Batch generate puzzles offline via command line:

```bash
# Generate 1 medium 3x2 classic puzzle (default)
npm run generate

# Generate 5 hard 2x3 3D hyper-cube puzzles saved to puzzles/ directory
npm run generate -- --preset 2x3 --difficulty high --count 5 --outDir puzzles
```
