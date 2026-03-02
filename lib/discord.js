const DISCORD_API_BASE = "https://discord.com/api/v10";

export async function sendDiscordMessage(content, embeds = []) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) {
    throw new Error("Missing DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID env variable.");
  }

  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content, embeds })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Discord API error (${response.status}): ${errorBody}`);
  }

  return response.json();
}
