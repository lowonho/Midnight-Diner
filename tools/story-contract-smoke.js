"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const files = ["game-data.js", "story-data.js", "story.js"];
const sources = files.map(file => fs.readFileSync(path.join(root, file), "utf8"));
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const storyCssSource = fs.readFileSync(path.join(root, "css", "story.css"), "utf8");

[
  "endingRetryOverlay",
  "endingRetryTitle",
  "endingRetryDescription",
  "endingRetryBranchButton",
  "endingNewLoopButton"
].forEach(id=>{
  if(!indexSource.includes(`id="${id}"`))throw new Error(`엔딩 후 선택 UI 누락: ${id}`);
});
if(!storyCssSource.includes(".ending-retry-window")||!storyCssSource.includes(".ending-retry-actions")){
  throw new Error("엔딩 후 선택 UI 스타일이 story.css에 있어야 합니다.");
}

const bootstrap = `
var state={story:null,day:1,phase:"day",screen:"game",player:{x:0,y:0,facing:"down",moving:false}};
const window={QA_MODE:null,addEventListener(){},matchMedia(){return {matches:false};}};
const document={
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
`;

const test = `
const DISHES=MENU_DATA.map(menu=>({
  ...menu,
  name:menu.displayName,
  prepTasks:[...menu.requiredPrepTasks],
  cook:[...(menu.cook||[])]
}));
function dishById(id){return DISHES.find(dish=>dish.id===id)||null;}

const assert=(condition,message)=>{
  if(!condition)throw new Error(message);
};
const same=(actual,expected,message)=>{
  assert(JSON.stringify(actual)===JSON.stringify(expected),
    message+"\\nactual: "+JSON.stringify(actual)+"\\nexpected: "+JSON.stringify(expected));
};

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
assert(initialGameplayJournal.length===8
  &&initialGameplayJournal[0].pageType==="rules"
  &&initialGameplayJournal.slice(1).every((page,index)=>
    page.pageType==="day"&&page.day===index+1&&!page.recorded&&page.entries.length===0),
  "새 게임의 진행용 영업일지는 주의사항 1장과 빈 1~7일차 기록이어야 합니다.");
same(initialGameplayJournal[0].menuNames,DISHES.map(dish=>dish.name),
  "주의사항에는 기존 음식 여덟 가지를 빠짐없이 표시해야 합니다.");
assert(initialGameplayJournal[0].rules.length===4
  &&initialGameplayJournal[0].menuRule.includes("다섯 가지")
  &&initialGameplayJournal[0].menuNames.every(name=>
    initialGameplayJournal[0].rules.some(rule=>rule.includes(name))),
  "네 가지 주의사항 중 하나에서 기존 여덟 음식과 매일 다섯 메뉴 준비를 안내해야 합니다.");
assert(initialGameplayJournal.slice(1).every(page=>
  !page.guestId&&!page.guestName&&!page.appearance&&!page.confirmedDish),
  "방문 전 날짜 페이지가 미래 손님·등장 조건·정답 음식을 노출하면 안 됩니다.");
recordStorySceneOutcome(STORY_SCENES["SCN-G7-A"]);
let daySevenPage=getGameplayJournalPages().find(page=>page.day===7);
assert(daySevenPage.entries.length===1
  &&daySevenPage.entries[0].guestId==="schoolDoll",
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
assert(STORY_MENU_RULES.selectCount===5
  &&STORY_MENU_RULES.requiredMenus.length===0
  &&STORY_MENU_RULES.allMenusAvailableFromDayOne,
  "첫째 날부터 음식 8종 중 정확히 5종을 자유 선택해야 합니다.");
STORY_MENU_RULES.dishIds.forEach(id=>assert(!!dishById(id),"존재하지 않는 메뉴 ID: "+id));
same(STORY_GENERAL_ORDERS_BY_DAY,{1:3,2:4,3:5,4:6,5:4,6:7,7:5},
  "날짜별 일반 주문 수");
same(STORY_SCORE_THRESHOLDS,{warm:50,great:80},"스토리 평가 점수 기준");
assert(storyCookingTier(49,STORY_SCORE_THRESHOLDS)==="soft"
  &&storyCookingTier(50,STORY_SCORE_THRESHOLDS)==="warm"
  &&storyCookingTier(79,STORY_SCORE_THRESHOLDS)==="warm"
  &&storyCookingTier(80,STORY_SCORE_THRESHOLDS)==="great",
  "아쉽다/맛있다/완벽은 50점과 80점을 경계로 나뉘어야 합니다.");

assert(Object.keys(STORY_SCENES).length===55,"새 시나리오는 총 55개 장면이어야 합니다.");
const requiredStaticScenes=[
  "SCN-P01","SCN-P02","SCN-P03","SCN-P04","SCN-L01","SCN-L02","SCN-D01",
  "SCN-J01","SCN-J02","SCN-J03","END-01","END-02","END-03","END-04","SCN-EPI01"
];
requiredStaticScenes.forEach(id=>assert(STORY_SCENES[id]?.id===id,"필수 장면 누락: "+id));
assert(STORY_SCENES["SCN-P04"].completesPrologue===true,
  "영업일지 규칙 확인 뒤 프롤로그가 끝나야 합니다.");
assert(STORY_SCENES["SCN-P03"].interactionTarget==="journal"
  &&STORY_SCENES["SCN-P02"].interactionTarget==="restaurantDoor",
  "퇴근길 뒤 식당 문과 영업일지 조사 흐름을 유지해야 합니다.");
assert(storySceneCardText(STORY_SCENES["SCN-P01"])==="SCN-P01 · 지친 밤 - 퇴근길",
  "장면 카드는 새 문서의 장면 코드와 제목을 표시해야 합니다.");
assert(!storySceneShowsIntroCard(STORY_SCENES["SCN-G1-A"])
  &&!storySceneShowsIntroCard(STORY_SCENES["SCN-G1-B"])
  &&!storySceneShowsIntroCard(STORY_SCENES["SCN-G1-완벽"])
  &&!storySceneCardText(STORY_SCENES["SCN-G1-완벽"]).includes("SCN-G1")
  &&!storySceneCardText(STORY_SCENES["SCN-G1-완벽"]).includes("완벽"),
  "특별 손님의 등장·미준비·평가 장면은 내부 코드와 결과명 카드를 숨겨야 합니다.");
assert(String(showStorySceneIntro).includes("storySceneShowsIntroCard")
  &&String(showStorySceneIntro).includes("showStoryLine"),
  "특별 손님은 메타 카드 없이 바로 대화 장면으로 들어가야 합니다.");

const l01=STORY_SCENES["SCN-L01"];
const l02=STORY_SCENES["SCN-L02"];
assert(l01.minLoop===2&&l01.repeatEachLoop&&l01.autoOpenJournal,
  "2회차 첫째 날에는 영업일지를 자동으로 열어야 합니다.");
assert(l02.minLoop===2&&l02.repeatEachLoop&&l02.dynamicJournalHint,
  "2회차 이후 날짜별 동적 영업일지 안내를 사용해야 합니다.");
same(Object.keys(l02.journalVariants),["none","clue","confirmed","shard"],
  "영업일지 상태별 안내 종류");
Object.values(l02.journalVariants).forEach(lines=>assert(Array.isArray(lines)&&lines.length>0,
  "영업일지 상태별 대사는 lines 배열이어야 합니다."));
assert(Object.values(l02.journalVariants).flat().every(line=>line.speakerLabel==="김다은(속말)"&&!line.speaker),
  "회귀 기록을 아는 다은의 반응은 손님에게 아는 척하는 대사가 아니라 속말이어야 합니다.");
const p04=STORY_SCENES["SCN-P04"];
assert(p04.lines.some(line=>line.openJournalOnAdvance===true)
  &&p04.autoOpenJournal!==true
  &&p04.opensMenuSelection!==true,
  "프롤로그 대사 도중 영업일지를 읽고, 장면 뒤에는 냉장고에서 메뉴를 선택해야 합니다.");
assert(String(storyAdvance).includes("openJournalOnAdvance")
  &&String(storyAdvance).includes("openGameplayJournal")
  &&String(resumeStoryAfterJournal).includes("waitingForJournal")
  &&String(resumeStoryAfterJournal).includes("showStoryLine"),
  "프롤로그는 해당 자막 뒤 책을 열고, 닫은 뒤 다음 자막으로 복귀해야 합니다.");
assert(p04.lines.slice(-3).every(line=>line.timeOfDay==="day")
  &&String(storyTimeOfDayOverride).includes("line.timeOfDay"),
  "프롤로그의 밤→첫째 날 낮 전환은 대사뿐 아니라 실제 배경 시간에도 반영되어야 합니다.");
assert(!STORY_SCENES["SCN-P04"].lines.some(line=>line.speaker==="journal"),
  "영업일지 규칙은 장부가 말하는 대사로 출력하면 안 됩니다.");
same(Object.keys(FIRST_SPECIAL_GUEST_BUBBLES),expectedGameplayJournalGuestIds,
  "첫 방문 특별 손님 말풍선 목록");
assert(Object.values(FIRST_SPECIAL_GUEST_BUBBLES).every(text=>text&&!text.includes("오늘도")),
  "첫 방문 특별 손님은 재방문처럼 말하면 안 됩니다.");
assert(String(prepareStoryNight).includes("guest?.visits")
  &&String(decorateStoryOrder).includes("FIRST_SPECIAL_GUEST_BUBBLES"),
  "첫 방문과 재방문 말풍선은 실제 만남 기록으로 구분해야 합니다.");
assert(String(ensureStoryActor).includes('"leftShadow","rightShadow","twinShadows"')
  &&String(ensureStoryActor).includes('?"twinShadows"'),
  "둘이 붙은 그림자는 화자 이름만 바뀌고 무대 배우는 하나를 공유해야 합니다.");
assert(initialGameplayJournal[0].rules.some(rule=>rule.includes("영업 기록은 남지만")&&rule.includes("모은 조각은 사라진다")),
  "영업일지 첫 장은 회귀 뒤 기록만 남고 조각은 사라지는 규칙을 알려야 합니다.");
assert(initialGameplayJournal[0].rules.some(rule=>rule.includes("달빛 조각을 모아")&&rule.includes("문을 연다"))
  &&!initialGameplayJournal[0].rules.some(rule=>rule.includes("완전한 조각")),
  "영업일지 첫 장은 세부 등급을 선공개하지 않고 조각을 모아 문을 여는 목표만 알려야 합니다.");
same(l01.lines.slice(-3).map(line=>line.text),[
  "달빛 조각은 사라졌지만 기록은 남아 있어.",
  "이번에도 같은 손님들이 같은 날 찾아온다면 다시 모을 수 있을 거야.",
  "누가 어떤 음식을 찾았는지는 이 장부를 보면 돼."
],"회귀 후 첫째 날의 영업일지 안내 대사");
assert(l02.journalVariants.shard[0].text.includes("지난 회차")
  &&l02.journalVariants.shard[0].text.includes("이번 회차에 다시 얻어야"),
  "과거 조각 기록은 남아도 이번 회차에 조각을 다시 얻어야 합니다.");

same(STORY_EVENT_SCHEDULE.newGame[1],
  ["SCN-P01","SCN-P02","SCN-P03","SCN-P04"],"프롤로그 진입 일정");
for(let day=1;day<=7;day++){
  assert(STORY_EVENT_SCHEDULE.nightStart[day][0]==="SCN-D01",
    "매일 영업 준비 완료 뒤 밤 영업 시작 장면을 실행해야 합니다.");
}
assert(STORY_EVENT_SCHEDULE.dayStart[1].includes("SCN-L01"),
  "회귀 후 첫째 날 장면이 일정에 등록되어야 합니다.");

const guestContracts=[
  [1,1,"rainyChild","kimchi","first_raindrop","첫 빗방울","after",1],
  [2,2,"lanternGuest","oden","remaining_warmth","남은 온기","before",0],
  [3,3,"twinShadows","tofu","two_half_names","반쪽 이름 두 개","after",2],
  [4,4,"crowCourier","skewer","undelivered_letter","배달되지 못한 편지","after",3],
  [5,5,"starBeast","fries","golden_salt","금빛 소금","after",3],
  [6,6,"seawaterGuest","shrimpTempura","eastern_scale","동쪽의 비늘","after",7],
  [7,7,"schoolDoll","tteokbokki","stopped_minute_hand","멈춘 분침","before",0],
  [8,7,"facelessDaeun","yakisoba","daeuns_tomorrow","김다은의 내일","after",5]
];

guestContracts.forEach(([number,day,character,dishId,shardId,shardName,timing,afterGeneral])=>{
  const prefix="SCN-G"+number;
  const arrival=STORY_SCENES[prefix+"-A"];
  const missing=STORY_SCENES[prefix+"-B"];
  const soft=STORY_SCENES[prefix+"-아쉽다"];
  const warm=STORY_SCENES[prefix+"-맛있다"];
  const great=STORY_SCENES[prefix+"-완벽"];
  assert(arrival?.specialGuest&&arrival.sceneType==="specialGuestArrival",
    prefix+" 등장 장면 계약");
  assert(arrival.day===day&&arrival.character===character&&arrival.dishId===dishId,
    prefix+" 날짜·손님·음식 연결");
  assert(arrival.shardId===shardId&&arrival.shardName===shardName,
    prefix+" 달빛 조각 연결");
  assert(arrival.triggerTiming===timing&&arrival.triggerAfterGeneral===afterGeneral,
    prefix+" 일반 주문 기준 등장 시점");
  assert(arrival.missingMenuSceneId===prefix+"-B",
    prefix+" 미준비 분기 연결");
  same(arrival.resultSceneIds,
    {soft:prefix+"-아쉽다",warm:prefix+"-맛있다",great:prefix+"-완벽"},
    prefix+" 평가 장면 연결");
  same(arrival.thresholds,{warm:50,great:80},prefix+" 평가 기준");
  assert(arrival.repeatEachLoop&&arrival.guestOrder&&arrival.specialCook,
    prefix+" 회차별 재방문과 기존 조리 연결");
  assert(missing?.missingMenu&&missing.journalClue&&missing.resultTier==null,
    prefix+" 미준비 단서 분기");
  assert(soft?.resultTier==="soft"&&!soft.grantsShard,
    prefix+" 아쉽다 결과");
  assert(warm?.resultTier==="warm"&&!warm.grantsShard,
    prefix+" 맛있다 결과");
  assert(great?.resultTier==="great"&&great.grantsShard&&great.uniqueShard,
    prefix+" 최초 완벽 달빛 조각 결과");
  assert([soft,warm,great].every(scene=>scene.preservesUnlockedMemory),
    prefix+" 재평가가 기존 기억과 조각을 회수하면 안 됩니다.");
});

same(STORY_SPECIAL_GUEST_BY_DAY,{
  1:["SCN-G1-A"],2:["SCN-G2-A"],3:["SCN-G3-A"],4:["SCN-G4-A"],
  5:["SCN-G5-A"],6:["SCN-G6-A"],7:["SCN-G7-A","SCN-G8-A"]
},"날짜별 특별 손님 일정");

const g8=STORY_SCENES["SCN-G8-A"];
assert(g8.requiredBaseShards===7&&g8.triggerOnNightEnd&&g8.triggerAfterGeneral===5,
  "얼굴 없는 김다은은 기본 조각 7개와 7일차 일반 주문 5건 뒤 등장해야 합니다.");
assert(GAMEPLAY_JOURNAL_PAGE_DEFS.find(page=>page.guestId==="facelessDaeun").appearanceCondition
  .includes("현재 회차 기본 손님 7명의 완전한 달빛 조각"),
  "G8 진행 일지는 현재 회차 기본 완전 조각 7개 조건을 명확히 표시해야 합니다.");
assert(STORY_SCENES["SCN-G8-완벽"].character==="anotherDaeun"
  &&STORY_SCENES["SCN-G8-완벽"].finalShard,
  "G8 완벽에서 또 다른 김다은과 여덟 번째 조각을 공개해야 합니다.");
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

same(STORY_ENDING_RULES,{
  low:{minShards:0,maxShards:3,judgementSceneId:"SCN-J01"},
  middle:{minShards:4,maxShards:7,judgementSceneId:"SCN-J02"},
  complete:{minShards:8,maxShards:8,judgementSceneId:"SCN-J03"}
},"달빛 조각 수에 따른 판정 장면");
assert(STORY_SCENES["SCN-J01"].autoLoop&&STORY_SCENES["SCN-J01"].nextSceneId==="SCN-L01",
  "조각 0~3개는 선택지 없이 회귀해야 합니다.");
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

same(["END-01","END-02","END-03","END-04"].map(id=>STORY_SCENES[id].continuePolicy),
  ["endingRetryMenu","endingRetryMenu","endingRetryMenu","clearRunKeepMeta"],
  "엔딩별 이어하기 정책");
same(["END-01","END-02","END-03"].map(id=>STORY_SCENES[id].retryJudgementSceneId),
  ["SCN-J02","SCN-J02","SCN-J03"],
  "일반 엔딩은 자신이 나온 마지막 분기로 돌아갈 수 있어야 합니다.");
assert(STORY_SCENES["END-04"].trueEnding
  &&STORY_SCENES["END-04"].nextSceneId==="SCN-EPI01",
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
  "자동 회귀·일반 엔딩 후 선택·진엔딩은 각각의 최종 처리 경로를 유지해야 합니다.");
assert(String(restoreEndingChoiceCheckpoint).includes("playStoryScenes")
  &&String(startNewLoopAfterEnding).includes("beginNextStoryLoop"),
  "엔딩 기록 뒤 마지막 분기 재생과 새 회차 시작 기능을 모두 제공해야 합니다.");
assert(String(showEndingRetryMenu).includes("saveEndingRetryCheckpoint")
  &&String(showEndingRetryMenu).includes("restoredCheckpoint"),
  "일반 엔딩 화면은 현재 결말을 숨은 체크포인트로 저장하고 복구 표시를 구분해야 합니다.");
assert(String(retryLastEndingBranch).includes("restoreStoredEndingRetryState")
  &&String(retryLastEndingBranch).includes("clearEndingRetryCheckpoint")
  &&String(startNewLoopAfterEnding).includes("restoreStoredEndingRetryState")
  &&String(startNewLoopAfterEnding).includes("clearEndingRetryCheckpoint"),
  "복구된 엔딩 화면의 두 버튼은 상태를 되살린 뒤 숨은 체크포인트를 삭제해야 합니다.");
assert(String(finishTrueEnding).includes("clearEndingRetryCheckpoint")
  &&String(finishTrueEnding).indexOf("clearEndingRetryCheckpoint")
    <String(finishTrueEnding).indexOf("clearAutoSaveForTrueEnding"),
  "진엔딩은 일반 엔딩의 숨은 체크포인트를 남기지 않아야 합니다.");

Object.values(STORY_SCENES).forEach(scene=>{
  assert(Array.isArray(scene.lines)&&scene.lines.length>0,scene.id+" lines 누락");
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
storySession={scene:repeatArrival,suspended:false};
assert(!storySceneHasRequiredInteraction(repeatArrival)&&storySceneCanSkip(repeatArrival),
  "이미 본 특별 손님 등장 대화는 specialGuest 표시만으로 SKIP을 막으면 안 됩니다.");
assert(storySceneHasRequiredInteraction(STORY_SCENES["SCN-J02"]),
  "엔딩 선택지가 있는 장면은 SKIP으로 필수 선택을 건너뛰면 안 됩니다.");
assert(String(skipCurrentStoryScene).includes("completeStoryScene"),
  "SKIP은 장면 완료 경로를 사용해 후속 주문 흐름을 유지해야 합니다.");
storySession=null;
state.phase=GAME_PHASES.OPEN;
state.orders=[{
  id:1,slot:0,customerType:"story",guestId:"rainyChild",
  storySceneId:repeatArrival.id,deferUntilArrival:true,missingMenu:false
}];
markStorySceneCompleted(repeatArrival);
assert(resumeDeferredStoryOrderScene()===false&&state.orders.length===1
  &&state.orders[0].storySceneId===repeatArrival.id,
  "등장 대화를 완료하거나 SKIP해도 주문은 남아 기존 조리 미니게임으로 이어져야 합니다.");
state.orders=[];

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
  &&state.story.pendingNightGuests[0].missingMenu
  &&state.story.pendingNightGuests[0].guestOrder===false,
  "기억 음식 미선택 시 영업을 막지 않고 B분기 방문으로 준비해야 합니다.");

const rainy=getStoryGuestState("rainyChild");
recordStorySceneOutcome(STORY_SCENES["SCN-G1-B"]);
assert(rainy.clueFound&&!rainy.shardOwned&&!rainy.memoryUnlocked
  &&getStoryGuestResult("rainyChild").visited
  &&getStoryGuestResult("rainyChild").fragmentState==="none",
  "음식 미준비 B분기는 진행용 페이지에 단서만 기록해야 합니다.");
assert(storyLinesForScene(STORY_SCENES["SCN-L02"])[0].text.includes("팬 위에서 둥글게"),
  "회귀 영업일지에는 실제로 얻은 단서를 동적으로 넣어야 합니다.");
recordStorySceneOutcome(STORY_SCENES["SCN-G1-맛있다"]);
getStoryGuestResult("rainyChild").evaluationScore=73;
const rainyResult=getStoryGuestResult("rainyChild");
assert(rainyResult.evaluationTier==="warm"&&rainyResult.fragmentState==="partial"
  &&rainyResult.fragmentName==="첫 빗방울"&&!rainy.previouslyObtainedPartial
  &&!rainy.previouslyObtainedFull&&!rainy.shardOwned,
  "G1~G7 맛있다는 이번 회차 부분 조각만 만들고 과거 기록을 즉시 오염시키면 안 됩니다.");

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
    &&result.fragmentState==="none"&&result.fragmentName==null&&result.seenStoryScenes.length===0;
}),"회귀 병합 뒤 현재 회차의 방문·평가·조각·본 장면은 모두 초기화되어야 합니다.");
assert(state.story.completed.keepAcrossLoop&&state.story.seenScenes.keepAcrossLoop,
  "회귀 병합은 completed와 전역 seenScenes 기록을 지우면 안 됩니다.");
assert(rainy.seenStoryScenes.includes("SCN-G1-B")&&rainy.seenStoryScenes.includes("SCN-G1-맛있다")
  &&lantern.seenStoryScenes.includes("SCN-G2-완벽"),
  "현재 회차에 본 손님 장면은 과거 손님 기록으로 중복 없이 병합되어야 합니다.");

const dayOnePage=getGameplayJournalPages().find(page=>page.day===1);
const rainyPage=dayOnePage.entries.find(entry=>entry.guestId==="rainyChild");
assert(dayOnePage.recorded&&rainyPage
  &&rainyPage.previousLoopEvaluation==="맛있다"
  &&rainyPage.previouslyObtainedPartial==="획득 기록 있음"
  &&rainyPage.previouslyObtainedFull==="없음"
  &&rainyPage.currentLoopVisited==="미방문"
  &&rainyPage.currentLoopEvaluation==="미평가"
  &&rainyPage.currentFragmentState==="미획득"
  &&rainyPage.currentFragmentName==="미획득"
  &&rainyPage.seenStoryScenes.includes(STORY_SCENES["SCN-G1-맛있다"].title),
  "날짜별 영업일지는 과거 기록과 현재 회차 필드를 분리해 반환해야 합니다.");

recordStorySceneOutcome(STORY_SCENES["SCN-G1-B"]);
archiveCurrentStoryLoopResults();
assert(rainy.previousLoopTier==="warm"&&rainy.previousLoopScore===73
  &&rainy.clueFound&&rainy.previousLoopVisited,
  "음식 미준비 회차는 단서와 방문만 남기고 과거 실제 평가를 지우면 안 됩니다.");

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
assert(!storyNightPlanReady({requiredBaseShards:7,triggerTiming:"after",triggerAfterGeneral:5}),
  "과거 조각 또는 현재 부분 조각을 G8 실제 등장 준비 조건에 쓰면 안 됩니다.");

getStoryGuestResult("schoolDoll").fragmentState="full";
state.generalServed=5;
same(storyFragmentCounts({baseOnly:true}),{count:7,partial:0,full:7},
  "기본 손님 7명의 완전 조각 계산");
assert(storyGuestArrivalForDay(7).some(scene=>scene.id==="SCN-G8-A"),
  "이번 회차 기본 완전 조각 7개를 모아야 마지막 예약 손님이 등장해야 합니다.");
assert(storyNightPlanReady({requiredBaseShards:7,triggerTiming:"after",triggerAfterGeneral:5}),
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

state.story=createStoryState();
state.day=7;
state.story.completed.persistedScene=true;
state.story.seenScenes.persistedScene=true;
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
  &&state.story.completed.persistedScene&&state.story.seenScenes.persistedScene,
  "beginNextStoryLoop는 먼저 현재 결과를 병합한 뒤 루프·Day1을 갱신하고 현재 결과만 초기화해야 합니다.");

console.log("STORY_CONTRACT_OK 55");
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
  setTimeout,
  clearTimeout
};

vm.runInNewContext(
  [bootstrap, ...sources, test].join("\n;\n"),
  context,
  { filename: "story-contract-smoke.bundle.js" }
);
