import { useState, useRef, useCallback } from "react";
import { Mic, Send, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";

interface CaptureResult {
  intent: string;
  data: any;
  created: any;
  rawText: string;
}

export function CaptureButton({ variant = "floating" }: { variant?: "floating" | "inline" }) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
    queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
  }, []);

  const processText = async (input: string) => {
    if (!input.trim()) return;
    setIsProcessing(true);
    try {
      const res = await apiRequest("POST", "/api/input/process", { text: input });
      const data: CaptureResult = await res.json();
      setResult(data);
      invalidateAll();
      setText("");

      const intentLabels: Record<string, string> = {
        expense: "Gasto registrado",
        income: "Receita registrada",
        task: "Tarefa criada",
        schedule: "Compromisso agendado",
        habit: "Compromisso criado",
        chat: "Resposta do assistente",
      };

      toast({
        title: intentLabels[data.intent] || "Processado",
        description: data.intent === "chat" ? data.created?.response?.substring(0, 100) : data.rawText,
      });

      setTimeout(() => setResult(null), 5000);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setIsProcessing(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, "audio.webm");
          const res = await fetch("/api/input/process", {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          const data: CaptureResult = await res.json();
          setResult(data);
          invalidateAll();
          toast({
            title: data.intent === "chat" ? "Resposta" : "Registrado por voz",
            description: data.rawText,
          });
          setTimeout(() => setResult(null), 5000);
        } catch (error: any) {
          toast({ title: "Erro", description: error.message, variant: "destructive" });
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast({ title: "Erro", description: "Sem acesso ao microfone", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processText(text);
  };

  const intentIcons: Record<string, string> = {
    expense: "R$",
    income: "R$",
    task: "T",
    schedule: "A",
    habit: "H",
    chat: "C",
  };

  if (variant === "inline") {
    return (
      <div className="w-full">
        <form onSubmit={handleSubmit} className="flex items-center gap-2" data-testid="form-capture-inline">
          <div className="relative flex-1">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Diga ou escreva algo..."
              disabled={isProcessing || isRecording}
              className="pr-10 bg-card border-border"
              data-testid="input-capture-text"
            />
          </div>
          <Button
            type="button"
            size="icon"
            variant={isRecording ? "destructive" : "secondary"}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className="shrink-0"
            data-testid="button-capture-mic"
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button type="submit" size="icon" disabled={isProcessing || !text.trim()} className="shrink-0" data-testid="button-capture-send">
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 p-3 rounded-lg bg-card border border-border text-sm animate-fade-up"
              data-testid="text-capture-result"
            >
              <span className="text-xs font-mono text-muted-foreground mr-2">{intentIcons[result.intent]}</span>
              {result.intent === "chat" ? result.created?.response : result.rawText}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-lg">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card/95 backdrop-blur-sm border border-border rounded-2xl p-3 shadow-lg"
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-2" data-testid="form-capture-floating">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Diga ou escreva algo..."
            disabled={isProcessing || isRecording}
            className="flex-1 bg-background/50 border-border/50"
            data-testid="input-capture-floating"
          />
          <Button
            type="button"
            size="icon"
            variant={isRecording ? "destructive" : "secondary"}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`shrink-0 ${isRecording ? "animate-pulse" : ""}`}
            data-testid="button-capture-floating-mic"
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button type="submit" size="icon" disabled={isProcessing || !text.trim()} className="shrink-0" data-testid="button-capture-floating-send">
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 p-3 rounded-lg bg-muted/50 text-sm"
              data-testid="text-capture-floating-result"
            >
              <span className="text-xs font-mono text-primary mr-2">{intentIcons[result.intent]}</span>
              {result.intent === "chat" ? result.created?.response : result.rawText}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
