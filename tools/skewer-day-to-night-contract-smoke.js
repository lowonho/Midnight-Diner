"use strict";

/* 낮 '닭꼬치 꽂기'(engine-e8) → 밤 '닭꼬치 굽기'(engine-e5) 배치 인계 계약.

   밤에 굽는 꼬치는 **낮에 꽂은 그 꼬치**여야 합니다. 그 약속이 지켜지는지를
   두 엔진을 같은 상자에 올려 놓고 확인합니다.
     1) 꽂기를 끝내면 배치가 state.skewerPrep.patterns 에 남는가
     2) 굽기가 그 배치를 그대로 읽는가
     3) 꽂기를 건너뛰고 들어와도(QA 모드) 기본 배치로 화면이 서는가
     4) 화면에 쌓이는 조각 순서가 꽂은 순서(아래 → 위)와 같은가

   화면 크기·모양은 tools/e5-skewer-cook-visual-smoke.html 이 봅니다. 여기는 값만 봅니다. */

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

/* 두 엔진이 로드될 때 부르는 창구·전역만 흉내 냅니다.
   ⚠️ 조각 그림은 **있는 것으로** 둡니다 — 없으면 임시 도형(<b>/<em>)으로 떨어져
      4) 의 순서 확인이 그림 경로를 못 봅니다. */
const sandbox={
  state:{skewerPrep:{patterns:[]}},
  audio:new Proxy({},{get:()=>()=>{}}),
  dom:new Proxy({},{get:()=>({})}),
  clamp:(value,low,high)=>Math.max(low,Math.min(high,value)),
  registerMiniEngine:()=>{},
  registerDayPrepEngine:()=>{},
  registerDayPrepSetup:()=>{},
  setDayPrepData:()=>{},
  isDayPrepMini:()=>false,
  finishMini:()=>{},
  finishDayPrepTask:()=>{},
  hasDayPrepAsset:()=>true,
  dayPrepAssetMarkup:(key,className)=>`<img class="${className}" data-key="${key}">`,
  bindOrderPlacementPointers:()=>{},
  pulseOrderTarget:()=>{},
  setTimeout:()=>0,
  console
};
sandbox.globalThis=sandbox;

const files=["game-data.js","engine-e8-order-place.js","engine-e5-two-side-cook.js"];
const context=vm.createContext(sandbox);
files.forEach(file=>vm.runInContext(read(file),context,{filename:file}));
const api=vm.runInContext(
  "({rememberAssembledSkewers,skewerCookPatterns,charcoalSkewerMarkup,SKEWER_COOK_FALLBACK,SKEWER_SLOT_COUNT,SKEWER_BATCH_SIZE})",
  context
);

// 1) 꽂기 완료 → 배치가 남는가 (engine-e8 의 placeSkewerPiece 가 마지막에 부르는 함수)
const assembled=[
  ["chicken","greenOnion","chicken","greenOnion","chicken"],
  ["chicken","chicken","greenOnion","greenOnion","chicken"],
  ["greenOnion","chicken","chicken","chicken","greenOnion"]
];
api.rememberAssembledSkewers({patterns:assembled});
assert(same(sandbox.state.skewerPrep.patterns,assembled),"꽂은 배치가 state.skewerPrep 에 남지 않았습니다.");
// 원본 배열을 그대로 물고 있으면 낮 게임이 다시 열릴 때 밤 배치까지 같이 바뀝니다.
assert(sandbox.state.skewerPrep.patterns[0]!==assembled[0],"배치를 복사하지 않고 참조로 들고 있습니다.");

// 2) 굽기가 그 배치를 그대로 읽는가
assert(same(api.skewerCookPatterns(),assembled),"밤 굽기가 낮에 꽂은 배치를 그대로 읽지 못했습니다.");

// 3) 꽂기를 건너뛴 경우 (QA 모드가 준비를 완료로 찍고 밤으로 넘어오는 길)
sandbox.state.skewerPrep={patterns:[]};
const fallback=api.skewerCookPatterns();
assert(fallback.length===api.SKEWER_BATCH_SIZE,`기본 배치가 ${api.SKEWER_BATCH_SIZE}개가 아닙니다.`);
assert(fallback.every(pattern=>same(pattern,[...api.SKEWER_COOK_FALLBACK])),"기본 배치가 닭·파 번갈이가 아닙니다.");
assert(api.SKEWER_COOK_FALLBACK.length===api.SKEWER_SLOT_COUNT,"기본 배치의 칸 수가 꽂기(5칸)와 다릅니다.");
// 배치가 반쯤만 남아 있어도(옛 세이브) 빈 자리는 기본 배치로 채웁니다
sandbox.state.skewerPrep={patterns:[assembled[0]]};
const partial=api.skewerCookPatterns();
assert(same(partial[0],assembled[0])&&same(partial[2],[...api.SKEWER_COOK_FALLBACK]),"모자란 배치를 기본 배치로 못 채웁니다.");

/* 4) 화면에 쌓이는 순서. 꽂기는 **아래에서 위로** 채우므로 마크업은 뒤집혀야 합니다
      (E8 의 skewerRackMarkup 과 같은 규칙). 첫 꼬치 닭-파-닭-파-닭 을 예로 봅니다. */
sandbox.state.skewerPrep={patterns:assembled};
const markup=api.charcoalSkewerMarkup({phase:"cook",flippedSkewers:0,skewerPatterns:api.skewerCookPatterns()});
const racks=markup.split('class="grill-skewer').slice(1);
assert(racks.length===api.SKEWER_BATCH_SIZE,`화로에 꼬치가 ${api.SKEWER_BATCH_SIZE}개가 아닙니다.`);
racks.forEach((rack,index)=>{
  const stacked=[...rack.matchAll(/class="gs-piece (chicken|greenOnion)"/g)].map(match=>match[1]);
  assert(same(stacked,[...assembled[index]].reverse()),`${index+1}번 꼬치가 꽂은 순서와 다릅니다: ${stacked.join(",")}`);
});
// 조각 그림이 E8 꽂기와 같은 파일인지 (키가 다르면 낮과 밤의 닭고기가 서로 다른 그림이 됩니다)
assert(markup.includes('data-key="skewerChicken"')&&markup.includes('data-key="skewerGreenOnion"'),
  "굽는 조각이 E8 꽂기와 같은 그림 키를 쓰지 않습니다.");
assert(markup.includes('data-key="skewerStick"'),"꼬챙이가 E8 꽂기와 같은 그림 키를 쓰지 않습니다.");

console.log(`SKEWER_DAY_TO_NIGHT_CONTRACT_OK ${api.SKEWER_BATCH_SIZE} skewers x ${api.SKEWER_SLOT_COUNT} slots`);
