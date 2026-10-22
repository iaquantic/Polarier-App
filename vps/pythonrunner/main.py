from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import sys

app = FastAPI()

class RunRequest(BaseModel):
    script: str
    args: list[str] = []

SCRIPTS_DIR = "/data/Polarier"

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/run")
def run_script(req: RunRequest):
    script_path = f"{SCRIPTS_DIR}/{req.script}"

    result = subprocess.run(
        [sys.executable, script_path, *req.args],
        capture_output=True,
        text=True,
        timeout=300  # el informe del Consejo recalcula la TABLA CA y el GLOBAL
    )

    if result.returncode != 0:
        raise HTTPException(status_code=500, detail={
            "stderr": result.stderr,
            "stdout": result.stdout
        })

    return {
        "stdout": result.stdout,
        "stderr": result.stderr
    }
