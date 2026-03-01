import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-6 gap-1" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      </Link>
      <h1 className="text-3xl font-bold mb-6">Política de Privacidade</h1>
      <div className="prose prose-invert prose-sm max-w-none space-y-4 text-muted-foreground">
        <p>O AXIS respeita sua privacidade. Todos os dados são criptografados e pertencem exclusivamente a você.</p>
        <h2 className="text-foreground text-lg font-semibold">Dados coletados</h2>
        <p>Coletamos apenas os dados que você fornece: transações financeiras, tarefas, hábitos, compromissos e mensagens de chat. Dados de áudio são processados e descartados após a transcrição.</p>
        <h2 className="text-foreground text-lg font-semibold">Uso dos dados</h2>
        <p>Seus dados são usados exclusivamente para alimentar o assistente de IA e gerar insights personalizados. Não vendemos nem compartilhamos dados com terceiros.</p>
        <h2 className="text-foreground text-lg font-semibold">Segurança</h2>
        <p>Utilizamos criptografia em trânsito (HTTPS) e em repouso. O acesso aos dados é restrito ao seu usuário autenticado.</p>
        <h2 className="text-foreground text-lg font-semibold">Exclusão</h2>
        <p>Você pode solicitar a exclusão completa dos seus dados a qualquer momento.</p>
      </div>
    </div>
  );
}
