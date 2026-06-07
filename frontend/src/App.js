import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const API_BASES = process.env.REACT_APP_API_URL
    ? [process.env.REACT_APP_API_URL]
    : ["http://localhost:5001", "http://localhost:5000"];

const mealTypes = ["Breakfast", "Lunch", "Dinner"];
const ingredientIconChoices = ["🍚", "🥚", "🥓", "🥬", "🥛", "🧀", "🍎", "🍅", "🥕", "🧅", "🧄", "🐟", "🍗", "🥩", "🥗"];

const savedRecipeImages = {
    "Creamy Egg Toast": "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80",
    "Simple Omelette": "https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&w=900&q=80",
    "Milk Pasta": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80"
};

const navItems = [
    { id: "fridge", label: "Fridge" },
    { id: "recipes", label: "Recipes" },
    { id: "meals", label: "Meals" },
    { id: "dashboard", label: "Dashboard" }
];

const pagePaths = {
    home: "/",
    auth: "/#/auth",
    fridge: "/#/fridge",
    recipes: "/#/recipes",
    meals: "/#/meals",
    dashboard: "/#/dashboard"
};

const protectedPages = new Set(["fridge", "recipes", "meals", "dashboard"]);

function pageFromLocation() {
    const hashPage = window.location.hash.replace("#/", "");
    return pagePaths[hashPage] ? hashPage : "home";
}

async function api(path, options = {}) {
    let lastNetworkError = null;

    for (const baseUrl of API_BASES) {
        try {
            const response = await fetch(`${baseUrl}${path}`, {
                headers: { "Content-Type": "application/json" },
                credentials: "include",
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

function EditIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 16H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
        </svg>
    );
}

function SearchIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m16.5 16.5 4 4" />
        </svg>
    );
}

function ingredientIcon(name = "") {
    const lowerName = name.toLowerCase();
    const iconMap = [
        { keys: ["rice", "밥", "쌀"], icon: "🍚" },
        { keys: ["egg", "계란", "달걀"], icon: "🥚" },
        { keys: ["ham", "햄"], icon: "🥓" },
        { keys: ["kimchi", "김치"], icon: "🥬" },
        { keys: ["milk", "우유"], icon: "🥛" },
        { keys: ["cheese", "치즈"], icon: "🧀" },
        { keys: ["apple", "사과"], icon: "🍎" },
        { keys: ["tomato", "토마토"], icon: "🍅" },
        { keys: ["carrot", "당근"], icon: "🥕" },
        { keys: ["onion", "양파"], icon: "🧅" },
        { keys: ["garlic", "마늘"], icon: "🧄" },
        { keys: ["fish", "생선"], icon: "🐟" },
        { keys: ["chicken", "닭"], icon: "🍗" },
        { keys: ["beef", "소고기"], icon: "🥩" },
        { keys: ["pork", "돼지"], icon: "🥩" },
    ];
    const match = iconMap.find(item => item.keys.some(key => lowerName.includes(key)));
    return match ? match.icon : "🥗";
}

function SectionReveal({ as: Tag = "section", className = "", delay = 0, children, style, ...props }) {
    const elementRef = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return undefined;

        const observer = new IntersectionObserver(
            entries => {
                const entry = entries[0];
                setVisible(Boolean(entry?.isIntersecting));
            },
            { threshold: 0.35, rootMargin: "0px 0px -8% 0px" }
        );

        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return (
        <Tag
            ref={elementRef}
            className={`section-reveal ${visible ? "is-visible" : ""} ${className}`.trim()}
            style={{ "--reveal-delay": `${delay}ms`, ...style }}
            {...props}
        >
            {children}
        </Tag>
    );
}

function Nav({ page, navigate, user, onLogout }) {
    const [open, setOpen] = useState(false);

    return (
        <nav className="site-nav">
            <button className="logo-button" type="button" onClick={() => navigate("home")}>
                <img src="/logo.png" width="42" height="42" alt="" />
                <span>ReciFridge</span>
            </button>

            <button className="menu-toggle" type="button" onClick={() => setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open} aria-controls="site-nav-links">
                ☰
            </button>

            <ul id="site-nav-links" className={`nav-links ${open ? "active" : ""}`}>
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
                <li>
                    <button
                        type="button"
                        onClick={() => {
                            if (user) {
                                onLogout();
                            } else {
                                navigate("auth");
                            }
                            setOpen(false);
                        }}
                    >
                        {user ? "Logout" : "Login"}
                    </button>
                </li>
            </ul>

            {/* <div className="nav-auth">
                {user ? (
                    <>
                        <span>{user.username}</span>
                        <button className="secondary-action compact-action" type="button" onClick={onLogout}>Logout</button>
                    </>
                ) : (
                    <button className="secondary-action compact-action" type="button" onClick={() => navigate("auth")}>Login</button>
                )}
            </div> */}

        </nav>
    );
}

function CountUpNumber({ value, suffix = "" }) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const target = Number(value) || 0;
        if (target === 0) {
            setDisplayValue(0);
            return undefined;
        }

        const duration = 700;
        const startedAt = performance.now();
        let frameId;

        function animate(now) {
            const progress = Math.min(1, (now - startedAt) / duration);
            setDisplayValue(Math.round(target * progress));
            if (progress < 1) {
                frameId = requestAnimationFrame(animate);
            }
        }

        frameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameId);
    }, [value]);

    return <>{displayValue.toLocaleString()}{suffix}</>;
}

function Home({ navigate, user }) {
    const highlights = [
        "Track what is inside your fridge.",
        "Use ingredients before they spoil.",
        "Get recipe ideas from what you already have."
    ];

    const [landingStats, setLandingStats] = useState({
        ingredientCount: 0,
        expiringSoonCount: 0,
        expiredCount: 0,
        mealCount: 0,
        todayCalories: 0
    });

    useEffect(() => {
        api("/api/landing-stats")
            .then(data => setLandingStats({
                ingredientCount: data.ingredientCount || 0,
                expiringSoonCount: data.expiringSoonCount || 0,
                expiredCount: data.expiredCount || 0,
                mealCount: data.mealCount || 0,
                todayCalories: data.todayCalories || 0
            }))
            .catch(() => setLandingStats({
                ingredientCount: 0,
                expiringSoonCount: 0,
                expiredCount: 0,
                mealCount: 0,
                todayCalories: 0
            }));
    }, [user]);

    const statCards = [
        { label: "Ingredients Saved", value: landingStats.ingredientCount, suffix: "", note: "items tracked in your fridge" },
        { label: "Expiring Soon", value: landingStats.expiringSoonCount, suffix: "", note: "items within 3 days", tone: "warning" },
        { label: "Expired Items", value: landingStats.expiredCount, suffix: "", note: "items already past date", tone: "danger" },
        { label: "Meals Logged", value: landingStats.mealCount, suffix: "", note: "records stored in your meal log" },
        { label: "Today Calories", value: landingStats.todayCalories, suffix: " kcal", note: "from today's meals" }
    ];

    const featureSteps = [
        {
            id: "01",
            label: "FRIDGE",
            route: "fridge",
            title: "Keep every ingredient in one clear list",
            description:
                "Add ingredients with purchase dates, expiration dates, and quantity details. Keep the oldest items visible so nothing gets forgotten at the back of the fridge.",
            action: "Manage My Fridge"
        },
        {
            id: "02",
            label: "RECIPES",
            route: "recipes",
            title: "Turn what you have into meal ideas",
            description:
                "ReciFridge checks the ingredients you already own. It recommends recipes that fit your fridge first, not a grocery list.",
            action: "Get Recipe Recommendations"
        },
        {
            id: "03",
            label: "MEALS",
            route: "meals",
            title: "Log breakfast, lunch, dinner, and snacks",
            description:
                "Record daily meals as they happen. Keep a simple history of what you ate through the day.",
            action: "Log Today\u2019s Meals"
        },
        {
            id: "04",
            label: "DASHBOARD",
            route: "dashboard",
            title: "See the big picture of your eating habits",
            description:
                "Review calorie trends, goal progress, and nutrient balance. Make your daily habits easier to understand at a glance.",
            action: "View My Dashboard"
        }
    ];

    return (
        <main className="landing-home">
            <div className="vegetable-container" aria-hidden="true">
                <span className="veg veg1">{"\u{1F955}"}</span>
                <span className="veg veg2">{"\u{1F966}"}</span>
                <span className="veg veg3">{"\u{1F345}"}</span>
                <span className="veg veg4">{"\u{1F96C}"}</span>
                <span className="veg veg5">{"\u{1F9C4}"}</span>
                <span className="veg veg6">{"\u{1F33D}"}</span>
            </div>

            <section className="landing-hero">
                <div className="landing-hero-copy">
                    <p className="eyebrow">Smart fridge helper</p>
                    <div className="hero-logo landing-logo">
                        <img src="/logo.png" alt="ReciFridge" />
                    </div>
                    <h1>ReciFridge</h1>
                    <p className="hero-subtitle">
                        Keep track of what is in your fridge. Use ingredients before they go bad. Get meal ideas from what you already have.
                    </p>
                    <div className="hero-actions">
                        <button className="hero-btn" type="button" onClick={() => navigate("fridge")}>
                            Add Ingredients
                        </button>
                        <button className="hero-btn hero-btn-secondary" type="button" onClick={() => navigate("recipes")}>
                            Get Recipe Ideas
                        </button>
                    </div>
                    <div className="hero-highlights" aria-label="Key benefits">
                        {highlights.map(item => (
                            <p key={item} className="hero-highlight">{item}</p>
                        ))}
                    </div>
                </div>

                <div className="scroll-down-arrow" aria-hidden="true">
                    &#x2193; {/* ↓ Unicode arrow */}
                </div>
            </section>


            <SectionReveal as="section" className="landing-stats" aria-label="Live ReciFridge statistics" delay={120}>
                <div className="landing-stats-heading">
                    <p className="section-label">LIVE STATS</p>
                    <h2>{user ? "Your fridge data at a glance." : "Sign in to see your live fridge stats."}</h2>
                </div>
                <div className="landing-stats-grid">
                    {statCards.map(card => (
                        <article className={`landing-stat-card ${card.tone ? `landing-stat-card-${card.tone}` : ""}`.trim()} key={card.label}>
                            <span>{card.label}</span>
                            <strong><CountUpNumber value={card.value} suffix={card.suffix} /></strong>
                            <p>{card.note}</p>
                        </article>
                    ))}
                </div>
                {!user && (
                    <div className="landing-stats-action">
                        <button
                            type="button"
                            className="landing-signin-btn"
                            onClick={() => navigate("auth")}
                        >
                            <span>Sign in</span>
                        </button>
                    </div>
                )}
            </SectionReveal>

            <SectionReveal as="section" className="landing-intro" aria-labelledby="landing-intro-title" delay={80}>
                <p className="section-label">Why It Matters</p>
                <h2 id="landing-intro-title">
                    Stop guessing what to cook<br/>
                    <span>or what to use first.</span>
                </h2>

                <p>
                    ReciFridge keeps the fridge view, recipe suggestions, meal logs, and dashboard in one place — 
                    so you can make quicker decisions and waste less food.
                </p>

                <div className="scroll-down-arrow1" onClick={() => { document.getElementById("stats-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                    <span className="scroll-label">Scroll to explore</span>
                    <span className="scroll-line"></span>
                    <span className="scroll-circle">↓</span>
                </div>
                </SectionReveal>

            <section className="feature-flow" aria-label="ReciFridge features">
                {featureSteps.map(step => (
                    <SectionReveal key={step.id} as="article" className="feature-step" delay={step.id === "01" ? 80 : step.id === "02" ? 140 : step.id === "03" ? 200 : 260}>
                        <div className="feature-step-top">
                            <div className="feature-number">{step.id}</div>
                        </div>

                        <div className="feature-text">
                            <p className="feature-label">{step.label}</p>
                            <h3>{step.title}</h3>
                            <p>{step.description}</p>
                        </div>

                        <button
                            type="button"
                            className="feature-btn"
                            onClick={() => navigate(step.route)}
                        >
                            {step.action}
                        </button>
                    </SectionReveal>
                ))}
            </section>

            <SectionReveal as="section" className="team-section" aria-label="Meet our team" delay={100}>
                <div className="team-heading">
                    <p className="section-label">Our Team</p>
                    <h2>Meet the People <br/><span>Behind ReciFridge</span></h2>
                    <p>A passionate team dedicated to reducing food waste and making cooking easier.</p>
                </div>
                <div className="team-grid">
                    <article className="team-card">
                        <div className="team-avatar">
                            <span>T</span>
                        </div>

                        <h3>Tergel Nyamlkhagva</h3>
                        <p className="team-role">Frontend Developer</p>
                        <p className="team-bio">
                            Crafting beautiful and intuitive user 
                            interfaces for the best fridge management experience.
                        </p>
                        <a
                        href="https://github.com/tergeln"
                        className="team-link"
                        target="_blank"
                        rel="noopener noreferrer">
                            GitHub Profile
                        </a>
                    </article>

                    <article className="team-card">
                        <div className="team-avatar">
                            <span>N</span>
                        </div>
                        <h3>나희</h3>
                        <p className="team-role">Frontend Developer</p>
                        <p className="team-bio">
                            Building responsive and accessible 
                            interfaces that make recipe discovery delightful.
                        </p>
                        <a href="https://github.com/happyuo"
                        className="team-link"
                        target="_blank"
                        rel="noopener noreferrer">
                            GitHub Profile
                        </a>
                    </article>

                    <article className="team-card">
                        <div className="team-avatar">
                            <span>J</span>
                        </div>
                        <h3>Jee Seoyoon</h3>
                        <p className="team-role">Backend Developer</p>
                        <p className="team-bio">
                            Developing robust APIs and 
                            database systems that power your fridge 
                            tracking seamlessly.
                        </p>
                        <a
                        href="https://github.com/jeeseoyoon"
                        className="team-link"
                        target="_blank"
                        rel="noopener noreferrer"
                        >
                            GitHub Profile
                        </a>
                    </article>

                    <article className="team-card">
                        <div className="team-avatar">
                            <span>K</span>
                        </div>
                        <h3>Ko Jehyeon</h3>
                        <p className="team-role">Backend Developer</p>
                        <p className="team-bio">
                            Implementing AI-powered recipe recommendations and smart expiry date predictions.
                        </p>
                        <a
                        href="https://github.com/rhwogus"
                        className="team-link"
                        target="_blank"
                        rel="noopener noreferrer"
                        >
                            GitHub Profile
                        </a>
                    </article>
                </div>
            </SectionReveal>

            <footer className="site-footer">
                <div className="footer-content">
                    <div className="footer-brand">
                        <div className="footer-logo">
                            <img src="/logo.png" alt="ReciFridge" />
                            <span>ReciFridge</span>
                        </div>
                        <p>Smart fridge management for a waste-free kitchen.</p>
                    </div>
                    <div className="footer-links">
                        <div className="footer-column">
                            <h4>Product</h4>
                            <button type="button" onClick={() => navigate("fridge")}>Fridge</button>
                            <button type="button" onClick={() => navigate("recipes")}>Recipes</button>
                            <button type="button" onClick={() => navigate("meals")}>Meals</button>
                            <button type="button" onClick={() => navigate("dashboard")}>Dashboard</button>
                        </div>
                        <div className="footer-column">
                            <h4>Company</h4>
                            <a href="#about">About Us</a>
                            <a href="#team">Team</a>
                            <a href="#contact">Contact</a>
                        </div>
                        <div className="footer-column">
                            <h4>Support</h4>
                            <a href="#help">Help Center</a>
                            <a href="#privacy">Privacy Policy</a>
                            <a href="#terms">Terms of Service</a>
                        </div>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>&copy; {new Date().getFullYear()} ReciFridge. All rights reserved.</p>
                    <p>Built with care to reduce food waste and inspire cooking.</p>
                </div>
            </footer>

        </main>
    );
}
function AuthPage({ onAuth, modal = false }) {
    const [mode, setMode] = useState("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            const data = await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
                method: "POST",
                body: JSON.stringify({ username, password })
            });
            setUsername("");
            setPassword("");
            onAuth(data.user);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }

    const content = (
        <>
            <section className="page-header">
                <div>
                    <p className="eyebrow">Account</p>
                    <h1 id={modal ? "auth-modal-title" : undefined}>{mode === "login" ? "Login" : "Create Account"}</h1>
                    <p>Sign in to keep your fridge, recipes, and meals separated.</p>
                </div>
            </section>

            <form className="panel auth-panel" onSubmit={handleSubmit}>
                {error && <p className="error-text">{error}</p>}
                <label>
                    Username
                    <input value={username} onChange={event => setUsername(event.target.value)} placeholder="username" required />
                </label>
                <label>
                    Password
                    <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="password" required />
                </label>
                <button className="primary-action full-width" type="submit" disabled={loading}>
                    {loading ? "Processing..." : mode === "login" ? "Login" : "Register"}
                </button>
                <button
                    className="secondary-action full-width"
                    type="button"
                    onClick={() => {
                        setError("");
                        setMode(mode === "login" ? "register" : "login");
                    }}
                >
                    {mode === "login" ? "Create a new account" : "Already have an account"}
                </button>
            </form>
        </>
    );

    if (modal) {
        return <div className="auth-modal-content">{content}</div>;
    }

    return (
        <main className="page-shell auth-shell">
            {content}
        </main>
    );
}

function RequireAuth({ user, onAuth, children }) {
    if (!user) {
        return null;
    }
    return children;
}

function useBodyScrollLock(locked) {
    useEffect(() => {
        if (!locked) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [locked]);
}

function useSmoothPageScroll() {
    useEffect(() => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduceMotion) return undefined;

        let targetY = window.scrollY;
        let frameId = null;

        function canScrollElement(element, deltaY) {
            if (!element || element === document.body || element === document.documentElement) {
                return false;
            }
            const style = window.getComputedStyle(element);
            const scrollable = /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
            if (!scrollable) return false;
            if (deltaY > 0) return element.scrollTop + element.clientHeight < element.scrollHeight;
            return element.scrollTop > 0;
        }

        function findScrollableParent(element, deltaY) {
            let current = element;
            while (current && current !== document.body) {
                if (canScrollElement(current, deltaY)) return current;
                current = current.parentElement;
            }
            return null;
        }

        function animate() {
            const currentY = window.scrollY;
            const distance = targetY - currentY;
            if (Math.abs(distance) < 0.5) {
                window.scrollTo(0, targetY);
                frameId = null;
                return;
            }
            window.scrollTo(0, currentY + distance * 0.18);
            frameId = requestAnimationFrame(animate);
        }

        function handleWheel(event) {
            if (event.ctrlKey || event.metaKey || event.shiftKey) return;
            if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
            if (event.target instanceof Element && findScrollableParent(event.target, event.deltaY)) return;

            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (maxScroll <= 0) return;

            event.preventDefault();
            targetY = Math.max(0, Math.min(maxScroll, targetY + event.deltaY * 0.82));
            if (frameId === null) {
                frameId = requestAnimationFrame(animate);
            }
        }

        window.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            window.removeEventListener("wheel", handleWheel);
            if (frameId !== null) cancelAnimationFrame(frameId);
        };
    }, []);
}

function AppModal({ open, onClose, titleId, className = "", as: Tag = "section", onSubmit, children }) {
    useBodyScrollLock(open);

    if (!open) return null;

    return createPortal(
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <Tag className={`app-modal ${className}`} onSubmit={onSubmit}>
                <button className="modal-close" type="button" onClick={onClose} aria-label="Close">
                    X
                </button>
                {children}
            </Tag>
        </div>,
        document.body
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
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editExpiresAt, setEditExpiresAt] = useState("");
    const [editIcon, setEditIcon] = useState("");
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const [showIngredientModal, setShowIngredientModal] = useState(false);
    const [ingredientActionMode, setIngredientActionMode] = useState("");
    const [highlightedIngredientId, setHighlightedIngredientId] = useState(null);
    const [flyingIngredientId, setFlyingIngredientId] = useState(null);
    const [ingredientToastLeaving, setIngredientToastLeaving] = useState(false);

    const loadIngredients = useCallback(async (search = query) => {
        const data = await api(`/api/ingredients?q=${encodeURIComponent(search)}`);
        setIngredients(data);
    }, [query]);

    useEffect(() => {
        loadIngredients("").catch(error => setError(error.message));
    }, [loadIngredients]);

    useEffect(() => {
        if (!notice && !error) return undefined;
        setIngredientToastLeaving(false);
        const leaveTimeoutId = setTimeout(() => {
            setIngredientToastLeaving(true);
        }, 1500);
        const clearTimeoutId = setTimeout(() => {
            setNotice("");
            setError("");
            setIngredientToastLeaving(false);
        }, 1900);
        return () => {
            clearTimeout(leaveTimeoutId);
            clearTimeout(clearTimeoutId);
        };
    }, [notice, error]);

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
            setShowIngredientModal(false);
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

    async function handleDeleteIngredient(item) {
        setError("");
        setNotice("");
        setUpdatingId(item.id);
        setFlyingIngredientId(item.id);

        try {
            await new Promise(resolve => setTimeout(resolve, 520));
            await api(`/api/ingredients/id/${item.id}`, { method: "DELETE" });
            setNotice(`${item.name} removed from your fridge.`);
            await loadIngredients();
        } catch (error) {
            setError(error.message);
        } finally {
            setUpdatingId(null);
            setFlyingIngredientId(null);
        }
    }

    function startEditingIngredient(item) {
        setError("");
        setNotice("");
        setEditingId(item.id);
        setEditName(item.name);
        setEditExpiresAt(item.expiresAt || "");
        setEditIcon(item.icon || ingredientIcon(item.name));
        setShowIconPicker(false);
        setIngredientActionMode("");
    }

    function cancelEditingIngredient() {
        setEditingId(null);
        setEditName("");
        setEditExpiresAt("");
        setEditIcon("");
        setShowIconPicker(false);
    }

    function startIngredientActionMode(mode) {
        cancelEditingIngredient();
        setError("");
        setNotice("");
        setIngredientActionMode(mode);
    }

    function handleIngredientCardSelect(item) {
        if (ingredientActionMode === "edit") {
            startEditingIngredient(item);
            return;
        }
        if (ingredientActionMode === "delete") {
            handleDeleteIngredient(item);
            setIngredientActionMode("");
        }
    }

    async function handleUpdateIngredient(event) {
        event.preventDefault();
        const item = ingredients.find(item => item.id === editingId);
        if (!item) return;

        const nextName = editName.trim();
        if (!nextName) {
            setError("Ingredient name is required.");
            return;
        }

        setError("");
        setNotice("");
        setUpdatingId(item.id);

        try {
            await api(`/api/ingredients/id/${item.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                    name: nextName,
                    expiresAt: editExpiresAt || "",
                    icon: editIcon || ingredientIcon(nextName)
                })
            });
            setNotice(`${nextName} updated.`);
            cancelEditingIngredient();
            await loadIngredients(query);
            setHighlightedIngredientId(item.id);
            setTimeout(() => setHighlightedIngredientId(null), 1400);
        } catch (error) {
            setError(error.message);
        } finally {
            setUpdatingId(null);
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
                <button className="primary-action" type="button" onClick={() => setShowIngredientModal(true)}>
                    Add Ingredient
                </button>
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

            <section className="fridge-overview-grid">
                <div className="panel inventory-panel">
                    {ingredientActionMode && !(error || notice) && (
                        <div className={`ingredient-mode-hint ${ingredientActionMode === "delete" ? "danger" : ""}`}>
                            <span>{ingredientActionMode === "edit" ? "Select an ingredient to edit" : "Select an ingredient to delete"}</span>
                            <button type="button" onClick={() => setIngredientActionMode("")} aria-label="Cancel selection mode">
                                X
                            </button>
                        </div>
                    )}
                    <div className="panel-heading split-heading">
                        <div>
                            <h2>Current Fridge</h2>
                            <p>{ingredients.length} ingredients available</p>
                        </div>
                        <div className="inventory-tools">
                            <form className="search-box" onSubmit={handleSearch}>
                                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search" />
                                <button className="search-icon-button" type="submit" aria-label="Search ingredients" title="Search ingredients">
                                    <SearchIcon />
                                </button>
                            </form>
                        </div>
                    </div>

                    {(error || notice) && (
                        <div className={`ingredient-mode-hint ${error ? "danger" : ""} status ${ingredientToastLeaving ? "is-leaving" : ""}`}>
                            <span>{error || notice}</span>
                        </div>
                    )}

                    <div className="ingredient-edit-fields">
                        <div className="ingredient-bulk-actions" role="group" aria-label="Inventory actions">
                            <button
                                className={`icon-action ${ingredientActionMode === "edit" ? "is-active" : ""}`}
                                type="button"
                                onClick={() => startIngredientActionMode("edit")}
                                title="Select an ingredient to edit"
                                aria-label="Select an ingredient to edit"
                            >
                                <EditIcon />
                            </button>
                            <button
                                className={`icon-action icon-action-danger ${ingredientActionMode === "delete" ? "is-active" : ""}`}
                                type="button"
                                onClick={() => startIngredientActionMode("delete")}
                                title="Select an ingredient to delete"
                                aria-label="Select an ingredient to delete"
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    </div>

                    <div className="inventory-list">
                        {ingredients.length > 0 ? ingredients.map(item => (
                            <button
                                className={`ingredient-card ${ingredientActionMode ? "selectable" : ""} ${item.daysLeft !== null && item.daysLeft < 0 ? "expired" : item.daysLeft !== null && item.daysLeft <= 3 ? "warning" : ""} ${editingId === item.id ? "selected" : ""} ${highlightedIngredientId === item.id ? "updated" : ""} ${flyingIngredientId === item.id ? "fly-away" : ""}`}
                                key={item.id}
                                type="button"
                                onClick={() => handleIngredientCardSelect(item)}
                                disabled={!ingredientActionMode || updatingId === item.id || flyingIngredientId === item.id}
                                aria-label={ingredientActionMode ? `${ingredientActionMode} ${item.name}` : item.name}
                            >
                                <span className="ingredient-card-icon" aria-hidden="true">{item.icon || ingredientIcon(item.name)}</span>
                                <strong>{item.name}</strong>
                                <span>{item.expiresAt || "No expiration date"}</span>
                                <small className={`status-pill ${item.daysLeft !== null && item.daysLeft < 0 ? "expired" : item.daysLeft !== null && item.daysLeft <= 3 ? "urgent" : ""}`}>
                                    {formatExpiry(item)}
                                </small>
                            </button>
                        )) : <div className="empty-state">No ingredients found.</div>}
                    </div>
                </div>
            </section>

            <AppModal
                open={showIngredientModal}
                onClose={() => setShowIngredientModal(false)}
                titleId="ingredient-modal-title"
                className="form-modal"
                as="form"
                onSubmit={handleAdd}
            >
                <div className="modal-content">
                    <p className="eyebrow">New ingredient</p>
                    <h2 id="ingredient-modal-title">Add Ingredient</h2>
                    <p>Leave the date empty to let AI estimate a practical expiry date.</p>
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
                </div>
            </AppModal>

            <AppModal
                open={Boolean(editingId)}
                onClose={cancelEditingIngredient}
                titleId="edit-ingredient-modal-title"
                className="form-modal"
                as="form"
                onSubmit={handleUpdateIngredient}
            >
                <div className="modal-content">
                    <p className="eyebrow">Edit ingredient</p>
                    <h2 id="edit-ingredient-modal-title">Edit Ingredient</h2>
                    <p>Update the ingredient name or expiry date.</p>
                    <div className="ingredient-icon-editor">
                        <span className="ingredient-edit-icon" aria-hidden="true">{editIcon || ingredientIcon(editName)}</span>
                        <button
                            className="ingredient-icon-edit-button"
                            type="button"
                            onClick={() => setShowIconPicker(open => !open)}
                            aria-label="Change ingredient icon"
                            title="Change ingredient icon"
                        >
                            <EditIcon />
                        </button>
                    </div>
                    {showIconPicker && (
                        <div className="ingredient-icon-grid" aria-label="Ingredient icon choices">
                            {ingredientIconChoices.map(icon => (
                                <button
                                    className={editIcon === icon ? "selected" : ""}
                                    type="button"
                                    key={icon}
                                    onClick={() => {
                                        setEditIcon(icon);
                                        setShowIconPicker(false);
                                    }}
                                    aria-label={`Use ${icon} icon`}
                                >
                                    {icon}
                                </button>
                            ))}
                        </div>
                    )}
                    <label>
                        Ingredient name
                        <input
                            value={editName}
                            onChange={event => setEditName(event.target.value)}
                            placeholder="Ingredient name"
                            required
                        />
                    </label>
                    <label>
                        Expiry date
                        <input
                            type="date"
                            value={editExpiresAt}
                            onChange={event => setEditExpiresAt(event.target.value)}
                        />
                    </label>
                    <button className="primary-action full-width" type="submit" disabled={updatingId === editingId}>
                        {updatingId === editingId ? "Saving..." : "Save Changes"}
                    </button>
                    <button className="secondary-action full-width" type="button" onClick={cancelEditingIngredient}>
                        Cancel
                    </button>
                </div>
            </AppModal>
        </main>
    );
}

function RecipeCard({ recipe, ai, compact, onSave, saveDisabled, saving }) {
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [imageBroken, setImageBroken] = useState(false);
    const steps = recipe.steps || [];
    const imageUrl = recipe.imageUrl || savedRecipeImages[recipe.name];
    const showImage = imageUrl && !imageBroken;
    const ingredients = recipe.ingredients || [];

    return (
        <>
        <article className={`recipe-card ${ai ? "ai-card" : ""} ${compact ? "compact-recipe-card" : ""}`}>
            <div className={`recipe-image ${showImage ? "has-image" : ""}`} aria-hidden="true">
                {showImage ? <img src={imageUrl} alt="" onError={() => setImageBroken(true)} /> : <span></span>}
                <div className="recipe-image-shade"></div>
                {!compact && (
                    <div className="recipe-image-meta">
                        {ai ? <span className="ai-badge">AI pick</span> : <span>Kitchen favorite</span>}
                        <strong>{recipe.calories || 0} kcal</strong>
                    </div>
                )}
            </div>
            <div className="recipe-content">
                <div className="recipe-title-row">
                    <h3>{recipe.name}</h3>
                    {ai && !compact && <span className="ai-badge">AI</span>}
                </div>
                {!compact && (
                    <>
                        {recipe.description && <p>{recipe.description}</p>}
                        <div className="tag-list">
                            {ingredients.slice(0, 6).map(ingredient => (
                                <span key={ingredient}>{ingredient}</span>
                            ))}
                        </div>
                        {(recipe.estimatedTime || recipe.difficulty) && (
                            <div className="recipe-meta-row">
                                {recipe.estimatedTime && <span>{recipe.estimatedTime}</span>}
                                {recipe.difficulty && <span>{recipe.difficulty}</span>}
                            </div>
                        )}
                        {recipe.missingIngredients?.length > 0 && (
                            <p className="muted-text">Missing: {recipe.missingIngredients.join(", ")}</p>
                        )}
                        {recipe.tips?.length > 0 && (
                            <div className="tip-box">
                                <strong>Tip</strong>
                                <p>{recipe.tips.slice(0, 2).join(" ")}</p>
                            </div>
                        )}
                    </>
                )}
                {compact && (
                    <div className="compact-recipe-meta">
                        <span>{recipe.estimatedTime || "Quick meal"}</span>
                        <span>{recipe.calories || 0} kcal</span>
                    </div>
                )}
                <div className="recipe-footer">
                    {!compact && <span>{ingredients.length} ingredients</span>}
                    <div className="recipe-footer-actions">
                        {onSave && (
                            <button
                                className={saveDisabled ? "secondary-action" : "primary-action"}
                                type="button"
                                onClick={() => onSave(recipe)}
                                disabled={saveDisabled || saving}
                            >
                                {saving ? "Saving..." : saveDisabled ? "Saved" : "Save Recipe"}
                            </button>
                        )}
                        <button
                            className="secondary-action"
                            type="button"
                            onClick={() => setShowRecipeModal(true)}
                            disabled={steps.length === 0}
                        >
                            Cook Now
                        </button>
                    </div>
                </div>
            </div>
        </article>
        <AppModal
            open={showRecipeModal}
            onClose={() => setShowRecipeModal(false)}
            titleId={`recipe-modal-${recipe.id}`}
            className="recipe-modal"
        >
            <div className={`recipe-modal-image ${showImage ? "has-image" : ""}`}>
                {showImage ? <img src={imageUrl} alt="" /> : <span></span>}
            </div>
            <div className="modal-content recipe-modal-content">
                <p className="eyebrow">{ai ? "AI cooking guide" : "Saved recipe"}</p>
                <h3 id={`recipe-modal-${recipe.id}`}>{recipe.name}</h3>
                {recipe.description && <p>{recipe.description}</p>}
                <div className="recipe-modal-meta">
                    <span>{recipe.estimatedTime || "Quick meal"}</span>
                    <span>{recipe.difficulty || "Easy"}</span>
                    <span>{recipe.calories || 0} kcal</span>
                </div>
                <ol className="steps-list expanded">
                    {steps.map((step, index) => (
                        <li key={`${step}-${index}`}>{step}</li>
                    ))}
                </ol>
                {recipe.tips?.length > 0 && (
                    <div className="tip-box">
                        <strong>Tip</strong>
                        <p>{recipe.tips.slice(0, 2).join(" ")}</p>
                    </div>
                )}
            </div>
        </AppModal>
        </>
    );
}

function Recipes() {
    const [recipes, setRecipes] = useState([]);
    const [aiRecipes, setAiRecipes] = useState([]);
    const [aiMessage, setAiMessage] = useState("");
    const [suggestedQuestions, setSuggestedQuestions] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [loadingAi, setLoadingAi] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);
    const [savingRecipeName, setSavingRecipeName] = useState("");
    const [error, setError] = useState("");

    const loadRecipes = useCallback(async () => {
        const data = await api("/api/recipes");
        setRecipes(data);
    }, []);

    useEffect(() => {
        loadRecipes().catch(error => setError(error.message));
    }, [loadRecipes]);

    const savedRecipeNames = useMemo(
        () => new Set(recipes.filter(recipe => recipe.saved).map(recipe => recipe.name)),
        [recipes]
    );

    async function handleRecommend() {
        setError("");
        setAiMessage("");
        setLoadingAi(true);

        try {
            const data = await api("/api/recommend", { method: "POST", body: "{}" });
            setAiRecipes(data.recipes || []);
            setAiMessage(data.chat_reply || "");
            setSuggestedQuestions(data.suggested_questions || []);
            setChatMessages(data.chat_reply ? [{ role: "assistant", text: data.chat_reply }] : []);
            if (data.error) {
                setError(data.error);
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setLoadingAi(false);
        }
    }


    async function handleAskAi(questionText = chatInput) {
        const question = questionText.trim();
        if (!question || chatLoading) return;

        setError("");
        setChatInput("");
        setChatMessages(messages => [...messages, { role: "user", text: question }]);
        setChatLoading(true);

        try {
            const data = await api("/api/chat", {
                method: "POST",
                body: JSON.stringify({ question, recipes: aiRecipes })
            });
            setChatMessages(messages => [...messages, { role: "assistant", text: data.reply || "답변을 만들지 못했어요." }]);
            setSuggestedQuestions(data.suggested_questions || []);
            if (data.error) {
                setError(data.error);
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setChatLoading(false);
        }
    }

    async function handleSaveRecipe(recipe) {
        setError("");
        setAiMessage("");
        setSavingRecipeName(recipe.name);

        try {
            await api("/api/recipes", {
                method: "POST",
                body: JSON.stringify(recipe)
            });
            await loadRecipes();
            setAiMessage(`${recipe.name} saved to Saved Recipes.`);
        } catch (error) {
            setError(error.message);
        } finally {
            setSavingRecipeName("");
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
                        {aiRecipes.map(recipe => (
                            <RecipeCard
                                recipe={recipe}
                                ai
                                key={recipe.id}
                                onSave={handleSaveRecipe}
                                saveDisabled={savedRecipeNames.has(recipe.name)}
                                saving={savingRecipeName === recipe.name}
                            />
                        ))}
                    </div>
                    <div className="ai-chat-panel">
                        <div className="ai-chat-header">
                            <div>
                                <h3>Ask AI about these recipes</h3>
                                <p>재료 대체, 조리 순서, 칼로리 조절처럼 궁금한 걸 이어서 물어볼 수 있어요.</p>
                            </div>
                        </div>
                        <div className="chat-thread">
                            {chatMessages.map((message, index) => (
                                <div className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
                                    {message.text}
                                </div>
                            ))}
                            {chatLoading && <div className="chat-bubble assistant">답변을 준비하고 있어요...</div>}
                        </div>
                        {suggestedQuestions.length > 0 && (
                            <div className="question-chips">
                                {suggestedQuestions.map(question => (
                                    <button type="button" key={question} onClick={() => handleAskAi(question)}>
                                        {question}
                                    </button>
                                ))}
                            </div>
                        )}
                        <form className="chat-form" onSubmit={event => { event.preventDefault(); handleAskAi(); }}>
                            <input
                                type="text"
                                value={chatInput}
                                onChange={event => setChatInput(event.target.value)}
                                placeholder="예: 버터 없이 만들 수 있어?"
                            />
                            <button className="primary-action" type="submit" disabled={chatLoading || !chatInput.trim()}>
                                Ask
                            </button>
                        </form>
                    </div>
                </section>
            )}

            <section className="section-block">
                <div className="section-title recipe-library-title">
                    <div>
                        <p className="eyebrow">Recipe library</p>
                        <h2>Saved Recipes</h2>
                    </div>
                    <p>Reliable starter ideas with food photography, ingredients, and quick calorie context.</p>
                </div>
                <div className="recipe-grid">
                    {recipes.map(recipe => <RecipeCard recipe={recipe} compact key={recipe.id} />)}
                </div>
            </section>
        </main>
    );
}

function Meals() {
    const [meals, setMeals] = useState([]);
    const [type, setType] = useState("Breakfast");
    const [name, setName] = useState("");
    const [calories, setCalories] = useState("");
    const [autoNutrition, setAutoNutrition] = useState(true);
    const [notice, setNotice] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [showMealModal, setShowMealModal] = useState(false);
    const [editingMeal, setEditingMeal] = useState(null);
    const [editMealType, setEditMealType] = useState("Breakfast");
    const [editMealName, setEditMealName] = useState("");
    const [editMealCalories, setEditMealCalories] = useState("");
    const [updatingMealId, setUpdatingMealId] = useState(null);
    const [deletingMeal, setDeletingMeal] = useState(null);

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
        setNotice("");
        setSaving(true);

        try {
            const created = await api("/api/meals", {
                method: "POST",
                body: JSON.stringify({
                    type,
                    name,
                    calories: calories ? Number(calories) : null,
                    autoNutrition
                })
            });
            setType("Breakfast");
            setName("");
            setCalories("");
            setShowMealModal(false);
            await loadMeals();
            if (created.aiMessage) {
                setNotice(created.aiMessage);
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setSaving(false);
        }
    }

    function startEditingMeal(meal) {
        setError("");
        setNotice("");
        setEditingMeal(meal);
        setEditMealType(meal.type || "Breakfast");
        setEditMealName(meal.name || "");
        setEditMealCalories(String(meal.calories || 0));
    }

    function cancelEditingMeal() {
        setEditingMeal(null);
        setEditMealType("Breakfast");
        setEditMealName("");
        setEditMealCalories("");
        setUpdatingMealId(null);
    }

    async function handleUpdateMeal(event) {
        event.preventDefault();
        if (!editingMeal) return;

        const nextName = editMealName.trim();
        if (!nextName) {
            setError("Meal name is required.");
            return;
        }

        setError("");
        setNotice("");
        setUpdatingMealId(editingMeal.id);

        try {
            await api(`/api/meals/${editingMeal.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                    type: editMealType,
                    name: nextName,
                    calories: editMealCalories ? Number(editMealCalories) : 0
                })
            });
            setNotice(`${nextName} updated.`);
            cancelEditingMeal();
            await loadMeals();
        } catch (error) {
            setError(error.message);
        } finally {
            setUpdatingMealId(null);
        }
    }

    function startDeletingMeal(meal) {
        setError("");
        setNotice("");
        setDeletingMeal(meal);
    }

    function cancelDeletingMeal() {
        setDeletingMeal(null);
        setUpdatingMealId(null);
    }

    async function handleDeleteMeal(meal = deletingMeal || editingMeal) {
        if (!meal) return;

        setError("");
        setNotice("");
        setUpdatingMealId(meal.id);

        try {
            await api(`/api/meals/${meal.id}`, { method: "DELETE" });
            setNotice(`${meal.name} removed from meal history.`);
            if (editingMeal?.id === meal.id) {
                cancelEditingMeal();
            }
            cancelDeletingMeal();
            await loadMeals();
        } catch (error) {
            setError(error.message);
        } finally {
            setUpdatingMealId(null);
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
                <button className="primary-action" type="button" onClick={() => setShowMealModal(true)}>
                    Add Meal
                </button>
            </section>

            <section className="meal-overview-grid">
                <div className="panel meal-calorie-panel">
                    <div className="panel-heading">
                        <h2>Today's Calories</h2>
                        <p>{total} / 2000 kcal</p>
                    </div>
                    <div className="progress-track">
                        <span style={{ width: `${progress}%` }}></span>
                    </div>
                    {error && <p className="error-text">{error}</p>}
                    {notice && <p className="success-text">{notice}</p>}
                </div>

                <div className="panel meal-list-panel">
                    <div className="panel-heading split-heading">
                        <div>
                            <h2>Meal History</h2>
                            <p>{meals.length} records saved</p>
                        </div>
                    </div>
                    <div className="inventory-list">
                        {meals.map(meal => (
                            <article className="list-item meal-row" key={meal.id}>
                                <span>{meal.type}</span>
                                <div className="meal-main">
                                    <strong>{meal.name}</strong>
                                    <small>{meal.protein || 0}g protein / {meal.carbs || 0}g carbs / {meal.fat || 0}g fat</small>
                                </div>
                                <span>{meal.calories} kcal</span>
                                <div className="meal-actions">
                                    <button
                                        className="icon-action"
                                        type="button"
                                        onClick={() => startEditingMeal(meal)}
                                        aria-label={`Edit ${meal.name}`}
                                        title={`Edit ${meal.name}`}
                                    >
                                        <EditIcon />
                                    </button>
                                    <button
                                        className="icon-action icon-action-danger"
                                        type="button"
                                        onClick={() => startDeletingMeal(meal)}
                                        disabled={updatingMealId === meal.id}
                                        aria-label={`Delete ${meal.name}`}
                                        title={`Delete ${meal.name}`}
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <AppModal
                open={showMealModal}
                onClose={() => setShowMealModal(false)}
                titleId="meal-modal-title"
                className="form-modal"
                as="form"
                onSubmit={handleAdd}
            >
                <div className="modal-content">
                    <p className="eyebrow">New record</p>
                    <h2 id="meal-modal-title">Add Meal</h2>
                    <p>Save a quick meal record and let AI estimate nutrition when calories are blank.</p>
                    <div className="meal-type-control" role="group" aria-label="Meal type">
                        {mealTypes.map(mealType => (
                            <button
                                className={type === mealType ? "selected" : ""}
                                type="button"
                                key={mealType}
                                onClick={() => setType(mealType)}
                            >
                                {mealType}
                            </button>
                        ))}
                    </div>
                    <input value={name} onChange={event => setName(event.target.value)} placeholder="Food name" required />
                    <input
                        type="number"
                        min="0"
                        value={calories}
                        onChange={event => setCalories(event.target.value)}
                        placeholder="kcal (optional)"
                    />
                    <label className="check-row">
                        <input type="checkbox" checked={autoNutrition} onChange={event => setAutoNutrition(event.target.checked)} />
                        <span>Use AI nutrition estimate</span>
                    </label>
                    <button className="primary-action full-width" type="submit" disabled={saving}>
                        {saving ? "Estimating..." : "Add Record"}
                    </button>
                </div>
            </AppModal>

            <AppModal
                open={Boolean(editingMeal)}
                onClose={cancelEditingMeal}
                titleId="edit-meal-modal-title"
                className="form-modal"
                as="form"
                onSubmit={handleUpdateMeal}
            >
                <div className="modal-content">
                    <div className="modal-title-row">
                        <div>
                            <p className="eyebrow">Edit record</p>
                            <h2 id="edit-meal-modal-title">Edit Meal</h2>
                        </div>
                    </div>
                    <p>Update this meal record or remove it from your history.</p>
                    <div className="meal-type-control" role="group" aria-label="Meal type">
                        {mealTypes.map(mealType => (
                            <button
                                className={editMealType === mealType ? "selected" : ""}
                                type="button"
                                key={mealType}
                                onClick={() => setEditMealType(mealType)}
                            >
                                {mealType}
                            </button>
                        ))}
                    </div>
                    <input value={editMealName} onChange={event => setEditMealName(event.target.value)} placeholder="Food name" required />
                    <input
                        type="number"
                        min="0"
                        value={editMealCalories}
                        onChange={event => setEditMealCalories(event.target.value)}
                        placeholder="kcal"
                    />
                    <button className="primary-action full-width" type="submit" disabled={updatingMealId === editingMeal?.id}>
                        {updatingMealId === editingMeal?.id ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </AppModal>

            <AppModal
                open={Boolean(deletingMeal)}
                onClose={cancelDeletingMeal}
                titleId="delete-meal-modal-title"
                className="form-modal"
            >
                <div className="modal-content">
                    <div className="modal-title-row">
                        <div>
                            <p className="eyebrow">Delete record</p>
                            <h2 id="delete-meal-modal-title">Delete Meal</h2>
                        </div>
                    </div>
                    <p>{deletingMeal ? `${deletingMeal.name} will be removed from your meal history.` : "This meal will be removed from your history."}</p>
                    <div className="modal-action-row">
                        <button
                            className="danger-action full-width"
                            type="button"
                            onClick={() => handleDeleteMeal(deletingMeal)}
                            disabled={updatingMealId === deletingMeal?.id}
                        >
                            {updatingMealId === deletingMeal?.id ? "Deleting..." : "Delete Meal"}
                        </button>
                        <button className="secondary-action full-width" type="button" onClick={cancelDeletingMeal}>
                            Cancel
                        </button>
                    </div>
                </div>
            </AppModal>
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
                <div className="metric-card">
                    <span>Meals Logged</span>
                    <strong>{data.mealCount || 0}</strong>
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
                    <div className="macro-summary">
                        <span>Protein {data.macroTotals?.protein || 0}g</span>
                        <span>Carbs {data.macroTotals?.carbs || 0}g</span>
                        <span>Fat {data.macroTotals?.fat || 0}g</span>
                    </div>
                </div>
            </section>
        </main>
    );
}

function App() {
    const [page, setPage] = useState(pageFromLocation);
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [pendingPage, setPendingPage] = useState("");

    function navigate(nextPage) {
        if (nextPage === "auth") {
            setPendingPage("");
            setAuthModalOpen(true);
            setPage("home");
            window.history.pushState({}, "", pagePaths.home);
            return;
        }

        if (protectedPages.has(nextPage) && !user) {
            setPendingPage(nextPage);
            setAuthModalOpen(true);
            setPage("home");
            window.history.pushState({}, "", pagePaths.home);
            return;
        }

        setPage(nextPage);
        window.history.pushState({}, "", pagePaths[nextPage]);
    }

    useEffect(() => {
        api("/api/auth/me")
            .then(data => setUser(data.user || null))
            .catch(() => setUser(null))
            .finally(() => setAuthLoading(false));
    }, []);

    useEffect(() => {
        if (authLoading || user || !protectedPages.has(page)) return;
        setPendingPage(page);
        setAuthModalOpen(true);
        setPage("home");
        window.history.replaceState({}, "", pagePaths.home);
    }, [authLoading, page, user]);

    async function handleLogout() {
        await api("/api/auth/logout", { method: "POST", body: "{}" });
        setUser(null);
        navigate("home");
    }

    useEffect(() => {
        function handlePopState() {
            const nextPage = pageFromLocation();
            if (protectedPages.has(nextPage) && !user) {
                setPendingPage(nextPage);
                setAuthModalOpen(true);
                setPage("home");
                window.history.replaceState({}, "", pagePaths.home);
                return;
            }
            setPage(nextPage);
        }

        window.addEventListener("popstate", handlePopState);
        window.addEventListener("hashchange", handlePopState);
        return () => {
            window.removeEventListener("popstate", handlePopState);
            window.removeEventListener("hashchange", handlePopState);
        };
    }, [user]);

    function handleAuth(user) {
        const nextPage = pendingPage || "fridge";
        setUser(user);
        setAuthModalOpen(false);
        setPendingPage("");
        setPage(nextPage);
        window.history.pushState({}, "", pagePaths[nextPage]);
    }

    if (authLoading) {
        return <main className="page-shell"><section className="page-header"><h1>Loading...</h1></section></main>;
    }

    return (
        <>
            <Nav page={page} navigate={navigate} user={user} onLogout={handleLogout}></Nav>
            {page === "home" && <Home navigate={navigate} user={user}></Home>}
            {page === "auth" && <Home navigate={navigate}></Home>}
            {page === "fridge" && <RequireAuth user={user} onAuth={setUser}><Fridge></Fridge></RequireAuth>}
            {page === "recipes" && <RequireAuth user={user} onAuth={setUser}><Recipes></Recipes></RequireAuth>}
            {page === "meals" && <RequireAuth user={user} onAuth={setUser}><Meals></Meals></RequireAuth>}
            {page === "dashboard" && <RequireAuth user={user} onAuth={setUser}><Dashboard></Dashboard></RequireAuth>}
            <AppModal
                open={authModalOpen}
                onClose={() => {
                    setAuthModalOpen(false);
                    setPendingPage("");
                }}
                titleId="auth-modal-title"
                className="auth-modal"
            >
                <AuthPage onAuth={handleAuth} modal />
            </AppModal>
        </>
    );
}

export default App;
