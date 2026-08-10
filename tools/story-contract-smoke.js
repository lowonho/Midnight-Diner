"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const files = ["js/game-data.js", "js/story-data.js", "js/story.js"];
const sources = files.map(file => fs.readFileSync(path.join(root, file), "utf8"));
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const storyCssSource = fs.readFileSync(path.join(root, "css", "story.css"), "utf8");
const gameSource = fs.readFileSync(path.join(root, "js/game.js"), "utf8");
const titleSource = fs.readFileSync(path.join(root, "js/title.js"), "utf8");
const qaSource = fs.readFileSync(path.join(root, "js/qa-mode.js"), "utf8");

if(!titleSource.includes("function openGameplayJournalPage(pageId)")
  ||!titleSource.includes('journalLastGameplayPageId=String(pageId||"")')){
  throw new Error("영업 마감 일지는 현재 날짜 페이지를 지정해서 열 수 있어야 합니다.");
}

[
  "assets/bgm/story/bgm_company_story.mp3",
  "assets/bgm/story/bgm_in_first_sikdang.mp3",
  "assets/sfx/story/sfx_rain.MP3",
  "assets/sfx/story/sfx_open_door.MP3",
  "assets/sfx/ui/sfx_next_book.MP3",
  ...Array.from({length:7},(_,index)=>`assets/sfx/story/fragments/sfx_d${index+1}_finish.MP3`),
  "assets/sfx/story/fragments/sfx_half_piece.MP3",
  "assets/sfx/story/fragments/sfx_story_daeun_ribbon_handoff.MP3",
  "assets/sfx/story/guests/sfx_story_d1_raindrop_arrival_leveled.MP3",
  "assets/sfx/story/guests/sfx_story_d2_lantern_arrival_leveled.MP3",
  "assets/sfx/story/guests/sfx_story_d3_twin_shadow_arrival.MP3",
  "assets/sfx/story/guests/sfx_story_d4_crow_letter_arrival_leveled.MP3",
  "assets/sfx/story/guests/sfx_story_d5_star_beast_arrival_leveled.MP3",
  "assets/sfx/story/guests/sfx_story_d6_seawater_arrival_leveled.MP3",
  "assets/sfx/story/guests/sfx_story_d7_clock_444_arrival_leveled.MP3"
].forEach(asset=>{
  if(!fs.existsSync(path.join(root,...asset.split("/"))))throw new Error(`스토리 음원 누락: ${asset}`);
});
if(!gameSource.includes('storyCompany:"assets/bgm/story/bgm_company_story.mp3"')
  ||!gameSource.includes('storySikdang:"assets/bgm/story/bgm_in_first_sikdang.mp3"')
  ||!gameSource.includes('storyFacelessDaeun:"assets/bgm/story/bgm_story_faceless_daeun.MP3"')
  ||!gameSource.includes('story_rain:["assets/sfx/story/sfx_rain.MP3"]')
  ||!gameSource.includes('story_open_door:["assets/sfx/story/sfx_open_door_leveled.MP3"]')
  ||!gameSource.includes('journal_page_turn:["assets/sfx/ui/sfx_next_book_leveled.MP3"]')
  ||!gameSource.includes('fragment_partial:["assets/sfx/story/fragments/sfx_half_piece.MP3"]')
  ||!gameSource.includes('daeun_ribbon_handoff:["assets/sfx/story/fragments/sfx_story_daeun_ribbon_handoff.MP3"]')
  ||!Array.from({length:7},(_,index)=>index+1).every(day=>
    gameSource.includes(`fragment_full_d${day}:["assets/sfx/story/fragments/sfx_d${day}_finish.MP3"]`)
  )){
  throw new Error("스토리·영업일지 음원은 BGM/SFX 레지스트리에 등록되어야 합니다.");
}
if(!titleSource.includes('openGameScreen();queueStoryMoments(["newGame","dayStart"]);')
  ||!titleSource.includes("audio.startBgm();")){
  throw new Error("새 게임은 프롤로그 BGM을 선택한 뒤 재생을 시작해야 합니다.");
}
if(!titleSource.includes('if(changed)audio?.play?.("journal_page_turn",{gain:.9});')){
  throw new Error("영업일지 페이지가 실제로 바뀔 때 책장 넘김 효과음을 재생해야 합니다.");
}

[
  "endingRetryOverlay",
  "endingRetryTitle",
  "endingRetryDescription",
  "endingRetrySpeaker",
  "endingRetryBranchButton",
  "endingAcceptButton"
].forEach(id=>{
  if(!indexSource.includes(`id="${id}"`))throw new Error(`엔딩 후 선택 UI 누락: ${id}`);
});
if(!storyCssSource.includes(".ending-retry-window")||!storyCssSource.includes(".ending-retry-actions")){
  throw new Error("엔딩 후 선택 UI 스타일이 story.css에 있어야 합니다.");
}
if(!indexSource.includes('class="ending-retry-speaker">김다은</p>')
  ||!indexSource.includes("그때, 나는 다른 선택을 할 수도 있지 않았을까?")
  ||!indexSource.includes("다른 선택을 해 본다")
  ||!indexSource.includes("이 선택을 받아들인다")
  ||indexSource.includes("ENDING RECORDED")
  ||indexSource.includes("엔딩 기록 완료")){
  throw new Error("엔딩 후 질문은 시스템 알림이 아니라 김다은의 대사와 두 선택지로 보여야 합니다.");
}
if(sources[1].includes('storyCaption("김다은(속말)"')){
  throw new Error("새 대본에는 김다은 속말 자막이 아니라 주인공의 일반 대사를 사용해야 합니다.");
}
if(!indexSource.includes('id="storyEndingBackground"')
  ||!storyCssSource.includes(".story-ending-background")
  ||!storyCssSource.includes("background-size: cover")
  ||!storyCssSource.includes(".story-overlay.story-ending-active .story-stage")){
  throw new Error("엔딩 일러스트 배경 레이어와 배우 무대 숨김 스타일이 필요합니다.");
}
if(!indexSource.includes('id="storyFragmentHandoff"')
  ||!indexSource.includes('id="storyFragmentKicker"')
  ||!indexSource.includes('id="storyFragmentName"')
  ||!indexSource.includes('class="story-fragment-art"')
  ||!storyCssSource.includes(".story-fragment-handoff")
  ||!storyCssSource.includes(".story-fragment-handoff.show .story-fragment-focus")){
  throw new Error("부분·완전 달빛 조각의 암전·중앙 에셋 전달 레이어가 필요합니다.");
}
const fragmentAssetPaths=[...sources[1].matchAll(/\b\w+:\s*"(assets\/customer\/Special\/MoonPiece\/[^"]+\.webp)"/g)]
  .map(match=>match[1]);
if(fragmentAssetPaths.length!==8
  ||fragmentAssetPaths.some(asset=>!fs.existsSync(path.join(root,...asset.split("/"))))){
  throw new Error("특별 손님 8명의 완전한 달빛 조각 에셋이 모두 존재해야 합니다.");
}
const partialFragmentAssetPaths=[...sources[1].matchAll(/\b\w+:\s*"(assets\/customer\/Special\/MoonPiece\/g[1-7]_[^"]+\.png)"/g)]
  .map(match=>match[1]);
if(partialFragmentAssetPaths.length!==7
  ||new Set(partialFragmentAssetPaths).size!==7
  ||partialFragmentAssetPaths.some(asset=>!fs.existsSync(path.join(root,...asset.split("/"))))){
  throw new Error("기본 특별 손님 7명의 부분 달빛 조각 에셋이 모두 존재해야 합니다.");
}
const endingAssetPaths=[...sources[1].matchAll(/endingBackground:\s*"(assets\/story\/bg\/[^"]+\.png)"/g)]
  .map(match=>match[1]);
if(endingAssetPaths.length!==5
  ||new Set(endingAssetPaths).size!==5
  ||endingAssetPaths.some(asset=>!fs.existsSync(path.join(root,...asset.split("/"))))){
  throw new Error("다섯 엔딩 장면은 서로 다른 실제 배경 파일을 사용해야 합니다.");
}
if(!qaSource.includes("storySession.playedFragmentSfx={};")){
  throw new Error("QA에서 조각 전달 대사를 다시 열 때 획득음도 다시 재생할 수 있어야 합니다.");
}
const endingBgmPaths=[...gameSource.matchAll(/\bending\w+:\s*"(assets\/bgm\/story\/ending\/[^"]+\.MP3)"/g)]
  .map(match=>match[1]);
if(endingBgmPaths.length!==5
  ||new Set(endingBgmPaths).size!==5
  ||endingBgmPaths.some(asset=>!fs.existsSync(path.join(root,...asset.split("/"))))){
  throw new Error("다섯 엔딩 BGM은 서로 다른 실제 MP3 파일을 사용해야 합니다.");
}

const bootstrap = `
var state={story:null,day:1,phase:"day",screen:"game",player:{x:0,y:0,facing:"down",moving:false}};
const playedAudio=[];
const audio={
  play(name,options){
    const listeners={};
    const element={
      ended:false,
      addEventListener(type,callback){(listeners[type]||(listeners[type]=[])).push(callback);},
      dispatch(type){(listeners[type]||[]).splice(0).forEach(callback=>callback());}
    };
    const entry={name,options,element,playbackPromise:null};
    playedAudio.push(entry);
    return entry;
  },
  stopFile(){},
  fadeOutFile(){return true;},
  setStoryBgm(){}
};
const window={QA_MODE:null,addEventListener(){},matchMedia(){return {matches:false};}};
const document={
  baseURI:"file:///C:/Midnight%20Diner/index.html",
  addEventListener(){},
  getElementById(){return null;}
};
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function updateUI(){}
function saveGame(){}
function showToast(){}
function stationById(){return null;}
function startMini(){}
function resetDay(){}
function resetStoryStage(){}
function clearStoryCinematic(){}
function applyStoryCinematic(){return false;}
var openedGameplayJournalPage=null;
function openGameplayJournalPage(pageId){openedGameplayJournalPage=pageId;return true;}
`;

const test = `
const DISHES=MENU_DATA.map(menu=>({
  ...menu,
  name:menu.displayName,
  prepTasks:[...menu.requiredPrepTasks],
  cook:[...(menu.cook||[])]
}));
function dishById(id){return DISHES.find(dish=>dish.id===id)||null;}
function dishPreparedForService(id){return state.selectedMenus?.includes(id);}

const assert=(condition,message)=>{
  if(!condition)throw new Error(message);
};

/* 조각 전달 레이어는 줄이 바뀔 때마다 다시 정해져야 합니다. showStoryLine 이
   매 줄 applyStoryFragmentHandoff 를 부르고, 켤지 말지는 fragmentRevealedAt
   으로 판단합니다(대사를 읽고 한 번 더 눌러야 뜹니다). */
assert(String(showStoryLine).includes("applyStoryFragmentHandoff(")
  &&String(showStoryLine).includes("fragmentRevealedAt")
  &&String(resetStoryStage).includes("applyStoryFragmentHandoff(null)")
  &&String(clearStoryRuntime).includes("applyStoryFragmentHandoff(null)"),
  "조각 전달 레이어는 다음 줄·다음 장면·런타임 종료에서 반드시 해제되어야 합니다.");
assert(String(storyAdvance).includes("fragmentRevealedAt")
  &&String(storyAdvance).includes('fragmentHandoff?.state==="partial"')
  &&String(storyAdvance).includes('fragmentHandoff?.state==="full"'),
  "부분·완전 달빛 조각은 대사를 다 읽고 한 번 더 눌렀을 때 떠야 합니다(storyAdvance 의 조각 박자).");
assert(String(showStoryLine).includes("applyStoryEndingBackground(scene)")
  &&String(resetStoryStage).includes("applyStoryEndingBackground(null)")
  &&String(clearStoryRuntime).includes("applyStoryEndingBackground(null)"),
  "엔딩 배경은 장면 재생 경로에서 적용되고 장면·런타임 종료에서 해제되어야 합니다.");
assert(String(applyStoryFragmentHandoff).includes('handoff?.state==="partial"')
  &&String(applyStoryFragmentHandoff).includes('handoff?.state==="full"')
  &&String(applyStoryFragmentHandoff).includes('document.getElementById("storyFragmentKicker")')
  &&String(applyStoryFragmentHandoff).includes('document.getElementById("storyFragmentName")')
  &&String(applyStoryFragmentHandoff).includes('layer.classList?.toggle("show",showFragment)'),
  "중앙 조각 연출은 부분·완전 조각을 구분해 열고 조각 이름을 함께 표시해야 합니다.");
const same=(actual,expected,message)=>{
  assert(JSON.stringify(actual)===JSON.stringify(expected),
    message+"\\nactual: "+JSON.stringify(actual)+"\\nexpected: "+JSON.stringify(expected));
};

const expectedEndingBackgrounds={
  "SCN-J01":"assets/story/bg/01_loop_daeun_reenters_restaurant_entrance_v3.png",
  "END-01":"assets/story/bg/02_morning_alone_loop_restaurant_unified_v7.png",
  "END-02":"assets/story/bg/03_guests_dawn_loop_restaurant_unified_v2.png",
  "END-03":"assets/story/bg/04_eternally_open_trapped_balanced_texture_v9.png",
  "END-04":"assets/story/bg/05_morning_together_restaurant_unified_v2.png"
};
same(Object.fromEntries(Object.keys(expectedEndingBackgrounds).map(id=>[id,STORY_SCENES[id].endingBackground])),
  expectedEndingBackgrounds,"다섯 엔딩 장면별 배경 에셋 매핑");
assert(new Set(Object.values(expectedEndingBackgrounds)).size===5,
  "다섯 엔딩 배경은 서로 다른 파일을 사용해야 합니다.");

const endingLayerClasses=new Set();
const endingOverlayClasses=new Set();
const endingLayerStyles={};
const endingLayerAttributes={};
const endingLayer={
  dataset:{},
  classList:{toggle(name,enabled){enabled?endingLayerClasses.add(name):endingLayerClasses.delete(name);}},
  style:{
    setProperty(name,value){endingLayerStyles[name]=value;},
    removeProperty(name){delete endingLayerStyles[name];}
  },
  setAttribute(name,value){endingLayerAttributes[name]=value;}
};
const endingOverlay={
  classList:{toggle(name,enabled){enabled?endingOverlayClasses.add(name):endingOverlayClasses.delete(name);}}
};
const originalGetElementById=document.getElementById;
document.getElementById=id=>id==="storyEndingBackground"?endingLayer:id==="storyOverlay"?endingOverlay:null;
assert(applyStoryEndingBackground(STORY_SCENES["END-01"])
  &&endingLayerClasses.has("show")
  &&endingOverlayClasses.has("story-ending-active")
  &&endingLayer.dataset.sceneId==="END-01"
  &&endingLayerStyles["--story-ending-art"].includes("file:///C:/Midnight%20Diner/assets/story/bg/")
  &&!endingLayerStyles["--story-ending-art"].includes("/css/assets/")
  &&endingLayerAttributes["aria-hidden"]==="false",
  "엔딩 진입 시 해당 일러스트와 배경 전용 상태를 표시해야 합니다.");
assert(applyStoryEndingBackground(STORY_SCENES["SCN-EPI01"])
  &&endingLayerClasses.has("show")
  &&endingOverlayClasses.has("story-ending-active")
  &&endingLayer.dataset.sceneId==="SCN-EPI01"
  &&endingLayerStyles["--story-ending-art"].includes("05_morning_together_restaurant_unified_v2.png")
  &&endingLayerAttributes["aria-hidden"]==="false",
  "비가 그친 아침 후일담은 함께 오는 아침 엔딩 일러스트를 이어서 표시해야 합니다.");
assert(!applyStoryEndingBackground(null)
  &&!endingLayerClasses.has("show")
  &&!endingOverlayClasses.has("story-ending-active")
  &&!("sceneId" in endingLayer.dataset)
  &&!("--story-ending-art" in endingLayerStyles)
  &&endingLayerAttributes["aria-hidden"]==="true",
  "엔딩 종료 시 일러스트와 배경 전용 상태를 완전히 해제해야 합니다.");
document.getElementById=originalGetElementById;

const fragmentLayerClasses=new Set();
const fragmentLayerStyles={};
const fragmentLayer={
  dataset:{},
  classList:{
    toggle(name,enabled){enabled?fragmentLayerClasses.add(name):fragmentLayerClasses.delete(name);},
    remove(name){fragmentLayerClasses.delete(name);}
  },
  style:{
    setProperty(name,value){fragmentLayerStyles[name]=value;},
    removeProperty(name){delete fragmentLayerStyles[name];}
  },
  setAttribute(){}
};
const fragmentName={textContent:""};
const fragmentKicker={textContent:""};
const fragmentNextButton={disabled:false,attributes:{},setAttribute(name,value){this.attributes[name]=value;}};
const fragmentSkipButton={disabled:false,attributes:{},setAttribute(name,value){this.attributes[name]=value;}};
document.getElementById=id=>id==="storyFragmentHandoff"?fragmentLayer
  :id==="storyFragmentKicker"?fragmentKicker
  :id==="storyFragmentName"?fragmentName
  :id==="storyNextButton"?fragmentNextButton
  :id==="storySkipButton"?fragmentSkipButton:null;
const partialFragmentLine=STORY_SCENES["SCN-G1-맛있다"].lines.find(line=>line.fragmentHandoff);
const fullFragmentLine=STORY_SCENES["SCN-G1-완벽"].lines.find(line=>line.fragmentHandoff);
const storyBeforeFragmentSfx=state.story;
state.story=createStoryState();
const guestAmbientEntry={name:"story_guest_d1_arrival"};
storySession={
  scene:STORY_SCENES["SCN-G1-맛있다"],
  playedFragmentSfx:{},
  ambientAudio:guestAmbientEntry
};
const audioCountBeforePartial=playedAudio.length;
const fragmentSfxGain=1.6*10**(5/20);
assert(applyStoryFragmentHandoff(partialFragmentLine)
  &&fragmentLayerClasses.has("show")
  &&fragmentLayerClasses.has("has-art")
  &&fragmentLayer.dataset.fragmentState==="partial"
  &&fragmentKicker.textContent==="부분 달빛 조각"
  &&fragmentLayerStyles["--fragment-art"].includes("/MoonPiece/g1_rain_drop_fragment.png")
  &&playedAudio.length===audioCountBeforePartial+1
  &&playedAudio.at(-1)?.name==="fragment_partial"
  &&playedAudio.at(-1)?.options?.gain===fragmentSfxGain,
  "맛있다 결과의 부분 조각 전달 순간에는 반쪽 조각 전용 효과음을 한 번 재생해야 합니다.");
const partialFragmentEntry=playedAudio.at(-1);
assert(storyFragmentSfxLockIsActive()&&fragmentNextButton.disabled&&fragmentSkipButton.disabled,
  "반쪽 조각 효과음이 재생되는 동안 다음 진행 입력을 잠가야 합니다.");
partialFragmentEntry.element.dispatch("ended");
assert(!storyFragmentSfxLockIsActive()&&!fragmentNextButton.disabled&&!fragmentSkipButton.disabled,
  "반쪽 조각 효과음이 끝나면 다음 진행 입력을 다시 열어야 합니다.");
storySession={
  scene:STORY_SCENES["SCN-G1-완벽"],
  playedFragmentSfx:{},
  ambientAudio:guestAmbientEntry
};
assert(applyStoryFragmentHandoff(fullFragmentLine)
  &&fragmentLayerClasses.has("show")
  &&fragmentLayerClasses.has("has-art")
  &&fragmentLayer.dataset.fragmentState==="full"
  &&fragmentKicker.textContent==="온전한 달빛 조각"
  &&fragmentLayerStyles["--fragment-art"].includes("file:///C:/Midnight%20Diner/assets/customer/Special/MoonPiece/")
  &&!fragmentLayerStyles["--fragment-art"].includes("/css/assets/"),
  "엔딩과 달빛 조각 에셋은 CSS 파일이 아닌 문서 루트 기준 절대 URL로 표시해야 합니다.");
assert(Object.keys(STORY_FULL_FRAGMENT_SFX_BY_DAY).length===7
  &&Object.entries(STORY_FULL_FRAGMENT_SFX_BY_DAY).every(([day,cue])=>cue==="fragment_full_d"+day)
  &&STORY_DAEUN_RIBBON_SFX==="daeun_ribbon_handoff"
  &&STORY_PARTIAL_FRAGMENT_SFX==="fragment_partial"
  &&STORY_FULL_FRAGMENT_SFX_GAIN===fragmentSfxGain
  &&STORY_PARTIAL_FRAGMENT_SFX_GAIN===fragmentSfxGain
  &&String(playStoryFragmentSfx).includes("STORY_GUEST_IDS.includes(guestId)")
  &&String(playStoryFragmentSfx).includes('handoff.state==="partial"')
  &&String(playStoryFragmentSfx).includes("allowRetry")
  &&String(storyAdvance).includes("storyFragmentSfxWasPlayed(line)")
  &&String(applyStoryFragmentHandoff).includes("playStoryFragmentSfx(line)"),
  "부분 조각은 공용 반쪽 효과음을, 완전한 조각은 날짜별 완료음을 전달 순간에 재생해야 합니다.");
assert(playedAudio.at(-1)?.name==="fragment_full_d1"
  &&playedAudio.at(-1)?.options?.gain===fragmentSfxGain
  &&storySession.ambientAudio===guestAmbientEntry,
  "조각 획득 효과음은 손님별 대화 테마를 끊지 않고 별도로 겹쳐 재생해야 합니다.");
const firstFragmentEntry=playedAudio.at(-1);
const lockedFragmentLineIndex=storySession.lineIndex;
assert(storyFragmentSfxLockIsActive()
  &&fragmentNextButton.disabled
  &&fragmentSkipButton.disabled
  &&storyAdvance()
  &&storySession.lineIndex===lockedFragmentLineIndex,
  "조각 획득 효과음이 재생되는 동안 버튼·대사창·키보드 진행을 모두 막아야 합니다.");
firstFragmentEntry.element.dispatch("ended");
assert(!storyFragmentSfxLockIsActive()
  &&!fragmentNextButton.disabled
  &&!fragmentSkipButton.disabled,
  "조각 획득 효과음의 실제 ended 이벤트 뒤에만 진행 버튼을 다시 활성화해야 합니다.");
const daeunRibbonLine=STORY_SCENES["SCN-G8-완벽"].lines.find(line=>line.fragmentHandoff);
storySession={scene:STORY_SCENES["SCN-G8-완벽"],playedFragmentSfx:{}};
assert(applyStoryFragmentHandoff(daeunRibbonLine)
  &&playedAudio.at(-1)?.name==="daeun_ribbon_handoff"
  &&playedAudio.at(-1)?.options?.gain===fragmentSfxGain,
  "얼굴 없는 김다은이 완전한 리본 조각을 건네는 순간 전용 전달음을 재생해야 합니다.");
const failedDaeunEntry=playedAudio.at(-1);
failedDaeunEntry.element.dispatch("error");
const playedBeforeRetry=playedAudio.length;
assert(!storyFragmentSfxLockIsActive()
  &&playStoryFullFragmentSfx(daeunRibbonLine)
  &&playedAudio.length===playedBeforeRetry+1
  &&storyFragmentSfxLockIsActive(),
  "조각 효과음 재생이 거절되거나 실패하면 다음 입력에서 같은 소리를 다시 시도해야 합니다.");
playedAudio.at(-1).element.dispatch("ended");
assert(!applyStoryFragmentHandoff(null)
  &&!("--fragment-art" in fragmentLayerStyles)
  &&!fragmentLayerClasses.has("show"),
  "달빛 조각 전달이 끝나면 절대 URL과 표시 상태를 해제해야 합니다.");
storySession=null;
state.story=storyBeforeFragmentSfx;
document.getElementById=originalGetElementById;

const expectedCharacterIds=[
  "protagonist","recalledBoss","journal","moonlightTable",
  "rainyChild","lanternGuest","leftShadow","rightShadow","twinShadows",
  "crowCourier","starBeast","seawaterGuest","schoolDoll",
  "facelessDaeun","anotherDaeun","letter","menuBack"
];
const expectedGameplayJournalGuestIds=[
  "rainyChild","lanternGuest","twinShadows","crowCourier",
  "starBeast","seawaterGuest","schoolDoll","facelessDaeun"
];
same(Object.keys(STORY_CHARACTERS),expectedCharacterIds,"새 시나리오 화자 목록");
assert(STORY_CHARACTERS.protagonist.name==="김다은","주인공 이름은 김다은이어야 합니다.");
assert(STORY_CHARACTERS.recalledBoss.name==="상사","회상 장면의 상사 이름표는 상사로 표시해야 합니다.");
assert(STORY_CHARACTERS.rainyChild.name==="비에 젖은 아이"
  &&STORY_CHARACTERS.facelessDaeun.name==="얼굴 없는 손님"
  &&STORY_CHARACTERS.anotherDaeun.name==="또 다른 김다은",
  "서술형 특별 손님 이름과 또 다른 김다은 이름표를 정의해야 합니다.");
assert(expectedCharacterIds.every(id=>STORY_CHARACTERS[id].alwaysKnown===true),
  "새 시나리오의 모든 서술형 이름은 처음부터 표시되어야 합니다.");
assert(!("owner" in STORY_CHARACTERS)&&!("manager" in STORY_CHARACTERS)&&!("gicheol" in STORY_CHARACTERS),
  "기존 사장·팀장·박기철 캐릭터 정의가 남으면 안 됩니다.");

// 손님 메타데이터 여덟 장은 타이틀 영구 컬렉션에서도 계속 사용합니다.
assert(Array.isArray(GAMEPLAY_JOURNAL_PAGE_DEFS),
  "특별 손님 영업일지 메타데이터가 배열이어야 합니다.");
same(GAMEPLAY_JOURNAL_PAGE_DEFS.map(page=>page.guestId||page.id),
  expectedGameplayJournalGuestIds,
  "타이틀 영구 컬렉션은 특별 손님 여덟 명을 고정 순서로 정의해야 합니다.");
assert(new Set(GAMEPLAY_JOURNAL_PAGE_DEFS.map(page=>page.guestId||page.id)).size===8,
  "특별 손님 메타데이터에 중복 손님이 있으면 안 됩니다.");

state.story=createStoryState();
assert(state.story.schemaVersion===4,"스토리 상태는 회차 결과 분리 스키마를 사용해야 합니다.");
same(Object.keys(state.story.guestState),expectedGameplayJournalGuestIds,
  "새 진행 상태는 잠긴 페이지를 포함한 손님 여덟 명의 상태를 가져야 합니다.");
same(Object.keys(state.story.guestResults),expectedGameplayJournalGuestIds,
  "현재 회차 손님 결과도 여덟 명의 고정 맵이어야 합니다.");
assert(expectedGameplayJournalGuestIds.every(id=>{
  const guest=state.story.guestState[id];
  return guest&&!guest.clueFound&&!guest.shardOwned&&!guest.memoryUnlocked
    &&guest.currentTier==null&&guest.currentScore==null&&guest.revealedStoryLevel===0
    &&!guest.previouslyObtainedPartial&&!guest.previouslyObtainedFull
    &&guest.previousLoopTier==null&&guest.seenStoryScenes.length===0;
}),"새 진행용 손님 페이지는 단서·이야기·조각·최근 평가가 잠겨 있어야 합니다.");
assert(expectedGameplayJournalGuestIds.every(id=>{
  const result=state.story.guestResults[id];
  return result&&!result.visited&&result.evaluationTier==null&&result.evaluationScore==null
    &&result.fragmentState==="none"&&result.fragmentName==null&&result.seenStoryScenes.length===0;
}),"새 회차의 방문·평가·조각 결과는 모두 비어 있어야 합니다.");
const initialGameplayJournal=getGameplayJournalPages();
const initialRecipePages=initialGameplayJournal.filter(page=>page.pageType==="recipe");
const initialDayPages=initialGameplayJournal.filter(page=>page.pageType==="day");
assert(initialGameplayJournal.length===17
  &&initialGameplayJournal[0].pageType==="rules"
  &&initialGameplayJournal[1].pageType==="guide"
  &&initialRecipePages.length===8
  &&initialDayPages.every((page,index)=>
    page.pageType==="day"&&page.day===index+1&&!page.recorded&&page.entries.length===0),
  "새 게임의 진행용 영업일지는 주의사항 1장, 양면 그림 안내 1장, 음식별 레시피 8장, 빈 1~7일차 기록으로 구성되어야 합니다.");
same(initialGameplayJournal.map(page=>page.number),Array.from({length:17},(_,index)=>index+1),
  "진행용 영업일지 17장의 페이지 번호");
// 안내 장은 글이 아니라 양면 원화 두 장이라, 그림 주소가 빠지면 빈 종이가 됩니다.
assert(initialGameplayJournal[1].artLeft==="assets/UI/Journal/ui_log_story_guest_cooking_v01.webp"
  &&initialGameplayJournal[1].artRight==="assets/UI/Journal/ui_log_story_choice_answer_v03.webp",
  "안내 장의 왼쪽 면은 손님 조리 그림, 오른쪽 면은 선택지·대답 그림이어야 합니다.");
same(initialGameplayJournal[0].menuNames,DISHES.map(dish=>dish.name),
  "주의사항에는 기존 음식 여덟 가지를 빠짐없이 표시해야 합니다.");
same(initialGameplayJournal[0].rules,[
  "매일 영업일지에 적혀 있는 음식 중 세 가지를 골라 영업한다.",
  "손님에게 항상 친절하고 맛있는 음식을 대접한다.",
  "일반 손님 평가가 아쉽다면 특별 손님이 찾아오지 않는다. 단, ???은 예외다.",
  "폐기는 손님 주문당 한 번 가능하다."
],"영업일지의 간결한 주의사항 네 가지는 만나지 않은 교복 인형을 먼저 밝히면 안 됩니다.");
state.story.guestState.schoolDoll.clueFound=true;
assert(getGameplayJournalPages()[0].rules[2]
  ==="일반 손님 평가가 아쉽다면 특별 손님이 찾아오지 않는다. 단, 교복 인형은 예외다.",
  "교복 인형의 등장 대사를 듣고 음식 단서를 기록한 뒤에는 주의사항의 예외 대상을 공개해야 합니다.");
state.story.guestState.schoolDoll.clueFound=false;
window.MoonlightTableSave={guestMet:id=>id==="schoolDoll"};
assert(getGameplayJournalPages()[0].rules[2].endsWith("단, 교복 인형은 예외다."),
  "이전 진행에서 교복 인형을 만난 영구 기록이 있으면 새 진행에서도 예외 대상을 공개해야 합니다.");
delete window.MoonlightTableSave;
same(initialRecipePages.map(page=>page.dishId),STORY_MENU_RULES.dishIds,
  "음식별 레시피 여덟 장의 순서");
assert(initialRecipePages.every(page=>page.ingredients.length>0&&page.prepSteps.length>0&&page.cookSteps.length>0),
  "각 음식 레시피 장에는 재료와 영업 전 준비·주문 후 조리 순서가 있어야 합니다.");
assert(initialDayPages.every(page=>
  !page.guestId&&!page.guestName&&!page.appearance&&!page.confirmedDish),
  "방문 전 날짜 페이지가 미래 손님·등장 조건·정답 음식을 노출하면 안 됩니다.");
recordStorySceneOutcome(STORY_SCENES["SCN-G7-A"]);
let daySevenPage=getGameplayJournalPages().find(page=>page.day===7);
assert(daySevenPage.entries.length===1
  &&daySevenPage.entries[0].guestId==="schoolDoll"
  &&getGameplayJournalPages()[0].rules[2].endsWith("단, 교복 인형은 예외다."),
  "7일차에는 실제로 만난 교복 인형 기록만 먼저 표시해야 합니다.");
recordStorySceneOutcome(STORY_SCENES["SCN-G8-A"]);
daySevenPage=getGameplayJournalPages().find(page=>page.day===7);
same(daySevenPage.entries.map(entry=>entry.guestId),["schoolDoll","facelessDaeun"],
  "7일차 페이지는 두 최종 손님을 방문한 뒤에만 함께 기록해야 합니다.");
state.story=createStoryState();
assert(storyDisplayName("protagonist")==="김다은"
  &&storyDisplayName("rainyChild")==="비에 젖은 아이"
  &&storyDisplayName("facelessDaeun")==="얼굴 없는 손님",
  "새 화자는 이름 공개 플래그 없이 확정 이름으로 표시되어야 합니다.");

same(STORY_MENU_RULES.dishIds,
  ["oden","tofu","kimchi","skewer","yakisoba","shrimpTempura","tteokbokki","fries"],
  "기존 음식 8종 ID");
assert(STORY_MENU_RULES.selectCount===3
  &&STORY_MENU_RULES.requiredMenus.length===0
  &&STORY_MENU_RULES.allMenusAvailableFromDayOne,
  "첫째 날부터 음식 8종 중 정확히 3종을 자유 선택해야 합니다.");
STORY_MENU_RULES.dishIds.forEach(id=>assert(!!dishById(id),"존재하지 않는 메뉴 ID: "+id));
same(STORY_GENERAL_ORDERS_BY_DAY,{1:6,2:6,3:6,4:6,5:6,6:6,7:6},
  "날짜별 일반 주문 수");
same(STORY_SCORE_THRESHOLDS,{warm:80,great:100},"스토리 평가 점수 기준");
same(GENERAL_GUEST_BUBBLES.arrival,[
  "[음식명] 하나 부탁드릴게요.",
  "오늘은 [음식명][이/가] 먹고 싶네요.",
  "좋은 냄새가 나네요. [음식명] 하나 주세요."
],"일반 손님 음식명 포함 방문 대사");
same(GENERAL_GUEST_BUBBLES.soft,
  ["조금 아쉽지만 잘 먹었습니다.","정성이 느껴져서 좋았어요."],
  "일반 손님 아쉽다 평가 대사");
assert(formatGeneralGuestBubble("오늘은 [음식명][이/가] 먹고 싶네요.","kimchi")
  ==="오늘은 김치전이 먹고 싶네요."
  &&formatGeneralGuestBubble("오늘은 [음식명][이/가] 먹고 싶네요.","tofu")
  ==="오늘은 두부김치가 먹고 싶네요.",
  "일반 손님 방문 대사는 메뉴 이름과 이/가 조사를 자연스럽게 표시해야 합니다.");
assert(String(decorateStoryOrder).includes('pickGeneralGuestBubble("arrival",order.dishId)')
  &&!GENERAL_GUEST_BUBBLES.arrival.includes("천천히 해 주세요. 기다릴게요."),
  "일반 손님 주문 음식명을 방문 대사에 전달하고 제외한 기다림 문장을 다시 넣으면 안 됩니다.");
assert(storyCookingTier(79.999,STORY_SCORE_THRESHOLDS)==="soft"
  &&storyCookingTier(80,STORY_SCORE_THRESHOLDS)==="warm"
  &&storyCookingTier(99,STORY_SCORE_THRESHOLDS)==="warm"
  &&storyCookingTier(100,STORY_SCORE_THRESHOLDS)==="great"
  &&cookingScoreMessage(79.999)==="아쉬워요!"
  &&cookingScoreMessage(80)==="맛있어요!"
  &&cookingScoreMessage(100)==="완벽해요!",
  "아쉽다/맛있다/완벽은 80점과 100점을 경계로 나뉘어야 합니다.");

assert(Object.keys(STORY_SCENES).length===61,
  "새 시나리오 57개 장면에 최초 조작 안내 4개(SCN-T01~T04)를 더해 61개여야 합니다.");
const requiredStaticScenes=[
  "SCN-P01","SCN-P02","SCN-P03","SCN-P04","SCN-P05","SCN-L01","SCN-L02","SCN-D00","SCN-D01",
  "SCN-J01","SCN-J02","SCN-J03","END-01","END-02","END-03","END-04","SCN-EPI01"
];
requiredStaticScenes.forEach(id=>assert(STORY_SCENES[id]?.id===id,"필수 장면 누락: "+id));
const firstSpecialTutorial=STORY_SCENES["SCN-T04"];
assert(firstSpecialTutorial&&firstSpecialTutorial.maxLoop==null
  &&STORY_EVENT_SCHEDULE.firstSpecialGuest===undefined
  &&String(completeStoryScene).includes("insertFirstSpecialGuestTutorialAfter(scene)"),
  "첫 특별 손님 안내는 첫날 일정이 아니라 실제 특별 손님 결과 완료 뒤에 전 회차 공통 1회로 이어져야 합니다.");
assert(firstSpecialGuestTutorialTierForScene(STORY_SCENES["SCN-G1-B"])==="wrong"
  &&firstSpecialGuestTutorialTierForScene(STORY_SCENES["SCN-G2-아쉽다"])==="soft"
  &&firstSpecialGuestTutorialTierForScene(STORY_SCENES["SCN-G3-맛있다"])==="warm"
  &&firstSpecialGuestTutorialTierForScene(STORY_SCENES["SCN-G4-완벽"])==="great"
  &&firstSpecialGuestTutorialTierForScene(STORY_SCENES["SCN-G5-A"])==null,
  "첫 특별 손님 안내는 오답·아쉽다·맛있다·완벽 결과만 정확한 반응 갈래로 받아야 합니다.");
state.story=createStoryState();
state.story.loop=2;
storySession={queue:["SCN-G3-맛있다"],queueIndex:0,qaPreview:false};
assert(insertFirstSpecialGuestTutorialAfter(STORY_SCENES["SCN-G3-맛있다"])
  &&storySession.queue.join(",")==="SCN-G3-맛있다,SCN-T04"
  &&storyLinesForScene(firstSpecialTutorial)[0]?.text.includes("조각은 반쪽뿐이네"),
  "첫 실제 특별 손님이 다음 회차에 나타나도 결과 직후 안내를 한 번 삽입해야 합니다.");
markStorySceneCompleted(firstSpecialTutorial);
storySession={queue:["SCN-G4-완벽"],queueIndex:0,qaPreview:false};
assert(!insertFirstSpecialGuestTutorialAfter(STORY_SCENES["SCN-G4-완벽"])
  &&storySession.queue.length===1,
  "첫 특별 손님 안내를 완료한 뒤 다른 특별 손님 결과에서 중복 재생하면 안 됩니다.");
state.story=createStoryState();
storySession={queue:["SCN-G1-B"],queueIndex:0,qaPreview:true};
assert(!insertFirstSpecialGuestTutorialAfter(STORY_SCENES["SCN-G1-B"]),
  "QA 단일 장면 미리보기에는 후속 튜토리얼을 자동 삽입하면 안 됩니다.");
storySession=null;
assert(STORY_SCENES["SCN-P04"].completesPrologue===true,
  "영업일지 규칙 확인 뒤 프롤로그가 끝나야 합니다.");
const dayOnePrepTransition=STORY_SCENES["SCN-P05"];
assert(dayOnePrepTransition.title==="영업 준비"
  &&dayOnePrepTransition.day===1
  &&dayOnePrepTransition.moment==="dayStart"
  &&dayOnePrepTransition.transitionOnly===true
  &&dayOnePrepTransition.storyBgm==="day"
  &&dayOnePrepTransition.storyBgmCrossfade===2500
  &&dayOnePrepTransition.lines.length===0,
  "프롤로그 뒤에는 DAY 1 영업 준비 카드와 2.5초 BGM 크로스페이드가 있어야 합니다.");
assert(String(applyStorySceneAudio).includes("crossfadeDuration")
  &&String(storyAdvance).includes("storySession.scene?.transitionOnly")
  &&gameSource.includes("crossfadeBgm(track,duration=this.bgmFadeDuration)"),
  "영업 준비 카드는 자동 진행되며 식당·낮 BGM을 부드럽게 교차해야 합니다.");
assert(STORY_SCENES["SCN-P03"].interactionTarget==="journal"
  &&STORY_SCENES["SCN-P02"].interactionTarget==="restaurantDoor",
  "퇴근길 뒤 식당 문과 영업일지 조사 흐름을 유지해야 합니다.");
assert(STORY_SCENES["SCN-P01"].storyBgm==="storyCompany"
  &&STORY_SCENES["SCN-P02"].storyBgm==="storyCompany"
  &&STORY_SCENES["SCN-P02"].storyAmbient?.name==="story_rain"
  &&STORY_SCENES["SCN-P02"].storyAmbient?.fadeOut===1800
  &&STORY_SCENES["SCN-P03"].storyBgm==="storySikdang"
  &&STORY_SCENES["SCN-P04"].storyBgm==="storySikdang",
  "회사·빗길·첫 식당 장면의 BGM과 빗소리 큐가 장면 경계에 맞아야 합니다.");
const prologueDoorLine=STORY_SCENES["SCN-P02"].lines.find(line=>line.text?.includes("일단 비부터 피하자"));
assert(!prologueDoorLine?.sfxOnComplete
  &&STORY_SCENES["SCN-P03"].storyEntrySfx?.name==="story_open_door"
  &&STORY_SCENES["SCN-P03"].storyEntrySfx?.delayBgmUntilComplete===true,
  "달빛식탁에 갇히다 장면 진입 시 문소리를 먼저 재생한 뒤 식당 BGM을 시작해야 합니다.");
assert(String(beginNextStoryScene).includes("applyStorySceneAudio(scene)")
  &&String(restoreStoryCheckpoint).includes("applyStorySceneAudio(scene)")
  &&String(applyStorySceneAudio).includes("currentAmbientActive")
  &&String(applyStorySceneAudio).includes('entry.element.addEventListener("ended"')
  &&String(applyStorySceneAudio).includes("audio?.setStoryBgm?.(scene.storyBgm||null)")
  &&String(clearStoryRuntime).includes("clearStoryAudio()")
  &&String(clearStoryAudio).includes("if(!preserveBgm)audio?.setStoryBgm?.(null)")
  &&String(finishStorySession).includes("preserveBgm:!!storySession.scene?.storyBgmHoldAfterFinish"),
  "스토리 음향은 장면 시작·중간 복원·종료 수명주기를 따라야 합니다.");
const guestArrivalAudioNames=Array.from({length:7},(_,index)=>
  STORY_SCENES["SCN-G"+(index+1)+"-A"].storyEntrySfx?.name
);
same(guestArrivalAudioNames,[
  "story_guest_d1_arrival","story_guest_d2_arrival","story_guest_d3_arrival",
  "story_guest_d4_arrival","story_guest_d5_arrival","story_guest_d6_arrival",
  "story_guest_d7_arrival"
],"1~7일차 특별 손님 등장 테마 효과음 연결");
assert(Array.from({length:7},(_,index)=>STORY_SCENES["SCN-G"+(index+1)+"-A"])
  .every((arrival,index)=>{
    const prefix="SCN-G"+(index+1);
    const laterScenes=[STORY_SCENES[prefix+"-B"],STORY_SCENES[prefix+"-아쉽다"],
      STORY_SCENES[prefix+"-맛있다"],STORY_SCENES[prefix+"-완벽"]];
    return arrival.storyBgm==="night"
      &&arrival.storyEntrySfx?.gain===.65
      &&arrival.storyEntrySfx?.fadeOut===1200
      &&!arrival.storyEntrySfx?.delayBgmUntilComplete
      &&laterScenes.every(scene=>scene.storyBgm==="night"
        &&!scene.storyEntrySfx&&!scene.storyAmbient);
  }),
  "1~7일차 특별 손님 테마는 등장 장면에서만 한 번 재생해야 합니다.");
assert(gameSource.includes("fadeOutFile(entry,duration=1200)")
  &&gameSource.includes("const eased=progress*progress*(3-2*progress);")
  &&String(suspendStoryForOrderCook).includes("stopStoryAmbient(")
  &&String(suspendStoryForOrderCook).includes("stopStoryEntrySfx(storyEntrySfxFadeDuration(scene))")
  &&String(startStoryCookChallenge).includes("stopStoryEntrySfx(storyEntrySfxFadeDuration(scene))")
  &&String(restoreStoryCheckpoint).includes("if(!restored.suspended)applyStorySceneAudio(scene)")
  &&String(applyStorySceneAudio).includes("currentAmbient?.name!==cue.name")
  &&String(applyStorySceneAudio).includes("if(entryCue?.name&&storySession)")
  &&String(stopStoryAmbient).includes("entry.storyFadeOut")
  &&String(applyStorySceneAudio).includes("ambient.storyFadeOut")
  &&String(stopStoryAmbient).includes("audio.fadeOutFile(entry,duration)")
  &&String(stopStoryEntrySfx).includes("audio.fadeOutFile(entry,duration)"),
  "스토리 앰비언스와 한 번만 재생하는 등장 효과음은 서로 다른 수명주기를 따라야 합니다.");
const guestArrivalAudioFiles=[
  "sfx_story_d1_raindrop_arrival_leveled.MP3","sfx_story_d2_lantern_arrival_leveled.MP3",
  "sfx_story_d3_twin_shadow_arrival.MP3","sfx_story_d4_crow_letter_arrival_leveled.MP3",
  "sfx_story_d5_star_beast_arrival_leveled.MP3","sfx_story_d6_seawater_arrival_leveled.MP3",
  "sfx_story_d7_clock_444_arrival_leveled.MP3"
];
guestArrivalAudioNames.forEach((name,index)=>{
  const day=index+1;
  const assetPath="assets/sfx/story/guests/"+guestArrivalAudioFiles[index];
  assert(gameSource.includes(name)&&gameSource.includes(assetPath),
    "Day "+day+" 특별 손님 효과음 파일 연결");
});
assert(storySceneCardText(STORY_SCENES["SCN-P01"])==="지친 밤 - 퇴근길"
  &&!storySceneCardText(STORY_SCENES["SCN-J01"]).includes("SCN-")
  &&!storySceneCardText(STORY_SCENES["END-01"]).includes("END-"),
  "플레이어용 장면 카드에는 내부 장면 코드를 표시하지 않아야 합니다.");
assert(!storySceneShowsIntroCard(STORY_SCENES["SCN-G1-A"])
  &&!storySceneShowsIntroCard(STORY_SCENES["SCN-G1-B"])
  &&!storySceneShowsIntroCard(STORY_SCENES["SCN-G1-완벽"])
  &&!storySceneCardText(STORY_SCENES["SCN-G1-완벽"]).includes("SCN-G1")
  &&!storySceneCardText(STORY_SCENES["SCN-G1-완벽"]).includes("완벽"),
  "특별 손님의 등장·미준비·평가 장면은 내부 코드와 결과명 카드를 숨겨야 합니다.");
assert(!storySceneShowsIntroCard(STORY_SCENES["SCN-L02"])
  &&!["SCN-J01","SCN-J02","SCN-J03"].some(id=>storySceneShowsIntroCard(STORY_SCENES[id])),
  "영업일지 단서와 엔딩 판정은 시스템 정보 제목 카드 없이 바로 대사로 시작해야 합니다.");
assert(String(showStorySceneIntro).includes("storySceneShowsIntroCard")
  &&String(showStorySceneIntro).includes("showStoryLine"),
  "특별 손님은 메타 카드 없이 바로 대화 장면으로 들어가야 합니다.");

const l01=STORY_SCENES["SCN-L01"];
const l02=STORY_SCENES["SCN-L02"];
assert(storySpeakerLabel({speakerLabel:"김다은(속말)"})==="김다은",
  "예전 체크포인트의 속말 이름표도 플레이 화면에서는 김다은으로 보정해야 합니다.");
assert(l01.minLoop===2&&l01.repeatEachLoop
  &&l01.autoOpenJournal!==true
  &&l01.lines.at(-1)?.openJournalOnAdvance===true
  &&l01.lines.at(-1)?.journalPageId==="gameplay-day-1"
  &&storySceneHasRequiredInteraction(l01),
  "2회차 첫째 날에는 마지막 대사를 읽고 영업일지를 연 뒤에만 다음 단서로 이어져야 합니다.");
assert(l01.lines.some(line=>line.speaker==="protagonist"
  &&line.text==="손님들은 나를 기억하지 못하겠지? 나만 돌아왔으니까."),
  "회귀 첫 장면에서 다은만 이전 회차를 기억한다는 판단을 알려야 합니다.");
assert(l02.minLoop===2&&l02.repeatEachLoop&&l02.dynamicJournalHint,
  "2회차 이후 날짜별 동적 영업일지 안내를 사용해야 합니다.");
same(Object.keys(l02.journalVariants),["clue","confirmed","shard"],
  "영업일지 상태별 안내 종류");
Object.values(l02.journalVariants).forEach(lines=>assert(Array.isArray(lines)&&lines.length>0,
  "영업일지 상태별 대사는 lines 배열이어야 합니다."));
assert(Object.values(l02.journalVariants).flat().every(line=>line.speaker==="protagonist"&&!line.speakerLabel),
  "회귀 기록을 확인한 다은의 반응은 모두 김다은의 일반 대사여야 합니다.");
const p04=STORY_SCENES["SCN-P04"];
assert(p04.lines.some(line=>line.openJournalOnAdvance===true)
  &&p04.autoOpenJournal!==true
  &&p04.opensMenuSelection!==true,
  "프롤로그 대사 도중 영업일지를 읽고, 장면 뒤에는 냉장고에서 메뉴를 선택해야 합니다.");
assert(String(storyAdvance).includes("openGameplayJournalPage(line.journalPageId)"),
  "회귀 장면은 현재 날짜의 기록 장을 지정해서 열어야 하며 프롤로그의 기본 일지 열기는 유지해야 합니다.");
const p04DiscoveryText=p04.lines[0]?.text||"";
assert(STORY_SCENES["SCN-P03"].lines.at(-1)?.text==="나 여기 갇힌건가??"
  &&p04DiscoveryText.includes("다은은 다른 출구를 찾기 위해 식당을 둘러본다.")
  &&p04DiscoveryText.includes("그때 카운터 위에 있던 영업일지가 눈에 들어와 펼쳐본다.")
  &&p04.lines[0]?.openJournalOnAdvance===true,
  "문으로 나가지 못한 뒤 다른 출구를 찾다가 영업일지를 발견하고 펼치는 흐름이어야 합니다.");
assert(p04.lines[1]?.text==="앞에 두 장은 주의사항이고, 다음 여덟 장은 요리 레시피… 나머지 일곱 장은 빈 종이네?"
  &&p04.lines[2]?.text.includes("내일로 가는 문")
  &&JSON.stringify(STORY_SCENES).includes("내일로 가는 문")
  &&!JSON.stringify(STORY_SCENES).includes("새벽문"),
  "영업일지를 덮은 다은은 장부 구성을 짚고, 나가려는 문을 '내일로 가는 문'으로 불러야 합니다.");
assert(String(storyAdvance).includes("openJournalOnAdvance")
  &&String(storyAdvance).includes("openGameplayJournal")
  &&String(resumeStoryAfterJournal).includes("waitingForJournal")
  &&String(resumeStoryAfterJournal).includes("showStoryLine"),
  "프롤로그는 해당 자막 뒤 책을 열고, 닫은 뒤 다음 자막으로 복귀해야 합니다.");
const storyAdvanceAudioSource=String(storyAdvance)+"\\n"+String(chooseStoryOption);
assert(storyAdvanceAudioSource.includes("audio?.uiClick?.()")
  &&!storyAdvanceAudioSource.includes("audio?.click()"),
  "대사 진행과 선택지 확정은 합성 기계음이 아니라 설정된 UI 클릭음을 사용해야 합니다.");
assert(p04.lines.slice(-3).every(line=>line.timeOfDay==="day")
  &&String(storyTimeOfDayOverride).includes("line.timeOfDay"),
  "프롤로그의 밤→첫째 날 낮 전환은 대사뿐 아니라 실제 배경 시간에도 반영되어야 합니다.");
assert(p04.lines.some(line=>line.text?.includes("햇빛이 들어찬다."))
  &&!p04.lines.some(line=>line.text?.includes("첫째 날의 낮빛")||line.text?.includes("첫째 날 낮으로")),
  "프롤로그의 시간 전환은 시스템식 날짜 표현 없이 햇빛과 낮의 변화로 보여야 합니다.");
assert(STORY_SCENES["SCN-D01"].lines[0]?.text==="간판이 켜지고 달빛식탁의 영업이 시작된다."
  &&!STORY_SCENES["SCN-D01"].lines.some(line=>line.text?.includes("선택한 다섯 메뉴")),
  "밤 영업 시작 내레이션에서 일반 손님 주문 규칙을 직접 설명하면 안 됩니다.");
assert(STORY_SCENES["SCN-P04"].lines.at(-1)?.text==="우선 메뉴 세개를 골라서 첫 영업을 시작해 보자.",
  "첫 영업 메뉴 선택 대사는 세 메뉴 규칙과 일치해야 합니다.");
same([1,2,3,4,5,6].map(day=>STORY_SCENES["SCN-G"+day+"-A"].lines[0]?.text),[
  "식당을 마감하려고 하는데 문이 다시 열린다.\\n젖은 우비의 아이가 오늘의 마지막 손님으로 들어와 다은을 바라본다.",
  "손님이 모두 떠난 빈 자리를 치우고 있는데 식당 바닥에 길쭉한 불빛이 번진다.\\n빛이 모인 자리에는 머리 대신 낡은 종이등을 단 오늘의 마지막 손님이 나타나 있다.",
  "식당을 마감하려고 하는 다은에게 두개의 긴 그림자가 다가온다.",
  "손님이 모두 떠난 빈 자리를 치우고 있는데 검은 외투의 배달부가 식탁 곁에 나타나 가방을 고쳐 멘다.\\n가방 안에는 배달되지 않은 편지 한 통이 있다.",
  "식당을 마감하려고 하는데 작은 짐승이 들어와 가장 그늘진 자리에 웅크린다.\\n몸 안에는 삼킨 별빛이 움직인다.",
  "손님이 모두 떠난 빈 자리를 치우고 있는데 문 아래로 얕은 물결이 밀려 들어온다.\\n사람 형태의 손님 몸 안에서는 작은 파도와 물고기가 움직인다."
],"1~6일차 특별 손님은 마지막 일반 손님을 직접 설명하지 않고 마감 흐름에서 자연스럽게 등장");
assert(STORY_SCENES["SCN-G7-A"].lines[0]?.text==="영업을 시작한 순간 벽시계가 4시 44분에서 멈추고 멀리서 학교 종소리가 울린다.\\n문 앞에는 교복을 입은 소녀가 서 있다. 소녀가 식탁에 가까워지니 피부가 나무와 천으로 이루어진 것이 보였다.",
  "7일차 교복 인형은 영업 시작 직후 식탁에 다가오는 모습으로 소개되어야 합니다.");
assert(!STORY_SCENES["SCN-P04"].lines.some(line=>line.speaker==="journal"),
  "영업일지 규칙은 장부가 말하는 대사로 출력하면 안 됩니다.");
same(Object.keys(FIRST_SPECIAL_GUEST_BUBBLES),expectedGameplayJournalGuestIds,
  "첫 방문 특별 손님 말풍선 목록");
assert(Object.values(FIRST_SPECIAL_GUEST_BUBBLES).every(text=>text&&!text.includes("오늘도")),
  "첫 방문 특별 손님은 재방문처럼 말하면 안 됩니다.");
assert(String(prepareStoryNight).includes("guest?.visits")
  &&String(decorateStoryOrder).includes('order.bubble=""')
  &&String(decorateStoryOrder).includes("FIFO 차례"),
  "특별 손님은 좌석에서 선대사하지 않고 자기 차례의 이야기 화면에서 말해야 합니다.");
assert(String(ensureStoryActor).includes('"leftShadow","rightShadow","twinShadows"')
  &&String(ensureStoryActor).includes('?"twinShadows"'),
  "둘이 붙은 그림자는 화자 이름만 바뀌고 무대 배우는 하나를 공유해야 합니다.");
// 내일의 문을 여는 목표는 프롤로그 대사(SCN-P04)가 이미 짚어 줍니다.
// 주의사항 장에는 매일 지켜야 할 네 가지만 남기고 목표 문장은 빼 둡니다.
assert(!initialGameplayJournal[0].rules.some(rule=>rule.includes("내일로 가는 문"))
  &&!initialGameplayJournal[0].rules.some(rule=>rule.includes("완전한 조각")),
  "영업일지 첫 장은 세부 등급도 내일의 문 목표도 적지 않고 매일의 영업 규칙만 남겨야 합니다.");
same(l01.lines.slice(-4).map(line=>line.text),[
  "달빛 조각은 사라졌지만 기록은 남아 있어.",
  "이번에도 같은 손님들이 같은 날 찾아온다면 다시 모을 수 있을 거야.",
  "손님들은 나를 기억하지 못하겠지? 나만 돌아왔으니까.",
  "누가 어떤 음식을 찾았는지는 이 장부를 보면 돼."
],"회귀 후 첫째 날의 영업일지 안내 대사");
assert(l02.lines[0]?.text==="다은은 기록이 남아있는지 영업일지를 확인한다."
  &&l02.journalVariants.clue[0]?.text==="이 날에는 손님이 원했던 음식에 대한 단서가 있어. 그 말에 맞는 음식을 준비해 보자."
  &&l02.journalVariants.confirmed[0]?.text==="지난번엔 음식은 맞았지만 달빛 조각을 얻지 못했어 이번엔 완벽하게 조리해서 조각을 얻어야겠다."
  &&l02.journalVariants.shard[0]?.text==="지난번에 조각을 얻었으니 똑같이 해서 다시 조각을 얻자!",
  "영업일지 확인 내레이션과 단서·음식 확정·조각 획득 반응을 정해진 문구로 표시해야 합니다.");
assert(String(storyLinesForScene).includes("source=[...source,...variant]")
  &&!String(storyLinesForScene).includes("scene.journalVariants.none"),
  "기록이 없으면 확인 내레이션만 표시하고, 기록이 있으면 상태별 반응을 이어서 표시해야 합니다.");

same(STORY_EVENT_SCHEDULE.newGame[1],
  ["SCN-P01","SCN-P02","SCN-P03","SCN-P04","SCN-P05"],"프롤로그 진입 일정");
for(let day=1;day<=7;day++){
  assert(STORY_EVENT_SCHEDULE.nightStart[day][0]==="SCN-D01",
    "매일 영업 준비 완료 뒤 밤 영업 시작 장면을 실행해야 합니다.");
}
assert(STORY_EVENT_SCHEDULE.dayStart[1].includes("SCN-L01"),
  "회귀 후 첫째 날 장면이 일정에 등록되어야 합니다.");

/* 둘째 날부터의 날짜 구분 카드. 첫째 날은 SCN-P05(1회차)·SCN-L01(2회차)이
   이미 카드를 띄우므로 넣으면 안 됩니다. */
const dailyPrepOpening=STORY_SCENES["SCN-D00"];
assert(dailyPrepOpening.title==="영업 준비"
  &&dailyPrepOpening.day===null
  &&dailyPrepOpening.moment==="dayStart"
  &&dailyPrepOpening.repeatEachDay===true
  &&dailyPrepOpening.timeOfDay==="day"
  &&storySceneShowsIntroCard(dailyPrepOpening)
  &&dailyPrepOpening.lines.at(-1)?.speaker==="protagonist"
  &&dailyPrepOpening.lines.at(-1)?.text==="오늘의 준비를 시작하자.",
  "다음 날로 넘어갈 때는 DAY 카드가 붙은 영업 준비 장면과 다은의 시작 대사가 있어야 합니다.");
assert(!STORY_EVENT_SCHEDULE.dayStart[1].includes("SCN-D00"),
  "첫째 날에는 이미 다른 장면이 DAY 카드를 띄우므로 SCN-D00을 넣으면 안 됩니다.");
for(let day=2;day<=7;day++){
  assert(STORY_EVENT_SCHEDULE.dayStart[day][0]==="SCN-D00",
    "둘째 날부터는 낮 준비가 날짜 구분 장면으로 시작해야 합니다.");
}
{
  const savedDay=state.day;
  state.day=3;
  assert(storySceneDayLabel(dailyPrepOpening)==="DAY 3"
    &&storySceneProgressKey(dailyPrepOpening).includes("day3"),
    "날짜 구분 카드는 현재 날짜를 표시하고 날짜별 완료 키를 써야 합니다.");
  state.day=savedDay;
}

const guestContracts=[
  [1,1,"rainyChild","kimchi","first_raindrop","첫 빗방울","after",6],
  [2,2,"lanternGuest","oden","remaining_warmth","남은 온기","after",6],
  [3,3,"twinShadows","tofu","two_half_names","반쪽 이름 두 개","after",6],
  [4,4,"crowCourier","skewer","undelivered_letter","배달되지 못한 편지","after",6],
  [5,5,"starBeast","fries","golden_salt","금빛 소금","after",6],
  [6,6,"seawaterGuest","shrimpTempura","eastern_scale","동쪽의 비늘","after",6],
  [7,7,"schoolDoll","tteokbokki","stopped_minute_hand","멈춘 분침","before",0],
  [8,7,"facelessDaeun","yakisoba","daeuns_tomorrow","김다은의 내일","after",6]
];

let quotedDaeunReflectionCount=0;
guestContracts.forEach(([number,day,character,dishId,shardId,shardName,timing,afterGeneral])=>{
  const prefix="SCN-G"+number;
  const arrival=STORY_SCENES[prefix+"-A"];
  const missing=STORY_SCENES[prefix+"-B"];
  const soft=STORY_SCENES[prefix+"-아쉽다"];
  const warm=STORY_SCENES[prefix+"-맛있다"];
  const great=STORY_SCENES[prefix+"-완벽"];
  assert(arrival?.specialGuest&&arrival.sceneType==="specialGuestArrival",
    prefix+" 등장 장면 계약");
  assert(arrival.requiresDishChoice&&arrival.wrongDishSceneId===prefix+"-B",
    prefix+" 힌트 뒤 음식 선택과 오답 분기 연결");
  assert(arrival.day===day&&arrival.character===character&&arrival.dishId===dishId,
    prefix+" 날짜·손님·음식 연결");
  assert(arrival.shardId===shardId&&arrival.shardName===shardName,
    prefix+" 달빛 조각 연결");
  assert(arrival.triggerTiming===timing&&arrival.triggerAfterGeneral===afterGeneral,
    prefix+" 일반 주문 기준 등장 시점");
  assert(arrival.arrival===(number===7?"early":"last"),
    prefix+(number===7?" 교복 인형은 7일차 첫 손님으로 등장":" 특별 손님은 일반 손님 여섯 명 뒤 마지막에 등장"));
  assert(arrival.missingMenuSceneId===prefix+"-B",
    prefix+" 미준비 분기 연결");
  same(arrival.resultSceneIds,
    {soft:prefix+"-아쉽다",warm:prefix+"-맛있다",great:prefix+"-완벽"},
    prefix+" 평가 장면 연결");
  same(arrival.thresholds,{warm:80,great:100},prefix+" 평가 기준");
  assert(arrival.repeatEachLoop&&arrival.guestOrder&&arrival.specialCook,
    prefix+" 회차별 재방문과 기존 조리 연결");
  assert(missing?.missingMenu&&missing.wrongDish&&missing.journalClue&&missing.resultTier==null,
    prefix+" 오답 음식 단서 분기");
  assert(soft?.resultTier==="soft"&&!soft.grantsShard,
    prefix+" 아쉽다 결과");
  assert(warm?.resultTier==="warm"&&!warm.grantsShard,
    prefix+" 맛있다 결과");
  assert(great?.resultTier==="great"&&great.grantsShard&&great.uniqueShard,
    prefix+" 최초 완벽 달빛 조각 결과");
  assert([missing,soft,warm,great].every(scene=>
    scene.lines[0]?.kind==="direction"&&!!scene.lines[1]?.speaker),
    prefix+" 행동 묘사 뒤에는 내레이션이 손님의 말을 선점하지 않아야 합니다.");
  const warmHandoff=warm.lines.at(-1)?.fragmentHandoff;
  const greatHandoff=great.lines.at(-1)?.fragmentHandoff;
  assert(number===8?!warmHandoff:warmHandoff?.state==="partial"
    &&warmHandoff.asset===STORY_PARTIAL_FRAGMENT_ASSETS[shardId],
    prefix+" 맛있다 부분 조각 전달 연출");
  assert(greatHandoff?.state==="full"&&greatHandoff.shardId===shardId
    &&greatHandoff.asset===STORY_FRAGMENT_ASSETS[shardId],
    prefix+" 완벽 조각 전달 연출과 실제 손님별 에셋");
  assert(!soft.lines.some(line=>line.fragmentHandoff),prefix+" 아쉽다 조각 미지급");
  assert([soft,warm,great].every(scene=>scene.preservesUnlockedMemory),
    prefix+" 재평가가 기존 기억과 조각을 회수하면 안 됩니다.");
  [soft,warm,great].forEach(scene=>{
    const quotedReflections=scene.lines.filter(line=>line.speaker==="protagonist"
      &&typeof line.text==="string"&&/^'.*'$/.test(line.text));
    const expected=number===8&&scene===great?2:1;
    assert(quotedReflections.length===expected
      &&quotedReflections.every(line=>typeof line.motion==="string"&&line.motion),
      scene.id+" 손님 반응 뒤 김다은의 옛 속말만 작은따옴표와 모션을 유지해야 합니다.");
    quotedDaeunReflectionCount+=quotedReflections.length;
  });
  assert([arrival,missing].every(scene=>!scene.lines.some(line=>line.speaker==="protagonist"
    &&typeof line.text==="string"&&/^'.*'$/.test(line.text))),
    prefix+" 등장·오답 장면의 일반 김다은 대사에는 작은따옴표를 붙이면 안 됩니다.");
});
assert(quotedDaeunReflectionCount===25,
  "특별 손님 결과 뒤 김다은의 옛 속말 25개만 작은따옴표로 표시해야 합니다.");

same(STORY_SPECIAL_GUEST_BY_DAY,{
  1:["SCN-G1-A"],2:["SCN-G2-A"],3:["SCN-G3-A"],4:["SCN-G4-A"],
  5:["SCN-G5-A"],6:["SCN-G6-A"],7:["SCN-G7-A","SCN-G8-A"]
},"날짜별 특별 손님 일정");

const g8=STORY_SCENES["SCN-G8-A"];
assert(g8.requiredBaseShards===7&&g8.triggerOnNightEnd&&g8.triggerAfterGeneral===6,
  "얼굴 없는 김다은은 기본 조각 7개와 7일차 일반 주문 6건 뒤 등장해야 합니다.");
const g8AudioSceneIds=["SCN-G8-A","SCN-G8-B","SCN-G8-아쉽다","SCN-G8-맛있다","SCN-G8-완벽"];
assert(g8AudioSceneIds.every(sceneId=>
  STORY_SCENES[sceneId].storyBgm==="storyFacelessDaeun"
  &&STORY_SCENES[sceneId].storyBgmCrossfade===2500
  &&STORY_SCENES[sceneId].storyBgmHoldAfterFinish===true)
  &&["SCN-J02","SCN-J03"].every(sceneId=>
    STORY_SCENES[sceneId].storyBgm==="storyFacelessDaeun"
    &&STORY_SCENES[sceneId].storyBgmCrossfade===2500),
  "얼굴 없는 김다은의 모든 대화와 결과 장면은 전용 BGM을 유지해야 합니다.");
assert(gameSource.includes('(state.phase!=="result"||!!this.storyBgmTrack)'),
  "결과 단계에서도 엔딩 장면 전용 BGM은 재생할 수 있어야 합니다.");
same(
  STORY_SCENES["SCN-G1-B"].lines.filter(line=>line.speaker==="rainyChild").map(line=>line.text),
  [
    "이 음식이 아니에요, 그래도 생각해 주셔서 감사합니다.",
    "제가 먹고싶은 음식은 팬 위에서 둥글게 퍼지고, 빗소리처럼 지글거리는 음식이에요"
  ],
  "G1 준비 음식 없음·오답 반응 대사"
);
assert(
  STORY_SCENES["SCN-G7-B"].lines.some(line=>
    line.speaker==="schoolDoll"&&line.text==="오늘도 4시 44분에 끝나겠네요."
  ),
  "G7 준비 음식 없음·오답 첫 반응 대사"
);
same(
  Array.from({length:8},(_,index)=>STORY_SCENES["SCN-G"+(index+1)+"-B"].lines
    .find(line=>line.speaker==="protagonist")?.text),
  [
    "알겠어. 다음에는 그 소리가 기억나게 하는 음식을 준비해 볼게",
    "알겠어요. 다음에는 나무꼬치에 꿰인 긴 재료를 따뜻한 국물에 담은 음식을 준비해 볼게요.",
    "알겠어. 다음에는 흰 것과 붉은 것이 한 접시에 함께 있는 음식을 준비해 볼게.",
    "알겠어요. 다음에는 불에 구운 작은 조각을 꼬치에 꿴 음식을 준비해 볼게요.",
    "알겠어. 다음에는 손끝에 소금이 남는 길고 노란 음식을 준비해 볼게.",
    "알겠어요. 다음에는 겉은 바삭하고 속에는 바다 냄새가 남은 음식을 준비해 볼게요.",
    "알겠어. 다음에는 빨간 소스와 말랑한 조각이 함께 든 음식을 준비해 볼게.",
    "알겠어. 다음에는 굵은 면을 팬에 볶아 함께 나눠 먹던 음식을 준비해 볼게."
  ],
  "G1~G8 오답 단서 뒤 김다은은 다음에 준비할 음식을 구체적으로 되짚어야 합니다."
);
assert(
  STORY_SCENES["SCN-G7-맛있다"].lines.at(-1)?.fragmentHandoff?.state==="partial"
  &&storyFragmentStateForResult(STORY_SCENES["SCN-G7-맛있다"],"schoolDoll")==="partial"
  &&!STORY_SCENES["SCN-G8-맛있다"].lines.some(line=>line.fragmentHandoff),
  "G7 맛있다는 부분 조각을 지급하고 G8 맛있다는 조각을 지급하지 않아야 합니다."
);
assert(GAMEPLAY_JOURNAL_PAGE_DEFS.find(page=>page.guestId==="facelessDaeun").appearanceCondition
  .includes("현재 회차 기본 손님 7명의 완전한 달빛 조각"),
  "G8 진행 일지는 현재 회차 기본 완전 조각 7개 조건을 명확히 표시해야 합니다.");
assert(STORY_SCENES["SCN-G8-완벽"].character==="anotherDaeun"
  &&STORY_SCENES["SCN-G8-완벽"].finalShard,
  "G8 완벽에서 또 다른 김다은과 여덟 번째 조각을 공개해야 합니다.");
assert(!STORY_SCENES["SCN-G8-A"].lines.some(line=>line.text?.includes("볶음우동 하나"))
  &&STORY_SCENES["SCN-G8-A"].lines.some(line=>line.text?.includes("굵은 면")),
  "G8도 정답 음식명을 직접 주문하지 않고 굵은 면과 팬 단서만 말해야 합니다.");
assert(!JSON.stringify(STORY_SCENES).includes("undelivered_letter_read"),
  "배달되지 못한 편지는 별도 읽기 플래그를 요구하면 안 됩니다.");
assert(STORY_SCENES["SCN-G2-A"].lines[0].text.includes("나타나")
  &&STORY_SCENES["SCN-G4-A"].lines[0].text.includes("나타나"),
  "등불 손님과 까마귀 배달부는 출입문으로 들어오지 않고 식당 안에 나타나야 합니다.");
assert(STORY_SCENES["SCN-G6-A"].lines.some(line=>
  line.speaker==="seawaterGuest"&&line.text.includes("겉은 바삭하고 속은 바다 냄새가 나지요.")),
  "새우튀김 단서는 바삭한 겉과 속의 바다 냄새로 묘사해야 합니다.");
const g8GreatLines=STORY_SCENES["SCN-G8-완벽"].lines;
const g8IdentityIndex=g8GreatLines.findIndex(line=>
  line.speaker==="facelessDaeun"&&line.text.includes("나는 김다은"));
const g8RevealedNameIndex=g8GreatLines.findIndex(line=>line.speaker==="anotherDaeun");
assert(g8IdentityIndex>=0&&g8RevealedNameIndex>g8IdentityIndex,
  "얼굴 없는 손님이 스스로 김다은이라고 밝힌 다음 줄부터 이름표가 바뀌어야 합니다.");
assert(g8GreatLines[g8IdentityIndex+1]?.text
  ==="그 말을 마치자 비어 있던 얼굴 위로 김다은과 같은 눈과 입이 천천히 나타난다.",
  "G8 완벽 장면은 얼굴 등장 연출만 남기고 다음 대사의 설명을 미리 말하면 안 됩니다.");

same(STORY_ENDING_RULES,{
  low:{minShards:0,maxShards:3,judgementSceneId:"SCN-J01"},
  middle:{minShards:4,maxShards:7,judgementSceneId:"SCN-J02"},
  complete:{minShards:8,maxShards:8,judgementSceneId:"SCN-J03"}
},"달빛 조각 수에 따른 판정 장면");
assert(STORY_SCENES["SCN-J01"].autoLoop&&STORY_SCENES["SCN-J01"].nextSceneId==="SCN-L01",
  "조각 0~3개는 선택지 없이 회귀해야 합니다.");
assert(STORY_SCENES["SCN-J01"].lines[1]?.text
  ==="영업일지에 글이 나타난다.\\n「당신은 하나의 길도 만들지 못했습니다. 손님의 마음을 얻어 길을 만드십시오.」"
  &&STORY_SCENES["SCN-J01"].lines[2]?.text
  ==="이번에는 손님의 마음을 얻어보도록 노력하자."
  &&TITLE_JOURNAL_ENDING_DEFS.find(ending=>ending.id==="loop_return")?.lastLine
  ==="이번에는 손님의 마음을 얻어보도록 노력하자.",
  "첫 자동 회귀는 장부 기록을 안다고 전제하지 않고 손님의 마음을 얻겠다는 목표를 알려야 합니다.");
same(STORY_SCENES["SCN-J02"].lines.find(line=>line.choices).choices.map(choice=>choice.nextSceneId),
  ["END-01","END-02"],"조각 4~7개 엔딩 선택");
same(STORY_SCENES["SCN-J02"].lines.find(line=>line.choices).choices.map(choice=>choice.text),
  ["내 문을 밝힌다","손님들의 길을 밝힌다"],"조각 4~7개 선택지 문구");
same(STORY_SCENES["SCN-J03"].lines.find(line=>line.choices).choices.map(choice=>choice.nextSceneId),
  ["END-03","END-04"],"조각 8개 엔딩 선택");
same(STORY_SCENES["SCN-J03"].lines.find(line=>line.choices).choices.map(choice=>choice.text),
  ["이 밤을 그대로 붙잡는다","내일을 모두에게 돌려준다"],"조각 8개 선택지 문구");
assert(!STORY_SCENES["SCN-J03"].lines.find(line=>line.choices).choices[1].requiredFlag,
  "END-04 선택에 편지 읽기 플래그를 요구하면 안 됩니다.");

same(["SCN-J01","END-01","END-02","END-03","END-04"].map(id=>STORY_SCENES[id].storyBgm),[
  "endingLoopReturn","endingAloneMorning","endingGuestsDawn","endingOpenForever","endingMorningTogether"
],"다섯 엔딩 장면의 전용 BGM");
assert(["SCN-J01","END-01","END-02","END-03","END-04"]
  .every(id=>STORY_SCENES[id].storyBgmCrossfade===3000)
  &&STORY_SCENES["SCN-EPI01"].storyBgm===STORY_SCENES["END-04"].storyBgm,
  "엔딩 BGM은 3초로 전환하고 진엔딩 에필로그까지 같은 곡을 이어야 합니다.");

same(["END-01","END-02","END-03","END-04"].map(id=>STORY_SCENES[id].continuePolicy),
  ["nextLoop","nextLoop","nextLoop","clearRunKeepMeta"],
  "엔딩별 이어하기 정책");
assert(["END-01","END-02","END-03"].every(id=>!STORY_SCENES[id].retryJudgementSceneId)
  &&STORY_SCENES["END-04"].retryJudgementSceneId==="SCN-J03",
  "일반 엔딩에는 재선택을 붙이지 않고 진엔딩만 마지막 분기로 돌아갈 수 있어야 합니다.");
assert(STORY_SCENES["END-02"].lines[0]?.text
  ==="다은은 달빛 조각을 이용해 손님들이 나아갈 수 있는 길을 밝혀준다.\\n손님들은 그 길을 따라 기억을 되찾아 각자의 아침으로 떠나지만 다은은 떠나지 못하고 식당에 남게된다."
  &&STORY_SCENES["END-03"].lines[0]?.text
  ==="다은은 달빛을 식당에 붙잡아둔다.\\n손님들의 기억은 다시 흐려지고 다은은 달빛식탁의 새 주인이 된다.",
  "손님들의 새벽과 영원히 영업 중 엔딩은 달빛으로 길을 밝히거나 식당에 붙잡는 결과를 설명해야 합니다.");
storySession={conclusionAction:null};
queueStoryConclusion(STORY_SCENES["END-01"]);
same(storySession.conclusionAction,{type:"nextLoop",toTitle:false},
  "일반 엔딩은 재선택 메뉴나 타이틀을 거치지 않고 다음 회차 첫째 날로 돌아가야 합니다.");
storySession=null;
assert(STORY_SCENES["END-04"].trueEnding
  &&STORY_SCENES["END-04"].nextSceneId==="SCN-EPI01"
  &&STORY_SCENES["SCN-EPI01"].endingSceneId==="END-04",
  "함께 오는 아침에서 진엔딩 에필로그로 이어져야 합니다.");
assert(STORY_SCENES["SCN-EPI01"].disableContinue
  &&STORY_SCENES["SCN-EPI01"].clearProgressSaves
  &&STORY_SCENES["SCN-EPI01"].keepTitleJournal,
  "진엔딩 뒤 진행 저장은 초기화하고 타이틀 영업일지는 유지해야 합니다.");
const trueEndingRuntimeSource=String(finishTrueEnding);
assert(trueEndingRuntimeSource.includes("unlockTrueEndingEpilogues")
  &&trueEndingRuntimeSource.includes("clearAutoSaveForTrueEnding")
  &&trueEndingRuntimeSource.indexOf("unlockTrueEndingEpilogues")
    <trueEndingRuntimeSource.indexOf("clearAutoSaveForTrueEnding"),
  "진엔딩은 영구 후일담을 먼저 해금한 뒤 진행 자동 저장을 삭제해야 합니다.");
const completeSceneRuntimeSource=String(completeStoryScene);
const finishSessionRuntimeSource=String(finishStorySession);
assert(completeSceneRuntimeSource.includes("conclusionQueued")
  &&completeSceneRuntimeSource.includes("if(!conclusionQueued)saveGame(true)")
  &&finishSessionRuntimeSource.includes("if(!conclusionAction)saveGame()"),
  "회귀·엔딩 결론 직전의 완료된 Day 7 상태를 중간 자동 저장하면 안 됩니다.");
assert(String(runStoryConclusion).includes("beginNextStoryLoop")
  &&String(runStoryConclusion).includes("showEndingRetryMenu")
  &&String(runStoryConclusion).includes("finishTrueEnding"),
  "자동 회귀·일반 엔딩 회귀·진엔딩은 각각의 최종 처리 경로를 유지해야 합니다.");
assert(String(queueStoryConclusion).includes("scene.trueEndingEpilogue")
  &&String(queueStoryConclusion).includes('acceptPolicy:"trueEnding"')
  &&String(queueStoryConclusion).includes("unlockTrueEndingEpilogues"),
  "진엔딩 후일담을 본 뒤 영구 기록을 남기고 재선택 질문을 열어야 합니다.");
assert(String(restoreEndingChoiceCheckpoint).includes("playStoryScenes")
  &&String(restoreEndingChoiceCheckpoint).includes("ending.nextSceneId")
  &&String(acceptCurrentEnding).includes("beginNextStoryLoop")
  &&String(acceptCurrentEnding).includes("finishTrueEnding"),
  "엔딩 뒤에는 마지막 분기 재생과 현재 결말 수용을 모두 제공해야 합니다.");
assert(String(showEndingRetryMenu).includes("saveEndingRetryCheckpoint")
  &&String(showEndingRetryMenu).includes("restoredCheckpoint")
  &&String(showEndingRetryMenu).includes("다른 선택을 할 수도 있지 않았을까")
  &&String(showEndingRetryMenu).includes('removeAttribute("inert")'),
  "엔딩 질문은 현재 결말을 숨은 체크포인트로 저장하고 김다은의 대사로 열려야 합니다.");
assert(String(retryLastEndingBranch).includes("restoreStoredEndingRetryState")
  &&String(retryLastEndingBranch).includes("clearEndingRetryCheckpoint")
  &&String(acceptCurrentEnding).includes("restoreStoredEndingRetryState")
  &&String(acceptCurrentEnding).includes("clearEndingRetryCheckpoint"),
  "복구된 엔딩 화면의 두 버튼은 상태를 되살린 뒤 숨은 체크포인트를 삭제해야 합니다.");
assert(!STORY_SCENES["SCN-J01"].retryJudgementSceneId
  &&String(validEndingRetryAction).includes('acceptPolicy==="trueEnding"')
  &&String(initializeStoryUI).includes('event.key!=="Tab"'),
  "자동 회귀에는 재선택을 붙이지 않고 엔딩 질문의 포커스는 두 선택지 안에 유지해야 합니다.");
const retryActions=[
  ["END-04","SCN-J03","trueEnding"]
].map(([endingSceneId,judgementSceneId,acceptPolicy])=>({
  type:"endingRetryMenu",endingSceneId,judgementSceneId,acceptPolicy
}));
assert(retryActions.every(validEndingRetryAction),
  "진엔딩의 재선택 동작은 계속 유효해야 합니다.");
let trueEndingEpilogueUnlocks=0;
window.MoonlightTableSave={unlockTrueEndingEpilogues(){trueEndingEpilogueUnlocks++;}};
storySession={conclusionAction:null};
queueStoryConclusion(STORY_SCENES["SCN-EPI01"]);
same(storySession.conclusionAction,{
  type:"endingRetryMenu",
  judgementSceneId:"SCN-J03",
  endingSceneId:"END-04",
  endingTitle:"함께 오는 아침",
  acceptPolicy:"trueEnding"
},"진엔딩 후일담 종료 뒤 재선택 질문 동작");
assert(trueEndingEpilogueUnlocks===1,
  "진엔딩 후일담은 재선택 여부와 무관하게 본 즉시 영구 기록되어야 합니다.");
storySession=null;
delete window.MoonlightTableSave;
assert(String(finishTrueEnding).includes("clearEndingRetryCheckpoint")
  &&String(finishTrueEnding).indexOf("clearEndingRetryCheckpoint")
    <String(finishTrueEnding).indexOf("clearAutoSaveForTrueEnding"),
  "진엔딩은 일반 엔딩의 숨은 체크포인트를 남기지 않아야 합니다.");

Object.values(STORY_SCENES).forEach(scene=>{
  assert(Array.isArray(scene.lines)&&(scene.lines.length>0||scene.transitionOnly===true),
    scene.id+" lines 누락");
  scene.lines.forEach((line,index)=>{
    assert(typeof line.text==="string"||typeof line.prompt==="string",
      scene.id+" "+index+"번 줄에 text 또는 prompt가 필요합니다.");
    if(line.speaker)assert(!!STORY_CHARACTERS[line.speaker],
      scene.id+"의 알 수 없는 화자: "+line.speaker);
    assert(line.kind!=="gameplay",scene.id+"에 플레이어용 게임플레이 지시가 노출되면 안 됩니다.");
    assert(!line.cook&&!line.orderCook,
      scene.id+" 데이터가 기존 미니게임 단계를 재정의하면 안 됩니다.");
    assert(!line.reveal,"서술형 손님 이름에 reveal 규칙을 사용하면 안 됩니다.");
  });
});

const repeatArrival=STORY_SCENES["SCN-G1-A"];
state.story.seenScenes[repeatArrival.id]=true;
state.selectedMenus=["oden","tofu","kimchi","skewer","fries"];
const repeatArrivalLines=storyLinesForScene(repeatArrival);
const repeatDishChoice=repeatArrivalLines.at(-1);
storySession={scene:repeatArrival,lines:repeatArrivalLines,lineIndex:0,suspended:false};
assert(storySceneHasRequiredInteraction(repeatArrival)&&storySceneCanSkip(repeatArrival)
  &&repeatDishChoice.prompt==="어떤 음식을 내줄까?"
  &&repeatDishChoice.choices.length===5,
  "이미 본 특별 손님 대사는 SKIP할 수 있지만 준비한 다섯 음식 선택은 필수여야 합니다.");
assert(repeatDishChoice.choices.every(choice=>choice.orderCook?.dishId
    &&choice.orderCook.suppressReply===true)
  &&String(skipCurrentStoryScene).includes("storyDishChoiceLineIndex")
  &&String(skipCurrentStoryScene).includes("showStoryLine"),
  "특별 손님 SKIP은 장면을 완료하지 않고 음식 선택 줄로 이동해야 합니다.");
assert(storySceneHasRequiredInteraction(STORY_SCENES["SCN-J02"]),
  "엔딩 선택지가 있는 장면은 SKIP으로 필수 선택을 건너뛰면 안 됩니다.");
storySession=null;

const storyText=JSON.stringify(STORY_SCENES);
assert(!storyText.includes("박기철")&&!storyText.includes("한 달만 가게")&&!storyText.includes("사표 아직 수리"),
  "기존 박기철·가게 인수·복귀 제안 이야기가 남으면 안 됩니다.");
assert(!storyText.includes("퇴사")&&!storyText.includes("퇴직")&&!storyText.includes("사표"),
  "새 프롤로그에 퇴사 설정이 남으면 안 됩니다.");
assert(storyText.includes("내일이 오지 않았으면 좋겠다")
  &&storyText.includes("「마지막 손님」이라는 문구가 그제야 나타난다")
  &&storyText.includes("오늘의 메뉴는 내일 정합니다"),
  "지친 퇴근길과 마지막 손님 공개 시점, 진엔딩 문구가 필요합니다.");
assert(!storyText.includes("마지막 예약 손님: 김다은"),
  "마지막 손님의 이름을 등장 전에 영업일지에서 선공개하면 안 됩니다.");

// 실행기 통합 규칙: 회차·날짜별 재생, 미준비 방문, 재평가 영속성과
// 7일차 조각 판정이 데이터 선언과 실제 함수에서 같은지 확인합니다.
state.story=createStoryState();
state.selectedMenus=["oden","tofu","skewer","yakisoba","fries"];
state.day=1;
assert(storySceneProgressKey(STORY_SCENES["SCN-D01"]).includes("day1"),
  "매일 영업 시작 장면은 날짜별 완료 키를 사용해야 합니다.");
prepareStoryNight();
assert(state.story.pendingNightGuests.length===1
  &&state.story.pendingNightGuests[0].sceneId==="SCN-G1-A"
  &&state.story.pendingNightGuests[0].awaitingDishChoice
  &&!state.story.pendingNightGuests[0].missingMenu
  &&state.story.pendingNightGuests[0].guestOrder===false,
  "특별 손님은 정답 준비 여부를 선판정하지 않고 음식 선택을 기다려야 합니다.");
const waitingStoryOrder=decorateStoryOrder({
  id:1,slot:0,dishId:"oden",variant:0,entered:0,cookStep:0,cookScores:[]
},state.story.pendingNightGuests[0]);
assert(waitingStoryOrder.awaitingDishChoice&&!waitingStoryOrder.guestOrder
  &&waitingStoryOrder.storyDishId==="kimchi"&&waitingStoryOrder.dishId==="oden",
  "선택 전 특별 손님은 내부 정답을 주문 아이콘의 음식으로 덮어쓰면 안 됩니다.");

const firstChoiceLine=storyLinesForScene(STORY_SCENES["SCN-G1-A"]).at(-1);
same(firstChoiceLine.choices.map(choice=>choice.orderCook.dishId),state.selectedMenus,
  "특별 손님에게 현재 준비한 메뉴만 선택지로 표시");
assert(firstChoiceLine.prompt==="어떤 음식을 내줄까?"
  &&!STORY_SCENES["SCN-G1-A"].lines.some(line=>line.text?.includes("김치전")),
  "힌트 대사 뒤 선택 질문을 붙이고 정답 음식명은 먼저 말하지 않아야 합니다.");

const rainy=getStoryGuestState("rainyChild");
assert(!rainy.clueFound&&!rainy.foodConfirmed
  &&getStoryGuestResult("rainyChild").evaluationTier==null
  &&getStoryGuestResult("rainyChild").fragmentState==="none",
  "특별 손님의 도착 대사를 듣기 전에는 음식 단서와 결과가 없어야 합니다.");
assert(recordStoryArrivalClue(STORY_SCENES["SCN-G1-A"],{save:false})
  &&rainy.clueFound&&!rainy.foodConfirmed
  &&getStoryGuestResult("rainyChild").evaluationTier==null
  &&getStoryGuestResult("rainyChild").fragmentState==="none",
  "도착 대사를 모두 들으면 조리 결과와 무관하게 음식 단서만 기록해야 합니다.");
assert(!recordStoryArrivalClue(STORY_SCENES["SCN-G1-A"],{save:false})
  &&normalizeStoryState(JSON.parse(JSON.stringify(state.story)))
    .guestState.rainyChild.clueFound,
  "도착 단서는 중복 기록되지 않고 저장 복원 뒤에도 유지되어야 합니다.");
assert(String(showStoryLine).includes("recordStoryArrivalClue(scene,{save:true})"),
  "특별 손님 대사를 SKIP하거나 선택 화면을 복원해도 단서를 즉시 저장해야 합니다.");
assert(String(finishStoryTyping).includes("lastArrivalDialogueIndex")
  &&String(finishStoryTyping).includes("recordStoryArrivalClue(scene,{save:true})"),
  "특별 손님의 마지막 음식 묘사가 모두 출력된 순간 단서를 즉시 저장해야 합니다.");
storySession={scene:STORY_SCENES["SCN-G1-A"],suspended:true,pendingCook:null};
const wrongResult=applyStoryCookingResult({
  guestId:"rainyChild",storySceneId:"SCN-G1-A",
  storyDishId:"kimchi",dishId:"oden",specialRecipe:true
},95);
storySession=null;
assert(wrongResult.matched===false&&state.story.pendingResultSceneId==="SCN-G1-B"
  &&getStoryGuestResult("rainyChild").evaluationTier==null
  &&getStoryGuestResult("rainyChild").evaluationScore==null,
  "잘못 고른 음식은 높은 조리 점수여도 평가 장면이나 평가 수치를 갱신하면 안 됩니다.");
state.story.pendingResultSceneId=null;
recordStorySceneOutcome(STORY_SCENES["SCN-G1-B"]);
assert(rainy.clueFound&&!rainy.shardOwned&&!rainy.memoryUnlocked
  &&getStoryGuestResult("rainyChild").visited
  &&getStoryGuestResult("rainyChild").fragmentState==="none",
  "오답 음식 B분기는 진행용 페이지에 단서만 기록해야 합니다.");
assert(storyLinesForScene(STORY_SCENES["SCN-L02"])[0].text
  ==="다은은 기록이 남아있는지 영업일지를 확인한다."
  &&storyLinesForScene(STORY_SCENES["SCN-L02"]).at(-1).text
  ==="이 날에는 손님이 원했던 음식에 대한 단서가 있어. 그 말에 맞는 음식을 준비해 보자.",
  "회귀 영업일지는 기록 확인 뒤 실제 상태에 맞는 안내를 이어서 표시해야 합니다.");
recordStorySceneOutcome(STORY_SCENES["SCN-G1-맛있다"]);
getStoryGuestResult("rainyChild").evaluationScore=73;
const rainyResult=getStoryGuestResult("rainyChild");
assert(rainyResult.evaluationTier==="warm"&&rainyResult.fragmentState==="partial"
  &&rainyResult.fragmentName==="첫 빗방울"&&!rainy.previouslyObtainedPartial
  &&!rainy.previouslyObtainedFull&&!rainy.shardOwned,
  "G1~G7 맛있다는 이번 회차 부분 조각만 만들고 과거 기록을 즉시 오염시키면 안 됩니다.");
rainyResult.evaluationScore=73;
storySession={scene:STORY_SCENES["SCN-G1-A"],suspended:true,pendingCook:null};
applyStoryCookingResult({
  guestId:"rainyChild",storySceneId:"SCN-G1-A",
  storyDishId:"kimchi",dishId:"oden",specialRecipe:true
},99);
storySession=null;
assert(rainyResult.evaluationTier==="warm"&&rainyResult.evaluationScore===73
  &&rainyResult.fragmentState==="partial",
  "오답 음식은 이미 받은 최근 평가와 달빛 조각도 변경하면 안 됩니다.");
state.story.pendingResultSceneId=null;

recordStorySceneOutcome(STORY_SCENES["SCN-G2-완벽"]);
getStoryGuestResult("lanternGuest").evaluationScore=91;
state.story.completed.keepAcrossLoop=true;
state.story.seenScenes.keepAcrossLoop=true;
archiveCurrentStoryLoopResults();
const lantern=getStoryGuestState("lanternGuest");
assert(rainy.previousLoopTier==="warm"&&rainy.previousLoopScore===73
  &&rainy.previousLoopFragmentState==="partial"
  &&rainy.previouslyObtainedPartial&&!rainy.previouslyObtainedFull,
  "부분 조각은 회귀 직전에 직전 회차 기록과 부분 획득 이력으로 병합되어야 합니다.");
assert(lantern.previousLoopTier==="great"&&lantern.previousLoopScore===91
  &&lantern.previousLoopFragmentState==="full"
  &&!lantern.previouslyObtainedPartial&&lantern.previouslyObtainedFull,
  "완전 조각 이력은 부분 조각 이력과 독립적으로 병합되어야 합니다.");
assert(STORY_GUEST_IDS.every(id=>{
  const result=getStoryGuestResult(id);
  return !result.visited&&result.evaluationTier==null&&result.evaluationScore==null
    &&result.reactionSceneId==null&&result.fragmentState==="none"
    &&result.fragmentName==null&&result.seenStoryScenes.length===0;
}),"회귀 병합 뒤 현재 회차의 방문·평가·조각·본 장면은 모두 초기화되어야 합니다.");
assert(state.story.completed.keepAcrossLoop&&state.story.seenScenes.keepAcrossLoop,
  "회귀 병합은 completed와 전역 seenScenes 기록을 지우면 안 됩니다.");
assert(rainy.seenStoryScenes.includes("SCN-G1-B")&&rainy.seenStoryScenes.includes("SCN-G1-맛있다")
  &&lantern.seenStoryScenes.includes("SCN-G2-완벽"),
  "현재 회차에 본 손님 장면은 과거 손님 기록으로 중복 없이 병합되어야 합니다.");

const dayOnePage=getGameplayJournalPages().find(page=>page.day===1);
const rainyPage=dayOnePage.entries.find(entry=>entry.guestId==="rainyChild");
assert(dayOnePage.recorded&&rainyPage
  &&rainyPage.dishNote.includes("김치전")
  &&rainyPage.reactionNote==="“맞아요. 비 오는 날 누군가랑 같이 먹었어요. 그런데 비가 그치면 그 사람도 떠날 것 같았어요.”"
  &&rainyPage.shardNote.includes("첫 빗방울")
  &&!("previousLoopEvaluation" in rainyPage)
  &&!("revealedStory" in rainyPage)
  &&!("currentLoopEvaluation" in rainyPage),
  "날짜별 영업일지는 회차별 시스템 필드 대신 손님·음식·반응·조각을 자연스럽게 기록해야 합니다.");

const journalStoryBeforeReactionTests=state.story;
state.story=createStoryState();
recordStorySceneOutcome(STORY_SCENES["SCN-G1-A"]);
let dayOneEntry=getGameplayJournalPages().find(page=>page.day===1)
  .entries.find(entry=>entry.guestId==="rainyChild");
assert(dayOneEntry?.reactionNote==="",
  "손님을 만났지만 결과 반응이 아직 없으면 영업일지에 평가 없음 문구를 만들면 안 됩니다.");
recordStorySceneOutcome(STORY_SCENES["SCN-G1-B"]);
dayOneEntry=getGameplayJournalPages().find(page=>page.day===1)
  .entries.find(entry=>entry.guestId==="rainyChild");
assert(dayOneEntry?.reactionNote===[
  "“이 음식이 아니에요, 그래도 생각해 주셔서 감사합니다.”",
  "“제가 먹고싶은 음식은 팬 위에서 둥글게 퍼지고, 빗소리처럼 지글거리는 음식이에요”"
].join("\\n"),
"음식 미준비·오답 기록에는 판정명 대신 해당 손님이 실제 한 말을 모두 남겨야 합니다.");

state.story=createStoryState();
recordStorySceneOutcome(STORY_SCENES["SCN-G3-맛있다"]);
const twinEntry=getGameplayJournalPages().find(page=>page.day===3)
  .entries.find(entry=>entry.guestId==="twinShadows");
assert(twinEntry?.reactionNote===[
  "“나는 떠나고 싶었어.”",
  "“나는 남고 싶었어.”"
].join("\\n"),
"둘이 붙은 그림자는 왼쪽·오른쪽 그림자의 실제 반응을 모두 기록해야 합니다.");

state.story=createStoryState();
recordStorySceneOutcome(STORY_SCENES["SCN-G8-B"]);
let daySevenEntry=getGameplayJournalPages().find(page=>page.day===7)
  .entries.find(entry=>entry.guestId==="facelessDaeun");
assert(daySevenEntry?.guestName==="얼굴 없는 손님"
  &&daySevenEntry.reactionNote===[
    "“이건 그날 우리가 나눠 먹던 음식이 아니야.”",
    "“굵은 면을 팬 하나에 넣고 급히 볶았어. 이름도 없이 다 같이 나눠 먹던 음식이었지.”"
  ].join("\\n"),
  "마지막 예약 손님의 정체 공개 전 영업일지는 이름을 숨기고 실제 오답 반응을 기록해야 합니다.");
recordStorySceneOutcome(STORY_SCENES["SCN-G8-완벽"]);
daySevenEntry=getGameplayJournalPages().find(page=>page.day===7)
  .entries.find(entry=>entry.guestId==="facelessDaeun");
assert(daySevenEntry?.guestName==="얼굴 없는 김다은"
  &&daySevenEntry.reactionNote===[
    "“나는 김다은. 네가 포기한 내일이야.”",
    "“우리가 붙잡은 달빛과 네 소원이 이 밤을 만들었어.”",
    "“아직 무엇을 할지 몰라도, 내일은 올 수 있어.”"
  ].join("\\n"),
  "마지막 예약 손님의 정체는 완벽 결과로 기억이 공개된 뒤에만 영업일지에 기록해야 합니다.");
assert(![rainyPage,dayOneEntry,twinEntry,daySevenEntry].some(entry=>
  /(평가 기록:|아쉽다|맛있다|완벽|평가 없음|미평가)/.test(entry?.reactionNote||"")
),"영업일지의 손님 반응에는 내부 판정명이나 평가 없음 문구가 노출되면 안 됩니다.");
assert([rainyPage,dayOneEntry,twinEntry,daySevenEntry].every(entry=>
  (entry?.reactionNote||"").split("\\n").filter(Boolean)
    .every(line=>/^“.*”$/.test(line)&&!/^'.*'$/.test(line))
),"영업일지의 손님 반응은 기존 큰따옴표를 유지하고 김다은 속말용 작은따옴표를 쓰면 안 됩니다.");
state.story=journalStoryBeforeReactionTests;

recordStorySceneOutcome(STORY_SCENES["SCN-G1-B"]);
archiveCurrentStoryLoopResults();
assert(rainy.previousLoopTier==="warm"&&rainy.previousLoopScore===73
  &&rainy.previousLoopReactionSceneId==="SCN-G1-B"
  &&rainy.clueFound&&rainy.previousLoopVisited,
  "음식 미준비 회차는 단서와 방문만 남기고 과거 실제 평가를 지우면 안 됩니다.");
const rainyAfterMissingLoop=getGameplayJournalPages().find(page=>page.day===1)
  .entries.find(entry=>entry.guestId==="rainyChild");
assert(rainyAfterMissingLoop?.reactionNote.startsWith(
  "“이 음식이 아니에요, 그래도 생각해 주셔서 감사합니다.”"
),"음식 미준비 반응은 과거 평가 수치를 지우지 않으면서도 직전 회차 멘트로 남아야 합니다.");

state.story=createStoryState();
recordStorySceneOutcome(STORY_SCENES["SCN-G1-맛있다"]);
assert(storyFragmentCounts().count===1&&storyFragmentCounts().partial===1,
  "한 손님의 부분 조각은 현재 회차 조각 슬롯 하나만 차지해야 합니다.");
recordStorySceneOutcome(STORY_SCENES["SCN-G1-완벽"]);
assert(storyFragmentCounts().count===1&&storyFragmentCounts().partial===0
  &&storyFragmentCounts().full===1,
  "같은 손님의 부분 조각이 완전 조각으로 바뀌어도 중복 계산하면 안 됩니다.");
recordStorySceneOutcome(STORY_SCENES["SCN-G1-아쉽다"]);
assert(getStoryGuestResult("rainyChild").evaluationTier==="soft"
  &&getStoryGuestResult("rainyChild").fragmentState==="full"
  &&storyFragmentCounts().count===1&&storyFragmentCounts().full===1
  &&getStoryGuestState("rainyChild").revealedStoryLevel===3,
  "동일 회차 재평가가 낮아져도 이미 얻은 완전 조각과 공개 이야기는 유지해야 합니다.");

// 구 구조의 누적 조각은 과거 기록으로만 이관하고 새 회차 조각으로
// 자동 지급하면 안 됩니다.
const legacyStory=createStoryState();
legacyStory.schemaVersion=3;
delete legacyStory.guestResults;
legacyStory.guestState.rainyChild.shardOwned=true;
legacyStory.guestState.rainyChild.currentTier="great";
legacyStory.guestState.rainyChild.currentScore=88;
const migratedStory=normalizeStoryState(legacyStory);
assert(migratedStory.schemaVersion===4
  &&migratedStory.guestState.rainyChild.previouslyObtainedFull
  &&!migratedStory.guestState.rainyChild.shardOwned
  &&migratedStory.guestState.rainyChild.currentTier==null
  &&migratedStory.guestResults.rainyChild.fragmentState==="none"
  &&migratedStory.guestResults.rainyChild.evaluationTier==null,
  "구 저장의 누적 완벽 기록이 새 회차 평가나 조각으로 이관되면 안 됩니다.");
const legacyWarmStory=createStoryState();
legacyWarmStory.schemaVersion=3;
delete legacyWarmStory.guestResults;
legacyWarmStory.guestState.rainyChild.currentTier="warm";
legacyWarmStory.guestState.rainyChild.currentScore=72;
const migratedWarmStory=normalizeStoryState(legacyWarmStory);
assert(migratedWarmStory.guestState.rainyChild.previousLoopTier==="warm"
  &&!migratedWarmStory.guestState.rainyChild.previouslyObtainedPartial
  &&migratedWarmStory.guestState.rainyChild.previousLoopFragmentState==="none"
  &&migratedWarmStory.guestResults.rainyChild.fragmentState==="none",
  "부분 조각 제도 이전의 맛있다 평가는 허위 부분 조각 이력으로 추론하면 안 됩니다.");
const invalidG8Story=createStoryState();
invalidG8Story.guestResults.facelessDaeun.fragmentState="partial";
invalidG8Story.guestResults.facelessDaeun.fragmentName="김다은의 내일";
const normalizedInvalidG8=normalizeStoryState(invalidG8Story);
assert(normalizedInvalidG8.guestResults.facelessDaeun.fragmentState==="none"
  &&normalizedInvalidG8.guestResults.facelessDaeun.fragmentName==null,
  "손상된 저장의 G8 부분 조각은 존재하지 않는 상태이므로 미획득으로 교정해야 합니다.");

// G8과 7일차 엔딩은 과거 기록이 아니라 이번 회차 조각만 봅니다.
state.story=createStoryState();
STORY_GUEST_IDS.slice(0,7).forEach(id=>{getStoryGuestState(id).previouslyObtainedFull=true;});
state.day=7;
state.selectedMenus=["oden","tofu","kimchi","skewer","tteokbokki"];
assert(!storyGuestArrivalForDay(7).some(scene=>scene.id==="SCN-G8-A")
  &&storySceneIdsForMoment("nightEnd",7)[0]==="SCN-J01",
  "과거 기본 조각 7개만으로 G8 또는 중간 엔딩이 열리면 안 됩니다.");

STORY_GUEST_IDS.slice(0,6).forEach(id=>{getStoryGuestResult(id).fragmentState="full";});
getStoryGuestResult("schoolDoll").fragmentState="partial";
same(storyFragmentCounts({baseOnly:true}),{count:7,partial:1,full:6},
  "현재 회차 기본 손님의 부분·완전 조각 계산");
assert(!storyGuestArrivalForDay(7).some(scene=>scene.id==="SCN-G8-A")
  &&storySceneIdsForMoment("nightEnd",7)[0]==="SCN-J02",
  "기본 조각이 일곱 개여도 완전 조각이 아니면 G8은 등장하지 않아야 합니다.");
assert(!storyNightPlanReady({requiredBaseShards:7,triggerTiming:"after",triggerAfterGeneral:6}),
  "과거 조각 또는 현재 부분 조각을 G8 실제 등장 준비 조건에 쓰면 안 됩니다.");

getStoryGuestResult("schoolDoll").fragmentState="full";
state.generalServed=6;
state.generalSpawnedCustomers=6;
state.generalSatisfactionTotal=480;
same(storyFragmentCounts({baseOnly:true}),{count:7,partial:0,full:7},
  "기본 손님 7명의 완전 조각 계산");
assert(storyGuestArrivalForDay(7).some(scene=>scene.id==="SCN-G8-A"),
  "이번 회차 기본 완전 조각 7개를 모아야 마지막 예약 손님이 등장해야 합니다.");
assert(storyNightPlanReady({requiredBaseShards:7,triggerTiming:"after",triggerAfterGeneral:6}),
  "현재 회차 기본 완전 조각 7개와 등장 시점을 만족하면 G8 계획이 준비되어야 합니다.");
prepareStoryNight();
assert(state.story.pendingNightGuests.some(plan=>plan.sceneId==="SCN-G8-A"),
  "기본 완전 조각 7개를 모으면 7일차 마지막 예약 손님 계획을 준비해야 합니다.");
recordStorySceneOutcome(STORY_SCENES["SCN-G8-맛있다"]);
assert(getStoryGuestResult("facelessDaeun").fragmentState==="none"
  &&storyFragmentCounts().count===7
  &&storySceneIdsForMoment("nightEnd",7)[0]==="SCN-J02",
  "G8 맛있다는 조각을 주지 않으며 일곱 조각 엔딩 판정을 유지해야 합니다.");
recordStorySceneOutcome(STORY_SCENES["SCN-G8-완벽"]);
same(storyFragmentCounts(),{count:8,partial:0,full:8},
  "G8 완벽을 포함한 현재 회차 완전 조각 여덟 개 계산");
assert(storySceneIdsForMoment("nightEnd",7)[0]==="SCN-J03"
  &&storySceneAvailable(STORY_SCENES["SCN-J03"])
  &&!storySceneAvailable(STORY_SCENES["SCN-J02"]),
  "현재 회차 완전 조각 여덟 개일 때만 최종 엔딩 선택 판정으로 가야 합니다.");

state.story=createStoryState();
STORY_GUEST_IDS.slice(0,3).forEach(id=>{getStoryGuestResult(id).fragmentState="partial";});
assert(storySceneIdsForMoment("nightEnd",7)[0]==="SCN-J01",
  "현재 회차 부분·완전 조각 합계 3개는 자동 회귀 판정이어야 합니다.");
getStoryGuestResult("crowCourier").fragmentState="partial";
assert(storySceneIdsForMoment("nightEnd",7)[0]==="SCN-J02",
  "현재 회차 부분·완전 조각 합계 4개는 중간 엔딩 판정이어야 합니다.");

// 영업 마감 때는 그날의 기록 장을 닫기 전까지 다음 흐름, 특히 Day 7
// 엔딩 판정을 시작하지 않습니다. 닫은 사실은 저장 상태에 남습니다.
state.story=createStoryState();
state.day=3;
state.phase=GAME_PHASES.RESULT;
openedGameplayJournalPage=null;
let dayThreeJournalContinued=false;
queueStoryMoments(["nightEnd"],()=>{dayThreeJournalContinued=true;});
assert(openedGameplayJournalPage==="gameplay-day-3"
  &&!storyDailyJournalWasShown(3)
  &&!storySession
  &&!dayThreeJournalContinued,
  "3일차 종료 직후에는 3일차 영업일지가 먼저 열리고 다음 진행은 대기해야 합니다.");
resumeStoryAfterJournal();
assert(storyDailyJournalWasShown(3)&&dayThreeJournalContinued,
  "영업일지를 닫은 뒤에만 그날 마감 흐름이 이어져야 합니다.");
assert(normalizeStoryState(state.story).dailyJournalShownDays["3"]===true,
  "닫은 영업일지 날짜는 저장·불러오기 뒤에도 유지되어 같은 마감에 다시 열리지 않아야 합니다.");

state.story=createStoryState();
state.day=7;
state.phase=GAME_PHASES.RESULT;
openedGameplayJournalPage=null;
const realPlayStoryScenes=playStoryScenes;
let queuedAfterDaySevenJournal=[];
playStoryScenes=ids=>{queuedAfterDaySevenJournal=[...ids];return true;};
queueStoryMoments(["nightEnd"]);
assert(openedGameplayJournalPage==="gameplay-day-7"
  &&queuedAfterDaySevenJournal.length===0
  &&!storySession,
  "7일차 영업일지를 닫기 전에는 엔딩 판정 장면을 큐에 넣으면 안 됩니다.");
resumeStoryAfterJournal();
same(queuedAfterDaySevenJournal,["SCN-J01"],
  "7일차 영업일지를 닫은 뒤에만 현재 조각 수에 맞는 엔딩 판정을 시작해야 합니다.");
playStoryScenes=realPlayStoryScenes;

state.story=createStoryState();
state.day=7;
state.story.completed.persistedScene=true;
state.story.seenScenes.persistedScene=true;
state.story.dailyJournalShownDays={"7":true};
state.story.storyCookResults.current={score:65,tier:"warm",day:7,dishId:"kimchi"};
const loopResult=getStoryGuestResult("rainyChild");
loopResult.visited=true;
loopResult.evaluationTier="warm";
loopResult.evaluationScore=65;
loopResult.fragmentState="partial";
loopResult.fragmentName="첫 빗방울";
loopResult.seenStoryScenes=["SCN-G1-A","SCN-G1-맛있다"];
const realQueueStoryMoments=queueStoryMoments;
queueStoryMoments=()=>true;
beginNextStoryLoop();
queueStoryMoments=realQueueStoryMoments;
assert(state.story.loop===2&&state.day===1
  &&state.story.guestState.rainyChild.previousLoopTier==="warm"
  &&state.story.guestState.rainyChild.previousLoopScore===65
  &&state.story.guestState.rainyChild.previouslyObtainedPartial
  &&getStoryGuestResult("rainyChild").fragmentState==="none"
  &&getStoryGuestResult("rainyChild").evaluationTier==null
  &&Object.keys(state.story.storyCookResults).length===0
  &&Object.keys(state.story.dailyJournalShownDays).length===0
  &&state.story.completed.persistedScene&&state.story.seenScenes.persistedScene,
  "beginNextStoryLoop는 먼저 현재 결과를 병합한 뒤 루프·Day1을 갱신하고 현재 결과만 초기화해야 합니다.");

console.log("STORY_CONTRACT_OK 61");
`;

const context = {
  console: {
    log: message => process.stdout.write(String(message)+"\n"),
    warn() {}
  },
  Math,
  Date,
  JSON,
  Object,
  Array,
  Set,
  Map,
  Number,
  String,
  Boolean,
  RegExp,
  Error,
  URL,
  gameSource,
  setTimeout,
  clearTimeout
};

vm.runInNewContext(
  [bootstrap, ...sources, test].join("\n;\n"),
  context,
  { filename: "story-contract-smoke.bundle.js" }
);
