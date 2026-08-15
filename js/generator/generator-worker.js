import { generateFullPuzzle, ConstraintSolver, processDigging, generatePuzzle } from './generator-core.js';

if (typeof self !== 'undefined') {
    self.onmessage = function (e) {
        const { base, dim, name, removals, strategy, difficulty, verbose, logIntervalMs } = e.data;
        try {
            const playablePuzzle = generatePuzzle(
                { base, dim, name, removals, strategy, difficulty, verbose, logIntervalMs },
                (msg) => self.postMessage({ type: 'STATUS', message: msg }),
                (partialPuzzle, stats) => self.postMessage({
                    type: 'PROGRESS',
                    message: `Peeled ${stats.removedHintCount} negative hints...`,
                    partialPuzzle,
                    stats
                })
            );
            self.postMessage({ type: 'RESULT', status: 'SUCCESS', puzzle: playablePuzzle });
        } catch (err) {
            self.postMessage({ type: 'RESULT', status: 'ERROR', message: err.message });
        }
    };
}

export { generateFullPuzzle, ConstraintSolver, processDigging, generatePuzzle };
