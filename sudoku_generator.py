import argparse
import sys
import os
import json
import numpy as np
import random
import uuid
import multiprocessing
from functools import partial

# Increase recursion depth profoundly to support exact cover scaling
sys.setrecursionlimit(100000)

# --- Dancing Links Algorithm X ---

class Node:
    def __init__(self, col=None):
        self.L = self
        self.R = self
        self.U = self
        self.D = self
        self.C = col
        self.row_info = None

class ColumnNode(Node):
    def __init__(self, name):
        super().__init__(self)
        self.size = 0
        self.name = name

class DLX:
    def __init__(self, col_names):
        self.h = ColumnNode("header")
        self.cols = []
        self.col_dict = {}
        
        prev = self.h
        for name in col_names:
            node = ColumnNode(name)
            self.cols.append(node)
            self.col_dict[name] = node
            node.L = prev
            prev.R = node
            prev = node
        prev.R = self.h
        self.h.L = prev

    def add_row(self, row_info, col_names_for_row):
        first = None
        for name in col_names_for_row:
            col = self.col_dict[name]
            node = Node(col)
            node.row_info = row_info
            
            # insert at bottom of column
            node.D = col
            node.U = col.U
            col.U.D = node
            col.U = node
            col.size += 1
            
            if first is None:
                first = node
            else:
                node.L = first.L
                node.R = first
                first.L.R = node
                first.L = node
        return first

    def cover(self, c):
        c.R.L = c.L
        c.L.R = c.R
        i = c.D
        while i != c:
            j = i.R
            while j != i:
                j.D.U = j.U
                j.U.D = j.D
                j.C.size -= 1
                j = j.R
            i = i.D

    def uncover(self, c):
        i = c.U
        while i != c:
            j = i.L
            while j != i:
                j.C.size += 1
                j.D.U = j
                j.U.D = j
                j = j.L
            i = i.U
        c.R.L = c
        c.L.R = c

    def search(self, solutions, max_solutions=1, randomize=True, show_progress=False, target_depth=0, randomize_depth_limit=20, print_lock=None):
        if not hasattr(self, 'nodes_visited'):
            self.nodes_visited = 0
            self.min_depth_window = float('inf')
            
        self.nodes_visited += 1
        current_depth = len(solutions)
        
        if current_depth < self.min_depth_window:
            self.min_depth_window = current_depth
            
        if show_progress and self.nodes_visited % 50_000 == 0:
            msg = f"... Shared Engine Pool: {self.nodes_visited} nodes (Local Tracker) | Worker Depth: {current_depth} / {target_depth} | Best Recent Depth: {self.min_depth_window}      \r"
            if print_lock:
                with print_lock:
                    print(msg, end='', flush=True)
            else:
                print(msg, end='', flush=True)
            self.min_depth_window = float('inf')

        if self.h.R == self.h:
            if show_progress:
                if print_lock:
                    with print_lock: print()
                else: print()
            return True
        
        c = None
        min_size = float('inf')
        
        j = self.h.R
        while j != self.h:
            if j.size < min_size:
                min_size = j.size
                c = j
                if min_size <= 1:
                    break
            j = j.R
            
        if min_size == 0:
            return False
        self.cover(c)
        
        r = c.D
        rows = []
        while r != c:
            rows.append(r)
            r = r.D
            
        if randomize and len(solutions) < randomize_depth_limit:
            random.shuffle(rows)
            
        for r in rows:
            solutions.append(r.row_info)
            j = r.R
            while j != r:
                self.cover(j.C)
                j = j.R
                
            if self.search(solutions, max_solutions, randomize, show_progress, target_depth, randomize_depth_limit, print_lock):
                return True
                
            j = r.L
            while j != r:
                self.uncover(j.C)
                j = j.L
            solutions.pop()
            
        self.uncover(c)
        return False

    def gather_seeds(self, solutions, seed_depth, seeds_list):
        if len(solutions) >= seed_depth:
            seeds_list.append([r.row_info for r in solutions])
            return False
            
        c = None
        min_size = float('inf')
        
        j = self.h.R
        while j != self.h:
            if j.size < min_size:
                min_size = j.size
                c = j
                if min_size <= 1:
                    break
            j = j.R
            
        if min_size == 0 or not c:
            return False
        self.cover(c)
        
        r = c.D
        rows = []
        while r != c:
            rows.append(r)
            r = r.D
            
        random.shuffle(rows)
            
        for r in rows:
            solutions.append(r)
            j = r.R
            while j != r:
                self.cover(j.C)
                j = j.R
                
            self.gather_seeds(solutions, seed_depth, seeds_list)
                
            j = r.L
            while j != r:
                self.uncover(j.C)
                j = j.L
            solutions.pop()
            
        self.uncover(c)
        return False

# --- Algebraic Generation By-pass ---

def generate_algebraic_seed_3d_base2():
    """Generates the base 3-dimensional 8x8x8 exact collision-free Sudoku field natively via XOR matrix."""
    grid = np.zeros((8, 8, 8), dtype=int)
    
    M2 = [0, 2, 4, 6, 3, 1, 7, 5]
    M4 = [0, 4, 3, 7, 6, 2, 5, 1]
    
    for z in range(8):
        for y in range(8):
            for x in range(8):
                val = (x ^ M2[y] ^ M4[z]) + 1
                grid[z, y, x] = val
                
    return grid

def shuffle_3d_base2_grid(grid):
    """Permutes coordinates securely mapping permutations natively exactly simulating variant generations natively"""
    # 1. Symbol Relabeling
    symbols = list(range(1, 9))
    random.shuffle(symbols)
    sym_map = {i: symbols[i-1] for i in range(1, 9)}
    for z in range(8):
        for y in range(8):
            for x in range(8):
                grid[z, y, x] = sym_map[grid[z, y, x]]
                
    # 2. Intra-box line swapping dynamically exactly natively
    for axis in range(3):
        for block in range(4):
            i1, i2 = block * 2, block * 2 + 1
            if random.random() > 0.5:
                if axis == 0: grid[:, :, [i1, i2]] = grid[:, :, [i2, i1]]
                elif axis == 1: grid[:, [i1, i2], :] = grid[:, [i2, i1], :]
                elif axis == 2: grid[[i1, i2], :, :] = grid[[i2, i1], :, :]
                    
    # 3. Inter-box block swapping safely globally natively
    for axis in range(3):
        blocks = [0, 1, 2, 3]
        random.shuffle(blocks)
        new_indices = []
        for b in blocks:
            new_indices.extend([b * 2, b * 2 + 1])
            
        if axis == 0: grid = grid[:, :, new_indices]
        elif axis == 1: grid = grid[:, new_indices, :]
        elif axis == 2: grid = grid[new_indices, :, :]
            
    # 4. Axis Dimensional Transposition
    axes = [0, 1, 2]
    random.shuffle(axes)
    grid = np.transpose(grid, axes)
    
    return grid

# --- Matrix Builder ---

def generate_exact_cover_matrix(base, dimension):
    N = base ** dimension
    col_names = []
    
    def iter_coords(d, size_bound):
        return np.ndindex(tuple([size_bound]*d))
        
    for coords in iter_coords(dimension, N):
        col_names.append(f"Cell_{coords}")
        
    for axis in range(dimension):
        for fixed_coords in iter_coords(dimension - 1, N):
            for v in range(1, N+1):
                col_names.append(f"Line_A{axis}_{fixed_coords}_V{v}")
                
    num_boxes_per_axis = N // base
    for box_coords in iter_coords(dimension, num_boxes_per_axis):
        for v in range(1, N+1):
            col_names.append(f"Box_{box_coords}_V{v}")
            
    dlx = DLX(col_names)
    row_map = {}
    
    for coords in iter_coords(dimension, N):
        for v in range(1, N+1):
            row_cols = []
            row_cols.append(f"Cell_{coords}")
            
            for axis in range(dimension):
                fixed = list(coords)
                del fixed[axis]
                row_cols.append(f"Line_A{axis}_{tuple(fixed)}_V{v}")
                
            box_coords = tuple(c // base for c in coords)
            row_cols.append(f"Box_{box_coords}_V{v}")
            
            row_info = {"coords": coords, "val": v}
            node = dlx.add_row(row_info, row_cols)
            row_map[(tuple(coords), v)] = node
            
    return dlx, N, row_map

# --- Multiprocessing Framework ---

def worker_process(seed_data, base, dimension, randomize_limit, target_depth, show_progress, print_lock):
    try:
        dlx, _, row_map = generate_exact_cover_matrix(base, dimension)
        solutions = []
        
        # Lock in seed payload natively 
        for r_info in seed_data:
            coords = tuple(r_info["coords"])
            v = r_info["val"]
            row_node = row_map[(coords, v)]
            
            solutions.append(r_info)
            dlx.cover(row_node.C)
            j = row_node.R
            while j != row_node:
                dlx.cover(j.C)
                j = j.R
                
        # Resolve recursively spanning independent domain sequence
        success = dlx.search(solutions, max_solutions=1, randomize=True, show_progress=show_progress, target_depth=target_depth, randomize_depth_limit=randomize_limit, print_lock=print_lock)
        
        if success:
            return solutions
        return None
    except Exception:
        return None

# --- CLI & Runner ---

def generate_sudoku(base, dimension, output_file=None, force=False, progress=False, randomize_limit=None, cores=1, split_depth=3):
    puzzle_id = f"gen-{uuid.uuid4().hex[:8]}"
    
    if not output_file:
        output_file = f"puzzles/{puzzle_id}.json"
        
    if not os.path.dirname(output_file):
        output_file = os.path.join("puzzles", output_file)
        
    os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)

    if os.path.exists(output_file) and not force:
        print(f"ERROR: Output file '{output_file}' already exists. Use --force or -f to overwrite.", file=sys.stderr)
        sys.exit(1)
        
    N = base ** dimension
    solutions = []

    if base == 2 and dimension == 3:
        print("Intercepted Base 2, Dimension 3! Generating Algebraic Mathematical Matrix internally natively...")
        algebraic_grid = generate_algebraic_seed_3d_base2()
        algebraic_grid = shuffle_3d_base2_grid(algebraic_grid)
        
        for z in range(8):
            for y in range(8):
                for x in range(8):
                    solutions.append({"coords": (z, y, x), "val": int(algebraic_grid[z, y, x])})
        success = True
    else:
        print(f"Building Exact Cover Tensor Matrix for Base {base}, Dimension {dimension}...")
        dlx, _, _ = generate_exact_cover_matrix(base, dimension)
        
        target_depth = N ** dimension
        depth_limit = float('inf') if randomize_limit is None else randomize_limit

        if cores > 1:
            print(f"Instantiating Master Thread (Cores: {cores}, Split Depth: {split_depth}). Generating Seeds...")
            seeds_list = []
            dlx.gather_seeds([], split_depth, seeds_list)
            print(f"Harvested {len(seeds_list)} local sub-tasks! Offloading into CPU Pool Pipeline...")

            random.shuffle(seeds_list)
            
            m = multiprocessing.Manager()
            print_lock = m.Lock()
            
            worker_fn = partial(worker_process, base=base, dimension=dimension, randomize_limit=depth_limit, target_depth=target_depth, show_progress=progress, print_lock=print_lock)
            
            pool = multiprocessing.Pool(processes=cores)
            final_solution = None
            
            try:
                for result in pool.imap_unordered(worker_fn, seeds_list):
                    if result is not None:
                        final_solution = result
                        pool.terminate()
                        break
            finally:
                pool.close()
                pool.join()
                
            if final_solution is None:
                success = False
            else:
                solutions = final_solution
                success = True
                if progress: print() # uncouple final line
        else:
            print("Initiating Algorithm X Dancing Links engine sequentially via randomized MRV...")
            success = dlx.search(solutions, max_solutions=1, randomize=True, show_progress=progress, target_depth=target_depth, randomize_depth_limit=depth_limit)
    
    if not success:
        print("ERROR: Could not find any valid combinatorial match for these parameters.", file=sys.stderr)
        sys.exit(1)
        
    print(f"Success! Constructing mathematical mesh verification...")
    
    grid = np.zeros(tuple([N]*dimension), dtype=int)
    initial_state = []
    
    for row in solutions:
        coords = tuple(row["coords"])
        v = row["val"]
        grid[coords] = v
        
        cell_data = {}
        if dimension == 2:
            cell_data["y"] = int(coords[0])
            cell_data["x"] = int(coords[1])
        elif dimension == 3:
            cell_data["z"] = int(coords[0])
            cell_data["y"] = int(coords[1])
            cell_data["x"] = int(coords[2])
        else:
            for i, c in enumerate(coords):
                cell_data[f"dim_{i}"] = int(c)
                
        cell_data["value"] = int(v) - 1 if base == 4 else int(v)
        initial_state.append(cell_data)

    puzzle = {
        "id": puzzle_id,
        "metadata": {
            "name": f"Generated {dimension}D Base {base} (Full)",
            "difficulty": "Completed",
            "base": base,
            "dimension": dimension,
            "author": "DLX Stochastic Generator"
        },
        "initial_state": initial_state
    }
    
    with open(output_file, 'w') as f:
        json.dump([puzzle], f, indent=2)
        
    print(f"Configuration locked and structured securely to isolated JSON: '{output_file}'.")
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
    parser = argparse.ArgumentParser(description="Generalized Sudoku Exact Cover Generator Tool")
    parser.add_argument("--base", type=int, required=True, help="Base architecture scalar of the Sudoku (e.g. 2, 3)")
    parser.add_argument("--dim", type=int, required=True, help="Number of operational spatial dimensions (e.g. 2, 3)")
    parser.add_argument("--output", "-o", type=str, required=False, help="Optional output JSON path. Defaults to puzzles/<id>.json")
    parser.add_argument("--force", "-f", action="store_true", help="Circumvent overwrite warnings and replace existing file")
    parser.add_argument("--progress", "-p", action="store_true", help="Display real-time Dancing Links engine node tracking via carriage returning IO")
    parser.add_argument("--randomize-limit", "-r", type=int, default=None, help="The node depth limit where stochastic shuffling halts. Defaults to no optimization (infinite).")
    parser.add_argument("--cores", "-c", type=int, default=multiprocessing.cpu_count()-1, help="Number of concurrent worker threads. Defaults to total logical CPU count.")
    parser.add_argument("--split-depth", "-s", type=int, default=3, help="Starting logic depth to split into parallel thread workers. Default: 3.")
    
    args = parser.parse_args()
    
    generate_sudoku(args.base, args.dim, args.output, args.force, args.progress, args.randomize_limit, args.cores, args.split_depth)
