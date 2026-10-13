import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { conversationsApi, normalizeMessage } from "../API/conversations";
import { extractErrorMessage } from "../API/client";
import { getSocket } from "../services/socket";

const timeOf = (d) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

function otherParticipant(conversation, myId) {
  return (conversation.participants || []).find((p) => p.id !== myId) || {};
}

export default function Messages() {
  const { user } = useAuth();
  const myId = user?.id;

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [typingIds, setTypingIds] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [contactResults, setContactResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const listEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const selectedIdRef = useRef(null);
  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  );

  // ── Load conversations once, then keep the socket open for real-time updates ──
  const loadConversations = useCallback(() => {
    setLoadingConversations(true);
    conversationsApi
      .getAll()
      .then((res) => {
        const list = res.conversations || [];
        setConversations(list);
        if (!selectedId && list.length) setSelectedId(list[0].id);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoadingConversations(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const onNewMessage = ({ conversationId, message: raw }) => {
      const message = normalizeMessage(raw);
      // Our own messages are already shown optimistically by send().
      if (message.senderId === myId) return;
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: message.content, lastMessageAt: message.createdAt, unreadCount: conversationId === selectedIdRef.current ? 0 : (c.unreadCount || 0) + 1 }
            : c,
        );
        return next.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      });
      if (conversationId === selectedIdRef.current) {
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
        conversationsApi.markRead(conversationId).catch(() => null);
      }
    };

    const onMessagesRead = ({ conversationId, readerId }) => {
      if (readerId === myId) return;
      if (conversationId === selectedIdRef.current) {
        setMessages((prev) => prev.map((m) => ({ ...m, readByIds: Array.from(new Set([...(m.readByIds || []), "read"])) })));
      }
    };

    const onTyping = ({ conversationId, userId, isTyping }) => {
      if (conversationId !== selectedIdRef.current) return;
      setTypingIds((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    const onPresence = ({ userId, online }) => {
      setOnlineIds((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    socket.on("new_message", onNewMessage);
    socket.on("messages_read", onMessagesRead);
    socket.on("typing", onTyping);
    socket.on("presence", onPresence);

    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("messages_read", onMessagesRead);
      socket.off("typing", onTyping);
      socket.off("presence", onPresence);
    };
  }, [myId]);

  // Keep a ref in sync with selectedId so socket callbacks (closed over once)
  // always know which conversation is currently open.
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // ── Load messages for the selected conversation, mark them read ──────────
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    setLoadingMessages(true);
    setTypingIds(new Set());
    conversationsApi
      .getMessages(selectedId)
      .then((res) => setMessages(res.messages || []))
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoadingMessages(false));

    conversationsApi.markRead(selectedId).then(() => {
      setConversations((prev) => prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c)));
    }).catch(() => null);
  }, [selectedId]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Sending + typing signal ───────────────────────────────────────────────
  const emitTyping = (isTyping) => {
    if (!selectedConversation) return;
    const socket = getSocket();
    if (!socket) return;
    const participantIds = (selectedConversation.participants || []).map((p) => p.id);
    socket.emit("typing", { conversationId: selectedConversation.id, participantIds, isTyping });
  };

  const onInputChange = (e) => {
    setText(e.target.value);
    emitTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTyping(false), 1500);
  };

  const send = async () => {
    const content = text.trim();
    if (!content || !selectedId) return;
    setText("");
    emitTyping(false);

    const optimistic = {
      id: `temp-${Date.now()}`,
      conversationId: selectedId,
      senderId: myId,
      content,
      createdAt: new Date().toISOString(),
      readByIds: [myId],
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === selectedId ? { ...c, lastMessage: content, lastMessageAt: optimistic.createdAt } : c));
      return next.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    });

    try {
      const res = await conversationsApi.sendMessage(selectedId, { content });
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? res.message : m)));
    } catch (err) {
      setError(extractErrorMessage(err));
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  };

  // ── Start a new conversation ──────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) { setContactResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      conversationsApi
        .searchContacts(query.trim())
        .then((res) => setContactResults(res.contacts || []))
        .catch(() => setContactResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const startConversation = async (contact) => {
    try {
      const res = await conversationsApi.create({ recipientId: contact.id });
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === res.conversation.id);
        return exists ? prev : [{ ...res.conversation, unreadCount: 0 }, ...prev];
      });
      setSelectedId(res.conversation.id);
      setQuery("");
      setContactResults([]);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const otherIsTyping = selectedConversation && typingIds.size > 0;
  const other = selectedConversation ? otherParticipant(selectedConversation, myId) : null;

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">MESSAGES</span>
          <h1>Messages</h1>
          <p>Chat with buyers, vendors, suppliers and MVEC in real time.</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="communication-layout">
        <div className="data-card conversation-list">
          <div className="new-conversation">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people to message…"
            />
          </div>

          {query.trim().length >= 2 && (
            <div className="contact-results">
              {searching && <div className="tiny">Searching…</div>}
              {!searching && contactResults.length === 0 && <div className="tiny">No matches found.</div>}
              {contactResults.map((c) => (
                <button key={c.id} className="conversation-item" onClick={() => startConversation(c)}>
                  <div className="conv-avatar">{initials(c.companyName || c.fullName)}</div>
                  <div>
                    <b>{c.companyName || c.fullName}</b>
                    <small>{c.role}</small>
                  </div>
                </button>
              ))}
            </div>
          )}

          {loadingConversations && <div className="tiny">Loading conversations…</div>}

          {!loadingConversations && conversations.length === 0 && query.trim().length < 2 && (
            <div className="empty-state">
              <h3>No conversations yet</h3>
              <p>Search for someone above to start your first chat.</p>
            </div>
          )}

          {conversations.map((c) => {
            const person = otherParticipant(c, myId);
            const isOnline = onlineIds.has(person.id);
            return (
              <button
                key={c.id}
                className={"conversation-item " + (selectedId === c.id ? "selected" : "")}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="conv-avatar">
                  {initials(person.companyName || person.fullName)}
                  {isOnline && <i className="online-dot" />}
                </div>
                <div>
                  <b>{person.companyName || person.fullName || "Unknown user"}</b>
                  <small>{c.lastMessageAt ? timeOf(c.lastMessageAt) : ""}</small>
                  <p>{c.lastMessage || "Say hello…"}</p>
                </div>
                {c.unreadCount > 0 && <span className="nav-count">{c.unreadCount}</span>}
              </button>
            );
          })}
        </div>

        <div className="data-card message-thread">
          {!selectedConversation ? (
            <div className="empty-state">
              <h3>Select a conversation</h3>
              <p>Choose a chat on the left, or search for someone to message.</p>
            </div>
          ) : (
            <>
              <div className="thread-head">
                <div className="conv-avatar">
                  {initials(other?.companyName || other?.fullName)}
                  {onlineIds.has(other?.id) && <i className="online-dot" />}
                </div>
                <div>
                  <h3>{other?.companyName || other?.fullName || "Conversation"}</h3>
                  <small>{otherIsTyping ? "typing…" : onlineIds.has(other?.id) ? "Online" : "Offline"}</small>
                </div>
              </div>

              <div className="message-list">
                {loadingMessages && <div className="tiny">Loading messages…</div>}
                {!loadingMessages && messages.length === 0 && (
                  <div className="empty-state"><h3>No messages yet</h3><p>Send the first message below.</p></div>
                )}
                {messages.map((m) => {
                  const mine = m.senderId === myId;
                  const isRead = Array.isArray(m.readByIds) && m.readByIds.length > 1;
                  return (
                    <div key={m.id} className={"message-bubble " + (mine ? "mine" : "theirs")}>
                      <p>{m.content}</p>
                      <small>
                        {timeOf(m.createdAt)}
                        {mine && (
                          <span className={"read-ticks" + (isRead ? " read" : "")}>
                            {isRead ? "✓✓" : "✓"}
                          </span>
                        )}
                      </small>
                    </div>
                  );
                })}
                {otherIsTyping && (
                  <div className="message-bubble theirs typing-bubble">
                    <span className="typing-dots"><i /><i /><i /></span>
                  </div>
                )}
                <div ref={listEndRef} />
              </div>

              <div className="message-compose">
                <input
                  value={text}
                  onChange={onInputChange}
                  placeholder="Write a message…"
                  onKeyDown={(e) => e.key === "Enter" && send()}
                />
                <button className="gradient-btn" onClick={send} disabled={!text.trim()}>
                  <Icon name="arrow" size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
