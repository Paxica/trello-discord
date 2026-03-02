const key = process.env.TRELLO_API_KEY;
const token = process.env.TRELLO_API_TOKEN;
const boardId = process.env.TRELLO_BOARD_ID;
const callbackUrl = process.env.TRELLO_CALLBACK_URL;

if (!key || !token || !boardId || !callbackUrl) {
  console.error("Missing required env vars: TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID, TRELLO_CALLBACK_URL");
  process.exit(1);
}

const url = new URL("https://api.trello.com/1/webhooks");
url.searchParams.set("key", key);
url.searchParams.set("token", token);

const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    callbackURL: callbackUrl,
    idModel: boardId,
    description: "Trello to Discord sync webhook"
  })
});

if (!response.ok) {
  console.error(`Failed to register webhook (${response.status}):`, await response.text());
  process.exit(1);
}

const payload = await response.json();
console.log("Webhook created:", payload.id);
