import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Default to dark; persist preference in localStorage
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("bg-theme") || "dark";
  });

  useEffect(() => {
    // Apply theme as a data attribute on <html> — all CSS vars respond to this
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bg-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
