"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const gameDataSource=fs.readFileSync(path.join(root,"game-data.js"),"utf8");
const storyDataSource=fs.readFileSync(path.join(root,"story-data.js"),"utf8");
const qaModeSource=fs.readFileSync(path.join(root,"qa-mode.js"),"utf8");
const storySource=fs.readFileSync(path.join(root,"story.js"),"utf8");
const saveSource=fs.readFileSync(path.join(root,"save.js"),"utf8");
const qaCssSource=fs.readFileSync(path.join(root,"css","qa-mode.css"),"utf8");
let staticChecks=0;

function assert(condition,message){
  staticChecks++;
  if(!condition)throw new Error(message);
}

assert(qaModeSource.includes('data-qa-tab="story"')
  &&qaModeSource.includes('data-qa-view="story"'),
  "QA 패널에 스토리 탭과 스토리 화면이 있어야 합니다.");
assert(qaModeSource.includes('data-qa-story-prev')
  &&qaModeSource.includes('data-qa-story-next')
  &&qaModeSource.includes('data-qa-story-lines'),
  "QA 스토리 화면에 이전·다음 및 대사 목록이 있어야 합니다.");
assert(/\.qa-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\)/s.test(qaCssSource),
  "날짜·스토리·미니게임 세 탭을 같은 폭으로 배치해야 합니다.");
assert(qaCssSource.includes(".qa-story-day-grid")
  &&qaCssSource.includes(".qa-story-line.active"),
  "일차 선택과 현재 대사 강조 스타일이 있어야 합니다.");
assert(storySource.includes("if(storySession.qaPreview)")
  &&storySource.includes('typeof qaStoryStep==="function"')
  &&storySource.includes('typeof qaStoryPreviewChoice==="function"'),
  "스토리 실행기는 QA 미리보기에서 일반 진행과 선택 처리를 우회해야 합니다.");
assert(storySource.includes("if(!window.QA_MODE?.enabled)return false;"),
  "URL 스토리 QA도 저장 방지 QA 모드에서만 실행되어야 합니다.");
assert(saveSource.includes("QA 스토리 탐색 중에는 기존 저장 슬롯을 삭제하지 않습니다.")
  &&saveSource.includes("if(window.QA_MODE?.enabled)return false;"),
  "QA 스토리 탐색 중에는 기존 저장 슬롯 삭제도 차단해야 합니다.");

const bootstrap=`
const window={
  location:{search:"?qa=1",href:"http://localhost/?qa=1"},
  addEventListener(){}
};
const location=window.location;
const document={
  getElementById(){return null;},
  querySelector(){return null;},
  createElement(){return {};},
  body:{classList:{add(){}}}
};
const sessionStorage={getItem(){return null;},setItem(){}};
`;

const tests=`
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
const entries=qaStorySceneList();
same(entries.map(entry=>entry.id).sort(),Object.keys(STORY_SCENES).sort(),
  "QA 일차별 목록은 모든 스토리 장면을 포함해야 합니다.");
check(new Set(entries.map(entry=>entry.id)).size===entries.length,
  "QA 스토리 목록에 장면이 중복되면 안 됩니다.");
same([...new Set(entries.map(entry=>entry.day))],[0,1,2,3,4,5,6,7],
  "프롤로그 0일차와 영업 1~7일차가 모두 표시되어야 합니다.");
same(entries.filter(entry=>entry.day===0).map(entry=>entry.id),["PR-01","PR-02"],
  "PR-01과 PR-02는 프롤로그 0일차로 묶여야 합니다.");
check(entries.filter(entry=>entry.day>0).every(entry=>entry.day===entry.scene.day),
  "프롤로그를 제외한 장면은 대본의 영업 일차에 표시되어야 합니다.");

entries.forEach(entry=>{
  same(
    entry.lines.map(line=>line.index),
    entry.scene.lines.map((_,index)=>index),
    entry.id+" 대사 인덱스"
  );
});

const pr01=STORY_SCENES["PR-01"];
check(qaStoryClampLineIndex(pr01,-20)===0,"음수 대사 위치는 첫 줄로 보정해야 합니다.");
check(qaStoryClampLineIndex(pr01,9999)===pr01.lines.length-1,
  "범위를 넘은 대사 위치는 마지막 줄로 보정해야 합니다.");
check(qaStoryClampLineIndex(pr01,4.9)===4,"대사 위치는 정수 인덱스로 보정해야 합니다.");
check(qaStoryLineSpeaker({speaker:"owner"})==="사장","고유 인물은 실제 이름으로 목록에 표시해야 합니다.");
check(qaStoryLineSpeaker({speakerLabel:"손님 1"})==="손님 1","일반 손님 이름표를 보존해야 합니다.");
check(qaStoryLineSpeaker({kind:"direction"})==="","상황 설명 자막에는 별도 명칭을 표시하지 않아야 합니다.");

const c102ChoiceLine=STORY_SCENES["C1-02"].lines.find(line=>line.choices);
const c102Branches=qaStoryBranchEntries(c102ChoiceLine);
check(c102Branches.some(entry=>entry.label==="선택 1")
  &&c102Branches.some(entry=>entry.label.startsWith("선택 1 응답")),
  "일반 선택지와 그 응답 대사를 QA 목록에서 함께 확인할 수 있어야 합니다.");
const g03ChoiceLine=STORY_SCENES["G-03"].lines.find(line=>line.choices);
const g03Branches=qaStoryBranchEntries(g03ChoiceLine);
check(g03Branches.some(entry=>entry.label.includes("조리 반응 · great"))
  &&g03Branches.some(entry=>entry.label.includes("조리 반응 · soft")),
  "선택형 조리의 성공·아쉬움 반응을 모두 확인할 수 있어야 합니다.");
const managerCookLine=STORY_SCENES["C1-04B"].lines.find(line=>line.orderCook);
const managerBranches=qaStoryBranchEntries(managerCookLine);
check(managerBranches.some(entry=>entry.text==="괜찮네요. 잘 먹었어요.")
  &&managerBranches.some(entry=>entry.text==="맛은 그럭저럭이네요."),
  "직접 조리 분기의 모든 팀장 반응 대사를 확인할 수 있어야 합니다.");

runtimeChecks;
`;

const context={
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

const runtimeChecks=vm.runInNewContext(
  [bootstrap,gameDataSource,storyDataSource,qaModeSource,tests].join("\n;\n"),
  context,
  {filename:"qa-story-contract-smoke.bundle.js"}
);

console.log(`QA_STORY_CONTRACT_OK ${staticChecks+runtimeChecks}`);
