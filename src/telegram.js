const TELEGRAM_API = "https://api.telegram.org";

export async function telegramRequest(token, method, payload) {
  if (!token) throw new Error("BOT_TOKEN is not configured");
  let response;
  try {
    response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", service: "Telegram", method, timestamp: new Date().toISOString(), error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }));
    throw error;
  }
  const body = await response.text();
  let result;
  try {
    result = body ? JSON.parse(body) : {};
  } catch (error) {
    console.error(JSON.stringify({ level: "error", service: "Telegram", method, status: response.status, timestamp: new Date().toISOString(), responseBody: body.slice(0, 2000), error: error instanceof Error ? error.message : String(error) }));
    throw new Error(`Telegram returned invalid JSON (HTTP ${response.status})`);
  }
  if (!response.ok || !result.ok) {
    const detail = result.description || body.slice(0, 1000) || `HTTP ${response.status}`;
    console.error(JSON.stringify({ level: "error", service: "Telegram", method, status: response.status, errorCode: result.error_code || null, timestamp: new Date().toISOString(), error: detail }));
    throw new Error(`Telegram API error (${response.status}): ${detail}`);
  }
  return result.result;
}
export function mainKeyboard() {
  return { inline_keyboard: [
    [{ text: "🔥 Trending", callback_data: "l:trending:1" }, { text: "⭐ Popular", callback_data: "l:popular:1" }],
    [{ text: "💖 Romance", callback_data: "l:romance:1" }, { text: "😂 Comedy", callback_data: "l:comedy:1" }],
    [{ text: "🕵️ Mystery", callback_data: "l:mystery:1" }],
  ] };
}
export function buildListKeyboard(media, category, page, stateId) {
  const rows = media.map(item => [{ text: (item.title?.english || item.title?.romaji || "Untitled").slice(0,40), callback_data: `d:${item.id}:${stateId}` }]);
  const pagination = [];
  if (page > 1) pagination.push({ text: "◀ Prev", callback_data: `l:${category}:${page-1}` });
  pagination.push({ text: "🏠 Menu", callback_data: "m" });
  if (media.length === 5) pagination.push({ text: "Next ▶", callback_data: `l:${category}:${page+1}` });
  rows.push(pagination); return { inline_keyboard: rows };
}
export function detailKeyboard(mediaId, stateId, webAppUrl) {
  const url = new URL("/", webAppUrl); url.searchParams.set("animeId", String(mediaId));
  return { inline_keyboard: [[{ text: "🚀 Open Mini App", web_app: { url: url.toString() } }], [{ text: "⬅ Back to list", callback_data: `b:${stateId}` }]] };
}
export async function sendMessage(token, chatId, text, replyMarkup) {
  return telegramRequest(token, "sendMessage", { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}), link_preview_options: { is_disabled: true } });
}
export async function sendPhoto(token, chatId, photo, caption, replyMarkup) {
  return telegramRequest(token, "sendPhoto", { chat_id: chatId, photo, caption, parse_mode: "HTML", ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
}
export async function answerCallback(token, callbackQueryId, text) {
  return telegramRequest(token, "answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text, show_alert: true } : {}) });
}
export async function deleteMessage(token, chatId, messageId) {
  return telegramRequest(token, "deleteMessage", { chat_id: chatId, message_id: messageId });
}
