import { useEffect, useState, useCallback } from "react";
import Icon from "./Icon";
import { notificationsApi } from "../API/notifications";
import { extractErrorMessage } from "../API/client";

const ICON_BY_TYPE = {
  ORDER: "cart",
  PAYMENT: "wallet",
  DELIVERY: "box",
  REFUND: "wallet",
  PROMOTION: "tag",
  RECOMMENDATION: "chart",
  SUPPLIER_ORDER: "cart",
  DISPUTE: "bell",
  SUBSCRIPTION: "wallet",
  AFFILIATE: "users",
  ADVERTISEMENT: "tag",
  SUPPORT: "bell",
  SYSTEM: "bell",
};

function timeAgo(date) {
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(date).toLocaleDateString("en-GB");
}

export default function NotificationPanel() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await notificationsApi.getAll();
      setItems(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const markRead = async (id) => {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationsApi.markAsRead(id);
    } catch {
      refresh();
    }
  };

  const markAllRead = async () => {
    setItems((list) => list.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await notificationsApi.markAllAsRead();
    } catch {
      refresh();
    }
  };

  const shown = filter === "unread" ? items.filter((n) => !n.isRead) : items;

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">NOTIFICATIONS</span>
          <h1>Notifications</h1>
          <p>Important payment, order, delivery and marketplace updates.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {unreadCount > 0 && (
            <button className="outline-btn" onClick={markAllRead}>Mark all read</button>
          )}
          <button className="outline-btn" onClick={refresh}>Refresh</button>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-head">
          <div>
            <h3>Updates</h3>
            <span>{unreadCount} unread</span>
          </div>
          <div className="dlv-tabs" role="tablist">
            {[["all", "All", items.length], ["unread", "Unread", unreadCount]].map(([k, l, c]) =>
              <button type="button" role="tab" aria-selected={filter === k} key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}<em>{c}</em></button>)}
          </div>
        </div>

        {loading && <div className="empty-state"><h3>Loading…</h3></div>}

        {!loading && error && (
          <div className="empty-state">
            <h3>Couldn't load notifications</h3>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && shown.length === 0 && (
          <div className="empty-state">
            <h3>{filter === "unread" && items.length ? "You're all caught up" : "No notifications yet"}</h3>
            <p>{filter === "unread" && items.length ? "No unread notifications." : "Payment and order updates will appear here."}</p>
          </div>
        )}

        {!loading &&
          !error &&
          shown.map((n) => (
            <div className={"notification-card " + (n.isRead ? "read" : "unread")} key={n.id}>
              <div className="notification-icon">
                <Icon name={ICON_BY_TYPE[n.type] || "bell"} />
              </div>
              <div className="notification-copy">
                <b>{n.title}</b>
                {n.message && <p>{n.message}</p>}
                <small title={new Date(n.createdAt).toLocaleString("en-GB")}>{timeAgo(n.createdAt)}</small>
              </div>
              {!n.isRead && (
                <button className="outline-btn" onClick={() => markRead(n.id)}>Mark read</button>
              )}
            </div>
          ))}
      </div>
    </>
  );
}
