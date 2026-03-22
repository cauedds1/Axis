import type { AxisTheme } from "@/components/theme-provider";

export interface LandingPalette {
  primary: string;
  secondary: string;
  tertiary: string;
  accent: string;
  success: string;
  primaryRgb: string;
  secondaryRgb: string;
  tertiaryRgb: string;
  accentRgb: string;
  successRgb: string;
  primaryMuted: string;
  secondaryMuted: string;
  tertiaryMuted: string;
}

export function getLandingPalette(theme: AxisTheme): LandingPalette {
  const palettes: Record<AxisTheme, LandingPalette> = {
    "high": {
      primary: "#FF6B6B", secondary: "#FFB347", tertiary: "#A78BFA", accent: "#00E6FF", success: "#4ECDC4",
      primaryRgb: "255,107,107", secondaryRgb: "255,179,71", tertiaryRgb: "167,139,250", accentRgb: "0,230,255", successRgb: "78,205,196",
      primaryMuted: "rgba(255,107,107,0.15)", secondaryMuted: "rgba(255,179,71,0.12)", tertiaryMuted: "rgba(167,139,250,0.12)",
    },
    "high-purple": {
      primary: "#B066FF", secondary: "#6478FF", tertiary: "#DC78C8", accent: "#E0A0FF", success: "#8BE0D0",
      primaryRgb: "176,102,255", secondaryRgb: "100,120,255", tertiaryRgb: "220,120,200", accentRgb: "224,160,255", successRgb: "139,224,208",
      primaryMuted: "rgba(176,102,255,0.15)", secondaryMuted: "rgba(100,120,255,0.12)", tertiaryMuted: "rgba(220,120,200,0.12)",
    },
    "high-gold": {
      primary: "#FFD426", secondary: "#FF9632", tertiary: "#DCB450", accent: "#FFE880", success: "#A0D890",
      primaryRgb: "255,212,38", secondaryRgb: "255,150,50", tertiaryRgb: "220,180,80", accentRgb: "255,232,128", successRgb: "160,216,144",
      primaryMuted: "rgba(255,212,38,0.15)", secondaryMuted: "rgba(255,150,50,0.12)", tertiaryMuted: "rgba(220,180,80,0.12)",
    },
    "high-coral": {
      primary: "#FF5C3A", secondary: "#FF8C32", tertiary: "#E66482", accent: "#FFB070", success: "#70D0B0",
      primaryRgb: "255,92,58", secondaryRgb: "255,140,50", tertiaryRgb: "230,100,130", accentRgb: "255,176,112", successRgb: "112,208,176",
      primaryMuted: "rgba(255,92,58,0.15)", secondaryMuted: "rgba(255,140,50,0.12)", tertiaryMuted: "rgba(230,100,130,0.12)",
    },
    "high-red": {
      primary: "#E8001C", secondary: "#CC0033", tertiary: "#FF2244", accent: "#FF6666", success: "#00CC66",
      primaryRgb: "232,0,28", secondaryRgb: "204,0,51", tertiaryRgb: "255,34,68", accentRgb: "255,102,102", successRgb: "0,204,102",
      primaryMuted: "rgba(232,0,28,0.15)", secondaryMuted: "rgba(204,0,51,0.12)", tertiaryMuted: "rgba(255,34,68,0.12)",
    },
    "slim": {
      primary: "#7A9E8A", secondary: "#9EAA8E", tertiary: "#8B9E7A", accent: "#B8C4A8", success: "#7A9E8A",
      primaryRgb: "122,158,138", secondaryRgb: "158,170,142", tertiaryRgb: "139,158,122", accentRgb: "184,196,168", successRgb: "122,158,138",
      primaryMuted: "rgba(122,158,138,0.15)", secondaryMuted: "rgba(158,170,142,0.12)", tertiaryMuted: "rgba(139,158,122,0.12)",
    },
    "slim-indigo": {
      primary: "#6B7FD9", secondary: "#8B9BD0", tertiary: "#7B8FC0", accent: "#A0ADE0", success: "#6B7FD9",
      primaryRgb: "107,127,217", secondaryRgb: "139,155,208", tertiaryRgb: "123,143,192", accentRgb: "160,173,224", successRgb: "107,127,217",
      primaryMuted: "rgba(107,127,217,0.15)", secondaryMuted: "rgba(139,155,208,0.12)", tertiaryMuted: "rgba(123,143,192,0.12)",
    },
    "slim-rose": {
      primary: "#C46B7A", secondary: "#D08B96", tertiary: "#B87A88", accent: "#E0A0AE", success: "#C46B7A",
      primaryRgb: "196,107,122", secondaryRgb: "208,139,150", tertiaryRgb: "184,122,136", accentRgb: "224,160,174", successRgb: "196,107,122",
      primaryMuted: "rgba(196,107,122,0.15)", secondaryMuted: "rgba(208,139,150,0.12)", tertiaryMuted: "rgba(184,122,136,0.12)",
    },
    "slim-amber": {
      primary: "#D4913A", secondary: "#C8A060", tertiary: "#B89050", accent: "#E0C090", success: "#D4913A",
      primaryRgb: "212,145,58", secondaryRgb: "200,160,96", tertiaryRgb: "184,144,80", accentRgb: "224,192,144", successRgb: "212,145,58",
      primaryMuted: "rgba(212,145,58,0.15)", secondaryMuted: "rgba(200,160,96,0.12)", tertiaryMuted: "rgba(184,144,80,0.12)",
    },
  };
  return palettes[theme] ?? palettes["high"];
}
