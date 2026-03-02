import { Layers, Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme, type AxisTheme, getPrimaryHex } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SLIM_PALETTES: { id: AxisTheme; label: string }[] = [
  { id: "slim",        label: "Sage" },
  { id: "slim-indigo", label: "Índigo" },
  { id: "slim-rose",   label: "Rose" },
  { id: "slim-amber",  label: "Âmbar" },
];

const HIGH_PALETTES: { id: AxisTheme; label: string }[] = [
  { id: "high",        label: "Ciano" },
  { id: "high-purple", label: "Violeta" },
  { id: "high-gold",   label: "Ouro" },
  { id: "high-coral",  label: "Coral" },
  { id: "high-red",    label: "Vermelho" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isHigh = theme.startsWith("high");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" data-testid="button-theme-toggle">
          {isHigh ? <Zap className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Slim</DropdownMenuLabel>
        {SLIM_PALETTES.map(p => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => setTheme(p.id)}
            className="flex items-center gap-2"
            data-testid={`button-theme-${p.id}`}
          >
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: getPrimaryHex(p.id) }} />
            <span className="text-sm">{p.label}</span>
            {theme === p.id && <Check className="h-3 w-3 ml-auto text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">High</DropdownMenuLabel>
        {HIGH_PALETTES.map(p => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => setTheme(p.id)}
            className="flex items-center gap-2"
            data-testid={`button-theme-${p.id}`}
          >
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: getPrimaryHex(p.id) }} />
            <span className="text-sm">{p.label}</span>
            {theme === p.id && <Check className="h-3 w-3 ml-auto text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PaletteCircle({
  palette,
  selected,
  onClick,
}: {
  palette: { id: AxisTheme; label: string };
  selected: boolean;
  onClick: () => void;
}) {
  const hex = getPrimaryHex(palette.id);
  const darkCheck = palette.id === "slim-amber" || palette.id === "high-gold";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5"
      data-testid={`palette-${palette.id}`}
    >
      <div
        className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          background: hex,
          boxShadow: selected ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${hex}` : "none",
          opacity: selected ? 1 : 0.55,
          transform: selected ? "scale(1.1)" : "scale(1)",
        }}
      >
        {selected && (
          <Check className="h-4 w-4" style={{ color: darkCheck ? "#1a1008" : "#fff" }} />
        )}
      </div>
      <span
        className="text-[11px] font-medium leading-none"
        style={{ color: selected ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}
      >
        {palette.label}
      </span>
    </button>
  );
}

export function ThemeSelector({
  value,
  onChange,
}: {
  value?: AxisTheme;
  onChange: (theme: AxisTheme) => void;
}) {
  const currentValue = value || "slim";
  const currentGroup = currentValue.startsWith("high") ? "high" : "slim";

  return (
    <div className="space-y-4" data-testid="theme-selector">
      {/* Slim group */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Slim</span>
          <span className="text-xs text-muted-foreground">— minimalista, sem animações</span>
        </div>
        <div
          className="rounded-xl px-4 py-3 flex justify-between transition-all duration-200"
          style={{
            background: currentGroup === "slim" ? "rgba(255,255,255,0.04)" : "transparent",
            border: `1px solid ${currentGroup === "slim" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"}`,
          }}
        >
          {SLIM_PALETTES.map(p => (
            <PaletteCircle
              key={p.id}
              palette={p}
              selected={currentValue === p.id}
              onClick={() => onChange(p.id)}
            />
          ))}
        </div>
      </div>

      {/* High group */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">High</span>
          <span className="text-xs text-muted-foreground">— vibrante, com brilho e glow</span>
        </div>
        <div
          className="rounded-xl px-4 py-3 flex justify-between transition-all duration-200"
          style={{
            background: currentGroup === "high" ? "rgba(255,255,255,0.04)" : "transparent",
            border: `1px solid ${currentGroup === "high" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"}`,
          }}
        >
          {HIGH_PALETTES.map(p => (
            <PaletteCircle
              key={p.id}
              palette={p}
              selected={currentValue === p.id}
              onClick={() => onChange(p.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
