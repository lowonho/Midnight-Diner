"use strict";

// 대본 데이터와 게임 로직을 분리하는 스토리 실행기입니다.
// 특별 손님의 묘사형 호칭은 가명이나 미공개 이름이 아니라 실제 표시명입니다.
const STORY_GUEST_IDS=[
  "rainyChild","lanternGuest","twinShadows","crowCourier",
  "starBeast","seawaterGuest","schoolDoll","facelessDaeun"
];
let storySession=null;
let storyTypingTimer=null;
let storyRevealTimer=null;
let storySceneIntroTimer=null;
let storySubtitleMeasureEl=null;
let storySubtitleResizeTimer=null;
let storyUiInitialized=false;
let pendingEndingRetryAction=null;
const STORY_CHECKPOINT_VERSION=1;
const STORY_SCENE_INTRO_DURATION=1700;
const STORY_GAME_UI_VISIBLE_CLASS="show-game-ui";
const STORY_SUBTITLE_MAX_LINES=2;

function createStoryGuestState(){
  return {
    nameRevealed:true,
    affinity:0,
    arcStep:0,
    regular:false,
    visits:0,
    lastVisitDay:0,
    clueFound:false,
    foodConfirmed:false,
    memoryUnlocked:false,
    shardOwned:false,
    // 최근 평가는 오르내릴 수 있지만, 한 번 공개된 손님 이야기는 다시
    // 잠기지 않아야 하므로 공개 단계는 별도로 최고 단계만 누적합니다.
    revealedStoryLevel:0,
    previousLoopVisited:false,
    previousLoopTier:null,
    previousLoopScore:null,
    previousLoopReactionSceneId:null,
    previousLoopFragmentState:"none",
    previouslyObtainedPartial:false,
    previouslyObtainedFull:false,
    seenStoryScenes:[],
    // 구 저장 호환을 위해 키는 남기되 현재 회차 데이터로 사용하지 않습니다.
    currentTier:null,
    currentScore:null
  };
}

function createStoryGuestResult(){
  return {
    visited:false,
    evaluationTier:null,
    evaluationScore:null,
    reactionSceneId:null,
    fragmentState:"none",
    fragmentName:null,
    seenStoryScenes:[]
  };
}

function createStoryState(){
  return {
    schemaVersion:4,
    loop:1,
    prologueComplete:false,
    completed:{},
    seenScenes:{},
    choices:{},
    guestState:Object.fromEntries(STORY_GUEST_IDS.map(id=>[id,createStoryGuestState()])),
    guestResults:Object.fromEntries(STORY_GUEST_IDS.map(id=>[id,createStoryGuestResult()])),
    flags:{},
    pendingNightGuests:[],
    specialServedDays:{},
    specialHandledDays:{},
    storyCookResults:{},
    activeStoryCook:null,
    pendingResultSceneId:null,
    endingSeen:false,
    endingsSeen:{},
    judgmentComplete:false,
    legacyImported:false
  };
}

function normalizeStoryState(raw){
  const base=createStoryState();
  if(!raw||typeof raw!=="object")return base;
  base.schemaVersion=4;
  base.loop=Math.max(1,Math.floor(Number(raw.loop)||1));
  base.prologueComplete=!!raw.prologueComplete;
  base.completed={...(raw.completed||{})};
  base.seenScenes={...(raw.seenScenes||raw.completed||{})};
  base.choices={...(raw.choices||{})};
  base.flags={...(raw.flags||{})};
  base.pendingNightGuests=Array.isArray(raw.pendingNightGuests)
    ?raw.pendingNightGuests
      .filter(plan=>plan&&typeof plan.guestId==="string")
      .map(plan=>({
        ...plan,
        sceneId:plan.sceneId||null,
        dishId:typeof plan.dishId==="string"?plan.dishId:null,
        arrival:["early","late","last"].includes(plan.arrival)?plan.arrival:"early",
        deferUntilArrival:!!plan.deferUntilArrival,
        guestOrder:plan.guestOrder!==false,
        special:!!plan.special,
        repeat:!!plan.repeat
      }))
    :raw.pendingSpecialGuest?[{
      guestId:raw.pendingSpecialGuest,sceneId:null,dishId:null,arrival:"early",
      deferUntilArrival:false,guestOrder:true,special:true,repeat:false
    }]:[];
  base.specialServedDays={...(raw.specialServedDays||{})};
  base.specialHandledDays={...(raw.specialHandledDays||{})};
  base.storyCookResults={...(raw.storyCookResults||{})};
  base.activeStoryCook=null;
  base.pendingResultSceneId=typeof raw.pendingResultSceneId==="string"&&STORY_SCENES[raw.pendingResultSceneId]
    ?raw.pendingResultSceneId:null;
  base.endingSeen=!!raw.endingSeen;
  base.endingsSeen={...(raw.endingsSeen||{})};
  base.judgmentComplete=!!raw.judgmentComplete;
  base.legacyImported=!!raw.legacyImported;
  const hasSeparatedGuestResults=!!(
    raw.guestResults&&typeof raw.guestResults==="object"&&!Array.isArray(raw.guestResults)
  );
  STORY_GUEST_IDS.forEach(id=>{
    const saved=raw.guestState?.[id]||{};
    base.guestState[id]={...createStoryGuestState(),...saved};
    base.guestState[id].nameRevealed=!!base.guestState[id].nameRevealed;
    base.guestState[id].regular=!!base.guestState[id].regular;
    base.guestState[id].clueFound=!!base.guestState[id].clueFound;
    base.guestState[id].foodConfirmed=!!base.guestState[id].foodConfirmed;
    base.guestState[id].memoryUnlocked=!!base.guestState[id].memoryUnlocked;
    base.guestState[id].shardOwned=!!base.guestState[id].shardOwned;
    base.guestState[id].revealedStoryLevel=clamp(
      Math.floor(Number(base.guestState[id].revealedStoryLevel)||0),0,3
    );
    const previousTier=["soft","warm","great"].includes(base.guestState[id].previousLoopTier)
      ?base.guestState[id].previousLoopTier
      :["soft","warm","great"].includes(base.guestState[id].currentTier)
        ?base.guestState[id].currentTier:null;
    const previousScore=Number.isFinite(base.guestState[id].previousLoopScore)
      ?base.guestState[id].previousLoopScore
      :Number.isFinite(base.guestState[id].currentScore)?base.guestState[id].currentScore:null;
    base.guestState[id].previousLoopVisited=!!base.guestState[id].previousLoopVisited;
    base.guestState[id].previousLoopTier=previousTier;
    base.guestState[id].previousLoopScore=Number.isFinite(previousScore)
      ?clamp(previousScore,0,100):null;
    base.guestState[id].previousLoopReactionSceneId=
      typeof base.guestState[id].previousLoopReactionSceneId==="string"
      &&STORY_SCENES[base.guestState[id].previousLoopReactionSceneId]
        ?base.guestState[id].previousLoopReactionSceneId:null;
    base.guestState[id].previousLoopFragmentState=["none","partial","full"].includes(
      base.guestState[id].previousLoopFragmentState
    )?base.guestState[id].previousLoopFragmentState:"none";
    base.guestState[id].previouslyObtainedPartial=!!(
      base.guestState[id].previouslyObtainedPartial
      ||base.guestState[id].previousLoopFragmentState==="partial"
    );
    base.guestState[id].previouslyObtainedFull=!!(
      base.guestState[id].previouslyObtainedFull
      ||base.guestState[id].previousLoopFragmentState==="full"
      ||base.guestState[id].shardOwned
    );
    if(!hasSeparatedGuestResults&&base.guestState[id].previousLoopFragmentState==="none"){
      if(base.guestState[id].previouslyObtainedFull)base.guestState[id].previousLoopFragmentState="full";
    }
    base.guestState[id].seenStoryScenes=Array.isArray(base.guestState[id].seenStoryScenes)
      ?[...new Set(base.guestState[id].seenStoryScenes.filter(sceneId=>typeof sceneId==="string"&&STORY_SCENES[sceneId]))]
      :[];
    base.guestState[id].shardOwned=false;
    base.guestState[id].currentTier=null;
    base.guestState[id].currentScore=null;
    ["affinity","arcStep","visits","lastVisitDay"].forEach(key=>{
      if(!Number.isFinite(base.guestState[id][key]))base.guestState[id][key]=0;
    });

    // v3까지의 guestState는 누적 기록이므로 새 회차 결과로 복사하지
    // 않습니다. 그렇지 않으면 과거 완벽 기록만으로 조각이 다시 생깁니다.
    const savedResult=hasSeparatedGuestResults?raw.guestResults[id]||{}:{};
    const result={...createStoryGuestResult(),...savedResult};
    result.visited=!!result.visited;
    result.evaluationTier=["soft","warm","great"].includes(result.evaluationTier)
      ?result.evaluationTier:null;
    result.evaluationScore=Number.isFinite(result.evaluationScore)
      ?clamp(result.evaluationScore,0,100):null;
    result.reactionSceneId=typeof result.reactionSceneId==="string"
      &&STORY_SCENES[result.reactionSceneId]
      ?result.reactionSceneId:null;
    result.fragmentState=["none","partial","full"].includes(result.fragmentState)
      ?result.fragmentState:"none";
    if(id==="facelessDaeun"&&result.fragmentState==="partial")result.fragmentState="none";
    result.fragmentName=typeof result.fragmentName==="string"&&result.fragmentName.trim()
      ?result.fragmentName:null;
    if(result.fragmentState==="none")result.fragmentName=null;
    result.seenStoryScenes=Array.isArray(result.seenStoryScenes)
      ?[...new Set(result.seenStoryScenes.filter(sceneId=>typeof sceneId==="string"&&STORY_SCENES[sceneId]))]
      :[];
    base.guestResults[id]=result;
  });
  return base;
}

function getStoryGuestState(id){
  if(!state.story)state.story=createStoryState();
  if(!state.story.guestState[id])state.story.guestState[id]=createStoryGuestState();
  return state.story.guestState[id];
}

function getStoryGuestResult(id){
  if(!state.story)state.story=createStoryState();
  if(!state.story.guestResults||typeof state.story.guestResults!=="object"){
    state.story.guestResults=Object.fromEntries(STORY_GUEST_IDS.map(guestId=>[
      guestId,createStoryGuestResult()
    ]));
  }
  if(!state.story.guestResults[id])state.story.guestResults[id]=createStoryGuestResult();
  return state.story.guestResults[id];
}

function storySceneProgressKey(sceneOrId){
  const scene=typeof sceneOrId==="string"?STORY_SCENES[sceneOrId]:sceneOrId;
  if(!scene)return typeof sceneOrId==="string"?sceneOrId:"";
  const loop=Math.max(1,Number(state.story?.loop)||1);
  if(scene.dynamicJournalHint||scene.repeatDaily||scene.repeatEachDay)return `${scene.id}@loop${loop}@day${state.day}`;
  if(scene.repeatEachLoop||["endingJudgement","ending","epilogue"].includes(scene.sceneType))return `${scene.id}@loop${loop}`;
  return scene.id;
}

function storySceneCompleted(sceneOrId){
  const key=storySceneProgressKey(sceneOrId);
  return !!(key&&state.story?.completed?.[key]);
}

function markStorySceneCompleted(scene){
  const key=storySceneProgressKey(scene);
  if(key)state.story.completed[key]=true;
  state.story.seenScenes[scene.id]=true;
}

function storyFragmentCounts({baseOnly=false}={}){
  const ids=baseOnly?STORY_GUEST_IDS.slice(0,7):STORY_GUEST_IDS;
  return ids.reduce((counts,id)=>{
    const fragmentState=getStoryGuestResult(id).fragmentState;
    if(fragmentState==="partial")counts.partial++;
    if(fragmentState==="full")counts.full++;
    counts.count=counts.partial+counts.full;
    return counts;
  },{count:0,partial:0,full:0});
}

function storyShardCount({baseOnly=false,fullOnly=false}={}){
  const counts=storyFragmentCounts({baseOnly});
  return fullOnly?counts.full:counts.count;
}

function storyTierRevealLevel(tier){
  return tier==="great"?3:tier==="warm"?2:tier==="soft"?1:0;
}

function storyEvaluationLabel(tier,score){
  const label=tier==="great"?"완벽":tier==="warm"?"맛있다":tier==="soft"?"아쉽다":"평가 없음";
  return Number.isFinite(Number(score))?`${label} · ${Math.round(Number(score))}점`:label;
}

function storyFragmentStateLabel(fragmentState){
  return fragmentState==="full"?"완전 획득":fragmentState==="partial"?"부분 획득":"미획득";
}

function storyFragmentStateForResult(scene,guestId){
  if(scene?.resultTier==="great"&&scene.grantsShard)return "full";
  // 마지막 예약 손님은 부분 조각을 남기지 않습니다. 일곱 조각을 이번
  // 회차에 모두 완성한 뒤, G8까지 완벽해야 여덟 번째 조각이 생깁니다.
  if(scene?.resultTier==="warm"&&guestId!=="facelessDaeun")return "partial";
  return "none";
}

function strongerStoryFragmentState(current,next){
  const rank={none:0,partial:1,full:2};
  return (rank[next]||0)>(rank[current]||0)?next:current;
}

function storySceneTitlesSeenForGuest(guestId){
  return (getStoryGuestState(guestId).seenStoryScenes||[])
    .map(sceneId=>STORY_SCENES[sceneId]?.title||sceneId);
}

const GAMEPLAY_JOURNAL_DAY_GUEST_IDS=Object.freeze([
  Object.freeze(["rainyChild"]),
  Object.freeze(["lanternGuest"]),
  Object.freeze(["twinShadows"]),
  Object.freeze(["crowCourier"]),
  Object.freeze(["starBeast"]),
  Object.freeze(["seawaterGuest"]),
  Object.freeze(["schoolDoll","facelessDaeun"])
]);

function storyJournalObjectParticle(word){
  const value=String(word||"").trim();
  if(!value)return "을";
  const last=value.charCodeAt(value.length-1);
  return last>=0xac00&&last<=0xd7a3&&(last-0xac00)%28!==0?"을":"를";
}

const STORY_JOURNAL_GUEST_SPEAKER_IDS=Object.freeze({
  twinShadows:Object.freeze(["leftShadow","rightShadow","twinShadows"]),
  facelessDaeun:Object.freeze(["facelessDaeun","anotherDaeun"])
});

function storyJournalGuestOutcomeScene(definition,guest,result){
  const arrival=storyGuestArrivalScenes().find(scene=>scene.character===definition.guestId);
  if(!arrival)return null;
  const resultSceneIds=Object.values(arrival.resultSceneIds||{});
  const outcomeSceneIds=[arrival.missingMenuSceneId,...resultSceneIds].filter(Boolean);
  const outcomeSceneIdSet=new Set(outcomeSceneIds);
  const lastSeenOutcome=sceneIds=>[...(sceneIds||[])]
    .reverse().find(sceneId=>outcomeSceneIdSet.has(sceneId))||null;
  const currentSceneId=(outcomeSceneIdSet.has(result.reactionSceneId)&&result.reactionSceneId)
    ||lastSeenOutcome(result.seenStoryScenes)
    ||(result.evaluationTier?arrival.resultSceneIds?.[result.evaluationTier]:null);
  if(currentSceneId&&STORY_SCENES[currentSceneId])return STORY_SCENES[currentSceneId];
  const previousSceneId=(outcomeSceneIdSet.has(guest.previousLoopReactionSceneId)
    &&guest.previousLoopReactionSceneId)
    ||(guest.previousLoopTier?arrival.resultSceneIds?.[guest.previousLoopTier]:null)
    ||(guest.previousLoopVisited?lastSeenOutcome(guest.seenStoryScenes):null);
  return previousSceneId?STORY_SCENES[previousSceneId]||null:null;
}

function storyJournalGuestReactionNote(definition,guest,result){
  const scene=storyJournalGuestOutcomeScene(definition,guest,result);
  if(!scene)return "";
  const speakerIds=new Set(
    STORY_JOURNAL_GUEST_SPEAKER_IDS[definition.guestId]||[definition.guestId]
  );
  return (scene.lines||[])
    .filter(line=>speakerIds.has(line?.speaker)&&typeof line.text==="string"&&line.text.trim())
    .map(line=>`“${line.text.trim()}”`)
    .join("\n");
}

function gameplayJournalGuestRecord(definition){
  if(!definition)return null;
  const guest=state.story?.guestState?.[definition.guestId]||createStoryGuestState();
  const result=state.story?.guestResults?.[definition.guestId]||createStoryGuestResult();
  const recorded=!!(
    Number(guest.visits)>0||guest.previousLoopVisited||guest.clueFound||guest.foodConfirmed
    ||guest.revealedStoryLevel>0||guest.previouslyObtainedPartial
    ||guest.previouslyObtainedFull||result.visited
  );
  if(!recorded)return null;
  const currentFragmentState=["none","partial","full"].includes(result.fragmentState)
    ?result.fragmentState:"none";
  const hasKnownDish=!!guest.foodConfirmed;
  const hasClue=!!(guest.clueFound||hasKnownDish);
  // 판정명이나 점수 대신 그 결과 장면에서 손님이 실제로 한 말만 남깁니다.
  // 반응 장면 ID만 저장하고 문장은 STORY_SCENES에서 읽어 대본과 기록이 어긋나지 않게 합니다.
  const reactionNote=storyJournalGuestReactionNote(definition,guest,result);
  let shardNote="아직 달빛 조각은 받지 못했다.";
  const shardParticle=storyJournalObjectParticle(definition.shardName);
  if(currentFragmentState==="full")shardNote=`달빛 조각 「${definition.shardName}」${shardParticle} 건넸다.`;
  else if(currentFragmentState==="partial")shardNote=`달빛 조각 「${definition.shardName}」의 일부를 건넸다.`;
  else if(guest.previouslyObtainedFull)shardNote=`전에 달빛 조각 「${definition.shardName}」${shardParticle} 건넨 적이 있다.`;
  else if(guest.previouslyObtainedPartial)shardNote=`전에 달빛 조각 「${definition.shardName}」의 일부를 건넨 적이 있다.`;
  return {
    guestId:definition.guestId,
    guestName:definition.guestId==="facelessDaeun"
      &&!(guest.memoryUnlocked||Number(guest.revealedStoryLevel)>=3)
      ?(STORY_CHARACTERS.facelessDaeun?.name||"얼굴 없는 손님")
      :definition.displayName,
    clue:hasClue?definition.clue:"아직 음식에 관한 단서를 듣지 못했다.",
    dishNote:hasKnownDish
      ?`이 손님이 기억하는 음식은 ${definition.dishName}이었다.`
      :"아직 어떤 음식을 기억하는지는 알 수 없다.",
    reactionNote,
    shardNote
  };
}

// 식당 안에서 여는 진행용 영업일지는 오직 현재 state.story를 읽습니다.
// 첫 장은 규칙, 다음 여덟 장은 음식별 레시피, 마지막 일곱 장은 날짜별
// 기록입니다. 아직 만나지 않은 미래 손님의 이름·정답 음식은 미리 노출하지 않습니다.
function getGameplayJournalPages(){
  const definitionsByGuest=Object.fromEntries(
    GAMEPLAY_JOURNAL_PAGE_DEFS.map(definition=>[definition.guestId,definition])
  );
  const menusById=Object.fromEntries(MENU_DATA.map(menu=>[menu.id,menu]));
  const recipesByDish=Object.fromEntries(STORY_JOURNAL_RECIPES.map(recipe=>[recipe.dishId,recipe]));
  const menuNames=STORY_MENU_RULES.dishIds.map(id=>menusById[id]?.displayName).filter(Boolean);
  const menuRule="매일 영업일지에 적혀 있는 음식 중 다섯 가지를 골라 영업한다.";
  const total=1+STORY_MENU_RULES.dishIds.length+GAMEPLAY_JOURNAL_DAY_GUEST_IDS.length;
  const rulesPage={
    id:"gameplay-rules",
    pageType:"rules",
    index:0,
    number:1,
    total,
    title:"영업일지 주의사항",
    label:"주의사항",
    tabLabel:"주의사항",
    dayLabel:"주의사항",
    unlocked:true,
    locked:false,
    rules:[
      menuRule,
      "손님에게 항상 친절하게 대한다."
    ],
    menuRule,
    menuNames
  };
  const recipePages=STORY_MENU_RULES.dishIds.map((dishId,index)=>{
    const menu=menusById[dishId];
    const recipe=recipesByDish[dishId];
    return {
      id:`gameplay-recipe-${dishId}`,
      pageType:"recipe",
      index:index+1,
      number:index+2,
      total,
      recipeNumber:index+1,
      dishId,
      dishName:menu?.displayName||dishId,
      title:`${menu?.displayName||dishId} 레시피`,
      label:`${menu?.displayName||dishId} 레시피`,
      tabLabel:menu?.displayName||dishId,
      unlocked:true,
      locked:false,
      ingredients:[...(recipe?.ingredients||[])],
      prepSteps:[...(recipe?.prepSteps||[])],
      cookSteps:[...(recipe?.cookSteps||[])]
    };
  });
  const dayPages=GAMEPLAY_JOURNAL_DAY_GUEST_IDS.map((guestIds,index)=>{
    const day=index+1;
    const pageIndex=1+recipePages.length+index;
    const entries=guestIds
      .map(guestId=>gameplayJournalGuestRecord(definitionsByGuest[guestId]))
      .filter(Boolean);
    return {
      id:`gameplay-day-${day}`,
      pageType:"day",
      index:pageIndex,
      number:pageIndex+1,
      total,
      day,
      dayLabel:`${day}일차`,
      title:`${day}일차 기록`,
      label:`${day}일차 기록`,
      tabLabel:`${day}일차`,
      unlocked:true,
      locked:false,
      recorded:entries.length>0,
      entries
    };
  });
  return [rulesPage,...recipePages,...dayPages];
}

window.getGameplayJournalPages=getGameplayJournalPages;

function storyGuestArrivalScenes(){
  return Object.values(STORY_SCENES).filter(scene=>scene?.specialGuest===true&&/^SCN-G\d+-A$/.test(scene.id));
}

function storyGuestArrivalForDay(day=state.day,{includeFinal=true}={}){
  return storyGuestArrivalScenes().filter(scene=>{
    if(Number(scene.day)!==Number(day))return false;
    if(scene.id==="SCN-G8-A")return includeFinal&&storyShardCount({baseOnly:true,fullOnly:true})===7;
    return true;
  });
}

function storyPrimaryGuestForDay(day=state.day){
  return storyGuestArrivalForDay(day,{includeFinal:false})[0]||null;
}

function recordStoryJournalGuest(guestId,scene=null){
  const character=STORY_CHARACTERS[guestId];
  const api=window.MoonlightTableSave;
  const guest=getStoryGuestState(guestId);
  const result=getStoryGuestResult(guestId);
  // 타이틀 영업일지는 완벽 평가를 받은 손님만 해금합니다. 만남·단서·낮은
  // 평가는 현재 진행 세이브의 guestState에만 남습니다.
  if(!character||!api?.recordGuest
    ||!(guest.previouslyObtainedFull||result.fragmentState==="full"))return null;
  const definition=GAMEPLAY_JOURNAL_PAGE_DEFS.find(page=>page.guestId===guestId);
  const gameplayRecord=gameplayJournalGuestRecord(definition);
  return api.recordGuest(guestId,{
    unlocked:true,
    perfect:true,
    label:definition?.displayName||character.name,
    day:Number(scene?.day)||Number(state.day)||1,
    dishId:definition?.dishId||scene?.dishId||null,
    shardId:definition?.shardId||scene?.shardId||null,
    reactionNote:gameplayRecord?.reactionNote||"",
    note:"완벽 평가 · 기억 회복"
  });
}

function recordStoryJournalShard(scene,guestId){
  const api=window.MoonlightTableSave;
  if(!api?.recordFragment||!scene?.shardId)return null;
  return api.recordFragment(scene.shardId,{
    label:scene.shardName||scene.shardId,
    day:Number(scene.day)||Number(state.day)||1,
    guestId
  });
}

function recordStoryJournalEnding(scene){
  const api=window.MoonlightTableSave;
  if(!api?.recordEnding||!scene?.id)return null;
  const definition=TITLE_JOURNAL_ENDING_DEFS.find(ending=>ending.id===scene.id);
  const entry=api.recordEnding(scene.id,{
    unlocked:true,
    label:definition?.title||scene.title||scene.id,
    note:`루프 ${state.story?.loop||1}`
  });
  if(entry?.newlyUnlocked){
    showToast(`영업일지에 새 엔딩 「${definition?.title||scene.title||scene.id}」이 기록되었습니다.`);
  }
  return entry;
}

function isCharacterNameRevealed(id){
  const character=STORY_CHARACTERS[id];
  if(!character)return true;
  if(character.alwaysKnown)return true;
  return !!state.story?.guestState?.[id]?.nameRevealed;
}

function storyDisplayName(id){
  if(!id)return "";
  const character=STORY_CHARACTERS[id];
  if(!character)return id;
  return isCharacterNameRevealed(id)?character.name:"???";
}

function storySpeakerLabel(line){
  if(line?.speaker)return storyDisplayName(line.speaker);
  return typeof line?.speakerLabel==="string"?line.speakerLabel.trim():"";
}

function storySceneShowsIntroCard(scene){
  return !["specialGuestArrival","specialGuestMissing","specialGuestResult"].includes(scene?.sceneType);
}

function storySceneCardText(scene){
  if(!scene)return "";
  if(!storySceneShowsIntroCard(scene))return STORY_CHARACTERS[scene.character]?.name||"특별 손님";
  // SCN-P01, END-01 같은 문자열은 진행을 위한 내부 식별자입니다.
  // 플레이어에게는 자연스러운 장면 제목만 보여 줍니다.
  return String(scene.title||"").trim();
}

function storySceneDayLabel(scene){
  if(scene?.moment==="newGame")return "PROLOGUE";
  return `DAY ${Number(scene?.day)||Number(state.day)||1}`;
}

function setStoryGameUiVisible(visible){
  document.getElementById("storyOverlay")?.classList.toggle(STORY_GAME_UI_VISIBLE_CLASS,!!visible);
}

function clearStorySceneIntro(){
  if(storySceneIntroTimer){clearTimeout(storySceneIntroTimer);storySceneIntroTimer=null;}
  document.getElementById("storySceneMeta")?.classList.remove("show");
  document.getElementById("storyOverlay")?.classList.remove("scene-intro");
  if(storySession)storySession.sceneIntroActive=false;
}

function finishStorySceneIntro(){
  if(!storySession?.sceneIntroActive)return false;
  clearStorySceneIntro();
  showStoryLine();
  return true;
}

function showStorySceneIntro(){
  if(!storySession?.scene)return false;
  clearStorySceneIntro();
  // 특별 손님 장면은 대화 자체가 등장 연출입니다. 내부 장면 코드와
  // 아쉽다/맛있다/완벽 같은 결과명이 적힌 메타 카드는 표시하지 않습니다.
  if(!storySceneShowsIntroCard(storySession.scene)){
    showStoryLine();
    return false;
  }
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){
    showStoryLine();
    return false;
  }
  storySession.sceneIntroActive=true;
  document.getElementById("storySceneMeta")?.classList.add("show");
  document.getElementById("storyOverlay")?.classList.add("scene-intro");
  storySceneIntroTimer=setTimeout(finishStorySceneIntro,STORY_SCENE_INTRO_DURATION);
  return true;
}

function revealCharacterName(id,showNotice=true){
  const character=STORY_CHARACTERS[id];
  if(!character||character.alwaysKnown)return false;
  const guest=getStoryGuestState(id);
  if(guest.nameRevealed)return false;
  guest.nameRevealed=true;
  updateRelationshipUI();
  if(showNotice&&storySession){
    const speaker=document.getElementById("storySpeaker");
    const notice=document.getElementById("storyRevealNotice");
    speaker.textContent=character.name;
    speaker.classList.remove("revealed");
    void speaker.offsetWidth;
    speaker.classList.add("revealed");
    notice.textContent=`${character.name}의 이름을 알게 되었습니다`;
    notice.classList.add("show");
    clearTimeout(storyRevealTimer);
    storyRevealTimer=setTimeout(()=>notice.classList.remove("show"),1800);
  }
  return true;
}

function storyRelationLabel(id){
  const guest=state.story?.guestState?.[id];
  if(!guest)return "";
  const fragmentState=getStoryGuestResult(id).fragmentState;
  if(fragmentState==="full")return "달빛 조각 회수";
  if(fragmentState==="partial")return "달빛 조각 부분 회수";
  if(guest.previouslyObtainedFull)return "과거 달빛 조각 기록";
  if(guest.foodConfirmed)return "음식 확인";
  if(guest.clueFound)return "단서 기록";
  return "첫 만남";
}

function updateRelationshipUI(){
  const list=document.getElementById("relationshipList");
  if(!list||!state.story)return;
  const known=STORY_GUEST_IDS.filter(id=>{
    const guest=state.story.guestState[id];
    return guest&&(
      guest.visits>0||guest.clueFound||guest.foodConfirmed
      ||guest.previouslyObtainedPartial||guest.previouslyObtainedFull
      ||getStoryGuestResult(id).visited
    );
  });
  if(!known.length){
    list.innerHTML='<span class="relationship-empty">아직 기록된 특별 손님이 없습니다.</span>';
    return;
  }
  list.innerHTML=known.map(id=>{
    const guest=getStoryGuestState(id);
    return `<div class="relationship-row"><strong>${STORY_CHARACTERS[id].name}</strong><span>${storyRelationLabel(id)}</span></div>`;
  }).join("");
}

function initializeStoryUI(){
  if(storyUiInitialized)return;
  storyUiInitialized=true;
  document.getElementById("storyNextButton").addEventListener("click",storyAdvance);
  document.getElementById("storyText").addEventListener("click",storyAdvance);
  /* [대사창이 감춰진 동안의 클릭은 오버레이가 받습니다]
     위 두 곳이 대사를 넘기는 유일한 마우스 입력입니다. 그런데 컷씬 대기
     (story-cinematic-hold)와 씬 인트로(scene-intro)에서는 대사창이 통째로
     visibility:hidden 이고, 감춰진 요소는 클릭 대상이 아닙니다. 그래서 그
     동안은 화면 아무 곳을 눌러도 아무 일이 없었습니다 — 컷씬 대기는 시간이
     아니라 입력을 기다리므로 마우스만 쓰는 사람에게는 화면이 멈춥니다.

     ⚠️ 걸러내는 기준은 "지금 대기 중인가"가 아니라 "누른 곳이 대사창 안인가"
        입니다. 클릭은 #storyText 에서 처리된 뒤 여기까지 거슬러 올라오는데,
        그 사이에 대사가 한 줄 넘어가 새 컷의 대기가 막 시작된 상태일 수
        있습니다. 그때 대기 여부만 보면 방금 시작한 대기를 같은 클릭이 곧바로
        풀어 버려서, 장면 중간에 컷이 바뀌는 줄만 그림이 한 번도 안 보입니다.
        대사창이 보이는 동안에는 눌린 곳이 늘 대사창 안이고, 감춰진 동안에는
        늘 바깥이라 이 기준이면 어긋나지 않습니다.
        버튼(건너뛰기 등)은 자기 처리기가 따로 있어 같이 제외합니다. */
  document.getElementById("storyOverlay")?.addEventListener("click",event=>{
    if(event.target?.closest?.(".story-dialogue-box,button"))return;
    if(!storyCinematicHoldIsActive()&&!storySession?.sceneIntroActive)return;
    storyAdvance();
  });
  document.getElementById("storySkipButton")?.addEventListener("click",skipCurrentStoryScene);
  document.getElementById("endingRetryBranchButton")?.addEventListener("click",retryLastEndingBranch);
  document.getElementById("endingAcceptButton")?.addEventListener("click",acceptCurrentEnding);
  // 엔딩 결론창은 닫을 수 없는 선택 화면입니다. ESC가 뒤쪽 설정창으로
  // 전파되지 않게 막고, Tab 포커스도 두 선택지 안에서만 순환시킵니다.
  window.addEventListener("keydown",event=>{
    if(!endingRetryMenuIsOpen())return;
    if(event.key==="Escape"){
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if(event.key!=="Tab")return;
    const {branchButton,acceptButton}=endingRetryElements();
    const buttons=[branchButton,acceptButton].filter(button=>button&&!button.disabled);
    if(!buttons.length)return;
    let index=buttons.indexOf(document.activeElement);
    if(index<0)index=event.shiftKey?0:-1;
    const nextIndex=(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length;
    event.preventDefault();
    buttons[nextIndex].focus();
  },true);
  window.addEventListener("resize",()=>{
    clearTimeout(storySubtitleResizeTimer);
    storySubtitleResizeTimer=setTimeout(reflowCurrentStorySubtitle,80);
  });
}

function storySubtitleMeasurementElement(textEl){
  const parent=textEl?.parentElement;
  if(!parent||typeof textEl.cloneNode!=="function")return null;
  if(!storySubtitleMeasureEl||storySubtitleMeasureEl.parentElement!==parent){
    storySubtitleMeasureEl=textEl.cloneNode(false);
    storySubtitleMeasureEl.removeAttribute("id");
    storySubtitleMeasureEl.removeAttribute("aria-live");
    storySubtitleMeasureEl.setAttribute("aria-hidden","true");
    storySubtitleMeasureEl.classList.add("story-text-measure");
    parent.appendChild(storySubtitleMeasureEl);
  }
  const computed=typeof window.getComputedStyle==="function"
    ?window.getComputedStyle(textEl)
    :null;
  if(computed?.width)storySubtitleMeasureEl.style.width=computed.width;
  if(computed?.height)storySubtitleMeasureEl.style.height=computed.height;
  return storySubtitleMeasureEl;
}

function storySubtitlePageFits(text,textEl=document.getElementById("storyText")){
  if(!textEl)return true;
  const measure=storySubtitleMeasurementElement(textEl)||textEl;
  const mutatesLiveRegion=measure===textEl;
  const previousText=mutatesLiveRegion?textEl.textContent:"";
  const previousScrollTop=mutatesLiveRegion?(Number(textEl.scrollTop)||0):0;
  measure.textContent=text||"\u200b";
  const clientHeight=Number(measure.clientHeight)||Number(textEl.clientHeight)||0;
  const scrollHeight=Number(measure.scrollHeight)||0;
  let availableHeight=clientHeight;
  if(!availableHeight&&typeof window.getComputedStyle==="function"){
    const lineHeight=Number.parseFloat(window.getComputedStyle(measure).lineHeight);
    if(Number.isFinite(lineHeight)&&lineHeight>0)availableHeight=lineHeight*STORY_SUBTITLE_MAX_LINES;
  }
  measure.textContent=mutatesLiveRegion?previousText:"";
  if(mutatesLiveRegion&&"scrollTop" in textEl)textEl.scrollTop=previousScrollTop;
  // DOM 크기를 제공하지 않는 계약 테스트 환경에서는 한 페이지로 취급합니다.
  if(!availableHeight||!scrollHeight)return true;
  return scrollHeight<=availableHeight+1;
}

function storySubtitlePreferredBreak(characters,maxLength){
  const minimum=Math.max(1,Math.floor(maxLength*.55));
  const punctuation=/[,.!?;:…。，、！？；：]/;
  for(let index=maxLength;index>=minimum;index--){
    const before=characters[index-1]||"";
    const after=characters[index]||"";
    if(/\s/.test(before)||punctuation.test(before)||/\s/.test(after))return index;
  }
  return maxLength;
}

function paginateStorySubtitle(text,textEl=document.getElementById("storyText")){
  let remaining=String(text??"");
  if(!remaining)return [""];
  const pages=[];
  while(remaining){
    if(storySubtitlePageFits(remaining,textEl)){
      pages.push(remaining);
      break;
    }
    const characters=Array.from(remaining);
    let low=1;
    let high=characters.length-1;
    let fittingLength=0;
    while(low<=high){
      const middle=Math.floor((low+high)/2);
      if(storySubtitlePageFits(characters.slice(0,middle).join(""),textEl)){
        fittingLength=middle;
        low=middle+1;
      }else high=middle-1;
    }
    // 한 글자도 측정 영역에 들어가지 않는 비정상 레이아웃에서도 무한 반복하지 않습니다.
    fittingLength=Math.max(1,fittingLength);
    const breakAt=storySubtitlePreferredBreak(characters,fittingLength);
    const page=characters.slice(0,breakAt).join("").trimEnd();
    pages.push(page||characters[0]);
    remaining=characters.slice(page?breakAt:1).join("").trimStart();
  }
  return pages;
}

function storySubtitlePageOffsets(text,pages){
  const source=String(text??"");
  let cursor=0;
  return pages.map(page=>{
    const found=source.indexOf(page,cursor);
    const start=found>=0?found:cursor;
    cursor=start+page.length;
    return start;
  });
}

function storySubtitlePageForOffset(offset,pageOffsets){
  const target=Math.max(0,Math.floor(Number(offset)||0));
  let pageIndex=0;
  pageOffsets.forEach((start,index)=>{if(start<=target)pageIndex=index;});
  return pageIndex;
}

function storySubtitleHasNextPage(){
  const subtitle=storySession?.subtitle;
  return !!subtitle&&subtitle.pageIndex<subtitle.pages.length-1;
}

function reflowCurrentStorySubtitle(){
  if(!storySession||storySession.suspended||storySession.sceneIntroActive||!storySession.subtitle)return false;
  const line=storySession.lines[storySession.lineIndex];
  if(!line)return false;
  const previous=storySession.subtitle;
  const startOffset=previous.pageOffsets?.[previous.pageIndex]||0;
  const wasComplete=!!storySession.typing?.complete;
  const fullText=storyLineText(line);
  const textEl=document.getElementById("storyText");
  const pages=paginateStorySubtitle(fullText,textEl);
  const pageOffsets=storySubtitlePageOffsets(fullText,pages);
  storySession.subtitle={
    lineIndex:storySession.lineIndex,
    pages,
    pageOffsets,
    pageIndex:storySubtitlePageForOffset(startOffset,pageOffsets)
  };
  showStorySubtitlePage(storySession.subtitle.pageIndex);
  if(wasComplete)finishStoryTyping();
  return true;
}

function storySceneHasRequiredInteraction(scene){
  return !!scene?.requiresDishChoice||!!scene?.lines?.some(line=>
    line?.cook||line?.orderCook||line?.choices?.some(choice=>choice?.orderCook||choice?.nextSceneId)
  );
}

function storyDishChoiceLineIndex(){
  return storySession?.lines?.findIndex(line=>
    line?.choices?.some(choice=>choice?.orderCook?.dishId)
  )??-1;
}

function storySceneCanSkip(scene=storySession?.scene){
  const base=!!(
    scene
    &&!storySession?.qaPreview
    &&state.story?.seenScenes?.[scene.id]
    &&!storySession?.suspended
  );
  if(!base)return false;
  if(scene.requiresDishChoice){
    const choiceIndex=storyDishChoiceLineIndex();
    return choiceIndex>=0&&storySession.lineIndex<choiceIndex;
  }
  return !storySceneHasRequiredInteraction(scene);
}

function updateStorySkipButton(){
  const button=document.getElementById("storySkipButton");
  if(!button)return;
  button.hidden=!storySceneCanSkip();
}

function skipCurrentStoryScene(){
  if(!storySceneCanSkip())return false;
  clearStoryTyping();
  clearStorySceneIntro();
  audio?.click?.();
  if(storySession.scene?.requiresDishChoice){
    const choiceIndex=storyDishChoiceLineIndex();
    if(choiceIndex<0)return false;
    storySession.lineIndex=choiceIndex;
    storySession.subtitle=null;
    storySession.typing=null;
    showStoryLine();
    return true;
  }
  completeStoryScene();
  return true;
}

function storyIsActive(){return !!storySession;}
function storyDialogueIsActive(){return !!storySession&&!storySession.suspended;}
function storyCookingIsActive(){return !!storySession?.suspended;}
function activeStoryCookOrderId(){return storySession?.pendingCook?.orderId??null;}
function activeStoryCookStep(){
  const challenge=state.story?.activeStoryCook;
  return challenge?.steps?.[challenge.stepIndex]||null;
}

function storySceneIdsForMoment(moment,day=state.day){
  if(moment==="nightEnd"&&Number(day)===7){
    const fragments=storyFragmentCounts();
    // 8조각 엔딩은 이번 회차에 완전한 조각 여덟 개를 모은 경우만
    // 허용합니다. 그 외 판정은 부분 조각을 포함한 현재 회차 수를 씁니다.
    const shards=fragments.full===8?8:Math.min(fragments.count,7);
    const rule=Object.values(STORY_ENDING_RULES||{}).find(item=>
      shards>=item.minShards&&shards<=item.maxShards
    );
    return rule?.judgementSceneId?[rule.judgementSceneId]:[];
  }
  return [...(STORY_EVENT_SCHEDULE[moment]?.[day]||[])];
}

function queueStoryMoments(moments,onComplete=null){
  const ids=[];
  moments.forEach(moment=>ids.push(
    ...storySceneIdsForMoment(moment).filter(id=>!STORY_SCENES[id]?.deferUntilArrival)
  ));
  playStoryScenes(ids,onComplete);
}

function resumeDeferredStoryOrderScene(){
  if(storyIsActive()||state.phase!==GAME_PHASES.OPEN)return false;
  // 미준비 분기 도중 저장·불러오기를 했을 때 체크포인트 콜백은 일반 재개
  // 함수로 복원됩니다. 두 장면이 이미 끝난 방문 객체를 여기서 정리해
  // 조리할 수 없는 손님이 좌석에 영구히 남는 것을 방지합니다.
  const completedMissingVisit=state.orders.find(item=>{
    if(item.customerType!=="story"||!item.missingMenu||!item.storySceneId)return false;
    const arrival=STORY_SCENES[item.storySceneId];
    return !!arrival
      &&storySceneCompleted(arrival)
      &&storySceneCompleted(arrival.missingMenuSceneId);
  });
  if(completedMissingVisit)return finishMissingStoryVisit(completedMissingVisit);
  const order=state.orders.find(item=>{
    const scene=STORY_SCENES[item.storySceneId];
    return item.customerType==="story"&&item.deferUntilArrival&&scene&&!storySceneCompleted(scene);
  });
  if(!order)return false;
  if(!storyOrderDialogueReady(order))return false;
  const scene=STORY_SCENES[order.storySceneId];
  if(order.missingMenu){
    const queue=[scene.id,scene.missingMenuSceneId].filter(Boolean);
    return playStoryScenes(queue,()=>finishMissingStoryVisit(order));
  }
  return playStoryScenes([order.storySceneId],resumeDeferredStoryOrderScene);
}

function finishMissingStoryVisit(order){
  if(!order)return false;
  const stillPresent=state.orders.some(item=>item.id===order.id);
  if(stillPresent){
    state.orders=state.orders.filter(item=>item.id!==order.id);
    if(typeof syncSelectedOrderToQueue==="function")syncSelectedOrderToQueue();
    else if(state.selectedOrderId===order.id)state.selectedOrderId=null;
    state.departures.push({
      slot:order.slot,variant:order.variant,guestId:order.guestId||null,
      bubble:"다음 밤에 다시 올게요.",life:2.6,stars:0,satisfaction:null,storyMystic:true
    });
  }
  processStoryNightTrigger();
  updateUI(true);saveGame();
  return true;
}

function resumeStoryForCurrentPhase(){
  if(storyIsActive()||state.screen!=="game")return;
  if(state.story?.pendingResultSceneId){playPendingStoryResult();return;}
  if(state.day===1&&!state.story?.prologueComplete){queueStoryMoments(["newGame","dayStart"]);return;}
  if([GAME_PHASES.MENU_SELECT,GAME_PHASES.INGREDIENT_SELECT,GAME_PHASES.PREP].includes(state.phase))queueStoryMoments(["dayStart"]);
  else if(state.phase===GAME_PHASES.OPEN)queueStoryMoments(["nightStart"],resumeDeferredStoryOrderScene);
  else if(state.phase===GAME_PHASES.RESULT)queueStoryMoments(["nightEnd"]);
}

function cloneStoryCheckpointValue(value){
  try{return JSON.parse(JSON.stringify(value));}
  catch(_error){return null;}
}

function isStoryCheckpointRecord(value){
  return !!value&&typeof value==="object"&&!Array.isArray(value);
}

function normalizeStoryCheckpoint(checkpoint){
  if(!isStoryCheckpointRecord(checkpoint)||checkpoint.version!==STORY_CHECKPOINT_VERSION)return null;
  if(!Array.isArray(checkpoint.queue)||!checkpoint.queue.length)return null;
  if(!checkpoint.queue.every(id=>typeof id==="string"&&!!STORY_SCENES[id]))return null;
  if(!Number.isInteger(checkpoint.queueIndex)||checkpoint.queueIndex<0||checkpoint.queueIndex>=checkpoint.queue.length)return null;
  if(typeof checkpoint.sceneId!=="string"||checkpoint.queue[checkpoint.queueIndex]!==checkpoint.sceneId)return null;
  if(!STORY_SCENES[checkpoint.sceneId]||storySceneCompleted(checkpoint.sceneId))return null;
  if(!Array.isArray(checkpoint.lines)||!checkpoint.lines.length)return null;
  if(!checkpoint.lines.every(line=>isStoryCheckpointRecord(line)&&(typeof line.text==="string"||typeof line.prompt==="string")))return null;
  if(!Number.isInteger(checkpoint.lineIndex)||checkpoint.lineIndex<0||checkpoint.lineIndex>=checkpoint.lines.length)return null;
  const subtitlePageIndex=checkpoint.subtitlePageIndex==null?0:checkpoint.subtitlePageIndex;
  if(!Number.isInteger(subtitlePageIndex)||subtitlePageIndex<0)return null;
  const subtitleStartOffset=checkpoint.subtitleStartOffset==null?null:checkpoint.subtitleStartOffset;
  if(subtitleStartOffset!=null&&(!Number.isInteger(subtitleStartOffset)||subtitleStartOffset<0))return null;
  if(!Array.isArray(checkpoint.actorIds))return null;
  if(!checkpoint.actorIds.every(id=>typeof id==="string"&&!!STORY_CHARACTERS[id]))return null;
  if(new Set(checkpoint.actorIds).size!==checkpoint.actorIds.length)return null;
  if(typeof checkpoint.waitingForCook!=="boolean"||typeof checkpoint.suspended!=="boolean"||typeof checkpoint.wasPaused!=="boolean")return null;
  if(checkpoint.waitingForCook!==checkpoint.suspended)return null;

  const pendingCook=checkpoint.pendingCook==null?null:checkpoint.pendingCook;
  if(checkpoint.suspended){
    if(!isStoryCheckpointRecord(pendingCook)||pendingCook.sceneId!==checkpoint.sceneId)return null;
    if(!Number.isFinite(pendingCook.orderId)||!Number.isInteger(pendingCook.lineIndex))return null;
    if(pendingCook.lineIndex<0||pendingCook.lineIndex>=checkpoint.lines.length)return null;
    if(!isStoryCheckpointRecord(pendingCook.config))return null;
    if(pendingCook.choice!=null&&!isStoryCheckpointRecord(pendingCook.choice))return null;
    if(pendingCook.choiceIndex!=null&&!Number.isInteger(pendingCook.choiceIndex))return null;
  }else if(pendingCook!==null)return null;

  const cloned=cloneStoryCheckpointValue({
    version:STORY_CHECKPOINT_VERSION,
    queue:checkpoint.queue,
    queueIndex:checkpoint.queueIndex,
    sceneId:checkpoint.sceneId,
    lines:checkpoint.lines,
    lineIndex:checkpoint.lineIndex,
    subtitlePageIndex,
    subtitleStartOffset,
    actorIds:checkpoint.actorIds,
    waitingForCook:checkpoint.waitingForCook,
    suspended:checkpoint.suspended,
    pendingCook,
    wasPaused:checkpoint.wasPaused,
    openJournalAfterFinish:!!checkpoint.openJournalAfterFinish,
    openMenuAfterFinish:!!checkpoint.openMenuAfterFinish
  });
  return isStoryCheckpointRecord(cloned)?cloned:null;
}

function captureStoryCheckpoint(){
  if(!storySession||state.story?.activeStoryCook)return null;
  const sceneId=storySession.scene?.id;
  if(!sceneId||storySceneCompleted(sceneId))return null;
  return normalizeStoryCheckpoint({
    version:STORY_CHECKPOINT_VERSION,
    queue:storySession.queue,
    queueIndex:storySession.queueIndex,
    sceneId,
    lines:storySession.lines,
    lineIndex:storySession.lineIndex,
    subtitlePageIndex:storySession.subtitle?.lineIndex===storySession.lineIndex
      ?storySession.subtitle.pageIndex
      :0,
    subtitleStartOffset:storySession.subtitle?.lineIndex===storySession.lineIndex
      ?storySession.subtitle.pageOffsets?.[storySession.subtitle.pageIndex]||0
      :0,
    actorIds:(storySession.actors||[]).map(actor=>actor.id),
    waitingForCook:!!storySession.waitingForCook,
    suspended:!!storySession.suspended,
    pendingCook:storySession.pendingCook||null,
    wasPaused:!!storySession.wasPaused,
    openJournalAfterFinish:!!storySession.openJournalAfterFinish,
    openMenuAfterFinish:!!storySession.openMenuAfterFinish
  });
}

function clearStoryRuntime(){
  const hadRuntime=!!storySession||!!state.story?.activeStoryCook;
  clearStoryTyping();
  clearStorySceneIntro();
  setStoryGameUiVisible(false);
  clearStoryCinematic();
  applyStoryFragmentHandoff(null);
  clearStoryPropReveal();
  applyStoryEndingBackground(null);
  if(storyRevealTimer){clearTimeout(storyRevealTimer);storyRevealTimer=null;}
  const revealNotice=document.getElementById("storyRevealNotice");
  const overlay=document.getElementById("storyOverlay");
  const stage=document.getElementById("storyStage");
  const nextButton=document.getElementById("storyNextButton");
  if(revealNotice)revealNotice.classList.remove("show");
  if(overlay)overlay.classList.remove("open");
  if(stage)stage.innerHTML="";
  if(nextButton)nextButton.disabled=false;
  const skipButton=document.getElementById("storySkipButton");
  if(skipButton)skipButton.hidden=true;
  if(state.story)state.story.activeStoryCook=null;
  storySession=null;
  return hadRuntime;
}

function restoreStoryCheckpoint(checkpoint){
  const restored=normalizeStoryCheckpoint(checkpoint);
  clearStoryRuntime();
  if(!restored)return false;

  const scene=STORY_SCENES[restored.sceneId];
  let pendingOrder=null;
  if(restored.suspended){
    if(state.phase!==GAME_PHASES.OPEN)return false;
    pendingOrder=(state.orders||[]).find(order=>
      order.id===restored.pendingCook.orderId
      &&order.storySceneId===restored.sceneId
    );
    if(!pendingOrder)return false;
  }

  storySession={
    queue:restored.queue,
    queueIndex:restored.queueIndex,
    scene,
    lines:restored.lines,
    lineIndex:restored.lineIndex,
    subtitle:null,
    actors:[],
    wasPaused:restored.wasPaused,
    onComplete:state.phase===GAME_PHASES.OPEN?resumeDeferredStoryOrderScene:null,
    waitingForCook:restored.waitingForCook,
    suspended:restored.suspended,
    pendingCook:restored.pendingCook,
    openJournalAfterFinish:!!restored.openJournalAfterFinish,
    openMenuAfterFinish:!!restored.openMenuAfterFinish
  };

  document.getElementById("storySceneTitle").textContent=storySceneCardText(scene);
  document.getElementById("storyDayLabel").textContent=storySceneDayLabel(scene);
  restored.actorIds.forEach(ensureStoryActor);

  if(restored.suspended){
    pendingOrder.specialRecipe=!!restored.pendingCook.config.special;
    state.selectedOrderId=pendingOrder.id;
    state.paused=false;
    document.getElementById("storyOverlay").classList.remove("open");
    updateUI(true);
    return true;
  }

  state.paused=true;
  document.getElementById("storyOverlay").classList.add("open");
  showStoryLine(restored.subtitlePageIndex,restored.subtitleStartOffset);
  return true;
}

function storyTimeOfDayOverride(){
  const scene=storySession?.scene
    ||(state.story?.activeStoryCook?STORY_SCENES[state.story.activeStoryCook.sceneId]:null);
  const line=storySession?.lines?.[storySession.lineIndex];
  if(line&&["day","night"].includes(line.timeOfDay))return line.timeOfDay;
  return scene&&["day","night"].includes(scene.timeOfDay)?scene.timeOfDay:null;
}

function playPendingStoryResult(){
  const sceneId=state.story?.pendingResultSceneId;
  if(!sceneId||!STORY_SCENES[sceneId]||storyIsActive())return false;
  return playStoryScenes([sceneId],()=>{
    state.story.pendingResultSceneId=null;
    processStoryNightTrigger();
  });
}

function storySceneAvailable(scene){
  if(!scene)return false;
  const loop=Math.max(1,Number(state.story?.loop)||1);
  if(Number.isFinite(scene.minLoop)&&loop<scene.minLoop)return false;
  if(Number.isFinite(scene.maxLoop)&&loop>scene.maxLoop)return false;
  if(Array.isArray(scene.shardRange)){
    const counts=storyFragmentCounts();
    const requiresAllFull=Number(scene.shardRange[0])===8&&Number(scene.shardRange[1])===8;
    const count=requiresAllFull
      ?counts.full
      :counts.full===8?8:Math.min(counts.count,7);
    if(count<Number(scene.shardRange[0])||count>Number(scene.shardRange[1]))return false;
  }
  if(Number.isFinite(scene.requiredBaseShards)
    &&storyShardCount({baseOnly:true,fullOnly:true})<scene.requiredBaseShards)return false;
  if(Array.isArray(scene.requiredFlags)&&scene.requiredFlags.some(flag=>!state.story?.flags?.[flag]))return false;
  return true;
}

function storyJournalStatusForDay(day=state.day){
  const arrival=storyPrimaryGuestForDay(day);
  if(!arrival)return {status:"none",arrival:null,guest:null};
  const guest=getStoryGuestState(arrival.character);
  const currentFull=getStoryGuestResult(arrival.character).fragmentState==="full";
  const status=guest.previouslyObtainedFull||currentFull
    ?"shard":guest.foodConfirmed?"confirmed":guest.clueFound?"clue":"none";
  return {status,arrival,guest};
}

function storyPreparedMenuDishes(){
  const selected=Array.isArray(state.selectedMenus)?state.selectedMenus:[];
  return [...new Set(selected)]
    .map(dishById)
    .filter(Boolean)
    .filter(dish=>typeof dishPreparedForService!=="function"||dishPreparedForService(dish.id));
}

/* 선택지 화면에는 손님이 방금 한 말(=무엇을 찾는지에 대한 힌트)을 같이 붙여 둡니다.
   대사창은 이 시점에 이미 "어떤 음식을 내줄까?" 로 넘어가 있어서, 힌트를 다시 볼 곳이
   여기밖에 없습니다. 화자 이름은 그리는 시점에 풀어야(storyDisplayName) 대화 도중
   이름을 알게 된 손님도 제대로 나옵니다 — 그래서 여기서는 화자 id 만 들고 갑니다. */
const STORY_DISH_CHOICE_HINT_LIMIT=3;
function storyDishChoiceHintLines(source){
  return (source||[])
    .filter(line=>line?.speaker&&line.speaker!=="protagonist"&&typeof line.text==="string"&&line.text.trim())
    .slice(-STORY_DISH_CHOICE_HINT_LIMIT)
    .map(line=>({speaker:line.speaker,text:line.text}));
}

function storySpecialGuestDishChoiceLine(scene,source){
  return {
    prompt:"어떤 음식을 내줄까?",
    choiceHint:storyDishChoiceHintLines(source),
    choices:storyPreparedMenuDishes().map(dish=>({
      text:dish.name||dish.displayName||dish.id,
      orderCook:{
        dishId:dish.id,
        special:!!scene.specialCook,
        thresholds:scene.thresholds?{...scene.thresholds}:null,
        suppressReply:true
      }
    }))
  };
}

function storyLinesForScene(scene){
  let source=scene.lines||[];
  let replacements={};
  if(scene.dynamicJournalHint&&scene.journalVariants){
    const {status,arrival}=storyJournalStatusForDay();
    source=scene.journalVariants[status]||scene.journalVariants.none||source;
    const missing=arrival?STORY_SCENES[arrival.missingMenuSceneId]:null;
    const dish=arrival?dishById(arrival.dishId):null;
    replacements={
      "[영업일지 단서]":missing?.journalClue||"아직 알아내지 못한 단서",
      "[음식명]":dish?.name||dish?.displayName||"아직 모르는 음식"
    };
  }
  if(scene.requiresDishChoice)source=[...source,storySpecialGuestDishChoiceLine(scene,source)];
  return source.map(line=>{
    const copy={
      ...line,
      choiceHint:line.choiceHint?line.choiceHint.map(hint=>({...hint})):line.choiceHint,
      choices:line.choices?.map(choice=>({
        ...choice,
        orderCook:choice.orderCook?{...choice.orderCook}:choice.orderCook
      }))
    };
    if(typeof copy.text==="string")Object.entries(replacements).forEach(([token,value])=>{copy.text=copy.text.split(token).join(value);});
    if(typeof copy.prompt==="string")Object.entries(replacements).forEach(([token,value])=>{copy.prompt=copy.prompt.split(token).join(value);});
    copy.choiceHint?.forEach(hint=>{
      Object.entries(replacements).forEach(([token,value])=>{hint.text=hint.text.split(token).join(value);});
    });
    return copy;
  });
}

function playStoryScenes(sceneIds,onComplete=null){
  if(storyIsActive())return false;
  const queue=sceneIds.filter(id=>{
    const scene=STORY_SCENES[id];
    return scene&&storySceneAvailable(scene)&&!storySceneCompleted(scene);
  });
  if(!queue.length){if(onComplete)onComplete();return false;}
  storySession={queue,queueIndex:0,scene:null,lines:[],lineIndex:0,actors:[],wasPaused:state.paused,onComplete};
  state.paused=true;
  document.getElementById("storyOverlay").classList.add("open");
  beginNextStoryScene();
  return true;
}

function beginNextStoryScene(){
  if(!storySession)return;
  while(storySession.queueIndex<storySession.queue.length&&storySceneCompleted(storySession.queue[storySession.queueIndex]))storySession.queueIndex++;
  if(storySession.queueIndex>=storySession.queue.length){finishStorySession();return;}
  const id=storySession.queue[storySession.queueIndex];
  const scene=STORY_SCENES[id];
  storySession.scene=scene;
  storySession.lines=storyLinesForScene(scene);
  storySession.lineIndex=0;
  storySession.subtitle=null;
  // 지난 장면에서 조각을 띄웠던 줄 번호가 남아 있으면, 같은 번호의 줄에서
  // 조각이 한 박자 빨리 떠 버립니다.
  storySession.fragmentRevealedAt=null;
  resetStoryStage();
  setStoryGameUiVisible(false);
  document.getElementById("storySceneTitle").textContent=storySceneCardText(scene);
  document.getElementById("storyDayLabel").textContent=storySceneDayLabel(scene);
  updateStorySkipButton();
  showStorySceneIntro();
}

function clearStoryTyping(){
  if(storyTypingTimer){clearTimeout(storyTypingTimer);storyTypingTimer=null;}
}

function storyLineText(line){return line.prompt||line.text||"";}
function setStoryNextButton(isCook=false){
  const button=document.getElementById("storyNextButton");
  button.innerHTML=isCook?'조리 시작 <span>▶</span>':'계속 <span>▼</span>';
}

function startStorySubtitleTyping(line){
  if(!storySession)return false;
  clearStoryTyping();
  const textEl=document.getElementById("storyText");
  const subtitle=storySession.subtitle;
  const fullText=subtitle?.pages?.[subtitle.pageIndex]??storyLineText(line);
  const isFinalPage=!subtitle||subtitle.pageIndex>=subtitle.pages.length-1;
  textEl.textContent="";
  if("scrollTop" in textEl)textEl.scrollTop=0;
  storySession.typing={line,fullText,index:0,complete:false,revealApplied:false,isFinalPage};
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){finishStoryTyping();return true;}
  const typeCharacter=()=>{
    if(!storySession?.typing||storySession.typing.complete)return;
    const typing=storySession.typing;
    typing.index++;
    textEl.textContent=typing.fullText.slice(0,typing.index);
    if(typing.index>=typing.fullText.length){finishStoryTyping();return;}
    storyTypingTimer=setTimeout(typeCharacter,typing.fullText[typing.index-1].match(/[.!?。？！]/)?85:14);
  };
  typeCharacter();
  return true;
}

function resolveStoryAssetUrl(asset){
  const value=String(asset||"").trim();
  if(!value)return "";
  try{return new URL(value,document.baseURI).href;}
  catch{return value;}
}

function applyStoryFragmentHandoff(line){
  const layer=document.getElementById("storyFragmentHandoff");
  if(!layer)return false;
  const handoff=line?.fragmentHandoff;
  const showFull=handoff?.state==="full";
  const name=document.getElementById("storyFragmentName");
  layer.classList?.toggle("show",showFull);
  layer.setAttribute?.("aria-hidden",showFull?"false":"true");
  if(showFull){
    layer.dataset.shardId=String(handoff.shardId||"");
    layer.dataset.shardName=String(handoff.shardName||"");
    layer.dataset.fragmentState=String(handoff.state||"");
    const asset=resolveStoryAssetUrl(handoff.asset);
    layer.classList?.toggle("has-art",!!asset);
    /* ⚠️ 여기도 --portrait-art 와 같은 함정입니다. 커스텀 속성 안의 url() 은 그
       값을 쓰는 스타일시트(css/story.css) 기준으로 풀려서, 상대경로를 그대로
       넣으면 "css/assets/..." 를 찾다가 404 가 납니다. 그러면 빛무리만 뜨고
       가운데 조각 그림이 안 보입니다. 문서 기준 절대 URL 로 바꿔서 넘깁니다. */
    if(asset)layer.style?.setProperty?.("--fragment-art",storyPortraitArtValue(asset));
    else layer.style?.removeProperty?.("--fragment-art");
    if(name)name.textContent=handoff.shardName?`「${handoff.shardName}」`:"달빛 조각";
  }else{
    layer.classList?.remove?.("has-art");
    delete layer.dataset.shardId;
    delete layer.dataset.shardName;
    delete layer.dataset.fragmentState;
    layer.style?.removeProperty?.("--fragment-art");
    if(name)name.textContent="";
  }
  return showFull;
}

function applyStoryEndingBackground(scene){
  const layer=document.getElementById("storyEndingBackground");
  const overlay=document.getElementById("storyOverlay");
  if(!layer)return false;
  const asset=resolveStoryAssetUrl(scene?.endingBackground);
  const show=!!asset;
  layer.classList?.toggle("show",show);
  layer.setAttribute?.("aria-hidden",show?"false":"true");
  overlay?.classList?.toggle("story-ending-active",show);
  if(show){
    layer.dataset.sceneId=String(scene.id||"");
    layer.style?.setProperty?.("--story-ending-art",`url(${JSON.stringify(asset)})`);
  }else{
    delete layer.dataset.sceneId;
    layer.style?.removeProperty?.("--story-ending-art");
  }
  return show;
}

function showStoryLine(requestedPageIndex=0,requestedStartOffset=null){
  if(!storySession)return;
  clearStoryTyping();
  const scene=storySession.scene;
  const line=storySession.lines[storySession.lineIndex];
  if(!line){completeStoryScene();return;}
  const textEl=document.getElementById("storyText");
  const speakerEl=document.getElementById("storySpeaker");
  const badge=document.getElementById("storyRelationBadge");
  const choices=document.getElementById("storyChoices");
  const next=document.getElementById("storyNextButton");
  const speakerId=line.speaker||null;
  const speakerLabel=storySpeakerLabel(line);
  setStoryGameUiVisible(line.showGameUI===true);
  applyStoryEndingBackground(scene);
  applyStoryCinematic(line);
  /* 컷씬을 먼저 혼자 보여 주는 줄(cinematic.hold)에서는 조각 오버레이를
     그동안 비워 둡니다. 감추는 게 아니라 안 켜는 것이라야 1초 뒤에 조각이
     제대로 떠오릅니다 — 자세한 것은 story-cinematic.js 의 hold 설명. */
  const holding=beginStoryCinematicHold(line);
  if(holding)applyStoryFragmentHandoff(null);
  setStoryPortrait(speakerId,line);
  updateStoryCinematicSpeaking(line);
  updateStorySkipButton();
  choices.innerHTML="";choices.classList.remove("open");
  const fullText=storyLineText(line);
  const pages=paginateStorySubtitle(fullText,textEl);
  const pageOffsets=storySubtitlePageOffsets(fullText,pages);
  const pageIndex=Number.isInteger(requestedStartOffset)&&requestedStartOffset>=0
    ?storySubtitlePageForOffset(requestedStartOffset,pageOffsets)
    :Math.max(0,Math.min(pages.length-1,Math.floor(Number(requestedPageIndex)||0)));
  storySession.subtitle={lineIndex:storySession.lineIndex,pages,pageOffsets,pageIndex};

  /* [대사창 안에 보이는 것은 창이 사라진 뒤에 갈아 끼웁니다]
     대기에 들어가면 대사창은 0.2초에 걸쳐 사라집니다(css/story.css 의
     transition). 그동안 창은 아직 화면에 있으므로, 여기서 이름과 글자를 바로
     바꾸면 **읽던 대사가 다음 화자 이름과 빈 줄로 먼저 바뀐 뒤에** 창이
     내려갑니다. 그래서 대기 중에는 아래 reveal 까지 미뤄 두고, 사라지는
     동안에는 방금 읽던 대사를 그대로 두었다가 창이 다시 올라올 때 갈아
     끼웁니다. 쪽수 계산은 위에서 이미 끝났고, 폭은 감춰진 요소에서도 그대로라
     미뤄도 영향이 없습니다(측정은 따로 만든 사본에서 합니다).

     대기가 없는 줄은 창이 계속 떠 있으므로 예전처럼 그 자리에서 바꿉니다. */
  const fillStoryDialogueBox=()=>{
    speakerEl.classList.remove("revealed");
    speakerEl.hidden=!speakerLabel;
    speakerEl.textContent=speakerLabel;
    badge.textContent=speakerId&&STORY_GUEST_IDS.includes(speakerId)&&isCharacterNameRevealed(speakerId)?storyRelationLabel(speakerId):"";
    setStoryNextButton(false);
    next.style.display=line.choices&&pageIndex===pages.length-1?"none":"block";
    textEl.textContent="";
  };
  if(!holding)fillStoryDialogueBox();

  /* 대기가 없는 줄이면 그 자리에서 바로 부릅니다. 대기 중이면 클릭 한 번 뒤에
     대사와 조각 오버레이가 함께 올라옵니다.
     자막 쪽수 계산은 대기와 상관없이 위에서 이미 끝났습니다 — 대사창은
     visibility 로만 감춰서 폭을 재는 데 문제가 없습니다. */
  scheduleStoryCinematicReveal(()=>{
    if(holding)fillStoryDialogueBox();
    /* 달빛 조각은 이 줄에서 바로 띄우지 않습니다. 대사와 동시에 큰 오버레이가
       덮여서 "손님이 조각을 건넨다"를 읽기도 전에 그림이 먼저 나와 버립니다.
       한 번 더 눌렀을 때 떠오르도록 storyAdvance() 가 따로 켭니다.
       (QA 미리보기는 그림 확인용이라 기다리지 않고 바로 보여 줍니다) */
    const revealed=storySession.qaPreview||storySession.fragmentRevealedAt===storySession.lineIndex;
    applyStoryFragmentHandoff(revealed?line:null);
    /* 소품(프롤로그 영업일지)은 달빛 조각과 반대로 자막보다 **먼저** 뜹니다.
       "눈에 들어와"는 그림을 보고 나서 읽어야 성립하기 때문입니다. 그래서
       떠오르는 동안만 자막을 붙잡습니다 — 소품이 없는 줄은 붙잡지 않고 그
       자리에서 바로 타이핑합니다(story-prop-reveal.js 설명). */
    scheduleStoryPropReveal(line,()=>startStorySubtitleTyping(line));
  });
}

function showStorySubtitlePage(pageIndex){
  const subtitle=storySession?.subtitle;
  if(!subtitle||pageIndex<0||pageIndex>=subtitle.pages.length)return false;
  const line=storySession.lines[storySession.lineIndex];
  subtitle.pageIndex=pageIndex;
  document.getElementById("storyChoices").classList.remove("open");
  setStoryNextButton(false);
  document.getElementById("storyNextButton").style.display=
    line.choices&&pageIndex===subtitle.pages.length-1?"none":"block";
  startStorySubtitleTyping(line);
  return true;
}

function showNextStorySubtitlePage(){
  if(!storySubtitleHasNextPage())return false;
  return showStorySubtitlePage(storySession.subtitle.pageIndex+1);
}

function finishStoryTyping(){
  if(!storySession?.typing||storySession.typing.complete)return;
  clearStoryTyping();
  const typing=storySession.typing;
  typing.complete=true;
  typing.index=typing.fullText.length;
  document.getElementById("storyText").textContent=typing.fullText;
  if(!typing.isFinalPage){
    if(storySession.qaPreview&&typeof qaSyncStoryPreviewNextButton==="function")qaSyncStoryPreviewNextButton();
    return;
  }
  if(typing.line.setsFlag)state.story.flags[typing.line.setsFlag]=true;
  if(typing.line.reveal&&!typing.revealApplied){
    typing.revealApplied=true;
    revealCharacterName(typing.line.reveal,true);
  }
  if(typing.line.cook||typing.line.orderCook)setStoryNextButton(true);
  if(typing.line.choices)renderStoryChoices(typing.line);
  if(storySession.qaPreview&&typeof qaSyncStoryPreviewNextButton==="function")qaSyncStoryPreviewNextButton();
}

function renderStoryChoiceHint(line,wrap){
  const hints=(Array.isArray(line?.choiceHint)?line.choiceHint:[]).filter(hint=>hint?.text);
  if(!hints.length)return;
  const box=document.createElement("div");
  box.className="story-choice-hint";
  hints.forEach((hint,index)=>{
    const row=document.createElement("p");
    row.className="story-choice-hint-line";
    // 같은 손님이 연달아 말한 줄에는 이름을 다시 붙이지 않습니다(둘이 붙은 그림자처럼
    // 화자가 바뀌는 경우에만 이름이 다시 나옵니다).
    const name=hint.speaker&&hint.speaker!==hints[index-1]?.speaker?storyDisplayName(hint.speaker):"";
    if(name){
      const who=document.createElement("span");
      who.className="story-choice-hint-speaker";
      who.textContent=name;
      row.appendChild(who);
    }
    row.appendChild(document.createTextNode(hint.text));
    box.appendChild(row);
  });
  wrap.appendChild(box);
}

function renderStoryChoices(line){
  const wrap=document.getElementById("storyChoices");
  document.getElementById("storyNextButton").style.display="none";
  wrap.innerHTML="";
  renderStoryChoiceHint(line,wrap);
  line.choices.forEach((choice,index)=>{
    const button=document.createElement("button");
    button.type="button";button.className="story-choice";button.textContent=choice.text;
    if(choice.requiredFlag&&!state.story?.flags?.[choice.requiredFlag]){
      button.disabled=true;
      button.title="아직 필요한 기록을 얻지 못했습니다.";
    }
    button.addEventListener("click",()=>chooseStoryOption(choice,index));
    wrap.appendChild(button);
  });
  wrap.classList.add("open");
}

function chooseStoryOption(choice,index){
  if(!storySession)return;
  // QA_REMOVE: 일차별 미리보기에서는 선택 결과를 실제 진행도에 기록하지 않습니다.
  if(storySession.qaPreview){
    return typeof qaStoryPreviewChoice==="function"
      ?qaStoryPreviewChoice(choice,index)
      :true;
  }
  const scene=storySession.scene;
  if(choice.requiredFlag&&!state.story?.flags?.[choice.requiredFlag]){
    showToast("아직 이 선택에 필요한 기록을 얻지 못했습니다.",true);
    return false;
  }
  state.story.choices[scene.id]=index;
  if(choice.flag)state.story.flags[choice.flag]=true;
  if(choice.notice)showToast(choice.notice);
  if(choice.orderCook){
    audio?.click();
    suspendStoryForOrderCook(scene,choice.orderCook,{
      choice:{...choice},choiceIndex:index,lineIndex:storySession.lineIndex
    });
    return;
  }
  if(choice.nextSceneId&&STORY_SCENES[choice.nextSceneId]){
    const insertAt=storySession.queueIndex+1;
    if(storySession.queue[insertAt]!==choice.nextSceneId)storySession.queue.splice(insertAt,0,choice.nextSceneId);
    storySession.lineIndex=storySession.lines.length;
    audio?.click();
    completeStoryScene();
    return true;
  }
  if(choice.affinity&&scene.character&&STORY_GUEST_IDS.includes(scene.character))getStoryGuestState(scene.character).affinity+=choice.affinity;
  const reply={speaker:choice.speaker||scene.character||"protagonist",text:choice.reply||"고개를 끄덕였다."};
  storySession.lines.splice(storySession.lineIndex+1,0,reply);
  storySession.lineIndex++;
  audio?.click();
  showStoryLine();
}

function storyAdvance(){
  if(!storySession)return false;
  if(storySession.sceneIntroActive)return finishStorySceneIntro();
  /* 컷씬만 보여 주는 동안의 클릭은 "다음 대사"가 아니라 "그만 기다리고
     대사를 올려라"입니다. 이걸 먼저 안 보면 대기 중에는 아직 typing 이
     없어서 클릭 한 번에 그 대사를 통째로 건너뛰게 됩니다. */
  if(releaseStoryCinematicHold())return true;
  /* 소품이 떠오르는 동안의 클릭도 "다음 대사"가 아니라 "그만 기다리고 자막을
     올려라"입니다. 이걸 먼저 안 보면 그동안은 아직 typing 이 없어서 아래
     자막 쪽 넘김으로 빠지고, 첫 쪽이 통째로 지나갑니다. */
  if(releaseStoryPropReveal())return true;
  if(storySession.typing&&!storySession.typing.complete){finishStoryTyping();return true;}
  if(showNextStorySubtitlePage())return true;
  // QA_REMOVE: 미리보기에서는 조리·선택·완료 처리 없이 대사 인덱스만 이동합니다.
  if(storySession.qaPreview){
    return typeof qaStoryStep==="function"?qaStoryStep(1):true;
  }
  if(storySession.waitingForJournal)return true;
  const line=storySession.lines[storySession.lineIndex];
  /* 달빛 조각 한 박자. 대사를 다 읽고 한 번 더 누르면 그때 조각이 떠오르고,
     그다음 누름에 장면이 넘어갑니다. 대사와 같이 띄우면 글을 읽기도 전에
     오버레이가 화면을 덮어 버립니다(showStoryLine 쪽 주석 참고). */
  if(line?.fragmentHandoff?.state==="full"&&storySession.fragmentRevealedAt!==storySession.lineIndex){
    storySession.fragmentRevealedAt=storySession.lineIndex;
    applyStoryFragmentHandoff(line);
    audio?.click();
    return true;
  }
  if(line?.openJournalOnAdvance){
    // 이 자막을 모두 읽은 뒤 책을 실제로 펼칩니다. 책을 닫기 전에는 다음
    // 자막의 타이핑을 시작하지 않아, 책 뒤에서 대사가 지나가지 않습니다.
    storySession.lineIndex++;
    storySession.subtitle=null;
    storySession.typing=null;
    storySession.waitingForJournal=true;
    /* 소품으로 띄워 둔 영업일지를 여기서 내립니다. 이 줄은 다음 줄의
       showStoryLine 을 부르지 않고 책을 펼치므로(책을 닫아야 이어집니다),
       놔두면 펼친 책 뒤로 같은 책이 한 권 더 비칩니다. */
    clearStoryPropReveal();
    audio?.click();
    const opened=typeof openGameplayJournal==="function"&&openGameplayJournal();
    if(!opened){storySession.waitingForJournal=false;showStoryLine();}
    else saveGame(true);
    return true;
  }
  if(line?.choices)return true;
  if(storySession.waitingForCook)return true;
  if(line?.cook){
    audio?.click();
    startStoryCookChallenge(storySession.scene,line.cook,{lineIndex:storySession.lineIndex});
    return true;
  }
  if(line?.orderCook){
    audio?.click();
    suspendStoryForOrderCook(storySession.scene,line.orderCook,{lineIndex:storySession.lineIndex});
    return true;
  }
  storySession.lineIndex++;
  audio?.click();
  showStoryLine();
  return true;
}

function resumeStoryAfterJournal(){
  if(!storySession?.waitingForJournal)return false;
  storySession.waitingForJournal=false;
  showStoryLine();
  saveGame(true);
  return true;
}

// 무대 배치 규칙: 주인공은 항상 맨 왼쪽 자리, 나머지 화자는 등장 순서대로 오른쪽 끝까지 균등 배치합니다.
// (상대 1명이면 오른쪽, 2명이면 중앙·오른쪽, 그 이상은 같은 간격으로 계속 벌어집니다.)
const STORY_ACTOR_MAX_WIDTH=24;
/* 좌우 여백. 2 였을 때는 두 사람이 14% / 86% 에 서서 화면 양끝에 붙어 보였고,
   14 로 넓혔더니 이번엔 25% / 75% 로 너무 가운데에 몰렸습니다. 지금 8 은
   두 사람이 20% / 80% 에 서는 값입니다.

   ⚠️ 원화(.story-portrait.art)의 실제 폭은 --actor-w 보다 넓습니다. 상자를 그림
   비율에 맞춰 절대 배치하기 때문에 이 자리 계산에는 안 잡힙니다. 그래서 여백을
   여기서 더 키우면 세 명이 서는 장면(SCN-G8-완벽)에서 원화가 옆 사람과 겹칩니다. */
const STORY_ACTOR_MARGIN=8;
const STORY_ACTOR_GUTTER=1.5;

/* [컷씬 중에도 말하는 줄에서는 원화를 올립니다]
   컷씬이 깔리면 배우 무대가 통째로 감춰집니다(css/story.css). 컷은 대사 한
   줄이 아니라 '구간'에 걸리므로, 그대로 두면 그 구간의 대사가 전부 배우 없이
   지나갑니다 — 장면 전체가 한 컷인 SCN-P03 은 김다은이 네 마디를 하는 동안
   컷 속 자세 하나로만 서 있었습니다.

   그래서 '말하는 줄'에서는 무대를 다시 올립니다. 다만 컷에 따라서는 올리면
   안 됩니다(조각 전달 컷은 그 사람이 이미 그려져 있어 둘이 됩니다). 그 판단은
   컷마다 story-cinematic.js 의 STORY_CUTSCENES[].speakerArt 에 적혀 있습니다. */
function updateStoryCinematicSpeaking(line){
  const overlay=document.getElementById("storyOverlay");
  if(!overlay)return;
  /* 화자가 없는 줄(내레이션·속말 자막)에서는 직전 화자를 이어받습니다.
     안 그러면 자막과 대사가 번갈아 나오는 프롤로그에서 한 칸 넘길 때마다
     무대가 통째로 내려갔다 올라와, 배우가 매번 새로 떠오르는 것처럼 보입니다.
     조명 쪽과 같은 기준입니다(storyStageSpeaker 주석).

     ⚠️ 컷을 혼자 보여 주는 줄(cinematic.hold)만 예외입니다. 그 한 박자는
        원화만 보라고 일부러 비워 두는 자리라, 여기서 이어받으면 그 위에
        배우가 서서 연출이 사라집니다. */
  const speakerId=line?.cinematic?.hold?(line?.speaker||null):storyStageSpeaker(line?.speaker||null);
  // 컷씬이 안 깔려 있으면 true 라 평소 대화에는 영향이 없습니다.
  const allowedByCut=typeof storyCinematicShowsSpeakerArt!=="function"||storyCinematicShowsSpeakerArt();
  const speaking=!!speakerId&&storySpeakerHasPortrait(speakerId)&&allowedByCut;
  overlay.classList.toggle("story-cinematic-speaking",speaking);
}

function resetStoryStage(){
  clearStoryCinematic();
  document.getElementById("storyOverlay")?.classList.remove("story-cinematic-speaking");
  applyStoryFragmentHandoff(null);
  /* 소품도 여기서 정리합니다. 남겨 두면 자막을 붙잡고 있던 타이머가 뒤늦게
     터져서, 사라진 대사를 다음 장면 위에 타이핑합니다. */
  clearStoryPropReveal();
  applyStoryEndingBackground(null);
  const stage=document.getElementById("storyStage");
  if(stage)stage.innerHTML="";
  if(storySession)storySession.actors=[];
  // 배우를 지웠으니 "직전 화자" 기억도 함께 버립니다(storyStageSpeaker 참고).
  // 남겨 두면 다음 장면 첫 내레이션에서 지난 장면 사람이 조명을 받습니다.
  if(storySession)storySession.lastSpeakerId=null;
}

/* ------------------------------------------------------------------
   주인공 원화(assets/Conversation)
   ------------------------------------------------------------------
   대사마다 문맥에 맞는 동작으로 갈아 끼웁니다. 짝짓기는 story-data.js 가
   각 대사 줄에 motion:"..." 으로 적어 두고, 안 적힌 줄은 DEFAULT 로 섭니다.

   복장은 두 벌입니다. 가게에 들어가기 전 퇴근길은 회사원, 그 뒤로는 전부
   주방 복장입니다. 장면 쪽에서 protagonistCostume 으로 고릅니다.

   두 복장 열여덟 장 모두 tools/build-conversation-webp.js 가 '같은 크롭
   박스'로 뽑았기 때문에 얼굴 위치가 어긋나지 않습니다. 그래서 배경 이미지만
   바꿔도 표정만 바뀐 것처럼 보이고 인물이 덜컹거리지 않습니다.
   (복장 사이의 크기 차이는 css/story.css 의 --art-height 가 맞춥니다)
   ------------------------------------------------------------------ */
const STORY_PROTAGONIST_MOTIONS=Object.freeze({
  calm:"01",     // 손 모으고 잔잔한 미소 · 기본값
  soft:"02",     // 머리카락 넘기며 미소 · 다정하게 건네는 말
  think:"03",    // 검지를 턱에 대고 골똘 · 질문과 고민
  sad:"04",      // 고개 숙이고 눈 내리깔기 · 지치고 가라앉음
  cook:"05",     // 팬을 들고 요리 · 조리와 영업 이야기
  resolve:"06",  // 두 주먹 쥐고 불꽃 · 각오와 의욕
  happy:"07",    // 두 손 들고 반짝 웃음 · 기쁨과 감탄
  cry:"08",      // 눈물 훔치기 · 깊은 슬픔
  angry:"09"     // 주먹 들고 화남 · 분노와 항의
});
const STORY_PROTAGONIST_DEFAULT_MOTION="calm";

/* 등장인물별 원화.
   dir/stem 은 tools/build-conversation-webp.js 의 PORTRAITS 와 같아야 합니다.

   height/drop 은 그 도구가 원화 안 인물을 실측해 계산한 값입니다(단위 %).
   손으로 고치지 마세요. 원화를 새로 받으면 이렇게 다시 뽑아 붙입니다:

     node tools/build-conversation-webp.js --css

   height 는 원화 상자를 무대 높이의 몇 %로 세울지, drop 은 그 상자 바닥을
   무대 바닥보다 얼마나 내릴지입니다. drop 이 인물마다 다른 건 저마다 캔버스
   안 발끝 높이가 달라서이고, 이 값 덕분에 모두 같은 바닥선에 섭니다.
   height 가 대체로 같은 건 '그려진 크기 그대로' 두기 때문입니다 —
   작은 짐승만 눈에 띄게 작은 것이 의도한 결과입니다. */
const STORY_PORTRAIT_ART=Object.freeze({
  protagonistChef:{dir:"char_cust_kim_daeun_chef",stem:"char_cust_kim_daeun",height:181.3,drop:73.3},
  protagonistOffice:{dir:"char_cust_kim_daeun_office",stem:"char_cust_kim_daeun_office",height:163.1,drop:63.7},
  // 아이라 어른들보다 작게 세웁니다(도구의 scale 0.85).
  rainyChild:{dir:"char_cust_rain_child",stem:"char_cust_rain_child",height:142.5,drop:40.8},
  lanternGuest:{dir:"char_cust_lantern_head",stem:"char_cust_lantern_head",height:177.3,drop:74.0},
  twinShadows:{dir:"char_cust_joined_shadows",stem:"char_cust_joined_shadows",height:167.0,drop:64.6},
  crowCourier:{dir:"char_cust_crow_postman",stem:"char_cust_crow_postman",height:176.6,drop:73.7},
  // 작은 짐승만 대사창 턱에 걸터앉는 방식입니다(도구의 anchor:"feet").
  starBeast:{dir:"char_cust_star_eating_beast",stem:"char_cust_star_eating_beast",height:151.8,drop:42.6},
  seawaterGuest:{dir:"char_cust_seawater_guest",stem:"char_cust_seawater_guest",height:167.0,drop:66.1},
  schoolDoll:{dir:"char_cust_stopped_school_doll",stem:"char_cust_stopped_school_doll",height:167.0,drop:66.1},
  facelessDaeun:{dir:"char_cust_faceless_kim_daeun",stem:"char_cust_faceless_kim_daeun",height:167.0,drop:66.1}
});

/* 화자 → 원화 열쇠. 여기에 없는 화자는 원화가 없다는 뜻입니다.
   - 김다은은 장면의 protagonistCostume 에 따라 두 벌 중 하나입니다.
   - 왼쪽/오른쪽 그림자는 한 몸이라 배우도 원화도 twinShadows 하나를 씁니다.
   - '또 다른 김다은'은 얼굴 없는 손님의 얼굴이 드러난 모습이라 같은 원화입니다. */
function storyPortraitKey(speakerId){
  if(speakerId==="protagonist"){
    return storySession?.scene?.protagonistCostume==="office"
      ?"protagonistOffice"
      :"protagonistChef";
  }
  if(["leftShadow","rightShadow","twinShadows"].includes(speakerId))return "twinShadows";
  if(speakerId==="anotherDaeun")return "facelessDaeun";
  return STORY_PORTRAIT_ART[speakerId]?speakerId:null;
}

function storyPortraitMotionArt(portraitKey,motion){
  const art=STORY_PORTRAIT_ART[portraitKey];
  if(!art)return "";
  const index=STORY_PROTAGONIST_MOTIONS[motion]||STORY_PROTAGONIST_MOTIONS[STORY_PROTAGONIST_DEFAULT_MOTION];
  return `assets/Conversation/${art.dir}/${art.stem}_motion_${index}.webp`;
}

/* ⚠️ --portrait-art 에 상대경로를 그대로 넣으면 그림이 안 나옵니다.
   커스텀 속성 안의 url() 은 그 값을 '쓰는' 스타일시트(css/story.css)를 기준으로
   풀립니다. 그래서 "assets/..." 는 "css/assets/..." 가 되어 404 가 납니다.
   인라인 style 로 넣어도 마찬가지입니다. 문서 기준 절대 URL 로 바꿔서 넘깁니다. */
function storyPortraitArtValue(source){
  return `url("${new URL(source,document.baseURI).href}")`;
}

/* 대사마다 그림을 바꾸므로, 처음 쓰이는 순간 받아오면 한 박자 비어 보입니다.
   무대에 오르는 인물의 아홉 장을 그때 한꺼번에 미리 받아 둡니다(인물당 1.5MB
   안팎). 열 명분을 전부 받지는 않습니다 — 한 장면에 서는 건 많아야 셋이고,
   그 날 안 나오는 손님까지 받으면 15MB 를 통째로 내려받게 됩니다.

   ⚠️ 받아 온 Image 객체는 반드시 붙잡아 둡니다. 예전에는 만들어 놓고 버렸는데,
      그러면 해독(decode)해 둔 그림이 함께 사라져서 대사마다 다시 해독하게 되고
      그 사이 배경이 비어 배우가 깜빡였습니다(아래 setStoryPortraitArt 참고). */
const storyPortraitArtImages=new Map();
function storyPortraitArtImage(source){
  let image=storyPortraitArtImages.get(source);
  if(!image){
    image=new Image();
    image.src=source;
    storyPortraitArtImages.set(source,image);
  }
  return image;
}
const storyPortraitArtPreloaded=new Set();
function preloadStoryPortraitArt(portraitKey){
  if(!portraitKey||storyPortraitArtPreloaded.has(portraitKey))return;
  storyPortraitArtPreloaded.add(portraitKey);
  Object.keys(STORY_PROTAGONIST_MOTIONS).forEach(motion=>{
    storyPortraitArtImage(storyPortraitMotionArt(portraitKey,motion));
  });
}

/* [동작을 갈아 끼울 때 배우가 통째로 깜빡이던 문제]
   background-image 를 곧바로 바꾸면, 새 그림이 화면에 올라오기 전 한두 프레임
   동안 배경이 비어서 인물이 통째로 사라졌다 나타납니다. 원화가 1250x1800 이라
   해독이 공짜가 아니고, 대사마다 동작이 바뀌니 한마디마다 그게 보였습니다.

   그래서 decode() 로 그림이 그릴 준비를 마친 것을 확인한 뒤에야 바꿉니다.
   기다리는 동안에는 직전 동작이 그대로 서 있으므로, 눈에는 아무 효과 없이
   다음 동작으로 바로 넘어간 것처럼 보입니다(크로스페이드가 아닙니다).

   ⚠️ decode() 는 비동기라, 기다리는 사이에 대사가 넘어가 다른 동작이 예약될
      수 있습니다. 마지막으로 요청한 경로를 dataset 에 적어 두고, 돌아왔을 때
      그 경로가 아직 최신일 때만 반영합니다. 안 그러면 지나간 동작이 뒤늦게
      덮어써서 대사와 자세가 어긋납니다. */
function setStoryPortraitArt(portrait,source){
  if(!portrait||!source)return;
  if(portrait.dataset.artSource===source)return;   // 같은 동작이면 손댈 것이 없습니다
  portrait.dataset.artSource=source;
  const apply=()=>{
    if(portrait.dataset.artSource!==source)return; // 기다리는 사이 다음 줄로 넘어갔습니다
    portrait.style.setProperty("--portrait-art",storyPortraitArtValue(source));
  };
  const image=storyPortraitArtImage(source);
  // decode() 가 실패해도(경로 오타 등) 예전처럼 그냥 넣습니다 — 여기서 삼키면
  // 그림이 없는 것과 원화 자체가 안 나오는 것을 구분할 수 없게 됩니다.
  if(typeof image.decode==="function")image.decode().then(apply,apply);
  else apply();
}

/* 말하는 사람의 동작만 바꿉니다. 나머지 배우는 마지막 동작 그대로 어두워진 채
   서 있습니다 — 대사마다 전원이 같이 움직이면 누가 말하는지 흐려집니다. */
function applyStorySpeakerMotion(line){
  const speakerId=line?.speaker;
  if(!speakerId)return;
  const portraitKey=storyPortraitKey(speakerId);
  if(!portraitKey)return;
  // 그림자 셋은 배우 하나를 공유하므로 배우 id 로 다시 찾습니다.
  const actorId=["leftShadow","rightShadow","twinShadows"].includes(speakerId)?"twinShadows":speakerId;
  const actor=(storySession?.actors||[]).find(entry=>entry.id===actorId);
  const portrait=actor?.element.querySelector(".story-portrait.art");
  if(!portrait)return;
  setStoryPortraitArt(portrait,storyPortraitMotionArt(portraitKey,line.motion));
}

function applyStoryPortraitArt(portrait,speakerId){
  const portraitKey=storyPortraitKey(speakerId);
  if(portraitKey){
    const art=STORY_PORTRAIT_ART[portraitKey];
    preloadStoryPortraitArt(portraitKey);
    portrait.classList.add("art");
    // 인물마다 캔버스에 그려진 크기와 발끝 높이가 달라 상자 치수를 따로 넣습니다.
    portrait.style.setProperty("--art-height",`${art.height}%`);
    portrait.style.setProperty("--art-drop",`${-art.drop}%`);
    setStoryPortraitArt(portrait,storyPortraitMotionArt(portraitKey,STORY_PROTAGONIST_DEFAULT_MOTION));
    return;
  }
  const character=STORY_CHARACTERS[speakerId];
  if(character?.art){
    portrait.classList.add("art");
    portrait.style.setProperty("--portrait-art",storyPortraitArtValue(character.art));
    return;
  }
  if(!character||character.portraitRow==null){portrait.classList.add("role");return;}
  const row=clamp(character.portraitRow,0,5);
  portrait.style.setProperty("--portrait-y",row===5?"100%":`${row*20}%`);
}

/* 몸이 없는 화자는 무대에 세우지 않습니다.
   상사(회상)·영업일지·달빛식탁의 목소리·편지·메뉴판 뒷면은 원화도 도트 초상화도
   없는 배역입니다. 예전에는 이들 자리에 ✦ 하나만 있는 빈 갈색 패널(.story-portrait
   .role)이 대신 섰는데, 컷씬이 무대를 가려 준 덕에 눈에 안 띄었을 뿐입니다.
   이름표와 대사만으로 충분한 화자들이라 아예 안 세웁니다.
   ⚠️ 이 배역들에 나중에 원화를 붙이면 art 를 채우세요. 그러면 다시 섭니다. */
function storySpeakerHasPortrait(speakerId){
  if(storyPortraitKey(speakerId))return true;   // 대화씬 원화가 있는 인물
  const character=STORY_CHARACTERS[speakerId];
  return !!character&&(!!character.art||character.portraitRow!=null);
}

function ensureStoryActor(speakerId){
  if(!storySession||!speakerId)return null;
  if(!storySpeakerHasPortrait(speakerId))return null;
  if(!storySession.actors)storySession.actors=[];
  // 왼쪽/오른쪽/합쳐진 목소리는 모두 '둘이 붙은 그림자' 한 몸에서
  // 나옵니다. 이름표만 화자에 따라 바꾸고 무대 배우는 하나를 공유합니다.
  const actorId=["leftShadow","rightShadow","twinShadows"].includes(speakerId)
    ?"twinShadows"
    :speakerId;
  const existing=storySession.actors.find(actor=>actor.id===actorId);
  if(existing)return existing;
  const stage=document.getElementById("storyStage");
  if(!stage)return null;
  const element=document.createElement("div");
  element.className="story-actor";
  element.dataset.speaker=actorId;
  const portrait=document.createElement("div");
  portrait.className="story-portrait";
  applyStoryPortraitArt(portrait,actorId);
  element.appendChild(portrait);
  stage.appendChild(element);
  const actor={id:actorId,element};
  if(actorId==="protagonist")storySession.actors.unshift(actor);
  else storySession.actors.push(actor);
  layoutStoryActors();
  requestAnimationFrame(()=>element.classList.add("entered"));
  return actor;
}

function layoutStoryActors(){
  const actors=storySession?.actors||[];
  if(!actors.length)return;
  const width=Math.min(STORY_ACTOR_MAX_WIDTH,(100-STORY_ACTOR_MARGIN*2)/actors.length-STORY_ACTOR_GUTTER);
  const left=STORY_ACTOR_MARGIN+width/2;
  const right=100-STORY_ACTOR_MARGIN-width/2;
  actors.forEach((actor,index)=>{
    const x=actors.length===1
      ?(actor.id==="protagonist"?left:right)
      :left+(right-left)*index/(actors.length-1);
    actor.element.style.setProperty("--actor-x",`${x}%`);
    actor.element.style.setProperty("--actor-w",`${width}%`);
  });
}

/* [화자가 없는 줄은 직전 화자의 조명을 그대로 잇습니다]
   내레이션과 속말 자막(storyCaption)에는 speaker 가 없습니다. 예전에는 그런
   줄에서 조명을 전부 껐는데, 자막과 대사가 번갈아 나오는 장면에서는 말하는
   사람이 바뀐 것도 아닌데 한 칸 넘길 때마다 배우가 가라앉았다 다시 떠올라
   화면이 깜빡이는 것처럼 보였습니다.

   그래서 마지막으로 말한 사람을 기억해 두고, 화자가 없는 줄은 그 상태를
   그대로 이어받습니다. 조명과 3.2% 떠오름이 움직이는 것은 **실제로 말하는
   사람이 바뀌는 순간뿐**입니다. 같은 사람이 계속 말하면서 동작(그림)만
   바뀔 때는 아무 연출 없이 자세만 갈아 끼웁니다.
   ⚠️ 기억은 장면 단위입니다. resetStoryStage() 가 배우와 함께 지웁니다. */
function storyStageSpeaker(speakerId){
  if(!storySession)return speakerId||null;
  if(speakerId)storySession.lastSpeakerId=speakerId;
  return speakerId||storySession.lastSpeakerId||null;
}

function setStoryPortrait(speakerId,line=null){
  if(!storySession)return;
  const stageSpeakerId=storyStageSpeaker(speakerId);
  if(stageSpeakerId)ensureStoryActor(stageSpeakerId);
  const activeActorId=["leftShadow","rightShadow","twinShadows"].includes(stageSpeakerId)
    ?"twinShadows"
    :stageSpeakerId;
  (storySession.actors||[]).forEach(actor=>{
    actor.element.classList.toggle("is-active",!!stageSpeakerId&&actor.id===activeActorId);
  });
  // 동작(그림)은 실제로 화자가 적힌 줄에서만 바꿉니다 — 이어받은 줄에서는
  // 직전 자세 그대로 서 있어야 자막 한 줄에 자세가 튀지 않습니다.
  applyStorySpeakerMotion(line);
}

function storyGuestIdForScene(scene){
  const source=scene?.sourceSceneId?STORY_SCENES[scene.sourceSceneId]:null;
  const id=source?.character||scene?.character||null;
  if(id==="anotherDaeun")return "facelessDaeun";
  return STORY_GUEST_IDS.includes(id)?id:null;
}

function recordStorySceneOutcome(scene){
  const guestId=storyGuestIdForScene(scene);
  if(guestId&&scene?.id){
    const result=getStoryGuestResult(guestId);
    if(!result.seenStoryScenes.includes(scene.id))result.seenStoryScenes.push(scene.id);
  }
  if(scene.specialGuest&&guestId){
    const guest=getStoryGuestState(guestId);
    const result=getStoryGuestResult(guestId);
    guest.visits++;
    guest.lastVisitDay=state.day;
    result.visited=true;
    recordStoryJournalGuest(guestId,scene);
    // 평가와 무관한 "만났다" 기록입니다. 회차를 넘겨 남아서, 다음 회차에
    // 같은 날짜의 낮 HUD가 '오늘의 특별 손님' 이름을 밝힙니다.
    window.MoonlightTableSave?.recordGuestMeeting?.(guestId,{
      day:Number(scene?.day)||Number(state.day)||1,
      sceneId:scene.id||null
    });
  }
  if(scene.missingMenu&&guestId){
    const guest=getStoryGuestState(guestId);
    const result=getStoryGuestResult(guestId);
    guest.clueFound=true;
    result.visited=true;
    result.reactionSceneId=scene.id;
    state.story.specialHandledDays[guestId]=state.story.loop;
    recordStoryJournalGuest(guestId,scene);
  }
  if(scene.resultTier&&guestId){
    const guest=getStoryGuestState(guestId);
    const result=getStoryGuestResult(guestId);
    const previousFragmentState=result.fragmentState;
    const earnedFragmentState=storyFragmentStateForResult(scene,guestId);
    guest.foodConfirmed=true;
    result.visited=true;
    result.evaluationTier=scene.resultTier;
    result.reactionSceneId=scene.id;
    result.fragmentState=strongerStoryFragmentState(previousFragmentState,earnedFragmentState);
    if(result.fragmentState!=="none")result.fragmentName=scene.shardName||scene.shardId||null;
    guest.revealedStoryLevel=Math.max(
      Number(guest.revealedStoryLevel)||0,
      storyTierRevealLevel(scene.resultTier)
    );
    if(earnedFragmentState==="full"){
      guest.memoryUnlocked=true;
      if(previousFragmentState!=="full"){
        recordStoryJournalShard(scene,guestId);
        showToast(`달빛 조각 「${scene.shardName||scene.shardId}」을 받았습니다.`);
      }
    }else if(earnedFragmentState==="partial"&&previousFragmentState==="none"){
      showToast(`달빛 조각 「${scene.shardName||scene.shardId}」을 일부 되찾았습니다.`);
    }
    state.story.specialHandledDays[guestId]=state.story.loop;
    state.story.pendingResultSceneId=null;
    recordStoryJournalGuest(guestId,scene);
  }
  if(scene.endingId){
    state.story.endingsSeen[scene.endingId]=true;
    recordStoryJournalEnding({...scene,id:scene.endingId,title:scene.endingTitle||scene.title});
  }
  if(scene.id==="SCN-J01"){
    state.story.endingsSeen.loop_return=true;
    recordStoryJournalEnding({id:"loop_return",title:"다시 첫째 날"});
  }
}

function queueStoryConclusion(scene){
  if(!storySession||!scene)return;
  if(scene.autoLoop)storySession.conclusionAction={type:"nextLoop",toTitle:false};
  else if(scene.continuePolicy==="nextLoop")storySession.conclusionAction={type:"nextLoop",toTitle:true};
  else if(scene.continuePolicy==="endingRetryMenu")storySession.conclusionAction={
    type:"endingRetryMenu",
    judgementSceneId:scene.retryJudgementSceneId,
    endingSceneId:scene.id,
    endingTitle:scene.endingTitle||scene.title,
    acceptPolicy:"nextLoop"
  };
  else if(scene.trueEndingEpilogue){
    const ending=STORY_SCENES[scene.endingSceneId];
    // 후일담까지 본 시점에 영구 기록을 먼저 남깁니다. 다른 선택으로 돌아가도
    // 이미 확인한 진엔딩 후일담은 타이틀 영업일지에서 사라지지 않습니다.
    window.MoonlightTableSave?.unlockTrueEndingEpilogues?.();
    storySession.conclusionAction={
      type:"endingRetryMenu",
      judgementSceneId:ending?.retryJudgementSceneId,
      endingSceneId:ending?.id,
      endingTitle:ending?.endingTitle||ending?.title,
      acceptPolicy:"trueEnding"
    };
  }
}

function completeStoryScene(){
  if(!storySession)return;
  const scene=storySession.scene;
  markStorySceneCompleted(scene);
  if(scene.completesPrologue)state.story.prologueComplete=true;
  if(scene.ending)state.story.endingSeen=true;
  if(scene.autoOpenJournal)storySession.openJournalAfterFinish=true;
  if(scene.opensMenuSelection)storySession.openMenuAfterFinish=true;
  recordStorySceneOutcome(scene);
  queueStoryConclusion(scene);
  const conclusionQueued=!!storySession.conclusionAction;
  if(scene.character&&STORY_GUEST_IDS.includes(scene.character)){
    const guest=getStoryGuestState(scene.character);
    guest.affinity+=Number(scene.affinity)||0;
    guest.arcStep=Math.max(guest.arcStep,Number((scene.id.match(/-(\d\d)$/)||[])[1])||0);
    if(scene.regular)guest.regular=true;
  }
  if(scene.nextSceneId&&!scene.autoLoop&&STORY_SCENES[scene.nextSceneId]){
    const insertAt=storySession.queueIndex+1;
    if(storySession.queue[insertAt]!==scene.nextSceneId)storySession.queue.splice(insertAt,0,scene.nextSceneId);
  }
  updateRelationshipUI();
  storySession.queueIndex++;
  beginNextStoryScene();
  // 완료된 현재 장면은 체크포인트를 만들 수 없으므로, 다음 장면으로
  // 커서를 옮긴 뒤 완료 플래그와 새 재개 위치를 한 번에 저장합니다.
  // 회귀·엔딩 결론은 자체 최종 저장/삭제 경로가 있으므로 결론 직전의
  // 완료된 Day 7 상태를 자동 저장하지 않습니다.
  if(!conclusionQueued)saveGame(true);
}

function storyCookingTier(score,thresholds=null){
  const custom=thresholds&&typeof thresholds==="object"?thresholds:null;
  const great=Number.isFinite(custom?.great)?custom.great:80;
  const hasWarm=custom?Object.prototype.hasOwnProperty.call(custom,"warm"):true;
  const warm=hasWarm&&Number.isFinite(custom?.warm)?custom.warm:custom?null:50;
  if(score>=great)return "great";
  if(warm!=null&&score>=warm)return "warm";
  return "soft";
}

function startStoryCookChallenge(scene,cook,metadata={}){
  if(!storySession||state.story.activeStoryCook)return false;
  const dish=dishById(cook?.dishId||scene.dishId);
  if(!dish||!Array.isArray(dish.cook)||!dish.cook.length){
    showToast("조리할 메뉴 정보를 찾지 못했습니다.",true);
    return false;
  }
  const lineIndex=Number.isInteger(metadata.lineIndex)?metadata.lineIndex:storySession.lineIndex;
  state.story.activeStoryCook={
    sceneId:scene.id,
    guestId:scene.character||null,
    dishId:dish.id,
    steps:dish.cook.map(step=>({...step})),
    stepIndex:0,
    scores:[],
    lineIndex,
    resultKey:cook.resultKey||`${scene.id}:line:${lineIndex}`,
    tutorial:!!cook.tutorial,
    special:!!cook.special,
    thresholds:cook.thresholds&&typeof cook.thresholds==="object"?{...cook.thresholds}:null
  };
  storySession.waitingForCook=true;storySession.suspended=true;
  const startStation=stationById(cook.startStation);
  if(startStation&&state.player){
    state.player.x=startStation.ix;
    state.player.y=startStation.iy;
    state.player.facing=startStation.facing;
    state.player.moving=false;
  }
  state.paused=false;
  document.getElementById("storyOverlay").classList.remove("open");
  showStoryCookStationGuide();
  updateUI(true);
  return true;
}

function storyCookStationGuideText(){
  const challenge=state.story?.activeStoryCook;
  const step=activeStoryCookStep();
  if(!challenge||!step)return "";
  const dish=dishById(challenge.dishId)||DISHES[0];
  const station=stationById(step.station);
  return `${dish.name} 조리: ${station?.label||step.station} 가까이 이동해 상호작용하세요.`;
}

function showStoryCookStationGuide(){
  const text=storyCookStationGuideText();
  if(!text)return false;
  showToast(text);
  return true;
}

function launchStoryCookStep(stationId){
  const challenge=state.story?.activeStoryCook;
  const step=activeStoryCookStep();
  if(!challenge||!step||stationId!==step.station)return false;
  const dish=dishById(challenge.dishId)||DISHES[0];
  startMini(step.game,step.station,{
    mode:"story",storySceneId:challenge.sceneId,dishId:dish.id,
    special:!!challenge.special,tutorial:!!challenge.tutorial,guestId:challenge.guestId,
    resultKey:challenge.resultKey
  });
  return true;
}

function completeStoryCookStep(score){
  const challenge=state.story?.activeStoryCook;
  if(!challenge)return false;
  challenge.scores.push(score);
  challenge.stepIndex++;
  if(challenge.stepIndex<challenge.steps.length){
    state.paused=false;
    showStoryCookStationGuide();
    updateUI(true);
    return true;
  }

  const average=Math.round(challenge.scores.reduce((sum,value)=>sum+value,0)/challenge.scores.length);
  const tier=storyCookingTier(average,challenge.thresholds);
  state.story.storyCookResults[challenge.resultKey]={
    score:average,tier,day:state.day,dishId:challenge.dishId
  };
  state.story.activeStoryCook=null;

  if(storySession){
    storySession.waitingForCook=false;storySession.suspended=false;
    storySession.lineIndex=challenge.lineIndex+1;
    state.paused=true;
    document.getElementById("storyOverlay").classList.add("open");
    showStoryLine();
  }
  return true;
}

function suspendStoryForOrderCook(scene,config,metadata={}){
  if(!storySession||storySession.pendingCook)return false;
  config=config&&typeof config==="object"?config:{};
  const order=state.orders.find(item=>item.storySceneId===scene.id);
  if(!order){
    showToast("이야기 손님의 주문을 찾지 못했습니다. 손님이 도착한 뒤 다시 시도해 주세요.",true);
    return false;
  }
  if(scene.requiresDishChoice){
    const chosenDish=dishById(config.dishId);
    const selectedMenus=Array.isArray(state.selectedMenus)?state.selectedMenus:[];
    const prepared=chosenDish&&(
      typeof dishPreparedForService!=="function"||dishPreparedForService(chosenDish.id)
    );
    if(!chosenDish||!selectedMenus.includes(chosenDish.id)||!prepared){
      showToast("오늘 준비한 음식 중 하나를 골라 주세요.",true);
      return false;
    }
    order.dishId=chosenDish.id;
    order.guestOrder=true;
    order.awaitingDishChoice=false;
    order.menuSelected=true;
    order.missingMenu=false;
  }
  order.specialRecipe=!!config.special;
  storySession.waitingForCook=true;storySession.suspended=true;
  storySession.pendingCook={
    sceneId:scene.id,
    orderId:order.id,
    config:{
      ...config,
      thresholds:config.thresholds&&typeof config.thresholds==="object"?{...config.thresholds}:null,
      replies:config.replies&&typeof config.replies==="object"?{...config.replies}:null
    },
    choice:metadata.choice?{...metadata.choice}:null,
    choiceIndex:Number.isInteger(metadata.choiceIndex)?metadata.choiceIndex:null,
    lineIndex:Number.isInteger(metadata.lineIndex)?metadata.lineIndex:storySession.lineIndex
  };
  if(typeof syncSelectedOrderToQueue==="function")syncSelectedOrderToQueue();
  else state.selectedOrderId=order.id;
  state.paused=false;
  document.getElementById("storyOverlay").classList.remove("open");
  showToast(config.special
    ?`${storyDisplayName(order.guestId)}을 위한 특별 조리를 완성해 주세요.`
    :`${storyDisplayName(order.guestId)}의 주문을 조리해 제공해 주세요.`);
  updateUI(true);
  saveGame(true);
  return true;
}

function configuredStoryCookReply(scene,config,metadata,tier){
  const configured=config.replies?.[tier];
  if(configured&&typeof configured==="object"){
    return {
      speaker:configured.speaker||metadata.choice?.speaker||scene.character||"protagonist",
      text:String(configured.text||"잘 먹었습니다.")
    };
  }
  const fallback={
    great:"정성 들인 맛이 제대로 전해졌어요.",
    warm:"괜찮네요. 잘 먹었어요.",
    soft:"맛은 그럭저럭이네요."
  };
  return {
    speaker:metadata.choice?.speaker||scene.character||"protagonist",
    text:typeof configured==="string"?configured:fallback[tier]
  };
}

function recordStoryCookOutcome(scene,config,metadata,order,score,tier){
  const choice=metadata.choice;
  const index=metadata.choiceIndex;
  if(Number.isInteger(index))state.story.choices[scene.id]=index;
  if(choice?.flag)state.story.flags[choice.flag]=true;
  const potential=Math.max(0,Number(choice?.affinity)||0);
  const affinityDelta=tier==="great"?potential:tier==="warm"?Math.min(1,potential):0;
  if(scene.character&&STORY_GUEST_IDS.includes(scene.character)){
    const guest=getStoryGuestState(scene.character);
    guest.affinity+=affinityDelta;
  }
  const resultKey=config.resultKey||scene.id;
  state.story.storyCookResults[resultKey]={
    score,tier,day:state.day,dishId:order.dishId,
    matchedDish:!order.storyDishId||order.dishId===order.storyDishId,
    choiceIndex:Number.isInteger(index)?index:null,affinityDelta
  };
  return configuredStoryCookReply(scene,config,metadata,tier);
}

function finishSuspendedStoryCook(order,satisfaction){
  const pending=storySession?.pendingCook;
  if(!storySession?.suspended||!pending||pending.orderId!==order.id)return false;
  const scene=STORY_SCENES[pending.sceneId];
  if(!scene)return false;
  const tier=storyCookingTier(satisfaction,pending.config.thresholds);
  const metadata={choice:pending.choice,choiceIndex:pending.choiceIndex};
  const reply=recordStoryCookOutcome(scene,pending.config,metadata,order,satisfaction,tier);
  const lineIndex=pending.lineIndex;
  const suppressReply=!!pending.config.suppressReply;
  storySession.pendingCook=null;storySession.waitingForCook=false;storySession.suspended=false;
  state.paused=true;
  if(!suppressReply)storySession.lines.splice(lineIndex+1,0,reply);
  storySession.lineIndex=lineIndex+1;
  document.getElementById("storyOverlay").classList.add("open");
  showStoryLine();
  return true;
}

function showTitleAfterStory({save=true}={}){
  if(save)saveGame(true);
  audio.stopAllFiles?.();
  clearStoryRuntime();
  state.screen="title";state.paused=true;state.mini=null;
  stopIngredientTimer?.();
  dom.settingsOverlay.classList.remove("open");
  dom.resultOverlay.classList.remove("open");
  dom.miniOverlay.classList.remove("open");
  dom.menuSelectOverlay.classList.remove("open");
  dom.ingredientSelectOverlay?.classList.remove("open");
  dom.gameScreen.classList.remove("active");
  dom.titleScreen.classList.add("active");
  showGameHud(false);audio.stopBgm();
  updateContinueButton();
}

function archiveCurrentStoryLoopResults(){
  if(!state.story)return false;
  STORY_GUEST_IDS.forEach(id=>{
    const guest=getStoryGuestState(id);
    const result=getStoryGuestResult(id);
    guest.previousLoopVisited=!!result.visited;
    // 음식 미준비 방문은 단서만 더하고 마지막 실제 평가를 지우지 않습니다.
    if(result.evaluationTier){
      guest.previousLoopTier=result.evaluationTier;
      guest.previousLoopScore=Number.isFinite(result.evaluationScore)?result.evaluationScore:null;
    }
    if(result.reactionSceneId)guest.previousLoopReactionSceneId=result.reactionSceneId;
    guest.previousLoopFragmentState=result.fragmentState;
    if(result.fragmentState==="partial")guest.previouslyObtainedPartial=true;
    if(result.fragmentState==="full")guest.previouslyObtainedFull=true;
    guest.seenStoryScenes=[...new Set([
      ...(guest.seenStoryScenes||[]),
      ...(result.seenStoryScenes||[])
    ])];
    // 현재 회차 호환 필드가 누적 조각 판정으로 새어 나가지 않도록 비웁니다.
    guest.shardOwned=false;
    guest.currentTier=null;
    guest.currentScore=null;
  });
  state.story.guestResults=Object.fromEntries(
    STORY_GUEST_IDS.map(id=>[id,createStoryGuestResult()])
  );
  state.story.storyCookResults={};
  return true;
}

function beginNextStoryLoop({toTitle=false}={}){
  archiveCurrentStoryLoopResults();
  state.story.loop=Math.max(1,Number(state.story.loop)||1)+1;
  state.story.pendingNightGuests=[];
  state.story.specialHandledDays={};
  state.story.activeStoryCook=null;
  state.story.pendingResultSceneId=null;
  state.story.judgmentComplete=false;
  state.story.endingSeen=false;
  state.day=DayManager.setDay(1);
  state.paused=false;
  resetDay(false);
  saveGame();
  if(toTitle){showTitleAfterStory({save:false});return;}
  queueStoryMoments(["dayStart"]);
}

function endingRetryElements(){
  return {
    overlay:document.getElementById("endingRetryOverlay"),
    title:document.getElementById("endingRetryTitle"),
    description:document.getElementById("endingRetryDescription"),
    branchButton:document.getElementById("endingRetryBranchButton"),
    acceptButton:document.getElementById("endingAcceptButton")
  };
}

function endingRetryMenuIsOpen(){
  return !!endingRetryElements().overlay?.classList.contains("open");
}

function validEndingRetryAction(action){
  const judgement=STORY_SCENES[action?.judgementSceneId];
  const ending=STORY_SCENES[action?.endingSceneId];
  const acceptPolicy=action?.acceptPolicy||"nextLoop";
  return action?.type==="endingRetryMenu"
    &&!!judgement
    &&!!ending
    &&ending.retryJudgementSceneId===judgement.id
    &&(
      (acceptPolicy==="nextLoop"&&ending.continuePolicy==="endingRetryMenu")
      ||(acceptPolicy==="trueEnding"&&ending.trueEnding===true)
    );
}

function closeEndingRetryMenu(){
  const {overlay}=endingRetryElements();
  overlay?.classList.remove("open");
  overlay?.setAttribute("aria-hidden","true");
  overlay?.setAttribute("inert","");
  pendingEndingRetryAction=null;
}

function showEndingRetryMenu(action,{restoredCheckpoint=false}={}){
  const {overlay,title,description,branchButton}=endingRetryElements();
  if(!overlay||!validEndingRetryAction(action)){
    if(restoredCheckpoint)window.MoonlightTableSave?.clearEndingRetryCheckpoint?.();
    else if(action?.acceptPolicy==="trueEnding")finishTrueEnding();
    else beginNextStoryLoop({toTitle:false});
    return false;
  }
  if(!restoredCheckpoint)window.MoonlightTableSave?.saveEndingRetryCheckpoint?.(action);
  pendingEndingRetryAction={...action,restoredCheckpoint:!!restoredCheckpoint};
  state.paused=true;
  if(title)title.textContent=`「${action.endingTitle||"엔딩"}」`;
  if(description)description.textContent="그때, 나는 다른 선택을 할 수도 있지 않았을까?";
  overlay.removeAttribute("inert");
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden","false");
  branchButton?.focus?.();
  return true;
}

function restoreStoredEndingRetryState(action){
  if(!action?.restoredCheckpoint)return true;
  if(typeof restoreEndingRetryCheckpointGame!=="function")return false;
  return restoreEndingRetryCheckpointGame(action);
}

function restoreEndingChoiceCheckpoint(action){
  const judgement=STORY_SCENES[action?.judgementSceneId];
  const ending=STORY_SCENES[action?.endingSceneId];
  if(!judgement||!ending)return false;
  delete state.story.completed[storySceneProgressKey(judgement)];
  delete state.story.completed[storySceneProgressKey(ending)];
  if(ending.trueEnding&&ending.nextSceneId&&STORY_SCENES[ending.nextSceneId]){
    delete state.story.completed[storySceneProgressKey(STORY_SCENES[ending.nextSceneId])];
  }
  delete state.story.choices[judgement.id];
  state.story.endingSeen=false;
  state.story.judgmentComplete=false;
  saveGame(true);
  updateUI(true);
  return playStoryScenes([judgement.id]);
}

function retryLastEndingBranch(){
  const action=pendingEndingRetryAction;
  if(!action)return;
  if(!restoreStoredEndingRetryState(action)){
    window.MoonlightTableSave?.clearEndingRetryCheckpoint?.();
    closeEndingRetryMenu();
    return;
  }
  window.MoonlightTableSave?.clearEndingRetryCheckpoint?.();
  closeEndingRetryMenu();
  if(!restoreEndingChoiceCheckpoint(action))beginNextStoryLoop({toTitle:false});
}

function acceptCurrentEnding(){
  const action=pendingEndingRetryAction;
  if(!action)return;
  if(!restoreStoredEndingRetryState(action)){
    window.MoonlightTableSave?.clearEndingRetryCheckpoint?.();
    closeEndingRetryMenu();
    return;
  }
  window.MoonlightTableSave?.clearEndingRetryCheckpoint?.();
  closeEndingRetryMenu();
  if(action.acceptPolicy==="trueEnding")finishTrueEnding();
  else beginNextStoryLoop({toTitle:false});
}

function finishTrueEnding(){
  window.MoonlightTableSave?.unlockTrueEndingEpilogues?.();
  window.MoonlightTableSave?.clearEndingRetryCheckpoint?.();
  window.MoonlightTableSave?.clearAutoSaveForTrueEnding?.();
  showTitleAfterStory({save:false});
}

function runStoryConclusion(action){
  if(!action)return;
  if(action.type==="nextLoop")beginNextStoryLoop({toTitle:!!action.toTitle});
  else if(action.type==="endingRetryMenu")showEndingRetryMenu(action);
  else if(action.type==="trueEnding")finishTrueEnding();
}

function finishStorySession(){
  if(!storySession)return;
  clearStoryTyping();
  clearStorySceneIntro();
  setStoryGameUiVisible(false);
  clearTimeout(storyRevealTimer);
  document.getElementById("storyRevealNotice").classList.remove("show");
  document.getElementById("storyOverlay").classList.remove("open");
  resetStoryStage();
  const complete=storySession.onComplete;
  const wasPaused=storySession.wasPaused;
  const conclusionAction=storySession.conclusionAction||null;
  const openJournalAfterFinish=!!storySession.openJournalAfterFinish;
  const openMenuAfterFinish=!!storySession.openMenuAfterFinish;
  storySession=null;
  state.paused=state.phase==="result"?true:wasPaused;
  if(state.phase===GAME_PHASES.RESULT){
    const finalDay=state.day>=DayManager.maxDay;
    dom.nextDayButton.textContent=finalDay
      ?state.story?.endingSeen?"엔딩 완료":`Day ${DayManager.maxDay} 완료`
      :"다음 날 준비";
    dom.nextDayButton.disabled=finalDay;
  }
  updateRelationshipUI();
  updateUI(true);
  if(openMenuAfterFinish&&state.phase===GAME_PHASES.MENU_SELECT)dom.menuSelectOverlay.classList.add("open");
  if(!conclusionAction)saveGame();
  if(complete)complete();
  if(openJournalAfterFinish&&!conclusionAction){
    const opener=typeof openGameplayJournal==="function"
      ?openGameplayJournal
      :typeof openJournal==="function"?openJournal:null;
    if(opener)setTimeout(opener,0);
  }
  if(state.story?.pendingResultSceneId&&!conclusionAction)setTimeout(playPendingStoryResult,0);
  if(conclusionAction)setTimeout(()=>runStoryConclusion(conclusionAction),0);
}

function prepareStoryNight(){
  if(!state.story)state.story=createStoryState();
  const sceneIds=STORY_SPECIAL_GUEST_BY_DAY?.[state.day]||[];
  const plans=sceneIds
    .map(id=>STORY_SCENES[id])
    .filter(scene=>scene&&!storySceneCompleted(scene))
    .map(scene=>{
      const guest=getStoryGuestState(scene.character);
      return {
        guestId:scene.character,
        sceneId:scene.id,
        dishId:scene.dishId,
        arrival:["early","late","last"].includes(scene.arrival)?scene.arrival:"early",
        deferUntilArrival:true,
        guestOrder:false,
        awaitingDishChoice:true,
        menuSelected:false,
        missingMenu:false,
        special:true,
        repeat:Number(guest?.visits)>0,
        triggerTiming:scene.triggerTiming==="before"?"before":"after",
        triggerAfterGeneral:Math.max(0,Number(scene.triggerAfterGeneral)||0),
        triggerOnNightEnd:!!scene.triggerOnNightEnd,
        requiredBaseShards:Math.max(0,Number(scene.requiredBaseShards)||0),
        ready:false
      };
    });
  state.story.pendingNightGuests=plans;
}

function storyGeneralArrivals(){
  const explicit=Number(state.generalSpawnedCustomers);
  if(Number.isFinite(explicit))return Math.max(0,Math.floor(explicit));
  const served=Math.max(0,Math.floor(Number(state.generalServed)||0));
  const waiting=(state.orders||[]).filter(order=>order.customerType!=="story").length;
  return served+waiting;
}

function storyNightPlanReady(plan){
  if(!plan||plan.ready)return !!plan?.ready;
  if((Number(plan.requiredBaseShards)||0)>storyShardCount({baseOnly:true,fullOnly:true}))return false;
  const arrived=storyGeneralArrivals();
  if(plan.triggerTiming==="before")return arrived===0;
  return arrived>=Math.max(0,Number(plan.triggerAfterGeneral)||0);
}

function storyOrderDialogueReady(order){
  if(!order||order.customerType!=="story"||state.mini||state.carrying)return false;
  if((Number(order.entryDelay)||0)>0||(Number(order.entered)||0)<1)return false;
  // 앞 손님의 식사 반응과 퇴장까지 보여 준 뒤 다음 차례의 대화를 엽니다.
  if(state.departures?.length)return false;
  const first=typeof ordersInArrivalOrder==="function"
    ?ordersInArrivalOrder()[0]
    :(state.orders||[])[0];
  if(!first||first.id!==order.id)return false;
  const scene=STORY_SCENES[order.storySceneId]||null;
  const served=Math.max(0,Math.floor(Number(state.generalServed)||0));
  return served>=Math.max(0,Number(scene?.triggerAfterGeneral)||0);
}

function processStoryNightTrigger(){
  if(state.phase!==GAME_PHASES.OPEN||storyIsActive()||state.story?.pendingResultSceneId)return false;
  const hasActiveStoryVisit=state.orders.some(order=>order.customerType==="story"||order.storySceneId);
  if(hasActiveStoryVisit){resumeDeferredStoryOrderScene();return false;}
  const plans=state.story?.pendingNightGuests||[];
  const served=Math.max(0,Number(state.generalServed)||0);
  plans.slice().forEach(candidate=>{
    const impossibleFinalGuest=candidate.triggerOnNightEnd
      &&served>=Math.max(0,Number(candidate.triggerAfterGeneral)||0)
      &&(Number(candidate.requiredBaseShards)||0)>storyShardCount({baseOnly:true,fullOnly:true});
    if(impossibleFinalGuest){
      const index=plans.indexOf(candidate);
      if(index>=0)plans.splice(index,1);
    }
  });
  const plan=plans.find(candidate=>storyNightPlanReady(candidate));
  if(!plan)return false;
  // 특별 손님의 다음 도착 순번은 유지하되, 조작을 가리는 미니게임이나
  // 음식 운반 중에는 화면 입장도 시작하지 않습니다.
  if(state.mini||state.carrying)return false;
  plan.ready=true;
  const occupied=new Set(state.orders.map(order=>order.slot));
  state.departures.forEach(item=>occupied.add(item.slot));
  state.respawns.forEach(item=>occupied.add(item.slot));
  const freeSlot=CUSTOMER_SEATS.findIndex((_,slot)=>!occupied.has(slot));
  if(freeSlot<0)return false;
  state.respawns=state.respawns.filter(respawn=>respawn.slot!==freeSlot);
  const spawned=spawnOrder(freeSlot,{forceStory:true,storyPlan:plan});
  if(spawned)resumeDeferredStoryOrderScene();
  return spawned;
}

function decorateStoryOrder(order,plan=null){
  order.customerType="general";order.guestId=null;order.specialRecipe=false;order.storySceneId=null;order.repeatVisit=false;
  order.storyDishId=null;order.storyArrival=null;order.deferUntilArrival=false;order.guestOrder=false;order.awaitingDishChoice=false;
  order.bubble=pickGeneralGuestBubble("arrival",order.dishId);order.bubbleTime=4.5;order.waitingTime=0;order.waitingBubbleShown=false;
  if(!plan)return order;
  const plans=state.story?.pendingNightGuests||[];
  const planIndex=plans.indexOf(plan);
  if(planIndex>=0)plans.splice(planIndex,1);
  const character=STORY_CHARACTERS[plan.guestId];
  order.customerType="story";order.guestId=plan.guestId;order.specialRecipe=!!plan.special;
  order.storySceneId=plan.sceneId||null;order.repeatVisit=!!plan.repeat;
  order.storyDishId=plan.dishId||null;
  order.storyArrival=["early","late","last"].includes(plan.arrival)?plan.arrival:"early";
  order.deferUntilArrival=!!plan.deferUntilArrival;
  order.guestOrder=plan.guestOrder!==false;
  order.awaitingDishChoice=!!plan.awaitingDishChoice;
  order.menuSelected=plan.menuSelected!==false;
  order.missingMenu=!!plan.missingMenu;
  order.storyMystic=true;
  if(order.awaitingDishChoice)order.guestOrder=false;
  if(order.guestOrder&&order.storyDishId)order.dishId=order.storyDishId;
  /* 자리에 앉은 모습을 그릴 때 쓰는 그림 번호입니다. 특별 손님 8명이
     portraitRow 0~7 로 1:1 대응합니다. (customers.js CUSTOMER_ART.special)

     위쪽 한계를 여기서 두지 않습니다. 예전에는 5 로 잘랐는데, 그건 그때
     쓰던 시트가 6행이라서였습니다. 시트 행 수를 아는 쪽은 customers.js 이고
     거기서 행 번호를 접어 넣으므로, 여기서 또 자르면 원화를 늘릴 때마다
     두 곳을 같이 고쳐야 합니다.

     대화씬 초상화는 이 값이 아니라 applyStoryPortraitArt() 가 따로 정합니다. */
  order.variant=Number.isFinite(character?.portraitRow)
    ?Math.max(0,Math.floor(character.portraitRow))
    :order.variant;
  // 방문 대사는 FIFO 차례가 되어 이야기 화면이 열린 뒤에만 말합니다.
  // 좌석에서 기다리는 동안 일반 손님용 말풍선이 먼저 내용을 누설하지 않습니다.
  order.bubble="";
  order.bubbleTime=0;
  return order;
}

function normalizeStoryOrder(order){
  if(!order||typeof order!=="object")return order;
  const scene=STORY_SCENES[order.storySceneId]||null;
  if(!order.customerType)order.customerType=order.storySceneId?"story":"general";
  if(!("guestId" in order))order.guestId=null;
  order.specialRecipe=!!order.specialRecipe;
  order.storySceneId=order.storySceneId||null;
  order.repeatVisit=!!order.repeatVisit;
  order.storyDishId=order.storyDishId||scene?.dishId||null;
  order.storyArrival=["early","late","last"].includes(order.storyArrival)
    ?order.storyArrival
    :["early","late","last"].includes(scene?.arrival)?scene.arrival:null;
  order.deferUntilArrival=!!(order.deferUntilArrival||scene?.deferUntilArrival);
  order.awaitingDishChoice=!!order.awaitingDishChoice;
  order.guestOrder=order.guestOrder!==false&&(order.customerType==="story"||scene?.guestOrder===true);
  if(order.awaitingDishChoice)order.guestOrder=false;
  order.menuSelected=order.menuSelected!==false;
  order.missingMenu=!!order.missingMenu;
  order.storyMystic=!!(order.storyMystic||order.customerType==="story");
  order.entryDelay=Number.isFinite(Number(order.entryDelay))?Math.max(0,Number(order.entryDelay)):0;
  if(!Number.isFinite(order.bubbleTime))order.bubbleTime=0;
  if(!Number.isFinite(order.waitingTime))order.waitingTime=0;
  order.waitingBubbleShown=!!order.waitingBubbleShown;
  return order;
}

function storyOrderLabel(order){
  return order?.guestId?storyDisplayName(order.guestId):`${order.slot+1}번 손님`;
}

function applyStoryCookingResult(order,satisfaction){
  if(!order?.guestId)return null;
  const pending=storySession?.pendingCook;
  const scene=STORY_SCENES[order.storySceneId]||null;
  const thresholds=pending&&pending.orderId===order.id?pending.config?.thresholds:scene?.thresholds;
  const tier=storyCookingTier(satisfaction,thresholds);
  const matchedDish=!order.storyDishId||order.dishId===order.storyDishId;
  if(STORY_GUEST_IDS.includes(order.guestId)){
    const guest=getStoryGuestState(order.guestId);
    if(!order.storySceneId&&tier==="great")guest.affinity++;
    if(guest.lastVisitDay!==state.day){guest.visits++;guest.lastVisitDay=state.day;}
  }
  if(order.storySceneId){
    state.story.storyCookResults[order.storySceneId]={
      score:satisfaction,tier,day:state.day,dishId:order.dishId,matchedDish
    };
    const guestId=storyGuestIdForScene(scene)||order.guestId;
    const result=getStoryGuestResult(guestId);
    result.visited=true;
    if(matchedDish){
      result.evaluationScore=satisfaction;
      result.evaluationTier=tier;
    }
    const resultSceneId=matchedDish
      ?scene?.resultSceneIds?.[tier]||null
      :scene?.wrongDishSceneId||scene?.missingMenuSceneId||null;
    if(resultSceneId){
      state.story.pendingResultSceneId=resultSceneId;
      setTimeout(playPendingStoryResult,0);
    }
  }
  return {
    tier:matchedDish?tier:null,
    matched:matchedDish,
    text:matchedDish?pickGeneralGuestBubble(tier):"제가 찾던 음식은 아닌 것 같아요.",
    name:storyDisplayName(order.guestId),
    special:order.specialRecipe,
    resultSceneId:state.story.pendingResultSceneId
  };
}

function koreanSubjectParticle(word){
  const value=String(word||"").trim();
  if(!value)return "이";
  const last=value.charCodeAt(value.length-1);
  return last>=0xac00&&last<=0xd7a3&&(last-0xac00)%28!==0?"이":"가";
}

function formatGeneralGuestBubble(template,dishId=null){
  if(!String(template).includes("[음식명]"))return String(template);
  const dish=dishById(dishId);
  const dishName=dish?.name||dish?.displayName||"따뜻한 음식";
  return String(template)
    .split("[음식명]").join(dishName)
    .split("[이/가]").join(koreanSubjectParticle(dishName));
}

function pickGeneralGuestBubble(type,dishId=null){
  const pool=GENERAL_GUEST_BUBBLES[type]||GENERAL_GUEST_BUBBLES.warm||["잘 먹겠습니다."];
  return formatGeneralGuestBubble(pool[Math.floor(Math.random()*pool.length)],dishId);
}

function cookingDifficultyMultiplier(context){return context?.tutorial?.9:context?.special?1.25:1;}

function runStoryQaFromQuery(){
  if(!window.QA_MODE?.enabled)return false;
  const params=new URLSearchParams(location.search);
  const sceneId=params.get("qa-story");
  if(!sceneId||!STORY_SCENES[sceneId])return false;
  const qaScene=STORY_SCENES[sceneId];
  state.story=createStoryState();
  normalizeDayPrepState();
  const qaResult=["nightJudgement","ending","epilogue"].includes(qaScene.moment);
  const qaNight=qaScene.moment!=="newGame"&&qaScene.timeOfDay==="night";
  state.screen="game";
  state.phase=qaResult?GAME_PHASES.RESULT:qaNight?GAME_PHASES.OPEN:GAME_PHASES.PREP;
  state.day=qaScene.day||1;state.paused=false;
  openGameScreen();buildMenuCards();updateUI(true);syncPhaserObjects();
  if(params.get("qa-order")==="1"&&state.phase==="night"){
    state.phaseTime=null;state.orders=[];state.respawns=[];state.spawnedCustomers=0;state.nightCustomerTarget=4;
    const qaDish=dishById(qaScene.dishId)||dishById("kimchi")||DISHES[0];
    state.selectedMenus=[qaDish.id];
    (qaDish.prepTasks||[]).forEach(taskId=>{state.prepProgress[taskId]=true;});
    state.inventory[qaDish.id]={count:1,quality:85,prepared:true};
    if(qaScene.character&&STORY_GUEST_IDS.includes(qaScene.character))revealCharacterName(qaScene.character,false);
    prepareStoryNight();
    const qaPlan=state.story.pendingNightGuests.find(plan=>
      plan.sceneId===(qaScene.specialGuest?qaScene.id:qaScene.sourceSceneId)
    )||state.story.pendingNightGuests[0];
    if(qaPlan){
      qaPlan.ready=true;
      spawningInitialNightOrders=true;
      try{spawnOrder(0,{forceStory:true,storyPlan:qaPlan});}
      finally{spawningInitialNightOrders=false;}
    }
    updateUI(true);
  }
  playStoryScenes([sceneId]);
  clearStorySceneIntro();
  const lineIndex=Math.max(
    0,
    Math.min(qaScene.lines.length-1,Math.floor(Number(params.get("qa-line"))||0))
  );
  for(let i=0;i<lineIndex;i++){
    const line=storySession?.lines[i];
    if(line?.reveal)revealCharacterName(line.reveal,false);
    if(line?.speaker)ensureStoryActor(line.speaker);
  }
  if(storySession&&lineIndex<storySession.lines.length){storySession.lineIndex=lineIndex;showStoryLine();}
  const choiceIndex=params.has("qa-choice")?Number(params.get("qa-choice")):NaN;
  const choiceLine=storySession?.lines[storySession?.lineIndex];
  if(Number.isInteger(choiceIndex)&&choiceIndex>=0&&choiceLine?.choices?.[choiceIndex]){
    finishStoryTyping();
    chooseStoryOption(choiceLine.choices[choiceIndex],choiceIndex);
  }
  const qaScore=params.has("qa-score")?Number(params.get("qa-score")):NaN;
  const pendingOrderId=activeStoryCookOrderId();
  if(Number.isFinite(qaScore)&&pendingOrderId!=null){
    const order=state.orders.find(item=>item.id===pendingOrderId);
    if(order){applyStoryCookingResult(order,qaScore);finishSuspendedStoryCook(order,qaScore);}
  }
  return true;
}
