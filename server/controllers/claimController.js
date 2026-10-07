import { z } from 'zod';
import Item from '../models/Item.js';
import Claim from '../models/Claim.js';
import Match from '../models/Match.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { ApiError, asyncHandler } from '../middleware/error.js';
import { sendEmail, brandedEmail, escapeHtml } from '../services/email.js';
import { logAudit } from '../services/audit.js';
import { env } from '../config/env.js';

const CLAIMABLE = ['open', 'potential_match', 'claim_pending'];

export const createClaimSchema = z.object({
  answer: z.string().trim().max(300).optional().default(''),
  message: z.string().trim().max(500).optional().default(''),
});

// Fire an in-app notification + best-effort email.
async function notify(user, { message, link, subject, title, bodyHtml }) {
  if (!user) return;
  await Notification.create({ user: user._id || user, type: 'claim', message, link });
  const email = user.email;
  if (email) {
    sendEmail({
      to: email,
      toName: user.name,
      subject,
      html: brandedEmail(title, bodyHtml),
      text: message,
    }).catch((e) => console.error('[claim] email failed:', e.message));
  }
}

function isOwnerOrAdmin(item, user) {
  return item.reporter.toString() === user._id.toString() || user.role === 'admin';
}

// Revert an item's status after its last pending claim goes away.
async function revertItemStatus(item) {
  const stillPending = await Claim.countDocuments({ item: item._id, status: 'pending' });
  if (stillPending > 0) return;
  if (item.status === 'claim_pending') {
    const hasMatch = await Match.countDocuments({
      $or: [{ lostItem: item._id }, { foundItem: item._id }],
    });
    item.status = hasMatch ? 'potential_match' : 'open';
    await item.save();
  }
}

// POST /api/items/:id/claims — submit a claim.
export const createClaim = asyncHandler(async (req, res) => {
  const { answer, message } = req.body;
  const item = await Item.findById(req.params.id).select('+verifyingAnswerHash');
  if (!item) throw new ApiError(404, 'Item not found');

  if (item.reporter.toString() === req.user._id.toString()) {
    throw new ApiError(400, 'You cannot claim your own report');
  }
  if (!CLAIMABLE.includes(item.status)) {
    throw new ApiError(409, 'This item is no longer open for claims');
  }
  if (item.verifyingQuestion && !answer.trim()) {
    throw new ApiError(400, 'Please answer the verification question');
  }

  const existing = await Claim.findOne({
    item: item._id,
    claimant: req.user._id,
    status: { $in: ['pending', 'approved'] },
  });
  if (existing) throw new ApiError(409, 'You already have an active claim on this item');

  const autoMatch = item.verifyingQuestion
    ? await item.checkVerifyingAnswer(answer)
    : null;

  const claim = await Claim.create({
    item: item._id,
    claimant: req.user._id,
    answer,
    message,
    autoMatch,
  });

  if (['open', 'potential_match'].includes(item.status)) {
    item.status = 'claim_pending';
    await item.save();
  }

  // Notify the item's reporter (the finder) to review.
  const reporter = await Item.populate(item, { path: 'reporter', select: 'name email' });
  await notify(reporter.reporter, {
    message: `New claim on your item "${item.title}" from ${req.user.name}.`,
    link: `/items/${item._id}`,
    subject: `FoundIt: new claim on "${item.title}"`,
    title: 'You have a new claim to review',
    bodyHtml: `<p>${escapeHtml(req.user.name)} has claimed your item <strong>"${escapeHtml(item.title)}"</strong>.</p>
      <p>Review their answer to your verification question and approve or reject the claim:</p>
      <p><a href="${env.CLIENT_URL}/items/${item._id}" style="color:#c24e1e">Review the claim</a></p>`,
  });

  res.status(201).json({ claim: claim.toClaimant() });
});

// GET /api/items/:id/claims — list claims (owner or admin only).
export const listItemClaims = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Item not found');
  if (!isOwnerOrAdmin(item, req.user)) {
    throw new ApiError(403, 'Only the reporter or an admin can view claims');
  }
  const claims = await Claim.find({ item: item._id })
    .sort({ createdAt: -1 })
    .populate('claimant', 'name phone');
  res.json({ claims: claims.map((c) => c.toReviewer()) });
});

// GET /api/claims/mine — the current user's claims.
export const myClaims = asyncHandler(async (req, res) => {
  const claims = await Claim.find({ claimant: req.user._id })
    .sort({ createdAt: -1 })
    .populate('item', 'title type status');
  res.json({
    claims: claims.map((c) => ({
      ...c.toClaimant(),
      item: c.item ? { id: c.item._id, title: c.item.title, type: c.item.type } : null,
    })),
  });
});

// Shared loader + authorization for review actions.
async function loadReviewable(req) {
  const claim = await Claim.findById(req.params.id)
    .populate('item')
    .populate('claimant', 'name email phone');
  if (!claim) throw new ApiError(404, 'Claim not found');
  if (!claim.item) throw new ApiError(404, 'Item no longer exists');
  if (!isOwnerOrAdmin(claim.item, req.user)) {
    throw new ApiError(403, 'Only the reporter or an admin can review this claim');
  }
  return claim;
}

// POST /api/claims/:id/approve
export const approveClaim = asyncHandler(async (req, res) => {
  const claim = await loadReviewable(req);
  if (claim.status !== 'pending') throw new ApiError(409, 'This claim is already resolved');
  // A moderated (removed) item must not come back to life through a claim.
  if (claim.item.status === 'removed') {
    throw new ApiError(409, 'This item was removed by an admin');
  }

  claim.status = 'approved';
  claim.reviewer = req.user._id;
  claim.resolvedAt = new Date();
  await claim.save();

  claim.item.status = 'claim_approved';
  await claim.item.save();

  // Reject other pending claims on the same item.
  await Claim.updateMany(
    { item: claim.item._id, _id: { $ne: claim._id }, status: 'pending' },
    { $set: { status: 'rejected', reviewer: req.user._id, resolvedAt: new Date() } }
  );

  await logAudit(req.user, 'claim_approve', claim.item.title, {
    claimId: claim._id,
    claimant: claim.claimant?.name,
  });

  await notify(claim.claimant, {
    message: `Your claim for "${claim.item.title}" was approved! Arrange collection.`,
    link: `/items/${claim.item._id}`,
    subject: `FoundIt: your claim was approved 🎉`,
    title: 'Your claim was approved!',
    bodyHtml: `<p>Good news — your claim for <strong>"${escapeHtml(claim.item.title)}"</strong> was approved.</p>
      <p>Open the item to see the contact details and arrange a safe handover:</p>
      <p><a href="${env.CLIENT_URL}/items/${claim.item._id}" style="color:#c24e1e">View item & contact</a></p>`,
  });

  res.json({ ok: true });
});

// POST /api/claims/:id/reject
export const rejectClaim = asyncHandler(async (req, res) => {
  const claim = await loadReviewable(req);
  if (claim.status !== 'pending') throw new ApiError(409, 'This claim is already resolved');

  claim.status = 'rejected';
  claim.reviewer = req.user._id;
  claim.resolvedAt = new Date();
  await claim.save();
  await revertItemStatus(claim.item);
  await logAudit(req.user, 'claim_reject', claim.item.title, { claimId: claim._id });

  await notify(claim.claimant, {
    message: `Your claim for "${claim.item.title}" was not approved.`,
    link: `/items/${claim.item._id}`,
    subject: `FoundIt: update on your claim`,
    title: 'Update on your claim',
    bodyHtml: `<p>Your claim for <strong>"${escapeHtml(claim.item.title)}"</strong> was not approved this time.</p>
      <p>If you believe it's yours, you can contact the lost-property desk.</p>`,
  });

  res.json({ ok: true });
});

// POST /api/claims/:id/cancel — claimant withdraws their own pending claim.
export const cancelClaim = asyncHandler(async (req, res) => {
  const claim = await Claim.findById(req.params.id).populate('item');
  if (!claim) throw new ApiError(404, 'Claim not found');
  if (claim.claimant.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You can only cancel your own claim');
  }
  if (claim.status !== 'pending') throw new ApiError(409, 'This claim is already resolved');
  claim.status = 'cancelled';
  claim.resolvedAt = new Date();
  await claim.save();
  if (claim.item) await revertItemStatus(claim.item);
  res.json({ ok: true });
});

// POST /api/items/:id/collected — owner/admin marks the item handed over.
export const markCollected = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Item not found');
  if (!isOwnerOrAdmin(item, req.user)) {
    throw new ApiError(403, 'Only the reporter or an admin can mark this collected');
  }
  // Same rule the UI shows: a handover only happens after a claim is approved.
  if (item.status !== 'claim_approved') {
    throw new ApiError(409, 'Approve a claim before marking this item collected');
  }

  item.status = 'collected';
  await item.save();
  await logAudit(req.user, 'item_collected', item.title, { itemId: item._id });

  // Confirm related matches, and close the claimant's own counterpart report.
  const approved = await Claim.findOne({ item: item._id, status: 'approved' });
  const matches = await Match.find({
    $or: [{ lostItem: item._id }, { foundItem: item._id }],
  });
  for (const m of matches) {
    m.status = 'confirmed';
    await m.save();
    const otherId = m.lostItem.toString() === item._id.toString() ? m.foundItem : m.lostItem;
    if (approved) {
      await Item.updateOne(
        { _id: otherId, reporter: approved.claimant },
        { $set: { status: 'closed' } }
      );
    }
  }

  if (approved) {
    const claimant = await User.findById(approved.claimant);
    await notify(claimant, {
      message: `"${item.title}" has been marked collected. Reunited!`,
      link: `/items/${item._id}`,
      subject: `FoundIt: "${item.title}" collected`,
      title: 'Item collected — reunited! 🎉',
      bodyHtml: `<p>"<strong>${escapeHtml(item.title)}</strong>" has been marked as collected. Thanks for using FoundIt!</p>`,
    });
  }

  res.json({ ok: true });
});
