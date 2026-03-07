import { motion } from "framer-motion";
import { BarChart3, Download, FileSpreadsheet, TrendingDown, TrendingUp } from "lucide-react";

export default function BusinessReports() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Exportações e análises financeiras da empresa</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              icon: FileSpreadsheet,
              color: "#34D399",
              bg: "rgba(52,211,153,0.08)",
              border: "rgba(52,211,153,0.15)",
              title: "Exportar Excel",
              description: "Despesas do mês em planilha para o contador",
              label: "Em breve",
            },
            {
              icon: Download,
              color: "#60A5FA",
              bg: "rgba(96,165,250,0.08)",
              border: "rgba(96,165,250,0.15)",
              title: "Exportar ZIP",
              description: "Comprovantes + Excel do mês em um arquivo",
              label: "Em breve",
            },
            {
              icon: TrendingDown,
              color: "#F87171",
              bg: "rgba(248,113,113,0.08)",
              border: "rgba(248,113,113,0.15)",
              title: "DRE Simplificado",
              description: "Lucro ou prejuízo real do período",
              label: "Em breve",
            },
            {
              icon: TrendingUp,
              color: "#A78BFA",
              bg: "rgba(167,139,250,0.08)",
              border: "rgba(167,139,250,0.15)",
              title: "Centro de Custo",
              description: "Gastos por projeto, unidade ou área",
              label: "Em breve",
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="rounded-2xl border p-5 flex items-start gap-4"
              style={{ background: item.bg, borderColor: item.border }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                <item.icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm">{item.title}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ color: item.color, background: item.bg, border: `1px solid ${item.border}` }}>{item.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-border/50 p-6 text-center">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground/60">Relatórios avançados em desenvolvimento</p>
          <p className="text-xs text-muted-foreground/40 mt-1">Use a aba Despesas para exportar em Excel por enquanto</p>
        </div>
      </motion.div>
    </div>
  );
}
