import crypto from "node:crypto";

const TRELLO_API_BASE = "https://api.trello.com/1";

function getTrelloAuthQuery() {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_API_TOKEN;

  if (!key || !token) {
    throw new Error("Missing TRELLO_API_KEY or TRELLO_API_TOKEN env variable.");
  }

  return new URLSearchParams({ key, token });
}

export function getAppTimezone() {
  return process.env.APP_TIMEZONE || "Europe/Paris";
}

export function toDiscordAbsoluteTimestamp(dateInput) {
  if (!dateInput) return "N/A";
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "N/A";
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

export function toDiscordRelativeTimestamp(dateInput) {
  if (!dateInput) return "N/A";
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "N/A";
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

export function formatInTimezone(dateInput, timezone = getAppTimezone()) {
  if (!dateInput) return "No date";
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone
  }).format(date);
}

export async function fetchBoardCards(boardId) {
  const auth = getTrelloAuthQuery();
  const url = `${TRELLO_API_BASE}/boards/${boardId}/cards/open?${auth.toString()}&fields=name,desc,due,dueComplete,shortUrl,idMembers,idList,dateLastActivity`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Trello API error (${response.status}): ${await response.text()}`);
  }

  return response.json();
}

export async function fetchBoardMembers(boardId) {
  const auth = getTrelloAuthQuery();
  const url = `${TRELLO_API_BASE}/boards/${boardId}/members?${auth.toString()}&fields=id,fullName,username`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Trello API error (${response.status}): ${await response.text()}`);
  }

  const members = await response.json();
  return new Map(members.map((member) => [member.id, member]));
}

export function verifyTrelloSignature(rawBody, callbackUrl, signatureHeader) {
  const secret = process.env.TRELLO_WEBHOOK_SECRET;
  if (!secret) {
    return true;
  }

  if (!signatureHeader || !callbackUrl) {
    return false;
  }

  const payload = Buffer.from(`${rawBody}${callbackUrl}`, "utf8");
  const computed = crypto.createHmac("sha1", secret).update(payload).digest("base64");
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signatureHeader));
}

export function getDiscordMentions(card, memberMap = new Map()) {
  const rawMap = process.env.DISCORD_USER_MAP;
  if (!rawMap || !card.idMembers?.length) {
    return [];
  }

  let discordMap;
  try {
    discordMap = JSON.parse(rawMap);
  } catch {
    return [];
  }

  const mentions = new Set();
  for (const memberId of card.idMembers) {
    const member = memberMap.get(memberId);
    const discordId = discordMap[memberId] || discordMap[member?.username];
    if (discordId) {
      mentions.add(`<@${discordId}>`);
    }
  }

  return [...mentions];
}

export function buildCardEmbed(card, memberMap = new Map(), color = 0x4f46e5) {
  const timezone = getAppTimezone();
  const assignees = card.idMembers?.length
    ? card.idMembers
        .map((memberId) => memberMap.get(memberId))
        .filter(Boolean)
        .map((member) => member.fullName || member.username)
        .join(", ")
    : "Unassigned";

  const dueDateLabel = card.due ? `${formatInTimezone(card.due, timezone)} (${timezone})` : "No due date";
  const dueDiscordAbsolute = toDiscordAbsoluteTimestamp(card.due);
  const dueDiscordRelative = toDiscordRelativeTimestamp(card.due);

  return {
    title: card.name,
    url: card.shortUrl,
    description: card.desc?.slice(0, 1000) || "No description",
    color,
    fields: [
      { name: `Due (${timezone})`, value: dueDateLabel, inline: false },
      { name: "Due (Discord absolute)", value: dueDiscordAbsolute, inline: true },
      { name: "Due (Discord relative)", value: dueDiscordRelative, inline: true },
      { name: "Status", value: card.dueComplete ? "✅ Complete" : "🕒 Open", inline: true },
      { name: "Assignees", value: assignees, inline: false }
    ],
    timestamp: new Date().toISOString()
  };
}
