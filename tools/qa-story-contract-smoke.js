"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const gameDataSource = fs.readFileSync(path.join(root, "game-data.js"), "utf8");
const storyDataSource = fs.readFileSync(path.join(root, "story-data.js"), "utf8");
const qaModeSource = fs.readFileSync(path.join(root, "qa-mode.js"), "utf8");
const storySource = fs.readFileSync(path.join(root, "story.js"), "utf8");
const saveSource = fs.readFileSync(path.join(root, "save.js"), "utf8");
const qaCssSource = fs.readFileSync(path.join(root, "css", "qa-mode.css"), "utf8");
let staticChecks = 0;

function assert(condition, message) {
  staticChecks++;
  if (!condition) throw new Error(message);
}

assert(qaModeSource.includes('data-qa-tab="story"')
  && qaModeSource.includes('data-qa-view="story"'),
"QA 패널에 스토리 탭과 스토리 화면이 있어야 합니다.");
assert(qaModeSource.includes("qaStoryJournalStates")
  && qaModeSource.includes("journalVariants")
  && qaModeSource.includes("resultSceneIds")
  && qaModeSource.includes("missingMenuSceneId"),
"QA 스토리 탭은 영업일지 상태와 특별 손님 분기 계약을 읽어야 합니다.");
assert(qaModeSource.includes('QA_QUERY_PARAMS.has("qa-story")'),
"qa-story 직접 주소만으로도 저장이 차단된 QA 미리보기가 활성화되어야 합니다.");
assert(qaModeSource.includes("qaContextDay")
  && qaModeSource.includes("options?.contextDay"),
"day:null 장면은 선택한 QA Day 맥락으로 열려야 합니다.");
assert(qaModeSource.includes("qaStoryReturnContext")
  && qaModeSource.includes("story:state.story")
  && qaModeSource.includes("state.story=context.story"),
"QA 미리보기 전후에 실제 이야기 상태를 보존·복원해야 합니다.");
assert(qaModeSource.includes('data-qa-story-prev')
  && qaModeSource.includes('data-qa-story-next')
  && qaModeSource.includes('data-qa-story-lines'),
"QA 스토리 화면에 이전·다음 및 대사 목록이 있어야 합니다.");
assert(/\.qa-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*1fr\)/s.test(qaCssSource),
"날짜·스토리·미니게임·영업일지 네 탭을 같은 폭으로 배치해야 합니다.");
assert(qaModeSource.includes('data-qa-tab="journal"')
  && qaModeSource.includes('data-qa-view="journal"'),
"QA 패널에 영업일지 탭과 화면이 있어야 합니다.");
assert(qaModeSource.includes("data-qa-journal-unlock")
  && qaModeSource.includes("data-qa-journal-reset"),
"영업일지 탭에는 전체 개방과 초기화 버튼이 함께 있어야 합니다.");
assert(qaModeSource.includes("collectionPages?.()")
  && qaModeSource.includes("recordGuest?.(page.id,{perfect:true")
  && qaModeSource.includes("unlockTrueEndingEpilogues?.()"),
"전체 개방은 실제 해금 API(손님·엔딩·후일담)를 그대로 사용해야 합니다.");
assert(qaModeSource.includes("localStorage.removeItem(JOURNAL_KEY)"),
"초기화는 영업일지 저장 키를 지워 처음 상태로 되돌려야 합니다.");
assert(qaCssSource.includes(".qa-journal-reset.armed"),
"초기화 두 번 누르기 대기 상태 스타일이 있어야 합니다.");
assert(qaCssSource.includes(".qa-story-day-grid")
  && qaCssSource.includes(".qa-story-line.active")
  && qaCssSource.includes(".qa-story-branches"),
"일차·대사·분기 목록 스타일이 있어야 합니다.");
assert(storySource.includes("if(storySession.qaPreview)")
  && storySource.includes('typeof qaStoryStep==="function"')
  && storySource.includes('typeof qaStoryPreviewChoice==="function"'),
"스토리 실행기는 QA 미리보기에서 실제 진행 처리를 우회해야 합니다.");
assert(saveSource.includes("if(window.QA_MODE?.enabled)return false;"),
"QA 스토리 탐색 중에는 저장 쓰기가 차단되어야 합니다.");

const bootstrap = `
var state={day:4,story:{sentinel:true}};
var storySession=null;
const window={
  location:{search:"?qa=1",href:"http://localhost/?qa=1"},
  addEventListener(){}
};
const document={
  getElementById(){return null;},
  querySelector(){return null;},
  createElement(){return {};},
  body:{classList:{add(){}}}
};
const sessionStorage={getItem(){return null;},setItem(){}};
`;

const tests = `
let runtimeChecks=0;
function check(condition,message){
  runtimeChecks++;
  if(!condition)throw new Error(message);
}
function same(actual,expected,message){
  check(JSON.stringify(actual)===JSON.stringify(expected),
    message+"\\nactual: "+JSON.stringify(actual)+"\\nexpected: "+JSON.stringify(expected));
}

check(window.QA_MODE.enabled===true,"qa=1에서 QA 저장 방지 모드가 활성화되어야 합니다.");
const progressBefore=JSON.stringify(state.story);
const entries=qaStorySceneList();
check(entries.length===67,
  "55개 장면에 day:null 반복 장면 L02·D01의 Day 2~7 복제 12개를 더해 67개 항목이어야 합니다.");
same([...new Set(entries.map(entry=>entry.id))].sort(),Object.keys(STORY_SCENES).sort(),
  "QA 일차별 목록은 새 55개 장면을 모두 포함해야 합니다.");
same([...new Set(entries.map(entry=>entry.day))],[0,1,2,3,4,5,6,7],
  "프롤로그 0일차와 영업 1~7일차가 모두 표시되어야 합니다.");
same(entries.filter(entry=>entry.day===0).map(entry=>entry.id),
  ["SCN-P01","SCN-P02","SCN-P03","SCN-P04"],
  "SCN-P01~P04는 프롤로그 0일차로 묶여야 합니다.");

for(let day=1;day<=7;day++){
  const dayEntries=qaStoryScenesForDay(day);
  check(dayEntries.filter(entry=>entry.id==="SCN-L02").length===1,
    "SCN-L02는 선택한 Day "+day+" 맥락에 한 번 표시되어야 합니다.");
  check(dayEntries.filter(entry=>entry.id==="SCN-D01").length===1,
    "SCN-D01은 Day "+day+" 밤 영업 장면으로 표시되어야 합니다.");
}
check(qaStoryDayForScene(STORY_SCENES["SCN-L02"],5)===5,
  "day:null인 SCN-L02는 전달된 Day 5 맥락을 유지해야 합니다.");
check(qaStoryDayForScene(STORY_SCENES["SCN-D01"],7)===7,
  "day:null인 SCN-D01은 전달된 Day 7 맥락을 유지해야 합니다.");

const l02=STORY_SCENES["SCN-L02"];
check(qaStoryJournalState(l02)==="none","SCN-L02의 기본 QA 상태는 기록 없음이어야 합니다.");
check(qaStoryLinesForScene(l02).length===l02.lines.length+l02.journalVariants.none.length,
  "SCN-L02 미리보기에는 공통 내레이션과 선택한 상태 대사를 함께 표시해야 합니다.");
qaStoryJournalStates[l02.id]="confirmed";
check(qaStoryJournalState(l02)==="confirmed"
  &&qaStoryLinesForScene(l02).at(-1).text.includes("확인한 음식은"),
  "영업일지 음식 확정 상태를 실제 대화 미리보기 줄에 반영해야 합니다.");
const journalBranches=qaStoryBranchEntries(l02,l02.lines[0]);
same(journalBranches.map(entry=>entry.label),[
  "영업일지 · 기록 없음","영업일지 · 음식 단서","영업일지 · 음식 확정","영업일지 · 조각 획득"
],"영업일지 네 상태 분기 표시");
check(journalBranches.every(entry=>entry.sceneId==="SCN-L02"&&entry.journalState),
  "영업일지 상태 행은 같은 장면을 해당 상태로 다시 여는 링크여야 합니다.");

const g1=STORY_SCENES["SCN-G1-A"];
const g1Branches=qaStoryBranchEntries(g1,g1.lines[0]);
same(g1Branches.map(entry=>entry.label),[
  "음식 미준비","조리 결과 · 아쉽다","조리 결과 · 맛있다","조리 결과 · 완벽"
],"특별 손님 미준비 및 세 평가 분기 표시");
same(g1Branches.map(entry=>entry.sceneId),[
  "SCN-G1-B","SCN-G1-아쉽다","SCN-G1-맛있다","SCN-G1-완벽"
],"특별 손님 분기 대상 장면 연결");

const j02=STORY_SCENES["SCN-J02"];
const j02Branches=qaStoryBranchEntries(j02,j02.lines[0]);
same(j02Branches.map(entry=>entry.sceneId),["END-01","END-02"],
  "조각 4~7개 엔딩 선택 분기 표시");
const j03=STORY_SCENES["SCN-J03"];
const j03Branches=qaStoryBranchEntries(j03,j03.lines[0]);
same(j03Branches.map(entry=>entry.sceneId),["END-03","END-04"],
  "조각 8개 엔딩 선택 분기 표시");
check(j03Branches[1].text==="내일을 모두에게 돌려준다",
  "END-04 선택 문구를 QA 패널에서 확인할 수 있어야 합니다.");
check(String(qaStoryPreviewChoice).includes("qaOpenStoryScene(nextSceneId")
  &&String(qaStoryPreviewChoice).includes("STORY_SCENES[nextSceneId]"),
  "QA의 실제 선택지에서도 대상 엔딩 장면과 배경 미리보기로 이동해야 합니다.");
const originalQaOpenStoryScene=qaOpenStoryScene;
const originalQaRefreshPanel=qaRefreshPanel;
let qaOpenedEnding=null;
qaOpenStoryScene=(sceneId,lineIndex,options)=>{
  qaOpenedEnding={sceneId,lineIndex,contextDay:options?.contextDay};
  return true;
};
qaRefreshPanel=()=>{};
storySession={qaPreview:true,qaContextDay:7};
check(qaStoryPreviewChoice(j02.lines.find(line=>line.choices).choices[0],0)===true
  &&qaOpenedEnding?.sceneId==="END-01"
  &&qaOpenedEnding?.lineIndex===0
  &&qaOpenedEnding?.contextDay===7,
  "QA 판정 장면에서 선택지를 누르면 END-01 엔딩 화면으로 바로 이어져야 합니다.");
storySession=null;
qaOpenStoryScene=originalQaOpenStoryScene;
qaRefreshPanel=originalQaRefreshPanel;

const p01=STORY_SCENES["SCN-P01"];
check(qaStoryClampLineIndex(p01,-20)===0,"음수 대사 위치는 첫 줄로 보정해야 합니다.");
check(qaStoryClampLineIndex(p01,9999)===p01.lines.length-1,
  "범위를 넘은 대사 위치는 마지막 줄로 보정해야 합니다.");
check(qaStoryLineSpeaker({speaker:"rainyChild"})==="비에 젖은 아이",
  "서술형 특별 손님 이름을 목록에 그대로 표시해야 합니다.");
check(qaStoryLineSpeaker({speakerLabel:"김다은(속말)"})==="김다은(속말)",
  "표시 전용 화자명을 보존해야 합니다.");
check(qaStoryLineSpeaker({kind:"direction"})==="",
  "상황 설명 자막에는 별도 명칭을 표시하지 않아야 합니다.");

check(qaJournalCollectionPages().length===0&&qaUnlockAllJournalPages()===false,
  "영업일지 저장 모듈이 없으면 전체 개방은 조용히 멈춰야 합니다.");
check(qaJournalResetArmed()===false&&qaResetJournalPages()===false&&qaJournalResetArmed()===true,
  "초기화는 첫 클릭에서 실행되지 않고 두 번 누르기 대기 상태가 되어야 합니다.");
check(qaResetJournalPages()===false&&qaJournalResetArmed()===false,
  "저장소를 쓸 수 없으면 초기화는 실패를 알리고 대기 상태를 풀어야 합니다.");

/* QA가 대신 고르는 오늘의 메뉴에는 그날 특별 손님이 찾는 음식이 반드시 들어가야
   합니다. 빠지면 손님 앞 음식 선택지에 정답이 아예 나오지 않습니다. */
var dishById=id=>menuDataById(id);
var maxSelectedMenusForDay=data=>Math.max(1,Math.floor(Number(data.maxSelectedMenus)||1));
var getCurrentDayData=()=>DAY_DATA[state.day];
var qaCapturedPicks=null;
var setSelectedMenus=ids=>{qaCapturedPicks=[...ids];state.selectedMenus=[...ids];return true;};
var selectedPrepTasks=()=>[];
var selectedDishes=()=>[];
var completeDayPrepTask=()=>{};
var dom={menuSelectOverlay:{classList:{remove(){}}}};
const qaMenuDay=state.day;
for(let day=1;day<=7;day++){
  state.day=day;state.phase=GAME_PHASES.MENU_SELECT;state.selectedMenus=[];state.inventory={};
  qaCapturedPicks=null;
  qaFinishTodayPrep();
  const wanted=qaSpecialGuestDishIdsForToday();
  check(wanted.length>0,"Day "+day+" 특별 손님이 찾는 음식을 찾지 못했습니다.");
  check(wanted.every(id=>qaCapturedPicks.includes(id)),
    "Day "+day+" QA 자동 메뉴에 특별 손님 정답 음식이 빠졌습니다."
    +"\\npicks: "+JSON.stringify(qaCapturedPicks)+" / wanted: "+JSON.stringify(wanted));
  check(qaCapturedPicks.length===DAY_DATA[day].minSelectedMenus,
    "Day "+day+" QA 자동 메뉴는 그날 선택 개수를 그대로 지켜야 합니다.");
}
state.day=qaMenuDay;state.selectedMenus=[];state.inventory={};

check(JSON.stringify(state.story)===progressBefore,
  "QA 목록·영업일지·분기 탐색은 실제 이야기 진행 상태를 변경하면 안 됩니다.");
runtimeChecks;
`;

const context = {
  console:{log(){},warn(){}},
  URL,
  URLSearchParams,
  Map,
  Set,
  Date,
  Intl,
  String,
  Number,
  Boolean,
  Array,
  Object,
  RegExp,
  Error,
  Math,
  JSON,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval
};

const runtimeChecks = vm.runInNewContext(
  [bootstrap, gameDataSource, storyDataSource, qaModeSource, tests].join("\n;\n"),
  context,
  {filename:"qa-story-contract-smoke.bundle.js"}
);

const directQaContext={
  window:{
    location:{search:"?qa-story=END-01",href:"http://localhost/?qa-story=END-01"},
    addEventListener(){}
  },
  document:{getElementById(){return null;}},
  sessionStorage:{getItem(){return null;},setItem(){}},
  URL,
  URLSearchParams,
  Object,
  setTimeout,
  setInterval,
  clearTimeout,
  clearInterval
};
vm.runInNewContext(qaModeSource,directQaContext,{filename:"qa-story-direct-entry.js"});
assert(directQaContext.window.QA_MODE?.enabled===true,
  "qa-story 직접 주소는 qa=1이 없어도 QA 저장 방지 모드로 열려야 합니다.");

console.log(`QA_STORY_CONTRACT_OK ${staticChecks+runtimeChecks}`);
