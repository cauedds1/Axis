import { Layers, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme, type AxisTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          data-testid="button-theme-toggle"
        >
          {theme === "slim" ? (
            <Layers className="h-4 w-4" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setTheme("slim")}
          data-testid="button-theme-slim"
          className={theme === "slim" ? "bg-accent" : ""}
        >
          <Layers className="h-4 w-4 mr-2" />
          Slim
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("high")}
          data-testid="button-theme-high"
          className={theme === "high" ? "bg-accent" : ""}
        >
          <Zap className="h-4 w-4 mr-2" />
          High
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeSelector({ value, onChange }: { value?: AxisTheme; onChange: (theme: AxisTheme) => void }) {
  const currentValue = value || "slim";

  return (
    <div className="flex gap-4" data-testid="theme-selector">
      <button
        type="button"
        onClick={() => onChange("slim")}
        data-testid="button-select-slim"
        className={`flex-1 rounded-md p-4 border-2 transition-colors ${
          currentValue === "slim"
            ? "border-foreground"
            : "border-border"
        }`}
      >
        <div className="rounded-md overflow-hidden mb-3">
          <div className="h-20 bg-neutral-950 p-3 flex flex-col gap-1.5">
            <div className="h-2 w-12 rounded-sm bg-neutral-700" />
            <div className="h-2 w-20 rounded-sm bg-neutral-800" />
            <div className="h-2 w-16 rounded-sm bg-neutral-800" />
            <div className="flex gap-1 mt-auto">
              <div className="h-3 w-8 rounded-sm bg-neutral-300" />
              <div className="h-3 w-8 rounded-sm bg-neutral-700" />
            </div>
          </div>
        </div>
        <p className="text-sm font-medium">Slim</p>
        <p className="text-xs text-muted-foreground mt-0.5">Minimalista e focado</p>
      </button>

      <button
        type="button"
        onClick={() => onChange("high")}
        data-testid="button-select-high"
        className={`flex-1 rounded-md p-4 border-2 transition-colors ${
          currentValue === "high"
            ? "border-foreground"
            : "border-border"
        }`}
      >
        <div className="rounded-md overflow-hidden mb-3">
          <div className="h-20 bg-neutral-950 p-3 flex flex-col gap-1.5">
            <div className="h-2 w-12 rounded-sm bg-cyan-500" />
            <div className="h-2 w-20 rounded-sm bg-neutral-800" />
            <div className="h-2 w-16 rounded-sm bg-neutral-800" />
            <div className="flex gap-1 mt-auto">
              <div className="h-3 w-8 rounded-sm bg-cyan-400" />
              <div className="h-3 w-8 rounded-sm bg-neutral-700" />
            </div>
          </div>
        </div>
        <p className="text-sm font-medium">High</p>
        <p className="text-xs text-muted-foreground mt-0.5">Vibrante e energético</p>
      </button>
    </div>
  );
}
