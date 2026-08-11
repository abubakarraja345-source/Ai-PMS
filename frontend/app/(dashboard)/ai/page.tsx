"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type ProposedAction = {
  type: string;
  summary: string;
  params: Record<string, unknown>;
};

type ActionAuditPayload = {
  actionType: string;
  status: "executed" | "rejected";
  error: string | null;
  executedAt: string;
};

type ChatMessage = {
  id: string;
  role: string;
  message: string;
  createdAt: string;
  contextUsed?: string[];
  proposedAction?: ProposedAction | null;
  actionResolved?: boolean;
};

type ConversationSummary = {
  id: string;
  title: string | null;
  createdAt: string;
};

const SUGGESTED_PROMPTS = [
  "What check-ins do I have today?",
  "Which properties are vacant?",
  "What inventory is low?",
  "What maintenance issues are open?",
  "How is occupancy this month?",
  "Which property generated the most revenue?",
  "Are any integrations failing?",
];

function parseActionAudit(message: string): ActionAuditPayload | null {
  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed.actionType === "string") {
      return parsed as ActionAuditPayload;
    }
  } catch {
    // not JSON — ignore
  }
  return null;
}

function toolsUsedFrom(contextUsed: string[] | undefined): string[] {
  if (!contextUsed) return [];
  return contextUsed.filter(
    (s) => s.startsWith("get_") || s.startsWith("propose_")
  );
}

export default function AiAssistantPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const nextTempId = useRef(0);

  function tempId(prefix: string) {
    nextTempId.current += 1;
    return `${prefix}-${nextTempId.current}`;
  }

  async function loadConversations() {
    try {
      setLoadingConversations(true);
      const response = await apiFetch("/api/ai/conversations");
      setConversations(response.data ?? []);
    } catch {
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function openConversation(id: string) {
    try {
      setError("");
      setLoadingMessages(true);
      setConversationId(id);

      const response = await apiFetch(`/api/ai/conversations/${id}/messages`);
      setMessages(response.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load conversation."
      );
    } finally {
      setLoadingMessages(false);
    }
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([]);
    setError("");
  }

  async function handleClear() {
    if (!conversationId) {
      startNewConversation();
      return;
    }

    if (!window.confirm("Delete this conversation? This cannot be undone.")) {
      return;
    }

    try {
      await apiFetch(`/api/ai/conversations/${conversationId}`, {
        method: "DELETE",
      });

      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      startNewConversation();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete conversation."
      );
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();

    if (!trimmed || sending) {
      return;
    }

    setError("");
    setSending(true);
    setInput("");

    const optimisticUserMessage: ChatMessage = {
      id: tempId("pending"),
      role: "user",
      message: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMessage]);

    try {
      const response = await apiFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: trimmed,
          conversationId: conversationId ?? undefined,
        }),
      });

      const data = response.data;

      setMessages((prev) => [
        ...prev,
        {
          id: tempId("assistant"),
          role: "model",
          message: data.answer,
          createdAt: new Date().toISOString(),
          contextUsed: data.contextUsed,
          proposedAction: data.proposedAction ?? null,
        },
      ]);

      if (!conversationId) {
        setConversationId(data.conversationId);
        loadConversations();
      }
    } catch (err) {
      setMessages((prev) =>
        prev.filter((m) => m.id !== optimisticUserMessage.id)
      );
      setInput(trimmed);

      setError(
        err instanceof Error ? err.message : "Failed to get an AI response."
      );
    } finally {
      setSending(false);
    }
  }

  async function confirmAction(msg: ChatMessage) {
    if (!msg.proposedAction || !conversationId) return;

    setExecutingActionId(msg.id);
    setError("");

    try {
      const response = await apiFetch("/api/ai/actions/execute", {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          actionType: msg.proposedAction.type,
          params: msg.proposedAction.params,
        }),
      });

      setMessages((prev) => [
        ...prev.map((m) =>
          m.id === msg.id ? { ...m, actionResolved: true } : m
        ),
        {
          id: tempId("action"),
          role: "action_audit",
          message: JSON.stringify({
            actionType: msg.proposedAction!.type,
            status: response.data?.status ?? "executed",
            error: null,
            executedAt: new Date().toISOString(),
          }),
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to execute the action."
      );
    } finally {
      setExecutingActionId(null);
    }
  }

  function cancelAction(msg: ChatMessage) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, actionResolved: true } : m))
    );
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl flex-col gap-6 lg:flex-row">
      {/* Conversation list */}
      <aside className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:w-64">
        <button
          onClick={startNewConversation}
          className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          New conversation
        </button>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            History
          </p>

          {loadingConversations ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-slate-400">No conversations yet.</p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => openConversation(c.id)}
                    className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm ${
                      c.id === conversationId
                        ? "bg-slate-100 font-medium text-slate-900"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {c.title || "Untitled conversation"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Chat panel */}
      <section className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              AI Assistant
            </h1>
            <p className="text-xs text-slate-500">
              Answers and proposed actions based on your organization&apos;s live PMS data.
            </p>
          </div>

          <button
            onClick={handleClear}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-red-600"
          >
            Clear
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loadingMessages ? (
            <p className="text-sm text-slate-500">Loading conversation...</p>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="text-sm text-slate-400">
                Ask a question about your properties, reservations, cleaning,
                maintenance, inventory, or reports.
              </p>

              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m) => {
                if (m.role === "action_audit") {
                  const audit = parseActionAudit(m.message);
                  const executed = audit?.status === "executed";

                  return (
                    <div key={m.id} className="flex justify-start">
                      <div
                        className={`max-w-[80%] rounded-xl border px-4 py-2.5 text-xs font-medium ${
                          executed
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        {executed
                          ? `Action executed: ${audit?.actionType.replace(/_/g, " ")}`
                          : `Action failed: ${audit?.error ?? "unknown error"}`}
                      </div>
                    </div>
                  );
                }

                const tools = toolsUsedFrom(m.contextUsed);
                const showAction = m.proposedAction && !m.actionResolved;

                return (
                  <div key={m.id}>
                    <div
                      className={`flex ${
                        m.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                          m.role === "user"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {m.message}
                      </div>
                    </div>

                    {m.role === "model" && tools.length > 0 && (
                      <p className="mt-1 text-xs text-slate-400">
                        Looked up: {tools.map((t) => t.replace(/_/g, " ")).join(", ")}
                      </p>
                    )}

                    {showAction && m.proposedAction && (
                      <div className="mt-2 max-w-[80%] rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-medium text-amber-800">
                          Proposed action
                        </p>
                        <p className="mt-1 text-sm text-amber-900">
                          {m.proposedAction.summary}
                        </p>

                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => confirmAction(m)}
                            disabled={executingActionId === m.id}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                          >
                            {executingActionId === m.id ? "Confirming..." : "Confirm"}
                          </button>

                          <button
                            onClick={() => cancelAction(m)}
                            disabled={executingActionId === m.id}
                            className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {sending && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-400">
                    Thinking...
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {error && (
          <div className="mx-6 mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-end gap-3 border-t border-slate-100 px-6 py-4"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask about your properties, reservations, cleaning, maintenance, inventory..."
            rows={1}
            disabled={sending}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-slate-400 focus:outline-none disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </section>
    </main>
  );
}
