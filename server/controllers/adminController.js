import crypto from 'crypto';
import User from '../models/User.js';
import Item from '../models/Item.js';
import Claim from '../models/Claim.js';
import AuditLog from '../models/AuditLog.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import { ApiError, asyncHandler } from '../middleware/error.js';
import { sendEmail, brandedEmail, escapeHtml } from '../services/email.js';
import { ITEM_STATUSES } from '../config/constants.js';
import { logAudit } from '../services/audit.js';
import { env } from '../config/env.js';

// Generate a readable temporary password, e.g. "Found-7K2P9Q"
function tempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rnd = crypto.randomBytes(7);
  let s = '';
  for (let i = 0; i < 7; i++) s += chars[rnd[i] % chars.length];
  return `Found-${s}`;
}

// GET /api/admin/reset-requests?status=pending
export const listResetRequests = asyncHandler(async (req, res) => {
  const status = req.query.status || 'pending';
  const filter = status === 'all' ? {} : { status };
  const requests = await PasswordResetRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('user', 'name');
  res.json({ requests: requests.map((r) => r.toPublic()) });
});

// POST /api/admin/reset-requests/:id/approve
// Sets a temporary password, emails it to the user, marks the request approved.
export const approveResetRequest = asyncHandler(async (req, res) => {
  const request = await PasswordResetRequest.findById(req.params.id);
  if (!request) throw new ApiError(404, 'Request not found');
  if (request.status !== 'pending') throw new ApiError(409, 'Request already resolved');

  const user = await User.findById(request.user);
  if (!user) throw new ApiError(404, 'User no longer exists');

  const temp = tempPassword();
  await user.setPassword(temp);
  await user.save();

  let emailed = false;
  try {
    await sendEmail({
      to: user.email,
      toName: user.name,
      subject: 'Your FoundIt temporary password',
      html: brandedEmail(
        'Password reset approved',
        `<p>Hi ${escapeHtml(user.name)},</p>
         <p>An admin approved your password reset. Use this temporary password to log in:</p>
         <p style="font-size:20px;font-weight:700;letter-spacing:1px;background:#f7f5f2;padding:12px 16px;border-radius:10px;display:inline-block">${temp}</p>
         <p>For your security, please log in and change it right away from
         <strong>Profile → Change password</strong>.</p>
         <p><a href="${env.CLIENT_URL}/login" style="color:#c24e1e">Log in to FoundIt</a></p>`
      ),
      text: `Hi ${user.name}, your temporary FoundIt password is: ${temp}. Log in at ${env.CLIENT_URL}/login and change it from Profile > Change password.`,
    });
    emailed = true;
  } catch (err) {
    console.error('[admin] reset email failed:', err.message);
  }

  request.status = 'approved';
  request.reviewer = req.user._id;
  request.resolvedAt = new Date();
  await request.save();
  await logAudit(req.user, 'reset_approve', user.email, { emailed });

  // If email delivery failed (e.g. Brevo not set up), return the temp password
  // to the admin so they can pass it on manually — the reset still succeeded.
  res.json({ ok: true, emailed, ...(emailed ? {} : { tempPassword: temp }) });
});

// POST /api/admin/reset-requests/:id/reject
export const rejectResetRequest = asyncHandler(async (req, res) => {
  const request = await PasswordResetRequest.findById(req.params.id);
  if (!request) throw new ApiError(404, 'Request not found');
  if (request.status !== 'pending') throw new ApiError(409, 'Request already resolved');
  request.status = 'rejected';
  request.reviewer = req.user._id;
  request.resolvedAt = new Date();
  await request.save();
  await logAudit(req.user, 'reset_reject', request.email);
  res.json({ ok: true });
});

// GET /api/admin/stats — headline counts for the dashboard.
export const getStats = asyncHandler(async (req, res) => {
  const [items, open, reunited, activeClaims, users, resetPending] = await Promise.all([
    Item.countDocuments({ status: { $ne: 'removed' } }),
    Item.countDocuments({ status: { $in: ['open', 'potential_match'] } }),
    Item.countDocuments({ status: 'collected' }),
    Claim.countDocuments({ status: 'pending' }),
    User.countDocuments({}),
    PasswordResetRequest.countDocuments({ status: 'pending' }),
  ]);
  res.json({ items, open, reunited, activeClaims, users, resetPending });
});

// GET /api/admin/claims — all pending claims across the platform.
export const listPendingClaims = asyncHandler(async (req, res) => {
  const claims = await Claim.find({ status: 'pending' })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('claimant', 'name')
    .populate('item', 'title type');
  res.json({
    claims: claims.map((c) => ({
      id: c._id,
      answer: c.answer,
      autoMatch: c.autoMatch,
      createdAt: c.createdAt,
      claimant: c.claimant ? { id: c.claimant._id, name: c.claimant.name } : null,
      item: c.item ? { id: c.item._id, title: c.item.title, type: c.item.type } : null,
    })),
  });
});

// GET /api/admin/items?q=&status= — moderation list (admin sees everything).
export const listItemsAdmin = asyncHandler(async (req, res) => {
  const { q, status } = req.query;
  const filter = {};
  // Only accept plain strings from the query (blocks ?status[$ne]=x style operator injection).
  if (typeof status === 'string' && ITEM_STATUSES.includes(status)) filter.status = status;
  if (typeof q === 'string' && q.trim()) filter.$text = { $search: q.trim() };
  const items = await Item.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('reporter', 'name');
  res.json({ items: items.map((i) => i.toPublic()) });
});

// GET /api/admin/desk-items — found items physically held at the desk.
export const listDeskItems = asyncHandler(async (req, res) => {
  const items = await Item.find({ heldBy: 'desk', status: { $ne: 'removed' } })
    .sort({ createdAt: -1 })
    .populate('reporter', 'name');
  res.json({ items: items.map((i) => i.toPublic()) });
});

// POST /api/admin/items/:id/remove — soft moderation removal.
export const removeItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Item not found');
  if (item.status !== 'removed') {
    // Remember where it was so "restore" can put it back exactly.
    item.statusBeforeRemoval = item.status;
    item.status = 'removed';
    await item.save();
  }
  await logAudit(req.user, 'item_remove', item.title, { itemId: item._id });
  res.json({ ok: true });
});

// POST /api/admin/items/:id/restore — undo a removal.
export const restoreItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Item not found');
  if (item.status === 'removed') {
    item.status = item.statusBeforeRemoval || 'open';
    item.statusBeforeRemoval = undefined;
    await item.save();
  }
  await logAudit(req.user, 'item_restore', item.title, { itemId: item._id });
  res.json({ ok: true });
});

// GET /api/admin/audit — recent audit-log entries.
export const listAuditLog = asyncHandler(async (req, res) => {
  const entries = await AuditLog.find({}).sort({ createdAt: -1 }).limit(50);
  res.json({
    entries: entries.map((e) => ({
      id: e._id,
      actorName: e.actorName,
      action: e.action,
      target: e.target,
      createdAt: e.createdAt,
    })),
  });
});
