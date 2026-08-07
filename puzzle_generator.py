import argparse
import itertools
import sys
import os
import json
import numpy as np
import random
import copy
import uuid

class ConstraintSolver:
    def __init__(self, state, base, dimension):
        self.state = np.copy(state)
        self.base = base
        self.dimension = dimension
        self.N = base ** dimension

        # Precompute units and peers natively for each coordinate
        self.squares = list(np.ndindex(tuple([self.N] * self.dimension)))
        self.units = {}
        self.peers = {}

        self.all_lines = set()
        self.all_boxes = set()

        for s in self.squares:
            s_lines = self.get_orthogonal_lines(s)
            s_box = [self.get_box_coords(s)]
            self.units[s] = s_lines + s_box

            for line in s_lines:
                self.all_lines.add(tuple(sorted(line)))
            self.all_boxes.add(tuple(sorted(s_box[0])))

            s_peers = set()
            for u in self.units[s]:
                for sq in u:
                    if sq != s:
                        s_peers.add(sq)
            self.peers[s] = s_peers

    def get_orthogonal_lines(self, coords):
        """Returns lists of coordinates representing all intersecting abstract 'lines' (axes) for a coordinate."""
        lines = []
        for axis in range(self.dimension):
            line_coords = []
            for v in range(self.N):
                c = list(coords)
                c[axis] = v
                line_coords.append(tuple(c))
            lines.append(line_coords)
        return lines

    def get_box_coords(self, coords):
        """Returns a list of coordinates representing the enclosing Generalized Box."""
        box_origin = [ (c // self.base) * self.base for c in coords ]

        box_coords = []
        def iter_box(d, current):
            if d == self.dimension:
                box_coords.append(tuple(current))
                return
            for v in range(self.base):
                iter_box(d + 1, current + [box_origin[d] + v])

        iter_box(0, [])
        return box_coords

    def technique_intersection_removal(self, values, queue):
        """Test 5 & 6: Box/Line reductions generically mapped natively."""
        for box in self.all_boxes:
            for line in self.all_lines:
                intersection = set(box).intersection(line)
                if len(intersection) < 2: 
                    continue 

                for d in range(1, self.N + 1):
                    # Test 5: Check if 'd' in Box is constrained dynamically entirely exactly to the intersecting Line
                    box_d_cells = [s for s in box if d in values[s]]
                    if box_d_cells and all(s in line for s in box_d_cells):
                        progress = False
                        for s in line:
                            if s not in box and d in values[s]:
                                queue.append(('eliminate', s, d))
                                progress = True
                        if progress: return True

                    # Test 6: Check if 'd' in Line is constrained functionally entirely into Box logically
                    line_d_cells = [s for s in line if d in values[s]]
                    if line_d_cells and all(s in box for s in line_d_cells):
                        progress = False
                        for s in box:
                            if s not in line and d in values[s]:
                                queue.append(('eliminate', s, d))
                                progress = True
                        if progress: return True
        return False

    def technique_naked_subsets(self, values, queue, k):
        """Test 2 & 4: Naked Pairs, Triples, Quads computationally derived functionally"""
        for unit in self.all_lines.union(self.all_boxes):
            unsolved = [s for s in unit if len(values[s]) > 1]
            if len(unsolved) < k: continue

            for subset in itertools.combinations(unsolved, k):
                candidates = set()
                for s in subset: candidates.update(values[s])

                if len(candidates) == k:
                    subset_set = set(subset)
                    progress = False
                    for s in unit:
                        if s not in subset_set:
                            for d in candidates:
                                if d in values[s]:
                                    queue.append(('eliminate', s, d))
                                    progress = True
                    if progress: return True
        return False

    def technique_hidden_subsets(self, values, queue, k):
        """Test 3 & 4: Hidden Pairs, Triples, Quads"""
        for unit in self.all_lines.union(self.all_boxes):
            candidate_cells = {}
            for d in range(1, self.N + 1):
                cells = [s for s in unit if d in values[s]]
                if 1 < len(cells) <= self.N - 1:
                    candidate_cells[d] = set(cells)

            if len(candidate_cells) < k: continue

            for d_subset in itertools.combinations(candidate_cells.keys(), k):
                cells_union = set()
                for d in d_subset: cells_union.update(candidate_cells[d])

                if len(cells_union) == k:
                    progress = False
                    d_subset_set = set(d_subset)
                    for s in cells_union:
                        other_candidates = values[s] - d_subset_set
                        for d in other_candidates:
                            queue.append(('eliminate', s, d))
                            progress = True
                    if progress: return True
        return False

    def solve(self):
        """Builds constraint framework domains and executes the work queue globally returning True if perfectly deducible naturally."""
        # Initialize domains: all candidates for all open squares dynamically using python sets
        values = {s: set(range(1, self.N + 1)) for s in self.squares}
        
        # Queue items are tuples: ('eliminate', s, d)
        queue = []

        def assign(s, d):
            # To assign d, eliminate all other values from s
            other_values = values[s] - {d}
            for d2 in other_values:
                queue.append(('eliminate', s, d2))

        # Initial assignment from the given board states structurally mapping given cells
        for s in self.squares:
            val = self.state[s]
            if val != 0:
                assign(s, val)

        # Process the deduction queue safely scaling gracefully
        while True:
            while queue:
                action, s, d = queue.pop(0)

                if action == 'eliminate':
                    if d not in values[s]:
                        continue  # Already eliminated

                    values[s].remove(d)

                    # Rule 1 Contradiction: If there are no options left
                    if len(values[s]) == 0:
                        return False, None

                    # Rule 1 Naked Single: If a square is reduced to one value d2, eliminate d2 from its peers natively
                    elif len(values[s]) == 1:
                        d2 = next(iter(values[s]))
                        for peer in self.peers[s]:
                            queue.append(('eliminate', peer, d2))

                    # Rule 2 Hidden Single: If a unit is reduced to only one possible place for d, assign it
                    for u in self.units[s]:
                        dplaces = [s2 for s2 in u if d in values[s2]]

                        if len(dplaces) == 0:
                            return False, None # Contradiction detected during constraint propagation
                        elif len(dplaces) == 1:
                            # Optimization/safety: Only queue an assign if dplaces[0] doesn't ALREADY have it firmly assigned
                            # This prevents redundant assignments during continuous eliminations
                            if len(values[dplaces[0]]) > 1:
                                assign(dplaces[0], d)

            # Execution logic extends into human advanced evaluation dynamically natively when queue starves
            progress = False
            max_k = min(4, self.N // 2)

            if self.technique_intersection_removal(values, queue):
                progress = True

            if not progress:
                for k in range(2, max_k + 1):
                    if self.technique_naked_subsets(values, queue, k):
                        progress = True
                        break
                    if self.technique_hidden_subsets(values, queue, k):
                        progress = True
                        break
            
            if not progress:
                break

        # Final validity check natively returning true if all squares uniquely determined
        for s in self.squares:
            if len(values[s]) != 1:
                return False, None

        # Sync solved states recursively structurally back reflecting the derived exact state
        for s in self.squares:
            self.state[s] = next(iter(values[s]))

        return True, values

    def sync_singles(self):
        """Processes ONLY the singles propagation queue and syncs any determined values back to self.state recursively. Returns set of modified coords."""
        # Initialize domains mapping existing constants
        values = {s: set(range(1, self.N + 1)) for s in self.squares}
        queue = []
        filled_coords = set()

        def assign(s, d):
            other_values = values[s] - {d}
            for d2 in other_values:
                queue.append(('eliminate', s, d2))

        for s in self.squares:
            val = self.state[s]
            if val != 0:
                assign(s, val)

        # Execute Rule 1 & 2 propagation iteratively
        while queue:
            action, s, d = queue.pop(0)

            if action == 'eliminate':
                if d not in values[s]:
                    continue  # Already eliminated

                values[s].remove(d)

                if len(values[s]) == 0:
                    return False, set() # Logic contradiction

                # Rule 1 Naked Single
                elif len(values[s]) == 1:
                    d2 = next(iter(values[s]))
                    for peer in self.peers[s]:
                        queue.append(('eliminate', peer, d2))

                # Rule 2 Hidden Single
                for u in self.units[s]:
                    dplaces = [s2 for s2 in u if d in values[s2]]

                    if len(dplaces) == 0:
                        return False, set()
                    elif len(dplaces) == 1:
                        if len(values[dplaces[0]]) > 1:
                            assign(dplaces[0], d)

        # Sync all cells reduced to exactly one candidate back to the state grid
        for s in self.squares:
            if len(values[s]) == 1 and self.state[s] == 0:
                self.state[s] = next(iter(values[s]))
                filled_coords.add(s)

        return True, filled_coords

# --- Generator Builder Logic ---

def process_digging(input_file, output_file, target_removals, post_fill=False, tight=False, entropy_based=False, entropy_candidates=5):
    with open(input_file, 'r') as f:
        data = json.load(f)
        
    source_puzzle = data[0] if isinstance(data, list) else data
    metadata = source_puzzle["metadata"]
    base = metadata["base"]
    dimension = metadata["dimension"]
    N = base ** dimension
    
    # Extract native structural baseline matrix mathematically
    master_grid = np.zeros(tuple([N]*dimension), dtype=int)
    for cell in source_puzzle["initial_state"]:
        # Mapping generic dimensions linearly contextually
        coords = []
        if dimension == 2:
            coords = [cell.get("y", 0), cell.get("x", 0)]
        elif dimension == 3:
            coords = [cell.get("z", 0), cell.get("y", 0), cell.get("x", 0)]
        else:
            for i in range(dimension):
                coords.append(cell.get(f"dim_{i}", 0))
        master_grid[tuple(coords)] = cell["value"]
        
    state_grid = np.copy(master_grid)
    
    # Pre-compute peers map using a temporary solver instance
    solver_init = ConstraintSolver(master_grid, base, dimension)
    peers_map = solver_init.peers
    
    # Prepare dig coordinates globally mapping inherently 
    potential_coords = list(np.ndindex(master_grid.shape))
    empty_peer_counts = {c: 0 for c in potential_coords}
    
    removed_count = 0
    attempts = 0
    
    print(f"Executing Top-Down Weighted Dig Generator...")
    print(f"Targeting {target_removals} isolated coordinate erasions sequentially internally!")
    
    while potential_coords and removed_count < target_removals:
        # Calculate weights based on already empty neighbors
        power = 2 if tight else 1
        weights = [(1 + empty_peer_counts[c]) ** power for c in potential_coords]
        
        # Sampling candidates for evaluation
        candidates = []
        if entropy_based and len(potential_coords) > 1:
            num_to_sample = min(len(potential_coords), entropy_candidates)
            curr_available = list(potential_coords)
            curr_weights = list(weights)
            for _ in range(num_to_sample):
                choice = random.choices(curr_available, weights=curr_weights, k=1)[0]
                idx = curr_available.index(choice)
                candidates.append(choice)
                curr_available.pop(idx)
                curr_weights.pop(idx)
        else:
            candidates = [random.choices(potential_coords, weights=weights, k=1)[0]]

        best_c = None
        max_entropy = -1.0

        for c_test in candidates:
            orig_val = state_grid[c_test]
            state_grid[c_test] = 0
            
            # Evaluate logically strictly simulating structurally human constraints
            solver = ConstraintSolver(state_grid, base, dimension)
            solvable, values_map = solver.solve()
            
            if solvable:
                # Measure entropy gain in peers only (requested)
                entropy_sum = sum(np.log2(len(values_map[p])) for p in peers_map[c_test])
                if entropy_sum > max_entropy:
                    max_entropy = entropy_sum
                    best_c = c_test
            
            # Revert for next candidate test
            state_grid[c_test] = orig_val

        if best_c:
            c = best_c
            state_grid[c] = 0
            potential_coords.remove(c)
            removed_count += 1
            # Update neighbor counts for weighting future selections
            for p in peers_map[c]:
                empty_peer_counts[p] += 1
            print(f"... Verified Extracted Valid Deletion: {removed_count}/{target_removals} (Scanned: {attempts})      ", end='\r', flush=True)
        
        attempts += 1
            
    print()
    
    if post_fill:
        print("Executing Post-Fill Singles Hardening (Migrating easy blanks to harder constraints)...")
        hardening_attempts = 0
        max_hardening = 2 * removed_count
        
        while hardening_attempts < max_hardening:
            # 1. Identity easy blanks currently solveable via Rule 1/2
            h_temp_solver = ConstraintSolver(state_grid, base, dimension)
            _, filled_easy = h_temp_solver.sync_singles()
            
            if not filled_easy:
                break
            
            # 2. Pick an easy blank to 'harden' (restore as clue)
            target_to_fill = random.choice(list(filled_easy))
            state_grid[target_to_fill] = master_grid[target_to_fill]
            
            # Restore to available pool and update neighbor density
            potential_coords.append(target_to_fill)
            for p in peers_map[target_to_fill]:
                empty_peer_counts[p] -= 1
            
            # 3. Pick a new candidate clue to remove from the potential pool
            hardening_attempts += 1
            h_power = 2 if tight else 1
            h_weights = [(1 + empty_peer_counts[c]) ** h_power for c in potential_coords]
            
            h_candidates = []
            if entropy_based and len(potential_coords) > 1:
                h_num = min(len(potential_coords), entropy_candidates)
                h_avail = list(potential_coords)
                h_curr_w = list(h_weights)
                for _ in range(h_num):
                    choice = random.choices(h_avail, weights=h_curr_w, k=1)[0]
                    idx = h_avail.index(choice)
                    h_candidates.append(choice)
                    h_avail.pop(idx)
                    h_curr_w.pop(idx)
            else:
                h_candidates = [random.choices(potential_coords, weights=h_weights, k=1)[0]]

            h_best_c = None
            h_max_entropy = -1.0

            for h_c_test in h_candidates:
                # Hypothetically remove the new clue
                h_orig_val = state_grid[h_c_test]
                state_grid[h_c_test] = 0
                
                # 4. Verify advanced solvability remains intact
                h_solver = ConstraintSolver(state_grid, base, dimension)
                h_solvable, h_values_map = h_solver.solve()
                
                if h_solvable:
                    h_entropy = sum(np.log2(len(h_values_map[p])) for p in peers_map[h_c_test])
                    if h_entropy > h_max_entropy:
                        h_max_entropy = h_entropy
                        h_best_c = h_c_test
                
                state_grid[h_c_test] = h_orig_val

            if h_best_c:
                new_c = h_best_c
                state_grid[new_c] = 0
                # Success: swapped easy blank for a potentially harder blank
                potential_coords.remove(new_c)
                for p in peers_map[new_c]:
                    empty_peer_counts[p] += 1
                print(f"... Hardening Pass: {hardening_attempts}/{max_hardening} (Swapped {target_to_fill} -> {new_c})      ", end='\r', flush=True)
            else:
                # Failure to find a valid swap among candidates: restore original easy blank
                state_grid[target_to_fill] = 0
                potential_coords.remove(target_to_fill)
                for p in peers_map[target_to_fill]:
                    empty_peer_counts[p] += 1

    final_blanks = np.count_nonzero(state_grid == 0)
    print(f"Generator Halted structurally! Total True Erasures (Blanks): {final_blanks}")
    
    # Save generic mathematically structurally playable dictionary natively 
    playable_initial_state = []
    
    for c in np.ndindex(state_grid.shape):
        val = state_grid[c]
        if val != 0: # Only store natively populated givens 
            cell_data = {}
            if dimension == 2:
                cell_data["y"] = int(c[0])
                cell_data["x"] = int(c[1])
            elif dimension == 3:
                cell_data["z"] = int(c[0])
                cell_data["y"] = int(c[1])
                cell_data["x"] = int(c[2])
            else:
                for i in range(dimension):
                    cell_data[f"dim_{i}"] = int(c[i])
            cell_data["value"] = int(val)
            playable_initial_state.append(cell_data)
            
    # Copy metadata locally securely masking structurally updated tags globally  
    new_metadata = copy.deepcopy(metadata)
    new_metadata["difficulty"] = "Generated-Playable"
    new_metadata["name"] = f"Playable {dimension}D Base {base} (Dug)"
    
    puzzle_id = f"play-{uuid.uuid4().hex[:8]}"
    new_puzzle = {
        "id": puzzle_id,
        "metadata": new_metadata,
        "initial_state": playable_initial_state,
        "master_solution": source_puzzle["initial_state"]  # Natively saving global exact solutions mapping natively 
    }
    
    if not output_file:
         output_file = f"puzzles/{puzzle_id}.json"
    if not os.path.dirname(output_file):
         output_file = os.path.join("puzzles", output_file)
         
    with open(output_file, 'w') as f:
        json.dump([new_puzzle], f, indent=2)
        
    print(f"Dynamically generated structural solvable permutation safely structurally natively saved -> {output_file}")
    update_puzzles_index()

def update_puzzles_index(puzzles_dir='puzzles'):
    if not os.path.exists(puzzles_dir):
        return
    summary = []
    for filename in sorted(os.listdir(puzzles_dir)):
        if filename.endswith('.json') and filename != 'puzzles.json':
            filepath = os.path.join(puzzles_dir, filename)
            try:
                with open(filepath, 'r') as f:
                    p = json.load(f)
                    if isinstance(p, list) and len(p) > 0:
                        p = p[0]
                    summary.append({
                        'id': p.get('id', filename.replace('.json', '')),
                        'filename': filename,
                        'metadata': p.get('metadata', {})
                    })
            except Exception:
                pass
    index_path = os.path.join(puzzles_dir, 'puzzles.json')
    with open(index_path, 'w') as f:
        json.dump(summary, f, indent=2)



if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Human Playable Sudoku Digging Pipeline Structure Generator")
    parser.add_argument("--input", "-i", type=str, required=True, help="Completed Generator Json Target")
    parser.add_argument("--output", "-o", type=str, help="Save resulting playable configuration directly mapped")
    parser.add_argument("--removals", "-r", type=int, default=40, help="Maximum natively targeted node erasions globally (clamped natively structurally dynamically based on exact limit natively)")
    parser.add_argument("--post-fill", action="store_true", help="Recursively fill all Naked/Hidden Singles cells after generation is complete.")
    parser.add_argument("--tight", action="store_true", help="Square the selection weights to increase clustering density.")
    parser.add_argument("--entropy-based", action="store_true", help="Enable entropy-maximization strategy for digging.")
    parser.add_argument("--entropy-candidates", type=int, default=5, help="Number of samples to evaluate for entropy gain per iteration.")
    
    args = parser.parse_args()
    process_digging(args.input, args.output, args.removals, post_fill=args.post_fill, tight=args.tight, 
                    entropy_based=args.entropy_based, entropy_candidates=args.entropy_candidates)
