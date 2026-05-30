const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const BACKEND_DIR = __dirname;
const VENV_PYTHON = path.join(BACKEND_DIR, "..", ".venv", "bin", "python");

function resolvePython() {
    if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
        return process.env.PYTHON_PATH;
    }
    if (fs.existsSync(VENV_PYTHON)) {
        return VENV_PYTHON;
    }
    return "python3";
}

function runGpt(command, arg = "") {
    return new Promise((resolve, reject) => {
        const pythonBin = resolvePython();
        const args = ["-m", "gpt.bridge", command, arg];

        execFile(
            pythonBin,
            args,
            { cwd: BACKEND_DIR, maxBuffer: 10 * 1024 * 1024, env: process.env },
            (error, stdout, stderr) => {
                if (error) {
                    return reject(new Error(stderr || error.message || "GPT process failed."));
                }

                try {
                    resolve(JSON.parse(stdout));
                } catch (parseError) {
                    reject(new Error(`GPT JSON parse failed: ${stdout}`));
                }
            }
        );
    });
}

function estimateExpiry(name) {
    return runGpt("expiry", name);
}

function recommendRecipes(ingredientNames) {
    return runGpt("recipes", JSON.stringify(ingredientNames));
}

module.exports = {
    estimateExpiry,
    recommendRecipes
};
