import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";
import Icon from "./Icon";
import { navGroupsForRole } from "../data/navItems";
import { notificationsApi } from "../API/notifications";
import { searchApi } from "../API/search";
import RestrictedOverview from "./dashboard/RestrictedOverview";

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

function SidebarLink({href,label,icon,active,onNavigate}){
  return <Link to={href} onClick={onNavigate} className={'sb-link'+(active?' active':'')} aria-current={active?'page':undefined} title={label}>
    <Icon name={icon} size={17}/><span>{label}</span>
  </Link>;
}

function GroupedNav({groups,pathname,onNavigate}){
  const activeHref=findActiveHref(groups,pathname);
  const activeGroupLabel=groups.find(g=>g.items.some(([href])=>href===activeHref))?.label;
  const [openGroup,setOpenGroup]=useState(activeGroupLabel||groups.find(g=>g.items.length>1)?.label);
  return <nav className="sb-nav" aria-label="Dashboard navigation">{groups.map(group=>{
    // A group holding a single link (e.g. Dashboard) reads better as a plain link.
    if(group.items.length===1){
      const [href,label,icon]=group.items[0];
      return <SidebarLink key={group.label} href={href} label={label} icon={icon} active={href===activeHref} onNavigate={onNavigate}/>;
    }
    const isOpen=openGroup===group.label;
    const hasActive=group.label===activeGroupLabel;
    return <div className={'sb-group'+(isOpen?' open':'')+(hasActive?' has-active':'')} key={group.label}>
      <button type="button" className="sb-group-head" aria-expanded={isOpen} onClick={()=>setOpenGroup(isOpen?null:group.label)}>
        <span>{group.label}</span>
        {hasActive&&!isOpen&&<i className="sb-dot" aria-hidden="true"/>}
        <Icon name="arrow" size={12}/>
      </button>
      {isOpen&&<div className="sb-group-body">{group.items.map(([href,label,icon])=>
        <SidebarLink key={href} href={href} label={label} icon={icon} active={href===activeHref} onNavigate={onNavigate}/>
      )}</div>}
    </div>;
  })}</nav>;
}

function Sidebar({admin,role,user,avatar,pathname,onNavigate,onLogout}){
  const platform=admin?'Admin':role==='supplier'?'Supplier':role==='affiliate'?'Affiliate':role==='delivery'?'Delivery':'Seller';
  const accountLabel=admin?'Super Administrator':role==='supplier'?'Supplier account':role==='affiliate'?'Affiliate account':role==='delivery'?'Delivery partner':'Vendor account';
  return <aside className="dashboard-sidebar sb">
    <div className="sb-brand">
      <Link to="/" className="sb-logo">MVEC</Link>
      <span className="sb-platform">{platform}</span>
    </div>
    <Link to={role==='affiliate'?'/affiliate/profile':'/profile'} className="sb-user" onClick={onNavigate}>
      <div className="dash-avatar sb-avatar">{avatar?<img src={avatar} alt="Profile"/>:(user?.fullName?.[0]||'M')}</div>
      <div className="sb-user-text"><b>{user?.fullName||'MVEC User'}</b><small>{accountLabel}</small></div>
    </Link>
    <GroupedNav groups={navGroupsForRole(role,admin)} pathname={pathname} onNavigate={onNavigate}/>
    <div className="sb-footer">
      <Link to="/" className="sb-link"><Icon name="home" size={17}/><span>View marketplace</span></Link>
      <button type="button" className="sb-link sb-logout" onClick={onLogout}><Icon name="logout" size={17}/><span>Sign out</span></button>
    </div>
  </aside>;
}

export default function DashboardLayout({ admin = false, children }) {
  const { user, logout } = useAuth(),
    loc = useLocation(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const avatar = localStorage.getItem("mvec_profile_image") || "";
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () =>
      notificationsApi
        .getAll({ limit: 1 })
        .then((d) => {
          if (alive) setUnread(d.unreadCount || 0);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const [searchResults, setSearchResults] = useState([]);
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      searchApi
        .getSuggestions(term)
        .then((res) => {
          if (!alive) return;
          const s = res.suggestions || {};
          const products = (s.products || [])
            .slice(0, 4)
            .map((p) => ({
              id: p.id,
              name: p.name,
              sub: p.category?.name || "",
              kind: "product",
            }));
          const vendorsList = (s.vendors || [])
            .slice(0, 2)
            .map((v) => ({
              id: v.slug || v.id,
              name: v.businessName,
              sub: "Vendor",
              kind: "vendor",
            }));
          setSearchResults([...products, ...vendorsList]);
        })
        .catch(() => alive && setSearchResults([]));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search]);

  const role = user?.role;
  const goGlobalSearch = () => {
    if (search.trim()) navigate(`/shop?q=${encodeURIComponent(search.trim())}`);
  };
  return (
    <div className={"dashboard-shell " + (open ? "sidebar-open" : "")}>
      <Sidebar
        admin={admin}
        role={role}
        user={user}
        avatar={avatar}
        pathname={loc.pathname}
        onNavigate={() => setOpen(false)}
        onLogout={() => {
          logout();
          navigate("/");
        }}
      />
      <section className="dashboard-main">
        <header className="dash-header">
          <button
            className="mobile-menu"
            type="button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name="menu" />
          </button>
          <div className="dash-search-wrap">
            <div className="dash-search">
              <Icon name="search" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && goGlobalSearch()}
                placeholder="Search…"
              />
            </div>
            {search.trim().length >= 2 && (
              <div className="dash-global-results">
                {searchResults.map((r, i) => (
                  <Link
                    key={`${r.kind}-${r.id}-${i}`}
                    to={
                      r.kind === "product"
                        ? `/product/${r.id}`
                        : `/vendors/${r.id}`
                    }
                    onClick={() => setSearch("")}
                  >
                    <span>{r.name}</span>
                    <small>{r.sub}</small>
                  </Link>
                ))}
                {!searchResults.length && (
                  <div className="search-no-results">No matching results</div>
                )}
                <button
                  type="button"
                  className="search-view-all"
                  onClick={goGlobalSearch}
                >
                  View all results
                </button>
              </div>
            )}
          </div>
          <div className="dash-header-actions">
            <ThemeToggle />
            <Link
              className="dashboard-bell"
              to={
                role === "supplier"
                  ? "/supplier/notifications"
                  : role === "vendor"
                    ? "/vendor/notifications"
                    : role === "affiliate"
                      ? "/affiliate/notifications"
                      : admin
                        ? "/admin/notifications"
                        : "/"
              }
            >
              <Icon name="bell" />
              {unread > 0 && (
                <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>
              )}
            </Link>
            <Link
              to={role === "affiliate" ? "/affiliate/profile" : "/profile"}
              title="My profile"
            >
              <div className="mini-avatar">
                {avatar ? (
                  <img src={avatar} alt="Profile" />
                ) : (
                  user?.fullName?.[0] || "M"
                )}
              </div>
            </Link>
          </div>
        </header>
        <div className="dash-content">{children}</div>
      </section>
    </div>
  );
}
