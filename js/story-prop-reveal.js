"use strict";

/* ============================================================
   이야기 소품 띄우기 (#storyPropReveal)
   ------------------------------------------------------------
   대사가 "무엇을 발견했다"고 말하기 직전에, 그 물건 한 점을 화면 가운데에
   빛무리와 함께 띄웁니다. 지금은 프롤로그의 달빛식탁 영업일지 한 점입니다.

   ------------------------------------------------------------
   [달빛 조각(#storyFragmentHandoff)과 무엇이 다른가]  ★ 핵심
   ------------------------------------------------------------
   자리도 리듬도 같아 보이지만, 일부러 다르게 둔 것이 셋입니다.

     1) 글자가 없습니다.
        조각은 "온전한 달빛 조각 / 「첫 빗방울」" 이름표를 같이 띄웁니다 —
        무엇을 받았는지가 그 장면의 내용이기 때문입니다. 소품은 바로 다음
        자막이 그것을 말해 주므로, 이름표를 달면 아이템을 획득한 것처럼
        읽혀서 이야기가 아니라 보상 연출이 됩니다.

     2) 빛이 흽니다.
        푸른빛(rgba(120,174,255,…))은 달빛 조각의 색입니다. 소품에 그대로
        쓰면 "이것도 조각인가?" 로 읽힙니다. 색은 STORY_PROP_TONES 에서
        고르고, CSS 에는 --prop-glow 로 넘깁니다.

     3) 자막보다 **먼저** 뜹니다.
        조각은 대사를 다 읽고 한 번 더 눌러야 떠오릅니다(story.js 의
        storyAdvance 조각 박자). 소품은 반대로, 떠오르는 것을 보고 나서
        그 대사를 읽어야 "눈에 들어와서" 가 성립합니다. 그래서 아래
        scheduleStoryPropReveal 이 등장 애니가 도는 동안 자막을 붙잡습니다.

   ------------------------------------------------------------
   [DOM 인 이유 · 경로 함정]
   ------------------------------------------------------------
   컷씬(story-cinematic.js)과 같습니다. 레이어 한 장을 대사 오버레이 안에
   겹치면 끝이라 Phaser 텍스처 수명을 따로 챙길 이유가 없습니다.

   ⚠️ 그림 경로는 문서(index.html) 기준으로 바꿔서 넣습니다. CSS 커스텀
      속성 안의 url() 은 그 값을 쓰는 스타일시트(css/story.css) 기준으로
      풀려서, 상대경로를 그대로 넣으면 "css/assets/…" 를 찾다가 404 가
      납니다. 그러면 빛무리만 뜨고 가운데 그림이 안 보입니다.
      (같은 함정을 --portrait-art · --fragment-art 도 밟았습니다)
   ============================================================ */

/* 소품 이름 → 그림·빛. 원본 PNG 에서 tools/build-story-prop-webp.js 가 뽑습니다.
   새 소품을 추가하면 그 스크립트의 FILES 에도 같이 넣으세요.

   [tone] 빛무리 색. 아래 STORY_PROP_TONES 의 키입니다. */
const STORY_PROPS=Object.freeze({
  businessJournalClosed:Object.freeze({
    art:"assets/Cutscene/prologue/prop_business_journal_closed_moonlight_table_v2.webp",
    tone:"white",
    why:"SCN-P04 첫 내레이션 · 카운터 위에서 발견하는 달빛식탁 영업일지"
  })
});

/* rgba() 안에 그대로 들어갈 성분 세 개입니다. 색 하나를 CSS 여러 곳
   (빛무리·테두리 광량·암전 위 물듦)에서 투명도만 바꿔 써야 해서, 완성된
   색이 아니라 성분으로 넘깁니다. */
const STORY_PROP_TONES=Object.freeze({
  white:"255,255,255",      // 영업일지 — 달빛이 스며든 흰빛
  moonlight:"151,205,255"   // 달빛 조각과 같은 푸른빛. 지금 쓰는 소품은 없습니다.
});

/* 자막을 붙잡아 두는 시간. css/story.css 의 storyPropReveal 등장 애니와
   같은 길이여야 합니다 — 짧으면 그림이 떠오르는 도중에 자막이 덮이고,
   길면 아무 일도 없는 정적이 생깁니다. 한쪽만 고치지 마세요. */
const STORY_PROP_REVEAL_MS=620;

/* {prop, timer, reveal} — 지금 떠 있는 소품과, 자막을 붙잡고 있는 타이머·할 일.
   prop 을 기억하는 이유는 같은 소품을 두 번 켜지 않기 위해서입니다. 같은 줄을
   다시 그릴 때(저장 복원 등) .show 를 뗐다 붙이면 등장 애니가 처음부터 다시
   돌아 그림이 깜빡입니다. reveal 은 기다리기 싫어 클릭했을 때 곧바로
   올려 주기 위해 들고 있습니다(아래 releaseStoryPropReveal). */
let storyPropRuntime=null;

function storyPropConfig(line){
  const config=line?.propReveal;
  if(!config||typeof config!=="object")return null;
  if(!Object.prototype.hasOwnProperty.call(STORY_PROPS,config.prop))return null;
  return STORY_PROPS[config.prop];
}

function storyPropName(line){
  const config=line?.propReveal;
  const name=config&&typeof config==="object"?config.prop:null;
  return name&&Object.prototype.hasOwnProperty.call(STORY_PROPS,name)?name:null;
}

function storyPropToneValue(tone){
  return STORY_PROP_TONES[tone]||STORY_PROP_TONES.white;
}

/* 경로를 문서 기준 절대 URL 로. story.js 에 같은 일을 하는
   resolveStoryAssetUrl 이 있지만, 이 파일은 story.js 보다 먼저 로드되므로
   있으면 쓰고 없으면 직접 풉니다(로드 순서에 기대지 않습니다). */
function storyPropArtUrl(art){
  const value=String(art||"").trim();
  if(!value)return "";
  if(typeof resolveStoryAssetUrl==="function")return resolveStoryAssetUrl(value);
  try{return new URL(value,document.baseURI).href;}
  catch{return value;}
}

/* [미리 받기]
   소품은 자막보다 먼저, 그것도 등장 애니가 도는 동안 화면 가운데를 차지합니다.
   그 순간에 그림을 요청하면 빛무리만 뜬 빈 자리가 그대로 보입니다. 그래서
   진행 중인 장면의 대사를 훑어 거기 적힌 소품만 미리 받아 둡니다.
   (범위와 Image 를 붙잡지 않는 이유는 story-cinematic.js 의 같은 이름 함수
    설명과 같습니다) */
let preloadedPropLines=null;
const preloadedPropArts=new Set();

function preloadStoryPropsForScene(){
  if(typeof Image!=="function")return;
  const session=typeof storySession!=="undefined"?storySession:null;
  const lines=session?.lines;
  if(!Array.isArray(lines)||lines===preloadedPropLines)return;
  preloadedPropLines=lines;
  for(const line of lines){
    const art=storyPropConfig(line)?.art;
    if(!art||preloadedPropArts.has(art))continue;
    preloadedPropArts.add(art);
    new Image().src=art;
  }
}

/* 이 줄의 소품을 화면에 반영합니다. 소품이 없는 줄이면 지웁니다.
   반환값은 "지금 새로 떠올랐는가" 입니다 — 이미 같은 소품이 떠 있으면
   false 라, 자막을 다시 붙잡지 않습니다. */
function applyStoryPropReveal(line){
  preloadStoryPropsForScene();
  const layer=document.getElementById("storyPropReveal");
  if(!layer)return false;
  const name=storyPropName(line);
  const prop=storyPropConfig(line);
  if(!prop){
    if(storyPropRuntime?.timer)clearTimeout(storyPropRuntime.timer);
    storyPropRuntime=null;
    layer.classList?.remove?.("show");
    layer.setAttribute?.("aria-hidden","true");
    delete layer.dataset.prop;
    layer.style?.removeProperty?.("--prop-art");
    layer.style?.removeProperty?.("--prop-glow");
    return false;
  }
  if(storyPropRuntime?.prop===name)return false;
  storyPropRuntime={prop:name,timer:storyPropRuntime?.timer||null,reveal:storyPropRuntime?.reveal||null};
  layer.dataset.prop=name;
  const art=storyPropArtUrl(prop.art);
  if(art)layer.style?.setProperty?.("--prop-art",`url(${JSON.stringify(art)})`);
  else layer.style?.removeProperty?.("--prop-art");
  layer.style?.setProperty?.("--prop-glow",storyPropToneValue(prop.tone));
  layer.classList?.add?.("show");
  layer.setAttribute?.("aria-hidden","false");
  return true;
}

/* 소품을 띄우고, 다 떠오른 뒤에 자막(reveal)을 올립니다.
   소품이 없는 줄에서는 아무것도 미루지 않고 그 자리에서 바로 부릅니다 —
   대부분의 대사가 이쪽으로 지나가므로 여기서 한 박자라도 늦으면 게임
   전체의 대사가 느려집니다. */
function scheduleStoryPropReveal(line,reveal){
  if(typeof reveal!=="function")return false;
  if(storyPropRuntime?.timer){clearTimeout(storyPropRuntime.timer);storyPropRuntime.timer=null;}
  if(storyPropRuntime)storyPropRuntime.reveal=null;
  if(!applyStoryPropReveal(line)){reveal();return false;}
  storyPropRuntime.reveal=reveal;
  storyPropRuntime.timer=setTimeout(()=>{releaseStoryPropReveal();},STORY_PROP_REVEAL_MS);
  return true;
}

/* 붙잡아 둔 자막을 지금 올립니다. 시간이 다 됐을 때도, 기다리기 싫어 클릭했을
   때도 같은 길로 지나갑니다(story.js 의 storyAdvance 가 먼저 봅니다).
   소품 자체는 그대로 떠 있습니다 — 자막과 함께 있어야 할 그림입니다. */
function releaseStoryPropReveal(){
  if(!storyPropRuntime?.timer)return false;
  clearTimeout(storyPropRuntime.timer);
  storyPropRuntime.timer=null;
  const reveal=storyPropRuntime.reveal;
  storyPropRuntime.reveal=null;
  reveal?.();
  return true;
}

/* 장면이 바뀌거나 대화가 끝날 때. 여기서 reveal 을 부르면 안 됩니다 —
   이미 사라진 대사의 자막을 다음 장면 위에 타이핑하게 됩니다. */
function clearStoryPropReveal(){
  if(storyPropRuntime?.timer)clearTimeout(storyPropRuntime.timer);
  if(storyPropRuntime)storyPropRuntime.reveal=null;
  storyPropRuntime=null;
  const layer=document.getElementById("storyPropReveal");
  if(!layer)return;
  layer.classList?.remove?.("show");
  layer.setAttribute?.("aria-hidden","true");
  delete layer.dataset.prop;
  layer.style?.removeProperty?.("--prop-art");
  layer.style?.removeProperty?.("--prop-glow");
}
