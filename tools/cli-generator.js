#!/usr/bin/env node
/**
 * Command Line Interface (CLI) Puzzle Generator Tool
 * Uses js/generator/generator-core.js to generate multi-dimensional Sudoku puzzles offline.
 * 
 * Usage:
 *   node tools/cli-generator.js [options]
 * 
 * Options:
 *   --preset <2x2|3x2|4x2|2x3>  Grid preset (default: 3x2)
 *   --difficulty <low|medium|high|max>  Difficulty level (default: medium)
 *   --name <string>             Puzzle display name
 *   --count <number>            Number of puzzles to generate (default: 1)
 *   --outDir <path>             Output directory (default: ./puzzles)
 *   --removals <number>         Explicit clue removal count (-1 for max)
 *   --strategy <weighted|entropy|tight>  Clue digging algorithm strategy
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePuzzle } from '../js/generator/generator-core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        preset: '3x2',
        difficulty: 'medium',
        name: null,
        count: 1,
        outDir: path.resolve(__dirname, '../puzzles'),
        removals: undefined,
        strategy: undefined
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--preset' && args[i + 1]) options.preset = args[++i];
        else if (arg === '--difficulty' && args[i + 1]) options.difficulty = args[++i];
        else if (arg === '--name' && args[i + 1]) options.name = args[++i];
        else if (arg === '--count' && args[i + 1]) options.count = parseInt(args[++i], 10);
        else if (arg === '--outDir' && args[i + 1]) options.outDir = path.resolve(args[++i]);
        else if (arg === '--removals' && args[i + 1]) options.removals = parseInt(args[++i], 10);
        else if (arg === '--strategy' && args[i + 1]) options.strategy = args[++i];
    }
    return options;
}

const CALIBRATIONS = {
    "2x2": { low: { removals: 4, strategy: "weighted" }, medium: { removals: 6, strategy: "weighted" }, high: { removals: 8, strategy: "entropy" }, name: "2x2 Shi-Doku" },
    "3x2": { low: { removals: 35, strategy: "weighted" }, medium: { removals: 45, strategy: "entropy" }, high: { removals: 53, strategy: "entropy" }, name: "3x2 Classic Sudoku" },
    "4x2": { low: { removals: 110, strategy: "weighted" }, medium: { removals: 135, strategy: "entropy" }, high: { removals: 155, strategy: "entropy" }, name: "4x2 Hexadecimal Sudoku" },
    "2x3": { low: { removals: 240, strategy: "weighted" }, medium: { removals: 300, strategy: "entropy" }, high: { removals: 360, strategy: "tight" }, name: "2x3 3D Hyper-Cube" }
};

function main() {
    const opts = parseArgs();
    const [base, dim] = opts.preset.split('x').map(Number);

    if (!base || !dim) {
        console.error(`Error: Invalid preset format "${opts.preset}". Expected format like "3x2" or "2x3".`);
        process.exit(1);
    }

    const config = CALIBRATIONS[opts.preset] || CALIBRATIONS["3x2"];
    let removals = opts.removals;
    let strategy = opts.strategy;

    if (opts.difficulty === 'max') {
        removals = -1;
        strategy = strategy || 'entropy';
    } else if (removals === undefined) {
        const cal = config[opts.difficulty] || config.medium;
        removals = cal.removals;
        strategy = strategy || cal.strategy;
    }

    if (!fs.existsSync(opts.outDir)) {
        fs.mkdirSync(opts.outDir, { recursive: true });
    }

    console.log(`✨ Generating ${opts.count} puzzle(s) [Preset: ${opts.preset}, Base: ${base}, Dim: ${dim}, Difficulty: ${opts.difficulty}, Removals: ${removals}]...`);

    for (let i = 0; i < opts.count; i++) {
        const puzzleName = opts.name || `${config.name} (${opts.difficulty.toUpperCase()})`;
        const startTime = Date.now();

        const puzzle = generatePuzzle({
            base,
            dim,
            name: puzzleName,
            removals,
            strategy,
            difficulty: opts.difficulty
        }, (status) => console.log(`   [${i + 1}/${opts.count}] ${status}`));

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const fileName = `cli_${opts.preset}_${opts.difficulty}_${puzzle.id}.json`;
        const filePath = path.join(opts.outDir, fileName);

        fs.writeFileSync(filePath, JSON.stringify(puzzle, null, 2), 'utf-8');
        console.log(`✅ Saved puzzle #${i + 1} to ${filePath} (${elapsed}s)`);
    }
}

main();
