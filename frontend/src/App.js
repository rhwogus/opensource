import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASES = process.env.REACT_APP_API_URL
    ? [process.env.REACT_APP_API_URL]
    : ["http://localhost:5001", "http://localhost:5000"];

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
    let lastNetworkError = null;

    for (const baseUrl of API_BASES) {
        try {
            const response = await fetch(`${baseUrl}${path}`, {
                headers: { "Content-Type": "application/json" },
                ...options
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: "Request failed." }));
                throw new Error(error.message || "Request failed.");
            }

            return response.json();
        } catch (error) {
            if (error instanceof TypeError) {
                lastNetworkError = error;
                continue;
            }
            throw error;
        }
    }

    throw lastNetworkError || new Error("API server is not reachable.");
}

function formatExpiry(item) {
    if (!item.expiresAt) return "No date";
    if (item.daysLeft < 0) return `Expired ${Math.abs(item.daysLeft)} days ago`;
    if (item.daysLeft === 0) return "Expires today";
    return `${item.daysLeft} days left`;
}

function Nav({ page, navigate }) {
    const [open, setOpen] = useState(false);

    return (
        <nav className="site-nav">
            <button className="logo-button" type="button" onClick={() => navigate("home")}>
                <img src="/logo.png" width="42" height="42" alt="" />
                <span>ReciFridge</span>
            </button>

            <button className="menu-toggle" type="button" onClick={() => setOpen(!open)} aria-label="Open navigation">
                Menu
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
        <main className="landing-modern">
            <div className="vegetable-container" aria-hidden="true">
                <span className="veg veg1">{"\u{1F955}"}</span>
                <span className="veg veg2">{"\u{1F966}"}</span>
                <span className="veg veg3">{"\u{1F345}"}</span>
                <span className="veg veg4">{"\u{1F96C}"}</span>
                <span className="veg veg5">{"\u{1F9C4}"}</span>
                <span className="veg veg6">{"\u{1F33D}"}</span>
            </div>

            <section className="hero">
                <div className="hero-logo">
                    <img src="/logo.png" alt="ReciFridge" />
                </div>
                <h1>ReciFridge</h1>
                <p className="hero-subtitle">
                    Create healthy meals with ingredients from your fridge
                </p>
                <button className="hero-btn" type="button" onClick={() => navigate("fridge")}>
                    Get Started
                </button>
            </section>

            <section className="feature-grid" aria-label="Product features">
                <div className="feature-card">
                    <div className="feature-icon">{"\u{1F6D2}"}</div>
                    <h3>Ingredient Management</h3>
                    <p>Easily manage ingredients and track expiration dates.</p>
                </div>
                <div className="feature-card">
                    <div className="feature-icon">{"\u{1F37D}\uFE0F"}</div>
                    <h3>Recipe Recommendation</h3>
                    <p>Receive recipes based on ingredients available in your fridge.</p>
                </div>
                <div className="feature-card">
                    <div className="feature-icon">{"\u{1F4CA}"}</div>
                    <h3>Nutrition Dashboard</h3>
                    <p>Monitor calorie intake and nutrition balance.</p>
                </div>
                <div className="feature-card">
                    <div className="feature-icon">{"\u{1F916}"}</div>
                    <h3>AI Assistant</h3>
                    <p>Get cooking guidance and ingredient suggestions instantly.</p>
                </div>
            </section>
        </main>
    );
}
function Fridge() {
    const [ingredients, setIngredients] = useState([]);
    const [query, setQuery] = useState("");
    const [name, setName] = useState("");
    const [expiresAt, setExpiresAt] = useState("");
    const [autoExpiry, setAutoExpiry] = useState(true);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const loadIngredients = useCallback(async (search = query) => {
        const data = await api(`/api/ingredients?q=${encodeURIComponent(search)}`);
        setIngredients(data);
    }, [query]);

    useEffect(() => {
        loadIngredients("").catch(error => setError(error.message));
    }, [loadIngredients]);

    const fridgeStats = useMemo(() => {
        const expiringSoon = ingredients.filter(item => item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= 3).length;
        const expired = ingredients.filter(item => item.daysLeft !== null && item.daysLeft < 0).length;
        return { total: ingredients.length, expiringSoon, expired };
    }, [ingredients]);

    async function handleAdd(event) {
        event.preventDefault();
        setError("");
        setNotice("");
        setSaving(true);

        try {
            const created = await api("/api/ingredients", {
                method: "POST",
                body: JSON.stringify({
                    name,
                    expiresAt: expiresAt || null,
                    autoExpiry
                })
            });

            setName("");
            setExpiresAt("");
            await loadIngredients();

            if (created.aiMessage) {
                setNotice(created.aiMessage);
            } else if (created.isEstimate) {
                setNotice("AI estimated an expiry date for this ingredient.");
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setSaving(false);
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
        <main className="page-shell">
            <section className="page-header fridge-header">
                <div>
                    <p className="eyebrow">Inventory</p>
                    <h1>Refrigerator Management</h1>
                    <p>Keep ingredients visible, searchable, and ready for AI recipe recommendations.</p>
                </div>
                <div className="header-mark" aria-hidden="true"><span></span><span></span><span></span></div>
            </section>

            <section className="metrics-grid" aria-label="Fridge summary">
                <div className="metric-card">
                    <span>Total items</span>
                    <strong>{fridgeStats.total}</strong>
                </div>
                <div className="metric-card warning">
                    <span>Expiring soon</span>
                    <strong>{fridgeStats.expiringSoon}</strong>
                </div>
                <div className="metric-card danger">
                    <span>Expired</span>
                    <strong>{fridgeStats.expired}</strong>
                </div>
            </section>

            <section className="workspace-grid">
                <form className="panel form-panel" onSubmit={handleAdd}>
                    <div className="panel-heading">
                        <h2>Add Ingredient</h2>
                        <p>Leave the date empty to let AI estimate it.</p>
                    </div>
                    <label>
                        Ingredient name
                        <input value={name} onChange={event => setName(event.target.value)} placeholder="Egg, tofu, kimchi..." required />
                    </label>
                    <label>
                        Expiry date
                        <input type="date" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} />
                    </label>
                    <label className="check-row">
                        <input type="checkbox" checked={autoExpiry} onChange={event => setAutoExpiry(event.target.checked)} />
                        <span>Use AI expiry estimate when date is blank</span>
                    </label>
                    <button className="primary-action full-width" type="submit" disabled={saving}>
                        {saving ? "Adding..." : "Add Ingredient"}
                    </button>
                </form>

                <div className="panel inventory-panel">
                    <div className="panel-heading split-heading">
                        <div>
                            <h2>Current Fridge</h2>
                            <p>{ingredients.length} ingredients available</p>
                        </div>
                        <form className="search-box" onSubmit={handleSearch}>
                            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search" />
                            <button className="secondary-action" type="submit">Search</button>
                        </form>
                    </div>

                    {error && <p className="error-text">{error}</p>}
                    {notice && <p className="success-text">{notice}</p>}

                    <div className="inventory-list">
                        {ingredients.length > 0 ? ingredients.map(item => (
                            <article className="list-item ingredient-row" key={item.id}>
                                <div>
                                    <strong>{item.name}</strong>
                                    <span>{item.expiresAt || "No expiration date"}</span>
                                </div>
                                <span className={`status-pill ${item.daysLeft !== null && item.daysLeft <= 3 ? "urgent" : ""}`}>
                                    {formatExpiry(item)}
                                </span>
                            </article>
                        )) : <div className="empty-state">No ingredients found.</div>}
                    </div>
                </div>
            </section>
        </main>
    );
}

function RecipeCard({ recipe, ai }) {
    return (
        <article className={`recipe-card ${ai ? "ai-card" : ""}`}>
            <div className="recipe-image" aria-hidden="true"><span></span></div>
            <div className="recipe-content">
                <div className="recipe-title-row">
                    <h3>{recipe.name}</h3>
                    {ai && <span className="ai-badge">AI</span>}
                </div>
                {recipe.description && <p>{recipe.description}</p>}
                <div className="tag-list">
                    {(recipe.ingredients || []).slice(0, 6).map(ingredient => (
                        <span key={ingredient}>{ingredient}</span>
                    ))}
                </div>
                {recipe.missingIngredients?.length > 0 && (
                    <p className="muted-text">Missing: {recipe.missingIngredients.join(", ")}</p>
                )}
                {recipe.steps?.length > 0 && (
                    <ol className="steps-list">
                        {recipe.steps.slice(0, 3).map((step, index) => (
                            <li key={`${step}-${index}`}>{step}</li>
                        ))}
                    </ol>
                )}
                <div className="recipe-footer">
                    <span>{recipe.calories || 0} kcal</span>
                    <button className="secondary-action" type="button">Cook Now</button>
                </div>
            </div>
        </article>
    );
}

function Recipes() {
    const [recipes, setRecipes] = useState([]);
    const [aiRecipes, setAiRecipes] = useState([]);
    const [aiMessage, setAiMessage] = useState("");
    const [loadingAi, setLoadingAi] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        api("/api/recipes").then(setRecipes).catch(error => setError(error.message));
    }, []);

    async function handleRecommend() {
        setError("");
        setAiMessage("");
        setLoadingAi(true);

        try {
            const data = await api("/api/recommend", { method: "POST", body: "{}" });
            setAiRecipes(data.recipes || []);
            setAiMessage(data.chat_reply || "");
            if (data.error) {
                setError(data.error);
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setLoadingAi(false);
        }
    }

    return (
        <main className="page-shell">
            <section className="page-header recipes-header">
                <div>
                    <p className="eyebrow">AI kitchen</p>
                    <h1>Recipe Recommendation</h1>
                    <p>Start with saved recipes, then ask AI to create ideas from your fridge inventory.</p>
                </div>
                <button className="primary-action" type="button" onClick={handleRecommend} disabled={loadingAi}>
                    {loadingAi ? "Generating..." : "Generate AI Recipes"}
                </button>
            </section>

            {error && <p className="error-text page-message">{error}</p>}
            {aiMessage && <p className="success-text page-message">{aiMessage}</p>}

            {aiRecipes.length > 0 && (
                <section className="section-block">
                    <div className="section-title">
                        <h2>AI Recommendations</h2>
                        <p>Based on the ingredients currently stored in your fridge.</p>
                    </div>
                    <div className="recipe-grid">
                        {aiRecipes.map(recipe => <RecipeCard recipe={recipe} ai key={recipe.id} />)}
                    </div>
                </section>
            )}

            <section className="section-block">
                <div className="section-title">
                    <h2>Saved Recipes</h2>
                    <p>Default recipe ideas stored in the backend database.</p>
                </div>
                <div className="recipe-grid">
                    {recipes.map(recipe => <RecipeCard recipe={recipe} key={recipe.id} />)}
                </div>
            </section>
        </main>
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
    const progress = Math.min(100, Math.round((total / 2000) * 100));

    return (
        <main className="page-shell">
            <section className="page-header">
                <div>
                    <p className="eyebrow">Nutrition log</p>
                    <h1>Meal Tracking</h1>
                    <p>Record meals and keep a quick view of daily calories.</p>
                </div>
            </section>

            <section className="workspace-grid meal-grid">
                <form className="panel form-panel" onSubmit={handleAdd}>
                    <div className="panel-heading">
                        <h2>Add Meal</h2>
                        <p>Simple records keep the dashboard useful.</p>
                    </div>
                    <input value={type} onChange={event => setType(event.target.value)} placeholder="Breakfast" required />
                    <input value={name} onChange={event => setName(event.target.value)} placeholder="Food name" required />
                    <input
                        type="number"
                        min="0"
                        value={calories}
                        onChange={event => setCalories(event.target.value)}
                        placeholder="kcal"
                        required
                    />
                    <button className="primary-action full-width" type="submit">Add Record</button>
                </form>

                <div className="panel">
                    <div className="panel-heading">
                        <h2>Today's Calories</h2>
                        <p>{total} / 2000 kcal</p>
                    </div>
                    <div className="progress-track">
                        <span style={{ width: `${progress}%` }}></span>
                    </div>
                    {error && <p className="error-text">{error}</p>}
                    <div className="inventory-list">
                        {meals.map(meal => (
                            <article className="list-item meal-row" key={meal.id}>
                                <span>{meal.type}</span>
                                <strong>{meal.name}</strong>
                                <span>{meal.calories} kcal</span>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
}

function Dashboard() {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api("/api/dashboard").then(setData).catch(error => setError(error.message));
    }, []);

    if (error) {
        return <main className="page-shell"><p className="error-text">{error}</p></main>;
    }

    if (!data) {
        return <main className="page-shell"><section className="page-header"><h1>Dashboard</h1><p>Loading...</p></section></main>;
    }

    const max = Math.max(...data.weeklyCalories, 1);

    return (
        <main className="page-shell">
            <section className="page-header">
                <div>
                    <p className="eyebrow">Overview</p>
                    <h1>Dashboard</h1>
                    <p>Monitor calorie trends and nutrition balance.</p>
                </div>
            </section>

            <section className="metrics-grid">
                <div className="metric-card">
                    <span>Average Calories</span>
                    <strong>{data.averageCalories}</strong>
                    <small>kcal/day</small>
                </div>
                <div className="metric-card">
                    <span>Daily Goal</span>
                    <strong>{data.dailyGoal}</strong>
                    <small>kcal/day</small>
                </div>
                <div className="metric-card">
                    <span>Goal Achievement</span>
                    <strong>{data.goalAchievement}%</strong>
                </div>
            </section>

            <section className="workspace-grid dashboard-grid">
                <div className="panel">
                    <div className="panel-heading">
                        <h2>Weekly Calories</h2>
                        <p>Last seven days from meal records.</p>
                    </div>
                    <div className="graph">
                        {data.weeklyCalories.map((value, index) => {
                            const height = Math.max(12, Math.round((value / max) * 190));
                            return (
                                <div className="bar-wrap" key={`${value}-${index}`}>
                                    <span className="bar" style={{ height }} title={`${value} kcal`}></span>
                                    <small>{value}</small>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-heading">
                        <h2>Nutrition Balance</h2>
                        <p>Current target split.</p>
                    </div>
                    {Object.entries(data.nutritionBalance).map(([name, value]) => (
                        <div className="balance-row" key={name}>
                            <span>{name}</span>
                            <div className="progress-track"><span style={{ width: `${value}%` }}></span></div>
                            <strong>{value}%</strong>
                        </div>
                    ))}
                    <button className="secondary-action full-width" type="button">Save Goals</button>
                </div>
            </section>
        </main>
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
