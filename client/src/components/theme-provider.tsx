import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type AxisTheme =
  | "slim" | "slim-indigo" | "slim-rose" | "slim-amber"
  | "high" | "high-purple" | "high-gold" | "high-coral" | "high-red";

export type BusinessTheme =
  | "biz-slate" | "biz-ocean" | "biz-emerald" | "biz-amber"
  | "biz-blue" | "biz-indigo" | "biz-cyan" | "biz-green" | "biz-gold";

export const ALL_THEMES: AxisTheme[] = [
  "slim", "slim-indigo", "slim-rose", "slim-amber",
  "high", "high-purple", "high-gold", "high-coral", "high-red",
];

export const ALL_BUSINESS_THEMES: BusinessTheme[] = [
  "biz-slate", "biz-ocean", "biz-emerald", "biz-amber",
  "biz-blue", "biz-indigo", "biz-cyan", "biz-green", "biz-gold",
];

export function isBusinessTheme(theme: string): theme is BusinessTheme {
  return ALL_BUSINESS_THEMES.includes(theme as BusinessTheme);
}

export function isCorporateTheme(theme: BusinessTheme): boolean {
  return ["biz-slate", "biz-ocean", "biz-emerald", "biz-amber"].includes(theme);
}

export function isExecutiveTheme(theme: BusinessTheme): boolean {
  return ["biz-blue", "biz-indigo", "biz-cyan", "biz-green", "biz-gold"].includes(theme);
}

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

export function getBusinessPrimaryHex(theme: BusinessTheme): string {
  const map: Record<BusinessTheme, string> = {
    "biz-slate":   "#3B82F6",
    "biz-ocean":   "#0EA5E9",
    "biz-emerald": "#10B981",
    "biz-amber":   "#F59E0B",
    "biz-blue":    "#3B82F6",
    "biz-indigo":  "#6366F1",
    "biz-cyan":    "#0EA5E9",
    "biz-green":   "#10B981",
    "biz-gold":    "#F59E0B",
  };
  return map[theme] ?? "#3B82F6";
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

export interface BusinessModulePalette {
  primary: string;
  dashboard: string;
  finance: string;
  cashflow: string;
  reports: string;
  positive: string;
  negative: string;
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

export function getBusinessModulePalette(theme: BusinessTheme): BusinessModulePalette {
  const p = getBusinessPrimaryHex(theme);
  const map: Record<BusinessTheme, BusinessModulePalette> = {
    "biz-slate": {
      primary: p, dashboard: p, finance: "#60A5FA", cashflow: "#818CF8", reports: "#34D399",
      positive: "#34D399", negative: "#F87171",
    },
    "biz-ocean": {
      primary: p, dashboard: p, finance: "#38BDF8", cashflow: "#818CF8", reports: "#34D399",
      positive: "#34D399", negative: "#F87171",
    },
    "biz-emerald": {
      primary: p, dashboard: p, finance: "#34D399", cashflow: "#60A5FA", reports: "#A78BFA",
      positive: "#34D399", negative: "#F87171",
    },
    "biz-amber": {
      primary: p, dashboard: p, finance: "#FCD34D", cashflow: "#60A5FA", reports: "#34D399",
      positive: "#34D399", negative: "#F87171",
    },
    "biz-blue": {
      primary: p, dashboard: "#60A5FA", finance: "#34D399", cashflow: "#A78BFA", reports: "#38BDF8",
      positive: "#34D399", negative: "#F87171",
    },
    "biz-indigo": {
      primary: p, dashboard: "#818CF8", finance: "#60A5FA", cashflow: "#34D399", reports: "#38BDF8",
      positive: "#34D399", negative: "#F87171",
    },
    "biz-cyan": {
      primary: p, dashboard: "#38BDF8", finance: "#34D399", cashflow: "#818CF8", reports: "#60A5FA",
      positive: "#34D399", negative: "#F87171",
    },
    "biz-green": {
      primary: p, dashboard: "#34D399", finance: "#60A5FA", cashflow: "#38BDF8", reports: "#A78BFA",
      positive: "#34D399", negative: "#F87171",
    },
    "biz-gold": {
      primary: p, dashboard: "#FCD34D", finance: "#60A5FA", cashflow: "#34D399", reports: "#38BDF8",
      positive: "#34D399", negative: "#F87171",
    },
  };
  return map[theme] ?? map["biz-slate"];
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

// ─── BUSINESS THEME PROVIDER ─────────────────────────────────────────────────

interface BusinessThemeContextType {
  businessTheme: BusinessTheme;
  setBusinessTheme: (theme: BusinessTheme) => void;
}

const BusinessThemeContext = createContext<BusinessThemeContextType>({
  businessTheme: "biz-slate",
  setBusinessTheme: () => {},
});

export function useBusinessTheme() {
  return useContext(BusinessThemeContext);
}

function applyBusinessTheme(t: BusinessTheme) {
  const root = window.document.documentElement;
  root.classList.remove("light", ...ALL_THEMES, ...ALL_BUSINESS_THEMES, "slim", "high");
  root.classList.add("dark", t);
  if (isCorporateTheme(t)) root.classList.add("slim");
  else if (isExecutiveTheme(t)) root.classList.add("high");
}

export function BusinessThemeProvider({ children }: { children: React.ReactNode }) {
  const [businessTheme, setBusinessThemeState] = useState<BusinessTheme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("axis-business-theme");
      if (ALL_BUSINESS_THEMES.includes(stored as BusinessTheme)) return stored as BusinessTheme;
    }
    return "biz-slate";
  });

  const setBusinessTheme = useCallback((t: BusinessTheme) => {
    setBusinessThemeState(t);
    localStorage.setItem("axis-business-theme", t);
    applyBusinessTheme(t);
  }, []);

  useEffect(() => {
    applyBusinessTheme(businessTheme);
  }, [businessTheme]);

  return (
    <BusinessThemeContext.Provider value={{ businessTheme, setBusinessTheme }}>
      {children}
    </BusinessThemeContext.Provider>
  );
}
