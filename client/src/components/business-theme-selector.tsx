import { Layers, Zap, Check, Briefcase } from "lucide-react";
import { useBusinessTheme, type BusinessTheme, getBusinessPrimaryHex, isCorporateTheme } from "@/components/theme-provider";

const CORPORATE_PALETTES: { id: BusinessTheme; label: string }[] = [
  { id: "biz-slate",   label: "Azul" },
  { id: "biz-ocean",   label: "Oceano" },
  { id: "biz-emerald", label: "Esmeralda" },
  { id: "biz-amber",   label: "Âmbar" },
];

const EXECUTIVE_PALETTES: { id: BusinessTheme; label: string }[] = [
  { id: "biz-blue",   label: "Azul" },
  { id: "biz-indigo", label: "Índigo" },
  { id: "biz-cyan",   label: "Ciano" },
  { id: "biz-green",  label: "Verde" },
  { id: "biz-gold",   label: "Ouro" },
];

function PaletteCircle({
  palette,
  selected,
  onClick,
}: {
  palette: { id: BusinessTheme; label: string };
  selected: boolean;
  onClick: () => void;
}) {
  const hex = getBusinessPrimaryHex(palette.id);
  const darkCheck = palette.id === "biz-amber" || palette.id === "biz-gold";
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

export function BusinessThemeSelector({
  value,
  onChange,
}: {
  value: BusinessTheme;
  onChange: (theme: BusinessTheme) => void;
}) {
  const currentGroup = isCorporateTheme(value) ? "corporate" : "executive";

  return (
    <div className="space-y-4" data-testid="business-theme-selector">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Corporate</span>
          <span className="text-xs text-muted-foreground">— minimalista, foco profissional</span>
        </div>
        <div
          className="rounded-xl px-4 py-3 flex justify-between transition-all duration-200"
          style={{
            background: currentGroup === "corporate" ? "rgba(255,255,255,0.04)" : "transparent",
            border: `1px solid ${currentGroup === "corporate" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"}`,
          }}
        >
          {CORPORATE_PALETTES.map((p) => (
            <PaletteCircle
              key={p.id}
              palette={p}
              selected={value === p.id}
              onClick={() => onChange(p.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Executive</span>
          <span className="text-xs text-muted-foreground">— vibrante, com brilho e glow</span>
        </div>
        <div
          className="rounded-xl px-4 py-3 flex justify-between transition-all duration-200"
          style={{
            background: currentGroup === "executive" ? "rgba(255,255,255,0.04)" : "transparent",
            border: `1px solid ${currentGroup === "executive" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"}`,
          }}
        >
          {EXECUTIVE_PALETTES.map((p) => (
            <PaletteCircle
              key={p.id}
              palette={p}
              selected={value === p.id}
              onClick={() => onChange(p.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function BusinessThemeToggleCompact() {
  const { businessTheme, setBusinessTheme } = useBusinessTheme();
  const isExecutive = !isCorporateTheme(businessTheme);
  const hex = getBusinessPrimaryHex(businessTheme);

  return (
    <button
      type="button"
      onClick={() => {
        if (isExecutive) {
          setBusinessTheme("biz-slate");
        } else {
          setBusinessTheme("biz-blue");
        }
      }}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all duration-200 hover:bg-white/5"
      data-testid="button-business-theme-toggle"
      title={isExecutive ? "Modo Executive — clique para Corporate" : "Modo Corporate — clique para Executive"}
    >
      {isExecutive ? (
        <Zap className="h-3.5 w-3.5" style={{ color: hex }} />
      ) : (
        <Layers className="h-3.5 w-3.5" style={{ color: hex }} />
      )}
      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: hex }}>
        {isExecutive ? "EXECUTIVE" : "Corporate"}
      </span>
    </button>
  );
}
