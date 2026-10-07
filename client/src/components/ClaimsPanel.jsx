import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import { formatDate, formatPhone } from '../lib/display.js';

const STATUS_LABEL = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

// Reporter/admin view: the claims on this item, with the claimant's answer, an
// "answer matched" hint, contact details, and approve/reject controls.
export default function ClaimsPanel({ itemId, onChange }) {
  const [claims, setClaims] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api(`/items/${itemId}/claims`);
      setClaims(res.claims);
    } catch (err) {
      setError(err.message);
    }
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id, action) => {
    setBusyId(id);
    setError('');
    try {
      await api(`/claims/${id}/${action}`, { method: 'POST' });
      await load();
      onChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (!claims) {
    return error ? (
      <div className="form-alert form-alert--error" role="alert">{error}</div>
    ) : null;
  }

  return (
    <section className="glass" style={{ padding: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
      <h2 style={{ fontSize: 'var(--fs-h3)' }}>
        Claims {claims.length > 0 && <span className="muted">({claims.length})</span>}
      </h2>

      {error && (
        <div className="form-alert form-alert--error" role="alert">
          {error}
        </div>
      )}

      {claims.length === 0 ? (
        <p className="muted" style={{ marginBottom: 0 }}>No claims yet.</p>
      ) : (
        <ul className="claim-list">
          {claims.map((c) => (
            <li key={c.id} className="claim">
              <div className="claim__head">
                <div>
                  <strong>{c.claimant.name}</strong>{' '}
                  {c.claimant.phone && (
                    <a className="muted" href={`tel:+91${c.claimant.phone}`} style={{ fontSize: 'var(--fs-sm)' }}>
                      · {formatPhone(c.claimant.phone)}
                    </a>
                  )}
                </div>
                <span className={`badge badge--${c.status === 'approved' ? 'open' : c.status === 'rejected' || c.status === 'cancelled' ? 'closed' : 'pending'}`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </div>

              {c.answer && (
                <p style={{ margin: 'var(--sp-2) 0 0' }}>
                  <span className="muted">Answer:</span> "{c.answer}"{' '}
                  {c.autoMatch === true && <span className="hint hint--ok">✓ matches</span>}
                  {c.autoMatch === false && <span className="hint hint--no">✗ doesn't match</span>}
                </p>
              )}
              {c.message && (
                <p className="muted" style={{ margin: 'var(--sp-1) 0 0', fontSize: 'var(--fs-sm)' }}>
                  "{c.message}"
                </p>
              )}
              <p className="muted" style={{ margin: 'var(--sp-1) 0 0', fontSize: 'var(--fs-sm)' }}>
                {formatDate(c.createdAt)}
              </p>

              {c.status === 'pending' && (
                <div className="row-actions" style={{ marginTop: 'var(--sp-3)' }}>
                  <button className="btn" disabled={busyId === c.id} onClick={() => act(c.id, 'approve')}>
                    Approve
                  </button>
                  <button className="btn btn--ghost" disabled={busyId === c.id} onClick={() => act(c.id, 'reject')}>
                    Reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
