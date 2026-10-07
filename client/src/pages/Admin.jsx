import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/display.js';
import { StatusBadge, TypeBadge } from '../components/Badge.jsx';
import {
  BoxIcon,
  SearchIcon,
  HandHeartIcon,
  ShieldCheckIcon,
  UsersIcon,
  LockIcon,
  ClipboardCheckIcon,
} from '../components/Icons.jsx';

const STAT_DEFS = [
  ['items', 'Items reported', BoxIcon],
  ['open', 'Open items', SearchIcon],
  ['reunited', 'Reunited', HandHeartIcon],
  ['activeClaims', 'Active claims', ShieldCheckIcon],
  ['users', 'Users', UsersIcon],
  ['resetPending', 'Reset requests', LockIcon],
];

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [claims, setClaims] = useState([]);
  const [resets, setResets] = useState([]);
  const [items, setItems] = useState([]);
  const [desk, setDesk] = useState([]);
  const [audit, setAudit] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const loadAll = useCallback(() => {
    setError('');
    // Fetch each section independently so the stat numbers appear instantly
    // instead of waiting for the slowest section to finish.
    api('/admin/stats').then(setStats).catch((e) => setError(e.message));
    api('/admin/claims').then((r) => setClaims(r.claims)).catch(() => {});
    api('/admin/reset-requests?status=pending').then((r) => setResets(r.requests)).catch(() => {});
    api('/admin/items').then((r) => setItems(r.items)).catch(() => {});
    api('/admin/desk-items').then((r) => setDesk(r.items)).catch(() => {});
    api('/admin/audit').then((r) => setAudit(r.entries)).catch(() => {});
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const run = async (key, fn) => {
    setBusy(key);
    setNotice('');
    setError('');
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const reviewClaim = (id, action) =>
    run(`claim-${id}`, async () => {
      await api(`/claims/${id}/${action}`, { method: 'POST' });
      return `Claim ${action === 'approve' ? 'approved' : 'rejected'}.`;
    });

  const reviewReset = (id, action) =>
    run(`reset-${id}`, async () => {
      const res = await api(`/admin/reset-requests/${id}/${action}`, { method: 'POST' });
      if (action === 'approve') {
        return res.emailed
          ? 'Approved — temporary password emailed to the user.'
          : `Approved. Share this temporary password manually: ${res.tempPassword}`;
      }
      return 'Request rejected.';
    });

  const moderate = (id, action) =>
    run(`item-${id}`, async () => {
      await api(`/admin/items/${id}/${action}`, { method: 'POST' });
      return action === 'remove' ? 'Item removed.' : 'Item restored.';
    });

  return (
    <div className="app-shell">
      <h1 style={{ fontSize: 'var(--fs-h1)' }}>Admin dashboard</h1>
      <p className="muted">Moderation, claims, reset requests, desk items, and the audit log.</p>

      {notice && <div className="form-alert form-alert--ok" role="status">{notice}</div>}
      {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}

      {/* Stats */}
      <div className="stat-cards">
        {STAT_DEFS.map(([key, label, Icon]) => (
          <div className="card stat-card" key={key}>
            <span className="iconbox"><Icon /></span>
            <div>
              <div className="stat__num">{stats ? stats[key] : '—'}</div>
              <div className="stat__label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending claims */}
      <Section title="Pending claims" count={claims.length}>
        {claims.length === 0 ? (
          <Empty>No pending claims.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Item</th><th>Claimant</th><th>Answer</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id}>
                    <td>{c.item ? <Link to={`/items/${c.item.id}`}>{c.item.title}</Link> : '—'}</td>
                    <td>{c.claimant?.name || '—'}</td>
                    <td>
                      {c.answer || <span className="muted">—</span>}{' '}
                      {c.autoMatch === true && <span className="hint hint--ok">matches</span>}
                      {c.autoMatch === false && <span className="hint hint--no">no match</span>}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn" disabled={busy === `claim-${c.id}`} onClick={() => reviewClaim(c.id, 'approve')}>Approve</button>
                        <button className="btn btn--ghost" disabled={busy === `claim-${c.id}`} onClick={() => reviewClaim(c.id, 'reject')}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Reset requests */}
      <Section title="Password reset requests" count={resets.length}>
        {resets.length === 0 ? (
          <Empty>No pending requests.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>User</th><th>Email</th><th>Requested</th><th>Actions</th></tr></thead>
              <tbody>
                {resets.map((r) => (
                  <tr key={r.id}>
                    <td>{r.user?.name || '—'}</td>
                    <td>{r.email}</td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn" disabled={busy === `reset-${r.id}`} onClick={() => reviewReset(r.id, 'approve')}>Approve</button>
                        <button className="btn btn--ghost" disabled={busy === `reset-${r.id}`} onClick={() => reviewReset(r.id, 'reject')}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Desk-held items */}
      <Section title="Desk-held items" count={desk.length}>
        {desk.length === 0 ? (
          <Empty>No items currently held at the desk.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Item</th><th>Location</th><th>Status</th></tr></thead>
              <tbody>
                {desk.map((i) => (
                  <tr key={i.id}>
                    <td><Link to={`/items/${i.id}`}>{i.title}</Link></td>
                    <td>{i.location}</td>
                    <td><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Moderation */}
      <Section title="Recent items (moderation)" count={items.length}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Item</th><th>Type</th><th>Status</th><th>Reporter</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td><Link to={`/items/${i.id}`}>{i.title}</Link></td>
                  <td><TypeBadge type={i.type} /></td>
                  <td><StatusBadge status={i.status} /></td>
                  <td>{i.reporter?.name || '—'}</td>
                  <td>
                    {i.status === 'removed' ? (
                      <button className="btn btn--ghost" disabled={busy === `item-${i.id}`} onClick={() => moderate(i.id, 'restore')}>Restore</button>
                    ) : (
                      <button className="btn btn--ghost" disabled={busy === `item-${i.id}`} onClick={() => moderate(i.id, 'remove')}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Audit log */}
      <Section title="Audit log">
        {audit.length === 0 ? (
          <Empty>No activity yet.</Empty>
        ) : (
          <ul className="audit-list">
            {audit.map((e) => (
              <li key={e.id}>
                <ClipboardCheckIcon size={16} />
                <span>
                  <strong>{e.actorName || 'Someone'}</strong>{' '}
                  <span className="muted">{e.action.replace(/_/g, ' ')}</span> — {e.target}
                </span>
                <span className="muted" style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)' }}>
                  {formatDate(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <section className="glass" style={{ padding: 'var(--sp-5)', marginTop: 'var(--sp-6)' }}>
      <h2 style={{ fontSize: 'var(--fs-h3)' }}>
        {title} {count > 0 && <span className="muted">({count})</span>}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <p className="muted" style={{ margin: 0 }}>{children}</p>;
}
