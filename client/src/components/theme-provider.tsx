import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type AxisTheme =
  | "slim" | "slim-indigo" | "slim-rose" | "slim-amber"
  | "high" | "high-purple" | "high-gold" | "high-coral" | "high-red";

export const ALL_THEMES: AxisTheme[] = [
  "slim", "slim-indigo", "slim-rose", "slim-amber",
  "high", "high-purple", "high-gold", "high-coral", "high-red",
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
    "high-red":    "#E8001C",
  };
  return map[theme] ?? "#7A9E8A";
}

export interface ModulePalette {
  primary: string;
  finance: string;
  agenda: string;
  tasks: string;
  habits: string;
  positive: string;
  negative: string;
  chat: string;
  início: string;
}

export function getModulePalette(theme: AxisTheme): ModulePalette {
  const p = getPrimaryHex(theme);
  const map: Record<AxisTheme, ModulePalette> = {
    "slim": {
      primary: p, finance: p, agenda: p, tasks: p, habits: p,
      chat: p, início: p, positive: "#5A8F70", negative: "#9E7575",
    },
    "slim-indigo": {
      primary: p, finance: "#7B8FC9", agenda: "#8B9FD9", tasks: "#6B7FD9", habits: "#5A89B0",
      chat: p, início: p, positive: "#5A89B0", negative: "#B07575",
    },
    "slim-rose": {
      primary: p, finance: "#C46B7A", agenda: "#B07A8A", tasks: "#B07A9A", habits: "#9A8A7A",
      chat: p, início: p, positive: "#8A9A7A", negative: "#C46B7A",
    },
    "slim-amber": {
      primary: p, finance: "#D4913A", agenda: "#C4A05A", tasks: "#C49A5A", habits: "#A4A06A",
      chat: p, início: p, positive: "#8A9A6A", negative: "#C47A5A",
    },
    "high": {
      primary: p, finance: "#FF1744", agenda: "#FFA000", tasks: "#AE73FF", habits: "#00E5C8",
      chat: p, início: p, positive: "#00E5C8", negative: "#FF1744",
    },
    "high-purple": {
      primary: p, finance: "#FF5C8A", agenda: "#E0A0FF", tasks: "#B066FF", habits: "#7CE5A0",
      chat: p, início: p, positive: "#7CE5A0", negative: "#FF5C8A",
    },
    "high-gold": {
      primary: p, finance: "#FF8A50", agenda: "#FFD426", tasks: "#C49BFF", habits: "#5CD9A0",
      chat: p, início: p, positive: "#5CD9A0", negative: "#FF8A50",
    },
    "high-coral": {
      primary: p, finance: "#FF5C3A", agenda: "#FFB84D", tasks: "#A78BFA", habits: "#4DD8A4",
      chat: p, início: p, positive: "#4DD8A4", negative: "#FF5C3A",
    },
    "high-red": {
      primary: "#E8001C", finance: "#E8001C", agenda: "#FF2244", tasks: "#CC0033",
      habits: "#FF5533", chat: "#E8001C", início: "#E8001C",
      positive: "#00CC66", negative: "#E8001C",
    },
  };
  return map[theme] ?? map["slim"];
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
