"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

interface NotificationItem {
  id: string;
  title: string;
  message: string | null;
  notificationType: string;
  isRead: boolean;
  createdAt: string;
}

const UNREAD_COUNT_POLL_MS = 60000;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await apiFetch("/api/notifications/unread-count");
      setUnreadCount(response.data?.count ?? 0);
    } catch {
      // Silent — the bell simply won't update its badge this cycle.
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch("/api/notifications");
      const data: NotificationItem[] = response.data ?? [];

      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.isRead).length);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();

    const interval = setInterval(loadUnreadCount, UNREAD_COUNT_POLL_MS);

    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);

    if (next) {
      loadNotifications();
    }
  }

  async function handleMarkRead(id: string) {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.isRead) return;

    try {
      setBusyId(id);

      await apiFetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });

      setNotifications((current) =>
        current.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to mark notification as read."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkAllRead() {
    try {
      setMarkingAll(true);
      setError("");

      await apiFetch("/api/notifications/read-all", {
        method: "PATCH",
      });

      setNotifications((current) =>
        current.map((n) => ({ ...n, isRead: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to mark all notifications as read."
      );
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleDelete(id: string) {
    const target = notifications.find((n) => n.id === id);

    try {
      setBusyId(id);

      await apiFetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });

      setNotifications((current) => current.filter((n) => n.id !== id));

      if (target && !target.isRead) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete notification."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggleOpen}
        className="relative rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
      >
        Notifications
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">
              Notifications
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={loadNotifications}
                disabled={loading}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
              >
                Refresh
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {markingAll ? "Marking..." : "Mark all as read"}
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Loading notifications...
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-red-600">{error}</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                You&apos;re all caught up.
              </div>
            ) : (
              <ul>
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    onClick={() => handleMarkRead(notification.id)}
                    className={`cursor-pointer border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-slate-50 ${
                      notification.isRead ? "" : "bg-blue-50/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {!notification.isRead && (
                            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
                          )}
                          <p className="truncate text-sm font-medium text-slate-900">
                            {notification.title}
                          </p>
                        </div>

                        {notification.message && (
                          <p className="mt-1 text-xs text-slate-600">
                            {notification.message}
                          </p>
                        )}

                        <p className="mt-1 text-xs text-slate-400">
                          {formatDateTime(notification.createdAt)}
                        </p>
                      </div>

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(notification.id);
                        }}
                        disabled={busyId === notification.id}
                        className="flex-shrink-0 text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
