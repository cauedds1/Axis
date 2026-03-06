import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Camera, FileSpreadsheet, CheckCircle2, Users, Shield, Zap, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const BLUE = "#2563EB";
const BLUE_LIGHT = "#3B82F6";
const BLUE_DARK = "#1D4ED8";
const INDIGO = "#6366F1";

function Step({ number, title, description, icon }: { number: string; title: string; description: string; icon: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center text-center gap-4"
    >
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)" }}>
          <span style={{ color: BLUE_LIGHT }}>{icon}</span>
        </div>
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: BLUE }}>
          {number}
        </div>
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{description}</p>
    </motion.div>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl p-6 flex flex-col gap-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.2)" }}>
        <span style={{ color: BLUE_LIGHT }}>{icon}</span>
      </div>
      <h4 className="font-semibold text-white">{title}</h4>
      <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{description}</p>
    </motion.div>
  );
}

export default function BusinessLanding() {
  return (
    <div className="min-h-screen" style={{ background: "#060610", color: "white" }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full" style={{ background: `radial-gradient(ellipse, rgba(37,99,235,0.12), transparent 70%)`, filter: "blur(60px)" }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full" style={{ background: `radial-gradient(ellipse, rgba(99,102,241,0.07), transparent 70%)`, filter: "blur(80px)" }} />
      </div>

      <header className="fixed top-0 w-full z-50 backdrop-blur-xl border-b" style={{ background: "rgba(6,6,16,0.8)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BLUE }}>
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight">AXIS</span>
              <span className="text-base font-bold tracking-tight" style={{ color: BLUE_LIGHT }}>Business</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/">
              <button
                className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 transition-all"
                style={{ color: "rgba(255,255,255,0.45)" }}
                data-testid="button-back-personal"
              >
                <ArrowLeft className="w-3 h-3" />
                AXIS Pessoal
              </button>
            </Link>
            <Link href="/auth">
              <Button
                size="sm"
                className="text-sm font-semibold px-5 border-0"
                style={{ background: BLUE, color: "white" }}
                data-testid="button-business-cta-header"
              >
                Começar grátis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative min-h-screen flex items-center justify-center px-6 pt-16">
        <div className="relative z-10 flex flex-col items-center text-center gap-8 max-w-3xl mx-auto py-24">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-medium"
            style={{ borderColor: "rgba(37,99,235,0.35)", background: "rgba(37,99,235,0.08)", color: BLUE_LIGHT }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BLUE_LIGHT }} />
            Novo — Gestão corporativa de despesas
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight"
          >
            Controle de despesas
            <br />
            <span style={{ color: BLUE_LIGHT }}>pelo WhatsApp.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg leading-relaxed max-w-xl"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Colaboradores enviam a foto do recibo pelo WhatsApp. O AXIS registra automaticamente, guarda a imagem e gera relatórios organizados — sem planilha manual, sem papel perdido.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <Link href="/auth">
              <Button
                size="lg"
                className="text-base font-semibold px-8 py-6 border-0"
                style={{ background: `linear-gradient(135deg, ${BLUE}, ${INDIGO})`, color: "white" }}
                data-testid="button-business-cta-hero"
              >
                Começar agora — é grátis
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Sem cartão de crédito
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="w-full max-w-lg rounded-2xl p-1"
            style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}
          >
            <div className="rounded-xl p-4" style={{ background: "rgba(6,6,16,0.6)" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "#25D366" }}>W</div>
                <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>AXIS Business Bot</span>
                <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>agora</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-end">
                  <div className="text-xs px-3 py-2 rounded-2xl rounded-tr-sm" style={{ background: "#005C4B", color: "rgba(255,255,255,0.85)", maxWidth: "75%" }}>
                    [foto da nota fiscal]
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="text-xs px-3 py-2 rounded-2xl rounded-tl-sm" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.75)", maxWidth: "85%" }}>
                    ✅ Despesa registrada: <strong>Restaurante Central — R$ 87,50</strong>
                    <br />Essa despesa é <em>pessoal</em> ou corporativa? (Acme Corp)
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="text-xs px-3 py-2 rounded-2xl rounded-tr-sm" style={{ background: "#005C4B", color: "rgba(255,255,255,0.85)" }}>
                    Acme Corp
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="text-xs px-3 py-2 rounded-2xl rounded-tl-sm" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.75)", maxWidth: "85%" }}>
                    📋 Salvo na empresa <strong>Acme Corp</strong>. O admin verá no painel de despesas.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative px-6 py-24" style={{ background: "rgba(255,255,255,0.015)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Como funciona</h2>
            <p className="text-base" style={{ color: "rgba(255,255,255,0.45)" }}>Três passos. Zero planilha manual.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <Step number="1" icon={<Camera className="w-6 h-6" />} title="Foto pelo WhatsApp" description="O colaborador tira foto do recibo e envia para o bot do AXIS Business pelo WhatsApp que já usa." />
            <Step number="2" icon={<Zap className="w-6 h-6" />} title="Registro automático" description="O AXIS lê a nota com IA, extrai estabelecimento, valor, itens e data, e registra na empresa com a imagem." />
            <Step number="3" icon={<FileSpreadsheet className="w-6 h-6" />} title="Relatório pronto" description="O gestor acessa o painel, filtra por período e colaborador, aprova as despesas e exporta a planilha." />
          </div>
        </div>
      </section>

      <section className="relative px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Tudo que sua equipe precisa</h2>
            <p className="text-base" style={{ color: "rgba(255,255,255,0.45)" }}>Simples para quem usa, poderoso para quem gerencia.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Feature icon={<Camera className="w-5 h-5" />} title="Foto + IA" description="A imagem da nota fica salva no sistema. A IA extrai todos os dados automaticamente — nada de digitação." />
            <Feature icon={<CheckCircle2 className="w-5 h-5" />} title="Fluxo de aprovação" description="Gestor aprova ou rejeita cada despesa com um clique. O colaborador é notificado na hora." />
            <Feature icon={<FileSpreadsheet className="w-5 h-5" />} title="Exportação Excel" description="Gere uma planilha formatada com todas as despesas do período, agrupadas por data e colaborador." />
            <Feature icon={<Users className="w-5 h-5" />} title="Multi-colaboradores" description="Cadastre toda a equipe. Cada um envia suas notas; o painel central consolida tudo." />
            <Feature icon={<Shield className="w-5 h-5" />} title="Controle por empresa" description="Cada empresa tem seu painel separado. Os dados ficam isolados e seguros." />
            <Feature icon={<Zap className="w-5 h-5" />} title="Relatório com foto" description="Visualize a foto do recibo original com um clique diretamente no painel — sem precisar guardar papel." />
          </div>
        </div>
      </section>

      <section className="relative px-6 py-24" style={{ background: "rgba(37,99,235,0.05)", borderTop: "1px solid rgba(37,99,235,0.12)", borderBottom: "1px solid rgba(37,99,235,0.12)" }}>
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Pronto para começar?</h2>
            <p className="text-base mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
              Crie sua conta gratuitamente. Configure sua empresa em minutos e convide sua equipe.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/auth">
                <Button
                  size="lg"
                  className="text-base font-semibold px-8 py-6 border-0"
                  style={{ background: `linear-gradient(135deg, ${BLUE}, ${INDIGO})`, color: "white" }}
                  data-testid="button-business-cta-footer"
                >
                  Criar conta grátis
                  <ChevronRight className="ml-1 w-5 h-5" />
                </Button>
              </Link>
            </div>
            <p className="text-xs mt-4" style={{ color: "rgba(255,255,255,0.25)" }}>Sem cartão de crédito · Cancele quando quiser</p>
          </motion.div>
        </div>
      </section>

      <footer className="px-6 py-8 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: BLUE }}>
              <Building2 className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold">AXIS Business</span>
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            Uma extensão do <Link href="/"><span className="underline cursor-pointer">AXIS</span></Link> — seu assistente de vida inteligente.
          </p>
        </div>
      </footer>
    </div>
  );
}
