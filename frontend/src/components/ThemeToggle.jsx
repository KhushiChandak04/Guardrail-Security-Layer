import { useTheme } from "../context/ThemeContext";
import "./ThemeToggle.css";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark/light mode"
    >
      <span className="toggle-track">
        <span
          className={`toggle-thumb ${isDark ? "thumb--dark" : "thumb--light"}`}
        >
          {isDark ? "🌙" : "☀️"}
        </span>
      </span>
      <span className="toggle-label">{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}
