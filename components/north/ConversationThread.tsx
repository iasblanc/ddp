"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { ConversationType, NorthTone } from "@/types/database";

// ── TIPOS ─────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  voice?: "ouve" | "pensa" | "provoca";
}

interface ConversationThreadProps {
  conversationType: ConversationType;
  dreamId?: string;
  blockId?: string;
  northTone: NorthTone;
  initialMessage?: string;
  onConversationEnd?: (messages: Message[]) => void;
  className?: string;
}

// ── NORTH TYPING INDICATOR ────────────────────────────────────
function NorthTyping() {
  return (
    <div className="flex items-center gap-1 px-5 py-4">
      <span className="text-xs text-muted-silver tracking-widest uppercase mr-2">
        North
      </span>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="north-dot w-1 h-1 rounded-full bg-muted-silver inline-block"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── MENSAGEM DE NORTH ─────────────────────────────────────────
function NorthMessage({
  content,
  voice = "ouve",
  isStreaming = false,
}: {
  content: string;
  voice?: "ouve" | "pensa" | "provoca";
  isStreaming?: boolean;
}) {
  const voiceConfig = {
    ouve: {
      weight: "font-light",
      style: "italic",
      borderColor: "border-l-muted-silver",
      label: "North",
    },
    pensa: {
      weight: "font-medium",
      style: "",
      borderColor: "border-l-north-blue/50",
      label: "North",
    },
    provoca: {
      weight: "font-semibold",
      style: "",
      borderColor: "border-l-north-blue",
      label: "North",
    },
  };

  const cfg = voiceConfig[voice];

  return (
    <div
      className={cn(
        "px-5 py-4 bg-stellar-gray rounded-lg border-l-2",
        cfg.borderColor,
        "animate-slide-up"
      )}
    >
      <p className="text-2xs text-muted-silver tracking-widest uppercase mb-2">
        {cfg.label}
      </p>
      <p
        className={cn(
          "text-base text-north-light leading-relaxed",
          cfg.weight,
          cfg.style && "italic"
        )}
      >
        {content}
        {isStreaming && <span className="north-cursor" />}
      </p>
    </div>
  );
}

// ── MENSAGEM DO USUÁRIO ───────────────────────────────────────
function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end animate-slide-up">
      <div className="max-w-[80%] px-4 py-3 bg-deep-night border border-border-subtle rounded-lg">
        <p className="text-base text-north-light leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────
export function ConversationThread({
  conversationType,
  dreamId,
  blockId,
  northTone,
  initialMessage,
  onConversationEnd,
  className,
}: ConversationThreadProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll para o fim
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Mensagem inicial de North
  useEffect(() => {
    if (initialMessage) {
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: initialMessage,
          timestamp: new Date().toISOString(),
          voice: "ouve",
        },
      ]);
    }
  }, [initialMessage]);

  // Enviar mensagem
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setIsLoading(true);
      setStreamingContent("");

      try {
        const response = await fetch("/api/north/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            conversationType,
            dreamId,
            blockId,
            conversationId,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          if (error.error === "free_limit_reached") {
            // Tratar limite do plano free
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content:
                  "You've completed your first 3 blocks with North. To continue with full support, upgrade to Pro.",
                timestamp: new Date().toISOString(),
                voice: "pensa",
              },
            ]);
            return;
          }
          throw new Error(error.error || "Failed to send message");
        }

        // Stream da resposta
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") break;

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.text) {
                    fullContent += parsed.text;
                    setStreamingContent(fullContent);
                  }
                } catch {
                  // ignorar linhas malformadas
                }
              }
            }
          }
        }

        // Finalizar streaming
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fullContent,
          timestamp: new Date().toISOString(),
          voice: detectVoice(fullContent, northTone),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setStreamingContent("");
      } catch (error) {
        console.error("Conversation error:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Something interrupted our conversation. Please try again.",
            timestamp: new Date().toISOString(),
            voice: "ouve",
          },
        ]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [messages, isLoading, conversationType, dreamId, blockId, conversationId, northTone]
  );

  // Detectar voz com base no conteúdo e contexto
  function detectVoice(
    content: string,
    tone: NorthTone
  ): "ouve" | "pensa" | "provoca" {
    // Heurística simples — será refinada com o Memory Updater
    const wordCount = content.split(" ").length;
    if (wordCount < 15) return "ouve";
    if (tone === "provocative" && content.includes("?")) return "provoca";
    if (content.includes("plan") || content.includes("plano")) return "pensa";
    return "ouve";
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Thread de mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg) =>
          msg.role === "assistant" ? (
            <NorthMessage
              key={msg.id}
              content={msg.content}
              voice={msg.voice || "ouve"}
            />
          ) : (
            <UserMessage key={msg.id} content={msg.content} />
          )
        )}

        {/* Streaming em andamento */}
        {isLoading && streamingContent && (
          <NorthMessage
            content={streamingContent}
            voice="ouve"
            isStreaming={true}
          />
        )}

        {/* Indicador de digitação */}
        {isLoading && !streamingContent && <NorthTyping />}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-6 pt-2 border-t border-border">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Write to North..."
            rows={1}
            disabled={isLoading}
            className="
              flex-1 bg-stellar-gray border border-border rounded-lg
              px-4 py-3 text-base text-north-light
              placeholder:text-muted-silver placeholder:font-light
              focus:outline-none focus:border-north-blue
              resize-none transition-all duration-280
              disabled:opacity-50
            "
            style={{
              minHeight: "48px",
              maxHeight: "120px",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="
              px-4 py-3 bg-north-blue hover:bg-north-blue-dim
              disabled:opacity-40 disabled:cursor-not-allowed
              text-north-light rounded-lg
              transition-all duration-280
              flex items-center justify-center
              min-w-[48px]
            "
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M14 8L2 8M14 8L9 3M14 8L9 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
