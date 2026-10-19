import { useCallback, useEffect, useRef, useState } from "react";
import { disputesApi } from "../API/disputes";
import { extractErrorMessage } from "../API/client";
import { getSocket } from "../services/socket";

// One problem-report case, as the buyer, the seller or MVEC sees it:
// where it stands, what happens next, the whole conversation, and only the
// actions that person can take. Used on the buyer's order page, the seller's
// Refunds page and the admin Disputes page.
const money = (n) => `${Math.round(Number(n) || 0).toLocaleString("en-RW")} RWF`;
const when = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const REASON = { ITEM_NOT_RECEIVED: "Item not received", DAMAGED_GOODS: "Damaged item", WRONG_ITEM: "Wrong item", INCOMPLETE_ORDER: "Items missing", SLA_BREACH: "Late delivery", OTHER: "Other problem" };
const CLOSED = ["RESOLVED_BUYER_REFUNDED", "RESOLVED_VENDOR_RELEASED", "RESOLVED_SPLIT", "REJECTED", "WITHDRAWN"];

// The steps everyone sees.
function stepOf(c) {
  if (CLOSED.includes(c.status)) return 3;
  if (c.status === "UNDER_REVIEW") return 2;
  if (c.status === "EVIDENCE_SUBMITTED" || c.offerStatus === "PENDING") return 1;
  return 0;
}
const STEPS = ["Reported", "Seller responding", "MVEC reviewing", "Resolved"];

function outcomeText(c) {
  const d = c.arbitrationDecision || {};
  if (c.status === "WITHDRAWN") return "The buyer withdrew the report. The order continued as normal.";
  if (c.status === "RESOLVED_BUYER_REFUNDED") return `The buyer was refunded ${money(d.buyerRefundAmount || c.order.totalAmount)}.`;
  if (c.status === "RESOLVED_VENDOR_RELEASED") return "The payment was released to the seller.";
  if (c.status === "RESOLVED_SPLIT") return `The buyer was refunded ${money(d.buyerRefundAmount)} and ${money(d.vendorReleaseAmount)} was released to the seller.`;
  return "";
}

// "What happens next", written for the person looking at the case.
function nextText(c, you) {
  if (CLOSED.includes(c.status)) return outcomeText(c);
  const deadline = c.respondBy ? new Date(c.respondBy).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : "";
  if (c.status === "UNDER_REVIEW") {
    return you === "admin" ? "Both sides are waiting for your decision. Read the conversation, ask for anything missing, then decide below."
      : "MVEC is reviewing both sides and will decide. You can still add information below. You'll be told the outcome.";
  }
  if (c.offerStatus === "PENDING") {
    return you === "buyer" ? `The seller offers to refund ${money(c.offerAmount)}. Accept it to close the case, or decline and MVEC will decide.`
      : you === "seller" ? `Waiting for the buyer to answer your ${money(c.offerAmount)} offer.`
      : `The seller offered ${money(c.offerAmount)}; waiting for the buyer.`;
  }
  if (you === "seller") return `The payment for this order is on hold. Refund the buyer, offer a partial refund, or reply with your side${deadline ? ` before ${deadline}` : ""}. If you don't respond in time, MVEC will decide.`;
  if (you === "buyer") return `The seller has been told and has ${deadline ? `until ${deadline}` : "a few days"} to respond. The payment stays on hold meanwhile. If you can't agree, ask MVEC to decide.`;
  return `Waiting for the seller to respond${deadline ? ` (by ${deadline})` : ""}. If they don't, the case comes to you automatically.`;
}

export default function DisputeCase({ caseId, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState("");
  const [reply, setReply] = useState("");
  const [offer, setOffer] = useState({ open: false, amount: "", note: "" });
  const [decision, setDecision] = useState({ decision: "", refund: "", release: "", notes: "" });
  const endRef = useRef(null);

  const load = useCallback(() => disputesApi.getCase(caseId).then((r) => { setData(r); setError(""); }).catch((err) => setError(extractErrorMessage(err))), [caseId]);
  useEffect(() => { load(); }, [load]);

  // Live updates: new messages and status changes from the other side.
  useEffect(() => {
    const socket = getSocket?.();
    if (!socket) return undefined;
    socket.emit("join_dispute_room", caseId);
    const refresh = () => load(); // the room only carries this case's events
    socket.on("dispute_updated", refresh);
    socket.on("new_evidence_submitted", refresh);
    socket.on("dispute_resolved", refresh);
    return () => { socket.off("dispute_updated", refresh); socket.off("new_evidence_submitted", refresh); socket.off("dispute_resolved", refresh); };
  }, [caseId, load]);

  const act = async (key, fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key); setNotice(null);
    try {
      const r = await fn();
      setNotice({ ok: true, text: r?.message || "Done." });
      await load();
      onChanged?.();
    } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); }
    finally { setBusy(""); }
  };

  if (error) return <div className="form-alert error">{error}</div>;
  if (!data) return <div className="empty-state"><h3>Loading the case…</h3></div>;
  const c = data.case; const you = data.you; const can = data.actions; const step = stepOf(c);
  const closed = CLOSED.includes(c.status);

  return <div className="dispute-case">
    <div className="dispute-head">
      <div><span className="eyebrow">PROBLEM REPORT · {c.disputeNumber}</span>
        <h3>{REASON[c.reason] || "Problem"} · order {c.order.orderNumber}</h3>
        <small>Buyer {c.buyerName || "—"} · Seller {c.sellerName || "—"} · Order total {money(c.order.totalAmount)}{c.held?.gross ? ` · ${money(c.held.gross)} on hold` : ""}</small>
      </div>
    </div>
    <ol className="dispute-steps">{STEPS.map((s, i) => <li key={s} className={i < step || (closed && i === 3) ? "done" : i === step ? "now" : ""}><i>{i < step || (closed && i === 3) ? "✓" : i + 1}</i><span>{s}</span></li>)}</ol>
    <div className={`dispute-next ${closed ? "closed" : ""}`}><b>{closed ? "Outcome" : "What happens next"}</b><p>{nextText(c, you)}</p>
      {closed && c.arbitrationDecision?.notes && <p className="tiny">{c.arbitrationDecision.notes}</p>}</div>
    {notice && <div className={`form-alert ${notice.ok ? "success" : "error"}`} role="status">{notice.text}</div>}

    {/* Buyer: answer the seller's offer */}
    {(can.acceptOffer || can.declineOffer) && <div className="dispute-offer">
      <b>Refund offer: {money(c.offerAmount)}</b>{c.offerNote && <p>“{c.offerNote}”</p>}
      <div className="dispute-actions">
        <button type="button" className="gradient-btn" disabled={!!busy} onClick={() => act("accept", () => disputesApi.acceptOffer(caseId), `Accept ${money(c.offerAmount)} and close the case? The rest of the payment goes to the seller.`)}>{busy === "accept" ? "Accepting…" : `Accept ${money(c.offerAmount)}`}</button>
        <button type="button" className="outline-btn" disabled={!!busy} onClick={() => act("decline", () => disputesApi.declineOffer(caseId), "Decline the offer? MVEC will review the case and decide.")}>Decline, let MVEC decide</button>
      </div>
    </div>}

    <div className="dispute-thread">
      <div className="dispute-msg buyer first"><div><b>{c.buyerName || "Buyer"}</b><small>{when(c.createdAt)}</small></div><p>{c.description}</p></div>
      {data.timeline.map((m) => m.role === "system"
        ? <div className="dispute-event" key={m.id}><span>{m.message}</span><small>{when(m.createdAt)}</small></div>
        : <div className={`dispute-msg ${m.role === "buyer" ? "buyer" : m.role === "super_admin" ? "mvec" : "seller"}`} key={m.id}><div><b>{m.who}</b><small>{when(m.createdAt)}</small></div><p>{m.message}</p></div>)}
      <div ref={endRef} />
    </div>

    {can.reply && <form className="dispute-reply" onSubmit={(e) => { e.preventDefault(); if (!reply.trim()) return; act("reply", () => disputesApi.submitEvidence(caseId, { message: reply.trim() }).then((r) => { setReply(""); return { message: "Sent. Everyone on the case has been told." }; })); }}>
      <textarea rows="3" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000}
        placeholder={you === "admin" ? "Message both sides (e.g. ask the seller for delivery proof)…" : you === "seller" ? "Your side: delivery proof, what was sent, how you'd like to resolve it…" : "Add details, photos links, or reply to the seller…"} />
      <button type="submit" className="outline-btn" disabled={!!busy || !reply.trim()}>{busy === "reply" ? "Sending…" : "Send"}</button>
    </form>}

    {/* Seller: resolve directly */}
    {you === "seller" && !closed && <div className="dispute-actions">
      {can.fullRefund && <button type="button" className="gradient-btn" disabled={!!busy} onClick={() => act("refund", () => disputesApi.fullRefund(caseId), `Refund the buyer ${money(c.held?.gross || c.order.totalAmount)} in full and close the case?`)}>{busy === "refund" ? "Refunding…" : "Refund in full"}</button>}
      {can.offer && <button type="button" className="outline-btn" disabled={!!busy} onClick={() => setOffer((o) => ({ ...o, open: !o.open }))}>Offer a partial refund</button>}
      {can.escalate && <button type="button" className="outline-btn" disabled={!!busy} onClick={() => act("escalate", () => disputesApi.escalate(caseId), "Ask MVEC to decide this case?")}>Ask MVEC to decide</button>}
    </div>}
    {you === "seller" && offer.open && can.offer && <form className="dispute-offer-form" onSubmit={(e) => { e.preventDefault(); act("offer", () => disputesApi.offer(caseId, Number(offer.amount), offer.note).then((r) => { setOffer({ open: false, amount: "", note: "" }); return r; })); }}>
      <label className="field"><span>Refund amount (RWF)</span><input type="number" min="1" max={Math.max(1, (c.held?.gross || c.order.totalAmount) - 1)} value={offer.amount} onChange={(e) => setOffer({ ...offer, amount: e.target.value })} required /></label>
      <label className="field"><span>Message to the buyer (optional)</span><input value={offer.note} maxLength={500} onChange={(e) => setOffer({ ...offer, note: e.target.value })} placeholder="e.g. Sorry for the scratch; keep the item with this refund." /></label>
      <button className="gradient-btn" disabled={!!busy || !(Number(offer.amount) > 0)}>{busy === "offer" ? "Sending…" : "Send offer"}</button>
    </form>}

    {/* Buyer: other options */}
    {you === "buyer" && !closed && <div className="dispute-actions">
      {can.escalate && <button type="button" className="outline-btn" disabled={!!busy} onClick={() => act("escalate", () => disputesApi.escalate(caseId), "Ask MVEC to decide? MVEC will review both sides.")}>Ask MVEC to decide</button>}
      {can.withdraw && <button type="button" className="outline-btn" disabled={!!busy} onClick={() => act("withdraw", () => disputesApi.withdraw(caseId), "Withdraw the report? Use this only if the problem is solved: the seller will be paid as normal.")}>Problem solved: withdraw report</button>}
    </div>}

    {/* MVEC: decide */}
    {can.decide && <form className="dispute-decide" onSubmit={(e) => {
      e.preventDefault();
      const payload = { decision: decision.decision, notes: decision.notes, ...(decision.decision === "SPLIT_SETTLEMENT" ? { buyerRefundAmount: Number(decision.refund), vendorReleaseAmount: Number(decision.release) } : {}) };
      const label = decision.decision === "REFUND_BUYER" ? `refund the buyer ${money(c.held?.gross || c.order.totalAmount)}` : decision.decision === "RELEASE_TO_VENDOR" ? "pay the seller" : `refund ${money(decision.refund)} and release ${money(decision.release)} to the seller`;
      act("decide", () => disputesApi.decide(caseId, payload), `Decide to ${label}? The money moves straight away and both sides are told.`);
    }}>
      <h4>MVEC decision</h4>
      <div className="dispute-choices" role="radiogroup">
        {[["REFUND_BUYER", "Refund the buyer in full", `${money(c.held?.gross || c.order.totalAmount)} goes back to the buyer.`], ["RELEASE_TO_VENDOR", "Pay the seller", "The seller is paid as if delivered."], ["SPLIT_SETTLEMENT", "Split", "Refund part to the buyer, release part to the seller; MVEC keeps any rest."]].map(([k, l, d]) =>
          <label key={k} className={decision.decision === k ? "selected" : ""}><input type="radio" name={`decision-${caseId}`} checked={decision.decision === k} onChange={() => setDecision({ ...decision, decision: k })} /><span><b>{l}</b><small>{d}</small></span></label>)}
      </div>
      {decision.decision === "SPLIT_SETTLEMENT" && <div className="form-row">
        <label className="field"><span>Refund to buyer (RWF)</span><input type="number" min="0" value={decision.refund} onChange={(e) => setDecision({ ...decision, refund: e.target.value })} /></label>
        <label className="field"><span>Release to seller (RWF)</span><input type="number" min="0" value={decision.release} onChange={(e) => setDecision({ ...decision, release: e.target.value })} /></label>
      </div>}
      {decision.decision === "SPLIT_SETTLEMENT" && <p className="tiny">On hold: {money(c.held?.gross)}. The seller's usual share of the whole order is {money(c.held?.net)}.</p>}
      <label className="field"><span>Reason (both sides see this)</span><textarea rows="3" value={decision.notes} onChange={(e) => setDecision({ ...decision, notes: e.target.value })} placeholder="e.g. The photos show the screen arrived cracked; the seller did not provide packing proof." required /></label>
      <button className="gradient-btn" disabled={!!busy || !decision.decision || !decision.notes.trim() || (decision.decision === "SPLIT_SETTLEMENT" && !(Number(decision.refund) + Number(decision.release) > 0))}>{busy === "decide" ? "Deciding…" : "Decide and move the money"}</button>
    </form>}
  </div>;
}
