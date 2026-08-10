"use strict";

/* ============================================================
   E2 번갈아 입력 — 게임 2개

     감자 전분 털기                무작위 알파벳 두 개를 번갈아
     새우 튀김옷                   마우스로 잡고 좌우로 굴리기

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
   한 화면에는 한 재료만 놓고, 단계마다 새우 세 마리를 직접 굴립니다.
   ============================================================ */

registerDayPrepSetup("potatoStarch",()=>setupPotatoStarchShake());
registerDayPrepSetup("shrimpCoat",taskId=>setupShrimpCoat(taskId));

const E2_FEEL_CONFIG=Object.freeze({
  pauseThresholdMs:1200,
  wrongLockMs:120,
  stageTransitionMs:450,
  completeDelayMs:600,
  /* 새우 튀김옷 : 그림이 '다 묻은 모습'에 닿은 뒤에도 몇 번 더 굴려야 끝나는지.
     눈으로는 다 됐는데 손은 조금 더 가는, 마무리 손질 구간입니다.
     단계마다 처리할 새우 수는 day4-prep-data.js 의 SHRIMP_COAT_STEPS 에 있고,
     이 값은 한 마리를 굴릴 때의 마지막 구간만 조절합니다. */
  shrimpFinishRolls:2,
  /* 다 묻은 새우가 **스스로** 재료칸으로 돌아가는 데 걸리는 시간.
     다 됐다는 것을 한 박자 보여 주고(그릇 위에서 살짝 떠오름) 날아갑니다.
     ⚠️ css/minigame/e2-fry-prep.css 의 `fp-shrimp-return` 길이와 같아야 합니다.
        여기가 짧으면 날아가다 만 채로 사라지고, 길면 빈 그릇을 멀뚱히 봅니다. */
  shrimpReturnMs:420
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
  if(yakisoba)return {taskId,chain:"yakisoba",
    ingredient:yakisoba.ingredient,label:yakisoba.label,
    axis:"x",directions:["left","right"],totalInputs:yakisoba.cycles*2};
  const fries=DAY4_PREP_CONFIG.potatoMandoline;
  if(fries&&taskId===fries.taskId)return {taskId,chain:"fries",
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
  if(!task||!state.mini)return;
  setDayPrepData(createAlternateFeelState({mode:"mandoline",...task,successInputs:0,expected:task.directions[0],stageGrades:[...stageGrades]}));
  dom.miniTitle.textContent=`${task.label} 채썰기`;
  dom.miniStation.textContent=`${task.label}${koObjectParticle(task.label)} 직접 잡고 채칼 방향으로 크게 왕복해 주세요!`;
  dom.miniDescription.textContent="재료를 잡아 왼쪽 위와 오른쪽 아래로 끝까지 왕복하세요.";
  renderMandoline();
}

// 한 번 왕복할 때마다 채반에 늘어나는 채 가닥 수. 한 가닥씩만 늘리면
// 다 썰어도 채반이 휑해서, 컨셉 이미지처럼 수북해지도록 여러 가닥씩 놓습니다.
// 한 번 썰 때 우수수 떨어지는 맛이 나도록 열두 가닥입니다
// (E12 로 바뀌며 왕복 횟수가 두 배가 되었으니 양배추 24번 × 12 = 288 가닥).
// 더미가 퍼지는 넓이는 여기가 아니라 css/day-prep-minigames.css 의
// .md-pile 상자 크기가 정합니다 — 자리 계산의 반지름이 18개마다 되풀이라
// 가닥을 늘려도 밖으로 번지지 않고 그 상자 안이 촘촘해지기만 합니다.
const MANDOLINE_SHREDS_PER_CUT=12;
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
        ${plateAsset}<i class="md-blade" aria-hidden="true"></i>
        <div class="md-ingredient ${data.ingredient} ${asset?"has-asset":""}" id="mandolineIngredient" style="--md-shorten:${shorten};--md-ing-drift:${drift}">${asset}</div>
      </div>
    </div>`;
}

function renderMandoline(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="mandoline")return;
  const data=m.data,percent=Math.round(data.successInputs/data.totalInputs*100);
  // 왼쪽 재료 카드 = 이 화면에서 이어서 썰 재료들. 지금 재료가 밝게 표시됩니다.
  const chain=MANDOLINE_CHAIN[data.chain].map(mandolineTask).filter(Boolean);
  const done=chain.filter(item=>prepTaskCompleted(item.taskId)).length;
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
    // 키 버튼 줄 대신 마우스 그림입니다 — 키보드를 뺀 뒤로 직접 잡고 미는
    // 조작 하나만 남았는데도 ◀ ▶ 키캡이 남아 있어 방향키 게임처럼 보였습니다.
    // (감자 전분 털기·새우 굴리기와 같은 조작 카드입니다)
    controlMarkup:MANDOLINE_DRAG_CONTROL_MARKUP,
    controlName:"재료를 잡고<br />대각선으로 크게 왕복",
    controlDesc:"왼쪽 위와 오른쪽 아래로<br />끝까지 밀어 주세요",
    phase:data.phase
  });
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
  miniSetTimeout(()=>{
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
  // 문구는 밤 조리와 같은 "완벽해요! / 맛있어요!" 입니다 (day-prep-minigames.js).
  // 클래스는 그대로 등급 이름을 씁니다 — 색과 글자 크기는 e2-fry-prep.css 가 정합니다.
  result.textContent=dayPrepGradeText(grade);
  result.className=`e2-result show ${grade}`;
}

function mandolineInput(direction,repeat=false,pointerDriven=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="mandoline")return false;
  const data=m.data;
  const result=acceptAlternateInput(data,direction,repeat);
  if(result.ignored)return false;
  if(!result.accepted)return rejectAlternateInput(m,`${MANDOLINE_ARROWS[data.expected]} 방향 차례입니다. 반대쪽으로도 끝까지 밀어 주세요.`,"#mandolineScene");
  data.successInputs++;playAlternateSuccess(data.successInputs>=data.totalInputs);
  // 마지막 한 번도 화면에 반영한 뒤에 완료 처리합니다 (100% 가 보이고 넘어갑니다)
  renderMandoline();
  // 다시 그린 직후에 붙여야 애니메이션이 살아납니다 (튀김 준비의 흔들림과 같은 이유)
  const ingredient=dom.miniContent.querySelector("#mandolineIngredient");
  if(ingredient&&!pointerDriven){void ingredient.offsetWidth;ingredient.classList.add(`move-${direction}`);}
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
    miniSetTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(data.taskId,`${data.label} 채썰기 완료`);},E2_FEEL_CONFIG.completeDelayMs);
    return;
  }
  completeDayPrepTask(data.taskId);
  dom.miniTimer.textContent="완료";
  dom.miniFeedback.textContent=`${data.label} 채썰기 완료 · ${mandolineTask(next).label} 차례입니다.`;
  dom.miniContent.classList.add("prep-complete-flash");
  miniSetTimeout(()=>{
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

/* 조작 카드에 올라가는 "마우스를 잡고 좌우로" 그림입니다.
   키보드 없이 포인터로만 하는 준비 작업 두 개가 같은 그림을 씁니다 —
   새우 굴리기 · 봉투 흔들기. 둘 다 손이 하는 일이 "좌우로 크게 왕복"이라
   화살표도 ↔ 하나로 같습니다.
   (봉투는 대각선으로도 흔들 수 있지만 한 번으로 세는 기준은 가로 거리뿐이라
    ↔ 가 맞습니다 — FRIES_BAG_DRAG_CONFIG 쪽 설명 참고)
   그림 자체는 css/minigame/e2-fry-prep.css 의 .fp-drag-mouse 임시 도형입니다.

   채칼(diag)만 같은 그림을 눕혀서 씁니다 — 좌우가 아니라 채칼 날 방향
   (왼쪽 위 ↔ 오른쪽 아래)으로 왕복하니까요. 눕히는 각도는 css 쪽
   .fp-drag-control.diag 에 있습니다. 대각선 양방향 화살표(⤡)를 그대로 쓰지
   않은 것은 도트 글꼴에 그 글자가 없어 네모로 뜨기 때문입니다. */
function fryPrepDragControlMarkup(extraClass=""){
  return `<div class="fp-drag-control${extraClass?` ${extraClass}`:""}" aria-hidden="true"><i class="fp-drag-mouse"></i><b>↔</b></div>`;
}
const FRY_PREP_DRAG_CONTROL_MARKUP=fryPrepDragControlMarkup();
const MANDOLINE_DRAG_CONTROL_MARKUP=fryPrepDragControlMarkup("diag");

// view = { ingredients, stage(가운데 마크업), done, total, percent,
//          keys, expectedIndex, keyLink, controlMarkup, controlName, controlDesc }
// keys 는 문자열("a") 또는 {value,glyph} 입니다. 문자열이면 대문자로 보여 줍니다.
// controlName / controlDesc 는 비워 두면 그 줄이 아예 나오지 않습니다.
// ingredientsMarkup 을 주면 재료 카드 목록 대신 그 마크업이 통째로 들어갑니다 —
//   새우튀김 준비는 재료 카드가 아니라 굴릴 새우 세 마리를 놓습니다.
// onKey 는 화면 안 키 버튼을 눌렀을 때 호출할 입력 함수입니다(entry.value 를 넘김).
function renderFryPrepScreen(view,onKey){
  const keys=(view.keys||[]).map(entry=>typeof entry==="string"?{value:entry,glyph:entry.toUpperCase()}:entry);
  const ingredients=view.ingredientsMarkup!==undefined?view.ingredientsMarkup:
    `<div class="fp-ing-list">${(view.ingredients||[]).map(fryPrepIngredientMarkup).join("")}</div>`;
  const controlMarkup=view.controlMarkup!==undefined?view.controlMarkup:
    `<div class="fp-keys">${keys.map((entry,index)=>`<button type="button" class="fp-key ${index===view.expectedIndex?"expected":""}" data-fry-prep-key="${entry.value}">${entry.glyph}</button>`).join(`<span class="fp-key-link" aria-hidden="true">${view.keyLink}</span>`)}</div>`;
  dom.miniContent.innerHTML=`
    <div class="fp-scene ${view.phase?`phase-${view.phase}`:""}">
      <div class="fp-col">
        <div class="fp-panel fp-ing-panel">
          <h3 class="fp-col-title starred">재료</h3>
          ${ingredients}
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
          ${controlMarkup}
          ${view.controlName?`<p class="fp-control-name">${view.controlName}</p>`:""}
          ${view.controlDesc?`<p class="fp-control-desc">${view.controlDesc}</p>`:""}
        </div>
      </div>
    </div>`;
  if(onKey)dom.miniContent.querySelectorAll("[data-fry-prep-key]").forEach(button=>button.addEventListener("click",()=>onKey(button.dataset.fryPrepKey)));
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

   감자채가 담긴 봉투에 튀김가루를 넣고 좌우로 번갈아 흔들어 가루를
   골고루 묻힙니다. 흔드는 방법이 두 가지고 **둘 다 같은 한 번**입니다.
     · 랜덤키 두 개를 번갈아 연타
     · 봉투를 직접 잡고 좌우로 크게 왕복 (채칼과 같은 조작)
   흔들 때마다 봉투 그림이 다음 장으로 넘어가고 좌우에 물결이 뜹니다.
   실패나 되돌아감은 없습니다.
   ============================================================ */

/* ⚠️ 여기 있던 **키보드 조작(랜덤 알파벳 두 개 번갈아 치기)을 뺐습니다.**
   봉투를 잡고 흔드는 드래그와 같은 한 번이었는데, 두 가지가 있으면 안내를
   두 줄로 적어야 하고 화면에도 뜻 없는 글자 버튼 두 개가 올라갔습니다.
   이제 흔드는 방법은 드래그 하나입니다 (noKeyboard → mini-engine.js 참고).
   ⚠️ 안쪽 판정은 그대로 "두 개를 번갈아" 모형입니다 — data.keys 한 쌍이 여전히
      왼쪽/오른쪽 차례를 나타내고, 드래그가 그 차례의 값을 넣어 줍니다
      (bindFriesBagDrag 의 potatoStarchInput 호출부). 키를 되살리려면 여기에
      key(m,k,e) 를 되돌리기만 하면 됩니다. */
registerDayPrepEngine("potatoStarch",{noKeyboard:true});

function setupPotatoStarchShake(){
  const config=DAY4_PREP_CONFIG.potatoStarch;if(!state.mini)return;
  const pair=BREADCRUMB_KEY_PAIRS[Math.floor(Math.random()*BREADCRUMB_KEY_PAIRS.length)];
  setDayPrepData(createAlternateFeelState({mode:"potatoStarch",taskId:config.taskId,keys:[...pair],expectedIndex:0,presses:0,total:config.requiredPresses}));
  dom.miniTitle.textContent="감자튀김 준비";
  dom.miniStation.textContent="봉투를 잡고 흔들어 튀김가루를 골고루 묻혀주세요!";
  dom.miniDescription.textContent="봉투를 잡고 좌우·대각선으로 크게 흔드세요. 한 번 잡은 채 왕복할수록 가루가 골고루 묻습니다.";
  renderPotatoStarchShake();
}

/* pointerDriven = 봉투를 직접 끌어서 들어온 입력. 봉투는 이미 손에 붙어
   움직이는 중이라 키를 눌렀을 때의 흔들림 연출을 얹지 않습니다
   (css/day-prep-minigames.css 의 `.fp-bag.dragging` 이 그 애니메이션을 끕니다).
   tilt = 흔든 대각선의 기울기. 끌어서 흔들 때만 넘어오고(손이 지나간 방향),
   키로 흔들 때는 null 이라 아래 표에서 다음 각도를 꺼내 씁니다. */
function potatoStarchInput(key,repeat=false,pointerDriven=false,tilt=null){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="potatoStarch")return false;
  const data=m.data;
  const result=acceptAlternateInput(data,key,repeat);
  if(result.ignored)return false;
  if(!result.accepted)return rejectAlternateInput(m,"같은 쪽으로만 밀고 있어요. 반대쪽으로도 크게 흔들어 주세요.","#friesBagScene");
  data.presses++;
  const completed=data.presses>=data.total;
  audio.play?.("fries_starch_bag_shake",{owner:m,random:true});
  if(completed){data.transitioning=true;data.inputLocked=true;data.phase="complete";}
  // 마지막 한 번도 화면에 반영한 뒤에 완료 처리합니다 (100% 가 보이고 닫힙니다)
  renderPotatoStarchShake();
  setFriesShakeTilt(data,tilt);
  // 봉투가 기우는 쪽은 지금 차례(data.keys 의 앞/뒤)가 정합니다 — 키를 없앤 뒤에도
  // 이 한 쌍은 "왼쪽 차례 / 오른쪽 차례" 를 나타내는 안쪽 값으로 그대로 씁니다.
  playFryPrepShake("#friesBagScene",key,data.keys);
  if(completed){
    const grade=alternateCompletionGrade(data);
    data.completionGrade=grade;
    dom.miniContent.querySelector(".fp-scene")?.classList.add("e2-complete");
    showAlternateGrade(grade);
    dom.miniFeedback.textContent=`감자채에 튀김가루가 ${grade==="perfect"?"완벽하게 ":"골고루 "}묻었습니다!`;
    miniSetTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(data.taskId,"감자튀김 튀김가루 묻히기 완료");},E2_FEEL_CONFIG.completeDelayMs);
  }
  return true;
}

/* 봉투 그림 장수 (food_fries_coating_bag_01~09). 01 이 가루가 아직 바닥에
   깔린 처음이고 09 가 다 묻은 모습입니다.

   흔드는 횟수(14)와 장수(9)가 딱 맞아떨어지지 않습니다 — 채칼(MANDOLINE_WHOLE_FRAMES)
   과 같은 방식으로 0% 가 01, 100% 가 09 가 되도록 고르게 나누므로 대략 1.75 번에
   한 장씩 넘어갑니다. 횟수는 day4-prep-data.js 의 requiredPresses 이고, 그 값을
   9 로 맞추면 한 번에 정확히 한 장씩 넘어가지만 그건 플레이 방식이 바뀌는 일이라
   여기서는 안 했습니다. */
const FRIES_BAG_FRAMES=9;

function friesBagFrameIndex(presses,total){
  const last=FRIES_BAG_FRAMES-1;
  return Math.max(0,Math.min(last,Math.round(presses/Math.max(1,total)*last)));
}

/* 흔들 때 봉투 좌우에 뜨는 물결. **한 장에 좌우가 다 그려져 있고 가운데가
   비어 있어서** 봉투 뒤에 한 장만 깔면 양쪽이 동시에 뜹니다.
   세 장을 겹쳐 두고 CSS 가 차례로 켭니다 (화구 3장과 같은 방식이라
   자바스크립트 타이머가 없습니다 — 미니게임이 닫혀도 뒷정리할 것이 없습니다).
   그림이 없으면 예전의 CSS 활 도형(.fp-wave)으로 돌아갑니다. */
function friesShakeFxMarkup(){
  const frames=Array.from({length:3},(_,index)=>dayPrepAssetMarkup(`friesShakeFx${index+1}`,`fp-shake-fx-frame f${index+1}`,""));
  if(!frames[0])return "";
  return `<div class="fp-shake-fx" aria-hidden="true">${frames.join("")}</div>`;
}

/* 흔드는 대각선 축의 기울기 (세로 이동 / 가로 이동). 0 이면 정확히 좌우,
   음수면 왼쪽 위 ↔ 오른쪽 아래(↖↘), 양수면 왼쪽 아래 ↔ 오른쪽 위(↙↗) 입니다.
   키로 흔들 때는 한 번마다 다음 값으로 넘어가 축이 조금씩 기울어집니다 —
   늘 같은 각도로만 흔들면 자로 잰 것처럼 보입니다.
   ⚠️ Math.random 을 쓰지 않습니다. 같은 화면을 다시 그릴 때마다 각도가
      바뀌면 흔들다 만 봉투가 제자리에서 튑니다.
   ⚠️ **장수가 홀수(5)인 것이 중요합니다.** 흔드는 쪽은 왼쪽·오른쪽으로 번갈아
      바뀌는데, 표까지 짝수 주기로 부호가 번갈면 둘이 맞물려 봉투가 **매번
      위로만** 솟습니다. 홀수라 짝이 한 칸씩 밀리면서 위로 갔다 아래로 갔다 합니다. */
const FRIES_SHAKE_TILTS=Object.freeze([-.46,.34,.5,-.22,-.38]);

/* 기울기를 화면에 넘깁니다. 두 자리에 쓰입니다.
     --fp-tilt      봉투가 움직이는 대각선 (키로 흔들 때의 애니메이션)
     --fp-fx-turn   그 대각선에 맞춰 물결 이펙트를 돌리는 각도
   기울기(비율)를 각도로 바꾸는 계산은 여기서 합니다 — CSS 의 atan() 은
   크롬 111 이상에서만 되므로 자바스크립트 쪽이 안전합니다. */
function setFriesShakeTilt(data,tilt=null){
  const scene=dom.miniContent.querySelector("#friesBagScene");if(!scene)return;
  const slope=tilt===null?FRIES_SHAKE_TILTS[data.presses%FRIES_SHAKE_TILTS.length]:tilt;
  scene.style.setProperty("--fp-tilt",slope.toFixed(3));
  scene.style.setProperty("--fp-fx-turn",`${(Math.atan(slope)*180/Math.PI).toFixed(1)}deg`);
}

function friesWaveMarkup(side){
  return `<i class="fp-wave ${side}" aria-hidden="true"><b style="--fp-i:0"></b><b style="--fp-i:1"></b><b style="--fp-i:2"></b></i>`;
}

// 봉투 안 감자채는 매번 같은 자리에 있어야 하므로 index 로 자리를 계산합니다.
// (Math.random 을 쓰면 키를 누를 때마다 감자가 순간이동합니다)
// stage 는 임시 도형용 단계(0·35·70·100), frame 은 납품 그림의 장 번호(1~9)입니다.
function friesBagMarkup(percent,stage,frame){
  const sticks=Array.from({length:24},(_,index)=>`<i style="--fp-x:${8+(index%6)*13}%;--fp-y:${10+Math.floor(index/6)*20}%;--fp-turn:${-52+(index*37)%104}deg"></i>`).join("");
  const flourCount=Math.round(percent/100*26);
  const flour=Array.from({length:flourCount},(_,index)=>`<b style="--fp-x:${7+(index*37)%86}%;--fp-y:${9+(index*53)%78}%;--fp-size:${4+index%3}"></b>`).join("");
  const asset=dayPrepAssetMarkup(`friesShakeBag${frame}`,"fp-bag-asset",`튀김가루 묻히기 ${percent}%`);
  const fx=friesShakeFxMarkup();
  return `<div class="fp-bag-scene" id="friesBagScene">
    ${fx||friesWaveMarkup("left")}
    <div class="fp-bag stage-${stage} ${asset?"has-asset":""}" id="friesBag">
      ${asset}
      <i class="fp-bag-zip" aria-hidden="true"></i>
      <div class="fp-bag-fill" aria-hidden="true">${sticks}${flour}</div>
    </div>
    ${fx?"":friesWaveMarkup("right")}
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
    // 봉투 안에 함께 든 두 가지입니다. 어느 한쪽 차례가 있는 것이 아니라
    // 처음부터 같이 들어 있으므로 금색 강조는 켜지 않습니다 (감자 채칼과 같습니다).
    ingredients:[
      {id:"potatoStrips",label:"감자채",count:1,asset:"friesPotatoStrips"},
      {id:"fryingPowder",label:"튀김가루",count:1,asset:"friesFryingPowder"}
    ],
    stage:friesBagMarkup(percent,stage,friesBagFrameIndex(data.presses,data.total)+1),
    done:data.presses>=data.total?1:0,
    total:1,
    percent,
    // 키 버튼 줄 대신 마우스 그림입니다. 예전에는 여기에 랜덤 알파벳 두 개
    // (A / D 같은)가 키캡으로 올라갔고 키보드와 짝이었습니다. 키보드를 뺀 지금은
    // 눌러도 뜻이 없는 글자라, 실제 조작인 "마우스로 좌우" 그림으로 바꿨습니다.
    controlMarkup:FRY_PREP_DRAG_CONTROL_MARKUP,
    controlName:"봉투를 잡고<br />크게 흔들기",
    controlDesc:"좌우로 크게 왕복할수록<br />가루가 잘 묻습니다",
    phase:data.phase
  });
  bindFriesBagDrag();
  updateFriesBagDragPose(data);
}

/* ---- 봉투 직접 흔들기 (포인터) -----------------------------
   채칼(engine-e12-grab-shake.js 의 bindMandolineDrag)과 같은 결의 조작입니다.
   다만 채칼은 정해진 대각선 축 위로만 움직이는 반면, **봉투는 손이 가는 대로
   따라옵니다** — 가로세로 둘 다 따라가므로 ↖↘ 든 ↙↗ 든 원하는 대각선으로
   흔들 수 있습니다. 손에 든 봉지에 정해진 축이 있을 리 없으니까요.

   한 왕복이 아니라 한쪽 끝에 닿을 때마다 한 번으로 셉니다 — 봉투는 좌우로
   번갈아 흔드는 물건이라 그 편이 키 두 개를 번갈아 누르는 것과 정확히 같은
   셈이 됩니다. (그래서 판정은 그대로 potatoStarchInput 에 넘깁니다)
   ⚠️ **세는 기준은 가로로 간 거리뿐입니다.** 대각선으로 흔들면 그만큼 덜
      가로지르므로 조금 더 크게 흔들어야 한 번이 됩니다 — 위아래로만 흔드는
      것은 '흔들기'가 아니니 그건 세지 않는 것이 맞습니다.

   ⚠️ 흔들 때마다 가운데 그림을 다시 그리므로, 사라지는 봉투가 아니라 계속
      남아 있는 mini-content 에 포인터를 캡처해야 한 번 잡은 채 계속 흔들 수
      있습니다. 다시 그린 뒤 잡은 자세를 되돌려 주는 것이 아래 pose 함수입니다. */
const FRIES_BAG_DRAG_CONFIG=Object.freeze({
  travelRatio:.16,        // 한 번으로 치는 가로 거리 (봉투 폭 대비)
  /* 손을 따라 봉투가 밀려나는 한계 (가로는 봉투 폭, 세로는 봉투 높이 대비).
     크게 흔드는 맛이 나야 하는 조작이라 **조리대 밖으로 나가는 것을 허용합니다** —
     .fp-board 는 넘치는 것을 자르지 않아 봉투가 재료·진행도 칸 위로 지나갑니다.
     ⚠️ 가로 한계는 한 번으로 치는 거리(travelRatio .16)보다 커야 합니다.
        작으면 봉투가 먼저 멈춘 뒤에야 한 번으로 세어져 손이 헛도는 느낌이 납니다.
     ⚠️ **세로는 플레이 영역이 먼저 막습니다.** .mini-stage 는 overflow:hidden 이라
        거기를 넘으면 봉투가 밀려나는 게 아니라 잘립니다.
     실측 (tools/e2-fries-bag-visual-smoke.html?drag=max&dragy=max 의 data-measure.reach,
     1920 창 · 봉투 509.2 x 409.2 · 조리대 749.2 x 557.3):
       가로 .34 → 173.1px : 조리대를 53.1 넘고도 플레이 영역까지 225.4 남습니다
       세로 .22 →  90.0px : 조리대를 16 넘고 플레이 영역 위아래로 3.8 남습니다 (.28 은 20.8 잘림) */
  visualLimitRatio:.34,
  visualLimitRatioY:.22,
  /* 이펙트가 따라 도는 각도의 한계 (0.5 = 약 27도). 아래 friesBagDragTilt 참고.
     ⚠️ 더 키우면 돌아간 이펙트(760x228)가 도마(788.2 x 573.2) 밖으로 나갑니다 —
        .fp-board 는 넘치는 것을 자르지 않아서 액자 위에 그려집니다. */
  tiltLimit:.5
});

function friesBagDragDistance(size,ratio){
  return Math.max(1,(size||0)*ratio);
}

/* 끄는 동안 흔들림 이펙트가 뜰 대각선 축. 손이 실제로 지나간 방향을 그대로
   씁니다 — 키로 흔들 때의 --fp-tilt 와 같은 자리에 들어갑니다.
   가로로 거의 안 움직였을 때(세로로만 끌 때)는 0 으로 두어 축이 곤두서지 않게 합니다. */
function friesBagDragTilt(dx,dy){
  if(Math.abs(dx)<1)return 0;
  return clamp(dy/dx,-FRIES_BAG_DRAG_CONFIG.tiltLimit,FRIES_BAG_DRAG_CONFIG.tiltLimit);
}

function updateFriesBagDragPose(data){
  const drag=data?.drag,bag=dom.miniContent.querySelector("#friesBag");
  if(!bag||!drag||drag.kind!=="friesBag")return;
  bag.style.setProperty("--fp-drag-x",`${drag.position.toFixed(2)}px`);
  bag.style.setProperty("--fp-drag-y",`${drag.positionY.toFixed(2)}px`);
  bag.classList.add("dragging");
}

function clearFriesBagDrag(m,pointerId=null){
  const drag=m?.data?.drag;if(!drag||drag.kind!=="friesBag"||(pointerId!==null&&drag.pointerId!==pointerId))return;
  m.data.drag=null;
  const bag=dom.miniContent.querySelector("#friesBag");
  bag?.classList.remove("dragging");
  bag?.style.removeProperty("--fp-drag-x");
  bag?.style.removeProperty("--fp-drag-y");
}

function bindFriesBagDrag(){
  const surface=dom.miniContent;if(surface.__friesBagDragBound)return;
  surface.__friesBagDragBound=true;
  const playable=m=>isDayPrepMini(m)&&!m.complete&&m.data.mode==="potatoStarch";
  surface.addEventListener("pointerdown",event=>{
    const bag=event.target?.closest?.("#friesBag"),m=state.mini;
    if(!bag||!surface.contains(bag)||!playable(m)||m.data.inputLocked||m.data.transitioning||m.data.phase==="complete")return;
    if(event.pointerType==="mouse"&&event.button!==0)return;
    event.preventDefault();
    const rect=bag.getBoundingClientRect();
    m.data.drag={kind:"friesBag",pointerId:event.pointerId,
      startX:event.clientX,startY:event.clientY,position:0,positionY:0,
      step:friesBagDragDistance(rect.width,FRIES_BAG_DRAG_CONFIG.travelRatio),
      limit:friesBagDragDistance(rect.width,FRIES_BAG_DRAG_CONFIG.visualLimitRatio),
      limitY:friesBagDragDistance(rect.height,FRIES_BAG_DRAG_CONFIG.visualLimitRatioY)};
    try{surface.setPointerCapture?.(event.pointerId);}catch{}
    updateFriesBagDragPose(m.data);
  });
  surface.addEventListener("pointermove",event=>{
    const m=state.mini,drag=m?.data?.drag;
    if(!playable(m)||!drag||drag.kind!=="friesBag"||drag.pointerId!==event.pointerId)return;
    event.preventDefault();
    if(m.data.inputLocked||m.data.transitioning||m.data.phase==="complete")return;
    const moved=event.clientX-drag.startX,movedY=event.clientY-drag.startY;
    drag.position=clamp(moved,-drag.limit,drag.limit);
    drag.positionY=clamp(movedY,-drag.limitY,drag.limitY);
    updateFriesBagDragPose(m.data);
    // 지금 차례인 쪽 — 키 두 개의 차례가 그대로 왼쪽 / 오른쪽입니다
    // (연타할 때 봉투가 기우는 방향과 같습니다 — playFryPrepShake 참고)
    const toLeft=m.data.expectedIndex===0;
    if(toLeft?moved<=-drag.step:moved>=drag.step){
      // 이펙트는 손이 지나간 대각선을 따라 뜹니다 (키로 흔들 때는 정해진 표를 씁니다)
      potatoStarchInput(m.data.keys[m.data.expectedIndex],false,true,friesBagDragTilt(moved,movedY));
      if(m.data.transitioning||m.data.phase==="complete")clearFriesBagDrag(m,event.pointerId);
    }
  });
  const finish=event=>{
    const m=state.mini,drag=m?.data?.drag;
    if(!drag||drag.kind!=="friesBag"||drag.pointerId!==event.pointerId)return;
    clearFriesBagDrag(m,event.pointerId);
    try{if(surface.hasPointerCapture?.(event.pointerId))surface.releasePointerCapture?.(event.pointerId);}catch{}
  };
  surface.addEventListener("pointerup",finish);
  surface.addEventListener("pointercancel",finish);
  surface.addEventListener("lostpointercapture",finish);
  surface.addEventListener("dragstart",event=>{if(event.target?.closest?.("#friesBag"))event.preventDefault();});
}

/* ============================================================
   3. 새우튀김 준비 — 밀가루 → 계란물 → 빵가루, 단계마다 세 마리

   왼쪽 재료칸에는 밀가루·계란물·빵가루 카드가 아니라 **이번 단계에 굴릴
   새우 세 마리**가 놓입니다. 어느 옷을 입히는 중인지는 가운데 그릇 그림과
   단계 표시가 말해 주므로 재료 카드를 따로 둘 자리가 없습니다
   (E6 튀기기의 왼쪽 '재료' 칸과 같은 결입니다 — 거기도 튀길 것만 늘어놓습니다).

   한 마리의 흐름은 세 걸음입니다.
     1) 재료칸의 새우를 잡아 가운데 그릇으로 끌어다 놓기   ← 손으로 합니다
     2) 그릇 안에서 좌우로 굴려 옷을 다 묻히기            ← 손으로 합니다
     3) 다 묻으면 새우가 스스로 재료칸으로 돌아갑니다     ← 여기서 한 마리 완료
   세 마리를 전부 되돌려 놓아야 다음 그릇으로 넘어갑니다.

   판 위에는 늘 새우가 한 마리뿐입니다(data.board). 그래서 재료칸 세 칸의
   상태를 따로 들고 있지 않고 진행도(successes) 하나에서 그대로 나옵니다.
     index < successes    done     다 묻혀 도로 갖다 놓은 새우
     index === successes  ready    지금 꺼낼 차례 (판에 나가 있으면 out)
     index > successes    pending  아직 차례가 아닌 새우

   [끌어다 놓기]  1) 은 E8 공용 배치기(bindOrderPlacementPointers)를 그대로
   씁니다 — 커서를 따라오는 유령(.order-drag-ghost)과 놓을 자리 표시
   (.order-drop-ready)가 E8 과 같은 클래스입니다. dragOnly 라 짧게 누르는
   자동 배치는 없습니다: 반드시 끌어다 놓아야 합니다.
   2) 의 굴리기만 이 파일이 직접 포인터를 잡습니다 — 잡은 채 계속 굴려야 해서
   요소가 아니라 mini-content 에 포인터를 캡처합니다.
   3) 은 손을 쓰지 않습니다. 다 묻는 순간 새우가 날아가는 연출(.returning)이
   돌고, 그 길이(E2_FEEL_CONFIG.shrimpReturnMs)만큼 뒤에 재료칸에 놓입니다.
   ============================================================ */

registerDayPrepEngine("shrimpCoat",{
  key(){return false;}
});

const SHRIMP_ROLL_CONFIG=Object.freeze({requiredTravelRatio:2.2,visualLimitRatio:.32});
// 코팅 재료 id → 재료별 굴리는 소리 (day4-prep-data.js 의 SHRIMP_COAT_STEPS.id 와 같은 이름)
const SHRIMP_COAT_SFX=Object.freeze({flour:"shrimp_flour_coat",egg:"shrimp_egg_coat",breadcrumbs:"shrimp_crumb_coat"});
const SHRIMP_COAT_GAIN=Object.freeze({flour:1,egg:1,breadcrumbs:1});

function playShrimpCoatSfx(m){
  const data=m?.data,id=data?.sequence?.[data.step]?.id,name=SHRIMP_COAT_SFX[id];
  if(!name)return;
  if(data.coatSfx)audio.stopFile?.(data.coatSfx);
  data.coatSfx=audio.play?.(name,{owner:m,gain:SHRIMP_COAT_GAIN[id]??.8})||null;
}

/* 새우 그림 10장이 앉는 자리 (경로는 day-prep-minigames.js 의 DAY_PREP_ASSET_PATHS).
   [0] 은 "아직 이 옷을 안 입은 모습" 이라 직전 단계의 다 묻은 장을 그대로 씁니다.
   그래서 재료칸에서 꺼낸 새우와 그릇에 막 놓은 새우가 같은 그림이고,
   되돌려 놓은 새우는 [3] — 다음 단계 재료칸의 [0] 과 또 같은 그림입니다. */
const SHRIMP_STATE_KEYS=Object.freeze({
  flour:      ["shrimpStateRaw",    "shrimpStateFlour1", "shrimpStateFlour2", "shrimpStateFlour3"],
  egg:        ["shrimpStateFlour3", "shrimpStateEgg1",   "shrimpStateEgg2",   "shrimpStateEgg3"],
  breadcrumbs:["shrimpStateEgg3",   "shrimpStateCrumbs1","shrimpStateCrumbs2","shrimpStateCrumbs3"]
});

// 굴린 정도(0~1) → 그림 단계(0~3)
function shrimpRollStage(progress){
  return progress>=1?3:progress>=.7?2:progress>=.35?1:0;
}

function shrimpRollSoundStage(progress){
  return progress>=.8?4:progress>=.6?3:progress>=.4?2:progress>=.2?1:0;
}

function isShrimpCoatMini(m){
  return isDayPrepMini(m)&&!m.complete&&m.data.mode==="shrimpCoat";
}

// 지금 손을 쓸 수 있는 때인가 (단계 넘어가는 중·다 끝난 뒤에는 잠급니다)
function shrimpCoatPlayable(m){
  return isShrimpCoatMini(m)&&!m.data.inputLocked&&!m.data.transitioning&&m.data.phase!=="complete";
}

function setupShrimpCoat(taskId){
  const item=SHRIMP_COAT_STEPS[0];
  if(taskId!==SHRIMP_COAT_TASK_ID||!item)return;
  const data={mode:"shrimpCoat",taskId,step:0,sequence:SHRIMP_COAT_STEPS,successes:0,total:item.shrimpCount,
    board:null,drag:null,stageGrades:[],justCompleted:-1,inputLocked:false,transitioning:false,phase:"pick"};
  setDayPrepData(data);
  dom.miniTitle.textContent="새우튀김 준비";
  dom.miniStation.textContent="새우를 한 마리씩 꺼내 밀가루, 계란물, 빵가루를 차례로 묻혀주세요!";
  dom.miniDescription.textContent=shrimpCoatHelpText(data);
  renderShrimpCoat();
}

// 타이틀 아래 긴 안내 — 지금 무엇을 할 차례인지 한 줄로 말해 줍니다.
function shrimpCoatHelpText(data){
  const label=data.sequence[data.step].label;
  if(!data.board)return `재료칸의 새우를 잡아 ${label} 그릇으로 끌어다 놓으세요. 한 단계에 ${data.total}마리씩 준비합니다!`;
  if(data.board.coated)return "다 묻었습니다! 새우가 재료칸으로 돌아갑니다.";
  return `${label} 안에서 새우를 좌우로 여러 번 굴려주세요.`;
}

// 판 아래 짧은 안내 — 위와 같은 내용을 한 손짓으로 줄인 것입니다.
function shrimpCoatHintText(data){
  if(data.successes>=data.total)return `${data.sequence[data.step].label} 새우 ${data.total}마리 완료!`;
  if(!data.board)return "재료칸의 새우를 끌어다 그릇에 놓으세요";
  if(data.board.coated)return "다 묻었어요! 재료칸으로 돌아갑니다";
  return "새우를 잡은 채 좌우로 여러 번 굴려주세요";
}

/* ---- 왼쪽 재료칸 : 이번 단계에 굴릴 새우 세 마리 ---------- */

function shrimpTraySlotStatus(data,index){
  if(index<data.successes)return "done";
  if(index>data.successes)return "pending";
  return data.board?"out":"ready";
}

function shrimpTrayMarkup(data){
  const coating=data.sequence[data.step].id;
  const slots=Array.from({length:data.total},(_,index)=>{
    const status=shrimpTraySlotStatus(data,index);
    // 판에 나가 있는 한 칸만 비웁니다 — 새우가 어디서 나갔는지 자리가 남아 보입니다.
    const piece=status==="out"?'<i class="fp-tray-empty" aria-hidden="true"></i>'
      :shrimpPieceMarkup(coating,status==="done"?3:0,"fp-tray-shrimp");
    return `<li class="fp-tray-slot ${status} ${index===data.justCompleted?"fresh":""}" data-shrimp-slot="${index}"
      aria-label="새우 ${index+1} · ${status==="done"?"완료":status==="out"?"굴리는 중":"대기"}">${piece}</li>`;
  }).join("");
  return `<ul class="fp-shrimp-tray" id="shrimpTray" aria-label="새우 ${data.total}마리">${slots}</ul>`;
}

// 새우 한 마리. coating 은 지금 입고 있는 옷, stage 는 0~3 (묻은 정도) 입니다.
function shrimpPieceMarkup(coating,stage,extraClass="",attributes=""){
  const assetKey=SHRIMP_STATE_KEYS[coating]?.[stage]||"shrimpStateRaw";
  const asset=dayPrepAssetMarkup(assetKey,"fp-shrimp-asset","새우");
  // 임시 도형용 빵가루 알갱이. 납품 그림이 있으면 CSS 가 꺼 줍니다(.fp-shrimp.has-asset b).
  const crumbs=coating==="breadcrumbs"?Array.from({length:Math.ceil(stage/3*12)},(_,index)=>`<b style="--fp-x:${12+(index*29)%74}%;--fp-y:${16+(index*41)%62}%;--fp-turn:${index*23}deg"></b>`).join(""):"";
  return `<div class="fp-shrimp coating-${coating} stage-${stage} ${asset?"has-asset":""} ${extraClass}" ${attributes}>${asset}<i class="fp-shrimp-eye"></i>${crumbs}</div>`;
}

/* ---- 가운데 판 : 그릇 하나 ---------------------------------- */

function shrimpCoatStageMarkup(data){
  const current=data.sequence[data.step],board=data.board;
  const vesselAsset=dayPrepAssetMarkup(`shrimpVessel${current.id[0].toUpperCase()}${current.id.slice(1)}`,"fp-vessel-asset",current.label);
  const stages=data.sequence.map((item,index)=>`<span class="${index<data.step||(index===data.step&&data.successes>=data.total)?"done":index===data.step?"current":"pending"}"><i>${index+1}</i>${item.label}</span>`).join("");
  // 다 묻은 새우는 곧바로 재료칸으로 날아갑니다 — .returning 이 그 연출입니다.
  const shrimp=board?shrimpPieceMarkup(current.id,shrimpRollStage(board.progress),`fp-roll-shrimp ${board.coated?"returning":""}`,
    'id="shrimpRollShrimp" role="button" aria-label="새우를 잡고 좌우로 굴리기"'):"";
  return `<div class="fp-shrimp-roll-scene ${current.id} ${board?"has-shrimp":"empty"}" id="shrimpCoatScene">
    <div class="fp-roll-stage-track">${stages}</div>
    <div class="fp-roll-title"><small>${data.step+1}단계 / ${data.sequence.length}단계</small><strong>${current.label} 묻히기</strong></div>
    <div class="fp-roll-vessel ${current.id} ${vesselAsset?"has-asset":""}" id="shrimpCoatVessel">${vesselAsset}
      <div class="fp-roll-surface" id="shrimpRollSurface">${shrimp}</div>
    </div>
    <div class="fp-roll-meter"><i id="shrimpRollMeter" style="width:${Math.round((board?.progress||0)*100)}%"></i></div>
    <p class="fp-roll-hint">${shrimpCoatHintText(data)}</p>
  </div>`;
}

function renderShrimpCoat(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="shrimpCoat")return;
  const data=m.data,percent=Math.round(data.successes/data.total*100);
  dom.miniTimer.textContent=`${data.step+1}단계 · ${data.successes} / ${data.total}`;
  renderFryPrepScreen({
    ingredientsMarkup:shrimpTrayMarkup(data),
    stage:shrimpCoatStageMarkup(data),
    done:data.successes,
    total:data.total,
    percent,
    controlMarkup:FRY_PREP_DRAG_CONTROL_MARKUP,
    controlName:"새우를 꺼내<br />좌우로 굴리기",
    controlDesc:"다 묻으면 새우가 스스로<br />재료칸으로 돌아갑니다",
    phase:data.phase
  });
  bindShrimpCoatRoll();
  bindShrimpCoatCarry(data);
  updateShrimpRollPose(data);
}

/* ---- 1) 재료칸 → 그릇 끌어다 놓기 (E8 공용 배치기) ----------
   화면을 다시 그릴 때마다 요소가 새것이라 그때그때 다시 걸어 줍니다.
   걸리는 것은 "지금 꺼낼 차례" 한 칸뿐이고, 판에 새우가 나가 있는 동안에는
   아무것도 안 걸립니다 — 그때는 굴리기(아래)와 자동 복귀가 맡습니다. */
function bindShrimpCoatCarry(data){
  if(data.inputLocked||data.transitioning||data.phase==="complete"||data.board)return;
  const source=dom.miniContent.querySelector(".fp-tray-slot.ready");
  if(!source)return;
  bindOrderPlacementPointers({
    sources:[source],targetSelector:"#shrimpCoatVessel",ghostSelector:".fp-shrimp",
    itemFromSource:()=>"shrimp",dragOnly:true,
    onPlace:()=>putShrimpInVessel(state.mini),
    onMiss:()=>{dom.miniFeedback.textContent="새우를 잡은 채 그릇 안으로 끌어다 놓으세요.";}
  });
}

// 1) 재료칸 → 그릇
function putShrimpInVessel(m){
  if(!shrimpCoatPlayable(m)||m.data.board)return;
  const data=m.data;
  data.board={progress:0,position:0,turn:0,coated:false};
  data.phase="roll";data.justCompleted=-1;
  dom.miniDescription.textContent=shrimpCoatHelpText(data);
  dom.miniFeedback.textContent=`${data.sequence[data.step].label} 안에서 새우를 좌우로 굴려주세요.`;
  renderShrimpCoat();
}

/* 3) 그릇 → 재료칸. **한 마리가 끝나는 곳은 여기입니다.**
   다 묻은 뒤 날아가는 연출(.returning)이 끝나면 finishShrimpRoll 의 타이머가
   여기로 옵니다. 세 마리를 다 놓으면 다음 그릇으로 넘어갑니다.
   ⚠️ 여기서는 shrimpCoatPlayable 을 쓰면 안 됩니다 — 날아가는 동안 손을
      잠가 두므로(inputLocked) 스스로 걸려서 영영 안 놓입니다. */
function placeShrimpBackInTray(m){
  if(!isShrimpCoatMini(m)||m.data.phase==="complete"||!m.data.board?.coated)return;
  const data=m.data,stageComplete=data.successes+1>=data.total;
  data.board=null;data.successes++;data.justCompleted=data.successes-1;
  // 돌아가는 동안 잠가 둔 손을 다시 풉니다 (아래 단계 완료면 곧바로 다시 잠급니다)
  data.phase="pick";data.inputLocked=false;
  if(stageComplete){
    const finalStage=data.step>=data.sequence.length-1;
    data.stageGrades.push("perfect");data.completionGrade="perfect";
    data.transitioning=true;data.inputLocked=true;data.phase=finalStage?"complete":"transition";
  }
  dom.miniDescription.textContent=shrimpCoatHelpText(data);
  renderShrimpCoat();
  if(!stageComplete){
    dom.miniFeedback.textContent=`${data.sequence[data.step].label} 새우 ${data.successes} / ${data.total} 완료 · 다음 새우를 꺼내주세요.`;
    return;
  }
  const completed=data.sequence[data.step],finalStage=data.step>=data.sequence.length-1;
  dom.miniContent.querySelector(".fp-scene")?.classList.add(finalStage?"e2-complete":"stage-complete");
  const stageGrade=data.stageGrades.at(-1)||"perfect";
  showAlternateGrade(stageGrade);
  // 마지막 단계는 finishDayPrepTask가 최종 판정음을 재생하므로 두 번 겹치지 않게 합니다.
  if(!finalStage)audio.result(stageGrade);
  if(finalStage){
    dom.miniFeedback.textContent=`새우 ${data.total}마리 튀김옷 3단계 준비 완료!`;
    miniSetTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(data.taskId,"새우튀김 튀김옷 준비 완료");},E2_FEEL_CONFIG.completeDelayMs);
    return;
  }
  dom.miniFeedback.textContent=`${completed.label} ${data.total}마리 완료 · 다음 코팅 재료로 넘어갑니다.`;
  miniSetTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    data.step++;data.successes=0;data.total=data.sequence[data.step].shrimpCount;
    data.board=null;data.transitioning=false;data.inputLocked=false;data.phase="pick";data.justCompleted=-1;
    const next=data.sequence[data.step];
    dom.miniDescription.textContent=shrimpCoatHelpText(data);
    dom.miniFeedback.textContent=`${data.step+1}단계 · ${next.label}를 골고루 묻혀주세요.`;
    renderShrimpCoat();
  },E2_FEEL_CONFIG.stageTransitionMs);
}

/* ---- 2) 그릇 안에서 굴리기 ---------------------------------- */

/* 굴리는 동안에는 화면을 다시 그리지 않고 손만 따라갑니다.
   묻은 정도(stage)가 넘어갈 때 <img> 를 갈아 끼우는 것도 여기서 합니다 —
   옷이 묻어 가는 것은 색 보정이 아니라 그림 자체가 바뀌는 일이라
   클래스만 바꿔서는 아무 일도 안 일어납니다. */
function updateShrimpRollPose(data){
  const shrimp=dom.miniContent.querySelector("#shrimpRollShrimp"),meter=dom.miniContent.querySelector("#shrimpRollMeter");
  const board=data.board;
  if(shrimp&&board){
    shrimp.style.setProperty("--shrimp-roll-x",`${(board.position||0).toFixed(2)}px`);
    shrimp.style.setProperty("--shrimp-roll-turn",`${(board.turn||0).toFixed(1)}deg`);
    shrimp.classList.toggle("dragging",data.drag?.kind==="shrimpRoll");
    const stage=shrimpRollStage(board.progress);
    shrimp.classList.remove("stage-0","stage-1","stage-2","stage-3");shrimp.classList.add(`stage-${stage}`);
    const key=SHRIMP_STATE_KEYS[data.sequence[data.step].id]?.[stage],image=shrimp.querySelector(".fp-shrimp-asset");
    if(image&&key&&hasDayPrepAsset(key)&&image.getAttribute("src")!==dayPrepAssets[key].src)image.setAttribute("src",dayPrepAssets[key].src);
  }
  if(meter)meter.style.width=`${Math.round((board?.progress||0)*100)}%`;
}

function clearShrimpRollDrag(m,pointerId=null){
  const drag=m?.data?.drag;if(!drag||drag.kind!=="shrimpRoll"||(pointerId!==null&&drag.pointerId!==pointerId))return;
  m.data.drag=null;
  dom.miniContent.querySelector("#shrimpRollShrimp")?.classList.remove("dragging");
  dom.miniContent.querySelector("#shrimpCoatScene")?.classList.remove("rolling");
}

/* 다 묻었습니다. 새우는 손을 안 대도 스스로 재료칸으로 돌아갑니다 —
   여기서는 날아가는 연출만 켜고, 실제로 한 마리가 끝나는 것은 그 연출이
   끝난 뒤의 placeShrimpBackInTray 입니다.
   ⚠️ 돌아가는 동안 손을 잠급니다(inputLocked). 안 잠그면 날아가는 새우를
      다시 잡아 굴릴 수 있어서, 한 마리가 두 번 세어질 수 있습니다. */
function finishShrimpRoll(m,pointerId){
  const data=m.data;
  clearShrimpRollDrag(m,pointerId);
  data.board.progress=1;data.board.coated=true;data.board.position=0;data.board.turn=0;
  data.phase="return";data.inputLocked=true;
  dom.miniDescription.textContent=shrimpCoatHelpText(data);
  dom.miniFeedback.textContent="다 묻었습니다! 새우가 재료칸으로 돌아갑니다.";
  renderShrimpCoat();
  miniSetTimeout(()=>{if(state.mini===m&&!m.complete)placeShrimpBackInTray(m);},E2_FEEL_CONFIG.shrimpReturnMs);
}

function bindShrimpCoatRoll(){
  const surface=dom.miniContent;if(surface.__shrimpCoatDragBound)return;
  surface.__shrimpCoatDragBound=true;
  // 굴릴 수 있는 때 = 판에 새우가 있고 아직 다 안 묻었을 때뿐입니다.
  // 다 묻은 새우를 잡으면 굴리기가 아니라 되돌려놓기(위 공용 배치기)가 받습니다.
  const rollable=m=>shrimpCoatPlayable(m)&&m.data.board&&!m.data.board.coated;
  surface.addEventListener("pointerdown",event=>{
    const shrimp=event.target?.closest?.("#shrimpRollShrimp"),m=state.mini;
    if(!shrimp||!surface.contains(shrimp)||!rollable(m))return;
    if(event.pointerType==="mouse"&&event.button!==0)return;
    event.preventDefault();
    const rect=shrimp.closest(".fp-roll-surface")?.getBoundingClientRect()||shrimp.getBoundingClientRect();
    const limit=Math.max(32,rect.width*SHRIMP_ROLL_CONFIG.visualLimitRatio);
    m.data.board.position=clamp(m.data.board.position||0,-limit,limit);
    m.data.drag={kind:"shrimpRoll",pointerId:event.pointerId,lastX:event.clientX,limit,
      required:Math.max(1,rect.width*SHRIMP_ROLL_CONFIG.requiredTravelRatio)};
    try{surface.setPointerCapture?.(event.pointerId);}catch{}
    dom.miniContent.querySelector("#shrimpCoatScene")?.classList.add("rolling");updateShrimpRollPose(m.data);
  });
  surface.addEventListener("pointermove",event=>{
    const m=state.mini,drag=m?.data?.drag;
    if(!drag||drag.kind!=="shrimpRoll"||drag.pointerId!==event.pointerId||!rollable(m))return;
    event.preventDefault();
    const board=m.data.board,previous=board.position,next=clamp(previous+event.clientX-drag.lastX,-drag.limit,drag.limit);
    drag.lastX=event.clientX;board.position=next;
    const travelled=Math.abs(next-previous);
    const previousSoundStage=shrimpRollSoundStage(board.progress);
    board.progress=Math.min(1,board.progress+travelled/drag.required);
    board.turn=(board.turn+(next-previous)*.55)%360;
    updateShrimpRollPose(m.data);
    // 코팅 진행도(20% · 40% · 60% · 80%)를 지날 때만 한 번씩 재생합니다.
    // 빠르게 굴려도 이전 코팅음을 먼저 끄므로 같은 효과음이 겹치지 않습니다.
    if(shrimpRollSoundStage(board.progress)>previousSoundStage)playShrimpCoatSfx(m);
    if(board.progress>=1){
      try{if(surface.hasPointerCapture?.(event.pointerId))surface.releasePointerCapture?.(event.pointerId);}catch{}
      finishShrimpRoll(m,event.pointerId);
    }
  });
  const finish=event=>{
    const m=state.mini,drag=m?.data?.drag;
    if(!drag||drag.kind!=="shrimpRoll"||drag.pointerId!==event.pointerId)return;
    clearShrimpRollDrag(m,event.pointerId);
    if(isDayPrepMini(m))updateShrimpRollPose(m.data);
    try{if(surface.hasPointerCapture?.(event.pointerId))surface.releasePointerCapture?.(event.pointerId);}catch{}
  };
  surface.addEventListener("pointerup",finish);surface.addEventListener("pointercancel",finish);surface.addEventListener("lostpointercapture",finish);
  surface.addEventListener("dragstart",event=>{if(event.target?.closest?.("#shrimpRollShrimp"))event.preventDefault();});
}
