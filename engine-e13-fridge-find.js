"use strict";

/* ============================================================
   E13 냉장고 재료 찾기 — 24칸에서 오늘 필요한 재료를 눈으로 찾아 클릭

   메뉴 선택 뒤, 낮 준비에 들어가기 전에 실행되는 독립 미니게임입니다.
   화면과 재료 데이터는 ingredient-select.js 가 맡고, 이 파일은
   "칸 채우기 · 클릭 판정 · 완료 판정 · 걸린 시간"만 관리합니다.

   [규칙]
   · 냉장고는 3행 x (4칸 | 4칸) = 24칸입니다. 가운데 세로 기둥으로 좌우가 갈립니다.
   · 오늘 필요한 재료가 **한 칸에 하나씩** 들어가고, 남는 칸은 오늘 안 쓰는 재료로 채웁니다.
   · 필요한 재료를 누르면 그 칸이 비고, 아닌 것을 누르면 안내만 나옵니다(실패 없음).
   · 필요한 재료를 모두 찾으면 끝납니다. 제한시간은 없고 **걸린 시간**만 잽니다.

   [옛 정렬 퍼즐]
   원래 같은 재료 3개를 한 칸에 모으는 퍼즐(engine-e13-fridge-sort.js)이었습니다.
   플레이 방식을 통째로 바꾸면서 그 파일은 지웠습니다. 세이브에 남아 있는 옛
   상태는 e13NormalizeProgress 가 형태를 못 맞춰 새 판으로 되돌립니다.
   ============================================================ */

const E13_FRIDGE_FIND=Object.freeze({
  id:"E13",
  rows:3,          // 선반 3단
  half:4,          // 한쪽 문 안에 4칸
  columns:8,       // 4 | 4
  slotCount:24,    // rows x columns
  missPenalty:3    // 엉뚱한 재료를 누르면 걸린 시간에 더해지는 초
});

/* 칸 번호(0~23) → 격자 자리.
   격자에는 **선반 두께와 가운데 기둥이 빈 줄로 들어 있습니다**(냉장고 그림의
   실측 자리를 그대로 쓰기 때문입니다 — css/ingredient-select.css 의 .fridge-slots).
     열  1~4 왼쪽 칸 · 5 가운데 기둥 · 6~9 오른쪽 칸
     행  1 첫째 단 · 2 선반 · 3 둘째 단 · 4 선반 · 5 셋째 단
   그래서 행은 2칸씩, 오른쪽 열은 한 칸 건너뜁니다. */
function e13SlotCell(index){
  const row=Math.floor(index/E13_FRIDGE_FIND.columns),column=index%E13_FRIDGE_FIND.columns;
  return {row:row*2+1,column:column<E13_FRIDGE_FIND.half?column+1:column+2,side:column<E13_FRIDGE_FIND.half?"left":"right"};
}

/* 24칸을 채웁니다.
   필요한 재료는 하나씩만 넣습니다 — 같은 재료가 두 칸에 있으면
   "찾아야 할 재료 4개인데 5번 눌러야" 같은 어긋남이 생깁니다.
   방해 재료는 종류가 모자라면 다시 돌려 씁니다(같은 재료가 여러 칸에 보일 수 있음). */
function e13BuildSlots(requiredIds=[],fillerIds=[]){
  const required=[...new Set(requiredIds)].slice(0,E13_FRIDGE_FIND.slotCount);
  const fillers=[...new Set(fillerIds)].filter(id=>!required.includes(id));
  const slots=[...required];
  for(let index=0;slots.length<E13_FRIDGE_FIND.slotCount;index+=1){
    if(!fillers.length)break;
    slots.push(fillers[index%fillers.length]);
  }
  // 방해 재료가 한 종류도 없으면(있을 수 없지만) 빈 칸으로 남깁니다.
  while(slots.length<E13_FRIDGE_FIND.slotCount)slots.push(null);
  return shuffle(slots);
}

function e13CreateProgress(requiredIds=[],fillerIds=[]){
  const required=[...new Set(requiredIds)];
  return {
    engine:E13_FRIDGE_FIND.id,
    required,
    found:[],
    slots:e13BuildSlots(required,fillerIds),
    misses:0,
    elapsed:0
  };
}

/* 저장된 상태가 지금 메뉴와 맞는지 봅니다.
   한 군데라도 어긋나면(옛 퍼즐 세이브 포함) 새 판으로 돌립니다 — 냉장고는
   되돌리기가 없는 게임이라 어중간하게 고쳐 쓰는 것보다 다시 채우는 쪽이 낫습니다. */
function e13ValidSlots(slots,required,found){
  if(!Array.isArray(slots)||slots.length!==E13_FRIDGE_FIND.slotCount)return false;
  if(slots.some(id=>id!==null&&typeof id!=="string"))return false;
  // 아직 못 찾은 재료는 반드시 냉장고 안에 딱 하나 있어야 합니다.
  return required.every(id=>{
    const count=slots.filter(slotId=>slotId===id).length;
    return found.includes(id)?count===0:count===1;
  });
}

function e13NormalizeProgress(saved,requiredIds=[],fillerIds=[]){
  const required=[...new Set(requiredIds)];
  const source=saved&&typeof saved==="object"?saved:{};
  const found=[...new Set(Array.isArray(source.found)?source.found:[])].filter(id=>required.includes(id));
  if(!e13ValidSlots(source.slots,required,found))return e13CreateProgress(required,fillerIds);
  return {
    engine:E13_FRIDGE_FIND.id,
    required,
    found,
    slots:[...source.slots],
    misses:Number.isFinite(source.misses)?source.misses:0,
    elapsed:Number.isFinite(source.elapsed)?Math.max(0,source.elapsed):0
  };
}

function e13RemainingIds(progress){
  return progress?progress.required.filter(id=>!progress.found.includes(id)):[];
}

function e13Complete(progress){
  return !!progress&&e13RemainingIds(progress).length===0;
}

/* 칸 하나를 누른 결과.
     found   오늘 필요한 재료였다 (칸이 비고 개수가 오릅니다)
     wrong   재료는 있는데 오늘 쓰지 않는다 → **걸린 시간에 3초가 붙습니다**
     empty   이미 비어 있는 칸이다
   실패(게임 오버)는 없습니다. 벌칙은 기록에 붙는 3초뿐입니다. */
function e13Pick(progress,slotIndex){
  if(!progress||!Number.isInteger(slotIndex)||slotIndex<0||slotIndex>=E13_FRIDGE_FIND.slotCount)return {result:"empty",id:null,complete:false,penalty:0};
  const id=progress.slots[slotIndex];
  if(!id)return {result:"empty",id:null,complete:e13Complete(progress),penalty:0};
  if(!progress.required.includes(id)||progress.found.includes(id)){
    progress.misses+=1;
    progress.elapsed+=E13_FRIDGE_FIND.missPenalty;
    return {result:"wrong",id,complete:e13Complete(progress),penalty:E13_FRIDGE_FIND.missPenalty};
  }
  progress.slots[slotIndex]=null;
  progress.found.push(id);
  return {result:"found",id,complete:e13Complete(progress),penalty:0};
}

/* 걸린 시간. 화면이 0.1초마다 불러 줍니다(제한시간이 아니라 기록입니다). */
function e13Tick(progress,seconds){
  if(!progress||e13Complete(progress))return false;
  progress.elapsed+=Math.max(0,seconds);
  return true;
}

/* 걸린 시간 표기. E10 멸치의 '남은 시간'과 같은 결로 **초 단위**입니다(12.3초).
   한 판이 길어야 1~2분이라 분을 따로 떼면 오히려 읽기 번거롭습니다. */
function e13TimeText(elapsed=0){
  return `${Math.max(0,elapsed).toFixed(1)}초`;
}
