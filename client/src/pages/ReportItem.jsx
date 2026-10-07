import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useConfig } from '../context/ConfigContext.jsx';
import Field from '../components/Field.jsx';
import PhotoUpload from '../components/PhotoUpload.jsx';
import LocationSelect from '../components/LocationSelect.jsx';
import { LockIcon } from '../components/Icons.jsx';

const STEPS = ['Basics', 'Details', 'Verification'];

// Local date (yyyy-mm-dd). toISOString() alone is UTC, which is still
// "yesterday" between 00:00 and 05:30 IST.
const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export default function ReportItem() {
  const config = useConfig();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    type: 'lost',
    title: '',
    category: '',
    categoryOther: '',
    location: '',
    locationOther: '',
    dateLostOrFound: today(),
    description: '',
    photoUrl: '',
    verifyingQuestion: '',
    verifyingAnswer: '',
    heldBy: 'finder',
    heldNote: '',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  // Block Next/Submit while a photo is still uploading, so it isn't dropped.
  const [photoUploading, setPhotoUploading] = useState(false);
  // Guard against accidental submit: when the final step appears, the Submit
  // button briefly renders where "Next" was tapped — on touch a "ghost tap"
  // can land on it. Disable submit for a moment after arriving on the step.
  const [canSubmit, setCanSubmit] = useState(false);

  useEffect(() => {
    if (step !== STEPS.length - 1) return undefined;
    setCanSubmit(false);
    const t = setTimeout(() => setCanSubmit(true), 600);
    return () => clearTimeout(t);
  }, [step]);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const setEvent = (key) => (e) => set(key)(e.target.value);

  // Light per-step gating so users can't skip required basics.
  const stepValid = () => {
    if (step === 0) {
      return (
        form.title.trim().length >= 3 &&
        form.category &&
        (form.category !== 'Other' || form.categoryOther.trim().length > 0) &&
        form.location &&
        (form.location !== 'Other' || form.locationOther.trim().length > 0) &&
        form.dateLostOrFound
      );
    }
    if (step === 1) {
      return form.description.trim().length >= 10;
    }
    return true;
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Block submits until the user has settled on the final step (anti ghost-tap).
    if (!canSubmit || submitting) return;
    setError('');
    setFieldErrors({});
    setSubmitting(true);

    const payload = { ...form };
    if (payload.type !== 'found') {
      delete payload.heldBy;
      delete payload.heldNote;
    }

    try {
      const { item } = await api('/items', { method: 'POST', body: payload });
      navigate(`/items/${item.id}`);
    } catch (err) {
      if (Array.isArray(err.details)) {
        const map = {};
        err.details.forEach((d) => d.field && (map[d.field] = d.message));
        setFieldErrors(map);
        // Jump back to the step containing the first error.
        if (
          map.title ||
          map.category ||
          map.categoryOther ||
          map.location ||
          map.locationOther ||
          map.dateLostOrFound
        )
          setStep(0);
        else if (map.description) setStep(1);
        else setStep(2);
      }
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="report-wrap glass">
        <h1 style={{ fontSize: 'var(--fs-h2)' }}>Report an item</h1>

        {/* Step indicator */}
        <ol className="stepper" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li key={label} className={`stepper__item ${i === step ? 'is-active' : ''} ${i < step ? 'is-done' : ''}`}>
              <span className="stepper__dot">{i < step ? '✓' : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        {error && (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {step === 0 && (
            <div className="stack">
              <fieldset className="type-toggle">
                <legend className="field__label">Are you reporting a lost or found item?</legend>
                {['lost', 'found'].map((t) => (
                  <label key={t} className={`type-option ${form.type === t ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="type"
                      value={t}
                      checked={form.type === t}
                      onChange={setEvent('type')}
                    />
                    <span>{t === 'lost' ? 'I lost something' : 'I found something'}</span>
                  </label>
                ))}
              </fieldset>

              <Field
                id="title"
                label="Title"
                value={form.title}
                onChange={set('title')}
                error={fieldErrors.title}
                placeholder="e.g. Black OnePlus phone"
              />

              <div className="grid-2">
                <label className="field">
                  <span className="field__label">Category</span>
                  <select className="field__input" value={form.category} onChange={setEvent('category')}>
                    <option value="">Select a category</option>
                    {config?.categories?.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field__label">Location</span>
                  <LocationSelect value={form.location} onChange={set('location')} />
                </label>
              </div>

              {form.category === 'Other' && (
                <Field
                  id="categoryOther"
                  label="Type the category"
                  value={form.categoryOther}
                  onChange={set('categoryOther')}
                  error={fieldErrors.categoryOther}
                  placeholder="e.g. Umbrella, Calculator, Earphones"
                />
              )}

              {form.location === 'Other' && (
                <Field
                  id="locationOther"
                  label="Type the location"
                  value={form.locationOther}
                  onChange={set('locationOther')}
                  error={fieldErrors.locationOther}
                  placeholder="e.g. Near the water cooler, 2nd floor Block C"
                />
              )}

              <Field
                id="date"
                label={form.type === 'lost' ? 'When did you lose it?' : 'When did you find it?'}
                type="date"
                value={form.dateLostOrFound}
                onChange={set('dateLostOrFound')}
                max={today()}
              />
            </div>
          )}

          {step === 1 && (
            <div className="stack">
              <label className="field">
                <span className="field__label">Description</span>
                <textarea
                  className="field__input"
                  rows={5}
                  value={form.description}
                  onChange={setEvent('description')}
                  placeholder="Describe the item — colour, brand, distinguishing marks, exact spot…"
                  aria-invalid={fieldErrors.description ? 'true' : undefined}
                />
                {fieldErrors.description && (
                  <span className="field__error" role="alert">
                    {fieldErrors.description}
                  </span>
                )}
              </label>

              <div className="field">
                <span className="field__label">Photo</span>
                <PhotoUpload
                  value={form.photoUrl}
                  onChange={set('photoUrl')}
                  onUploadingChange={setPhotoUploading}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="stack">
              {form.type === 'found' && (
                <>
                  <label className="field">
                    <span className="field__label">Where is the item now?</span>
                    <select className="field__input" value={form.heldBy} onChange={setEvent('heldBy')}>
                      <option value="finder">I'm keeping it safe</option>
                      <option value="desk">Handed to the lost-property desk</option>
                    </select>
                  </label>
                  <Field
                    id="heldNote"
                    label="Handover note (optional)"
                    required={false}
                    value={form.heldNote}
                    onChange={set('heldNote')}
                    placeholder="e.g. Ask at the security desk, evenings"
                  />
                </>
              )}

              <div className="info-note">
                <LockIcon size={16} />
                <span>
                  A <strong>verification question</strong> helps confirm the real owner. The
                  answer is private — never shown publicly. Whoever claims the item must answer
                  it. Optional, but recommended.
                </span>
              </div>

              <Field
                id="verifyingQuestion"
                label="Verification question (optional)"
                required={false}
                value={form.verifyingQuestion}
                onChange={set('verifyingQuestion')}
                error={fieldErrors.verifyingQuestion}
                placeholder="e.g. What's on the back of the phone?"
              />
              <Field
                id="verifyingAnswer"
                label="Answer (kept private)"
                required={false}
                value={form.verifyingAnswer}
                onChange={set('verifyingAnswer')}
                error={fieldErrors.verifyingAnswer}
                placeholder="e.g. A blue dolphin sticker"
              />
            </div>
          )}

          <div className="report-nav">
            {step > 0 ? (
              <button type="button" className="btn btn--ghost" onClick={back}>
                ← Back
              </button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn" onClick={next} disabled={!stepValid() || photoUploading}>
                Next →
              </button>
            ) : (
              <button type="submit" className="btn" disabled={submitting || !canSubmit || photoUploading}>
                {submitting ? 'Submitting…' : 'Submit report'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
