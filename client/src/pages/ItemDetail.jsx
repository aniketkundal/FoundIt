import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge, TypeBadge, CategoryChip } from '../components/Badge.jsx';
import {
  formatDate,
  typeLabel,
  locationLabel,
  categoryLabel,
  phoneLinks,
  formatPhone,
  whatsappMessage,
} from '../lib/display.js';
import {
  PhoneIcon,
  WhatsAppIcon,
  BoxIcon,
  MapPinIcon,
  CalendarIcon,
  LockIcon,
} from '../components/Icons.jsx';
import MatchSuggestions from '../components/MatchSuggestions.jsx';
import ClaimModal from '../components/ClaimModal.jsx';
import ClaimsPanel from '../components/ClaimsPanel.jsx';

const CLAIMABLE = ['open', 'potential_match', 'claim_pending'];

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Errors from actions (delete, collect, cancel) show inline and keep the page.
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showClaim, setShowClaim] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api(`/items/${id}`);
      setDetail(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setError('');
    setActionError('');
    load();
  }, [load]);

  const item = detail?.item;
  const isOwner = detail?.isOwner;
  const myClaim = detail?.myClaim;
  const hasApprovedClaim = detail?.hasApprovedClaim;
  const canManage = isOwner || isAdmin;
  const claimable = item && CLAIMABLE.includes(item.status);
  const reporterContact =
    item && phoneLinks(item.reporter?.phone, whatsappMessage(item, item.reporter?.name));

  const handleDelete = async () => {
    if (!window.confirm('Delete this report? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api(`/items/${id}`, { method: 'DELETE' });
      navigate('/home');
    } catch (err) {
      setActionError(err.message);
      setDeleting(false);
    }
  };

  const handleCollected = async () => {
    if (!window.confirm('Mark this item as collected/handed over? This closes the report.')) return;
    setBusy(true);
    try {
      await api(`/items/${id}/collected`, { method: 'POST' });
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancelClaim = async () => {
    setBusy(true);
    try {
      await api(`/claims/${myClaim.id}/cancel`, { method: 'POST' });
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell">
        <p className="muted center">Loading…</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="app-shell">
        <div className="empty glass">
          <h2 style={{ fontSize: 'var(--fs-h3)' }}>{error || 'Item not found'}</h2>
          <Link className="btn" to="/home">
            Back to browse
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Link to="/home" className="nav__link" style={{ display: 'inline-block', marginBottom: 'var(--sp-4)' }}>
        ← Back to browse
      </Link>

      {actionError && (
        <div className="form-alert form-alert--error" role="alert">
          {actionError}
        </div>
      )}

      <article className="detail">
        <div className="detail__media glass">
          {item.photoUrl ? (
            <img src={item.photoUrl} alt={item.title} />
          ) : (
            <div className="detail__placeholder" aria-hidden="true">
              <BoxIcon size={64} />
            </div>
          )}
        </div>

        <div className="detail__body">
          <div className="item-card__row" style={{ marginBottom: 'var(--sp-3)' }}>
            <TypeBadge type={item.type} />
            <StatusBadge status={item.status} />
          </div>

          <h1 style={{ fontSize: 'var(--fs-h2)', marginBottom: 'var(--sp-3)' }}>{item.title}</h1>

          <div className="detail__meta">
            <CategoryChip category={categoryLabel(item)} />
            <span className="meta-item">
              <MapPinIcon size={15} /> {locationLabel(item)}
            </span>
            <span className="meta-item">
              <CalendarIcon size={15} /> {typeLabel(item.type)} on{' '}
              {formatDate(item.dateLostOrFound)}
            </span>
          </div>

          <p style={{ marginTop: 'var(--sp-6)', whiteSpace: 'pre-wrap' }}>{item.description}</p>

          {item.type === 'found' && item.heldBy && (
            <p className="muted">
              <strong>Currently held by:</strong>{' '}
              {item.heldBy === 'desk' ? 'Lost-property desk' : 'The finder'}
              {item.heldNote ? ` — ${item.heldNote}` : ''}
            </p>
          )}

          <div className="contact-card glass">
            <div>
              <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                {item.type === 'lost' ? 'Lost by' : 'Found by'}
              </span>
              <div style={{ fontWeight: 600 }}>
                {item.reporter?.name || 'A community member'}
              </div>
              {item.reporter?.phone && (
                <a className="muted" href={`tel:+91${item.reporter.phone}`} style={{ fontSize: 'var(--fs-sm)' }}>
                  {formatPhone(item.reporter.phone)}
                </a>
              )}
            </div>
            {reporterContact ? (
              <div className="contact-actions">
                <a className="btn btn--call" href={reporterContact.tel} aria-label="Call">
                  <PhoneIcon /> Call
                </a>
                <a
                  className="btn btn--whatsapp"
                  href={reporterContact.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Message on WhatsApp"
                >
                  <WhatsAppIcon /> WhatsApp
                </a>
              </div>
            ) : (
              <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                No contact number provided
              </span>
            )}
          </div>

          {item.hasVerification && (
            <div className="info-note" style={{ marginTop: 'var(--sp-4)' }}>
              <LockIcon size={16} />
              <span>
                This item is protected by a verification question. To claim it you'll need to
                answer: <strong>"{item.verifyingQuestion}"</strong>
              </span>
            </div>
          )}

          {isOwner && (
            <div className="info-note" style={{ marginTop: 'var(--sp-4)' }}>
              <LockIcon size={16} />
              <span>This is your report — you can't claim your own item. Any claims appear below for you to review.</span>
            </div>
          )}

          {!isOwner && myClaim && (
            <div
              className={`form-alert ${
                myClaim.status === 'approved'
                  ? 'form-alert--ok'
                  : myClaim.status === 'rejected'
                  ? 'form-alert--error'
                  : ''
              }`}
              style={{ marginTop: 'var(--sp-4)' }}
              role="status"
            >
              {myClaim.status === 'pending' && 'Your claim is pending review by the reporter.'}
              {myClaim.status === 'approved' &&
                '✓ Your claim was approved! Use the contact details above to arrange collection.'}
              {myClaim.status === 'rejected' && 'Your claim was not approved.'}
              {myClaim.status === 'cancelled' && 'You cancelled this claim.'}
            </div>
          )}

          <div className="detail__actions">
            {!isOwner &&
              claimable &&
              (!myClaim || ['rejected', 'cancelled'].includes(myClaim.status)) && (
                <button className="btn" onClick={() => setShowClaim(true)}>
                  Claim this item
                </button>
              )}
            {!isOwner && myClaim?.status === 'pending' && (
              <button className="btn btn--ghost" onClick={handleCancelClaim} disabled={busy}>
                Cancel my claim
              </button>
            )}
            {canManage &&
              (item.status === 'claim_approved' || hasApprovedClaim) &&
              item.status !== 'collected' && (
                <button className="btn" onClick={handleCollected} disabled={busy}>
                  {busy ? 'Working…' : 'Mark as collected'}
                </button>
              )}
            {canManage && (
              <button className="btn btn--ghost" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete report'}
              </button>
            )}
          </div>
        </div>
      </article>

      {canManage && <ClaimsPanel itemId={id} onChange={load} />}

      <MatchSuggestions itemId={id} />

      {showClaim && (
        <ClaimModal
          item={item}
          onClose={() => setShowClaim(false)}
          onSubmitted={() => {
            setShowClaim(false);
            load();
          }}
        />
      )}
    </div>
  );
}
