import { useState } from 'react';
import { useConfig } from '../context/ConfigContext.jsx';
import { uploadToCloudinary } from '../lib/cloudinary.js';
import { ImageIcon } from './Icons.jsx';

// Optional photo field. Uploads directly to Cloudinary and reports back the
// hosted URL via onChange. Shows a preview and lets the user remove it.
export default function PhotoUpload({ value, onChange, onUploadingChange }) {
  const config = useConfig();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const enabled = config?.cloudinary?.enabled;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const url = await uploadToCloudinary(file, config.cloudinary);
      onChange(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  if (!enabled) {
    return (
      <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
        Photo uploads are currently unavailable.
      </p>
    );
  }

  return (
    <div>
      {value ? (
        <div className="photo-preview">
          <img src={value} alt="Selected item" />
          <button type="button" className="btn btn--ghost" onClick={() => onChange('')}>
            Remove photo
          </button>
        </div>
      ) : (
        <label className="photo-drop">
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          <ImageIcon size={28} />
          <span>{uploading ? 'Uploading…' : 'Add a photo (optional)'}</span>
          <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            JPG, PNG or WebP · up to 8 MB
          </span>
        </label>
      )}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
