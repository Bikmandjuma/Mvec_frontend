import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "../components/DashboardLayout";
import { riderApi } from "../API/rider";
import { extractErrorMessage } from "../API/client";
import { PageHead, Metric, Loading, EmptyState, StatusPill, money, dateDMY } from "./seller/shared";
import LiveMap from "../components/LiveMap";
import { parcelPoints, minutesLeft, kmLeft } from "../utils/liveTracking";

const BOARD = ["rider", "board"];
const STEP_LABEL = { PICKED_UP: "I have the parcel", OUT_FOR_DELIVERY: "Start the delivery" };

// Everything on the rider's home, refreshed every 10 seconds (KitchenLink's rhythm).
async function loadBoard() {
  const { rider } = await riderApi.me();
  if (rider.status !== "APPROVED") return { rider, stats: null, active: null, offers: [] };
  const [stats, { delivery }] = await Promise.all([riderApi.stats(), riderApi.active()]);
  const offers = rider.isOnline && !delivery ? (await riderApi.available()).deliveries : [];
  return { rider, stats, active: delivery, offers };
}

/**
 * While online, the browser's position: at most every 4 s when moved 8 m or
 * more, and at least every 15 s (same rules as the app).
 */
function useSharedLocation(online) {
  const last = useRef(null);
  useEffect(() => {
    if (!online || !navigator.geolocation) return undefined;
    const watch = navigator.geolocation.watchPosition((p) => {
      const now = Date.now();
      const fix = { lat: p.coords.latitude, lng: p.coords.longitude, at: now };
      const { heading, speed, accuracy } = p.coords;
      const prev = last.current;
      const moved = prev ? Math.hypot((fix.lat - prev.lat) * 111320, (fix.lng - prev.lng) * 111320 * Math.cos((fix.lat * Math.PI) / 180)) : Infinity;
      if (prev && (now - prev.at < 4000 || (moved < 8 && now - prev.at < 15000))) return;
      last.current = fix;
      riderApi.sendLocation({
        lat: fix.lat, lng: fix.lng,
        // Heading is only meaningful while moving.
        heading: Number.isFinite(heading) && speed > 0.5 ? heading : null,
        speedMps: Number.isFinite(speed) ? speed : null,
        accuracyM: Number.isFinite(accuracy) ? accuracy : null,
      }).catch(() => {});
    }, () => {}, { enableHighAccuracy: true, maximumAge: 10000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [online]);
}

function Approval({ rider }) {
  const text = {
    REJECTED: rider.reviewNote || "Contact Ikiguzi support to find out more.",
    SUSPENDED: rider.reviewNote || "Contact Ikiguzi support.",
  }[rider.status] || "Ikiguzi is checking your details. You'll get a text message once you can start delivering.";
  return <div className="verified-box"><b>{rider.status === "PENDING" ? "Waiting for approval" : "Your rider account"}</b> <StatusPill value={rider.status} /><p>{text}</p></div>;
}

function Home({ board, refresh }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const run = async (key, fn) => {
    setBusy(key); setError("");
    try { await fn(); await refresh(); } catch (err) { setError(extractErrorMessage(err)); } finally { setBusy(""); }
  };
  const { rider, stats, active, offers } = board;
  return (
    <>
      <PageHead eyebrow="DELIVERY" title={`Hello, ${(rider.name || "rider").split(" ")[0]}`} desc="Go online to receive parcels near you. You keep the whole delivery fee." />
      {error && <div className="form-error">{error}</div>}
      {rider.status !== "APPROVED" ? <Approval rider={rider} /> : <>
        <div className="data-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div><b>{rider.isOnline ? "You're online" : "You're offline"}</b><p className="tiny">{rider.isOnline ? "Your location is shared while you are online." : "Go online to receive delivery offers."}</p></div>
          <button type="button" className={rider.isOnline ? "outline-btn" : "gradient-btn"} disabled={!!busy} onClick={() => run("online", () => riderApi.setOnline(!rider.isOnline))}>
            {busy === "online" ? "…" : rider.isOnline ? "Go offline" : "Go online"}
          </button>
        </div>
        <div className="metric-grid">
          <Metric icon="wallet" label="Today" value={money(stats.todayEarnings)} sub={`${stats.todayDeliveries} delivered`} />
          <Metric icon="chart" label="All time" value={money(stats.totalEarnings)} sub={`${stats.totalDeliveries} delivered`} />
        </div>
        {active
          ? <div className="data-card"><div className="data-card-head"><div><h3>Current delivery · {active.orderNumber}</h3><span>{active.statusLabel}</span></div><button type="button" className="gradient-btn" onClick={() => navigate("/delivery/trip")}>Open</button></div></div>
          : rider.isOnline && <div className="data-card">
            <div className="data-card-head"><div><h3>Offers near you</h3><span>The first rider to accept gets the parcel.</span></div></div>
            {!offers.length && <EmptyState title="No parcels right now" text="Stay online: new offers appear here." />}
            {offers.map((o) => (
              <div key={o.id} className="list-row" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "10px 0" }}>
                <div>
                  <b>{o.pickup.name}</b> · <b>{money(o.fee)}</b>{o.waitingForSeller && <span className="rider-tag">Seller still preparing it</span>}
                  <p className="tiny">{[o.distanceToPickupKm != null && `${o.distanceToPickupKm} km from you`, `${o.distanceKm} km trip`, o.dropoff.address && `to ${o.dropoff.address}`].filter(Boolean).join(" · ")}</p>
                  <p className="tiny">{o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="outline-btn" disabled={!!busy} onClick={() => run(`no-${o.id}`, () => riderApi.decline(o.id))}>Decline</button>
                  <button type="button" className="gradient-btn" disabled={!!busy} onClick={() => run(`yes-${o.id}`, async () => { await riderApi.accept(o.id); navigate("/delivery/trip"); })}>Accept</button>
                </div>
              </div>
            ))}
          </div>}
      </>}
    </>
  );
}

/** The parcel's story, from order placed to delivered: the seller's steps first, then the rider's. */
function Progress({ job }) {
  if (!job.progress?.length) return null;
  const at = (d) => d && new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="data-card">
      <h3>Order progress</h3>
      <ol className="rider-progress">
        {job.progress.map((p) => <li key={p.key} className={p.done ? "done" : ""}><span>{p.label}</span>{p.done && p.at && <small className="tiny">{at(p.at)}</small>}</li>)}
      </ol>
    </div>
  );
}

/** The trip's map: where the rider is, the road to go, the next turn and time left. */
function Navigation({ job }) {
  const { data: nav } = useQuery({
    queryKey: ["rider", "navigation", job.id, job.status],
    queryFn: () => riderApi.navigation(job.id),
    refetchInterval: (q) => (q.state.data?.refreshAfterS || 4) * 1000,
  });
  if (!nav?.active) return null;
  const next = nav.route?.steps?.find((s) => s.distanceM > 0) || nav.route?.steps?.[0];
  return (
    <div className="data-card live-track">
      <div className="live-track-head">
        <h3>{nav.target === "store" ? `To ${nav.store.name}` : "To the buyer"}</h3>
        {nav.route && <div className="live-track-eta"><b>{minutesLeft(nav.route.durationS)} min</b><small className="tiny">{kmLeft(nav.route.distanceM)}</small></div>}
      </div>
      {next && nav.route.source !== "straight" && <div className="live-track-turn">{next.instruction}{next.distanceM > 0 ? ` in ${kmLeft(next.distanceM)}` : ""}</div>}
      {!nav.rider.location && <p className="tiny">Allow location in your browser so the map can follow you.</p>}
      <LiveMap points={parcelPoints(nav)} route={nav.route?.geometry} height={320} />
    </div>
  );
}

function Trip({ board, refresh }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const job = board.active;
  if (!job) return <><PageHead eyebrow="DELIVERY" title="Current delivery" /><EmptyState title="No delivery in progress" text="Accept an offer on your dashboard to start one." /></>;
  const run = async (fn) => {
    setBusy(true); setError("");
    try { await fn(); await refresh(); } catch (err) { setError(extractErrorMessage(err)); } finally { setBusy(false); }
  };
  const next = job.allowedNextStatuses[0];
  const directions = (p) => p.lat != null && <a className="outline-btn compact-btn" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}>Directions</a>;
  return (
    <>
      <PageHead eyebrow={`DELIVERY · ${job.orderNumber}`} title={job.statusLabel} desc={`You earn ${money(job.fee)} for this parcel (${job.distanceKm} km).`} />
      {error && <div className="form-error">{error}</div>}
      {job.waitingForSeller && <div className="form-alert"><b>The seller is still preparing this parcel.</b> Head over if you like: you'll get a message the moment it's ready to collect.</div>}
      <Navigation job={job} />
      <Progress job={job} />
      <div className="data-card"><h3>{job.status === "ASSIGNED" ? "Pick up here" : "Picked up from"}</h3><p><b>{job.pickup.name}</b> · {job.pickup.address}</p>{job.status === "ASSIGNED" && directions(job.pickup)}</div>
      <div className="data-card">
        <h3>Deliver to</h3>
        <p><b>{job.customer?.name}</b> · {job.dropoff.address}</p>
        <p className="tiny">{job.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</p>
        {job.customer?.phone && <a className="outline-btn compact-btn" href={`tel:${job.customer.phone}`}>Call the buyer</a>} {job.status !== "ASSIGNED" && directions(job.dropoff)}
      </div>
      {next && <button type="button" className="gradient-btn" disabled={busy} onClick={() => window.confirm(`${STEP_LABEL[next]}? This can't be undone.`) && run(() => riderApi.step(job.id, next))}>{busy ? "…" : STEP_LABEL[next]}</button>}
      {job.status === "ASSIGNED" && <button type="button" className="outline-btn" disabled={busy} onClick={() => window.confirm("Hand this parcel back? Another rider will get it, and it won't be offered to you again.") && run(async () => { await riderApi.handBack(job.id); navigate("/delivery"); })}>Hand it back</button>}
      {job.canConfirm && <form className="data-card" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await riderApi.confirm(job.id, code.trim()); window.alert(`Delivered. You earned ${money(r.earned)}.`); navigate("/delivery"); }); }}>
        <h3>The buyer's code</h3>
        <p className="tiny">Ask for the 6-digit code on their order only when the parcel is in their hands. Five wrong codes lock the delivery for Ikiguzi support.</p>
        <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" aria-label="Delivery code" />
        <button type="submit" className="gradient-btn" disabled={busy || code.length !== 6}>Confirm delivery</button>
      </form>}
    </>
  );
}

function Earnings({ board }) {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["rider", "earnings"], queryFn: () => Promise.all([riderApi.wallet(), riderApi.withdrawals(), riderApi.history()]) });
  const [form, setForm] = useState({ amount: "", name: board.rider.name || "", number: board.rider.phone || "" });
  const [notice, setNotice] = useState(null);
  if (isPending) return <Loading />;
  const [{ wallet }, { payouts }, { deliveries }] = data;
  const submit = async (e) => {
    e.preventDefault(); setNotice(null);
    try {
      const r = await riderApi.withdraw(Number(form.amount), form.name.trim(), form.number.trim());
      setNotice({ ok: true, text: r.message }); setForm((f) => ({ ...f, amount: "" }));
      queryClient.invalidateQueries({ queryKey: ["rider", "earnings"] });
    } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); }
  };
  return (
    <>
      <PageHead eyebrow="DELIVERY" title="Earnings" desc="Each delivered parcel adds its whole delivery fee here." />
      <div className="metric-grid">
        <Metric icon="wallet" label="Available" value={money(wallet.available)} />
        <Metric icon="chart" label="Earned in total" value={money(wallet.totalEarned)} sub={`${money(wallet.totalWithdrawn)} withdrawn`} />
      </div>
      <form className="data-card" onSubmit={submit}>
        <h3>Withdraw to mobile money</h3>
        {notice && <div className={notice.ok ? "form-alert success" : "form-error"}>{notice.text}</div>}
        <label className="field"><span>Amount (RWF)</span><input inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={`At least ${money(wallet.minimumWithdrawal)}`} /></label>
        <label className="field"><span>Account holder name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field"><span>Mobile money number</span><input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></label>
        <button type="submit" className="gradient-btn" disabled={wallet.available < wallet.minimumWithdrawal}>Withdraw</button>
      </form>
      <div className="data-card"><h3>Withdrawals</h3>{!payouts.length && <EmptyState title="No withdrawals yet" />}{payouts.map((p) => <p key={p._id || p.id}><b>{money(p.amount)}</b> · {p.payoutDetails?.accountNumber} · {dateDMY(p.createdAt)} <StatusPill value={p.status} /></p>)}</div>
      <div className="data-card"><h3>Delivered</h3>{!deliveries.length && <EmptyState title="No deliveries yet" />}{deliveries.map((d) => <p key={d.id}><b>{d.pickup.name}</b> → {d.customer?.name} · {d.orderNumber} · {dateDMY(d.deliveredAt)} · <b>{money(d.fee)}</b></p>)}</div>
    </>
  );
}

/** `/delivery/*`: the Ikiguzi rider's dashboard, trip and earnings. */
export default function RiderDashboard() {
  const path = useLocation().pathname;
  const queryClient = useQueryClient();
  const { data: board, error, isPending } = useQuery({ queryKey: BOARD, queryFn: loadBoard, refetchInterval: 10_000 });
  useSharedLocation(Boolean(board?.rider?.isOnline && board.rider.status === "APPROVED"));
  const refresh = () => queryClient.invalidateQueries({ queryKey: BOARD });
  const page = isPending ? <Loading />
    : error ? <div className="form-error">{extractErrorMessage(error)}</div>
    : path.startsWith("/delivery/trip") ? <Trip board={board} refresh={refresh} />
    : path.startsWith("/delivery/earnings") ? <Earnings board={board} />
    : <Home board={board} refresh={refresh} />;
  return <DashboardLayout>{page}</DashboardLayout>;
}
