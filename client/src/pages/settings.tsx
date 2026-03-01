import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings as SettingsIcon, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeSelector } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const { data: userData } = useQuery<any>({ queryKey: ["/api/user/profile"] });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/user/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Configurações salvas" });
    },
  });

  const handleThemeChange = (t: "slim" | "high") => {
    setTheme(t);
    updateMutation.mutate({ theme: t });
  };

  const handlePersonalityChange = (p: string) => {
    updateMutation.mutate({ aiPersonality: p });
  };

  const moduleList = ["finance", "schedule", "tasks", "habits"];
  const moduleLabels: Record<string, string> = { finance: "Finanças", schedule: "Agenda", tasks: "Tarefas", habits: "Compromissos" };
  const currentModules: string[] = userData?.user?.activeModules || [];

  const toggleModule = (mod: string) => {
    const updated = currentModules.includes(mod) ? currentModules.filter(m => m !== mod) : [...currentModules, mod];
    updateMutation.mutate({ activeModules: updated });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <title>AXIS - Configurações</title>

      <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-settings-title">
        <SettingsIcon className="h-5 w-5" /> Configurações
      </h1>

      <Card className="border-border" data-testid="card-theme-settings">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tema visual</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeSelector value={theme} onChange={handleThemeChange} />
        </CardContent>
      </Card>

      <Card className="border-border" data-testid="card-personality-settings">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Personalidade da IA</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={userData?.user?.aiPersonality || "calm"} onValueChange={handlePersonalityChange}>
            <SelectTrigger data-testid="select-personality"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="calm">Calmo</SelectItem>
              <SelectItem value="direct">Direto</SelectItem>
              <SelectItem value="motivator">Motivador</SelectItem>
              <SelectItem value="strict">Rigoroso</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border" data-testid="card-modules-settings">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Módulos ativos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {moduleList.map((mod) => {
            const active = currentModules.includes(mod);
            return (
              <button
                key={mod}
                onClick={() => toggleModule(mod)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${active ? "border-primary bg-primary/10" : "border-border"}`}
                data-testid={`button-toggle-module-${mod}`}
              >
                <span className="text-sm font-medium">{moduleLabels[mod]}</span>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
