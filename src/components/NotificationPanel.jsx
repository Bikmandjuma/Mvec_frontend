import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { notificationsApi } from "../API/notifications";
import { extractErrorMessage } from "../API/client";

const ICON_BY_TYPE = {
  ORDER: "cart",
  PAYMENT: "wallet",
  PAYOUT: "wallet",
  ADMIN: "shield",
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

export default function NotificationPanel() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        </div>

        {loading && <div className="empty-state"><h3>Loading…</h3></div>}

        {!loading && error && (
          <div className="empty-state">
            <h3>Couldn't load notifications</h3>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="empty-state">
            <h3>No notifications yet</h3>
            <p>Payment and order updates will appear here.</p>
          </div>
        )}

        {!loading &&
          !error &&
          items.map((n) => (
            <div className={"notification-card " + (n.isRead ? "read" : "unread")} key={n.id}>
              <div className="notification-icon">
                <Icon name={ICON_BY_TYPE[n.type] || "bell"} />
              </div>
              <div className="notification-copy">
                <b>{n.title}</b>
                <p>{n.body}</p>
                <small>
                  {new Date(n.createdAt).toLocaleDateString("en-GB")}{" "}
                  {new Date(n.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </small>
              </div>
              <div className="notification-actions">
                {n.link && n.link.startsWith("/") && (
                  <button className="gradient-btn" onClick={() => { if (!n.isRead) markRead(n.id); navigate(n.link); }}>View</button>
                )}
                {!n.isRead && (
                  <button className="outline-btn" onClick={() => markRead(n.id)}>Mark read</button>
                )}
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
