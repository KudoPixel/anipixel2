import { getHome, getMedia, searchMedia } from "./anilist.js";
import { handleTelegramUpdate } from "./bot.js";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
function json(data, status=200, headers={}) { return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } }); }
function log(level,message,requestId,extra={}) {
  console[level==="error"?"error":"log"](JSON.stringify({level,message,requestId,timestamp:new Date().toISOString(),...extra}));
}
function secureEqual(left,right) {
  if(typeof left!=="string"||typeof right!=="string") return false;
  const a=new TextEncoder().encode(left), b=new TextEncoder().encode(right);
  if(a.length!==b.length) return false;
  let difference=0; for(let i=0;i<a.length;i++) difference|=a[i]^b[i]; return difference===0;
}
async function readJson(request,maxBytes=1024*1024) {
  const length=Number(request.headers.get("content-length")||0);
  if(length>maxBytes) throw new Error("Request body too large");
  const body=await request.text();
  if(new TextEncoder().encode(body).length>maxBytes) throw new Error("Request body too large");
  return JSON.parse(body);
}
async function apiRouter(request) {
  const url=new URL(request.url);
  if(request.method==="GET"&&url.pathname==="/api/home") return json(await getHome(),200,{"cache-control":"public, max-age=60, s-maxage=120"});
  if(request.method==="GET"&&url.pathname==="/api/search") {
    const query=url.searchParams.get("q")||"", type=url.searchParams.get("type")||"ANIME", page=Number(url.searchParams.get("page")||1);
    if(query.trim().length<2) return json({error:"Search query must contain at least two characters."},400);
    return json(await searchMedia(query,type,page));
  }
  const match=url.pathname.match(/^\/api\/media\/(ANIME|MANGA)\/(\d{1,9})$/);
  if(request.method==="GET"&&match) {
    const media=await getMedia(match[2],match[1]); if(!media) return json({error:"Media not found."},404);
    return json(media,200,{"cache-control":"public, max-age=120, s-maxage=300"});
  }
  return json({error:"Not found."},404);
}
async function handleWebhook(request,env,requestId) {
  const supplied=request.headers.get("x-telegram-bot-api-secret-token")||"";
  if(!env.WEBHOOK_SECRET||!secureEqual(supplied,env.WEBHOOK_SECRET)) { log("warn","Rejected Telegram webhook request",requestId); return new Response("Unauthorized",{status:401}); }
  await handleTelegramUpdate(env,await readJson(request,256*1024)); return new Response("OK");
}
async function handleRequest(request,env) {
  const requestId=crypto.randomUUID(), url=new URL(request.url);
  try {
    if(request.method==="GET"&&url.pathname==="/health") return json({status:"ok",service:"anipixel2"});
    if(url.pathname==="/telegram/webhook"&&request.method==="POST") return await handleWebhook(request,env,requestId);
    if(url.pathname.startsWith("/api/")) return await apiRouter(request);
    return env.ASSETS.fetch(request);
  } catch(error) {
    log("error","Request failed",requestId,{path:url.pathname,method:request.method,error:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack:undefined});
    const status=error?.message==="Request body too large"?413:500;
    return json({error:status===413?"Payload too large.":"Internal server error.",requestId},status);
  }
}
export default { fetch(request,env,ctx) { return handleRequest(request,env,ctx); } };
