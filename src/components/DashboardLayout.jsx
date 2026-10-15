import {useState,useEffect} from 'react';import {Link,useLocation,useNavigate} from 'react-router-dom';import {useAuth} from '../context/AuthContext';import {useTheme} from '../context/ThemeContext';import Icon from './Icon';import ThemeToggle from './ThemeToggle';import CommandPalette from './CommandPalette';
import {navGroupsForRole} from '../data/navItems';
import {staffCan,STAFF_ROLE_LABEL} from '../data/staffAccess';
import {PORTAL_PROFILE} from '../pages/Profile';
import {notificationsApi} from '../API/notifications';
import useAdminBadges from './dashboard/useAdminBadges';

// Longest href that matches the current path, so nested pages such as
// /vendor/orders/123 still highlight "Orders". Dashboard roots (/vendor,
// /admin…) only match exactly.
function findActiveHref(groups,pathname){
  let best='';
  groups.forEach(g=>g.items.forEach(([href])=>{
    const isRoot=href.split('/').length<=2;
    const hit=pathname===href||(!isRoot&&pathname.startsWith(href+'/'));
    if(hit&&href.length>best.length) best=href;
  }));
  return best;
}

function SidebarLink({href,label,icon,active,onNavigate,badge}){
  return <Link to={href} onClick={onNavigate} className={'sb-link'+(active?' active':'')} aria-current={active?'page':undefined} title={badge?`${label}: ${badge} waiting`:label}>
    <Icon name={icon} size={17}/><span>{label}</span>{badge>0&&<em className="sb-badge" aria-label={`${badge} waiting`}>{badge>99?'99+':badge}</em>}
  </Link>;
}

function GroupedNav({groups,pathname,onNavigate,badges={}}){
  const activeHref=findActiveHref(groups,pathname);
  const activeGroupLabel=groups.find(g=>g.items.some(([href])=>href===activeHref))?.label;
  const [openGroup,setOpenGroup]=useState(activeGroupLabel||groups.find(g=>g.items.length>1)?.label);
  return <nav className="sb-nav" aria-label="Dashboard navigation">{groups.map(group=>{
    // A group holding a single link (e.g. Dashboard) reads better as a plain link.
    if(group.items.length===1){
      const [href,label,icon]=group.items[0];
      return <SidebarLink key={group.label} href={href} label={label} icon={icon} active={href===activeHref} onNavigate={onNavigate} badge={badges[href]}/>;
    }
    const isOpen=openGroup===group.label;
    const hasActive=group.label===activeGroupLabel;
    const waiting=group.items.reduce((sum,[href])=>sum+(badges[href]||0),0);
    return <div className={'sb-group'+(isOpen?' open':'')+(hasActive?' has-active':'')} key={group.label}>
      <button type="button" className="sb-group-head" aria-expanded={isOpen} onClick={()=>setOpenGroup(isOpen?null:group.label)}>
        <span>{group.label}</span>
        {waiting>0&&!isOpen?<em className="sb-badge" aria-label={`${waiting} waiting`}>{waiting>99?'99+':waiting}</em>:hasActive&&!isOpen&&<i className="sb-dot" aria-hidden="true"/>}
        <Icon name="arrow" size={12}/>
      </button>
      {isOpen&&<div className="sb-group-body">{group.items.map(([href,label,icon])=>
        <SidebarLink key={href} href={href} label={label} icon={icon} active={href===activeHref} onNavigate={onNavigate} badge={badges[href]}/>
      )}</div>}
    </div>;
  })}</nav>;
}

function Sidebar({admin,role,user,avatar,pathname,onNavigate,onLogout}){
  const badges=useAdminBadges(admin);
  const platform=admin?'Admin':role==='supplier'?'Supplier':role==='affiliate'?'Affiliate':role==='delivery'?'Delivery':'Seller';
  const accountLabel=admin?'Super Administrator':role==='supplier'?'Supplier account':role==='affiliate'?'Affiliate account':role==='delivery'?'Delivery partner':user?.isStaff?`${STAFF_ROLE_LABEL[user.staffRole]||'Staff'} · ${user.staffStoreName||'Store'}`:'Vendor account';
  // Staff only see the menus their role gives access to.
  const groups=navGroupsForRole(role,admin).map(g=>({...g,items:g.items.filter(([href])=>admin||staffCan(user,href))})).filter(g=>g.items.length);
  return <aside className="dashboard-sidebar sb">
    <div className="sb-brand">
      <Link to="/" className="sb-logo">MVEC</Link>
      <span className="sb-platform">{platform}</span>
    </div>
    <Link to={admin?'/admin/profile':PORTAL_PROFILE[role]||'/profile'} className="sb-user" onClick={onNavigate}>
      <div className="dash-avatar sb-avatar">{avatar?<img src={avatar} alt="Profile"/>:(user?.fullName?.[0]||'M')}</div>
      <div className="sb-user-text"><b>{user?.fullName||'MVEC User'}</b><small>{accountLabel}</small></div>
    </Link>
    <GroupedNav groups={groups} pathname={pathname} onNavigate={onNavigate} badges={badges}/>
    <div className="sb-footer">
      <Link to={admin?'/admin/profile':PORTAL_PROFILE[role]||'/profile'} className={'sb-link'+(pathname.endsWith('/profile')?' active':'')} onClick={onNavigate}><Icon name="user" size={17}/><span>Account settings</span></Link>
      <Link to="/" className="sb-link"><Icon name="home" size={17}/><span>View marketplace</span></Link>
      <button type="button" className="sb-link sb-logout" onClick={onLogout}><Icon name="logout" size={17}/><span>Sign out</span></button>
    </div>
  </aside>;
}

export default function DashboardLayout({admin=false,children}){const {user,logout}=useAuth(),loc=useLocation(),navigate=useNavigate(),{theme,toggleTheme}=useTheme();const [open,setOpen]=useState(false);const avatar=user?.avatarUrl||'';
const [unread,setUnread]=useState(0);
useEffect(()=>{let alive=true;const load=()=>notificationsApi.getAll({limit:1}).then(d=>{if(alive)setUnread(d.unreadCount||0)}).catch(()=>{});load();const t=setInterval(load,30000);return()=>{alive=false;clearInterval(t)}},[]);

const [paletteOpen,setPaletteOpen]=useState(false);
// ⌘K / Ctrl+K anywhere, or "/" when not typing, opens global search.
useEffect(()=>{const onKey=e=>{const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setPaletteOpen(o=>!o)}else if(e.key==='/'&&!typing&&!paletteOpen){e.preventDefault();setPaletteOpen(true)}};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[paletteOpen]);
const isMac=typeof navigator!=='undefined'&&/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);

const role=user?.role;return <div className={'dashboard-shell '+(open?'sidebar-open':'')}><Sidebar admin={admin} role={role} user={user} avatar={avatar} pathname={loc.pathname} onNavigate={()=>setOpen(false)} onLogout={()=>{logout();navigate('/')}}/><section className="dashboard-main"><header className="dash-header"><button className="mobile-menu" onClick={()=>setOpen(v=>!v)}><Icon name="menu"/></button><button type="button" className="dash-search-trigger" onClick={()=>setPaletteOpen(true)} aria-label="Search (Ctrl+K)"><Icon name="search" size={17}/><span>{role==='vendor'&&!admin?'Search orders, products, customers…':admin?'Search users, sellers, orders…':'Search…'}</span><kbd>{isMac?'⌘':'Ctrl'} K</kbd></button><div className="dash-header-actions"><ThemeToggle/><Link className="dashboard-bell" to={admin?'/admin/notifications':role==='supplier'?'/supplier/notifications':role==='affiliate'?'/affiliate/notifications':role==='vendor'||role==='super_admin'?'/vendor/notifications':'/'}><Icon name="bell"/>{unread>0&&<span className="bell-badge">{unread>9?'9+':unread}</span>}</Link><Link to={admin?'/admin/profile':PORTAL_PROFILE[role]||'/profile'} title="Account settings"><div className="mini-avatar">{avatar?<img src={avatar} alt="Profile"/>:(user?.fullName?.[0]||'M')}</div></Link></div></header><CommandPalette open={paletteOpen} onClose={()=>setPaletteOpen(false)} admin={admin} user={user} onLogout={()=>{logout();navigate('/')}}/><div className="dash-content">{!admin&&!staffCan(user,loc.pathname)
  ?<div className="data-card empty-state staff-no-access"><Icon name="shield" size={28}/><h3>You don't have access to this page</h3><p>Your role ({STAFF_ROLE_LABEL[user?.staffRole]||'Staff'}) doesn't include it. Ask the store owner if you need access.</p><Link className="outline-btn" to="/vendor">Back to dashboard</Link></div>
  :children}</div></section></div>}
