"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { apiFetch } from "@/lib/api";

interface Conversation {
  id: string;
  guest_id: string | null;
  reservation_id: string | null;
  channel: string;
  external_contact_id: string;
  last_message_at: string | null;
  guest: { id: string; first_name: string; last_name: string | null } | null;
}

interface Message {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  body: string;
  status: string;
  created_at: string;
}

interface StatusInfo {
  configured: boolean;
  usingMockAdapter: boolean;
}

function formatRelative(value: string | null) {
  if (!value) return "";

  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function conversationLabel(conversation: Conversation): string {
  if (conversation.guest) {
    return `${conversation.guest.first_name} ${conversation.guest.last_name ?? ""}`.trim();
  }

  return conversation.external_contact_id;
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-full" />}>
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const searchParams = useSearchParams();
  const initialGuestId = searchParams.get("guestId");

  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Set when arriving via ?guestId=X for a guest who has no
  // conversation yet — lets the thread panel show a "first message"
  // composer instead of "select a conversation".
  const [pendingGuest, setPendingGuest] = useState<{
    id: string;
    first_name: string;
    last_name: string | null;
    phone: string | null;
  } | null>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [statusResponse, conversationsResponse] = await Promise.all([
        apiFetch("/api/messaging/status"),
        apiFetch("/api/messaging/conversations"),
      ]);

      setStatus(statusResponse.data);
      setConversations(conversationsResponse.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load conversations."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // If arriving from a guest's page with a known guestId: select the
  // existing conversation if one exists, otherwise load the guest so
  // the thread panel can offer a "send first message" composer.
  useEffect(() => {
    if (!initialGuestId || loading || selectedId || pendingGuest) return;

    const match = conversations.find((c) => c.guest_id === initialGuestId);

    if (match) {
      setSelectedId(match.id);
      return;
    }

    apiFetch(`/api/guests/${initialGuestId}`)
      .then((response) => setPendingGuest(response.data))
      .catch(() => undefined);
  }, [initialGuestId, conversations, loading, selectedId, pendingGuest]);

  async function handleSendFirstMessage() {
    if (!pendingGuest || !draft.trim()) return;

    try {
      setSending(true);
      setError("");

      await apiFetch(`/api/messaging/guests/${pendingGuest.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: draft.trim() }),
      });

      setDraft("");
      setPendingGuest(null);

      const response = await apiFetch("/api/messaging/conversations");
      const nextConversations: Conversation[] = response.data ?? [];
      setConversations(nextConversations);

      const created = nextConversations.find(
        (c) => c.guest_id === pendingGuest.id
      );
      if (created) setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      setMessagesLoading(true);
      const response = await apiFetch(
        `/api/messaging/conversations/${conversationId}/messages`
      );
      setMessages(response.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load messages."
      );
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!selectedId || !draft.trim()) return;

    try {
      setSending(true);
      setError("");

      await apiFetch(`/api/messaging/conversations/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: draft.trim() }),
      });

      setDraft("");
      await loadMessages(selectedId);
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  return (
    <div className="min-h-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Messages
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Guest conversations via WhatsApp.
        </p>
      </div>

      {status && !status.configured && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and
          WHATSAPP_PHONE_NUMBER_ID to send and receive real messages.
        </div>
      )}

      {status?.usingMockAdapter && (
        <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Using the development mock adapter — no real WhatsApp messages are
          being sent.
        </div>
      )}

      {error && (
        <div className="mt-5 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError("")} className="font-medium">
            ✕
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Conversations
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No conversations yet
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Message a guest from their profile to start one.
              </p>
            </div>
          ) : (
            <div className="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedId(conversation.id)}
                  className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    selectedId === conversation.id ? "bg-slate-50" : ""
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-900">
                      {conversationLabel(conversation)}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatRelative(conversation.last_message_at)}
                    </span>
                  </div>

                  {!conversation.guest && (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      Unlinked
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thread */}
        <div className="flex min-h-[65vh] flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
          {pendingGuest ? (
            <>
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="text-sm font-semibold text-slate-900">
                  {pendingGuest.first_name} {pendingGuest.last_name ?? ""}
                </p>
                <p className="text-xs text-slate-400">
                  {pendingGuest.phone ?? "No phone on file"} · New conversation
                </p>
              </div>

              <div className="flex flex-1 items-center justify-center p-8 text-center">
                {pendingGuest.phone ? (
                  <p className="text-sm text-slate-400">
                    Send a message below to start this conversation.
                  </p>
                ) : (
                  <p className="text-sm text-red-600">
                    This guest has no phone number on file — add one before
                    messaging them.
                  </p>
                )}
              </div>

              <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSendFirstMessage();
                    }
                  }}
                  disabled={!pendingGuest.phone}
                  placeholder="Type your first message..."
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
                <button
                  onClick={handleSendFirstMessage}
                  disabled={sending || !draft.trim() || !pendingGuest.phone}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </>
          ) : !selectedConversation ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <p className="text-sm text-slate-400">
                Select a conversation to view messages.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {conversationLabel(selectedConversation)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {selectedConversation.external_contact_id} · WhatsApp
                  </p>
                </div>

                {!selectedConversation.guest && (
                  <LinkGuestControl
                    conversationId={selectedConversation.id}
                    onLinked={async () => {
                      await loadConversations();
                    }}
                  />
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {messagesLoading ? (
                  <p className="text-center text-sm text-slate-400">
                    Loading...
                  </p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-slate-400">
                    No messages yet.
                  </p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.direction === "outbound"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          message.direction === "outbound"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-900"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.body}</p>
                        <p
                          className={`mt-1 text-[10px] ${
                            message.direction === "outbound"
                              ? "text-slate-300"
                              : "text-slate-400"
                          }`}
                        >
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {message.direction === "outbound"
                            ? ` · ${message.status}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={threadEndRef} />
              </div>

              <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !draft.trim()}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LinkGuestControl({
  conversationId,
  onLinked,
}: {
  conversationId: string;
  onLinked: () => void;
}) {
  const [guestId, setGuestId] = useState("");
  const [guests, setGuests] = useState<{ id: string; first_name: string; last_name: string | null }[]>([]);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    apiFetch("/api/guests?limit=100")
      .then((response) => setGuests(response.data ?? []))
      .catch(() => undefined);
  }, []);

  async function handleLink() {
    if (!guestId) return;

    try {
      setLinking(true);
      await apiFetch(`/api/messaging/conversations/${conversationId}/link`, {
        method: "PATCH",
        body: JSON.stringify({ guestId }),
      });
      onLinked();
    } catch {
      // Surfaced via the page-level error banner on next load if it
      // matters; keep this control lightweight.
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={guestId}
        onChange={(event) => setGuestId(event.target.value)}
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-slate-400"
      >
        <option value="">Link to guest...</option>
        {guests.map((guest) => (
          <option key={guest.id} value={guest.id}>
            {guest.first_name} {guest.last_name ?? ""}
          </option>
        ))}
      </select>

      <button
        onClick={handleLink}
        disabled={!guestId || linking}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Link
      </button>
    </div>
  );
}
