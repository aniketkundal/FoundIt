import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext.jsx';
import { formatDate } from '../lib/display.js';
import { BellIcon } from '../components/Icons.jsx';

export default function Notifications() {
  const { notifications, refresh, markAllRead } = useNotifications();

  // Refresh on open, and mark everything read shortly after viewing.
  useEffect(() => {
    refresh();
    const t = setTimeout(() => markAllRead().catch(() => {}), 1200);
    return () => clearTimeout(t);
  }, [refresh, markAllRead]);

  return (
    <div className="app-shell" style={{ maxWidth: '46rem' }}>
      <h1 style={{ fontSize: 'var(--fs-h2)' }}>Notifications</h1>

      {notifications.length === 0 ? (
        <div className="empty glass">
          <span className="iconbox">
            <BellIcon />
          </span>
          <p className="muted">No notifications yet. We'll alert you when a match is found.</p>
        </div>
      ) : (
        <ul className="notif-list">
          {notifications.map((n) => {
            const body = (
              <>
                <BellIcon size={18} className="notif__icon" />
                <div>
                  <p style={{ margin: 0 }}>{n.message}</p>
                  <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                    {formatDate(n.createdAt)}
                  </span>
                </div>
              </>
            );
            return (
              <li key={n.id} className={`notif glass ${n.read ? '' : 'is-unread'}`}>
                {n.link ? (
                  <Link to={n.link} className="notif__link">
                    {body}
                  </Link>
                ) : (
                  <div className="notif__link">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
