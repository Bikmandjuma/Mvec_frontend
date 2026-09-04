import { Link } from 'react-router-dom';import {useState} from 'react';import {useTheme} from '../context/ThemeContext';import {useLanguage} from '../context/LanguageContext';

export default function AuthLayout({ title, subtitle, children }) {
  const {theme,toggleTheme}=useTheme(); const {language,setLanguage}=useLanguage(); const [langOpen,setLangOpen]=useState(false); const names={en:'English',rw:'Kinyarwanda',fr:'Français'};
  return (
    <main className="alibaba-auth-page">
      <header className="alibaba-header">
        <Link to="/" className="mvec-logo">MVEC</Link>
        <button className="site-theme-toggle auth-theme-toggle" onClick={toggleTheme} type="button">{theme==='dark'?'☀️':'🌙'}</button><div className="auth-language"><button className="language-btn" type="button" onClick={()=>setLangOpen(v=>!v)} aria-expanded={langOpen}>{names[language]||'English'} <span>⌄</span></button>{langOpen&&<div className="auth-language-menu">{Object.entries(names).map(([code,name])=><button key={code} type="button" className={language===code?'active':''} onClick={()=>{setLanguage(code);setLangOpen(false)}}>{name}</button>)}</div>}</div>
      </header>

      <section className="alibaba-auth-content">
        <div className="promo-panel">
          <div className="promo-label">MVEC MARKETPLACE</div>
          <h1>Smart shopping<br />starts here.</h1>
          <p>Discover products from trusted vendors, all in one place.</p>

          <div className="promo-art">
            <div className="sky-orb orb-one" />
            <div className="sky-orb orb-two" />
            <div className="shopping-box">
              <div className="box-handle" />
              <div className="box-face">
                <strong>MVEC</strong>
                <span>SHOP • SELL • GROW</span>
              </div>
            </div>
            <div className="promo-badge badge-one">✦</div>
            <div className="promo-badge badge-two">✓</div>
            <div className="promo-pill">BUYER + VENDOR</div>
          </div>
        </div>

        <div className="alibaba-form-side">
          <div className="alibaba-form-card">
            <div className="form-heading">
              <h2>{title}</h2>
              <p>{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
