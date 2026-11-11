import { getList,getMedia,searchMedia,titleOf } from "./anilist.js";
import { answerCallback,buildListKeyboard,deleteMessage,detailKeyboard,mainKeyboard,sendMessage,sendPhoto } from "./telegram.js";
const STATE_TTL_SECONDS=60*60*12;
function escapeHTML(value="") { return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char])); }
function compactId() { return crypto.randomUUID().replaceAll("-","").slice(0,12); }
async function saveState(env,value) {
  if(!env.BOT_STATE) throw new Error("BOT_STATE KV binding is missing");
  const id=compactId(); await env.BOT_STATE.put(`state:${id}`,JSON.stringify(value),{expirationTtl:STATE_TTL_SECONDS}); return id;
}
async function readState(env,id) {
  if(!/^[a-f0-9]{12}$/.test(id||"")) return null;
  const raw=await env.BOT_STATE.get(`state:${id}`); return raw?JSON.parse(raw):null;
}
async function showList(env,chatId,category,page,oldMessageId) {
  const result=await getList(category,page);
  if(!result?.media?.length) { await sendMessage(env.BOT_TOKEN,chatId,"No results found."); return; }
  const stateId=await saveState(env,{category,page}), keyboard=buildListKeyboard(result.media,category,page,stateId);
  const lines=result.media.map((item,index)=>`${index+1}. ${escapeHTML(titleOf(item))}${item.averageScore?` · ${item.averageScore}%`:""}`);
  if(oldMessageId) { try { await deleteMessage(env.BOT_TOKEN,chatId,oldMessageId); } catch {} }
  await sendMessage(env.BOT_TOKEN,chatId,`<b>${escapeHTML(category[0].toUpperCase()+category.slice(1))}</b>\n\n${lines.join("\n")}\n\nPage ${page}`,keyboard);
}
async function showSearch(env,chatId,query) {
  const result=await searchMedia(query,"ANIME",1);
  if(!result.media?.length) { await sendMessage(env.BOT_TOKEN,chatId,"No anime found. Try another title."); return; }
  const stateId=await saveState(env,{category:"search",page:1,query:query.slice(0,80)});
  const rows=result.media.slice(0,5).map(item=>[{text:titleOf(item).slice(0,40),callback_data:`d:${item.id}:${stateId}`}]);
  rows.push([{text:"🏠 Main menu",callback_data:"m"}]);
  await sendMessage(env.BOT_TOKEN,chatId,`<b>Search results</b>\n\n${result.media.slice(0,5).map((item,i)=>`${i+1}. ${escapeHTML(titleOf(item))}`).join("\n")}`,{inline_keyboard:rows});
}
async function showDetail(env,chatId,messageId,mediaId,stateId) {
  const media=await getMedia(mediaId,"ANIME");
  if(!media) { await sendMessage(env.BOT_TOKEN,chatId,"Unable to load this title."); return; }
  const title=escapeHTML(titleOf(media)), genres=(media.genres||[]).slice(0,5).map(escapeHTML).join(", ")||"—";
  const score=media.averageScore?`${media.averageScore}%`:"N/A", status=escapeHTML(media.status||"Unknown");
  const caption=`<b>${title}</b>\n\n<b>Genres:</b> ${genres}\n<b>Score:</b> ${score}\n<b>Status:</b> ${status}`;
  if(messageId) { try { await deleteMessage(env.BOT_TOKEN,chatId,messageId); } catch {} }
  await sendPhoto(env.BOT_TOKEN,chatId,media.coverImage?.extraLarge||media.coverImage?.large,caption,detailKeyboard(media.id,stateId,env.WEB_APP_URL));
}
async function handleMessage(env,message) {
  const chatId=message.chat?.id, text=String(message.text||"").trim(); if(!chatId) return;
  if(text==="/start"||text.startsWith("/start ")) { await sendMessage(env.BOT_TOKEN,chatId,"Welcome to AniPixel! Explore anime categories or send an anime title to search.",mainKeyboard()); return; }
  if(text.startsWith("/help")) { await sendMessage(env.BOT_TOKEN,chatId,"Use /start to open the menu, or send an anime title to search.",mainKeyboard()); return; }
  if(text&&!text.startsWith("/")) await showSearch(env,chatId,text);
}
async function handleCallback(env,callback) {
  const chatId=callback.message?.chat?.id, messageId=callback.message?.message_id, data=String(callback.data||"");
  await answerCallback(env.BOT_TOKEN,callback.id);
  if(data==="m") {
    if(messageId) { try { await deleteMessage(env.BOT_TOKEN,chatId,messageId); } catch {} }
    await sendMessage(env.BOT_TOKEN,chatId,"Choose a category:",mainKeyboard()); return;
  }
  const listMatch=data.match(/^l:(trending|popular|romance|comedy|mystery):(\d{1,2})$/);
  if(listMatch) { await showList(env,chatId,listMatch[1],Number(listMatch[2]),messageId); return; }
  const detailMatch=data.match(/^d:(\d{1,9}):([a-f0-9]{12})$/);
  if(detailMatch) {
    const state=await readState(env,detailMatch[2]);
    if(!state) { await sendMessage(env.BOT_TOKEN,chatId,"This list has expired. Use /start to open a fresh menu."); return; }
    await showDetail(env,chatId,messageId,Number(detailMatch[1]),detailMatch[2]); return;
  }
  const backMatch=data.match(/^b:([a-f0-9]{12})$/);
  if(backMatch) {
    const state=await readState(env,backMatch[1]);
    if(!state) { await sendMessage(env.BOT_TOKEN,chatId,"This list has expired. Use /start to open a fresh menu."); return; }
    if(state.category==="search") await showSearch(env,chatId,state.query||"");
    else await showList(env,chatId,state.category,state.page,messageId);
  }
}
export async function handleTelegramUpdate(env,update) {
  if(update.callback_query) { await handleCallback(env,update.callback_query); return; }
  if(update.message) await handleMessage(env,update.message);
}
