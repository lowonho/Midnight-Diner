"use strict";

/* ============================================================
   E2 번갈아 입력 — 게임 2개

     감자 전분 털기                무작위 알파벳 두 개를 번갈아
     새우 튀김옷                   무작위 알파벳 두 개를 번갈아

   두 입력을 교대로 눌러 횟수를 채웁니다. 같은 입력을 두 번 하거나
   차례가 아닌 입력은 무시되고, 실패로 되돌아가지는 않습니다.

   [합쳐진 것 / 안 합쳐진 것]
   · "지금 차례인가 / 다음 차례로 넘긴다" 판정은 아래 도우미 두 개로 합쳤습니다.
     방향형(expected 에 방향 문자열)과 키형(keys 배열 + expectedIndex) 두 가지
     데이터 모양을 모두 다룹니다.
   · E12 채칼은 이 파일의 공용 진행 도우미와 3열 화면만 공유합니다.
     직접 잡기·포인터 캡처·대각선 왕복 판정은 engine-e12-grab-shake.js가 맡습니다.
   · 준비 게임들은 화면 틀(재료 / 플레이 / 진행도·조작 3열)이 같아서
     renderFryPrepScreen 하나로 합쳤습니다. 가운데 플레이 그림만 게임별로
     따로 그립니다 — 채칼·봉투 흔들기·튀김옷은 그림이 완전히 다릅니다.

   [새우 튀김옷]
   밀가루 → 계란물 → 빵가루를 하나의 준비 작업에서 연속 진행합니다.
   각 단계가 바뀔 때 무작위 알파벳 쌍을 새로 뽑습니다.
   ============================================================ */

registerDayPrepSetup("potatoStarch",()=>setupPotatoStarchShake());
registerDayPrepSetup("shrimpCoat",taskId=>setupShrimpCoat(taskId));

const E2_FEEL_CONFIG=Object.freeze({
  pauseThresholdMs:1200,
  wrongLockMs:120,
  stageTransitionMs:450,
  completeDelayMs:600
});

/* ---- 공통 판정 규칙 ----------------------------------------
   데이터 모양이 두 가지입니다.
     방향형 : data.expected("left") + data.directions(["left","right"])
     키형   : data.keys(["a","d"])  + data.expectedIndex(0 또는 1)
   두 모양 다 아래 두 함수로 판정하고 넘깁니다. */

// 지금 눌러야 할 차례의 입력인가
function isAlternateTurn(data,input){
  if(data.keys)return String(input).toLowerCase()===data.keys[data.expectedIndex];
  return input===data.expected;
}

// 다음 차례를 반대쪽으로 넘깁니다
function advanceAlternateTurn(data,input){
  if(data.keys){data.expectedIndex=data.expectedIndex===0?1:0;return;}
  data.expected=data.directions.find(item=>item!==input)||data.directions[0];
}

/* ============================================================
   E12 공용 채칼 화면·진행 데이터 (양배추 · 당근 · 감자)

   ✅ 볶음우동 채칼과 감자튀김 채칼은 "움직이는 방향"만 다릅니다.
      세 채칼 모두 같은 E12 직접 조작 엔진과 이 공용 화면을 씁니다.
      mandolineTask 가 한 모양으로 맞춰 읽습니다.
        ← → : day-prep-minigames.js 의 DAY3_MANDOLINE_CONFIG
        ← → : day4-prep-data.js 의 DAY4_PREP_CONFIG.potatoMandoline

   화면은 컨셉 이미지와 같은 3열이고, 위쪽 renderFryPrepScreen 을 그대로
   씁니다. 가운데 채칼 그림(.md-scene)만 이 구역에서 그립니다.
   모양·크기는 css/day-prep-minigames.css 의 "채칼" 구역에 모여 있습니다.

   양배추를 다 썰면 화면을 닫지 않고 같은 자리에서 당근으로 이어집니다.
   그 순서가 MANDOLINE_CHAIN 이고, 왼쪽 재료 카드도 이 순서로 놓입니다.
   ============================================================ */

// 한 화면에서 이어서 써는 재료 묶음
const MANDOLINE_CHAIN=Object.freeze({
  yakisoba:["sliceYakisobaCabbage","sliceYakisobaCarrot"],
  fries:["sliceFriesPotato"]
});
const MANDOLINE_ARROWS=Object.freeze({left:"◀",right:"▶",up:"▲",down:"▼"});

// 받침이 있으면 "을", 없으면 "를" (당근을 / 양배추를)
function koObjectParticle(word){
  const code=String(word).charCodeAt(word.length-1);
  const hasFinal=code>=0xac00&&code<=0xd7a3&&(code-0xac00)%28!==0;
  return hasFinal?"을":"를";
}

// 작업 하나의 설정을 한 모양으로 맞춰 돌려줍니다. 모르는 작업이면 null.
function mandolineTask(taskId){
  const yakisoba=DAY3_MANDOLINE_CONFIG[taskId];
  if(yakisoba)return {taskId,chain:"yakisoba",day:3,
    ingredient:yakisoba.ingredient,label:yakisoba.label,
    axis:"x",directions:["left","right"],totalInputs:yakisoba.cycles*2};
  const fries=DAY4_PREP_CONFIG.potatoMandoline;
  if(fries&&taskId===fries.taskId)return {taskId,chain:"fries",day:4,
    ingredient:fries.ingredient,label:fries.label,
    axis:"x",directions:[...fries.directions],totalInputs:fries.totalInputs};
  return null;
}

// 판 위에서 썰리는 재료 그림 장수 (food_*_whole_01~08). 01 이 안 썰린 모습입니다.
const MANDOLINE_WHOLE_FRAMES=8;

/* 판 위에서 썰리는 재료의 에셋 키. (경로는 day-prep-minigames.js 참고)

   세 재료 모두 **8장을 진행도에 나눠 씁니다.** 썰어야 하는 횟수가
   양배추 24 · 당근 20 · 감자 20 이라 장수와 딱 맞아떨어지지 않습니다.
   0% 가 01, 100% 가 08 이 되도록 고르게 나누므로 양배추는 대략 3.4 번에
   한 장, 당근·감자는 대략 2.9 번에 한 장씩 넘어갑니다.
   ⚠️ 한 번 누를 때마다 정확히 한 장씩 넘기려면 써는 횟수를 7 로 맞춰야
      합니다 — 그건 플레이 방식이 바뀌는 일이라 여기서는 안 했습니다
      (day-prep-minigames.js 의 DAY3_MANDOLINE_CONFIG.cycles). */
function mandolineFrameIndex(successInputs,totalInputs){
  const last=MANDOLINE_WHOLE_FRAMES-1;
  return Math.max(0,Math.min(last,Math.round(successInputs/Math.max(1,totalInputs)*last)));
}

function mandolineAssetKey(ingredient,successInputs=0,totalInputs=1){
  const frame=mandolineFrameIndex(successInputs,totalInputs);
  return `mandoline${ingredient.charAt(0).toUpperCase()}${ingredient.slice(1)}Whole${frame+1}`;
}

/* 장이 넘어갈 때마다 재료를 조금씩 아래로 밀어 주는 값 (1920 프레임 기준 px).
   순서대로 whole_01 ~ whole_08 입니다.

   ⚠️ **앞쪽 장들은 세로 길이가 똑같습니다** (양배추·감자 01~03 · 당근 01~04).
      밀어 주지 않으면 여러 번 눌러도 재료가 꼼짝하지 않다가 다음 장에서
      갑자기 내려앉습니다. 그래서 01→05 를 고르게 내려가게 하고, 06 부터는
      그림 자체가 크게 줄어드니 자리를 잡아 둡니다 (아래끝 고정).
   ⚠️ 값을 키우면 재료가 앞(아래쪽) 난간을 넘습니다 —
      css/day-prep-minigames.css 의 --md-ing-b 설명을 함께 보세요.
   ⚠️ **양배추·당근은 07·08 에서 다시 올립니다.** 그 두 장은 남은 조각이
      아주 얇은데, 24 를 그대로 두면 얇은 조각이 앞 난간 쪽으로 훅 꺼지듯
      내려앉아 보입니다. 감자는 마지막까지 두툼해서 그대로 둡니다. */
const MANDOLINE_FRAME_DRIFT=Object.freeze({
  cabbage:[0,6,12,18,24,24,16,8],
  carrot: [0,6,12,18,24,24,16,8],
  potato: [0,6,12,18,24,24,24,24]
});
const MANDOLINE_FRAME_DRIFT_DEFAULT=Object.freeze([0,6,12,18,24,24,24,24]);

function mandolineFrameDrift(ingredient,frame){
  const table=MANDOLINE_FRAME_DRIFT[ingredient]||MANDOLINE_FRAME_DRIFT_DEFAULT;
  return table[Math.min(frame,table.length-1)]||0;
}

// 왼쪽 재료 카드의 에셋 키. 판 위 그림과 **일부러 다른 키**입니다 —
// 카드는 재료 한 통을 통째로 보여 주고, 판 위는 썰리면서 줄어드는 그림이라
// 같은 파일을 쓸 수 없습니다.
function mandolineCardAssetKey(ingredient){
  return `mandolineCard${ingredient.charAt(0).toUpperCase()}${ingredient.slice(1)}`;
}

function setupMandoline(taskId,stageGrades=[]){
  const task=mandolineTask(taskId);
  if(!task||!state.mini||Number(state.day)<task.day)return;
  setDayPrepData(createAlternateFeelState({mode:"mandoline",...task,successInputs:0,expected:task.directions[0],stageGrades:[...stageGrades]}));
  dom.miniTitle.textContent=`${task.label} 채썰기`;
  dom.miniStation.textContent=`${task.label}${koObjectParticle(task.label)} 직접 잡고 채칼 방향으로 크게 왕복해 주세요!`;
  dom.miniDescription.textContent="재료를 잡아 왼쪽 위와 오른쪽 아래로 끝까지 왕복하세요. 방향키도 사용할 수 있습니다.";
  renderMandoline();
}

// E12 왕복 횟수를 두 배로 늘렸으므로 한 번에 떨어지는 가닥은 둘로 줄입니다.
// 최종 더미 양은 이전과 같게 유지되어 재료 양이 갑자기 두 배로 보이지 않습니다.
const MANDOLINE_SHREDS_PER_CUT=2;
// 채 그림 종류 수 (food_*_shredded_piece_01~03). 가닥마다 셋 중 하나를 씁니다.
const MANDOLINE_SHRED_SHAPES=3;

// 가운데 채칼 그림. 컨셉 이미지와 같은 한 장면입니다 —
// 다리 위에 비스듬히 얹힌 채칼 판, 그 아래 둥근 채반, 채반에 쌓이는 채, 큰 안내 화살표.
// 재료는 썰릴수록 짧아집니다.
// 전부 임시 CSS 도형이고, 에셋이 들어오면 .has-asset 이 붙어 그림으로 바뀝니다.
function mandolineSceneMarkup(data){
  const percent=Math.round(data.successInputs/data.totalInputs*100);
  const asset=dayPrepAssetMarkup(mandolineAssetKey(data.ingredient,data.successInputs,data.totalInputs),"md-ingredient-asset",`${data.label} 손질 ${percent}%`);
  // 그림이 있으면 깎인 모습이 그림 자체에 그려져 있으므로 줄이지 않습니다.
  // 임시 도형일 때만 진행도만큼 작게 그려 썰리는 시늉을 냅니다.
  const shorten=asset?1:Math.max(.34,1-percent/100*.62);
  // 장이 넘어갈 때마다 조금씩 아래로 밀어 줍니다 (위 MANDOLINE_FRAME_DRIFT 참고)
  const drift=asset?mandolineFrameDrift(data.ingredient,mandolineFrameIndex(data.successInputs,data.totalInputs)):0;
  // 썰린 채는 index 로 자리를 계산합니다 (Math.random 이면 누를 때마다 튑니다).
  // 황금각(2.39996rad)으로 돌려 가며 놓으면 가운데가 두껍고 가장자리가 성긴
  // 더미가 됩니다. 반지름은 index 18개마다 되풀이라 더미가 커져도 이미 놓인
  // 가닥은 제자리에 그대로 있습니다.
  // 방금 떨어진 마지막 묶음만 .fresh — 더미 전체에 떨어지는 시늉을 걸면 깜빡입니다.
  // 가닥 모양(p1~p3)은 index 로 돌려 씁니다. 굽은 정도가 셋 다 달라서
  // 회전값과 겹치면 같은 그림이 반복된다는 느낌이 나지 않습니다.
  const fresh=(data.successInputs-1)*MANDOLINE_SHREDS_PER_CUT;
  const shreds=Array.from({length:data.successInputs*MANDOLINE_SHREDS_PER_CUT},(_,index)=>{
    const angle=index*2.39996,radius=Math.sqrt((index%18+.5)/18);
    const shape=`p${index*5%MANDOLINE_SHRED_SHAPES+1}`;
    return `<i class="${shape} ${index>=fresh?"fresh":""}" style="--md-x:${(50+Math.cos(angle)*radius*40).toFixed(1)}%;--md-y:${(50+Math.sin(angle)*radius*29).toFixed(1)}%;--md-turn:${-34+(index*47)%68}deg"></i>`;
  }).join("");
  const plateAsset=dayPrepAssetMarkup("mandolinePlate","md-plate-asset","채칼");
  const basketAsset=dayPrepAssetMarkup("mandolineColander","md-basket-asset","채반");
  // 도마는 칸 배경으로 깔립니다 (css 의 "나무 도마" 구역) — 여기 조각이 없습니다.
  return `<div class="md-scene axis-${data.axis}" id="mandolineScene">
      <div class="md-basket ${basketAsset?"has-asset":""}" aria-hidden="true">${basketAsset}</div>
      <i class="md-legs right" aria-hidden="true"></i>
      <i class="md-legs left" aria-hidden="true"></i>
      <div class="md-pile ${data.ingredient}" aria-label="채 썬 ${data.label}">${shreds}</div>
      <div class="md-plate ${plateAsset?"has-asset":""}">
        ${plateAsset}<i class="md-blade" aria-hidden="true"></i><i class="md-drag-track" aria-hidden="true"></i>
        <div class="md-ingredient ${data.ingredient} ${asset?"has-asset":""}" id="mandolineIngredient" style="--md-shorten:${shorten};--md-ing-drift:${drift}">${asset}</div>
      </div>
    </div>`;
}

function renderMandoline(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="mandoline")return;
  const data=m.data,percent=Math.round(data.successInputs/data.totalInputs*100);
  // 왼쪽 재료 카드 = 이 화면에서 이어서 썰 재료들. 지금 재료가 밝게 표시됩니다.
  const chain=MANDOLINE_CHAIN[data.chain].map(mandolineTask).filter(Boolean);
  const done=chain.filter(item=>state.prepProgress?.[item.taskId]).length;
  // 공용 타이머 카드는 이 화면에서 숨기지만 내용은 계속 채워 둡니다.
  // (css/day-prep-minigames.css 의 숨김 한 줄만 지우면 그대로 다시 보입니다)
  dom.miniTimer.textContent=`${data.successInputs} / ${data.totalInputs}`;
  renderFryPrepScreen({
    // 재료가 하나뿐인 감자 화면에서는 금색 강조를 켜지 않습니다 —
    // 구분할 다른 카드가 없어서 "지금 이 차례"라는 뜻이 사라집니다.
    // (재료가 하나인 다른 화면들도 강조가 없습니다 — E5 김치전 굽기 참고)
    ingredients:chain.map(item=>({id:item.ingredient,label:item.label,count:1,
      asset:mandolineCardAssetKey(item.ingredient),
      active:chain.length>1&&item.taskId===data.taskId})),
    stage:mandolineSceneMarkup(data),
    done,
    total:chain.length,
    percent,
    keys:data.directions.map(direction=>({value:direction,glyph:MANDOLINE_ARROWS[direction]})),
    expectedIndex:data.directions.indexOf(data.expected),
    keyLink:"또는",
    controlName:"재료를 잡고<br />대각선으로 크게 왕복",
    phase:data.phase
  },direction=>mandolineInput(direction,false));
  bindMandolineDrag();
  updateMandolineDragPose(data);
}

function createAlternateFeelState(data){
  return {lastCorrectAt:0,interruptions:0,mistakes:0,stageGrades:[],inputLocked:false,transitioning:false,phase:"ready",...data};
}

function acceptAlternateInput(data,input,repeat=false,now=performance.now()){
  if(repeat||data.inputLocked||data.transitioning||data.phase==="complete")return {accepted:false,ignored:true};
  if(!isAlternateTurn(data,input))return {accepted:false,ignored:false};
  if(data.lastCorrectAt>0&&now-data.lastCorrectAt>E2_FEEL_CONFIG.pauseThresholdMs)data.interruptions++;
  data.lastCorrectAt=now;
  advanceAlternateTurn(data,input);
  return {accepted:true};
}

function alternateCompletionGrade(data){return data.mistakes===0&&data.interruptions===0?"perfect":"good";}

function resetAlternateGrade(data){data.lastCorrectAt=0;data.interruptions=0;data.mistakes=0;}

function rejectAlternateInput(m,message,targetSelector){
  const data=m.data;if(data.inputLocked||data.transitioning||data.phase==="complete")return false;
  data.mistakes++;data.lastCorrectAt=0;data.inputLocked=true;
  const scene=dom.miniContent.querySelector(".fp-scene"),target=targetSelector?dom.miniContent.querySelector(targetSelector):null;
  scene?.classList.add("input-wrong");target?.classList.add("input-wrong");
  dom.miniContent.querySelector(".fp-key.expected")?.classList.add("wrong");
  dom.miniFeedback.textContent=message;audio.bad();
  setTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    data.inputLocked=false;scene?.classList.remove("input-wrong");target?.classList.remove("input-wrong");
    dom.miniContent.querySelector(".fp-key.wrong")?.classList.remove("wrong");
  },E2_FEEL_CONFIG.wrongLockMs);
  return false;
}

function playAlternateSuccess(completing=false){
  if(completing)return;
  if(state.mini?.data?.mode==="mandoline")audio.play?.("mandoline_slide",{owner:state.mini});
  else audio.click();
}

function showAlternateGrade(grade){
  const result=dom.miniContent.querySelector("#e2Result");
  if(!result)return;
  result.textContent=grade==="perfect"?"PERFECT":"GOOD";
  result.className=`e2-result show ${grade}`;
}

function mandolineInput(direction,repeat=false,pointerDriven=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="mandoline")return false;
  const data=m.data;
  const result=acceptAlternateInput(data,direction,repeat);
  if(result.ignored)return false;
  if(!result.accepted)return rejectAlternateInput(m,`${MANDOLINE_ARROWS[data.expected]} 방향 차례입니다. 같은 키를 연속으로 누르지 마세요.`,"#mandolineScene");
  data.successInputs++;playAlternateSuccess(data.successInputs>=data.totalInputs);
  // 마지막 한 번도 화면에 반영한 뒤에 완료 처리합니다 (100% 가 보이고 넘어갑니다)
  renderMandoline();
  // 다시 그린 직후에 붙여야 애니메이션이 살아납니다 (튀김 준비의 흔들림과 같은 이유)
  const ingredient=dom.miniContent.querySelector("#mandolineIngredient");
  if(ingredient&&!pointerDriven){void ingredient.offsetWidth;ingredient.classList.add(`move-${direction}`);}
  dom.miniContent.querySelector(`[data-fry-prep-key="${direction}"]`)?.classList.add("pressed");
  if(data.successInputs>=data.totalInputs)finishMandolineStep(m);
  return true;
}

// 한 재료를 다 썰었을 때. 뒤에 이어질 재료가 있으면 화면을 닫지 않고 이어갑니다.
function finishMandolineStep(m){
  const data=m.data,chain=MANDOLINE_CHAIN[data.chain];
  const next=chain[chain.indexOf(data.taskId)+1];
  const stageGrade=alternateCompletionGrade(data);data.stageGrades.push(stageGrade);
  const finalGrade=data.stageGrades.every(grade=>grade==="perfect")?"perfect":"good";
  data.completionGrade=finalGrade;
  data.transitioning=true;data.inputLocked=true;data.phase=next?"transition":"complete";
  dom.miniContent.querySelector(".fp-scene")?.classList.add(next?"stage-complete":"e2-complete");
  showAlternateGrade(next?stageGrade:finalGrade);
  if(!next){
    dom.miniFeedback.textContent=`${data.label} 채썰기 ${finalGrade==="perfect"?"완벽하게 ":""}완료!`;
    setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(data.taskId,`${data.label} 채썰기 완료`);},E2_FEEL_CONFIG.completeDelayMs);
    return;
  }
  completeDayPrepTask(data.taskId);
  dom.miniTimer.textContent="완료";
  dom.miniFeedback.textContent=`${data.label} 채썰기 완료 · ${mandolineTask(next).label} 차례입니다.`;
  dom.miniContent.classList.add("prep-complete-flash");
  setTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    dom.miniContent.classList.remove("prep-complete-flash");
    setupMandoline(next,data.stageGrades);
  },E2_FEEL_CONFIG.stageTransitionMs);
}

/* ============================================================
   낮 준비 공용 3열 화면 — 채칼 · 감자튀김 준비 · 새우튀김 준비

   컨셉 이미지와 같은 3열 구성입니다.
     [재료 카드]  [플레이 영역]  [진행도 카드 · 조작 카드]

   세 게임은 이 틀이 같고, 가운데 그림과 조작 키만 다릅니다.
   그래서 틀은 여기서 한 번만 그리고, 가운데는 각 게임이 문자열로 넘깁니다.
   조작 키도 각 게임이 넘깁니다 — 튀김 준비는 랜덤 알파벳 두 개,
   채칼은 방향키 두 개입니다.

   [공용 프레임과의 관계]  멸치·닭꼬치·김치 볶기와 같습니다.
   ui-mini-frame.js 와 css/minigame-frame.css 는 건드리지 않습니다.
   css/day-prep-minigames.css 에서 .fp-scene 이 떠 있을 때만
     · .mini-content 의 가운데 열 제한(922px)을 풀어 좌우 칸 자리를 만들고
     · 오른쪽 진행도 카드와 겹치는 공용 타이머 카드(#miniTimer)를 숨기고
     · 타이틀 패널 윗줄(#miniStation)을 타이틀 아래 부제 자리로 내립니다.
   전부 이 화면 한정이라 다른 미니게임은 그대로입니다.
   ============================================================ */

// 재료 카드 한 장. 그림은 에셋이 들어오기 전까지 CSS 임시 도형입니다.
function fryPrepIngredientMarkup(item){
  const asset=item.asset?dayPrepAssetMarkup(item.asset,"fp-ing-asset",item.label):"";
  return `<div class="fp-ing-card ${item.id} ${item.active?"active":""}">
    <div class="fp-ing-art ${asset?"has-asset":""}"><i></i>${asset}</div>
    <p class="fp-ing-name">${item.label} <b>x${item.count}</b></p>
  </div>`;
}

// view = { ingredients, stage(가운데 마크업), done, total, percent,
//          keys, expectedIndex, keyLink, controlName, controlDesc }
// keys 는 문자열("a") 또는 {value,glyph} 입니다. 문자열이면 대문자로 보여 줍니다.
// controlName / controlDesc 는 비워 두면 그 줄이 아예 나오지 않습니다.
// onKey 는 화면 안 키 버튼을 눌렀을 때 호출할 입력 함수입니다(entry.value 를 넘김).
function renderFryPrepScreen(view,onKey){
  const keys=view.keys.map(entry=>typeof entry==="string"?{value:entry,glyph:entry.toUpperCase()}:entry);
  dom.miniContent.innerHTML=`
    <div class="fp-scene ${view.phase?`phase-${view.phase}`:""}">
      <div class="fp-col">
        <div class="fp-panel fp-ing-panel">
          <h3 class="fp-col-title starred">재료</h3>
          <div class="fp-ing-list">${view.ingredients.map(fryPrepIngredientMarkup).join("")}</div>
        </div>
      </div>
      <div class="fp-board">${view.stage}<span class="e2-result" id="e2Result" aria-live="polite"></span></div>
      <div class="fp-col">
        <div class="fp-panel fp-count">
          <h3 class="fp-col-title">진행도</h3>
          <strong><b>${view.done}</b> / ${view.total}</strong>
          <div class="fp-bar"><i style="width:${view.percent}%"></i></div>
        </div>
        <div class="fp-panel fp-control">
          <h3 class="fp-col-title">조작</h3>
          <div class="fp-keys">${keys.map((entry,index)=>`<button type="button" class="fp-key ${index===view.expectedIndex?"expected":""}" data-fry-prep-key="${entry.value}">${entry.glyph}</button>`).join(`<span class="fp-key-link" aria-hidden="true">${view.keyLink}</span>`)}</div>
          ${view.controlName?`<p class="fp-control-name">${view.controlName}</p>`:""}
          ${view.controlDesc?`<p class="fp-control-desc">${view.controlDesc}</p>`:""}
        </div>
      </div>
    </div>`;
  dom.miniContent.querySelectorAll("[data-fry-prep-key]").forEach(button=>button.addEventListener("click",()=>onKey(button.dataset.fryPrepKey)));
}

// 눌린 키 쪽으로 한 번 흔들립니다. 다시 그린 직후에 붙여야 애니메이션이 살아납니다.
function playFryPrepShake(selector,key,keys){
  const target=dom.miniContent.querySelector(selector);if(!target)return;
  const side=String(key).toLowerCase()===keys[0]?"left":"right";
  target.classList.remove("shake-left","shake-right");
  void target.offsetWidth;
  target.classList.add(`shake-${side}`);
}

/* ============================================================
   2. 감자튀김 준비 — 봉투를 흔들어 튀김가루 묻히기

   감자채가 담긴 봉투에 튀김가루를 넣고 랜덤키 두 개를 번갈아 연타해
   가루를 골고루 묻힙니다. 누를 때마다 봉투가 그 방향으로 흔들리고
   가루가 조금씩 더 붙습니다. 실패나 되돌아감은 없습니다.
   ============================================================ */

registerDayPrepEngine("potatoStarch",{
  key(m,k,e){
    if(/^[a-z]$/.test(k)){potatoStarchInput(k,e.repeat);return true;}
    return false;
  }
});

function setupPotatoStarchShake(){
  const config=DAY4_PREP_CONFIG.potatoStarch;if(Number(state.day)<4||!state.mini)return;
  const pair=BREADCRUMB_KEY_PAIRS[Math.floor(Math.random()*BREADCRUMB_KEY_PAIRS.length)];
  setDayPrepData(createAlternateFeelState({mode:"potatoStarch",taskId:config.taskId,keys:[...pair],expectedIndex:0,presses:0,total:config.requiredPresses}));
  dom.miniTitle.textContent="감자튀김 준비";
  dom.miniStation.textContent="봉투를 흔들어 튀김가루를 골고루 묻혀주세요!";
  dom.miniDescription.textContent=`${pair[0].toUpperCase()} / ${pair[1].toUpperCase()}를 빠르게 눌러 봉투를 흔들어주세요!`;
  renderPotatoStarchShake();
}

function potatoStarchInput(key,repeat=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="potatoStarch")return false;
  const data=m.data;
  const result=acceptAlternateInput(data,key,repeat);
  if(result.ignored)return false;
  if(!result.accepted)return rejectAlternateInput(m,`${data.keys[data.expectedIndex].toUpperCase()} 차례입니다. 같은 키를 연속으로 누르지 마세요.`,"#friesBagScene");
  data.presses++;
  const completed=data.presses>=data.total;
  playAlternateSuccess(completed);
  if(completed){data.transitioning=true;data.inputLocked=true;data.phase="complete";}
  // 마지막 한 번도 화면에 반영한 뒤에 완료 처리합니다 (100% 가 보이고 닫힙니다)
  renderPotatoStarchShake();
  playFryPrepShake("#friesBagScene",key,data.keys);
  dom.miniContent.querySelector(`[data-fry-prep-key="${key}"]`)?.classList.add("pressed");
  if(completed){
    const grade=alternateCompletionGrade(data);
    data.completionGrade=grade;
    dom.miniContent.querySelector(".fp-scene")?.classList.add("e2-complete");
    showAlternateGrade(grade);
    dom.miniFeedback.textContent=`감자채에 튀김가루가 ${grade==="perfect"?"완벽하게 ":"골고루 "}묻었습니다!`;
    setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(data.taskId,"감자튀김 튀김가루 묻히기 완료");},E2_FEEL_CONFIG.completeDelayMs);
  }
  return true;
}

// 봉투 안 감자채는 매번 같은 자리에 있어야 하므로 index 로 자리를 계산합니다.
// (Math.random 을 쓰면 키를 누를 때마다 감자가 순간이동합니다)
function friesBagMarkup(percent,stage){
  const sticks=Array.from({length:24},(_,index)=>`<i style="--fp-x:${8+(index%6)*13}%;--fp-y:${10+Math.floor(index/6)*20}%;--fp-turn:${-52+(index*37)%104}deg"></i>`).join("");
  const flourCount=Math.round(percent/100*26);
  const flour=Array.from({length:flourCount},(_,index)=>`<b style="--fp-x:${7+(index*37)%86}%;--fp-y:${9+(index*53)%78}%;--fp-size:${4+index%3}"></b>`).join("");
  const asset=dayPrepAssetMarkup(`friesShakeBag${stage}`,"fp-bag-asset",`튀김가루 묻히기 ${stage}%`);
  return `<div class="fp-bag-scene" id="friesBagScene">
    <i class="fp-wave left" aria-hidden="true"><b style="--fp-i:0"></b><b style="--fp-i:1"></b><b style="--fp-i:2"></b></i>
    <div class="fp-bag stage-${stage} ${asset?"has-asset":""}">
      ${asset}
      <i class="fp-bag-zip" aria-hidden="true"></i>
      <div class="fp-bag-fill" aria-hidden="true">${sticks}${flour}</div>
    </div>
    <i class="fp-wave right" aria-hidden="true"><b style="--fp-i:0"></b><b style="--fp-i:1"></b><b style="--fp-i:2"></b></i>
  </div>`;
}

function renderPotatoStarchShake(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="potatoStarch")return;
  const data=m.data,percent=Math.round(data.presses/data.total*100);
  const stage=DAY4_PREP_CONFIG.potatoStarch.stages.reduce((active,threshold)=>percent>=threshold?threshold:active,0);
  // 공용 타이머 카드는 이 화면에서 숨기지만 내용은 계속 채워 둡니다.
  // (css/day-prep-minigames.css 의 숨김 한 줄만 지우면 그대로 다시 보입니다)
  dom.miniTimer.textContent=`${data.presses} / ${data.total}`;
  renderFryPrepScreen({
    ingredients:[{id:"potatoStrips",label:"감자채",count:1,asset:"friesPotatoStrips"}],
    stage:friesBagMarkup(percent,stage),
    done:data.presses>=data.total?1:0,
    total:1,
    percent,
    keys:data.keys,
    expectedIndex:data.expectedIndex,
    keyLink:"→",
    controlName:"랜덤키 연타",
    controlDesc:`${data.keys[0].toUpperCase()} / ${data.keys[1].toUpperCase()}를 빠르게<br />눌러 흔들기`,
    phase:data.phase
  },key=>potatoStarchInput(key,false));
}

/* ============================================================
   3. 새우튀김 준비 — 밀가루 10회 → 계란물 8회 → 빵가루 12회

   화면에는 세 그릇이 순서대로 놓이고, 지금 차례인 그릇만 밝게 켜집니다.
   랜덤키 두 개를 번갈아 연타하면 새우가 그 안에서 굴러 옷이 입혀집니다.
   한 단계가 끝나면 같은 화면에서 다음 재료로 이어지고, 세 단계를 마치면 완료됩니다.
   ============================================================ */

registerDayPrepEngine("shrimpCoat",{
  key(m,k,e){
    if(/^[a-z]$/.test(k)){shrimpCoatInput(k,e.repeat);return true;}
    return false;
  }
});

function setupShrimpCoat(taskId){
  const item=SHRIMP_COAT_STEPS[0];
  if(Number(state.day)<3||taskId!==SHRIMP_COAT_TASK_ID||!item)return;
  const pair=BREADCRUMB_KEY_PAIRS[Math.floor(Math.random()*BREADCRUMB_KEY_PAIRS.length)];
  setDayPrepData(createAlternateFeelState({mode:"shrimpCoat",taskId,step:0,sequence:SHRIMP_COAT_STEPS,keys:[...pair],expectedIndex:0,successes:0,total:item.presses}));
  dom.miniTitle.textContent="새우튀김 준비";
  dom.miniStation.textContent="튀김가루, 계란물, 빵가루를 순서대로 묻혀주세요!";
  dom.miniDescription.textContent=`${pair[0].toUpperCase()} / ${pair[1].toUpperCase()}를 빠르게 눌러 ${item.label}를 묻혀주세요!`;
  renderShrimpCoat();
}

function shrimpCoatInput(key,repeat=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="shrimpCoat")return false;
  const data=m.data;
  const result=acceptAlternateInput(data,key,repeat);
  if(result.ignored)return false;
  if(!result.accepted)return rejectAlternateInput(m,`${data.keys[data.expectedIndex].toUpperCase()} 차례입니다. 같은 키를 연속으로 누르지 마세요.`,"#shrimpCoatStation");
  data.successes++;
  const stageComplete=data.successes>=data.total;
  const finalStage=stageComplete&&data.step>=data.sequence.length-1;
  playAlternateSuccess(stageComplete);
  if(stageComplete){data.transitioning=true;data.inputLocked=true;data.phase=finalStage?"complete":"transition";}
  // 마지막 한 번도 화면에 반영한 뒤에 완료 처리합니다 (다 입은 새우가 보이고 닫힙니다)
  renderShrimpCoat();
  playFryPrepShake("#shrimpCoatStation",key,data.keys);
  dom.miniContent.querySelector(`[data-fry-prep-key="${key}"]`)?.classList.add("pressed");
  if(stageComplete){
    const completed=data.sequence[data.step],stageGrade=alternateCompletionGrade(data);data.stageGrades.push(stageGrade);
    const finalGrade=data.stageGrades.every(grade=>grade==="perfect")?"perfect":"good";
    data.completionGrade=finalGrade;
    if(finalStage){
      dom.miniContent.querySelector(".fp-scene")?.classList.add("e2-complete");
      showAlternateGrade(finalGrade);
      dom.miniFeedback.textContent=`새우 튀김옷 ${finalGrade==="perfect"?"완벽하게 ":""}준비 완료!`;
      setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(data.taskId,"새우튀김 튀김옷 준비 완료");},E2_FEEL_CONFIG.completeDelayMs);
      return true;
    }
    dom.miniContent.querySelector(".fp-scene")?.classList.add("stage-complete");
    showAlternateGrade(stageGrade);
    dom.miniFeedback.textContent=`${completed.label} ${stageGrade==="perfect"?"PERFECT":"GOOD"} · 다음 코팅 재료로 넘어갑니다.`;audio.success();
    setTimeout(()=>{
      if(state.mini!==m||m.complete)return;
      data.step++;data.successes=0;data.total=data.sequence[data.step].presses;data.expectedIndex=0;data.transitioning=false;data.inputLocked=false;data.phase="ready";resetAlternateGrade(data);
      data.keys=[...BREADCRUMB_KEY_PAIRS[Math.floor(Math.random()*BREADCRUMB_KEY_PAIRS.length)]];
      dom.miniDescription.textContent=`${data.keys[0].toUpperCase()} / ${data.keys[1].toUpperCase()}를 빠르게 눌러 ${data.sequence[data.step].label}를 묻혀주세요!`;
      dom.miniFeedback.textContent=`새 키 ${data.keys.map(item=>item.toUpperCase()).join(" · ")}를 번갈아 누르세요.`;
      renderShrimpCoat();
    },E2_FEEL_CONFIG.stageTransitionMs);
  }
  return true;
}

// 새우 한 마리. coating 은 지금 입고 있는 옷, stage 는 0~3 (묻은 정도) 입니다.
function shrimpPieceMarkup(coating,stage){
  const assetKey={raw:"shrimpStateRaw",flour:"shrimpStateFlour",egg:"shrimpStateEgg",breadcrumbs:"shrimpStateBreadcrumbs"}[coating]||"shrimpStateRaw";
  const asset=dayPrepAssetMarkup(assetKey,"fp-shrimp-asset","새우");
  const crumbs=coating==="breadcrumbs"?Array.from({length:Math.ceil(stage/3*12)},(_,index)=>`<b style="--fp-x:${12+(index*29)%74}%;--fp-y:${16+(index*41)%62}%;--fp-turn:${index*23}deg"></b>`).join(""):"";
  return `<div class="fp-shrimp coating-${coating} stage-${stage} ${asset?"has-asset":""}">${asset}<i class="fp-shrimp-eye"></i>${crumbs}</div>`;
}

function shrimpCoatStageMarkup(data,percent){
  const stage=percent>=100?3:percent>=70?2:percent>=35?1:0;
  return `<div class="fp-coat-row">${data.sequence.map((item,index)=>{
    const status=index<data.step?"done":index===data.step?"current":"pending";
    const vesselAsset=dayPrepAssetMarkup(`shrimpVessel${item.id[0].toUpperCase()}${item.id.slice(1)}`,"fp-vessel-asset",item.label);
    // 지나온 그릇은 옷을 다 입은 새우, 지금 그릇은 진행 중, 다음 그릇은 비어 있습니다.
    const shrimp=index<data.step?shrimpPieceMarkup(item.id,3):index===data.step?shrimpPieceMarkup(item.id,stage):"";
    const sparks=status==="current"?`<div class="fp-sparks">${Array.from({length:10},(_,i)=>`<b style="--fp-turn:${i*36}deg;--fp-i:${i}"></b>`).join("")}</div>`:"";
    return `<div class="fp-coat-station ${item.id} ${status}" ${status==="current"?'id="shrimpCoatStation"':""} aria-label="${index+1}. ${item.label}">
      <div class="fp-vessel ${item.id} ${vesselAsset?"has-asset":""}">${vesselAsset}${shrimp}</div>
      ${sparks}
    </div>`;
  }).join('<i class="fp-coat-arrow" aria-hidden="true">→</i>')}</div>`;
}

function renderShrimpCoat(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="shrimpCoat")return;
  const data=m.data,current=data.sequence[data.step],percent=Math.round(data.successes/data.total*100);
  const overallPercent=Math.round((data.step+data.successes/data.total)/data.sequence.length*100);
  dom.miniTimer.textContent=`${percent}%`;   // 화면에서는 숨겨 둔 공용 카드입니다
  renderFryPrepScreen({
    // 지금 단계의 재료 한 줄만 밝게 켭니다.
    ingredients:[
      {id:"shrimpRaw",label:"생새우",count:1,asset:"shrimpStateRaw"},
      {id:"flour",label:"튀김가루",count:1,asset:"shrimpIngFlour",active:current.id==="flour"},
      {id:"egg",label:"계란물",count:1,asset:"shrimpIngEgg",active:current.id==="egg"},
      {id:"breadcrumbs",label:"빵가루",count:1,asset:"shrimpIngCrumbs",active:current.id==="breadcrumbs"}
    ],
    stage:shrimpCoatStageMarkup(data,percent),
    done:data.step,
    total:data.sequence.length,
    percent:overallPercent,
    keys:data.keys,
    expectedIndex:data.expectedIndex,
    keyLink:"·",
    controlName:"랜덤키 연타",
    controlDesc:`${data.keys[0].toUpperCase()} / ${data.keys[1].toUpperCase()}를 랜덤하게<br />빠르게 눌러 새우를<br />굴려주세요!`,
    phase:data.phase
  },key=>shrimpCoatInput(key));
}
