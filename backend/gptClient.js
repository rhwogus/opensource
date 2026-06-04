const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const BACKEND_DIR = __dirname;
const PROJECT_ROOT = path.join(BACKEND_DIR, "..");
const PYTHON_COMMANDS = process.platform === "win32" ? ["python", "py"] : ["python3", "python"];

function getPythonCandidates() {
    const candidates = [
        process.env.PYTHON_PATH,
        path.join(PROJECT_ROOT, ".venv", "Scripts", "python.exe"),
        path.join(PROJECT_ROOT, ".venv", "bin", "python"),
        path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe"),
        path.join(BACKEND_DIR, ".venv", "bin", "python"),
        ...PYTHON_COMMANDS
    ];

    return candidates.filter(Boolean).filter((candidate, index, list) => {
        if (list.indexOf(candidate) !== index) return false;
        return path.isAbsolute(candidate) ? fs.existsSync(candidate) : true;
    });
}

function runPython(pythonBin, args) {
    return new Promise((resolve, reject) => {
        execFile(
            pythonBin,
            args,
            { cwd: BACKEND_DIR, maxBuffer: 10 * 1024 * 1024, env: process.env },
            (error, stdout, stderr) => {
                if (error) {
                    error.stderr = stderr;
                    return reject(error);
                }
                resolve(stdout);
            }
        );
    });
}

function isMissingPython(error) {
    return error.code === "ENOENT";
}

async function runWithAvailablePython(args) {
    const candidates = getPythonCandidates();
    let lastError = null;

    for (const pythonBin of candidates) {
        try {
            return await runPython(pythonBin, args);
        } catch (error) {
            lastError = error;
            if (!isMissingPython(error)) {
                throw error;
            }
        }
    }

    throw lastError || new Error("Python executable was not found.");
}

async function runGpt(command, arg = "") {
    let stdout = "";

    try {
        const args = ["-m", "gpt.bridge", command, arg];
        stdout = await runWithAvailablePython(args);
        return JSON.parse(stdout);
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`GPT JSON parse failed: ${stdout}`);
        }

        throw new Error(error.stderr || error.message || "GPT process failed.");
    }
}

function estimateExpiry(name, baseDate = "") {
    return runGpt("expiry", JSON.stringify({ name, baseDate }));
}

function recommendRecipes(ingredientNames) {
    return runGpt("recipes", JSON.stringify(ingredientNames));
}

module.exports = {
    estimateExpiry,
    recommendRecipes
};
