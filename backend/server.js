const http = require("http");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { URL } = require("url");
const gptClient = require("./gptClient");

loadEnvFile();

const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, "data", "recifridge.sqlite");

let db;

function loadEnvFile() {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) return;

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

        if (!process.env[key]) {
            process.env[key] = value;
        }
    });
}

function setCorsHeaders(res) {
    res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, statusCode, data) {
    setCorsHeaders(res);
    res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", chunk => {
            body += chunk;
            if (body.length > 1_000_000) {
                req.destroy();
                reject(new Error("Request body is too large."));
            }
        });
        req.on("end", () => resolve(body));
        req.on("error", reject);
    });
}

function daysLeft(expiresAt) {
    if (!expiresAt) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(`${expiresAt}T00:00:00`);
    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}

function ingredientView(item) {
    return {
        ...item,
        daysLeft: daysLeft(item.expiresAt)
    };
}

function parseIngredientsJson(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return JSON.parse(value);
}

function parseCalories(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.round(value);
    }
    if (typeof value !== "string") {
        return 0;
    }
    const match = value.match(/\d+/);
    return match ? Number(match[0]) : 0;
}

function mapGptRecipes(gptResult) {
    return (gptResult.recipes || []).map((recipe, index) => ({
        id: `ai-${index}`,
        name: recipe.title || "Recipe",
        description: recipe.description || "",
        ingredients: recipe.used_ingredients || [],
        missingIngredients: recipe.missing_ingredients || [],
        steps: recipe.steps || [],
        calories: parseCalories(recipe.nutrition?.calories),
        nutrition: recipe.nutrition || {}
    }));
}

async function initializeDatabase() {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA foreign_keys = ON");

    db.exec(`
        CREATE TABLE IF NOT EXISTS ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            expires_at TEXT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            ingredients_json TEXT NOT NULL,
            calories INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meal_type TEXT NOT NULL,
            name TEXT NOT NULL,
            calories INTEGER NOT NULL,
            eaten_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await seedInitialData();
}

async function seedInitialData() {
    const ingredientCount = db.prepare("SELECT COUNT(*) AS count FROM ingredients").get();
    if (ingredientCount.count === 0) {
        const insertIngredient = db.prepare("INSERT INTO ingredients (name, expires_at) VALUES (?, ?)");
        insertIngredient.run("Milk 1L", "2026-06-03");
        insertIngredient.run("Egg", "2026-05-30");
        insertIngredient.run("Salt", null);
    }

    const recipeCount = db.prepare("SELECT COUNT(*) AS count FROM recipes").get();
    if (recipeCount.count === 0) {
        const insertRecipe = db.prepare("INSERT INTO recipes (name, ingredients_json, calories) VALUES (?, ?, ?)");
        insertRecipe.run("Creamy Egg Toast", JSON.stringify(["Milk", "Egg", "Salt"]), 520);
        insertRecipe.run("Simple Omelette", JSON.stringify(["Egg", "Salt"]), 340);
        insertRecipe.run("Milk Pasta", JSON.stringify(["Milk", "Salt"]), 680);
    }

    const mealCount = db.prepare("SELECT COUNT(*) AS count FROM meals").get();
    if (mealCount.count === 0) {
        const insertMeal = db.prepare("INSERT INTO meals (meal_type, name, calories) VALUES (?, ?, ?)");
        insertMeal.run("Breakfast", "Sandwich", 500);
        insertMeal.run("Lunch", "Pasta", 800);
        insertMeal.run("Dinner", "Salad", 600);
    }
}

async function getIngredients(query) {
    const search = `%${query}%`;
    const rows = db.prepare(
        `
            SELECT
                id,
                name,
                expires_at AS expiresAt
            FROM ingredients
            WHERE LOWER(name) LIKE LOWER(?)
            ORDER BY
                expires_at IS NULL,
                expires_at ASC,
                id DESC
        `,
    ).all(search);

    return rows.map(ingredientView);
}

async function createIngredient(name, expiresAt) {
    const result = db.prepare("INSERT INTO ingredients (name, expires_at) VALUES (?, ?)").run(name, expiresAt);

    const row = db.prepare(
        "SELECT id, name, expires_at AS expiresAt FROM ingredients WHERE id = ?"
    ).get(result.lastInsertRowid);

    return ingredientView(row);
}

async function getRecipes() {
    const rows = db.prepare(`
        SELECT
            id,
            name,
            ingredients_json AS ingredients,
            calories
        FROM recipes
        ORDER BY id ASC
    `).all();

    return rows.map(recipe => ({
        ...recipe,
        ingredients: parseIngredientsJson(recipe.ingredients)
    }));
}

async function getMeals() {
    return db.prepare(`
        SELECT
            id,
            meal_type AS type,
            name,
            calories
        FROM meals
        ORDER BY id ASC
    `).all();
}

async function createMeal(type, name, calories) {
    const result = db.prepare("INSERT INTO meals (meal_type, name, calories) VALUES (?, ?, ?)").run(type, name, calories);

    return db.prepare(
        "SELECT id, meal_type AS type, name, calories FROM meals WHERE id = ?"
    ).get(result.lastInsertRowid);
}

function getDayModifier(daysAgo) {
    return `-${daysAgo} days`;
}

async function getDashboardData() {
    const summary = db.prepare(`
        SELECT
            COALESCE(SUM(calories), 0) AS totalCalories,
            COUNT(*) AS mealCount
        FROM meals
    `).get();

    const weeklyRows = db.prepare(`
        SELECT
            date(eaten_at) AS day,
            SUM(calories) AS calories
        FROM meals
        WHERE date(eaten_at) >= date('now', ?)
        GROUP BY date(eaten_at)
        ORDER BY day ASC
    `).all(getDayModifier(6));

    const totalCalories = Number(summary.totalCalories);
    const dailyGoal = 2000;
    const averageCalories = Math.round(totalCalories / Math.max(Number(summary.mealCount), 1));
    const weeklyCalories = weeklyRows.map(row => Number(row.calories));

    return {
        averageCalories,
        dailyGoal,
        goalAchievement: Math.round((averageCalories / dailyGoal) * 100),
        weeklyCalories: weeklyCalories.length > 0 ? weeklyCalories : [0],
        nutritionBalance: {
            fat: 25,
            carb: 45,
            protein: 30
        }
    };
}

async function handleApi(req, res, url) {
    if (req.method === "OPTIONS") {
        setCorsHeaders(res);
        res.writeHead(204);
        return res.end();
    }

    if (url.pathname === "/api/health" && req.method === "GET") {
        db.prepare("SELECT 1").get();
        return sendJson(res, 200, { status: "ok", database: DB_PATH });
    }

    if (url.pathname === "/api/ingredients" && req.method === "GET") {
        const query = (url.searchParams.get("q") || "").trim();
        return sendJson(res, 200, await getIngredients(query));
    }

    if (url.pathname === "/api/ingredients" && req.method === "POST") {
        const body = JSON.parse(await readBody(req) || "{}");
        const name = String(body.name || "").trim();
        const useAiExpiry = body.autoExpiry !== false;
        const baseDate = body.baseDate ? String(body.baseDate) : "";
        let expiresAt = !useAiExpiry && body.expiresAt ? String(body.expiresAt) : null;

        if (!name) {
            return sendJson(res, 400, { message: "Ingredient name is required." });
        }

        let expiryMeta = null;
        if (!expiresAt && useAiExpiry) {
            try {
                expiryMeta = await gptClient.estimateExpiry(name, baseDate);
                if (expiryMeta.error) {
                    return sendJson(res, 502, {
                        message: expiryMeta.error,
                        aiMessage: expiryMeta.chat_reply || expiryMeta.error
                    });
                }
                if (expiryMeta.expires_at) {
                    expiresAt = expiryMeta.expires_at;
                }
            } catch (error) {
                return sendJson(res, 502, {
                    message: `GPT expiry estimate failed: ${error.message}`
                });
            }
        }

        const created = await createIngredient(name, expiresAt);
        return sendJson(res, 201, {
            ...created,
            isEstimate: Boolean(expiryMeta?.is_estimate),
            expiryNote: expiryMeta?.note || null,
            aiMessage: expiryMeta?.chat_reply || null
        });
    }

    if (url.pathname === "/api/recommend" && req.method === "POST") {
        const ingredients = await getIngredients("");
        const names = ingredients.map(item => item.name);

        if (names.length === 0) {
            return sendJson(res, 400, {
                message: "Add at least one ingredient in Fridge before requesting recommendations."
            });
        }

        const gptResult = await gptClient.recommendRecipes(names);
        return sendJson(res, 200, {
            recipes: mapGptRecipes(gptResult),
            chat_reply: gptResult.chat_reply || "",
            error: gptResult.error || null
        });
    }

    if (url.pathname === "/api/recipes" && req.method === "GET") {
        return sendJson(res, 200, await getRecipes());
    }

    if (url.pathname === "/api/meals" && req.method === "GET") {
        return sendJson(res, 200, await getMeals());
    }

    if (url.pathname === "/api/meals" && req.method === "POST") {
        const body = JSON.parse(await readBody(req) || "{}");
        const type = String(body.type || "").trim();
        const name = String(body.name || "").trim();
        const calories = Number(body.calories);

        if (!type || !name || !Number.isFinite(calories)) {
            return sendJson(res, 400, { message: "Meal type, name, and calories are required." });
        }

        return sendJson(res, 201, await createMeal(type, name, calories));
    }

    if (url.pathname === "/api/dashboard" && req.method === "GET") {
        return sendJson(res, 200, await getDashboardData());
    }

    return sendJson(res, 404, { message: "API route not found." });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    try {
        return await handleApi(req, res, url);
    } catch (error) {
        return sendJson(res, 500, { message: error.message || "Server error." });
    }
});

initializeDatabase()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`ReciFridge API is running at http://localhost:${PORT}`);
            console.log(`SQLite database: ${DB_PATH}`);
        });
    })
    .catch(error => {
        console.error("Failed to initialize SQLite database.");
        console.error(error.message);
        process.exit(1);
    });
