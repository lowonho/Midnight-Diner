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

/* ⚠️ **index.html 과 같은 순서로 읽습니다 (E5 → E8).** 이 게임들은 모듈이 아니라
   전역 스크립트라, 두 파일에 같은 이름의 함수가 있으면 나중에 읽는 쪽이 앞의 것을
   덮어씁니다. 순서를 뒤집어 읽으면 그 덮어쓰기가 여기서는 안 보이고 게임에서만
   터집니다 — 실제로 E5 재료 카드가 E8 함수에 먹힌 적이 있습니다(아래 6번). */
const files=["game-data.js","engine-e5-two-side-cook.js","engine-e8-order-place.js"];
const context=vm.createContext(sandbox);
files.forEach(file=>vm.runInContext(read(file),context,{filename:file}));
const api=vm.runInContext(
  "({rememberAssembledSkewers,skewerCookPatterns,charcoalSkewerMarkup,twoSideSkewerCardMarkup,TWO_SIDE_VIEW,twoSideIngredientMarkup,createTwoSideData,twoSideSideFromStage,SKEWER_COOK_FALLBACK,SKEWER_SLOT_COUNT,SKEWER_BATCH_SIZE})",
  context
);

/* 밤 굽기 화면의 한 판 상태. **엔진과 같은 함수로** 만들고 자루만 손봅니다
   (손으로 베껴 적으면 판 구조가 바뀔 때 이 검사만 옛 모양으로 남습니다).
   꼬치는 플레이어가 하나씩 올리므로, 화면을 보려면 먼저 다 올려 둬야 합니다. */
const cookData=(cookStep=0)=>{
  const data=api.createTwoSideData("skewer",{});
  // slot 은 **화로의 몇 번째 자리**입니다 (자루 번호와 별개). 안 채우면 화로가 빈 채로 그려집니다.
  data.units.forEach((unit,seat)=>{unit.placed=true;unit.slot=seat;unit.sides=[api.twoSideSideFromStage(cookStep),api.twoSideSideFromStage(cookStep)];});
  return data;
};

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
const markup=api.charcoalSkewerMarkup(cookData());
const racks=markup.split('class="grill-skewer').slice(1);
assert(racks.length===api.SKEWER_BATCH_SIZE,`화로에 꼬치가 ${api.SKEWER_BATCH_SIZE}개가 아닙니다.`);
racks.forEach((rack,index)=>{
  const stacked=[...rack.matchAll(/class="gs-piece(?: has-cook-art)? (chicken|greenOnion)"/g)].map(match=>match[1]);
  assert(same(stacked,[...assembled[index]].reverse()),`${index+1}번 꼬치가 꽂은 순서와 다릅니다: ${stacked.join(",")}`);
});
// 조각 그림이 E8 꽂기와 같은 파일인지 (키가 다르면 낮과 밤의 닭고기가 서로 다른 그림이 됩니다)
assert(markup.includes('data-key="skewerChicken"')&&markup.includes('data-key="skewerGreenOnion"'),
  "굽는 조각이 E8 꽂기와 같은 그림 키를 쓰지 않습니다.");
assert(markup.includes('data-key="skewerStick"'),"꼬챙이가 E8 꽂기와 같은 그림 키를 쓰지 않습니다.");

/* 5) 익힘 단계. 조각 한 개에 5장이 깔리고 **지금 단계까지만** 켜져 있어야 합니다.
      첫 장은 낮에 꽂은 그 그림(E8)이고, 나머지 넷이 E5/yakitori 납품본입니다.
      ⚠️ 게이지(marker)를 안 준 위 4) 의 마크업은 안 익은 첫 장이어야 합니다 —
         비교가 undefined 로 새면 조용히 "탄 것"이 되어 화면이 처음부터 까맣습니다. */
// ⚠️ 조각 상자(.gs-piece)만 집습니다 — 조각을 담는 바깥 상자(.gs-pieces)와 이름이 겹쳐서,
//    클래스 뒤에 **공백이 오는 것**(gs-piece + 재료 이름)으로 갈라 냅니다.
const firstPiece=markup=>/<span class="gs-piece [^"]*">([\s\S]*?)<\/span>/.exec(markup)[1];
const framesOf=piece=>[...piece.matchAll(/class="gs-piece-asset step-\d+( on)?" data-key="([^"]+)"/g)]
  .map(match=>({on:!!match[1],key:match[2]}));
const rawFrames=framesOf(firstPiece(markup));
assert(rawFrames.length===5,`조각에 익힘 단계 그림이 5장이 아닙니다 (${rawFrames.length}장).`);
assert(rawFrames[0].key==="skewerChicken","익힘 첫 장이 낮에 꽂은 조각(skewerChicken)이 아닙니다.");
assert(same(rawFrames.map(frame=>frame.on),[true,false,false,false,false]),
  "익힘 단계를 안 준 화면이 안 익은 첫 장으로 서지 않습니다.");
/* 익힘 단계를 끝까지 올리면 마지막 장까지 다 켜집니다 (아래 장을 끄지 않는 것이 규칙입니다).
   ⚠️ 예전에는 여기에 `marker:.99`(익힘 게이지 눈금)를 넘겼습니다. 게이지가 없어지고
      **면(앞/뒤)마다 unit.sides 가 자루별로 따로 들고** 있게 바뀌었습니다
      (engine-e5-two-side-cook.js 의 PANCAKE_COOK_STEPS 주석 참고). */
const burnt=framesOf(firstPiece(api.charcoalSkewerMarkup(cookData(4))));
assert(burnt.every(frame=>frame.on),"다 태운 화면에서 익힘 단계 5장이 다 켜지지 않았습니다.");
assert(burnt[4].key==="cookSkewerChickenBurnt",`마지막 장이 탄 그림이 아닙니다: ${burnt[4].key}`);

/* 6) 왼쪽 재료 카드도 **낮에 꽂은 그 배치**여야 합니다. 화로 위 꼬치와 같은 그림·
      같은 쌓기를 쓰되 익힘 단계만 빼고 올립니다.
      ⚠️ 이 검사가 있는 이유 : 카드를 만드는 함수 이름이 E8 의 같은 이름 함수와
         겹쳐 **게임에서만** 조용히 E8 것이 불렸던 적이 있습니다(닭 조각 3개가 나옴).
         위 파일 읽는 순서(E5 → E8)와 짝이 되는 검사입니다. */
/* ⚠️ 아직 아무것도 안 올린 판(units 전부 placed:false)으로 봅니다. 카드는 **안 올린
      자루만** 그리므로, 위 cookData(다 올린 판)를 넘기면 카드가 비어 나옵니다. */
const card=api.twoSideIngredientMarkup(api.TWO_SIDE_VIEW.skewer.ingredients[0],api.createTwoSideData("skewer",{}));
// ⚠️ 닫는 따옴표까지 넣어 찾지 마세요 — 그림이 없을 때 붙는 no-art 자리 때문에 클래스가 한 칸 더 깁니다
assert(card.includes('class="ts-ing-skewers'),
  `재료 카드가 꼬치 쌓기를 안 씁니다 (다른 파일의 같은 이름 함수에 덮였는지 보세요): ${card.slice(0,160)}`);
const cardRacks=card.split('class="grill-skewer').slice(1);
assert(cardRacks.length===api.SKEWER_BATCH_SIZE,`재료 카드의 꼬치가 ${api.SKEWER_BATCH_SIZE}자루가 아닙니다 (${cardRacks.length}자루).`);
cardRacks.forEach((rack,index)=>{
  const stacked=[...rack.matchAll(/class="gs-piece(?: has-cook-art)? (chicken|greenOnion)"/g)].map(match=>match[1]);
  assert(same(stacked,[...assembled[index]].reverse()),`재료 카드 ${index+1}번 꼬치가 꽂은 순서와 다릅니다: ${stacked.join(",")}`);
});
// 재료 칸은 늘 안 익은 상태입니다 (익힘 5장이 섞이면 카드가 구워집니다)
assert(!card.includes("has-cook-art"),"재료 카드에 익힘 단계 그림이 섞여 들어갔습니다.");

console.log(`SKEWER_DAY_TO_NIGHT_CONTRACT_OK ${api.SKEWER_BATCH_SIZE} skewers x ${api.SKEWER_SLOT_COUNT} slots · 익힘 ${rawFrames.length}단계 · 재료 카드 ${cardRacks.length}자루`);
