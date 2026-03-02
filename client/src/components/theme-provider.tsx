import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type AxisTheme =
  | "slim" | "slim-indigo" | "slim-rose" | "slim-amber"
  | "high" | "high-purple" | "high-gold" | "high-coral";

export const ALL_THEMES: AxisTheme[] = [
  "slim", "slim-indigo", "slim-rose", "slim-amber",
  "high", "high-purple", "high-gold", "high-coral",
];

export function getPrimaryHex(theme: AxisTheme): string {
  const map: Record<AxisTheme, string> = {
    "slim":        "#7A9E8A",
    "slim-indigo": "#6B7FD9",
    "slim-rose":   "#C46B7A",
    "slim-amber":  "#D4913A",
    "high":        "#00E6FF",
    "high-purple": "#B066FF",
    "high-gold":   "#FFD426",
    "high-coral":  "#FF5C3A",
  };
  return map[theme] ?? "#7A9E8A";
}

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
      if (ALL_THEMES.includes(stored as AxisTheme)) return stored as AxisTheme;
    }
    return "slim";
  });

  const applyTheme = useCallback((t: AxisTheme) => {
    const root = window.document.documentElement;
    root.classList.remove("light", ...ALL_THEMES, "slim", "high");
    root.classList.add("dark", t);
    if (t.startsWith("slim")) root.classList.add("slim");
    else if (t.startsWith("high")) root.classList.add("high");
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
