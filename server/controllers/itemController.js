import { z } from 'zod';
import Item from '../models/Item.js';
import Match from '../models/Match.js';
import Claim from '../models/Claim.js';
import { ApiError, asyncHandler } from '../middleware/error.js';
import { runMatching } from '../services/matching.js';
import {
  ITEM_TYPES,
  CATEGORIES,
  LOCATIONS,
  HELD_BY,
  ITEM_STATUSES,
} from '../config/constants.js';

// Small helper: validate a value is one of an allowed list.
const inList = (list, label) =>
  z.string().refine((v) => list.includes(v), { message: `Invalid ${label}` });

const baseItemShape = {
  type: inList(ITEM_TYPES, 'type'),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(2000),
  category: inList(CATEGORIES, 'category'),
  categoryOther: z.string().trim().max(60).optional().default(''),
  location: inList(LOCATIONS, 'location'),
  locationOther: z.string().trim().max(120).optional().default(''),
  // Accept an ISO date string or yyyy-mm-dd; coerce to Date.
  dateLostOrFound: z.coerce.date({ invalid_type_error: 'Enter a valid date' }),
  photoUrl: z.string().url('Photo URL must be a valid URL').or(z.literal('')).optional(),
  verifyingQuestion: z.string().trim().max(200).optional().default(''),
  verifyingAnswer: z.string().trim().max(200).optional().default(''),
  heldBy: inList(HELD_BY, 'heldBy').optional(),
  heldNote: z.string().trim().max(200).optional().default(''),
};

// Cross-field rules shared by create + update.
const verificationRule = (data, ctx) => {
  const hasQ = Boolean(data.verifyingQuestion?.trim());
  const hasA = Boolean(data.verifyingAnswer?.trim());
  if (hasQ && !hasA) {
    ctx.addIssue({
      path: ['verifyingAnswer'],
      code: z.ZodIssueCode.custom,
      message: 'Provide the answer to your verifying question',
    });
  }
  if (hasA && !hasQ) {
    ctx.addIssue({
      path: ['verifyingQuestion'],
      code: z.ZodIssueCode.custom,
      message: 'Add the question for this answer',
    });
  }
  // When the location is "Other", a custom place is required.
  if (data.location === 'Other' && !data.locationOther?.trim()) {
    ctx.addIssue({
      path: ['locationOther'],
      code: z.ZodIssueCode.custom,
      message: 'Please type where it was lost/found',
    });
  }
  // When the category is "Other", a custom category is required.
  if (data.category === 'Other' && !data.categoryOther?.trim()) {
    ctx.addIssue({
      path: ['categoryOther'],
      code: z.ZodIssueCode.custom,
      message: 'Please type the item category',
    });
  }
};

export const createItemSchema = z.object(baseItemShape).superRefine(verificationRule);

export const updateItemSchema = z
  .object({
    title: baseItemShape.title.optional(),
    description: baseItemShape.description.optional(),
    category: baseItemShape.category.optional(),
    categoryOther: baseItemShape.categoryOther,
    location: baseItemShape.location.optional(),
    locationOther: baseItemShape.locationOther,
    dateLostOrFound: baseItemShape.dateLostOrFound.optional(),
    photoUrl: baseItemShape.photoUrl,
    verifyingQuestion: baseItemShape.verifyingQuestion,
    verifyingAnswer: baseItemShape.verifyingAnswer,
    heldBy: baseItemShape.heldBy,
    heldNote: baseItemShape.heldNote,
  })
  .superRefine(verificationRule);

// POST /api/items — report a lost or found item.
export const createItem = asyncHandler(async (req, res) => {
  const data = req.body;

  const item = new Item({
    type: data.type,
    title: data.title,
    description: data.description,
    category: data.category,
    categoryOther: data.category === 'Other' ? data.categoryOther : '',
    location: data.location,
    locationOther: data.location === 'Other' ? data.locationOther : '',
    dateLostOrFound: data.dateLostOrFound,
    photoUrl: data.photoUrl || '',
    verifyingQuestion: data.verifyingQuestion || '',
    heldBy: data.type === 'found' ? data.heldBy : undefined,
    heldNote: data.type === 'found' ? data.heldNote || '' : '',
    reporter: req.user._id,
    status: 'open',
  });

  if (data.verifyingAnswer) {
    await item.setVerifyingAnswer(data.verifyingAnswer);
  }
  await item.save();

  // Run AI matching inline (resilient — never throws). Keeps things simple and
  // reliable on serverless: one Gemini call against a small candidate set.
  const matches = await runMatching(item);

  res.status(201).json({ item: item.toPublic(), matchCount: matches.length });
});

// GET /api/items/:id/matches — suggested matches for an item, with the other
// side's public details + confidence + reason.
export const getItemMatches = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const matches = await Match.find({
    status: { $ne: 'dismissed' },
    $or: [{ lostItem: id }, { foundItem: id }],
  })
    .sort({ score: -1 })
    .populate({ path: 'lostItem', populate: { path: 'reporter', select: 'name phone' } })
    .populate({ path: 'foundItem', populate: { path: 'reporter', select: 'name phone' } });

  const out = matches
    .map((m) => {
      const other = m.lostItem?._id.toString() === id ? m.foundItem : m.lostItem;
      if (!other || other.status === 'removed') return null;
      return { matchId: m._id, score: m.score, reason: m.reason, item: other.toPublic() };
    })
    .filter(Boolean);

  res.json({ matches: out });
});

// GET /api/items — browse feed with filters, keyword search, pagination.
export const listItems = asyncHandler(async (req, res) => {
  const { type, category, location, status, q } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));

  const filter = {};
  if (type && ITEM_TYPES.includes(type)) filter.type = type;
  if (category && CATEGORIES.includes(category)) filter.category = category;
  if (location && LOCATIONS.includes(location)) filter.location = location;

  // The browse feed never shows moderation-removed items — to anyone, including
  // admins. Removed items are managed only from the Admin dashboard.
  // Only a known status *string* is accepted — a crafted query like
  // ?status[$in][]=removed would otherwise reach MongoDB as an operator.
  if (typeof status === 'string' && status !== 'removed' && ITEM_STATUSES.includes(status)) {
    filter.status = status;
  } else {
    filter.status = { $ne: 'removed' };
  }

  let query = Item.find(filter);
  let sort = { createdAt: -1 };

  if (typeof q === 'string' && q.trim()) {
    filter.$text = { $search: q.trim() };
    query = Item.find(filter, { score: { $meta: 'textScore' } });
    sort = { score: { $meta: 'textScore' }, createdAt: -1 };
  }

  const [items, total] = await Promise.all([
    query
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reporter', 'name')
      .exec(),
    Item.countDocuments(filter),
  ]);

  res.json({
    items: items.map((i) => i.toPublic()),
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  });
});

// GET /api/items/mine — the current user's own reports.
export const myItems = asyncHandler(async (req, res) => {
  const items = await Item.find({ reporter: req.user._id })
    .sort({ createdAt: -1 })
    .populate('reporter', 'name');
  res.json({ items: items.map((i) => i.toPublic()) });
});

// GET /api/items/:id — single item detail.
export const getItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id).populate('reporter', 'name phone');
  if (!item) throw new ApiError(404, 'Item not found');
  if (item.status === 'removed' && req.user.role !== 'admin') {
    throw new ApiError(404, 'Item not found');
  }

  const isOwner = item.reporter._id.toString() === req.user._id.toString();
  // The current user's own claim on this item (if any) so the UI can reflect it.
  const myClaimDoc = await Claim.findOne({ item: item._id, claimant: req.user._id }).sort({
    createdAt: -1,
  });
  // Whether there's an approved claim (used to gate "mark collected").
  const hasApprovedClaim =
    (isOwner || req.user.role === 'admin') &&
    (await Claim.countDocuments({ item: item._id, status: 'approved' })) > 0;

  res.json({
    item: item.toPublic(),
    isOwner,
    myClaim: myClaimDoc ? myClaimDoc.toClaimant() : null,
    hasApprovedClaim,
  });
});

// Owner-or-admin guard for mutating an item.
async function loadOwnedItem(req) {
  const item = await Item.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Item not found');
  const isOwner = item.reporter.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    throw new ApiError(403, 'You can only modify your own reports');
  }
  return item;
}

// PATCH /api/items/:id — edit an item (owner or admin).
export const updateItem = asyncHandler(async (req, res) => {
  const item = await loadOwnedItem(req);
  const data = req.body;

  const editable = ['title', 'description', 'category', 'location', 'dateLostOrFound', 'heldNote'];
  editable.forEach((k) => {
    if (data[k] !== undefined) item[k] = data[k];
  });
  // Keep locationOther consistent with the (possibly updated) location.
  if (data.location !== undefined || data.locationOther !== undefined) {
    item.locationOther = item.location === 'Other' ? data.locationOther || '' : '';
  }
  // Keep categoryOther consistent with the (possibly updated) category.
  if (data.category !== undefined || data.categoryOther !== undefined) {
    item.categoryOther = item.category === 'Other' ? data.categoryOther || '' : '';
  }
  if (data.photoUrl !== undefined) item.photoUrl = data.photoUrl || '';
  if (data.heldBy !== undefined && item.type === 'found') item.heldBy = data.heldBy;
  if (data.verifyingQuestion !== undefined) item.verifyingQuestion = data.verifyingQuestion || '';
  if (data.verifyingAnswer) await item.setVerifyingAnswer(data.verifyingAnswer);

  await item.save();
  res.json({ item: item.toPublic() });
});

// DELETE /api/items/:id — remove an item (owner or admin).
export const deleteItem = asyncHandler(async (req, res) => {
  const item = await loadOwnedItem(req);
  await item.deleteOne();
  // Clean up records that point at the deleted item so nothing is left dangling.
  await Promise.all([
    Match.deleteMany({ $or: [{ lostItem: item._id }, { foundItem: item._id }] }),
    Claim.deleteMany({ item: item._id }),
  ]);
  res.json({ ok: true });
});
