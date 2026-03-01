import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type AxisTheme = "slim" | "high";

interface ThemeContextType {
  theme: AxisTheme;
  setTheme: (theme: AxisTheme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "slim",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AxisTheme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("axis-theme");
      if (stored === "slim" || stored === "high") return stored;
    }
    return "slim";
  });

  const applyTheme = useCallback((t: AxisTheme) => {
    const root = window.document.documentElement;
    root.classList.remove("light", "slim", "high");
    root.classList.add("dark", t);
  }, []);

  const setTheme = useCallback((t: AxisTheme) => {
    setThemeState(t);
    localStorage.setItem("axis-theme", t);
    applyTheme(t);
  }, [applyTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
