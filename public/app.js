const $ = (selector) => document.querySelector(selector);
const state = { home:null, search:null, previousView:"home", returnView:"home", countdownTimer:null };
const telegram = window.Telegram?.WebApp;
telegram?.ready(); telegram?.expand();
function escapeHTML(value="") { return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char])); }
function safeUrl(value) { try { const url=new URL(value); return ["https:","http:"].includes(url.protocol)?url.href:""; } catch { return ""; } }
function titleOf(media) { return media?.title?.english||media?.title?.romaji||"Untitled"; }
async function api(path) {
 const response=await fetch(path,{headers:{accept:"application/json"}}), payload=await response.json();
 if(!response.ok) throw new Error(payload.error||`Request failed (${response.status})`); return payload;
}
function show(view) { for(const id of ["loading","home-view","detail-view","error-view"]) $(`#${id}`).classList.toggle("hidden",id!==view); }
function posterCard(media) {
 const image=safeUrl(media.coverImage?.extraLarge||media.coverImage?.large), title=escapeHTML(titleOf(media));
 const genres=escapeHTML((media.genres||[]).slice(0,2).join(" · "));
 return `<article class="poster-card" data-media-id="${Number(media.id)}" data-media-type="${media.type==="MANGA"?"MANGA":"ANIME"}" tabindex="0" role="button" aria-label="Open ${title}">
 <img src="${image}" alt="${title}" loading="lazy"><div class="poster-meta"><div class="poster-title">${title}</div><div class="poster-subtitle">${genres||(media.averageScore?`${media.averageScore}% score`:"Explore title")}</div></div></article>`;
}
function renderCollection(id,title,items) {
 if(!items?.length) return "";
 return `<section class="section"><div class="section-heading"><div><p class="eyebrow">CURATED FOR YOU</p><h2>${title}</h2></div><span class="muted">${items.length} titles</span></div><div class="poster-row">${items.map(posterCard).join("")}</div></section>`;
}
async function loadHome() {
 show("loading");
 try {
  state.home=await api("/api/home");
  $("#collections").innerHTML=[
   renderCollection("airing","Airing now",state.home.airingNow),
   renderCollection("season","Popular this season",state.home.season),
   renderCollection("top","Top rated",state.home.topRated),
   renderCollection("romance","Romance",state.home.romance),
   renderCollection("comedy","Comedy",state.home.comedy),
   renderCollection("mystery","Mystery",state.home.mystery)
  ].join("");
  $("#search-results").classList.add("hidden"); show("home-view"); state.previousView="home";
 } catch(error) { showError(error); }
}
function showError(error) { $("#error-message").textContent=error.message||"Please try again."; show("error-view"); }
async function runSearch(term,type) {
 const query=term.trim(); if(query.length<2) return; show("loading");
 try {
  const result=await api(`/api/search?q=${encodeURIComponent(query)}&type=${type}`);
  $("#search-grid").innerHTML=result.media?.length?result.media.map(posterCard).join(""):'<p class="empty-state">No titles found. Try another search.</p>';
  $("#search-count").textContent=`${result.media?.length||0} results`;
  $("#search-results").classList.remove("hidden"); $("#collections").classList.add("hidden"); show("home-view"); state.previousView="search";
  window.scrollTo({top:0,behavior:"smooth"});
 } catch(error) { showError(error); }
}
function personCard(edge) {
 const person=edge.node,image=safeUrl(person.image?.large);
 return `<article class="person-card"><img src="${image}" alt="${escapeHTML(person.name?.full||"Person")}" loading="lazy"><div><strong>${escapeHTML(person.name?.full||"Unknown")}</strong><span>${escapeHTML(edge.role||"")}</span></div></article>`;
}
function mediaCard(media) { return posterCard(media); }
function countdownText(timestamp) {
 const seconds=Math.max(0,timestamp-Math.floor(Date.now()/1000)),days=Math.floor(seconds/86400),hours=Math.floor((seconds%86400)/3600),minutes=Math.floor((seconds%3600)/60),remaining=seconds%60;
 return `${days}d ${hours}h ${minutes}m ${remaining}s`;
}
function renderDetail(media) {
 if(state.countdownTimer) clearInterval(state.countdownTimer);
 const title=escapeHTML(titleOf(media)),image=safeUrl(media.coverImage?.extraLarge);
 const genres=(media.genres||[]).map(g=>`<span class="pill">${escapeHTML(g)}</span>`).join("");
 const tags=(media.tags||[]).slice(0,10).map(tag=>`<span class="pill">${escapeHTML(tag.name)}</span>`).join("");
 const score=media.averageScore?`${media.averageScore}%`:"N/A",total=media.type==="ANIME"?media.episodes:media.chapters,totalLabel=media.type==="ANIME"?"Episodes":"Chapters";
 const studio=media.studios?.nodes?.find(item=>item.isAnimationStudio)?.name||"—",next=media.nextAiringEpisode?.airingAt;
 const description=escapeHTML(media.description||"No description available.").replace(/\n/g,"<br>");
 const relations=(media.relations?.edges||[]).filter(edge=>["ANIME","MANGA"].includes(edge.node.type));
 const trailerId=media.trailer?.site==="youtube"?String(media.trailer.id||"").replace(/[^a-zA-Z0-9_-]/g,""):"";
 const trailer=trailerId?`<iframe class="trailer" src="https://www.youtube-nocookie.com/embed/${trailerId}" title="Official trailer" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`:"";
 $("#detail-view").innerHTML=`
 <button id="back-button" class="back-button" type="button">← Back</button>
 <section class="detail-hero"><img class="detail-cover" src="${image}" alt="${title}"><div>
 <p class="eyebrow">${escapeHTML(media.type)} · ${escapeHTML(media.format||"TITLE")}</p><h1 class="detail-title">${title}</h1><div class="pills">${genres}</div>
 <div class="stat-grid"><div class="stat"><strong>${score}</strong><span>Average score</span></div><div class="stat"><strong>${escapeHTML(media.status||"—")}</strong><span>Status</span></div><div class="stat"><strong>${escapeHTML(total??"—")}</strong><span>${totalLabel}</span></div><div class="stat"><strong>${Number(media.popularity||0).toLocaleString()}</strong><span>Popularity</span></div></div>
 <p class="detail-description">${description}</p><div class="pills">${tags}</div><p class="muted">Studio: ${escapeHTML(studio)} · Source: ${escapeHTML(media.source||"—")}</p>
 <a class="primary-button" href="${safeUrl(media.siteUrl)}" target="_blank" rel="noopener noreferrer">Open on AniList ↗</a></div></section>
 ${next?`<section class="detail-section"><h2>Next episode</h2><div class="stat"><strong id="countdown">—</strong><span>Episode ${Number(media.nextAiringEpisode.episode)}</span></div></section>`:""}
 ${trailer?`<section class="detail-section"><h2>Trailer</h2>${trailer}</section>`:""}
 <section class="detail-section"><h2>Characters</h2><div class="people-row">${(media.characters?.edges||[]).map(personCard).join("")||'<p class="empty-state">No character data.</p>'}</div></section>
 <section class="detail-section"><h2>Staff</h2><div class="people-row">${(media.staff?.edges||[]).map(personCard).join("")||'<p class="empty-state">No staff data.</p>'}</div></section>
 <section class="detail-section"><h2>Related titles</h2><div class="poster-row">${relations.map(edge=>mediaCard(edge.node)).join("")||'<p class="empty-state">No related titles.</p>'}</div></section>`;
 $("#back-button").addEventListener("click",goBack);
 if(next) { const update=()=>{const node=$("#countdown");if(node)node.textContent=countdownText(next);};update();state.countdownTimer=setInterval(update,1000); }
 show("detail-view");window.scrollTo({top:0,behavior:"smooth"});telegram?.BackButton?.show();
}
async function openMedia(id,type) {
 state.returnView=state.previousView;show("loading");
 try { renderDetail(await api(`/api/media/${type}/${id}`)); } catch(error) { showError(error); }
}
function goBack() {
 if(state.countdownTimer)clearInterval(state.countdownTimer);telegram?.BackButton?.hide();
 if(state.returnView==="search") { show("home-view");$("#search-results").classList.remove("hidden");$("#collections").classList.add("hidden"); }
 else { show("home-view");$("#search-results").classList.add("hidden");$("#collections").classList.remove("hidden"); }
}
$("#search-form").addEventListener("submit",event=>{event.preventDefault();runSearch($("#search-input").value,$("#search-type").value);});
$("#home-button").addEventListener("click",()=>{$("#collections").classList.remove("hidden");loadHome();});
$("#retry-button").addEventListener("click",loadHome);
document.addEventListener("click",event=>{const card=event.target.closest("[data-media-id]");if(card)openMedia(card.dataset.mediaId,card.dataset.mediaType);});
document.addEventListener("keydown",event=>{if((event.key==="Enter"||event.key===" ")&&event.target.matches("[data-media-id]")){event.preventDefault();openMedia(event.target.dataset.mediaId,event.target.dataset.mediaType);}});
telegram?.BackButton?.onClick(goBack);
const deepLinkId=new URLSearchParams(location.search).get("animeId");
if(deepLinkId&&/^\d{1,9}$/.test(deepLinkId))openMedia(deepLinkId,"ANIME");else loadHome();
