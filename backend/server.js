const http = require("http");
const fs = require("fs");
const mysql = require("mysql2/promise");
const path = require("path");
const { URL } = require("url");

loadEnvFile();

const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "recifridge"
};

let pool;

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

async function initializeDatabase() {
    const bootstrapConnection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        multipleStatements: true
    });

    await bootstrapConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
    await bootstrapConnection.end();

    pool = mysql.createPool({
        ...dbConfig,
        waitForConnections: true,
        connectionLimit: 10,
        namedPlaceholders: true
    });

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ingredients (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            expires_at DATE NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS recipes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            ingredients_json JSON NOT NULL,
            calories INT NOT NULL
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS meals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            meal_type VARCHAR(100) NOT NULL,
            name VARCHAR(255) NOT NULL,
            calories INT NOT NULL,
            eaten_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await seedInitialData();
}

async function seedInitialData() {
    const [[ingredientCount]] = await pool.query("SELECT COUNT(*) AS count FROM ingredients");
    if (ingredientCount.count === 0) {
        await pool.query(
            "INSERT INTO ingredients (name, expires_at) VALUES (?, ?), (?, ?), (?, ?)",
            ["Milk 1L", "2026-06-03", "Egg", "2026-05-30", "Salt", null]
        );
    }

    const [[recipeCount]] = await pool.query("SELECT COUNT(*) AS count FROM recipes");
    if (recipeCount.count === 0) {
        await pool.query(
            "INSERT INTO recipes (name, ingredients_json, calories) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)",
            [
                "Creamy Egg Toast", JSON.stringify(["Milk", "Egg", "Salt"]), 520,
                "Simple Omelette", JSON.stringify(["Egg", "Salt"]), 340,
                "Milk Pasta", JSON.stringify(["Milk", "Salt"]), 680
            ]
        );
    }

    const [[mealCount]] = await pool.query("SELECT COUNT(*) AS count FROM meals");
    if (mealCount.count === 0) {
        await pool.query(
            "INSERT INTO meals (meal_type, name, calories) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)",
            ["Breakfast", "Sandwich", 500, "Lunch", "Pasta", 800, "Dinner", "Salad", 600]
        );
    }
}

async function getIngredients(query) {
    const search = `%${query}%`;
    const [rows] = await pool.query(
        `
            SELECT
                id,
                name,
                DATE_FORMAT(expires_at, '%Y-%m-%d') AS expiresAt
            FROM ingredients
            WHERE LOWER(name) LIKE LOWER(?)
            ORDER BY
                expires_at IS NULL,
                expires_at ASC,
                id DESC
        `,
        [search]
    );

    return rows.map(ingredientView);
}

async function createIngredient(name, expiresAt) {
    const [result] = await pool.query(
        "INSERT INTO ingredients (name, expires_at) VALUES (?, ?)",
        [name, expiresAt]
    );

    const [rows] = await pool.query(
        "SELECT id, name, DATE_FORMAT(expires_at, '%Y-%m-%d') AS expiresAt FROM ingredients WHERE id = ?",
        [result.insertId]
    );

    return ingredientView(rows[0]);
}

async function getRecipes() {
    const [rows] = await pool.query(`
        SELECT
            id,
            name,
            ingredients_json AS ingredients,
            calories
        FROM recipes
        ORDER BY id ASC
    `);

    return rows.map(recipe => ({
        ...recipe,
        ingredients: parseIngredientsJson(recipe.ingredients)
    }));
}

async function getMeals() {
    const [rows] = await pool.query(`
        SELECT
            id,
            meal_type AS type,
            name,
            calories
        FROM meals
        ORDER BY id ASC
    `);

    return rows;
}

async function createMeal(type, name, calories) {
    const [result] = await pool.query(
        "INSERT INTO meals (meal_type, name, calories) VALUES (?, ?, ?)",
        [type, name, calories]
    );

    const [rows] = await pool.query(
        "SELECT id, meal_type AS type, name, calories FROM meals WHERE id = ?",
        [result.insertId]
    );

    return rows[0];
}

async function getDashboardData() {
    const [[summary]] = await pool.query(`
        SELECT
            COALESCE(SUM(calories), 0) AS totalCalories,
            COUNT(*) AS mealCount
        FROM meals
    `);

    const [weeklyRows] = await pool.query(`
        SELECT
            DATE(eaten_at) AS day,
            SUM(calories) AS calories
        FROM meals
        WHERE eaten_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(eaten_at)
        ORDER BY day ASC
    `);

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
        await pool.query("SELECT 1");
        return sendJson(res, 200, { status: "ok", database: dbConfig.database });
    }

    if (url.pathname === "/api/ingredients" && req.method === "GET") {
        const query = (url.searchParams.get("q") || "").trim();
        return sendJson(res, 200, await getIngredients(query));
    }

    if (url.pathname === "/api/ingredients" && req.method === "POST") {
        const body = JSON.parse(await readBody(req) || "{}");
        const name = String(body.name || "").trim();
        const expiresAt = body.expiresAt ? String(body.expiresAt) : null;

        if (!name) {
            return sendJson(res, 400, { message: "Ingredient name is required." });
        }

        return sendJson(res, 201, await createIngredient(name, expiresAt));
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
            console.log(`MySQL database: ${dbConfig.database}`);
        });
    })
    .catch(error => {
        console.error("Failed to initialize MySQL database.");
        console.error(error.message);
        process.exit(1);
    });
