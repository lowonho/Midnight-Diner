"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const files = ["game-data.js", "story-data.js", "story.js"];
const sources = files.map(file => fs.readFileSync(path.join(root, file), "utf8"));

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
assert(storySceneCardText(STORY_SCENES["SCN-P01"])==="SCN-P01 · 퇴사한 밤 - 퇴근길",
  "장면 카드는 새 문서의 장면 코드와 제목을 표시해야 합니다.");

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
assert(STORY_SCENES["SCN-G8-완벽"].character==="anotherDaeun"
  &&STORY_SCENES["SCN-G8-완벽"].finalShard,
  "G8 완벽에서 또 다른 김다은과 여덟 번째 조각을 공개해야 합니다.");
assert(!JSON.stringify(STORY_SCENES).includes("undelivered_letter_read"),
  "배달되지 못한 편지는 별도 읽기 플래그를 요구하면 안 됩니다.");

same(STORY_ENDING_RULES,{
  low:{minShards:0,maxShards:3,judgementSceneId:"SCN-J01"},
  middle:{minShards:4,maxShards:7,judgementSceneId:"SCN-J02"},
  complete:{minShards:8,maxShards:8,judgementSceneId:"SCN-J03"}
},"달빛 조각 수에 따른 판정 장면");
assert(STORY_SCENES["SCN-J01"].autoLoop&&STORY_SCENES["SCN-J01"].nextSceneId==="SCN-L01",
  "조각 0~3개는 선택지 없이 회귀해야 합니다.");
same(STORY_SCENES["SCN-J02"].lines.find(line=>line.choices).choices.map(choice=>choice.nextSceneId),
  ["END-01","END-02"],"조각 4~7개 엔딩 선택");
same(STORY_SCENES["SCN-J03"].lines.find(line=>line.choices).choices.map(choice=>choice.nextSceneId),
  ["END-03","END-04"],"조각 8개 엔딩 선택");
assert(!STORY_SCENES["SCN-J03"].lines.find(line=>line.choices).choices[1].requiredFlag,
  "END-04 선택에 편지 읽기 플래그를 요구하면 안 됩니다.");

same(["END-01","END-02","END-03","END-04"].map(id=>STORY_SCENES[id].continuePolicy),
  ["nextLoop","nextLoop","finalChoiceCheckpoint","clearRunKeepMeta"],
  "엔딩별 이어하기 정책");
assert(STORY_SCENES["END-04"].trueEnding
  &&STORY_SCENES["END-04"].nextSceneId==="SCN-EPI01",
  "함께 오는 아침에서 진엔딩 에필로그로 이어져야 합니다.");
assert(STORY_SCENES["SCN-EPI01"].disableContinue
  &&STORY_SCENES["SCN-EPI01"].clearProgressSaves
  &&STORY_SCENES["SCN-EPI01"].keepTitleJournal,
  "진엔딩 뒤 진행 저장은 초기화하고 타이틀 영업일지는 유지해야 합니다.");

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

const storyText=JSON.stringify(STORY_SCENES);
assert(!storyText.includes("박기철")&&!storyText.includes("한 달만 가게")&&!storyText.includes("사표 아직 수리"),
  "기존 박기철·가게 인수·복귀 제안 이야기가 남으면 안 됩니다.");
assert(storyText.includes("여덟 개의 달빛 조각")
  &&storyText.includes("마지막 예약 손님: 김다은")
  &&storyText.includes("오늘의 메뉴는 내일 정합니다"),
  "달빛 조각 목표와 마지막 예약 손님, 진엔딩 문구가 필요합니다.");

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
rainy.clueFound=true;
assert(storyLinesForScene(STORY_SCENES["SCN-L02"])[0].text.includes("팬 위에서 둥글게"),
  "회귀 영업일지에는 실제로 얻은 단서를 동적으로 넣어야 합니다.");
recordStorySceneOutcome(STORY_SCENES["SCN-G1-완벽"]);
assert(rainy.shardOwned&&rainy.memoryUnlocked&&rainy.currentTier==="great",
  "최초 완벽은 기억과 달빛 조각을 영구 해금해야 합니다.");
recordStorySceneOutcome(STORY_SCENES["SCN-G1-맛있다"]);
assert(rainy.shardOwned&&rainy.memoryUnlocked&&rainy.currentTier==="warm",
  "재방문 평가는 낮아져도 기존 조각과 해금 기억은 유지해야 합니다.");

STORY_GUEST_IDS.slice(0,7).forEach(id=>{getStoryGuestState(id).shardOwned=true;});
state.day=7;
state.selectedMenus=["oden","tofu","kimchi","skewer","tteokbokki"];
prepareStoryNight();
assert(state.story.pendingNightGuests.some(plan=>plan.sceneId==="SCN-G8-A"),
  "기본 조각 7개를 모으면 7일차 마지막 예약 손님 계획을 만들어야 합니다.");
assert(storySceneIdsForMoment("nightEnd",7)[0]==="SCN-J02",
  "일곱 조각일 때는 4~7개 중간 엔딩 판정으로 가야 합니다.");
getStoryGuestState("facelessDaeun").shardOwned=true;
assert(storySceneIdsForMoment("nightEnd",7)[0]==="SCN-J03",
  "여덟 조각일 때는 최종 엔딩 선택 판정으로 가야 합니다.");

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
