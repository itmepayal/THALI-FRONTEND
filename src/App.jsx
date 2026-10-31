import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

// Backend ka base URL. Apne server ke hisaab se badal lo.
const API = "http://localhost:8000";

/* ---------------------------------- auth helpers ---------------------------------- */

const api = axios.create({ baseURL: API });

const getToken = () => localStorage.getItem("token");

function readUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// Reads the expiry time from the JWT (the server still verifies the signature)
function tokenExpiry(token) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// Every request carries the saved token: Authorization: Bearer <token>
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the server rejects the token, tell the app to log the user out
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || "";
    const skip = ["/login", "/signUp", "/logout"].some((u) => url.includes(u));
    const status = err.response?.status;
    const msg = String(
      err.response?.data?.error || err.response?.data?.message || "",
    );
    const tokenProblem =
      status === 401 || (status === 403 && /token|expired|session/i.test(msg));
    if (tokenProblem && getToken() && !skip) {
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(err);
  },
);

function authErrorMessage(err) {
  if (!err.response)
    return "Cannot reach the server. Check that the backend is running.";
  const raw = err.response.data?.error || err.response.data?.message || "";
  if (/already/i.test(raw))
    return "This email is already registered. Try logging in instead.";
  if (/invalid|invaild|credential|crediential/i.test(raw))
    return "Incorrect email or password.";
  return raw || "Something went wrong. Please try again.";
}

// Backend khali ho ya band ho tab ye sample recipes dikhenge
const SAMPLE_RECIPES = [
  {
    _id: "s1",
    title: "Paneer butter masala",
    ingredients: ["Paneer", "Tomato", "Butter", "Cream", "Kasuri methi"],
    time: "35 min",
    instructions:
      "Blend boiled tomatoes into a smooth puree.\nMelt butter, add the puree and simmer for 10 minutes.\nStir in cream, kasuri methi and salt.\nAdd paneer cubes and cook for 5 minutes. Serve hot.",
  },
  {
    _id: "s2",
    title: "Masala omelette",
    ingredients: ["Eggs", "Onion", "Green chilli", "Coriander"],
    time: "10 min",
    instructions:
      "Beat the eggs with salt.\nMix in chopped onion, chilli and coriander.\nPour on a hot buttered pan and cook until set. Fold and serve.",
  },
  {
    _id: "s3",
    title: "Aloo paratha",
    ingredients: ["Wheat flour", "Potato", "Ajwain", "Ghee"],
    time: "30 min",
    instructions:
      "Knead a soft dough with flour and water.\nMash boiled potato with ajwain, salt and spices.\nStuff, roll and cook on a hot tawa with ghee until golden.",
  },
  {
    _id: "s4",
    title: "Creamy white sauce pasta",
    ingredients: ["Pasta", "Milk", "Butter", "Garlic", "Oregano"],
    time: "25 min",
    instructions:
      "Boil the pasta until just tender.\nSauté garlic in butter, whisk in flour and then milk.\nSimmer until thick, add oregano and pasta, and toss.",
  },
  {
    _id: "s5",
    title: "Veg fried rice",
    ingredients: ["Rice", "Carrot", "Beans", "Soy sauce", "Spring onion"],
    time: "20 min",
    instructions:
      "Use cooked, cooled rice.\nStir-fry chopped vegetables on high heat.\nAdd rice and soy sauce, toss well and finish with spring onion.",
  },
  {
    _id: "s6",
    title: "Chicken curry",
    ingredients: ["Chicken", "Onion", "Tomato", "Garam masala", "Curd"],
    time: "50 min",
    instructions:
      "Brown the onions, then add tomato and spices.\nAdd marinated chicken and cook covered for 25 minutes.\nFinish with garam masala and rest for 5 minutes.",
  },
];

const QUICK_PICKS = ["Paneer", "Rice", "Eggs", "Potato", "Chicken"];

const CARD_TINTS = [
  "#F6B93B",
  "#D4412F",
  "#2F6B4F",
  "#8B5E83",
  "#E58E26",
  "#4F7CAC",
];

const TIME_FILTERS = [
  { id: "all", label: "All" },
  { id: "20", label: "Under 20 min" },
  { id: "40", label: "Under 40 min" },
  { id: "fav", label: "Favourites" },
];

// Hero recipe: quantities scale with servings (base = 3)
const BASE_SERVINGS = 3;
const HERO_ITEMS = [
  { qty: 250, unit: "g", name: "paneer, cubed" },
  { qty: 3, unit: "", name: "ripe tomatoes" },
  { qty: 2, unit: "tbsp", name: "butter" },
  { qty: 0.5, unit: "cup", name: "cream" },
  { qty: 1, unit: "tsp", name: "kasuri methi" },
];

const STEPS = [
  {
    title: "Create your account",
    text: "Sign up with your email and password. It takes under a minute.",
  },
  {
    title: "Add a recipe",
    text: "Write the ingredients and method, then upload a photo of the dish.",
  },
  {
    title: "Share it",
    text: "Your recipe shows up on the home page for everyone to cook from.",
  },
];

/* ---------------------------------- helpers ---------------------------------- */

function toList(ingredients) {
  if (Array.isArray(ingredients)) return ingredients;
  return String(ingredients || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function minutesOf(time) {
  const m = String(time || "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function formatQty(qty, unit, servings) {
  let n = (qty * servings) / BASE_SERVINGS;
  if (unit === "g") return `${Math.max(5, Math.round(n / 5) * 5)} g`;
  n = Math.max(0.25, Math.round(n * 4) / 4);
  const whole = Math.floor(n);
  const frac = { 0: "", 0.25: "1/4", 0.5: "1/2", 0.75: "3/4" }[n - whole];
  const text = [whole || "", frac].filter(Boolean).join(" ");
  return unit ? `${text} ${unit}` : text;
}

function HeartIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 2.6 4.5 6.3 4.5c2 0 3.5 1.1 4.2 2.4h3c.7-1.3 2.2-2.4 4.2-2.4 3.7 0 5.4 3.8 3.9 7.2C19.5 16.4 12 21 12 21z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

/* ---------------------------------- Auth modal ---------------------------------- */

const PERKS = [
  "Add your own recipes with photos",
  "Edit or delete them any time",
  "Join a community of home cooks",
];

const STRENGTH_LABELS = ["", "Weak", "Okay", "Good", "Strong"];

function strengthOf(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.max(1, s);
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 8 8 6 8-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="10" width="16" height="10" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon({ off }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

function AuthModal({ initialMode, onClose, onSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isLogin = mode === "login";
  const strength = strengthOf(password);

  const switchMode = (next) => {
    setMode(next);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return setError("Enter a valid email address.");
    }
    if (!isLogin && password.length < 6) {
      return setError("Choose a password with at least 6 characters.");
    }

    setLoading(true);
    try {
      const res = await api.post(isLogin ? "/login" : "/signUp", {
        email: email.trim(),
        password,
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      onSuccess(res.data.user, mode);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal modal-auth"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <aside className="auth-side" aria-hidden="true">
          <div className="auth-side-inner">
            <div className="logo">
              <span className="logo-mark" />
              Thali
            </div>
            <h3>
              {isLogin
                ? "Good to see you again."
                : "Your recipes deserve an audience."}
            </h3>
            <ul className="auth-perks">
              {PERKS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div className="auth-note">
              <b>Tonight&rsquo;s list</b>
              <ul>
                <li className="done">Paneer</li>
                <li className="done">Tomatoes</li>
                <li>Cream</li>
              </ul>
            </div>
          </div>
        </aside>

        <div className="auth-main">
          <button className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>

          <div className="auth-tabs" role="tablist" aria-label="Account">
            <button
              type="button"
              role="tab"
              className="auth-tab"
              aria-selected={isLogin}
              onClick={() => switchMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              className="auth-tab"
              aria-selected={!isLogin}
              onClick={() => switchMode("signup")}
            >
              Sign up
            </button>
          </div>

          <h2 id="auth-title">
            {isLogin ? "Welcome back" : "Create your account"}
          </h2>
          <p className="modal-sub">
            {isLogin
              ? "Log in to add and manage your recipes."
              : "It takes under a minute. No card needed."}
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="auth-email">Email</label>
            <div className="field">
              <span className="field-icon">
                <MailIcon />
              </span>
              <input
                id="auth-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
              />
            </div>

            <label htmlFor="auth-password">Password</label>
            <div className="field">
              <span className="field-icon">
                <LockIcon />
              </span>
              <input
                id="auth-password"
                type={showPw ? "text" : "password"}
                placeholder={
                  isLogin ? "Your password" : "At least 6 characters"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
              />
              <button
                type="button"
                className="field-toggle"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? "Hide password" : "Show password"}
                aria-pressed={showPw}
              >
                <EyeIcon off={showPw} />
              </button>
            </div>

            {!isLogin && password && (
              <>
                <div className="meter" data-level={strength} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <p className="meter-label">
                  Password strength: <b>{STRENGTH_LABELS[strength]}</b>
                </p>
              </>
            )}

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading}
            >
              {loading && <span className="spinner" aria-hidden="true" />}
              {loading ? "Please wait" : isLogin ? "Log in" : "Create account"}
            </button>
          </form>

          <p className="modal-switch">
            {isLogin ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => switchMode(isLogin ? "signup" : "login")}
            >
              {isLogin ? "Create an account" : "Log in"}
            </button>
          </p>
          {!isLogin && (
            <p className="auth-fine">
              Recipes you add are visible to everyone.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Recipe modal ---------------------------------- */

function RecipeModal({ recipe, tint, isFav, onFav, onClose, onToast }) {
  const list = toList(recipe.ingredients);
  const steps = String(recipe.instructions || "")
    .split(/\n+/)
    .filter(Boolean);
  const [have, setHave] = useState([]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (i) =>
    setHave((p) => (p.includes(i) ? p.filter((n) => n !== i) : [...p, i]));

  const share = async () => {
    const text =
      `${recipe.title}${recipe.time ? ` (${recipe.time})` : ""}\n\nIngredients:\n` +
      list.map((i) => `- ${i}`).join("\n") +
      (steps.length
        ? `\n\nMethod:\n${steps.map((st, i) => `${i + 1}. ${st}`).join("\n")}`
        : "");
    try {
      if (navigator.share) {
        await navigator.share({ title: recipe.title, text });
      } else {
        await navigator.clipboard.writeText(text);
        onToast("Recipe copied. Paste it anywhere to share.");
      }
    } catch {
      /* share dialog was closed */
    }
  };

  const copyMissing = async () => {
    const missing = list.filter((_, i) => !have.includes(i));
    const text = (missing.length ? missing : list).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      onToast(missing.length ? "Shopping list copied" : "Ingredients copied");
    } catch {
      onToast("Could not copy. Please copy manually.");
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close modal-close-on-img"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>

        {recipe.coverImage ? (
          <img
            className="detail-img"
            src={`${API}/images/${recipe.coverImage}`}
            alt={recipe.title}
          />
        ) : (
          <div
            className="detail-img recipe-img-fallback"
            style={{ background: tint }}
            aria-hidden="true"
          >
            {recipe.title?.charAt(0)}
          </div>
        )}

        <div className="detail-body">
          <div className="detail-top">
            <h2 id="recipe-title">{recipe.title}</h2>
            <button
              className={`fav-btn fav-inline ${isFav ? "on" : ""}`}
              onClick={onFav}
              aria-pressed={isFav}
              aria-label={
                isFav ? "Remove from favourites" : "Save to favourites"
              }
            >
              <HeartIcon filled={isFav} />
            </button>
          </div>
          {recipe.time && <p className="detail-time">{recipe.time}</p>}

          <div className="detail-cols">
            <div>
              <h3>Ingredients</h3>
              <ul className="detail-checklist">
                {list.map((item, i) => (
                  <li key={i}>
                    <label>
                      <input
                        type="checkbox"
                        checked={have.includes(i)}
                        onChange={() => toggle(i)}
                      />
                      <span>{item}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="detail-actions">
                <button className="btn btn-ghost-dark" onClick={copyMissing}>
                  Copy shopping list
                </button>
                <button className="btn btn-ghost-dark" onClick={share}>
                  Share recipe
                </button>
              </div>
              <p className="detail-hint">
                Tick what you already have. The list copies only what is
                missing.
              </p>
            </div>
            <div>
              <h3>Method</h3>
              {steps.length ? (
                <ol className="method">
                  {steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              ) : (
                <p className="detail-hint">
                  No method has been added for this recipe yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Recipe form (add / edit) ---------------------------------- */

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </svg>
  );
}

function RecipeFormModal({ recipe, onClose, onSaved }) {
  const isEdit = !!recipe;
  const [title, setTitle] = useState(recipe?.title || "");
  const [minutes, setMinutes] = useState(
    recipe ? (minutesOf(recipe.time) ?? "") : "",
  );
  const [ingredients, setIngredients] = useState(
    recipe ? toList(recipe.ingredients).join("\n") : "",
  );
  const [instructions, setInstructions] = useState(recipe?.instructions || "");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  const currentImg = recipe?.coverImage
    ? `${API}/images/${recipe.coverImage}`
    : null;
  const thumb = preview || currentImg;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/"))
      return setError("Please choose an image file.");
    if (f.size > 5 * 1024 * 1024)
      return setError("The image must be smaller than 5 MB.");
    setError("");
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const parts = ingredients.includes("\n")
      ? ingredients.split("\n")
      : ingredients.split(",");
    const list = parts.map((s) => s.trim()).filter(Boolean);

    if (!title.trim()) return setError("Give your recipe a title.");
    if (list.length === 0) return setError("Add at least one ingredient.");
    if (!instructions.trim())
      return setError("Write the method so others can cook it.");

    // multipart form: the backend reads the image from the "file" field
    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("time", minutes ? `${minutes} min` : "");
    list.forEach((i) => fd.append("ingredients", i));
    fd.append("instructions", instructions.trim());
    if (file) fd.append("file", file);

    setSaving(true);
    try {
      if (isEdit) await api.put(`/recipe/${recipe._id}`, fd);
      else await api.post("/recipe", fd);
      onSaved(isEdit);
    } catch (err) {
      const data = err.response?.data;
      setError(
        data?.error ||
          data?.message ||
          (err.response
            ? "Could not save the recipe. Please try again."
            : "Cannot reach the server. Check that the backend is running."),
      );
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => !saving && onClose()}>
      <div
        className="modal modal-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
          disabled={saving}
        >
          &times;
        </button>
        <h2 id="form-title">{isEdit ? "Edit recipe" : "Add a recipe"}</h2>
        <p className="modal-sub">
          {isEdit
            ? "Change anything you like, then save."
            : "Share a dish with everyone. A photo makes it much easier to find."}
        </p>

        <form onSubmit={submit} noValidate>
          <div className="form-row">
            <div>
              <label htmlFor="r-title">Title</label>
              <input
                id="r-title"
                type="text"
                placeholder="Paneer butter masala"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="r-time">Cooking time (minutes)</label>
              <input
                id="r-time"
                type="number"
                min="1"
                max="1440"
                placeholder="35"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          </div>

          <label htmlFor="r-ing">Ingredients</label>
          <textarea
            id="r-ing"
            placeholder={"250 g paneer\n3 tomatoes\n2 tbsp butter"}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
          />
          <p className="fld-hint">One ingredient per line.</p>

          <label htmlFor="r-method">Method</label>
          <textarea
            id="r-method"
            placeholder={
              "Blend the tomatoes.\nSimmer with butter for 10 minutes."
            }
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
          <p className="fld-hint">
            One step per line. Each line becomes a numbered step.
          </p>

          <label htmlFor="r-file">Photo</label>
          <label className="dropzone" htmlFor="r-file">
            {thumb ? (
              <img className="drop-thumb" src={thumb} alt="Selected recipe" />
            ) : (
              <span className="drop-thumb drop-empty">
                <ImageIcon />
              </span>
            )}
            <span className="drop-text">
              <b>
                {file ? file.name : thumb ? "Change photo" : "Choose a photo"}
              </b>
              <span>JPG, PNG or WebP, up to 5 MB</span>
            </span>
            <input id="r-file" type="file" accept="image/*" onChange={onPick} />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost-dark"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <span className="spinner" aria-hidden="true" />}
              {saving ? "Saving" : isEdit ? "Save changes" : "Publish recipe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({ title, text, confirmLabel, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, busy]);

  return (
    <div className="modal-backdrop" onMouseDown={() => !busy && onCancel()}>
      <div
        className="modal modal-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title">{title}</h2>
        <p className="modal-sub">{text}</p>
        <div className="confirm-actions">
          <button
            className="btn btn-ghost-dark"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
            }}
          >
            {busy ? "Deleting" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Recipe card ---------------------------------- */

function RecipeCard({
  recipe,
  index,
  isFav,
  onFav,
  onOpen,
  canEdit,
  onEdit,
  onDelete,
}) {
  const tint = CARD_TINTS[index % CARD_TINTS.length];
  const list = toList(recipe.ingredients);

  return (
    <article className="recipe-card">
      <button
        className="recipe-open"
        onClick={onOpen}
        aria-label={`Open ${recipe.title}`}
      >
        {recipe.coverImage ? (
          <img
            className="recipe-img"
            src={`${API}/images/${recipe.coverImage}`}
            alt=""
            loading="lazy"
          />
        ) : (
          <div
            className="recipe-img recipe-img-fallback"
            style={{ background: tint }}
            aria-hidden="true"
          >
            {recipe.title?.charAt(0)}
          </div>
        )}
        {recipe.time && <span className="time-badge">{recipe.time}</span>}
        <span className="recipe-body">
          <h3>{recipe.title}</h3>
          <span className="recipe-ingredients">
            {list.slice(0, 4).join(", ")}
            {list.length > 4 ? " and more" : ""}
          </span>
          <span className="recipe-meta">{list.length} ingredients</span>
        </span>
      </button>
      <button
        className={`fav-btn ${isFav ? "on" : ""}`}
        onClick={onFav}
        aria-pressed={isFav}
        aria-label={
          isFav
            ? `Remove ${recipe.title} from favourites`
            : `Save ${recipe.title} to favourites`
        }
      >
        <HeartIcon filled={isFav} />
      </button>
      {canEdit && (
        <div className="recipe-actions">
          <button
            className="act-btn"
            onClick={onEdit}
            aria-label={`Edit ${recipe.title}`}
          >
            <PencilIcon />
          </button>
          <button
            className="act-btn danger"
            onClick={onDelete}
            aria-label={`Delete ${recipe.title}`}
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </article>
  );
}

/* ---------------------------------- Landing page ---------------------------------- */

export default function LandingPage() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingSample, setUsingSample] = useState(false);
  const [query, setQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [sort, setSort] = useState("new");
  const [authMode, setAuthMode] = useState(null); // null | "login" | "signup"
  const [selected, setSelected] = useState(null); // recipe object being viewed
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [editor, setEditor] = useState(null); // null | { recipe: null (add) | recipe (edit) }
  const [deleting, setDeleting] = useState(null); // recipe waiting for delete confirmation

  const [user, setUser] = useState(() => {
    const token = getToken();
    const exp = token ? tokenExpiry(token) : null;
    if (!token || (exp && exp <= Date.now())) {
      clearSession();
      return null;
    }
    return readUser();
  });

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved) return saved;
    } catch {}
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const [favs, setFavs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("thali-favs")) || [];
    } catch {
      return [];
    }
  });

  // hero card state
  const [servings, setServings] = useState(BASE_SERVINGS);
  const [checked, setChecked] = useState([0]);

  /* ----- effects ----- */

  const loadRecipes = useCallback(async () => {
    try {
      const res = await api.get("/recipe");
      if (Array.isArray(res.data) && res.data.length > 0) {
        setRecipes(res.data);
        setUsingSample(false);
      } else {
        setRecipes(SAMPLE_RECIPES);
        setUsingSample(true);
      }
    } catch {
      setRecipes(SAMPLE_RECIPES);
      setUsingSample(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  /* ----- session ----- */

  const endSession = (message) => {
    clearSession();
    setUser(null);
    if (message) setToast(message);
  };

  // Confirm the saved login with the server once (GET /user/:id is protected)
  useEffect(() => {
    const saved = readUser();
    if (!getToken() || !saved?._id) return;
    api.get(`/user/${saved._id}`).catch((err) => {
      if (err.response?.status === 404) endSession();
    });
  }, []);

  // Log out automatically when the token runs out
  useEffect(() => {
    const token = getToken();
    const exp = token ? tokenExpiry(token) : null;
    if (!user || !exp) return;
    const wait = Math.min(Math.max(exp - Date.now(), 0), 2147483647);
    const t = setTimeout(
      () => endSession("Your session expired. Please log in again."),
      wait,
    );
    return () => clearTimeout(t);
  }, [user]);

  // Server rejected the token, or the user logged in/out in another tab
  useEffect(() => {
    const onExpired = () =>
      endSession("Your session expired. Please log in again.");
    const onStorage = (e) => {
      if (e.key === "token" || e.key === "user" || e.key === null) {
        setUser(getToken() ? readUser() : null);
      }
    };
    window.addEventListener("auth:expired", onExpired);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("auth:expired", onExpired);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("thali-favs", JSON.stringify(favs));
  }, [favs]);

  useEffect(() => {
    if (!user) {
      setEditor(null);
      setDeleting(null);
      setTimeFilter((f) => (f === "mine" ? "all" : f));
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow =
      authMode || selected || editor || deleting ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [authMode, selected, editor, deleting]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  /* ----- derived ----- */

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = recipes.filter(
      (r) =>
        !q ||
        r.title?.toLowerCase().includes(q) ||
        toList(r.ingredients).join(" ").toLowerCase().includes(q),
    );

    if (timeFilter === "fav") out = out.filter((r) => favs.includes(r._id));
    else if (timeFilter === "mine")
      out = out.filter((r) => user && r.createdBy === user._id);
    else if (timeFilter !== "all") {
      const limit = Number(timeFilter);
      out = out.filter((r) => {
        const m = minutesOf(r.time);
        return m !== null && m <= limit;
      });
    }

    if (sort === "new") {
      out = [...out].sort(
        (a, b) =>
          (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
      );
    } else if (sort === "quick") {
      out = [...out].sort(
        (a, b) => (minutesOf(a.time) ?? 9999) - (minutesOf(b.time) ?? 9999),
      );
    } else if (sort === "az") {
      out = [...out].sort((a, b) =>
        (a.title || "").localeCompare(b.title || ""),
      );
    }
    return out;
  }, [recipes, query, timeFilter, sort, favs, user]);

  const filterList = user
    ? [...TIME_FILTERS, { id: "mine", label: "My recipes" }]
    : TIME_FILTERS;

  const heroReady = checked.length;
  const heroTotal = HERO_ITEMS.length;

  /* ----- handlers ----- */

  const showToast = (msg) => setToast(msg);

  const toggleFav = (id) =>
    setFavs((prev) => {
      const has = prev.includes(id);
      showToast(has ? "Removed from favourites" : "Saved to favourites");
      return has ? prev.filter((x) => x !== id) : [...prev, id];
    });

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post("/logout"); // server blacklists this token
    } catch (err) {
      console.log(err); // even if it fails we still clear the session below
    } finally {
      clearSession();
      setUser(null);
      setMenuOpen(false);
      setLoggingOut(false);
      showToast("You are logged out");
    }
  };

  const handleSaved = async (wasEdit) => {
    setEditor(null);
    await loadRecipes();
    showToast(wasEdit ? "Recipe updated" : "Recipe published");
    if (!wasEdit) {
      setQuery("");
      setTimeFilter("mine");
      scrollTo("recipes");
    }
  };

  const confirmDelete = async () => {
    const r = deleting;
    try {
      await api.delete(`/recipe/${r._id}`);
      setFavs((p) => p.filter((x) => x !== r._id));
      await loadRecipes();
      showToast("Recipe deleted");
    } catch (err) {
      const data = err.response?.data;
      showToast(data?.error || data?.message || "Could not delete the recipe");
    } finally {
      setDeleting(null);
    }
  };

  const handleShareRecipe = () => {
    if (!user) return setAuthMode("signup");
    setMenuOpen(false);
    setEditor({ recipe: null });
  };

  const toggleCheck = (i) =>
    setChecked((prev) =>
      prev.includes(i) ? prev.filter((n) => n !== i) : [...prev, i],
    );

  const scrollTo = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const openMine = () => {
    setTimeFilter("mine");
    setQuery("");
    scrollTo("recipes");
  };

  const openFavs = () => {
    setTimeFilter("fav");
    setQuery("");
    scrollTo("recipes");
  };

  const emptyTitle =
    timeFilter === "fav" && !query
      ? "No favourites yet"
      : timeFilter === "mine" && !query
        ? "You have not added a recipe yet"
        : query
          ? `No recipes match “${query}”`
          : "No recipes match these filters";
  const emptyText =
    timeFilter === "fav" && !query
      ? "Tap the heart on any recipe to keep it here."
      : timeFilter === "mine" && !query
        ? "Your first recipe is one click away."
        : "Try a different ingredient, or add this recipe yourself.";

  return (
    <div className="landing" data-theme={theme}>
      {/* ---------- Navbar ---------- */}
      <header className={`nav ${scrolled ? "nav-scrolled" : ""}`}>
        <div className="container nav-inner">
          <a className="logo" href="/" aria-label="Thali home">
            <span className="logo-mark" aria-hidden="true" />
            Thali
          </a>

          <button
            className="nav-toggle"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label="Toggle menu"
          >
            Menu
          </button>

          <nav className={`nav-links ${menuOpen ? "open" : ""}`}>
            <button className="nav-link" onClick={() => scrollTo("recipes")}>
              Recipes
            </button>
            <button className="nav-link" onClick={openFavs}>
              Favourites
              {favs.length > 0 && <span className="badge">{favs.length}</span>}
            </button>
            <button className="nav-link" onClick={() => scrollTo("how")}>
              How it works
            </button>
            {user && (
              <button className="nav-link" onClick={openMine}>
                My recipes
              </button>
            )}
            <button
              className="nav-link theme-toggle"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              <span className="theme-label">
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </span>
            </button>
            {user ? (
              <>
                <span className="nav-user">
                  <span className="avatar" aria-hidden="true">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                  <span className="nav-email" title={user.email}>
                    {user.email}
                  </span>
                </span>
                <button className="btn btn-accent" onClick={handleShareRecipe}>
                  Add recipe
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? "Logging out" : "Log out"}
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-ghost"
                  onClick={() => setAuthMode("login")}
                >
                  Log in
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setAuthMode("signup")}
                >
                  Sign up
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <h1>Cook something you&rsquo;ll want to make again.</h1>
              <p className="hero-sub">
                Browse home-cooked recipes from other people, or add your own
                family favourites.
              </p>

              <form
                className="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  scrollTo("recipes");
                }}
              >
                <label htmlFor="hero-search" className="sr-only">
                  Search recipes or ingredients
                </label>
                <input
                  id="hero-search"
                  type="search"
                  placeholder="Search a dish or an ingredient"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" className="btn btn-accent">
                  Find recipes
                </button>
              </form>

              <div className="quick-picks">
                <span>Have these at home?</span>
                {QUICK_PICKS.map((p) => (
                  <button
                    key={p}
                    className={`chip ${query.toLowerCase() === p.toLowerCase() ? "chip-on" : ""}`}
                    onClick={() => {
                      setQuery(p);
                      setTimeFilter("all");
                      scrollTo("recipes");
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* The one memorable element: a recipe card you can scale and tick off */}
            <div className="hero-card-wrap">
              <div className="paper">
                <h2>Paneer butter masala</h2>

                <div className="servings">
                  <span id="servings-label">Serves</span>
                  <button
                    className="step-btn"
                    onClick={() => setServings((s) => Math.max(1, s - 1))}
                    aria-label="Fewer servings"
                    disabled={servings <= 1}
                  >
                    &minus;
                  </button>
                  <output aria-labelledby="servings-label">{servings}</output>
                  <button
                    className="step-btn"
                    onClick={() => setServings((s) => Math.min(8, s + 1))}
                    aria-label="More servings"
                    disabled={servings >= 8}
                  >
                    +
                  </button>
                  <span className="paper-time">&middot; 35 min</span>
                </div>

                <ul className="checklist">
                  {HERO_ITEMS.map((item, i) => (
                    <li key={item.name}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checked.includes(i)}
                          onChange={() => toggleCheck(i)}
                        />
                        <span>
                          <b>{formatQty(item.qty, item.unit, servings)}</b>{" "}
                          {item.name}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>

                <div
                  className="progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={heroTotal}
                  aria-valuenow={heroReady}
                  aria-label="Ingredients ready"
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${(heroReady / heroTotal) * 100}%` }}
                  />
                </div>
                <p className="paper-hint">
                  {heroReady === heroTotal
                    ? "You have everything. Time to cook."
                    : `${heroReady} of ${heroTotal} ingredients ready`}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Recipes ---------- */}
        <section className="section" id="recipes">
          <div className="container">
            <div className="section-head">
              <h2>
                {query ? `Recipes for “${query}”` : "Fresh from the community"}
              </h2>
              {(query || timeFilter !== "all") && (
                <button
                  className="link-btn"
                  onClick={() => {
                    setQuery("");
                    setTimeFilter("all");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="toolbar">
              <div className="filters" role="group" aria-label="Filter recipes">
                {filterList.map((f) => (
                  <button
                    key={f.id}
                    className={`pill ${timeFilter === f.id ? "pill-on" : ""}`}
                    aria-pressed={timeFilter === f.id}
                    onClick={() => setTimeFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="sort">
                <span className="count">
                  {filtered.length}{" "}
                  {filtered.length === 1 ? "recipe" : "recipes"}
                </span>
                <label htmlFor="sort" className="sr-only">
                  Sort recipes
                </label>
                <select
                  id="sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="new">Newest first</option>
                  <option value="quick">Quickest first</option>
                  <option value="az">A to Z</option>
                </select>
              </div>
            </div>

            {usingSample && !loading && (
              <p className="notice">
                Showing sample recipes because no recipes were loaded from the
                server.
              </p>
            )}

            {loading ? (
              <div className="grid">
                {[0, 1, 2].map((n) => (
                  <div
                    className="recipe-card skeleton"
                    key={n}
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <h3>{emptyTitle}</h3>
                <p>{emptyText}</p>
                <button className="btn btn-primary" onClick={handleShareRecipe}>
                  Add a recipe
                </button>
              </div>
            ) : (
              <div className="grid">
                {filtered.map((r, i) => (
                  <RecipeCard
                    recipe={r}
                    index={i}
                    key={r._id || i}
                    isFav={favs.includes(r._id)}
                    onFav={() => toggleFav(r._id)}
                    onOpen={() => setSelected({ recipe: r, index: i })}
                    canEdit={!!user && r.createdBy === user._id}
                    onEdit={() => setEditor({ recipe: r })}
                    onDelete={() => setDeleting(r)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="section section-alt" id="how">
          <div className="container">
            <div className="section-head">
              <h2>Share a recipe in three steps</h2>
            </div>
            <ol className="steps">
              {STEPS.map((s) => (
                <li key={s.title}>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="cta">
          <div className="container cta-inner">
            <h2>Got a recipe everyone asks you for?</h2>
            <p>Write it down once, and let others cook it too.</p>
            <button className="btn btn-accent" onClick={handleShareRecipe}>
              {user ? "Add your recipe" : "Sign up and add your recipe"}
            </button>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <a className="logo" href="/">
              <span className="logo-mark" aria-hidden="true" />
              Thali
            </a>
            <p>
              Home-cooked recipes from people who love to cook. Find one, save
              it, share yours.
            </p>
          </div>

          <nav className="footer-col" aria-label="Footer">
            <h4>Explore</h4>
            <button onClick={() => scrollTo("recipes")}>Recipes</button>
            <button onClick={openFavs}>Favourites</button>
            <button onClick={() => scrollTo("how")}>How it works</button>
            <button onClick={handleShareRecipe}>Add a recipe</button>
          </nav>

          <div className="footer-col">
            <h4>Connect</h4>
            {/* Replace the # links with your own profiles */}
            <a href="#" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href="#" target="_blank" rel="noreferrer">
              LinkedIn
            </a>
            <a href="#" target="_blank" rel="noreferrer">
              Instagram
            </a>
          </div>
        </div>

        <div className="container footer-bottom">
          <p>&copy; {new Date().getFullYear()} Thali. All rights reserved.</p>
          <p className="made-by">
            Made with{" "}
            <span className="heart" aria-label="love">
              &hearts;
            </span>{" "}
            by <strong>Kartik Yadav</strong>
          </p>
          <button
            className="to-top"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            Back to top
          </button>
        </div>
      </footer>

      {/* ---------- Overlays ---------- */}
      {authMode && (
        <AuthModal
          initialMode={authMode}
          onClose={() => setAuthMode(null)}
          onSuccess={(u, m) => {
            setUser(u);
            setAuthMode(null);
            setMenuOpen(false);
            showToast(
              m === "signup"
                ? "Account created. Welcome to Thali!"
                : "Welcome back! You are logged in",
            );
          }}
        />
      )}

      {editor && (
        <RecipeFormModal
          recipe={editor.recipe}
          onClose={() => setEditor(null)}
          onSaved={handleSaved}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete this recipe?"
          text={`“${deleting.title}” will be removed for everyone. This cannot be undone.`}
          confirmLabel="Delete recipe"
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {selected && (
        <RecipeModal
          recipe={selected.recipe}
          tint={CARD_TINTS[selected.index % CARD_TINTS.length]}
          isFav={favs.includes(selected.recipe._id)}
          onFav={() => toggleFav(selected.recipe._id)}
          onClose={() => setSelected(null)}
          onToast={showToast}
        />
      )}

      <div
        className={`toast ${toast ? "toast-show" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </div>
  );
}
