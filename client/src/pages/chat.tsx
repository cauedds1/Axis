import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Mic, Square, Loader2, Check, X, HelpCircle, Trash2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme, getPrimaryHex } from "@/components/theme-provider";
import { useTranslation } from "react-i18next";
import type { ChatMessage } from "@shared/models/chat";

type ScheduleBatchActivity = { title: string; days: number[]; time: string; durationMinutes: number; weeks: number };

type BatchScheduleAction = { type: "create_schedule_batch"; data: { activities: ScheduleBatchActivity[] } };

type PendingAction =
  | { type: "expense" | "income"; data: { amount: number; description: string } }
  | { type: "task"; data: { title: string } }
  | { type: "habit"; data: { name: string } }
  | { type: "schedule" | "create_schedule"; data: { title: string } }
  | BatchScheduleAction
  | { type: string; data: Record<string, unknown> };

function isBatchScheduleAction(a: PendingAction): a is BatchScheduleAction {
  return a.type === "create_schedule_batch";
}

function invalidateAfterAction(type: string) {
  queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
  queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  if (type === "expense" || type === "income") {
    queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
  }
  if (type === "task") {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
  }
  if (type === "habit") {
    queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
  }
  if (type === "schedule" || type === "create_schedule" || type === "create_schedule_batch") {
    queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
  }
}

export default function Chat() {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { theme } = useTheme();
  const accent = getPrimaryHex(theme);

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({ queryKey: ["/api/chat/messages"] });

  const sendMutation = useMutation({
    mutationFn: async (msg: string) => {
      const res = await apiRequest("POST", "/api/chat", { message: msg });
      return res.json();
    },
    onMutate: async (msg: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/chat/messages"] });
      const previous = queryClient.getQueryData<ChatMessage[]>(["/api/chat/messages"]);
      const optimistic: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        userId: "",
        role: "user",
        content: msg,
        createdAt: new Date() as any,
      };
      queryClient.setQueryData<ChatMessage[]>(["/api/chat/messages"], (old) => [
        ...(old || []),
        optimistic,
      ]);
      return { previous };
    },
    onError: (err: Error, _msg, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/chat/messages"], context.previous);
      }
      toast({ title: t("axisChat.errorSending"), description: err.message, variant: "destructive" });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      if (data.pendingAction) {
        setPendingAction(data.pendingAction);
      } else {
        setPendingAction(null);
      }
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (action: PendingAction) => {
      const res = await apiRequest("POST", "/api/chat/confirm-action", { type: action.type, data: action.data });
      return res.json();
    },
    onSuccess: (data) => {
      setPendingAction(null);
      invalidateAfterAction(data.actionExecuted || "");
    },
    onError: () => {
      toast({ title: t("axisChat.errorConfirm"), variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/chat/cancel-action", {});
      return res.json();
    },
    onSuccess: () => {
      setPendingAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
    },
  });

  const voiceMutation = useMutation({
    mutationFn: async (blob: Blob) => {
      const formData = new FormData();
      formData.append("audio", blob, "audio.webm");
      const res = await fetch("/api/input/process", { method: "POST", body: formData, credentials: "include" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/chat/upload", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error(t("axisChat.errorFile"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: () => {
      toast({ title: t("axisChat.errorFile"), variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sendMutation.isPending) return;
    if (pendingAction) setPendingAction(null);
    sendMutation.mutate(message);
    setMessage("");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        voiceMutation.mutate(blob);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast({ title: t("axisChat.errorMic"), variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const isActionPending = confirmMutation.isPending || cancelMutation.isPending;
  const [showHelp, setShowHelp] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteChatMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/chat/messages");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      setShowDeleteConfirm(false);
    },
  });

  const helpItems = [
    { icon: "💸", label: t("axisChat.helpFinanceLabel"), desc: t("axisChat.helpFinanceDesc") },
    { icon: "✅", label: t("axisChat.helpTasksLabel"), desc: t("axisChat.helpTasksDesc") },
    { icon: "📅", label: t("axisChat.helpAgendaLabel"), desc: t("axisChat.helpAgendaDesc") },
    { icon: "🔁", label: t("axisChat.helpHabitsLabel"), desc: t("axisChat.helpHabitsDesc") },
    { icon: "💬", label: t("axisChat.helpChatLabel"), desc: t("axisChat.helpChatDesc") },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <title>{t("axisChat.pageTitle")}</title>

      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold" data-testid="text-chat-title">{t("axisChat.title")}</h1>
            <button
              onClick={() => setShowHelp(true)}
              className="flex items-center justify-center w-5 h-5 rounded-full transition-opacity hover:opacity-80"
              style={{ color: accent, opacity: 0.7 }}
              data-testid="button-axisbot-help"
              aria-label={t("axisChat.helpAriaLabel")}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
            style={{ color: "rgba(255,107,107,0.7)", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.15)" }}
            data-testid="button-delete-chat"
            aria-label={t("axisChat.deleteAriaLabel")}
          >
            <Trash2 className="w-3 h-3" />
            {t("axisChat.deleteChat")}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{t("axisChat.subtitle")}</p>
      </div>

      <AnimatePresence>
        {showHelp && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHelp(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              className="relative w-full max-w-sm rounded-2xl p-6 z-10"
              style={{ background: "#0d0d12", border: "1px solid rgba(255,255,255,0.1)" }}
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${accent}18` }}>
                    <HelpCircle className="w-4 h-4" style={{ color: accent }} />
                  </div>
                  <span className="font-bold text-white text-base">{t("axisChat.helpTitle")}</span>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-white/30 hover:text-white/60 transition-colors"
                  data-testid="button-close-axisbot-help"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm text-white/60 leading-relaxed mb-4">
                <span className="text-white font-semibold">{t("axisChat.title")}</span>{" "}
                {t("axisChat.helpDescSuffix")}
              </p>

              <div className="space-y-3 mb-5">
                {helpItems.map(item => (
                  <div key={item.label} className="flex items-start gap-3">
                    <span className="text-base flex-shrink-0 mt-0.5">{item.icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-white">{item.label}</p>
                      <p className="text-xs text-white/40 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl px-4 py-3 text-xs text-white/35 leading-relaxed" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {t("axisChat.helpFootnote")}
              </div>
            </motion.div>
          </motion.div>
        )}

        {showDeleteConfirm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !deleteChatMutation.isPending && setShowDeleteConfirm(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              className="relative w-full max-w-xs rounded-2xl p-6 z-10"
              style={{ background: "#0d0d12", border: "1px solid rgba(255,107,107,0.2)" }}
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,107,107,0.12)" }}>
                  <Trash2 className="w-4 h-4" style={{ color: "#FF6B6B" }} />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">{t("axisChat.deleteTitle")}</p>
                  <p className="text-xs text-white/40 mt-0.5">{t("axisChat.deleteSubtitle")}</p>
                </div>
              </div>

              <p className="text-sm text-white/55 leading-relaxed mb-5">
                {t("axisChat.deleteDescPre")}{" "}
                <span className="text-white/80 font-medium">{t("axisChat.deleteMemory")}</span>{" "}
                {t("axisChat.deleteDescPost")}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteChatMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/50 transition-opacity hover:opacity-70"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                  data-testid="button-cancel-delete-chat"
                >
                  {t("axisChat.deleteCancel")}
                </button>
                <button
                  onClick={() => deleteChatMutation.mutate()}
                  disabled={deleteChatMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80 flex items-center justify-center gap-1.5"
                  style={{ background: "#FF6B6B", color: "#fff" }}
                  data-testid="button-confirm-delete-chat"
                >
                  {deleteChatMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      {t("axisChat.deleteConfirm")}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {isLoading && (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card border border-border rounded-bl-md"
              }`}
              data-testid={`message-${msg.id}`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {(sendMutation.isPending || voiceMutation.isPending) && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-md p-3">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {pendingAction && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mx-4 mb-2 rounded-2xl flex items-center gap-3 px-4 py-3"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${accent}30`,
              backdropFilter: "blur(8px)",
            }}
            data-testid="bar-confirm-action"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: accent }}>
                {t("axisChat.confirmActionLabel")}
              </p>
              <p className="text-xs text-white/70 truncate">
                {pendingAction.type === "task" && `📋 "${pendingAction.data.title}"`}
                {pendingAction.type === "expense" && `💸 R$${Number(pendingAction.data.amount).toFixed(2)} — "${pendingAction.data.description}"`}
                {pendingAction.type === "income" && `💰 R$${Number(pendingAction.data.amount).toFixed(2)} — "${pendingAction.data.description}"`}
                {pendingAction.type === "habit" && `⚡ "${pendingAction.data.name}"`}
                {pendingAction.type === "schedule" && `📅 "${pendingAction.data.title}"`}
                {pendingAction.type === "create_schedule" && `📅 "${pendingAction.data.title}"`}
                {isBatchScheduleAction(pendingAction) && (() => {
                  const names = pendingAction.data.activities
                    .map(a => a.title)
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .join(", ");
                  return `📅 ${names}`;
                })()}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={isActionPending}
                className="h-8 w-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 text-white/40 hover:text-white/70 disabled:opacity-40"
                data-testid="button-cancel-action"
              >
                {cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              </button>
              <button
                onClick={() => pendingAction && confirmMutation.mutate(pendingAction)}
                disabled={isActionPending}
                className="h-8 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40"
                style={{ background: accent, color: "#060608" }}
                data-testid="button-confirm-action"
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {t("axisChat.confirmBtn")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-t border-border p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.txt,.csv"
          className="hidden"
          data-testid="input-chat-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) { uploadFileMutation.mutate(file); e.target.value = ""; }
          }}
        />
        <form onSubmit={handleSubmit} className="flex items-center gap-2" data-testid="form-chat">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadFileMutation.isPending || sendMutation.isPending}
            title={t("axisChat.attachTitle")}
            data-testid="button-chat-attach"
          >
            {uploadFileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("axisChat.placeholder")}
            disabled={sendMutation.isPending || voiceMutation.isPending || isRecording || uploadFileMutation.isPending}
            className="flex-1"
            data-testid="input-chat-message"
          />
          <Button
            type="button"
            size="icon"
            variant={isRecording ? "destructive" : "secondary"}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={sendMutation.isPending || voiceMutation.isPending || uploadFileMutation.isPending}
            className={isRecording ? "animate-pulse" : ""}
            data-testid="button-chat-mic"
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button type="submit" size="icon" disabled={sendMutation.isPending || !message.trim()} data-testid="button-chat-send">
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        {uploadFileMutation.isPending && (
          <p className="text-xs text-muted-foreground text-center mt-2 animate-pulse">🔍 {t("axisChat.analyzingFile")}</p>
        )}
      </div>
    </div>
  );
}
