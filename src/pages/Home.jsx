import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <main className="home-page">
      <nav className="navbar">
        <Link to="/" className="brand brand-dark">MVEC</Link>
        <div className="nav-links">
          <Link to="/login">Log in</Link>
          <Link to="/signup" className="nav-cta">Create account</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">MULTI-VENDOR E-COMMERCE</span>
          <h1>One marketplace.<br /><span>Thousands of possibilities.</span></h1>
          <p>
            MVEC brings buyers and independent vendors together in one modern,
            easy-to-use shopping experience.
          </p>
          <div className="hero-actions">
            <Link to="/signup" className="primary-btn">Get started</Link>
            <Link to="/login" className="secondary-btn">I already have an account</Link>
          </div>
        </div>

        <div className="hero-art">
          <div className="floating-card card-top">
            <span>✦</span>
            <div><strong>Trusted vendors</strong><small>All in one place</small></div>
          </div>
          <div className="market-card">
            <div className="market-icon">MV</div>
            <div className="market-lines"><i /><i /><i /></div>
            <div className="market-product"><span>NEW</span><b>SHOP</b></div>
          </div>
          <div className="floating-card card-bottom">
            <span>✓</span>
            <div><strong>Simple shopping</strong><small>Built for everyone</small></div>
          </div>
        </div>
      </section>
    </main>
  );
}
