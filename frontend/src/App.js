import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const navItems = [
    { id: "fridge", label: "Fridge" },
    { id: "recipes", label: "Recipes" },
    { id: "meals", label: "Meals" },
    { id: "dashboard", label: "Dashboard" }
];

const pagePaths = {
    home: "/",
    fridge: "/#/fridge",
    recipes: "/#/recipes",
    meals: "/#/meals",
    dashboard: "/#/dashboard"
};

function pageFromLocation() {
    const hashPage = window.location.hash.replace("#/", "");
    return navItems.some(item => item.id === hashPage) ? hashPage : "home";
}

async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Request failed." }));
        throw new Error(error.message);
    }

    return response.json();
}

function formatExpiry(item) {
    if (!item.expiresAt) return "no expiration date";
    if (item.daysLeft < 0) return `${item.expiresAt} / expired`;
    if (item.daysLeft === 0) return `${item.expiresAt} / expires today`;
    return `${item.expiresAt} / ${item.daysLeft} days left`;
}

function Nav({ page, navigate }) {
    const [open, setOpen] = useState(false);

    return (
        <nav className="navbar">
            <div className="logo">
                <button
                    className="logo-button"
                    type="button"
                    onClick={() => navigate("home")}
                >
                    <img src="/logo.png" alt="ReciFridge" />
`                   <span>ReciFridge</span>
                </button>
            </div>

            <button className="menu-toggle" type="button" onClick={() => setOpen(!open)}>
                &#9776;
            </button>

            <ul className={`nav-links ${open ? "active" : ""}`}>
                {navItems.map(item => (
                    <li key={item.id}>
                        <button
                            className={page === item.id ? "nav-active" : ""}
                            type="button"
                            onClick={() => {
                                navigate(item.id);
                                setOpen(false);
                            }}
                        >
                            {item.label}
                        </button>
                    </li>
                ))}
            </ul>



        </nav>
    );
}

function Home({ navigate }) {
    return (
        <div className="landing-modern">

            <div className="hero">
                <div className="hero-logo">
                    <img src="/logo.png" alt="FreshMeal" />
                </div>
            <div className="vegetable-container">
                <span className="veg veg1">🥕</span>
                <span className="veg veg2">🥦</span>
                <span className="veg veg3">🍅</span>
                <span className="veg veg4">🥬</span>
                <span className="veg veg5">🧄</span>
                <span className="veg veg6">🌽</span>
            </div>
                <h1>FreshMeal</h1>

                <p className="hero-subtitle">
                    Create healthy meals with ingredients from your fridge
                </p>

                <button
                    className="hero-btn"
                    onClick={() => navigate("fridge")}
                >
                    Get Started
                </button>
            </div>

            <div className="feature-grid">

                <div className="feature-card">
                    <div className="feature-icon">🛒</div>
                    <h3>Ingredient Management</h3>
                    <p>
                        Easily manage ingredients and track expiration dates.
                    </p>
                </div>

                <div className="feature-card">
                    <div className="feature-icon">🍽️</div>
                    <h3>Recipe Recommendation</h3>
                    <p>
                        Receive recipes based on ingredients available in your fridge.
                    </p>
                </div>

                <div className="feature-card">
                    <div className="feature-icon">📊</div>
                    <h3>Nutrition Dashboard</h3>
                    <p>
                        Monitor calorie intake and nutrition balance.
                    </p>
                </div>

                <div className="feature-card">
                    <div className="feature-icon">🤖</div>
                    <h3>AI Assistant</h3>
                    <p>
                        Get cooking guidance and ingredient suggestions instantly.
                    </p>
                </div>

            </div>
        </div>
    );
}

function Fridge() {
    const [ingredients, setIngredients] = useState([]);
    const [query, setQuery] = useState("");
    const [name, setName] = useState("");
    const [expiresAt, setExpiresAt] = useState("");
    const [error, setError] = useState("");

    const loadIngredients = useCallback(async (search = query) => {
        const data = await api(`/api/ingredients?q=${encodeURIComponent(search)}`);
        setIngredients(data);
    }, [query]);

    useEffect(() => {
        loadIngredients("").catch(error => setError(error.message));
    }, [loadIngredients]);

    async function handleAdd(event) {
        event.preventDefault();
        setError("");

        try {
            await api("/api/ingredients", {
                method: "POST",
                body: JSON.stringify({ name, expiresAt: expiresAt || null })
            });
            setName("");
            setExpiresAt("");
            await loadIngredients();
        } catch (error) {
            setError(error.message);
        }
    }

    async function handleSearch(event) {
        event.preventDefault();
        setError("");
        try {
            await loadIngredients(query);
        } catch (error) {
            setError(error.message);
        }
    }

    return (
        <section>
            <h1>Refrigerator Management</h1>
            <div className="top-bar">
                <form className="search-box" onSubmit={handleSearch}>
                    <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search ingredient" />
                    <button type="submit">Search</button>
                </form>

                <form className="add-button" onSubmit={handleAdd}>
                    <input value={name} onChange={event => setName(event.target.value)} placeholder="Ingredient name" required />
                    <input type="date" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} />
                    <button type="submit">Add Ingredient</button>
                </form>
            </div>

            {error && <p className="error-text">{error}</p>}

            <div>
                {ingredients.length > 0 ? ingredients.map(item => (
                    <div className="list-item" key={item.id}>
                        {item.name} / {formatExpiry(item)}
                    </div>
                )) : <div className="list-item">No ingredients found.</div>}
            </div>

            <div className="image-box">refrigerator image</div>
        </section>
    );
}

function Recipes() {
    const [recipes, setRecipes] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        api("/api/recipes").then(setRecipes).catch(error => setError(error.message));
    }, []);

    return (
        <section>
            <div className="flex">
                <h1>Recipe Recommendation</h1>
                <button type="button">View More</button>
            </div>

            {error && <p className="error-text">{error}</p>}

            <div className="card-container">
                {recipes.map(recipe => (
                    <div className="card" key={recipe.id}>
                        <div className="image-box">food image</div>
                        <h3>{recipe.name}</h3>
                        <p>Your Ingredients</p>
                        <p>{recipe.ingredients.join(" ")}</p>
                        <p>{recipe.calories} kcal</p>
                        <br />
                        <button type="button">Cook Now</button>
                    </div>
                ))}
            </div>
        </section>
    );
}

function Meals() {
    const [meals, setMeals] = useState([]);
    const [type, setType] = useState("");
    const [name, setName] = useState("");
    const [calories, setCalories] = useState("");
    const [error, setError] = useState("");

    const loadMeals = useCallback(async () => {
        const data = await api("/api/meals");
        setMeals(data);
    }, []);

    useEffect(() => {
        loadMeals().catch(error => setError(error.message));
    }, [loadMeals]);

    async function handleAdd(event) {
        event.preventDefault();
        setError("");

        try {
            await api("/api/meals", {
                method: "POST",
                body: JSON.stringify({ type, name, calories: Number(calories) })
            });
            setType("");
            setName("");
            setCalories("");
            await loadMeals();
        } catch (error) {
            setError(error.message);
        }
    }

    const total = meals.reduce((sum, meal) => sum + meal.calories, 0);

    return (
        <section>
            <div className="flex">
                <h1>Meal Tracking</h1>
                <form className="inline-form" onSubmit={handleAdd}>
                    <input value={type} onChange={event => setType(event.target.value)} placeholder="Meal type" required />
                    <input value={name} onChange={event => setName(event.target.value)} placeholder="Food name" required />
                    <input
                        type="number"
                        min="0"
                        value={calories}
                        onChange={event => setCalories(event.target.value)}
                        placeholder="kcal"
                        required
                    />
                    <button type="submit">+ Add a Record</button>
                </form>
            </div>

            {error && <p className="error-text">{error}</p>}

            <br />
            <h2>Today's Calories</h2>
            <p>{total} / 2000 kcal</p>
            <br />

            {meals.map(meal => (
                <div className="list-item" key={meal.id}>
                    {meal.type} / {meal.calories} kcal / {meal.name}
                </div>
            ))}
        </section>
    );
}

function Dashboard() {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api("/api/dashboard").then(setData).catch(error => setError(error.message));
    }, []);

    if (error) {
        return <section><p className="error-text">{error}</p></section>;
    }

    if (!data) {
        return <section><h1>Dashboard</h1><p>Loading...</p></section>;
    }

    const max = Math.max(...data.weeklyCalories);

    return (
        <section>
            <h1>Dashboard</h1>
            <br />
            <p>Average Calories - {data.averageCalories} kcal/day</p>
            <p>Daily Goal - {data.dailyGoal} kcal/day</p>
            <p>Goal Achievement - {data.goalAchievement}%</p>

            <div className="graph">
                {data.weeklyCalories.map((value, index) => {
                    const height = Math.max(20, Math.round((value / max) * 190));
                    return <div className="bar" style={{ height }} title={`${value} kcal`} key={`${value}-${index}`}></div>;
                })}
            </div>

            <br />
            <h2>Nutrition Balance</h2>
            <p>Fat : {data.nutritionBalance.fat}%</p>
            <p>Carb : {data.nutritionBalance.carb}%</p>
            <p>Protein : {data.nutritionBalance.protein}%</p>

            <br />
            <h2>Health Goal Settings</h2>
            <div className="list-item">Daily Calorie Goal</div>
            <div className="list-item">Carbs Target</div>
            <div className="list-item">Protein Target</div>
            <div className="list-item">Fat Target</div>
            <button type="button">Save Goals</button>
        </section>
    );
}

function App() {
    const [page, setPage] = useState(pageFromLocation);

    function navigate(nextPage) {
        setPage(nextPage);
        window.history.pushState({}, "", pagePaths[nextPage]);
    }

    useEffect(() => {
        function handlePopState() {
            setPage(pageFromLocation());
        }

        window.addEventListener("popstate", handlePopState);
        window.addEventListener("hashchange", handlePopState);
        return () => {
            window.removeEventListener("popstate", handlePopState);
            window.removeEventListener("hashchange", handlePopState);
        };
    }, []);

    return (
        <>
            <Nav page={page} navigate={navigate}></Nav>
            {page === "home" && <Home navigate={navigate}></Home>}
            {page === "fridge" && <Fridge></Fridge>}
            {page === "recipes" && <Recipes></Recipes>}
            {page === "meals" && <Meals></Meals>}
            {page === "dashboard" && <Dashboard></Dashboard>}
        </>
    );
}

export default App;
