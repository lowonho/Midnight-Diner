"use strict";

/* ============================================================
   E2 번갈아 입력 — 게임 5개

     양배추 채썰기 · 당근 채썰기   ← → 를 번갈아
     감자 채썰기                   ← → 를 번갈아
     감자 전분 털기                무작위 알파벳 두 개를 번갈아
     새우 튀김옷                   무작위 알파벳 두 개를 번갈아

   두 입력을 교대로 눌러 횟수를 채웁니다. 같은 입력을 두 번 하거나
   차례가 아닌 입력은 무시되고, 실패로 되돌아가지는 않습니다.

   [합쳐진 것 / 안 합쳐진 것]
   · "지금 차례인가 / 다음 차례로 넘긴다" 판정은 아래 도우미 두 개로 합쳤습니다.
     방향형(expected 에 방향 문자열)과 키형(keys 배열 + expectedIndex) 두 가지
     데이터 모양을 모두 다룹니다.
   · 채칼 3개(양배추 · 당근 · 감자)는 방향만 다르고 나머지가 같아서
     엔진 · 시작함수 · 화면을 하나로 합쳤습니다.
   · 네 게임 모두 화면 틀(재료 / 플레이 / 진행도·조작 3열)이 같아서
     renderFryPrepScreen 하나로 합쳤습니다. 가운데 플레이 그림만 게임별로
     따로 그립니다 — 채칼·봉투 흔들기·튀김옷은 그림이 완전히 다릅니다.

   [새우 튀김옷]
   밀가루 → 계란물 → 빵가루를 하나의 준비 작업에서 연속 진행합니다.
   각 단계가 바뀔 때 무작위 알파벳 쌍을 새로 뽑습니다.
   ============================================================ */

// 채칼 두 종류(볶음우동 · 감자튀김)는 모두 ← → 입력을 씁니다.
registerDayPrepSetup("mandoline",taskId=>setupMandoline(taskId));
registerDayPrepSetup("potatoMandoline",taskId=>setupMandoline(taskId));
registerDayPrepSetup("potatoStarch",()=>setupPotatoStarchShake());
registerDayPrepSetup("shrimpCoat",taskId=>setupShrimpCoat(taskId));

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
   1. 채칼 — 방향키를 번갈아 (양배추 · 당근 · 감자)

   ✅ 볶음우동 채칼과 감자튀김 채칼은 "움직이는 방향"만 다릅니다.
      세 채칼 모두 같은 좌우 입력 엔진과 화면을 씁니다.
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

// 재료 그림 에셋 키. 감자만 손질 단계별로 11장(potatoMandoline0~10)이 있고,
// 나머지는 한 장씩입니다. (경로는 day-prep-minigames.js 참고)
function mandolineAssetKey(ingredient,successInputs=0){
  if(ingredient==="potato")return `potatoMandoline${successInputs}`;
  return `mandoline${ingredient.charAt(0).toUpperCase()}${ingredient.slice(1)}`;
}

registerDayPrepEngine("mandoline",{
  key(m,k){
    if(!k.startsWith("arrow"))return false;
    const direction=k.replace("arrow","");
    // 축이 다른 방향키(가로 채칼에서 ↑↓)는 이 게임이 쓰지 않습니다
    if(!m.data.directions.includes(direction))return false;
    mandolineInput(direction);
    return true;
  }
});

function setupMandoline(taskId){
  const task=mandolineTask(taskId);
  if(!task||!state.mini||Number(state.day)<task.day)return;
  setDayPrepData({mode:"mandoline",...task,successInputs:0,expected:task.directions[0]});
  const way=task.axis==="x"?"좌우로":"위아래로";
  dom.miniTitle.textContent=`${task.label} 채썰기`;
  dom.miniStation.textContent=`${way} 움직여 ${task.label}${koObjectParticle(task.label)} 채썰어주세요!`;
  dom.miniDescription.textContent=`${way} 방향키를 번갈아 눌러 채칼을 움직여 채썰어주세요!`;
  renderMandoline();
}

// 가운데 채칼 그림. 재료는 썰릴수록 짧아지고, 썰린 채는 옆에 쌓입니다.
// 전부 임시 CSS 도형이고, 에셋이 들어오면 .has-asset 이 붙어 그림으로 바뀝니다.
function mandolineSceneMarkup(data){
  const percent=Math.round(data.successInputs/data.totalInputs*100);
  const shorten=Math.max(.34,1-percent/100*.62);
  const asset=dayPrepAssetMarkup(mandolineAssetKey(data.ingredient,data.successInputs),"md-ingredient-asset",`${data.label} 손질 ${percent}%`);
  // 썰린 채는 index 로 자리를 계산합니다 (Math.random 이면 누를 때마다 튑니다)
  const shreds=Array.from({length:data.successInputs},(_,index)=>
    `<i style="--md-x:${8+(index%7)*12}%;--md-y:${7+(index%4)*21}%;--md-turn:${-20+(index%5)*10}deg"></i>`).join("");
  const plateAsset=dayPrepAssetMarkup("mandolinePlate","md-plate-asset","채칼");
  return `<div class="md-scene axis-${data.axis}" id="mandolineScene">
      <div class="md-plate ${plateAsset?"has-asset":""}">
        ${plateAsset}<i class="md-blade" aria-hidden="true"></i>
        <div class="md-ingredient ${data.ingredient} ${asset?"has-asset":""}" id="mandolineIngredient" style="--md-shorten:${shorten}">${asset}</div>
      </div>
      <div class="md-pile ${data.ingredient}" aria-label="채 썬 ${data.label}">${shreds}</div>
      <i class="md-hint" aria-hidden="true"></i>
    </div>`;
}

function renderMandoline(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="mandoline")return;
  const data=m.data,percent=Math.round(data.successInputs/data.totalInputs*100);
  // 왼쪽 재료 카드 = 이 화면에서 이어서 썰 재료들. 지금 재료가 밝게 표시됩니다.
  const chain=MANDOLINE_CHAIN[data.chain].map(mandolineTask).filter(Boolean);
  const done=chain.filter(item=>state.prepProgress?.[item.taskId]).length;
  const way=data.axis==="x"?"좌우로":"위아래로";
  // 공용 타이머 카드는 이 화면에서 숨기지만 내용은 계속 채워 둡니다.
  // (css/day-prep-minigames.css 의 숨김 한 줄만 지우면 그대로 다시 보입니다)
  dom.miniTimer.textContent=`${data.successInputs} / ${data.totalInputs}`;
  renderFryPrepScreen({
    ingredients:chain.map(item=>({id:item.ingredient,label:item.label,count:1,
      asset:mandolineAssetKey(item.ingredient),active:item.taskId===data.taskId})),
    stage:mandolineSceneMarkup(data),
    done,
    total:chain.length,
    percent,
    keys:data.directions.map(direction=>({value:direction,glyph:MANDOLINE_ARROWS[direction]})),
    expectedIndex:data.directions.indexOf(data.expected),
    keyLink:"→",
    controlName:`${way}<br />채칼 움직이기`
  },direction=>mandolineInput(direction));
}

function mandolineInput(direction){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="mandoline")return false;
  const data=m.data;
  if(!isAlternateTurn(data,direction))return false;
  data.successInputs++;advanceAlternateTurn(data,direction);audio.click();
  // 마지막 한 번도 화면에 반영한 뒤에 완료 처리합니다 (100% 가 보이고 넘어갑니다)
  renderMandoline();
  // 다시 그린 직후에 붙여야 애니메이션이 살아납니다 (튀김 준비의 흔들림과 같은 이유)
  const ingredient=dom.miniContent.querySelector("#mandolineIngredient");
  if(ingredient){void ingredient.offsetWidth;ingredient.classList.add(`move-${direction}`);}
  if(data.successInputs>=data.totalInputs)finishMandolineStep(m);
  return true;
}

// 한 재료를 다 썰었을 때. 뒤에 이어질 재료가 있으면 화면을 닫지 않고 이어갑니다.
function finishMandolineStep(m){
  const data=m.data,chain=MANDOLINE_CHAIN[data.chain];
  const next=chain[chain.indexOf(data.taskId)+1];
  if(!next){finishDayPrepTask(data.taskId,`${data.label} 채썰기 완료`);return;}
  completeDayPrepTask(data.taskId);
  dom.miniTimer.textContent="완료";
  dom.miniFeedback.textContent=`${data.label} 채썰기 완료 · ${mandolineTask(next).label} 차례입니다.`;
  dom.miniContent.classList.add("prep-complete-flash");
  setTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    dom.miniContent.classList.remove("prep-complete-flash");
    setupMandoline(next);
  },420);
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
    <div class="fp-scene">
      <div class="fp-col">
        <h3 class="fp-col-title starred">재료</h3>
        <div class="fp-panel fp-ing-panel">
          <div class="fp-ing-list">${view.ingredients.map(fryPrepIngredientMarkup).join("")}</div>
        </div>
      </div>
      <div class="fp-board">${view.stage}</div>
      <div class="fp-col">
        <h3 class="fp-col-title">진행도</h3>
        <div class="fp-panel fp-count">
          <strong><b>${view.done}</b> / ${view.total}</strong>
          <div class="fp-bar"><i style="width:${view.percent}%"></i></div>
        </div>
        <h3 class="fp-col-title">조작</h3>
        <div class="fp-panel fp-control">
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
  setDayPrepData({mode:"potatoStarch",taskId:config.taskId,keys:[...pair],expectedIndex:0,presses:0,total:config.requiredPresses});
  dom.miniTitle.textContent="감자튀김 준비";
  dom.miniStation.textContent="봉투를 흔들어 튀김가루를 골고루 묻혀주세요!";
  dom.miniDescription.textContent=`${pair[0].toUpperCase()} / ${pair[1].toUpperCase()}를 빠르게 눌러 봉투를 흔들어주세요!`;
  renderPotatoStarchShake();
}

function potatoStarchInput(key,repeat=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="potatoStarch"||repeat)return false;
  const data=m.data;
  if(!isAlternateTurn(data,key)){dom.miniFeedback.textContent=`${data.keys[data.expectedIndex].toUpperCase()} 차례입니다.`;return false;}
  data.presses++;advanceAlternateTurn(data,key);audio.click();
  // 마지막 한 번도 화면에 반영한 뒤에 완료 처리합니다 (100% 가 보이고 닫힙니다)
  renderPotatoStarchShake();
  playFryPrepShake("#friesBagScene",key,data.keys);
  if(data.presses>=data.total)finishDayPrepTask(data.taskId,"감자튀김 튀김가루 묻히기 완료");
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
    controlDesc:`${data.keys[0].toUpperCase()} / ${data.keys[1].toUpperCase()}를 빠르게<br />눌러 흔들기`
  },key=>potatoStarchInput(key,false));
}

/* ============================================================
   3. 새우튀김 준비 — 밀가루 → 계란물 → 빵가루, 각 12회

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
  setDayPrepData({mode:"shrimpCoat",taskId,step:0,sequence:SHRIMP_COAT_STEPS,keys:[...pair],expectedIndex:0,successes:0,total:item.presses,transitioning:false});
  dom.miniTitle.textContent="새우튀김 준비";
  dom.miniStation.textContent="튀김가루, 계란물, 빵가루를 순서대로 묻혀주세요!";
  dom.miniDescription.textContent=`${pair[0].toUpperCase()} / ${pair[1].toUpperCase()}를 빠르게 눌러 ${item.label}를 묻혀주세요!`;
  renderShrimpCoat();
}

function shrimpCoatInput(key,repeat=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="shrimpCoat"||m.data.transitioning||repeat)return false;
  const data=m.data;
  if(!isAlternateTurn(data,key)){dom.miniFeedback.textContent=`${data.keys[data.expectedIndex].toUpperCase()} 차례입니다.`;return false;}
  data.successes++;advanceAlternateTurn(data,key);audio.click();
  // 마지막 한 번도 화면에 반영한 뒤에 완료 처리합니다 (다 입은 새우가 보이고 닫힙니다)
  renderShrimpCoat();
  playFryPrepShake("#shrimpCoatStation",key,data.keys);
  if(data.successes>=data.total){
    const completed=data.sequence[data.step];
    if(data.step>=data.sequence.length-1){finishDayPrepTask(data.taskId,"새우튀김 튀김옷 준비 완료");return true;}
    data.transitioning=true;dom.miniFeedback.textContent=`${completed.label} 완료 · 다음 코팅 재료로 넘어갑니다.`;
    setTimeout(()=>{
      if(state.mini!==m||m.complete)return;
      data.step++;data.successes=0;data.total=data.sequence[data.step].presses;data.expectedIndex=0;data.transitioning=false;
      data.keys=[...BREADCRUMB_KEY_PAIRS[Math.floor(Math.random()*BREADCRUMB_KEY_PAIRS.length)]];
      dom.miniFeedback.textContent=`새 키 ${data.keys.map(item=>item.toUpperCase()).join(" · ")}를 번갈아 누르세요.`;
      renderShrimpCoat();
    },420);
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
    controlDesc:`${data.keys[0].toUpperCase()} / ${data.keys[1].toUpperCase()}를 랜덤하게<br />빠르게 눌러 새우를<br />굴려주세요!`
  },key=>shrimpCoatInput(key));
}
