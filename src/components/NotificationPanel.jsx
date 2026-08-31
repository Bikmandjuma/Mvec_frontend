import {useState} from "react";
import Icon from "./Icon";
import {getNotifications,markNotificationRead} from "../services/mvecStore";

export default function NotificationPanel({role,recipient}){
 const [items,setItems]=useState(()=>getNotifications(role,recipient));
 const refresh=()=>setItems(getNotifications(role,recipient));
 const mark=id=>{markNotificationRead(id);refresh()};
 return <><div className="dash-page-head"><div><span className="eyebrow">NOTIFICATIONS</span><h1>Notifications</h1><p>Important payment, order, delivery and marketplace updates.</p></div><button className="outline-btn" onClick={refresh}>Refresh</button></div><div className="data-card"><div className="data-card-head"><div><h3>Updates</h3><span>{items.filter(x=>!x.read).length} unread</span></div></div>{items.length?items.map(n=><div className={'notification-card '+(n.read?'read':'unread')} key={n.id}><div className="notification-icon"><Icon name={n.type==='payment'?'wallet':n.type==='settlement'?'check':n.type==='payout'?'wallet':'bell'}/></div><div className="notification-copy"><b>{n.title}</b><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleDateString('en-GB')} · {new Date(n.createdAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}{n.reference?` · ${n.reference}`:''}</small></div>{!n.read&&<button className="outline-btn" onClick={()=>mark(n.id)}>Mark read</button>}</div>):<div className="empty-state"><h3>No notifications yet</h3><p>Payment and order updates will appear here.</p></div>}</div></>;
}
