import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  ITEM_TYPES,
  CATEGORIES,
  LOCATIONS,
  ITEM_STATUSES,
  HELD_BY,
} from '../config/constants.js';

const { Schema, model, models } = mongoose;

const itemSchema = new Schema(
  {
    type: { type: String, enum: ITEM_TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    // Free-text category used when category === 'Other'.
    categoryOther: { type: String, trim: true, maxlength: 60, default: '' },
    location: { type: String, enum: LOCATIONS, required: true, index: true },
    // Free-text place used when location === 'Other' (we can't list every spot).
    locationOther: { type: String, trim: true, maxlength: 120, default: '' },
    dateLostOrFound: { type: Date, required: true },

    photoUrl: { type: String, default: '' },

    // Private ownership-verification challenge. The question may be shown to a
    // would-be claimant; the answer is hashed and NEVER returned to clients
    // (select: false), exactly like a password.
    verifyingQuestion: { type: String, trim: true, maxlength: 200, default: '' },
    verifyingAnswerHash: { type: String, select: false, default: '' },

    // For found items: where it's currently held.
    heldBy: { type: String, enum: HELD_BY, default: undefined },
    heldNote: { type: String, trim: true, maxlength: 200, default: '' },

    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ITEM_STATUSES, default: 'open', index: true },
    // Set when an admin removes the item, so restoring returns it to that status.
    statusBeforeRemoval: { type: String, enum: ITEM_STATUSES, default: undefined },

    // Reserved for the optional embeddings/vector-search upgrade (roadmap).
    embedding: { type: [Number], select: false, default: undefined },
  },
  { timestamps: true }
);

// Helpful compound index for the common browse query (newest first within a type).
itemSchema.index({ type: 1, status: 1, createdAt: -1 });
// Text index powers keyword search across title + description.
itemSchema.index({ title: 'text', description: 'text' });

itemSchema.methods.setVerifyingAnswer = async function setVerifyingAnswer(plain) {
  this.verifyingAnswerHash = plain ? await bcrypt.hash(plain.trim().toLowerCase(), 10) : '';
};

itemSchema.methods.checkVerifyingAnswer = function checkVerifyingAnswer(plain) {
  if (!this.verifyingAnswerHash) return false;
  return bcrypt.compare(String(plain).trim().toLowerCase(), this.verifyingAnswerHash);
};

// Public shape. Never leaks the answer hash or embedding. The reporter is
// reduced to id + name, plus their phone *only* when the route populated it
// (item detail / matches). Every item route requires a logged-in SMVDU member,
// so the phone is visible to the verified community only — by design, so a
// finder and owner can call or WhatsApp each other.
itemSchema.methods.toPublic = function toPublic() {
  const reporter =
    this.reporter && this.reporter.name
      ? { id: this.reporter._id, name: this.reporter.name, phone: this.reporter.phone || '' }
      : { id: this.reporter };
  return {
    id: this._id,
    type: this.type,
    title: this.title,
    description: this.description,
    category: this.category,
    categoryOther: this.categoryOther,
    location: this.location,
    locationOther: this.locationOther,
    dateLostOrFound: this.dateLostOrFound,
    photoUrl: this.photoUrl,
    verifyingQuestion: this.verifyingQuestion,
    hasVerification: Boolean(this.verifyingQuestion),
    heldBy: this.heldBy,
    heldNote: this.heldNote,
    reporter,
    status: this.status,
    createdAt: this.createdAt,
  };
};

export default models.Item || model('Item', itemSchema);
