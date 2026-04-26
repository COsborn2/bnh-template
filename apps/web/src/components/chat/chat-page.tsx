"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth-client";
import {
  buildChatWebSocketUrl,
  createGuestProfile,
  loadGuestProfile,
  saveGuestProfile,
  type GuestProfile,
} from "@/lib/chat-identity";
import { useWebSocket } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface ChatMessage {
  userId: string;
  userName: string;
  isGuest: boolean;
  body: string;
  timestamp: number;
}

const TOPIC = "chat:general";

export function ChatPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [guestProfile, setGuestProfile] = useState<GuestProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPending || session) {
      return;
    }

    startTransition(() => {
      setGuestProfile(loadGuestProfile());
    });
  }, [isPending, session]);

  const currentIdentity = session
    ? {
        userId: session.user.id,
        userName: session.user.name,
        isGuest: false,
      }
    : guestProfile
      ? {
          userId: `guest:${guestProfile.id}`,
          userName: guestProfile.name,
          isGuest: true,
        }
      : null;

  const { connected, sendMessage } = useWebSocket({
    topics: [TOPIC],
    url: currentIdentity?.isGuest
      ? buildChatWebSocketUrl(guestProfile)
      : currentIdentity
        ? buildChatWebSocketUrl()
        : null,
    enabled: Boolean(currentIdentity),
    onEvent: (_topic, data) => {
      const msg = data as { type: string } & ChatMessage;
      if (msg.type === "chat:message") {
        setMessages((prev) => [...prev, msg]);
      }
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body || !currentIdentity) return;
    sendMessage(TOPIC, { body });
    setInput("");
  }

  function handleRandomizeGuest() {
    const nextProfile = createGuestProfile();
    saveGuestProfile(nextProfile);
    setGuestProfile(nextProfile);
  }

  if (isPending || !currentIdentity) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-text-muted">Loading chat...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-6 md:py-8">
      <div className="mb-4 flex flex-col gap-4 rounded-[var(--radius-xl)] border border-border bg-bg-raised p-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">
            Lobby Chat
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {connected ? (
              <span className="text-accent-green">Connected</span>
            ) : (
              <span className="text-accent-rose">Reconnecting...</span>
            )}
            {" · "}#{TOPIC.split(":")[1]}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />
          {session ? (
            <>
              <Link href="/dashboard">
                <Button variant="secondary" size="sm">
                  Dashboard
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await authClient.signOut();
                  router.push("/auth/login");
                }}
              >
                Log out
              </Button>
            </>
          ) : (
            <Link href="/auth/login">
              <Button variant="secondary" size="sm">
                Log in
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-[var(--radius-xl)] border border-border bg-bg-raised p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <Input
          label="Name"
          value={currentIdentity.userName}
          readOnly
          className="cursor-default"
        />
        {currentIdentity.isGuest ? (
          <Button type="button" variant="secondary" onClick={handleRandomizeGuest}>
            Randomize guest
          </Button>
        ) : (
          <div className="rounded-[var(--radius-md)] border border-border bg-bg-card px-3 py-2 text-sm text-text-muted">
            Signed in as {currentIdentity.userName}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto rounded-[var(--radius-xl)] border border-border bg-bg-raised p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-text-faint">
            No messages yet. Send one to verify the websocket flow end to end.
          </p>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.userId === currentIdentity.userId;
          return (
            <div
              key={`${msg.timestamp}-${i}`}
              className={`mb-3 flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-[var(--radius-lg)] px-4 py-2 text-sm ${
                  isMe
                    ? "bg-primary text-bg"
                    : "border border-border bg-bg-card text-text"
                }`}
              >
                <div
                  className={`mb-1 text-xs font-medium ${
                    isMe ? "text-bg/80" : "text-text-muted"
                  }`}
                >
                  {msg.userName}
                  {msg.isGuest ? " (guest)" : ""}
                </div>
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
