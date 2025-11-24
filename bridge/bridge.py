import asyncio
import json
import os
import subprocess
import sys
import venv

# Configuration
HOST = "localhost"
PORT = 8000
WORKING_DIR = os.getcwd()
VENV_DIR = os.path.join(WORKING_DIR, ".venv")

# Determine Python Executable in venv
if sys.platform == "win32":
    VENV_PYTHON = os.path.join(VENV_DIR, "Scripts", "python.exe")
    VENV_PIP = os.path.join(VENV_DIR, "Scripts", "pip.exe")
else:
    VENV_PYTHON = os.path.join(VENV_DIR, "bin", "python")
    VENV_PIP = os.path.join(VENV_DIR, "bin", "pip")

def is_running_in_venv():
    return sys.prefix == VENV_DIR

def bootstrap():
    """Ensures venv exists, has websockets, and re-launches script inside it."""
    # 1. Create venv if missing
    if not os.path.exists(VENV_DIR):
        print(f"Creating virtual environment in {VENV_DIR}...")
        venv.create(VENV_DIR, with_pip=True)
        print("Virtual environment created.")

    # 2. Install websockets in venv if missing
    try:
        # Check if websockets is installed in the venv
        subprocess.check_call([VENV_PYTHON, "-c", "import websockets"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        print("Installing 'websockets' in virtual environment...")
        subprocess.check_call([VENV_PYTHON, "-m", "pip", "install", "websockets"])
        print("Dependencies installed.")

    # 3. Re-launch script inside venv if we are not already there
    if not is_running_in_venv():
        print(f"Switching to virtual environment...")
        # Re-execute the script with the venv python
        os.execv(VENV_PYTHON, [VENV_PYTHON] + sys.argv)

# --- Bootstrapping ---
if __name__ == "__main__":
    bootstrap()

# --- Main Application (Only runs inside venv) ---
import websockets

async def handle_connection(websocket):
    print(f"New connection from {websocket.remote_address}")
    try:
        async for message in websocket:
            data = json.loads(message)
            command = data.get("command")

            if command == "handshake":
                await websocket.send(json.dumps({"status": "connected", "version": "1.0.0"}))
                print("Handshake successful")

            elif command == "sync":
                filename = data.get("filename", "main.py")
                content = data.get("content", "")
                filepath = os.path.join(WORKING_DIR, filename)
                
                # Security check: ensure we stay within WORKING_DIR
                if not os.path.abspath(filepath).startswith(os.path.abspath(WORKING_DIR)):
                     await websocket.send(json.dumps({"error": "Access denied: Cannot write outside working directory"}))
                     continue

                with open(filepath, "w") as f:
                    f.write(content)
                
                await websocket.send(json.dumps({"status": "synced", "filename": filename}))
                print(f"Synced {filename}")

            elif command == "run":
                filename = data.get("filename", "main.py")
                filepath = os.path.join(WORKING_DIR, filename)
                
                print(f"Running {filename}...")
                await websocket.send(json.dumps({"type": "stdout", "data": f"Running {filename}...\n"}))

                try:
                    # Run the script and capture output
                    process = subprocess.Popen(
                        [sys.executable, "-u", filepath], # Use sys.executable (which is now venv python)
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        bufsize=1 # Line buffered
                    )

                    # Stream stdout
                    if process.stdout:
                        for line in process.stdout:
                            await websocket.send(json.dumps({"type": "stdout", "data": line}))
                    
                    # Stream stderr
                    if process.stderr:
                        for line in process.stderr:
                            await websocket.send(json.dumps({"type": "stderr", "data": line}))

                    return_code = process.wait()
                    await websocket.send(json.dumps({"type": "exit", "code": return_code}))
                    print(f"Finished {filename} with code {return_code}")

                except Exception as e:
                    error_msg = f"Execution failed: {str(e)}\n"
                    await websocket.send(json.dumps({"type": "stderr", "data": error_msg}))
                    print(error_msg)

            elif command == "install":
                package = data.get("package")
                if not package:
                    await websocket.send(json.dumps({"type": "stderr", "data": "Error: No package specified\n"}))
                    continue

                print(f"Installing {package}...")
                await websocket.send(json.dumps({"type": "stdout", "data": f"Installing {package}...\n"}))

                try:
                    process = subprocess.Popen(
                        [sys.executable, "-m", "pip", "install", package], # Use sys.executable
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        bufsize=1
                    )

                    if process.stdout:
                        for line in process.stdout:
                            await websocket.send(json.dumps({"type": "stdout", "data": line}))
                    
                    if process.stderr:
                        for line in process.stderr:
                            await websocket.send(json.dumps({"type": "stderr", "data": line}))

                    return_code = process.wait()
                    if return_code == 0:
                        await websocket.send(json.dumps({"type": "stdout", "data": f"Successfully installed {package}\n"}))
                    else:
                        await websocket.send(json.dumps({"type": "stderr", "data": f"Failed to install {package} (code {return_code})\n"}))
                    
                    await websocket.send(json.dumps({"type": "exit", "code": return_code}))

                except Exception as e:
                    error_msg = f"Installation failed: {str(e)}\n"
                    await websocket.send(json.dumps({"type": "stderr", "data": error_msg}))
                    print(error_msg)

    except websockets.exceptions.ConnectionClosed:
        print("Connection closed")
    except Exception as e:
        print(f"Error: {e}")

async def main():
    print(f"Starting Local Bridge on ws://{HOST}:{PORT}")
    print(f"Working Directory: {WORKING_DIR}")
    print(f"Python Executable: {sys.executable}")
    async with websockets.serve(handle_connection, HOST, PORT):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    # Bootstrap is called at top level, so we just run main here
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nStopping Local Bridge")
