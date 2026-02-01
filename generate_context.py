import os

# --- CONFIGURATION ---
# 1. Output file name
OUTPUT_FILE = 'context_for_gemini.txt'

# 2. File extensions to include (Add or remove as needed)
ALLOWED_EXTENSIONS = {
    '.html', '.css', '.js', '.jsx', '.ts', '.tsx',  # Web
    '.py', '.json', '.md', '.sql'                   # Backend/Docs
}

# 3. Directories to strictly IGNORE (Prevents massive files)
IGNORE_DIRS = {
    'node_modules', '.git', '__pycache__', 'dist', 'build', 'venv', 'env', '.next'
}

# 4. Specific files to IGNORE
IGNORE_FILES = {
    'package-lock.json', 'yarn.lock', '.DS_Store', OUTPUT_FILE
}

def get_file_content(filepath):
    """Reads a file and returns its content as a string."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"[Error reading file: {e}]"

def generate_context():
    """Scans directories and writes content to the output file."""
    project_root = os.getcwd()
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as outfile:
        # Write a header
        outfile.write(f"# PROJECT CONTEXT EXPORT\n")
        outfile.write(f"# Root: {project_root}\n\n")

        for root, dirs, files in os.walk(project_root):
            # Modify 'dirs' in-place to skip ignored directories
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            
            for file in files:
                if file in IGNORE_FILES:
                    continue
                
                _, ext = os.path.splitext(file)
                if ext.lower() in ALLOWED_EXTENSIONS:
                    filepath = os.path.join(root, file)
                    rel_path = os.path.relpath(filepath, project_root)
                    
                    print(f"Adding: {rel_path}")
                    
                    # Formatting specifically designed for AI readability
                    outfile.write(f"{'-'*40}\n")
                    outfile.write(f"FILE: {rel_path}\n")
                    outfile.write(f"{'-'*40}\n")
                    outfile.write(get_file_content(filepath))
                    outfile.write("\n\n")

    print(f"\nSuccess! Context generated at: {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_context()