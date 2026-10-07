import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useConfig } from '../context/ConfigContext.jsx';
import ItemCard from '../components/ItemCard.jsx';
import LocationSelect from '../components/LocationSelect.jsx';
import { SearchIcon } from '../components/Icons.jsx';

const EMPTY = { type: '', category: '', location: '', q: '' };

export default function Browse() {
  const config = useConfig();
  const [filters, setFilters] = useState(EMPTY);
  const [search, setSearch] = useState(''); // text box (applied on submit)
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    params.set('page', String(page));
    try {
      const res = await api(`/items?${params.toString()}`);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key) => (e) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  };

  const submitSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setFilters((f) => ({ ...f, q: search.trim() }));
  };

  const clearAll = () => {
    setSearch('');
    setFilters(EMPTY);
    setPage(1);
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="app-shell">
      <div className="browse-head">
        <div>
          <h1 style={{ fontSize: 'var(--fs-h2)', marginBottom: 'var(--sp-1)' }}>Browse items</h1>
          <p className="muted" style={{ margin: 0 }}>
            Lost and found reports from the SMVDU community.
          </p>
        </div>
        <Link className="btn" to="/report">
          + Report an item
        </Link>
      </div>

      <div className="filters glass">
        <form onSubmit={submitSearch} className="filters__search">
          <input
            className="field__input"
            type="search"
            placeholder="Search title or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search items"
          />
          <button className="btn" type="submit">
            Search
          </button>
        </form>

        <div className="filters__selects">
          <select className="field__input" value={filters.type} onChange={setFilter('type')} aria-label="Type">
            <option value="">All types</option>
            <option value="lost">Lost</option>
            <option value="found">Found</option>
          </select>
          <select
            className="field__input"
            value={filters.category}
            onChange={setFilter('category')}
            aria-label="Category"
          >
            <option value="">All categories</option>
            {config?.categories?.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <LocationSelect
            value={filters.location}
            onChange={(v) => {
              setPage(1);
              setFilters((f) => ({ ...f, location: v }));
            }}
            includeAll
            aria-label="Location"
          />
          {hasFilters && (
            <button type="button" className="btn btn--ghost" onClick={clearAll}>
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="form-alert form-alert--error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="muted center" style={{ marginTop: 'var(--sp-8)' }}>
          Loading items…
        </p>
      ) : !data ? null : data.items.length === 0 ? (
        <div className="empty glass">
          <span className="iconbox">
            <SearchIcon />
          </span>
          <h2 style={{ fontSize: 'var(--fs-h3)' }}>No items found</h2>
          <p className="muted">
            {hasFilters
              ? 'Try adjusting or clearing your filters.'
              : 'Be the first to report a lost or found item.'}
          </p>
          <Link className="btn" to="/report">
            Report an item
          </Link>
        </div>
      ) : (
        <>
          <div className="item-grid">
            {data.items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>

          {data.pages > 1 && (
            <div className="pager">
              <button
                className="btn btn--ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Previous
              </button>
              <span className="muted">
                Page {data.page} of {data.pages}
              </span>
              <button
                className="btn btn--ghost"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
