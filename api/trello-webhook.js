import { sendDiscordMessage } from "../lib/discord.js";
import { json, readJsonBody } from "../lib/http.js";
import {
  buildCardEmbed,
  fetchBoardMembers,
  formatInTimezone,
  getAppTimezone,
  getDiscordMentions,
  toDiscordAbsoluteTimestamp,
  verifyTrelloSignature
} from "../lib/trello.js";

const SUPPORTED_ACTIONS = new Set(["createCard", "updateCard", "commentCard", "moveCardToBoard", "copyCard"]);

function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

function actionSummary(action) {
  const actor = action.memberCreator?.fullName || action.memberCreator?.username || "Someone";
  const cardName = action.data?.card?.name || "a card";
  const timezone = getAppTimezone();
  const actionDate = action.date || new Date().toISOString();
  const actionWhen = `${formatInTimezone(actionDate, timezone)} (${timezone})`;

  switch (action.type) {
    case "createCard":
      return `🆕 **${actor}** created **${cardName}** on **${actionWhen}**`;
    case "commentCard":
      return `💬 **${actor}** commented on **${cardName}** on **${actionWhen}**`;
    case "updateCard":
      return `✏️ **${actor}** updated **${cardName}** on **${actionWhen}**`;
    default:
      return `📌 **${actor}** changed **${cardName}** on **${actionWhen}**`;
  }
}

export default async function handler(req, res) {
  if (req.method === "HEAD" || req.method === "GET") {
    return json(res, 200, { ok: true, message: "Trello webhook endpoint is live." });
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const callbackUrl = `${getBaseUrl(req)}/api/trello-webhook`;

  try {
    const { rawBody, body } = await readJsonBody(req);
    const signature = req.headers["x-trello-webhook"];

    if (!verifyTrelloSignature(rawBody, callbackUrl, signature)) {
      return json(res, 401, { ok: false, error: "Invalid Trello signature" });
    }

    const action = body?.action;
    if (!action || !SUPPORTED_ACTIONS.has(action.type)) {
      return json(res, 200, { ok: true, skipped: true });
    }

    const boardId = process.env.TRELLO_BOARD_ID;
    const members = boardId ? await fetchBoardMembers(boardId) : new Map();

    const card = {
      name: action.data?.card?.name,
      desc: action.data?.card?.desc,
      shortUrl: action.data?.card?.shortUrl || action.data?.card?.url,
      due: action.data?.card?.due,
      dueComplete: action.data?.card?.dueComplete,
      idMembers: action.data?.card?.idMembers || []
    };

    const mentions = getDiscordMentions(card, members);
    const dueInfo = card.due
      ? `Due: ${toDiscordAbsoluteTimestamp(card.due)} (${formatInTimezone(card.due, getAppTimezone())})`
      : "Due: No due date";
    const content = [actionSummary(action), dueInfo, mentions.join(" ")].filter(Boolean).join("\n");

    const embed = buildCardEmbed(card, members);
    await sendDiscordMessage(content, [embed]);

    return json(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return json(res, 500, { ok: false, error: error.message });
  }
}
