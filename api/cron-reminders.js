import { sendDiscordMessage } from "../lib/discord.js";
import { json } from "../lib/http.js";
import {
  buildCardEmbed,
  fetchBoardCards,
  fetchBoardMembers,
  formatInTimezone,
  getAppTimezone,
  getDiscordMentions,
  toDiscordAbsoluteTimestamp,
  toDiscordRelativeTimestamp
} from "../lib/trello.js";

function filterDueCards(cards, remindWithinHours) {
  const now = Date.now();
  const windowMs = remindWithinHours * 60 * 60 * 1000;

  return cards.filter((card) => {
    if (!card.due || card.dueComplete) return false;
    const dueMs = new Date(card.due).getTime();

    const overdue = dueMs < now;
    const dueSoon = dueMs >= now && dueMs <= now + windowMs;
    return overdue || dueSoon;
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const boardId = process.env.TRELLO_BOARD_ID;
  if (!boardId) {
    return json(res, 500, { ok: false, error: "Missing TRELLO_BOARD_ID env variable." });
  }

  const remindWithinHours = Number(process.env.REMIND_WITHIN_HOURS || 24);
  const timezone = getAppTimezone();

  try {
    const [cards, members] = await Promise.all([fetchBoardCards(boardId), fetchBoardMembers(boardId)]);
    const dueCards = filterDueCards(cards, remindWithinHours);

    if (!dueCards.length) {
      return json(res, 200, { ok: true, reminded: 0, message: "No due cards to remind." });
    }

    for (const card of dueCards) {
      const dueDate = new Date(card.due);
      const isOverdue = dueDate.getTime() < Date.now();
      const prefix = isOverdue ? "⏰ Daily overdue reminder" : "🔔 Daily due-soon reminder";
      const dueAbsolute = toDiscordAbsoluteTimestamp(card.due);
      const dueRelative = toDiscordRelativeTimestamp(card.due);
      const dueCET = formatInTimezone(card.due, timezone);
      const mentions = getDiscordMentions(card, members).join(" ");
      const message = `${prefix}: **${card.name}**\nDue: ${dueAbsolute} (${dueRelative})\n${timezone}: ${dueCET}\n${mentions}`.trim();
      const embed = buildCardEmbed(card, members, isOverdue ? 0xdc2626 : 0xf59e0b);

      await sendDiscordMessage(message, [embed]);
    }

    return json(res, 200, { ok: true, reminded: dueCards.length, cadence: "daily" });
  } catch (error) {
    console.error(error);
    return json(res, 500, { ok: false, error: error.message });
  }
}
