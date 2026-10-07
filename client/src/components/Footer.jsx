import { Link } from 'react-router-dom';
import { MailIcon, ShieldCheckIcon } from './Icons.jsx';

export default function Footer() {
  return (
    <footer className="footer" id="contact">
      <div className="container">
        <div className="footer__grid">
          <div>
            <div className="brand" style={{ marginBottom: 'var(--sp-3)' }}>
              <img src="/smvdu-logo.png" alt="SMVDU" className="brand__logo" />
              <span>
                Found<span className="accent">It</span>
              </span>
            </div>
            <p className="muted" style={{ fontSize: 'var(--fs-sm)', maxWidth: '20rem' }}>
              A lost &amp; found platform built for the Shri Mata Vaishno Devi
              University community — report, match with AI, and reunite safely.
            </p>
          </div>

          <div>
            <h4>Platform</h4>
            <ul className="footer__links">
              <li><Link to="/home">Browse items</Link></li>
              <li><Link to="/report">Report an item</Link></li>
              <li><a href="/#how">How it works</a></li>
            </ul>
          </div>

          <div>
            <h4>Account</h4>
            <ul className="footer__links">
              <li><Link to="/login">Log in</Link></li>
              <li><Link to="/signup">Sign up</Link></li>
              <li><Link to="/reset">Reset password</Link></li>
            </ul>
          </div>

          <div>
            <h4>Need help?</h4>
            <p className="muted" style={{ fontSize: 'var(--fs-sm)', margin: '0 0 var(--sp-3)' }}>
              Contact the lost-property desk for high-value items handed in physically.
            </p>
            <a className="hero__chip" href="mailto:foundit@smvdu.ac.in">
              <MailIcon size={16} /> foundit@smvdu.ac.in
            </a>
          </div>
        </div>

        <div className="footer__bottom">
          <span>© 2026 FoundIt · Built for SMVDU by Aniket Kundal</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheckIcon size={15} /> Restricted to the SMVDU community
          </span>
        </div>
      </div>
    </footer>
  );
}
