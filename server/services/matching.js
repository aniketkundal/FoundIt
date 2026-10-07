import Item from '../models/Item.js';
import Match from '../models/Match.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { rankMatches } from './gemini.js';
import { sendEmail, brandedEmail, escapeHtml } from './email.js';
import { env } from '../config/env.js';

const DATE_WINDOW_DAYS = 30;
const MAX_CANDIDATES = 12;
const MIN_SCORE = 50; // only surface believable matches

// Create an in-app notification and (best-effort) email for one party.
async function notifyParty(user, { ownItem, otherItem, score }) {
  if (!user) return;
  const link = `/items/${ownItem._id}`;
  const message = `Possible match (${score}%) for your ${ownItem.type} item "${ownItem.title}" — "${otherItem.title}".`;

  await Notification.create({ user: user._id, type: 'match', message, link });

  if (user.email) {
    sendEmail({
      to: user.email,
      toName: user.name,
      subject: `FoundIt: possible match for "${ownItem.title}"`,
      html: brandedEmail(
        'We found a possible match! 🎯',
        `<p>Hi ${escapeHtml(user.name)},</p>
         <p>Our matching engine found a <strong>${score}% likely match</strong> for your
         ${ownItem.type} item <strong>"${escapeHtml(ownItem.title)}"</strong>.</p>
         <p>Open your item to review the suggested match and contact the other person:</p>
         <p><a href="${env.CLIENT_URL}${link}" style="color:#c24e1e">View match on FoundIt</a></p>`
      ),
      text: `A ${score}% match was found for your ${ownItem.type} item "${ownItem.title}". View it: ${env.CLIENT_URL}${link}`,
    }).catch((e) => console.error('[matching] email failed:', e.message));
  }
}

// Run the AI matching pipeline for a newly created/updated item.
// Resilient: any failure is logged and swallowed so it never breaks item posting.
export async function runMatching(item) {
  try {
    const oppositeType = item.type === 'lost' ? 'found' : 'lost';
    const base = new Date(item.dateLostOrFound);
    const from = new Date(base);
    from.setDate(from.getDate() - DATE_WINDOW_DAYS);
    const to = new Date(base);
    to.setDate(to.getDate() + DATE_WINDOW_DAYS);

    // 1) Cheap DB pre-filter: opposite type, still open, same category, near in time.
    const candidates = await Item.find({
      type: oppositeType,
      status: { $in: ['open', 'potential_match'] },
      category: item.category,
      dateLostOrFound: { $gte: from, $lte: to },
      _id: { $ne: item._id },
    })
      .sort({ createdAt: -1 })
      .limit(MAX_CANDIDATES)
      .populate('reporter', 'name email');

    if (!candidates.length) return [];

    // 2) Ask Gemini to rank the small candidate set.
    const ranked = await rankMatches(item, candidates);
    const good = ranked.filter((m) => m.score >= MIN_SCORE);
    if (!good.length) return [];

    const itemReporter = await User.findById(item.reporter);
    const created = [];

    for (const m of good) {
      const cand = candidates.find((c) => c._id.toString() === m.id);
      if (!cand) continue;

      const lostItem = item.type === 'lost' ? item._id : cand._id;
      const foundItem = item.type === 'found' ? item._id : cand._id;

      // 3) Upsert the Match record (idempotent on the pair).
      await Match.findOneAndUpdate(
        { lostItem, foundItem },
        { $set: { score: m.score, reason: m.reason, status: 'suggested' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // 4) Move both items into "potential_match" if still open.
      if (item.status === 'open') {
        item.status = 'potential_match';
        await item.save();
      }
      if (cand.status === 'open') {
        await Item.updateOne({ _id: cand._id }, { $set: { status: 'potential_match' } });
      }

      // 5) Notify both reporters (in-app + email).
      await notifyParty(itemReporter, { ownItem: item, otherItem: cand, score: m.score });
      await notifyParty(cand.reporter, { ownItem: cand, otherItem: item, score: m.score });

      created.push({ id: m.id, score: m.score, reason: m.reason });
    }

    return created;
  } catch (err) {
    console.error('[matching] runMatching error:', err.message);
    return [];
  }
}
