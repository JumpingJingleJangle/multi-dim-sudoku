import os
import json
from flask import Flask, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='static')
PUZZLES_DIR = os.path.join(os.path.dirname(__file__), 'puzzles')

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/puzzles')
def get_puzzles():
    summary = []
    if not os.path.exists(PUZZLES_DIR):
        return jsonify(summary)
        
    for filename in os.listdir(PUZZLES_DIR):
        if filename.endswith(".json"):
            filepath = os.path.join(PUZZLES_DIR, filename)
            try:
                with open(filepath, 'r') as f:
                    p = json.load(f)
                    # Ensure compatibility with dict or list-wrapped outputs
                    if isinstance(p, list) and len(p) > 0:
                        p = p[0]
                    summary.append({
                        "id": p.get("id"),
                        "metadata": p.get("metadata", {})
                    })
            except Exception as e:
                print(f"Failed parsing {filename}: {e}")
                pass
                
    return jsonify(summary)

@app.route('/api/puzzle/<puzzle_id>')
def get_puzzle(puzzle_id):
    safe_id = secure_filename(puzzle_id)
    if not safe_id:
        return jsonify({"error": "Invalid puzzle ID"}), 400
        
    filepath = os.path.join(PUZZLES_DIR, f"{safe_id}.json")
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r') as f:
                p = json.load(f)
                if isinstance(p, list) and len(p) > 0:
                    p = p[0]
                return jsonify(p)
        except Exception:
            return jsonify({"error": "Failed to parse puzzle file"}), 500
            
    return jsonify({"error": "Puzzle not found"}), 404

if __name__ == '__main__':
    app.run(debug=True)
