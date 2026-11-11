const API_URL="https://graphql.anilist.co", REQUEST_TIMEOUT_MS=10_000;
const LIST_FIELDS=`
 fragment ListFields on Media {
  id type title { romaji english } coverImage { extraLarge large } status genres averageScore
 }
`;
const DETAIL_FIELDS=`
 fragment DetailFields on Media {
  id type title { romaji english native } description(asHtml:false) format status episodes chapters volumes
  countryOfOrigin source averageScore popularity favourites startDate { year month day } endDate { year month day }
  coverImage { extraLarge color } bannerImage genres synonyms tags { name rank } trailer { id site thumbnail }
  relations { edges { relationType node { id type title { romaji english } coverImage { extraLarge large } status genres } } }
  characters(sort:[ROLE,RELEVANCE],perPage:15) { edges { role node { id name { full } image { large } } } }
  staff(sort:[RELEVANCE,ROLE],perPage:10) { edges { role node { id name { full } image { large } } } }
  studios(isMain:true) { nodes { name isAnimationStudio } } rankings { rank type allTime context }
  stats { statusDistribution { status amount } } siteUrl nextAiringEpisode { episode airingAt timeUntilAiring }
 }
`;
const HOME_QUERY=`
 query Home($season:MediaSeason,$seasonYear:Int) {
  airingNow:Page(page:1,perPage:15) { media(sort:POPULARITY_DESC,type:ANIME,isAdult:false,status:RELEASING) { ...ListFields } }
  season:Page(page:1,perPage:15) { media(sort:POPULARITY_DESC,type:ANIME,isAdult:false,season:$season,seasonYear:$seasonYear) { ...ListFields } }
  topRated:Page(page:1,perPage:15) { media(sort:SCORE_DESC,type:ANIME,isAdult:false) { ...ListFields } }
  romance:Page(page:1,perPage:15) { media(sort:SCORE_DESC,type:ANIME,genre:"Romance",isAdult:false) { ...ListFields } }
  comedy:Page(page:1,perPage:15) { media(sort:SCORE_DESC,type:ANIME,genre:"Comedy",isAdult:false) { ...ListFields } }
  mystery:Page(page:1,perPage:15) { media(sort:SCORE_DESC,type:ANIME,genre:"Mystery",isAdult:false) { ...ListFields } }
 } ${LIST_FIELDS}
`;
const SEARCH_QUERY=`
 query Search($search:String!,$page:Int!,$type:MediaType!) {
  Page(page:$page,perPage:18) { pageInfo { currentPage hasNextPage } media(search:$search,type:$type,isAdult:false,sort:SEARCH_MATCH) { ...ListFields } }
 } ${LIST_FIELDS}
`;
const LIST_QUERY=`
 query MediaList($page:Int!,$sort:[MediaSort],$genre:String) {
  Page(page:$page,perPage:5) { pageInfo { currentPage hasNextPage } media(sort:$sort,type:ANIME,genre:$genre,isAdult:false) { ...ListFields } }
 } ${LIST_FIELDS}
`;
const DETAIL_QUERY=`
 query MediaDetail($id:Int!,$type:MediaType!) { Media(id:$id,type:$type) { ...DetailFields } }
 ${DETAIL_FIELDS}
`;
async function requestAniList(query,variables={}) {
 const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
 try {
  const response=await fetch(API_URL,{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({query,variables}),signal:controller.signal});
  if(!response.ok) throw new Error(`AniList returned HTTP ${response.status}`);
  const payload=await response.json(); if(payload.errors?.length) throw new Error(payload.errors[0]?.message||"AniList GraphQL error");
  return payload.data;
 } finally { clearTimeout(timeout); }
}
function getSeason(date=new Date()) {
 const month=date.getUTCMonth()+1; if(month<=3) return "WINTER"; if(month<=6) return "SPRING"; if(month<=9) return "SUMMER"; return "FALL";
}
export async function getHome() {
 const now=new Date(), data=await requestAniList(HOME_QUERY,{season:getSeason(now),seasonYear:now.getUTCFullYear()});
 return {airingNow:data.airingNow.media,season:data.season.media,topRated:data.topRated.media,romance:data.romance.media,comedy:data.comedy.media,mystery:data.mystery.media};
}
export async function searchMedia(search,type="ANIME",page=1) {
 const term=String(search||"").trim().slice(0,80); if(term.length<2) return {media:[],pageInfo:{hasNextPage:false}};
 const mediaType=type==="MANGA"?"MANGA":"ANIME", safePage=Math.min(50,Math.max(1,Number(page)||1));
 return (await requestAniList(SEARCH_QUERY,{search:term,page:safePage,type:mediaType})).Page;
}
const LISTS={trending:{sort:["TRENDING_DESC"]},popular:{sort:["POPULARITY_DESC"]},romance:{sort:["SCORE_DESC"],genre:"Romance"},comedy:{sort:["SCORE_DESC"],genre:"Comedy"},mystery:{sort:["SCORE_DESC"],genre:"Mystery"}};
export async function getList(category,page=1) {
 const definition=LISTS[category]; if(!definition) throw new Error("Unknown list category");
 const safePage=Math.min(50,Math.max(1,Number(page)||1));
 return (await requestAniList(LIST_QUERY,{page:safePage,sort:definition.sort,genre:definition.genre??null})).Page;
}
export async function getMedia(id,type="ANIME") {
 const mediaId=Number(id); if(!Number.isSafeInteger(mediaId)||mediaId<1) throw new Error("Invalid media ID");
 const mediaType=type==="MANGA"?"MANGA":"ANIME";
 return (await requestAniList(DETAIL_QUERY,{id:mediaId,type:mediaType})).Media;
}
export function titleOf(media) { return media?.title?.english||media?.title?.romaji||"Untitled"; }
