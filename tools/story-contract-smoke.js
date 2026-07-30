"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const files=["game-data.js","story-data.js","story-cinematic.js","story.js","day.js","night.js","save.js"];
const sources=files.map(file=>fs.readFileSync(path.join(root,file),"utf8"));

const bootstrap=`
var state={
  day:1,
  phase:"day",
  screen:"game",
  story:null,
  selectedMenus:[],
  menuSelectionDraft:[],
  prepProgress:{},
  kimchiPrep:{},
  inventory:{},
  orders:[],
  departures:[],
  respawns:[],
  spawnedCustomers:0,
  nightCustomerTarget:0,
  selectedOrderId:null,
  popularity:0
};
var nextOrderId=1;
const localStorageData=new Map();
const localStorage={
  getItem:key=>localStorageData.has(key)?localStorageData.get(key):null,
  setItem:(key,value)=>localStorageData.set(key,String(value)),
  removeItem:key=>localStorageData.delete(key)
};
const window={QA_MODE:null,addEventListener(){}};
const document={addEventListener(){},getElementById(){return null;}};
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function buildMenuCards(){}
function updateUI(){}
function saveGame(){}
function showToast(){}
`;

const test=`
const DISHES=MENU_DATA.map(menu=>({
  ...menu,
  name:menu.displayName,
  prepTasks:[...menu.requiredPrepTasks],
  prep:[...(menu.prep||[])],
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
const tierReply=(cook,score)=>cook.replies[storyCookingTier(score,cook.thresholds)];

assert(STORY_CHARACTERS.protagonist.name==="김다은","주인공의 확정 이름은 김다은이어야 합니다.");
state.story=createStoryState();
assert(storyDisplayName(null)==="","화자가 없는 연출 줄에는 '이야기' 이름표를 표시하지 않아야 합니다.");
assert(storyDisplayName("protagonist")==="김다은","대화 이름표에는 김다은이 표시되어야 합니다.");
assert(storyDisplayName("gicheol")==="???","박기철은 자기소개 전까지 이름이 숨겨져야 합니다.");

const qaStoryStepDeltas=[];
const qaStoryChoices=[];
function qaStoryStep(delta){qaStoryStepDeltas.push(delta);return true;}
function qaStoryPreviewChoice(choice,index){qaStoryChoices.push({choice,index});return true;}
const qaProgressBefore=JSON.stringify(state.story);
storySession={
  qaPreview:true,
  scene:STORY_SCENES["C1-02"],
  lines:STORY_SCENES["C1-02"].lines.map(line=>({...line})),
  lineIndex:0
};
assert(storyAdvance()===true&&qaStoryStepDeltas[0]===1,
  "QA 스토리 미리보기의 다음 버튼은 일반 장면 진행 대신 한 줄 이동을 호출해야 합니다.");
const qaChoice=STORY_SCENES["C1-02"].lines.find(line=>line.choices).choices[1];
assert(chooseStoryOption(qaChoice,1)===true
  &&qaStoryChoices[0].choice===qaChoice
  &&qaStoryChoices[0].index===1,
  "QA 스토리 미리보기의 선택지는 실제 분기 처리 대신 미리보기 핸들러를 호출해야 합니다.");
assert(JSON.stringify(state.story)===qaProgressBefore,
  "QA 대사 이동과 선택지 확인은 스토리 진행도에 영향을 주면 안 됩니다.");
storySession=null;
assert(runStoryQaFromQuery()===false,
  "qa=1 저장 방지 모드가 아니면 URL 스토리 QA를 실행하면 안 됩니다.");

same(Object.keys(STORY_CHARACTERS),["protagonist","owner","manager","gicheol"],"제1장 고유 인물 목록");
assert(Object.keys(STORY_SCENES).length===13,"프롤로그+제1장 장면은 13개여야 합니다.");
assert(DayManager.maxDay===7,"데모 마지막 날은 Day 7이어야 합니다.");

const expectedSchedule={
  newGame:{1:["PR-01","PR-02"]},
  dayStart:{1:["C1-01"],7:["C1-04A"]},
  nightStart:{2:["G-02"],5:["G-03"],6:["C1-03"],7:["C1-04B"]},
  nightEnd:{1:["C1-01-JOURNAL"],3:["C1-D3-JOURNAL"],4:["C1-02"],6:["C1-03-JOURNAL"],7:["C1-END"]}
};
same(STORY_EVENT_SCHEDULE,expectedSchedule,"7일 스토리 스케줄");
const scheduled=Object.values(STORY_EVENT_SCHEDULE)
  .flatMap(days=>Object.values(days).flat());
same([...scheduled].sort(),Object.keys(STORY_SCENES).sort(),"모든 장면은 정확히 한 번 스케줄되어야 합니다.");
assert(new Set(scheduled).size===scheduled.length,"장면이 중복 스케줄되면 안 됩니다.");
assert(!Object.values(STORY_SCENES).some(scene=>
  scene.lines.some(line=>line.kind==="gameplay")),
  "게임플레이 구현 규칙은 플레이어에게 출력되는 스토리 줄에 포함하면 안 됩니다.");
assert(STORY_SCENES["PR-02"].completesPrologue===true,"PR-02가 프롤로그를 끝내야 합니다.");
assert(STORY_SCENES["C1-END"].ending===true,"C1-END가 제1장 엔딩이어야 합니다.");
assert(storySceneCardText(STORY_SCENES["PR-01"])==="PR-01 · 비를 피한 곳",
  "장면 시작 카드는 장면 코드와 제목을 함께 표시해야 합니다.");

const revealed=[];
Object.values(STORY_SCENES).forEach(scene=>scene.lines.forEach((line,index)=>{
  if(line.reveal)revealed.push({scene:scene.id,index,reveal:line.reveal,text:line.text});
}));
assert(revealed.length===1&&revealed[0].scene==="G-02"&&revealed[0].reveal==="gicheol",
  "박기철의 자기소개 대사에서만 이름을 공개해야 합니다.");
assert(revealed[0].text.includes("박기철이라고 합니다"),"이름 공개 대사에 자기소개가 있어야 합니다.");
assert(!Object.values(STORY_SCENES).some(scene=>scene.lines.some(line=>
  line.kind==="direction"&&line.text?.includes("이름표")&&line.text.includes("???")
)),"이름 공개 규칙을 플레이어에게 출력되는 연출문에 넣으면 안 됩니다.");
const gicheolEntranceCaption=STORY_SCENES["PR-01"].lines.find(line=>
  line.text==="택시 기사는 주방에서 일하는 다은을 보고 놀라 사장에게 말을 건다."
);
assert(gicheolEntranceCaption?.kind==="direction"
  &&storySpeakerLabel(gicheolEntranceCaption)==="",
  "박기철 등장 상황은 자막으로 출력하되 인물 이름표는 표시하지 않아야 합니다.");

const prologueCookSequence=STORY_SCENES["PR-01"].lines
  .filter(line=>line.cook)
  .map(line=>line.cook.dishId);
same(prologueCookSequence,["tofu","oden","skewer","shrimpTempura","yakisoba","kimchi"],"PR-01 조리 순서");
const prologueTutorialLines=STORY_SCENES["PR-01"].lines.filter(line=>line.cook?.tutorial);
assert(prologueTutorialLines.every(line=>line.showGameUI===true),
  "사장이 조리를 안내하는 모든 튜토리얼 줄에서는 게임 UI를 보여야 합니다.");
assert(prologueTutorialLines.every(line=>
  line.speaker==="owner"&&storySpeakerLabel(line)==="사장"),
  "프롤로그 조리 시작 안내는 설명문이 아니라 사장의 대사로 표시되어야 합니다.");
same(
  Object.fromEntries(prologueTutorialLines.map(line=>[line.cook.dishId,line.text])),
  {
    tofu:"두부김치는 두부를 일정한 크기로 썰고\\n접시에 담으면 되네.",
    oden:"어묵탕은 국물이 맑게 우러나도록\\n적당한 불로 끓이면 되네.",
    skewer:"닭꼬치는 앞면이 노릇하게 익으면 꼬치를 하나씩 뒤집고\\n뒷면도 타지 않게 구우면 되네.",
    shrimpTempura:"새우튀김은 튀김옷이 노릇해졌을 때 건져서\\n바스켓을 가볍게 털어 기름을 빼면 되네.",
    yakisoba:"볶음우동은 면과 채소, 소스를 철판에 올리고\\n뒤집개로 골고루 볶으면 되네.",
    kimchi:"김치전은 반죽을 팬에 고르게 펴고\\n앞면이 노릇해지면 뒤집어 뒷면까지 익히면 되네."
  },
  "프롤로그 음식별 사장 조리 안내 대사"
);
assert(!STORY_SCENES["PR-01"].lines.some(line=>
  line.text?.includes("사장의 안내에 따라")),
  "프롤로그 조리 안내에 포괄적인 설명문이 남아 있으면 안 됩니다.");
const recipeGuideIndex=STORY_SCENES["PR-01"].lines.findIndex(line=>line.text?.includes("레시피를 알려주겠네"));
assert(recipeGuideIndex>=0&&STORY_SCENES["PR-01"].lines[recipeGuideIndex].showGameUI===true,
  "사장이 레시피 안내를 시작하는 대사부터 게임 UI가 보여야 합니다.");
assert(STORY_SCENES["PR-01"].lines[recipeGuideIndex-1].showGameUI!==true,
  "레시피 안내 전 일반 대화에서는 다른 게임 UI를 계속 숨겨야 합니다.");
const prologueOpening=STORY_SCENES["PR-01"].lines.slice(0,6);
same(prologueOpening.slice(0,4).map(line=>line.cinematic?.beat),
  ["exit","pause","rainRun","enter"],
  "PR-01 외부 연출은 회사 퇴장·정지·빗속 이동·식당 입장 순서여야 합니다.");
same(storyCinematicBeatPlan(prologueOpening[0]),
  {from:.08,to:.28,duration:2400,rain:false,fade:false},
  "회사 퇴장 연출은 주인공을 화면 왼쪽에서 안쪽으로 자동 이동시켜야 합니다.");
same(storyCinematicBeatPlan(prologueOpening[1]),
  {at:.28,rain:false},
  "주인공 독백에서는 이동을 멈춰야 합니다.");
same(storyCinematicBeatPlan(prologueOpening[2]),
  {from:.28,to:.78,duration:3200,rain:true,fade:false},
  "비가 시작되면 주인공이 식당 방향으로 자동 이동해야 합니다.");
same(storyCinematicBeatPlan(prologueOpening[3]),
  {from:.78,to:.90,duration:1100,rain:true,fade:true},
  "식당 입장 연출에서는 주인공이 오른쪽으로 이동하며 사라져야 합니다.");
assert(prologueOpening[0].text.includes("회사 출입증")&&prologueOpening[0].text.includes("종이 상자"),
  "첫 자동 이동 연출에는 회사 퇴장과 종이 상자 설정이 남아 있어야 합니다.");
assert(prologueOpening[4].kind==="direction"
  &&prologueOpening[4].text==="바쁜 와중에 사장은 다은이 들어오는 것을 보고 말한다.",
  "식당에 들어온 뒤 사장의 첫 대사 전에 요청한 연출 문장이 있어야 합니다.");
assert(!Object.values(STORY_SCENES).some(scene=>
  scene.lines.some(line=>line.text?.includes("얘기한다"))),
  "스토리 연출 문구에 '얘기한다' 표현이 남아 있으면 안 됩니다.");
assert(prologueOpening[5].speaker==="owner",
  "추가 연출 문장 바로 다음에 사장의 첫 대사가 이어져야 합니다.");
const generalOrders=STORY_SCENES["PR-01"].lines.filter(line=>line.kind==="bubble");
same(generalOrders.map(storySpeakerLabel),["손님 1","손님 2"],
  "프롤로그 일반 손님의 주문에는 순서대로 손님 1, 손님 2 이름표가 표시되어야 합니다.");
assert(generalOrders.every(line=>!line.speaker),
  "일반 손님 이름표는 고유 인물이나 초상을 만들지 않는 표시 전용 값이어야 합니다.");
const prologueLines=STORY_SCENES["PR-01"].lines;
const reflectionCaptionIndex=prologueLines.findIndex(line=>
  line.text==="식품 개발을 할 때는 레시피를 적어가며 대화 없이 조리만 하던 것과는 사뭇 다른 모습이다.\\n사장이 너무 바빠 주문이 계속 밀리고 있지만 손님은 계속 밀려들어왔다."
);
assert(reflectionCaptionIndex>=0
  &&prologueLines[reflectionCaptionIndex].kind==="direction"
  &&storySpeakerLabel(prologueLines[reflectionCaptionIndex])==="",
  "식품 개발 시절과 바쁜 식당을 대비하는 원문 자막을 이름표 없이 출력해야 합니다.");
assert(prologueLines[reflectionCaptionIndex+1]?.text
  ==="퇴사를 해서 그런지 아니면 가게 분위기에 휩쓸렸는지 다은은 용기를 내어 사장에게 말을 건다."
  &&prologueLines[reflectionCaptionIndex+2]?.speaker==="protagonist",
  "다은이 용기를 내는 자막 뒤에 주인공 대사가 이어져야 합니다.");
const handQuestionIndex=prologueLines.findIndex(line=>
  line.speaker==="owner"&&line.text==="손을 보니 요리 좀 해본 사람 같네. 맞나?"
);
assert(prologueLines[handQuestionIndex+1]?.text
  ==="8년 동안 식품 개발을 하며 많은 요리를 해 온 다은의 손에 굳은살이 이리저리 배겨있었다.",
  "손을 본 사장의 질문 다음 자막은 원문대로 '배겨있었다'로 출력해야 합니다.");
assert(!STORY_SCENES["PR-02"].lines.some(line=>line.cook),
  "PR-02는 가게를 맡기는 제안부터 시작하고 조리는 PR-01에서 끝나야 합니다.");

const g02=STORY_SCENES["G-02"];
assert(g02.day===2&&g02.dishId==="kimchi"&&g02.arrival==="late"&&g02.deferUntilArrival,
  "G-02는 Day 2 후반 김치전 주문이어야 합니다.");
assert(g02.lines.some(line=>line.text==="그게 더 무서운 선생님인데, 수요일에 검사받으러 오겠습니다 김치전은 덤이고요"),
  "G-02 재방문 예고 대사");
const g02CookLine=g02.lines.find(line=>line.orderCook);
assert(g02CookLine.speaker==="gicheol",
  "G-02 조리는 구현 설명문이 아니라 박기철의 주문 대사에서 시작해야 합니다.");
const g02Cook=g02CookLine.orderCook;
assert(storyCookingTier(59,g02Cook.thresholds)==="soft"
  &&storyCookingTier(60,g02Cook.thresholds)==="warm"
  &&storyCookingTier(79,g02Cook.thresholds)==="warm"
  &&storyCookingTier(80,g02Cook.thresholds)==="great","G-02 60/80점 경계");
state.nightCustomerTarget=2;
assert(storyArrivalThreshold({arrival:"late"})===1,
  "손님이 적은 날에도 late 이야기 손님은 첫 손님 뒤에 등장해야 합니다.");

const g03=STORY_SCENES["G-03"];
assert(g03.day===5&&g03.dishId==="kimchi"&&g03.arrival==="early"&&g03.regular,
  "G-03는 Day 5 김치전 단골 장면이어야 합니다.");
const g03Choices=g03.lines.find(line=>line.choices?.some(choice=>choice.orderCook)).choices;
same(g03Choices.map(choice=>choice.orderCook.special),[true,false],"G-03 특별/평소 조리 선택");
g03Choices.forEach(choice=>{
  assert(storyCookingTier(79,choice.orderCook.thresholds)==="soft"
    &&storyCookingTier(80,choice.orderCook.thresholds)==="great","G-03 맛있게 완성 기준은 80점입니다.");
});
storySession={
  pendingCook:{orderId:35,config:{thresholds:{great:80}}},
  suspended:true
};
const g03BubbleResult=applyStoryCookingResult({id:35,guestId:"gicheol",storySceneId:"G-03"},70);
assert(g03BubbleResult.tier==="soft",
  "G-03 60~79점 퇴장 말풍선도 80점 단일 경계를 따라야 합니다.");
storySession=null;
assert(DAY_DATA[5].requiredMenus.includes("kimchi")&&DAY_DATA[5].specialMenu==="kimchi",
  "Day 5 김치전은 필수 특별 메뉴여야 합니다.");

const managerScene=STORY_SCENES["C1-04B"];
assert(managerScene.day===7&&managerScene.dishId==="yakisoba"
  &&managerScene.arrival==="last"&&managerScene.deferUntilArrival,
  "팀장은 Day 7의 마지막 볶음우동 손님이어야 합니다.");
const managerCookLine=managerScene.lines.find(line=>line.orderCook);
assert(managerCookLine.speaker==="manager",
  "팀장 조리는 구현 설명문이 아니라 팀장의 주문 대사에서 시작해야 합니다.");
const managerCook=managerCookLine.orderCook;
assert(tierReply(managerCook,59)==="맛은 그럭저럭이네요.","팀장 59점 반응");
assert(tierReply(managerCook,60)==="괜찮네요. 잘 먹었어요.","팀장 60점 반응");
assert(tierReply(managerCook,79)==="괜찮네요. 잘 먹었어요.","팀장 79점 반응");
assert(tierReply(managerCook,80)==="괜찮네요. 잘 먹었어요.","팀장 80점 반응");

const day4Choice=STORY_SCENES["C1-02"].lines.find(line=>line.choices);
same(day4Choice.choices.map(choice=>choice.flag),["day5_reduce_portions","day5_limit_menus"],"Day 4 선택 플래그");
assert(day4Choice.choices.every(choice=>choice.notice),"Day 4 선택 결과는 안내 토스트가 있어야 합니다.");

state.day=5;
state.story=createStoryState();
state.story.flags.day5_reduce_portions=true;
assert(prepYieldForDay(dishById("kimchi"))===2&&prepYieldForDay(dishById("skewer"))===2,
  "Day 5 수량 감소는 기본 3인분을 2인분으로 줄여야 합니다.");
assert(prepYieldForDay({prepYield:1})===1,"원래 1인분인 메뉴는 1인분을 유지해야 합니다.");
state.day=4;
assert(prepYieldForDay(dishById("kimchi"))===3,"Day 4에는 Day 5 수량 감소가 적용되면 안 됩니다.");
state.day=6;
assert(prepYieldForDay(dishById("kimchi"))===3,"Day 6에는 Day 5 수량 감소가 적용되면 안 됩니다.");

state.day=5;
state.story=createStoryState();
state.story.flags.day5_limit_menus=true;
state.selectedMenus=["kimchi","oden","tofu","skewer","yakisoba"];
state.menuSelectionDraft=["kimchi","oden","tofu","skewer","yakisoba"];
state.prepProgress={};
state.kimchiPrep={};
normalizeDayPrepState();
assert(state.selectedMenus.length===3&&state.menuSelectionDraft.length===3,
  "Day 5 메뉴 제한은 저장된 선택도 3개로 정규화해야 합니다.");
assert(!setSelectedMenus(["kimchi","oden","tofu","skewer"]),"Day 5에는 메뉴 4개를 선택할 수 없습니다.");
assert(setSelectedMenus(["kimchi","oden","tofu"]),"Day 5에는 김치전을 포함한 메뉴 3개를 선택할 수 있습니다.");
state.day=6;
assert(maxSelectedMenusForDay(DAY_DATA[6])===5,"Day 6 메뉴 제한은 다시 5개여야 합니다.");

state.day=7;
state.phase=GAME_PHASES.OPEN;
state.story=createStoryState();
const lastPlan={
  guestId:"manager",sceneId:"C1-04B",dishId:"yakisoba",
  arrival:"last",deferUntilArrival:true,guestOrder:true,special:false,repeat:false
};
state.story.pendingNightGuests=[lastPlan];
state.nightCustomerTarget=4;
state.spawnedCustomers=3;
state.orders=[{id:50,slot:0,customerType:"general",storySceneId:null}];
state.departures=[];
assert(storyPlansForSpawn(false).length===0&&waitingForLastStoryGuest(),
  "일반 손님 주문이 남아 있으면 팀장이 등장하면 안 됩니다.");
assert(spawnOrder(1,{forceStory:true})===false,
  "영업 종료 강제 처리도 일반 손님보다 팀장을 먼저 등장시키면 안 됩니다.");
state.orders=[];
state.departures=[{guestId:null,life:1}];
assert(storyPlansForSpawn(true).length===0,
  "마지막 일반 손님의 퇴장 연출이 끝나기 전 팀장이 등장하면 안 됩니다.");
state.respawns=[];
assert(processOrderRespawn({slot:1,forceStory:true})===false,
  "퇴장 연출 중인 강제 등장 시도는 실패해야 합니다.");
assert(state.respawns.length===1&&state.respawns[0].forceStory&&state.respawns[0].time===.2,
  "실패한 마지막 이야기 손님 등장은 0.2초 뒤 재시도해야 합니다.");
state.departures=[];
assert(storyPlansForSpawn(false)[0]===lastPlan,
  "모든 일반 손님이 떠난 뒤에는 팀장이 등장 가능해야 합니다.");
state.selectedMenus=["yakisoba"];
state.inventory=Object.fromEntries(DISHES.map(dish=>[dish.id,{count:0,quality:100}]));
state.inventory.yakisoba.count=1;
const managerRetry=state.respawns.shift();
spawningInitialNightOrders=true;
assert(processOrderRespawn(managerRetry)===true,
  "퇴장 연출이 끝난 뒤 재시도하면 팀장이 즉시 등장해야 합니다.");
spawningInitialNightOrders=false;
assert(state.orders.length===1&&state.orders[0].storySceneId==="C1-04B"
  &&state.orders[0].dishId==="yakisoba","재시도된 팀장 주문은 C1-04B 볶음우동이어야 합니다.");

assert(SAVE_VERSION===3,"구버전 저장 초기화를 위해 저장 버전은 3이어야 합니다.");
const saveState={phase:GAME_PHASES.PREP,day:1,inventory:{oden:{count:1,quality:100}}};
localStorage.setItem(SAVE_KEY,JSON.stringify({version:2,state:saveState}));
assert(readSaveData()===null&&localStorage.getItem(SAVE_KEY)===null,"v2 저장은 삭제되어야 합니다.");
localStorage.setItem(SAVE_KEY,"{broken");
assert(readSaveData()===null&&localStorage.getItem(SAVE_KEY)===null,"손상된 저장은 삭제되어야 합니다.");
localStorage.setItem(SAVE_KEY,JSON.stringify({version:3,state:saveState}));
assert(readSaveData()?.version===3&&localStorage.getItem(SAVE_KEY)!==null,"정상 v3 저장은 유지되어야 합니다.");

console.log("STORY_CONTRACT_OK 82");
`;

const context={
  console:{
    log:message=>process.stdout.write(`${message}\n`),
    warn(){}
  },
  Map,
  Math,
  Date,
  JSON,
  Object,
  Array,
  Set,
  Number,
  String,
  Boolean,
  RegExp,
  Error,
  setTimeout,
  clearTimeout
};

vm.runInNewContext(
  [bootstrap,...sources,test].join("\n;\n"),
  context,
  {filename:"story-contract-smoke.bundle.js"}
);
