import {useState,useEffect} from 'react';import {Link,useLocation,useNavigate} from 'react-router-dom';import {useAuth} from '../context/AuthContext';import {useTheme} from '../context/ThemeContext';import Icon from './Icon';
import {navGroupsForRole} from '../data/navItems';
import {notificationsApi} from '../API/notifications';
import {searchApi} from '../API/search';
import RestrictedOverview from './dashboard/RestrictedOverview';

function GroupedNav({groups,pathname,onNavigate}){
  const activeGroupLabel=groups.find(g=>g.items.some(([href])=>href===pathname))?.label;
  const [openGroup,setOpenGroup]=useState(activeGroupLabel||groups[0]?.label);
  return <nav className="admin-grouped-nav">{groups.map(group=>{
    const isOpen=openGroup===group.label;
    const hasActive=group.items.some(([href])=>href===pathname);
    return <div className={'nav-group'+(isOpen?' open':'')+(hasActive?' has-active':'')} key={group.label}>
      <button type="button" className="nav-group-head" onClick={()=>setOpenGroup(isOpen?null:group.label)}>
        <span>{group.label}</span>
        <Icon name="arrow" size={14}/>
      </button>
      {isOpen&&<div className="nav-group-body">{group.items.map(([href,label,icon])=>
        <Link onClick={onNavigate} className={pathname===href?'active':''} key={href} to={href}><Icon name={icon}/><span>{label}</span></Link>
      )}</div>}
    </div>;
  })}</nav>;
}

export default function DashboardLayout({admin=false,children}){const {user,logout}=useAuth(),loc=useLocation(),navigate=useNavigate(),{theme,toggleTheme}=useTheme();const [open,setOpen]=useState(false);const [search,setSearch]=useState('');const avatar=localStorage.getItem('mvec_profile_image')||'';
const [unread,setUnread]=useState(0);
useEffect(()=>{let alive=true;const load=()=>notificationsApi.getAll({limit:1}).then(d=>{if(alive)setUnread(d.unreadCount||0)}).catch(()=>{});load();const t=setInterval(load,30000);return()=>{alive=false;clearInterval(t)}},[]);

const [searchResults,setSearchResults]=useState([]);
useEffect(()=>{
  const term=search.trim();
  if(term.length<2){ setSearchResults([]); return; }
  let alive=true;
  const t=setTimeout(()=>{
    searchApi.getSuggestions(term).then(res=>{
      if(!alive) return;
      const s=res.suggestions||{};
      const products=(s.products||[]).slice(0,4).map(p=>({id:p.id,name:p.name,sub:p.category?.name||'',kind:'product'}));
      const vendorsList=(s.vendors||[]).slice(0,2).map(v=>({id:v.slug||v.id,name:v.businessName,sub:'Vendor',kind:'vendor'}));
      setSearchResults([...products,...vendorsList]);
    }).catch(()=>alive&&setSearchResults([]));
  },250);
  return ()=>{alive=false;clearTimeout(t)};
},[search]);

const role=user?.role;const navGroups=navGroupsForRole(role,admin);const goGlobalSearch=()=>{if(search.trim())navigate(`/shop?q=${encodeURIComponent(search.trim())}`)};return <div className={'dashboard-shell '+(open?'sidebar-open':'')}><aside className="dashboard-sidebar"><div className="dash-logo"><Link to="/">MVEC</Link><span>{admin?'ADMIN CONTROL':role==='supplier'?'SUPPLIER PLATFORM':role==='affiliate'?'AFFILIATE PLATFORM':role==='delivery'?'DELIVERY PLATFORM':'SELLER PLATFORM'}</span></div><div className="dash-user" style={role==='affiliate'?{cursor:'pointer'}:undefined} onClick={()=>role==='affiliate'&&navigate('/affiliate/profile')}><div className="dash-avatar">{avatar?<img src={avatar} alt="Profile"/>:(user?.fullName?.[0]||'M')}</div><div><b>{user?.fullName||'MVEC User'}</b><small>{admin?'Super Administrator':role==='supplier'?'Supplier account':role==='affiliate'?'Affiliate account':role==='delivery'?'Delivery partner':'Vendor account'}</small></div></div><GroupedNav groups={navGroups} pathname={loc.pathname} onNavigate={()=>setOpen(false)}/><div className="dash-bottom"><Link to="/"><Icon name="home"/> View marketplace</Link><button onClick={()=>{logout();navigate('/')}}><Icon name="logout"/> Sign out</button></div></aside><section className="dashboard-main"><header className="dash-header"><button className="mobile-menu" onClick={()=>setOpen(v=>!v)}><Icon name="menu"/></button><div className="dash-search-wrap"><div className="dash-search"><Icon name="search"/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&goGlobalSearch()} placeholder="Search…"/></div>{search.trim().length>=2&&<div className="dash-global-results">{searchResults.map((r,i)=><Link key={`${r.kind}-${r.id}-${i}`} to={r.kind==='product'?`/product/${r.id}`:`/vendors/${r.id}`} onClick={()=>setSearch('')}><span>{r.name}</span><small>{r.sub}</small></Link>)}{!searchResults.length&&<div className="search-no-results">No matching results</div>}<button type="button" className="search-view-all" onClick={goGlobalSearch}>View all results</button></div>}</div><div className="dash-header-actions"><button className="theme-toggle" onClick={toggleTheme} title="Toggle theme"><Icon name={theme==='dark'?'sun':'moon'} size={18}/></button><Link className="dashboard-bell" to={role==='supplier'?'/supplier/notifications':role==='vendor'?'/vendor/notifications':role==='affiliate'?'/affiliate/notifications':admin?'/admin/notifications':'/'}><Icon name="bell"/>{unread>0&&<span className="bell-badge">{unread>9?'9+':unread}</span>}</Link><Link to={role==='affiliate'?'/affiliate/profile':'/profile'} title="My profile"><div className="mini-avatar">{avatar?<img src={avatar} alt="Profile"/>:(user?.fullName?.[0]||'M')}</div></Link></div></header><div className="dash-content">{children}</div></section></div>}
