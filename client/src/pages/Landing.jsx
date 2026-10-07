import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  SparklesIcon,
  ShieldCheckIcon,
  CheckIcon,
  FileTextIcon,
  CpuIcon,
  HandHeartIcon,
  ClipboardCheckIcon,
  UsersIcon,
  LockIcon,
  BellIcon,
  MapPinIcon,
} from '../components/Icons.jsx';

const STEPS = [
  ['Report', FileTextIcon, 'Post a lost or found item with a few details and an optional photo.'],
  ['Match', CpuIcon, 'Our AI compares it against open reports and surfaces likely matches.'],
  ['Verify', ShieldCheckIcon, 'Answer a private question to prove ownership; the finder reviews.'],
  ['Reunite', HandHeartIcon, 'Arrange a safe, mediated handover and mark the item collected.'],
];

// Factual highlights only (no usage numbers we can't back up).
const STATS = [
  [ClipboardCheckIcon, '3 steps', 'Report an item in a minute'],
  [CpuIcon, 'AI', 'Every match has a score and a reason'],
  [LockIcon, 'SMVDU', 'Only the campus community can sign in'],
  [ShieldCheckIcon, '₹0', 'Free for every student'],
];

const FEATURES = [
  [CpuIcon, 'AI-powered matching', 'Smart ranking surfaces the most likely lost↔found pairs with a confidence score and reason.'],
  [LockIcon, 'Privacy first', 'Verification answers stay private and personal contact is shared only when you choose.'],
  [ShieldCheckIcon, 'Verified claims', 'Claimants prove ownership before any handover, so items reach the right person.'],
  [UsersIcon, 'Admin oversight', 'The lost-property desk moderates posts, approves claims, and oversees valuables.'],
  [BellIcon, 'Real-time alerts', 'Instant in-app and email notifications the moment a strong match appears.'],
  [MapPinIcon, 'Made for SMVDU', 'Campus-aware locations and access restricted to the SMVDU community.'],
];

function HeroMedia() {
  const [ok, setOk] = useState(true);
  return (
    <div className="hero__media">
      {ok ? (
        <img
          className="hero__img"
          src="/campus.jpg"
          alt="SMVDU campus"
          onError={() => setOk(false)}
        />
      ) : (
        <div className="hero__img-fallback">
          <img src="/smvdu-logo.png" alt="SMVDU" />
        </div>
      )}
      <div className="hero__badge">
        <span className="iconbox iconbox--green">
          <ShieldCheckIcon />
        </span>
        <div>
          <strong style={{ display: 'block', fontSize: 'var(--fs-sm)' }}>
            Official Lost &amp; Found Desk
          </strong>
          <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
            Verified &amp; secure handovers
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const reportPrimary = user ? '/report' : '/signup';

  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero">
          <div>
            <h1>
              Lost something on campus?{' '}
              <span className="accent">FoundIt</span> reunites it.
            </h1>
            <p className="hero__lead">
              The official lost &amp; found platform for the SMVDU community. Report a lost
              or found item in seconds and let our AI matching engine reconnect you — with a
              safe, mediated handover.
            </p>
            <div className="hero__cta">
              <Link className="btn" to={reportPrimary}>
                Report lost item
              </Link>
              <Link className="btn btn--ghost" to={reportPrimary}>
                Report found item
              </Link>
            </div>
            <div className="hero__chips">
              <span className="hero__chip"><SparklesIcon size={16} /> AI-powered matching</span>
              <span className="hero__chip"><ShieldCheckIcon size={16} /> Safe &amp; verified handover</span>
              <span className="hero__chip"><CheckIcon size={16} /> Free for all SMVDU students</span>
            </div>
          </div>
          <HeroMedia />
        </section>
      </div>

      {/* How it works */}
      <section className="section section--soft" id="how">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">How it works</span>
            <h2>Reunited in four simple steps</h2>
            <p>From a lost phone to a found wallet — FoundIt makes returns fast and safe.</p>
          </div>
          <div className="steps">
            {STEPS.map(([title, Icon, body], i) => (
              <div className="step" key={title}>
                <div className="step__num">{i + 1}</div>
                <span className="iconbox" style={{ margin: '0 auto var(--sp-3)' }}>
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="section">
        <div className="container">
          <div className="stats">
            {STATS.map(([Icon, num, label]) => (
              <div className="stat" key={label}>
                <span className="iconbox"><Icon /></span>
                <div>
                  <div className="stat__num">{num}</div>
                  <div className="stat__label">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section section--soft">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Why FoundIt</span>
            <h2>Everything a campus lost &amp; found needs</h2>
            <p>Built to a standard SMVDU could adopt and run — not just a demo.</p>
          </div>
          <div className="features">
            {FEATURES.map(([Icon, title, body]) => (
              <article className="feature card" key={title}>
                <span className="iconbox"><Icon /></span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container center">
          <h2 style={{ fontSize: 'var(--fs-h1)' }}>Lost or found something today?</h2>
          <p className="muted" style={{ maxWidth: '34rem', margin: '0 auto var(--sp-6)' }}>
            Join the SMVDU community on FoundIt and help reunite lost items with their owners.
          </p>
          <Link className="btn" to={user ? '/home' : '/signup'}>
            {user ? 'Go to dashboard' : 'Get started — it’s free'}
          </Link>
        </div>
      </section>
    </>
  );
}
