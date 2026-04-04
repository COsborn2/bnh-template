"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { useWebSocket } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ----- EXAMPLE: Chat page -----
// This entire file is example code demonstrating the WebSocket integration.
// Remove this file when building your own app.
// ----- END EXAMPLE -----

interface ChatMessage {
  userId: string;
  body: string;
  timestamp: number;
}

const TOPIC = "chat:general";

export default function ChatPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { connected, sendMessage } = useWebSocket({
    topics: [TOPIC],
    onEvent: (_topic, data) => {
      const msg = data as { type: string } & ChatMessage;
      if (msg.type === "chat:message") {
        setMessages((prev) => [...prev, msg]);
      }
    },
  });

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/auth/login");
    }
  }, [isPending, session, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body) return;
    sendMessage(TOPIC, { body });
    setInput("");
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">
            Chat Example
          </h1>
          <p className="text-sm text-text-muted">
            {connected ? (
              <span className="text-accent-green">Connected</span>
            ) : (
              <span className="text-accent-rose">Reconnecting...</span>
            )}
            {" \u00b7 "}#{TOPIC.split(":")[1]}
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="secondary" size="sm">
            Dashboard
          </Button>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto rounded-[var(--radius-xl)] border border-border bg-bg-raised p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-text-faint">
            No messages yet. Say something!
          </p>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.userId === session.user.id;
          return (
            <div
              key={`${msg.timestamp}-${i}`}
              className={`mb-3 flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-[var(--radius-lg)] px-4 py-2 text-sm ${
                  isMe
                    ? "bg-primary text-bg"
                    : "bg-bg-card text-text border border-border"
                }`}
              >
                {!isMe && (
                  <div className="mb-1 text-xs font-medium text-text-muted">
                    {msg.userId.slice(0, 8)}
                  </div>
                )}
                {msg.body}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          autoFocus
          className="flex-1"
        />
        <Button type="submit" disabled={!connected || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
