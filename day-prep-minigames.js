"use strict";

// 날짜별 준비 미니게임 모듈. 메뉴 Task ID별 진행 상태를 서로 분리합니다.
const DAY_PREP_MINI_CONFIG = {
  cutRadish:{title:"어묵탕 · 무 썰기",total:4,zoneWidth:.12,zoneStarts:[.14,.55,.29,.67],speed:.78},
  cutFishCake:{title:"어묵탕 · 어묵 썰기",total:5,zoneWidth:.14,zoneStarts:[.2,.58,.32,.68,.43],speed:.8},
  cutTofuKimchi:{title:"두부김치 · 김치 썰기",ingredient:"kimchi",total:3,zoneWidth:.16,zoneStarts:[.51,.18,.62],speed:.74},
  cutPancakeKimchi:{title:"김치전 · 김치 썰기",ingredient:"kimchi",total:3,zoneWidth:.16,zoneStarts:[.22,.58,.39],speed:.78},
  cutSkewerChicken:{title:"닭꼬치 · 닭 썰기",ingredient:"chicken",total:4,zoneWidth:.14,zoneStarts:[.18,.55,.31,.68],speed:.8,requiresDoubleTap:true},
  cutSkewerGreenOnion:{title:"닭꼬치 · 대파 썰기",ingredient:"greenOnion",total:4,zoneWidth:.14,zoneStarts:[.56,.2,.65,.36],speed:.82},
  fryKimchi:{total:11,allowedDirections:["left","right"]},
  cleanAnchovy:{title:"어묵탕 · 멸치 머리 떼기",total:5}
};

const DAY3_MANDOLINE_CONFIG=Object.freeze({
  sliceYakisobaCabbage:{ingredient:"cabbage",label:"양배추",cycles:6},
  sliceYakisobaCarrot:{ingredient:"carrot",label:"당근",cycles:5}
});
const BREADCRUMB_KEY_PAIRS=Object.freeze([["a","d"],["q","e"],["f","j"],["z","c"],["j","l"]]);

// 아래 경로에 파일을 추가하면 CSS 프로토타입 대신 자동으로 이미지가 사용됩니다.
// 누락된 선택 에셋은 로딩 실패로 취급하지 않고 기존 CSS 도형으로 대체합니다.
const DAY_PREP_ASSET_PATHS = Object.freeze({
  radish0:"assets/prep/radish/radish-0.png",
  radish1:"assets/prep/radish/radish-1.png",
  radish2:"assets/prep/radish/radish-2.png",
  radish3:"assets/prep/radish/radish-3.png",
  radish4:"assets/prep/radish/radish-4.png",
  kimchiCut0:"assets/prep/kimchi/kimchi-cut-0.png",
  kimchiCut1:"assets/prep/kimchi/kimchi-cut-1.png",
  kimchiCut2:"assets/prep/kimchi/kimchi-cut-2.png",
  kimchiCut3:"assets/prep/kimchi/kimchi-cut-3.png",
  chicken0:"assets/prep/chicken/chicken-0.png",
  chicken1:"assets/prep/chicken/chicken-1.png",
  chicken2:"assets/prep/chicken/chicken-2.png",
  chicken3:"assets/prep/chicken/chicken-3.png",
  chicken4:"assets/prep/chicken/chicken-4.png",
  greenOnion0:"assets/prep/green-onion/green-onion-0.png",
  greenOnion1:"assets/prep/green-onion/green-onion-1.png",
  greenOnion2:"assets/prep/green-onion/green-onion-2.png",
  greenOnion3:"assets/prep/green-onion/green-onion-3.png",
  greenOnion4:"assets/prep/green-onion/green-onion-4.png",
  anchovyBody:"assets/prep/anchovy/anchovy-body.png",
  anchovyHead:"assets/prep/anchovy/anchovy-head.png",
  fryingPan:"assets/prep/kimchi/frying-pan.png",
  fryingKimchi:"assets/prep/kimchi/frying-kimchi.png",
  knife:"assets/prep/effects/knife.png",
  ...Object.fromEntries(DAY4_RAPID_CUT_SEQUENCE.flatMap(item=>item.progressSprites.map((src,index)=>[`${item.assetPrefix}${index}`,src]))),
  ...Object.fromEntries(Array.from({length:11},(_,index)=>[`potatoMandoline${index}`,`assets/prep/day4/fries/potato-${index}.png`])),
  potatoStarch0:"assets/prep/day4/fries/starch-0.png",
  potatoStarch35:"assets/prep/day4/fries/starch-35.png",
  potatoStarch70:"assets/prep/day4/fries/starch-70.png",
  potatoStarch100:"assets/prep/day4/fries/starch-100.png",
  tteokSoakEmpty:"assets/prep/day4/tteokbokki/soak-empty.png",
  tteokSoakTteok:"assets/prep/day4/tteokbokki/soak-tteok.png",
  tteokSoakWater:"assets/prep/day4/tteokbokki/soak-water.png",
  tteokSoakComplete:"assets/prep/day4/tteokbokki/soak-complete.png"
});
const dayPrepAssets={};

function loadDayPrepAssets(){
  return Promise.all(Object.entries(DAY_PREP_ASSET_PATHS).map(([key,src])=>new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>{dayPrepAssets[key]={src,image};resolve(image);};
    image.onerror=()=>resolve(null);
    image.src=src;
  }))).then(()=>dayPrepAssets);
}

function hasDayPrepAsset(key){
  return !!dayPrepAssets[key];
}

function dayPrepAssetMarkup(key,className,alt=""){
  if(!hasDayPrepAsset(key))return "";
  return `<img class="prep-asset ${className}" src="${dayPrepAssets[key].src}" alt="${alt}" draggable="false" />`;
}

function timingAssetKey(ingredient,successes){
  if(ingredient==="radish")return `radish${successes}`;
  if(ingredient==="kimchi")return `kimchiCut${successes}`;
  return `${ingredient}${successes}`;
}

function isDayPrepMini(mini=state.mini){
  return mini?.context?.mode==="dayPrep";
}

function startDayPrepMini(task){
  if(task.dayOnly&&Number(state.day)!==Number(task.dayOnly)){showToast(`이 준비 작업은 Day ${task.dayOnly} 전용입니다.`,true);return;}
  state.mini={
    type:`day-prep-${task.id}`,
    stationId:"prepTable",
    context:{mode:"dayPrep",taskId:task.id},
    complete:false,
    data:{}
  };
  dom.miniStation.textContent=`준비 테이블 · ${task.objectLabel}`;
  dom.miniFeedback.textContent="";
  dom.miniContent.innerHTML="";
  dom.miniClose.hidden=false;
  dom.miniOverlay.classList.add("open");

  if(task.miniGame==="cut")setupDayPrepTiming(task.id);
  else if(task.miniGame==="anchovy")setupAnchovyPrep();
  else if(task.miniGame==="kimchiFry")setupKimchiFry(task.id);
  else if(task.miniGame==="batter")setupKimchiBatter();
  else if(task.miniGame==="skewer")setupChickenSkewer();
  else if(task.miniGame==="mandoline")setupDay3Mandoline(task.id);
  else if(task.miniGame==="yakisobaSauce")setupYakisobaSauce();
  else if(task.miniGame==="shrimpCoat")setupShrimpCoat();
  else if(task.miniGame==="breadcrumbCoat")setupBreadcrumbCoat();
  else if(task.miniGame==="tteokSoak")setupTteokSoak();
  else if(task.miniGame==="rapidCutSequence")setupTteokbokkiRapidCut();
  else if(task.miniGame==="tteokbokkiSauce")setupSauceRecipe("tteokbokki");
  else if(task.miniGame==="potatoMandoline")setupDay4PotatoMandoline();
  else if(task.miniGame==="potatoStarch")setupPotatoStarchShake();
  else { closeDayPrepMini(true);showToast("준비 미니게임 설정을 찾지 못했습니다.",true); }
}

function setupDayPrepTiming(taskId){
  const m=state.mini,config=DAY_PREP_MINI_CONFIG[taskId];
  if(Number(state.day)>=4&&RAPID_CUT_DATA[taskId]){setupRapidCutTask(taskId);return;}
  const ingredient=config.ingredient||(taskId==="cutRadish"?"radish":"fishCake");
  startCuttingMinigame({
    taskId,
    ingredient,
    requiredHits:config.total,
    hitZoneWidth:config.zoneWidth,
    speed:config.speed,
    zoneStarts:config.zoneStarts,
    requiresDoubleTap:!!config.requiresDoubleTap,
    title:config.title,
    onComplete:taskId==="cutRadish"||taskId==="cutFishCake"
      ?()=>showOdenIngredientDrop(taskId,taskId==="cutFishCake"?"fishCake":"radish",taskId==="cutFishCake"?"어묵 썰기 완료":"무 썰기 완료")
      :()=>finishDayPrepTask(taskId,`${PREP_TASKS[taskId].label} 완료`),
    description:config.requiresDoubleTap
      ?"포인터가 초록 구간에 들어왔을 때 Space를 빠르게 두 번 눌러 질긴 고기를 써세요."
      :taskId==="cutRadish"
      ?"포인터가 초록 구간에 들어왔을 때 Space를 누르세요. 총 4번 썹니다."
      :taskId==="cutFishCake"
      ?"포인터가 초록 구간에 들어왔을 때 Space를 눌러 어묵을 5조각으로 써세요."
      :`포인터가 초록 구간에 들어왔을 때 Space를 누르세요. ${PREP_TASKS[taskId].label} 작업입니다.`
  });
}

// 두부 썰기 등 후속 조리는 같은 함수에 설정만 전달해 연결할 수 있습니다.
function startCuttingMinigame(options){
  const m=state.mini;
  const width={wide:.24,normal:.18,narrow:.14}[options.hitZoneWidth]??options.hitZoneWidth??.18;
  const speed={slow:.55,normal:.7,fast:.9}[options.speed]??options.speed??.7;
  const defaults=[.18,.56,.32,.66,.42];
  const zoneStarts=options.zoneStarts?.length?[...options.zoneStarts]:Array.from({length:options.requiredHits},(_,index)=>defaults[index%defaults.length]);
  m.data={mode:"timing",marker:0,direction:1,successes:0,taskId:options.taskId,ingredient:options.ingredient,total:options.requiredHits,zoneWidth:width,speed,zoneStarts,onComplete:options.onComplete,requiresDoubleTap:!!options.requiresDoubleTap,tapStep:0,tapWindow:0};
  dom.miniTitle.textContent=options.title;
  dom.miniDescription.textContent=options.description;
  renderDayPrepTiming();
}

function renderDayPrepTiming(){
  const m=state.mini,data=m.data,isRadish=data.ingredient==="radish";
  const zoneLeft=data.zoneStarts[data.successes];
  const objectAssetKey=timingAssetKey(data.ingredient,data.successes);
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  dom.miniContent.innerHTML=`
    <div class="prep-work-object ${data.ingredient}-shape ${hasDayPrepAsset(objectAssetKey)?"has-prep-asset":""}" id="prepWorkObject" aria-label="${data.ingredient}">
      ${dayPrepAssetMarkup(objectAssetKey,"prep-object-asset",isRadish?"손질 단계별 무":"손질 단계별 재료")}
      ${Array.from({length:data.total},(_,index)=>`<i class="cut-line ${data.ingredient==="fishCake"?`fishcake-diagonal ${index%2?"slash-back":"slash-forward"}`:""} ${index<data.successes?"done":""}" style="left:${(index+1)/(data.total+1)*100}%"></i>`).join("")}
      <i class="knife-effect ${hasDayPrepAsset("knife")?"has-prep-asset":""}">${dayPrepAssetMarkup("knife","knife-asset","")}</i>
    </div>
    <div class="prep-timing-bar">
      <i class="prep-success-zone" style="left:${zoneLeft*100}%;width:${data.zoneWidth*100}%"></i>
      <i id="dayPrepMarker" class="prep-timing-marker" style="left:${data.marker*100}%"></i>
    </div>
    ${data.requiresDoubleTap?'<div class="tough-cut-hint" id="toughCutHint"><span>SPACE 1</span><span>SPACE 2</span></div>':""}
    <div class="cut-count">진행 ${data.successes} / ${data.total}</div>
    <button class="mini-action" id="dayPrepAction" type="button">Space · ${data.requiresDoubleTap?"빠르게 2번":"썰기"}</button>`;
  dom.miniContent.querySelector("#dayPrepAction").addEventListener("click",dayPrepPrimaryAction);
}

function setupRapidCutTask(taskId){
  const config=RAPID_CUT_DATA[taskId];if(!config)return;
  const onComplete=taskId==="cutRadish"||taskId==="cutFishCake"
    ?()=>showOdenIngredientDrop(taskId,taskId==="cutFishCake"?"fishCake":"radish",taskId==="cutFishCake"?"어묵 썰기 완료":"무 썰기 완료")
    :()=>finishDayPrepTask(taskId,`${PREP_TASKS[taskId].label} 완료`);
  setupRapidCutMinigame({taskId,title:`${PREP_TASKS[taskId].label} · 빠른 칼질`,sequence:[config],onComplete});
}

function setupTteokbokkiRapidCut(){
  if(Number(state.day)!==4)return;
  setupRapidCutMinigame({
    taskId:"cutTteokbokkiIngredients",
    title:"떡볶이 · 재료 빠른 칼질",
    sequence:DAY4_RAPID_CUT_SEQUENCE,
    onComplete:()=>finishDayPrepTask("cutTteokbokkiIngredients","떡볶이 양배추 · 대파 · 어묵 손질 완료")
  });
}

function setupRapidCutMinigame(options){
  const m=state.mini;
  m.data={mode:"rapidCut",taskId:options.taskId,sequence:options.sequence.map(item=>({...item})),ingredientIndex:0,pieces:0,phase:"ready",holdStart:0,holdElapsed:0,lastInputAt:-Infinity,transitioning:false,onComplete:options.onComplete};
  dom.miniTitle.textContent=options.title;
  dom.miniDescription.textContent="Space 키다운 1회당 한 번 썹니다. 누르고 있어도 반복되지 않으며 실패나 시간제한은 없습니다.";
  renderRapidCut();
}

function currentRapidCutIngredient(data=state.mini?.data){return data?.sequence?.[data.ingredientIndex]||null;}

function renderRapidCut(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="rapidCut")return;
  const data=m.data,item=currentRapidCutIngredient(data);if(!item)return;
  const tough=item.cutType===RapidCutType.ToughMeat,progress=Math.round(data.pieces/item.requiredPieces*100);
  dom.miniTimer.textContent=tough?`닭고기 ${data.pieces} / ${item.requiredPieces}`:`${data.pieces} / ${item.requiredPieces}`;
  dom.miniDescription.textContent=tough
    ?"Space를 약 0.5초 누른 뒤 떼고, 다시 한 번 눌러 닭고기 한 조각을 자르세요."
    :"스페이스바를 연속으로 눌러 빠르게 손질하세요. 키를 누른 채 유지해도 반복 입력되지 않습니다.";
  dom.miniContent.innerHTML=`
    <div class="rapid-cut-stage ${item.ingredientId} ${tough?"tough-meat":""} ${data.phase==="embedded"||data.phase==="awaitSecond"?"knife-embedded":""}" id="rapidCutStage">
      <div class="rapid-ingredient ${item.ingredientId}" style="--rapid-progress:${progress}%;width:${Math.max(80,180-progress)}px">${dayPrepAssetMarkup(`${item.assetPrefix||item.ingredientId}${data.pieces}`,"rapid-progress-asset",item.displayName)}</div>
      <i class="rapid-knife">${dayPrepAssetMarkup("knife","knife-asset","")}</i>
      <div class="rapid-piece-pile ${item.ingredientId}" aria-label="손질된 ${item.displayName}">${Array.from({length:data.pieces},(_,index)=>`<i style="left:${(index%7)*17}px;bottom:${(index%3)*8}px;transform:rotate(${-18+(index%5)*9}deg)"></i>`).join("")}</div>
      ${tough?'<i class="tough-cut-line"></i>':""}
    </div>
    <div class="rapid-hold-meter ${tough?"":"hidden"}"><i style="width:${Math.min(100,data.holdElapsed/(item.requiredHoldTime||RAPID_CUT_INPUT.toughHoldTime)*100)}%"></i></div>
    <div class="cut-count">${item.displayName} ${data.pieces} / ${item.requiredPieces}${data.sequence.length>1?` · 재료 ${data.ingredientIndex+1}/${data.sequence.length}`:""}</div>
    <button class="mini-action" id="rapidCutAction" type="button">${tough?(data.phase==="awaitSecond"?"Space · 한 번 더 눌러 절단":"Space · 0.5초 누르기"):"Space · 빠르게 썰기"}</button>`;
  const button=dom.miniContent.querySelector("#rapidCutAction");
  if(tough){
    button.addEventListener("pointerdown",event=>{event.preventDefault();rapidCutKeyDown(false);});
    ["pointerup","pointercancel","pointerleave"].forEach(type=>button.addEventListener(type,rapidCutKeyUp));
  }else button.addEventListener("click",()=>rapidCutKeyDown(false));
}

function rapidCutKeyDown(repeat=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="rapidCut"||m.data.transitioning||repeat)return false;
  const data=m.data,item=currentRapidCutIngredient(data),now=performance.now()/1000;
  if(!item||now-data.lastInputAt<RAPID_CUT_INPUT.minimumInterval)return false;
  data.lastInputAt=now;
  if(item.cutType!==RapidCutType.ToughMeat){completeRapidCutPiece(m);return true;}
  if(data.phase==="awaitSecond"){
    completeRapidCutPiece(m);return true;
  }
  if(data.phase!=="ready")return false;
  data.phase="holding";data.holdStart=now;data.holdElapsed=0;
  dom.miniFeedback.textContent="Space를 누르고 있습니다…";
  return true;
}

function rapidCutKeyUp(){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="rapidCut")return false;
  const data=m.data,item=currentRapidCutIngredient(data);
  if(!item||item.cutType!==RapidCutType.ToughMeat||data.phase!=="holding"&&data.phase!=="embedded")return false;
  data.holdElapsed=Math.max(data.holdElapsed,performance.now()/1000-data.holdStart);
  if(data.holdElapsed>=RAPID_CUT_INPUT.toughHoldThreshold){
    data.phase="awaitSecond";dom.miniFeedback.textContent="칼이 박혔습니다. Space를 한 번 더 누르세요.";audio.click();
  }else{
    data.phase="ready";data.holdElapsed=0;dom.miniFeedback.textContent="조금 더 길게 눌러주세요. 바로 다시 시도할 수 있습니다.";
  }
  renderRapidCut();return true;
}

function completeRapidCutPiece(m){
  const data=m.data,item=currentRapidCutIngredient(data);if(!item)return;
  data.pieces++;data.phase="ready";data.holdElapsed=0;
  const stage=dom.miniContent.querySelector("#rapidCutStage");
  stage?.classList.remove("rapid-cut-hit");if(stage){void stage.offsetWidth;stage.classList.add("rapid-cut-hit");}
  audio.click();dom.miniFeedback.textContent=`${item.displayName} 손질 ${data.pieces} / ${item.requiredPieces}`;
  if(data.pieces<item.requiredPieces){setTimeout(()=>{if(state.mini===m&&!m.complete)renderRapidCut();},105);return;}
  if(data.ingredientIndex<data.sequence.length-1){
    data.transitioning=true;dom.miniTimer.textContent="교체";dom.miniFeedback.textContent=`${item.displayName} 완료 · 다음 재료로 전환합니다.`;audio.success();
    setTimeout(()=>{if(state.mini!==m||m.complete)return;data.ingredientIndex++;data.pieces=0;data.transitioning=false;data.lastInputAt=-Infinity;renderRapidCut();},420);
    return;
  }
  if(typeof data.onComplete==="function")data.onComplete();
}

function setupAnchovyPrep(){
  const m=state.mini,config=DAY_PREP_MINI_CONFIG.cleanAnchovy;
  const slots=shuffle(Array.from({length:10},(_,index)=>index)).slice(0,config.total);
  m.data={mode:"anchovy",cleaned:0,total:config.total,items:slots.map((slot,index)=>({
    id:index,cleaned:false,x:8+(slot%5)*18+Math.random()*4,y:10+Math.floor(slot/5)*48+Math.random()*5,
    rotation:-22+Math.random()*44,scale:.82+Math.random()*.3,flip:Math.random()>.5?-1:1
  }))};
  dom.miniTitle.textContent=config.title;
  dom.miniDescription.textContent="멸치의 작은 원형 머리를 클릭하세요. 몸통을 누르면 같은 멸치를 다시 시도합니다.";
  renderAnchovyPrep();
}

function showOdenIngredientDrop(taskId,ingredient,message){
  const m=state.mini;
  const ingredientOrder=["radish","fishCake","anchovy"];
  const completedIngredients=ingredientOrder.filter(item=>item===ingredient||(
    item==="radish"&&state.prepProgress.cutRadish||
    item==="fishCake"&&state.prepProgress.cutFishCake||
    item==="anchovy"&&state.prepProgress.cleanAnchovy
  ));
  m.data={mode:"potDrop",taskId,ingredient,message};
  dom.miniTitle.textContent="어묵탕 · 냄비에 넣기";
  dom.miniDescription.textContent=`손질을 마친 ${ingredient==="radish"?"무":ingredient==="fishCake"?"어묵":"멸치"}를 육수 냄비에 넣습니다.`;
  dom.miniTimer.textContent="냄비";
  dom.miniContent.innerHTML=`
    <div class="oden-pot-scene">
      <div class="oden-pot-ingredients"><i class="pot-ingredient ${ingredient} dropping"></i></div>
      <div class="oden-broth">${completedIngredients.map(item=>`<i class="broth-piece ${item} ${item===ingredient?"just-added":""}"></i>`).join("")}</div>
      <div class="oden-pot"><i class="pot-rim"></i></div>
    </div>
    <div class="cut-count">손질한 재료를 냄비에 넣는 중</div>`;
  setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(taskId,message);},650);
}

function renderAnchovyPrep(){
  const data=state.mini.data;
  dom.miniTimer.textContent=`${data.cleaned} / ${data.total}`;
  dom.miniContent.innerHTML=`
    <div class="anchovy-work-area" id="anchovyWorkArea">
      ${data.items.map(item=>`<div class="anchovy ${item.cleaned?"cleaned":""}" data-id="${item.id}" style="left:${item.x}%;top:${item.y}%;--turn:${item.rotation}deg;--size:${item.scale};--flip:${item.flip}">
        <button class="anchovy-body ${hasDayPrepAsset("anchovyBody")?"has-prep-asset":""}" type="button" aria-label="${item.id+1}번 멸치 몸통">${dayPrepAssetMarkup("anchovyBody","anchovy-body-asset","")}</button>
        <button class="anchovy-head ${hasDayPrepAsset("anchovyHead")?"has-prep-asset":""}" type="button" aria-label="${item.id+1}번 멸치 머리">${dayPrepAssetMarkup("anchovyHead","anchovy-head-asset","")}</button>
      </div>`).join("")}
    </div>
    <div class="cut-count">진행 ${data.cleaned} / ${data.total}</div>`;
  dom.miniContent.querySelectorAll(".anchovy-body").forEach(button=>button.addEventListener("click",()=>{
    dom.miniFeedback.textContent="몸통이 아니라 머리를 클릭하세요.";
  }));
  dom.miniContent.querySelectorAll(".anchovy-head").forEach(button=>button.addEventListener("click",()=>cleanAnchovyHead(button)));
}

function cleanAnchovyHead(button){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="anchovy")return;
  const wrapper=button.closest(".anchovy"),item=m.data.items.find(entry=>entry.id===Number(wrapper.dataset.id));
  if(!item||item.cleaned)return;
  item.cleaned=true;m.data.cleaned++;
  wrapper.classList.add("cleaned");button.disabled=true;
  dom.miniTimer.textContent=`${m.data.cleaned} / ${m.data.total}`;
  dom.miniContent.querySelector(".cut-count").textContent=`진행 ${m.data.cleaned} / ${m.data.total}`;
  dom.miniFeedback.textContent="머리 손질 성공";
  if(m.data.cleaned===m.data.total)showOdenIngredientDrop("cleanAnchovy","anchovy","멸치 손질 완료");
}

function setupKimchiFry(taskId="fryTofuKimchi"){
  const m=state.mini,config=DAY_PREP_MINI_CONFIG.fryKimchi;
  const sequence=Array.from({length:config.total},()=>config.allowedDirections[Math.floor(Math.random()*config.allowedDirections.length)]);
  m.data={mode:"direction",taskId,successes:0,total:config.total,allowedDirections:[...config.allowedDirections],sequence};
  dom.miniTitle.textContent="두부김치 · 김치 볶기";
  dom.miniDescription.textContent="썰어 둔 두부김치용 김치를 팬에서 볶습니다. 표시된 방향을 왼쪽부터 순서대로 누르세요.";
  renderKimchiFry();
}

function renderKimchiFry(){
  const data=state.mini.data;
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  dom.miniContent.innerHTML=`
    <div class="fry-work-area" id="fryWorkArea">
      <div class="frying-pan ${hasDayPrepAsset("fryingPan")?"has-prep-asset":""}">
        ${dayPrepAssetMarkup("fryingPan","frying-pan-asset","후라이팬")}
        <i class="frying-kimchi ${hasDayPrepAsset("fryingKimchi")?"has-prep-asset":""}">${dayPrepAssetMarkup("fryingKimchi","frying-kimchi-asset","볶는 김치")}</i>
      </div>
    </div>
    <div class="kimchi-direction-sequence" aria-label="볶기 방향 순서">
      ${data.sequence.map((direction,index)=>`<span class="kimchi-direction-chip ${index<data.successes?"done":index===data.successes?"current":""}" data-sequence-index="${index}">${direction==="left"?"←":"→"}</span>`).join("")}
    </div>
    <div class="cut-count">진행 ${data.successes} / ${data.total}</div>
    <div class="prep-direction-buttons">
      ${data.allowedDirections.map(direction=>`<button type="button" data-direction="${direction}">${direction==="left"?"←":"→"}</button>`).join("")}
    </div>`;
  dom.miniContent.querySelectorAll("[data-direction]").forEach(button=>button.addEventListener("click",()=>dayPrepDirectionInput(button.dataset.direction)));
}

function setupKimchiBatter(){
  state.mini.data={mode:"batterIngredients",step:0,ingredients:[
    {id:"flour",label:"밀가루 봉투"},{id:"water",label:"물"},{id:"kimchi",label:"썰어 둔 김치"}
  ]};
  dom.miniTitle.textContent="김치전 · 반죽 만들기";
  dom.miniDescription.textContent="밀가루 → 물 → 썰어 둔 김치 순서로 믹스볼에 넣으세요.";
  renderKimchiBatterIngredients();
}

function renderKimchiBatterIngredients(){
  const data=state.mini.data,current=data.ingredients[data.step];
  dom.miniTimer.textContent=`${data.step} / ${data.ingredients.length}`;
  dom.miniContent.innerHTML=`
    <div class="batter-prep-scene">
      <div class="batter-ingredients">${data.ingredients.map((item,index)=>`<button type="button" class="batter-ingredient ${item.id} ${index<data.step?"added":""}" data-batter-ingredient="${item.id}" ${index<data.step?"disabled":""}><i></i><span>${item.label}</span></button>`).join("")}</div>
      <div class="mixing-bowl ingredient-step-${data.step}"><i class="batter-fill"></i></div>
    </div>
    <div class="cut-count">다음 재료 · ${current?.label||"거품기"}</div>`;
  dom.miniContent.querySelectorAll("[data-batter-ingredient]").forEach(button=>button.addEventListener("click",()=>addBatterIngredient(button.dataset.batterIngredient,button)));
}

function addBatterIngredient(ingredientId,button){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="batterIngredients")return;
  const expected=m.data.ingredients[m.data.step];
  if(ingredientId!==expected.id){dom.miniFeedback.textContent=`먼저 ${expected.label}을 넣으세요.`;audio.bad();return;}
  button.classList.add("pouring");button.disabled=true;m.data.step++;audio.click();
  dom.miniFeedback.textContent=`${expected.label} 넣기 완료`;
  setTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    if(m.data.step>=m.data.ingredients.length)setupWhiskBatter();
    else renderKimchiBatterIngredients();
  },420);
}

function setupWhiskBatter(){
  const m=state.mini;
  m.data={mode:"whisk",progress:0,pointerActive:false,lastAngle:null};
  dom.miniTitle.textContent="김치전 · 거품기로 섞기";
  dom.miniDescription.textContent="믹스볼 안에서 마우스를 누른 채 원을 그리세요. 거품기와 반죽이 움직이며 섞입니다.";
  dom.miniTimer.textContent="0%";
  dom.miniContent.innerHTML=`
    <div class="whisk-work-area" id="whiskWorkArea">
      <div class="whisk-bowl stage-0" id="whiskBowl"><i class="mixed-batter"></i><i class="whisk-tool" id="whiskTool"></i></div>
    </div>
    <div class="whisk-progress"><i id="whiskProgressBar"></i></div>
    <div class="cut-count" id="whiskProgressText">반죽 진행도 0%</div>`;
  const work=dom.miniContent.querySelector("#whiskWorkArea");
  work.addEventListener("pointerdown",event=>{m.data.pointerActive=true;m.data.lastAngle=null;work.setPointerCapture(event.pointerId);moveWhiskPointer(event);});
  work.addEventListener("pointermove",moveWhiskPointer);
  ["pointerup","pointercancel"].forEach(type=>work.addEventListener(type,()=>{m.data.pointerActive=false;m.data.lastAngle=null;}));
}

function moveWhiskPointer(event){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="whisk"||!m.data.pointerActive)return;
  const work=dom.miniContent.querySelector("#whiskWorkArea"),bowl=dom.miniContent.querySelector("#whiskBowl"),whisk=dom.miniContent.querySelector("#whiskTool");
  if(!work||!bowl||!whisk)return;
  const rect=work.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top,cx=rect.width/2,cy=rect.height/2;
  const dx=x-cx,dy=y-cy,radius=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
  whisk.style.left=`${clamp(x/rect.width*100,8,92)}%`;whisk.style.top=`${clamp(y/rect.height*100,8,92)}%`;
  bowl.style.setProperty("--batter-x",`${clamp(dx*.045,-7,7)}px`);bowl.style.setProperty("--batter-y",`${clamp(dy*.045,-6,6)}px`);
  if(m.data.lastAngle!=null&&radius>35&&radius<Math.min(rect.width,rect.height)*.48){
    const delta=Math.atan2(Math.sin(angle-m.data.lastAngle),Math.cos(angle-m.data.lastAngle));
    if(Math.abs(delta)<1.2)m.data.progress=clamp(m.data.progress+Math.abs(delta)*6,0,100);
  }
  m.data.lastAngle=angle;
  const progress=Math.round(m.data.progress),stage=Math.min(4,Math.floor(progress/25));
  bowl.className=`whisk-bowl stage-${stage}`;
  dom.miniContent.querySelector("#whiskProgressBar").style.width=`${progress}%`;
  dom.miniContent.querySelector("#whiskProgressText").textContent=`반죽 진행도 ${progress}%`;
  dom.miniTimer.textContent=`${progress}%`;
  if(progress>=100)finishDayPrepTask("mixKimchiBatter","김치전 반죽 완성");
}

function setupChickenSkewer(){
  state.mini.data={mode:"skewer",sequence:["chicken","greenOnion","chicken","greenOnion","chicken"],placed:[],used:[],selectedPiece:null,completedSkewers:0,totalSkewers:4};
  dom.miniTitle.textContent="닭꼬치 4개 조립";
  dom.miniDescription.textContent="닭 → 대파 → 닭 → 대파 → 닭 순서로 재료를 꽂아 숯불에 올릴 꼬치 4개를 만드세요.";
  renderChickenSkewer();
}

function renderChickenSkewer(){
  const data=state.mini.data;
  dom.miniTimer.textContent=`꼬치 ${data.completedSkewers+1} / ${data.totalSkewers} · ${data.placed.length} / ${data.sequence.length}`;
  dom.miniContent.innerHTML=`
    <div class="skewer-prep-scene">
      <div class="skewer-batch-progress" aria-label="완성된 닭꼬치 수">${Array.from({length:data.totalSkewers},(_,index)=>`<span class="batch-skewer ${index<data.completedSkewers?"done":index===data.completedSkewers?"current":""}"><i></i><b></b><em></em><b></b><em></em><b></b></span>`).join("")}</div>
      <div class="skewer-sources">${data.sequence.map((ingredient,index)=>`<button type="button" draggable="true" class="skewer-piece ${ingredient} ${data.used.includes(index)?"used":""}" data-piece-index="${index}" data-ingredient="${ingredient}" ${data.used.includes(index)?"disabled":""}>${ingredient==="chicken"?"닭":"대파"}</button>`).join("")}</div>
      <div class="skewer-stick"><i></i>${data.sequence.map((ingredient,index)=>`<button type="button" class="skewer-slot ${index<data.placed.length?ingredient:""} ${index===data.placed.length?"current":""}" data-slot-index="${index}">${index<data.placed.length?(ingredient==="chicken"?"닭":"대파"):index+1}</button>`).join("")}</div>
    </div>
    <div class="cut-count">순서 · 닭 → 대파 → 닭 → 대파 → 닭</div>`;
  dom.miniContent.querySelectorAll("[data-piece-index]").forEach(piece=>{
    piece.addEventListener("dragstart",event=>{event.dataTransfer.setData("text/plain",piece.dataset.pieceIndex);event.dataTransfer.effectAllowed="move";});
    piece.addEventListener("click",()=>{data.selectedPiece=Number(piece.dataset.pieceIndex);dom.miniContent.querySelectorAll(".skewer-piece").forEach(item=>item.classList.toggle("selected",item===piece));});
  });
  dom.miniContent.querySelectorAll("[data-slot-index]").forEach(slot=>{
    slot.addEventListener("dragover",event=>event.preventDefault());
    slot.addEventListener("drop",event=>{event.preventDefault();placeSkewerPiece(Number(event.dataTransfer.getData("text/plain")),Number(slot.dataset.slotIndex));});
    slot.addEventListener("click",()=>{if(data.selectedPiece!=null)placeSkewerPiece(data.selectedPiece,Number(slot.dataset.slotIndex));});
  });
}

function placeSkewerPiece(pieceIndex,slotIndex){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="skewer")return;
  const data=m.data,ingredient=data.sequence[pieceIndex],expected=data.sequence[data.placed.length];
  if(data.used.includes(pieceIndex))return;
  if(slotIndex!==data.placed.length||ingredient!==expected){dom.miniFeedback.textContent=`다음에는 ${expected==="chicken"?"닭":"대파"}을 ${data.placed.length+1}번 슬롯에 놓으세요.`;audio.bad();return;}
  data.used.push(pieceIndex);data.placed.push(ingredient);data.selectedPiece=null;audio.click();dom.miniFeedback.textContent="재료를 꼬치에 꽂았습니다.";
  if(data.placed.length>=data.sequence.length){
    data.completedSkewers++;
    if(data.completedSkewers>=data.totalSkewers){finishDayPrepTask("assembleChickenSkewer","닭꼬치 4개 조립 완료");return;}
    data.placed=[];data.used=[];data.selectedPiece=null;
    dom.miniFeedback.textContent=`${data.completedSkewers}개 완성! 다음 꼬치를 같은 순서로 꽂으세요.`;
  }
  renderChickenSkewer();
}

function setupTteokSoak(){
  const m=state.mini;if(Number(state.day)!==4||!m)return;
  m.data={mode:"tteokSoak",taskId:DAY4_PREP_CONFIG.soak.taskId,added:{tteok:false,water:false},finishing:false};
  dom.miniTitle.textContent="떡볶이 · 떡 불려두기";
  dom.miniDescription.textContent="떡을 클릭해 볼에 넣고, 물통을 클릭해 물을 채우세요. 별도의 대기 시간은 없습니다.";
  renderTteokSoak();
}

function renderTteokSoak(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="tteokSoak")return;
  const data=m.data,count=Object.values(data.added).filter(Boolean).length;
  dom.miniTimer.textContent=`${count} / 2`;
  dom.miniContent.innerHTML=`
    <div class="tteok-soak-scene">
      <button type="button" class="tteok-source ${data.added.tteok?"added":""}" data-soak-item="tteok" ${data.added.tteok||data.finishing?"disabled":""}><i></i><strong>떡</strong></button>
      <div class="soaking-bowl ${data.added.water?"has-water":""} ${data.added.tteok?"has-tteok":""}" aria-label="떡을 불리는 볼"><i class="water-fill"></i>${dayPrepAssetMarkup(data.added.tteok&&data.added.water?"tteokSoakComplete":data.added.tteok?"tteokSoakTteok":data.added.water?"tteokSoakWater":"tteokSoakEmpty","soak-state-asset","")}<span>${data.added.tteok?Array.from({length:7},()=>"<b></b>").join(""):"빈 볼"}</span></div>
      <button type="button" class="water-source ${data.added.water?"added":""}" data-soak-item="water" ${data.added.water||data.finishing?"disabled":""}><i></i><strong>물통</strong></button>
    </div>
    <div class="cut-count">떡 ${data.added.tteok?"✓":"○"} · 물 ${data.added.water?"✓":"○"}</div>`;
  dom.miniContent.querySelectorAll("[data-soak-item]").forEach(button=>button.addEventListener("click",()=>addTteokSoakItem(button.dataset.soakItem)));
}

function addTteokSoakItem(item){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="tteokSoak"||m.data.finishing||!Object.prototype.hasOwnProperty.call(m.data.added,item)||m.data.added[item])return;
  m.data.added[item]=true;audio.click();dom.miniFeedback.textContent=item==="tteok"?"떡을 볼에 담았습니다.":"볼에 물을 채웠습니다.";
  if(Object.values(m.data.added).every(Boolean)){
    m.data.finishing=true;renderTteokSoak();dom.miniFeedback.textContent="떡과 물이 모두 들어갔습니다. 불려두기 완료!";
    setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask("soakTteok","떡 불려두기 완료");},360);
  }else renderTteokSoak();
}

function setupPotatoStarchShake(){
  const m=state.mini,config=DAY4_PREP_CONFIG.potatoStarch;if(Number(state.day)!==4||!m)return;
  m.data={mode:"potatoStarch",taskId:config.taskId,presses:0,total:config.requiredPresses,lastInputAt:-Infinity};
  dom.miniTitle.textContent="감자튀김 · 전분 털기";
  dom.miniDescription.textContent="스페이스바를 연속으로 눌러 감자의 전분을 털어주세요!";
  renderPotatoStarchShake();
}

function potatoStarchInput(repeat=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="potatoStarch"||repeat)return false;
  const data=m.data;data.lastInputAt=performance.now()/1000;data.presses++;audio.click();
  const basket=dom.miniContent.querySelector("#potatoStarchBasket");basket?.classList.remove("basket-shake");if(basket){void basket.offsetWidth;basket.classList.add("basket-shake");}
  if(data.presses>=data.total){finishDayPrepTask(data.taskId,"감자 전분 털기 완료");return true;}
  setTimeout(()=>{if(state.mini===m&&!m.complete)renderPotatoStarchShake();},105);return true;
}

function renderPotatoStarchShake(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="potatoStarch")return;
  const data=m.data,progress=Math.round(data.presses/data.total*100),stage=progress>=100?100:progress>=70?70:progress>=35?35:0;
  dom.miniTimer.textContent=`${data.presses} / ${data.total}`;
  dom.miniContent.innerHTML=`
    <div class="potato-starch-scene stage-${stage}" id="potatoStarchBasket">
      <div class="potato-basket"><i></i>${dayPrepAssetMarkup(`potatoStarch${stage}`,"potato-starch-asset",`전분 털기 ${stage}%`)}${Array.from({length:9},()=>"<b></b>").join("")}</div>
      <div class="starch-cloud">${Array.from({length:Math.max(0,12-Math.floor(progress/8))},()=>"<i></i>").join("")}</div>
    </div>
    <div class="breadcrumb-progress"><i style="width:${progress}%"></i></div>
    <div class="cut-count">전분 털기 ${progress}% · ${data.presses} / ${data.total}</div>
    <button class="mini-action" id="potatoStarchAction" type="button">Space · 전분 털기</button>`;
  dom.miniContent.querySelector("#potatoStarchAction")?.addEventListener("click",()=>potatoStarchInput(false));
}

function setupDay3Mandoline(taskId){
  const m=state.mini,config=DAY3_MANDOLINE_CONFIG[taskId];
  if(Number(state.day)!==3||!config)return;
  m.data={mode:"day3Mandoline",taskId,ingredient:config.ingredient,label:config.label,cycles:config.cycles,directions:["left","right"],successInputs:0,totalInputs:config.cycles*2,expected:"left"};
  dom.miniTitle.textContent=`볶음우동 · ${config.label} 채썰기`;
  dom.miniDescription.textContent=`←와 →를 번갈아 입력해 ${config.label}를 채칼에 왕복 ${config.cycles}회 움직이세요.`;
  renderDay3Mandoline();
}

function setupDay4PotatoMandoline(){
  const m=state.mini,config=DAY4_PREP_CONFIG.potatoMandoline;if(Number(state.day)!==4||!m)return;
  m.data={mode:"day4Mandoline",taskId:config.taskId,ingredient:config.ingredient,label:config.label,directions:[...config.directions],successInputs:0,totalInputs:config.totalInputs,expected:config.directions[0]};
  dom.miniTitle.textContent="감자튀김 · 감자 채칼";
  dom.miniDescription.textContent="↑와 ↓를 번갈아 입력해 감자를 써세요. 같은 방향 연속 입력과 다른 키는 무시됩니다.";
  renderDay3Mandoline();
}

function renderDay3Mandoline(){
  const data=state.mini.data,isPotato=data.mode==="day4Mandoline",completedCycles=Math.floor(data.successInputs/2);
  dom.miniTimer.textContent=isPotato?`${data.successInputs} / ${data.totalInputs}`:`왕복 ${completedCycles} / ${data.cycles}`;
  const arrows={left:"←",right:"→",up:"↑",down:"↓"},shorten=Math.max(.34,1-data.successInputs/data.totalInputs*.62);
  dom.miniContent.innerHTML=`
    <div class="mandoline-scene ${data.ingredient}" id="mandolineScene">
      <div class="mandoline-board"><i class="mandoline-blade"></i></div>
      <div class="mandoline-ingredient ${data.ingredient}" id="mandolineIngredient" style="--ingredient-shorten:${shorten}">${isPotato?dayPrepAssetMarkup(`potatoMandoline${data.successInputs}`,"mandoline-potato-asset",`감자 손질 ${data.successInputs}단계`):"<i></i>"}</div>
      <div class="shredded-pile ${data.ingredient}" aria-label="채 썬 ${data.label}">${Array.from({length:data.successInputs},(_,index)=>`<i style="--shred-x:${14+(index%7)*11}%;--shred-y:${(index%3)*7}px;--shred-turn:${-18+(index%5)*9}deg"></i>`).join("")}</div>
    </div>
    <div class="mandoline-key-guide">${data.directions.map((direction,index)=>`${index?"<span>번갈아</span>":""}<button type="button" data-mandoline-direction="${direction}" class="${data.expected===direction?"expected":""}">${arrows[direction]}</button>`).join("")}</div>
    <div class="cut-count" id="mandolineProgress">${data.label} · ${isPotato?`${data.successInputs} / ${data.totalInputs}`:`왕복 ${completedCycles} / ${data.cycles}`}</div>`;
  dom.miniContent.querySelectorAll("[data-mandoline-direction]").forEach(button=>button.addEventListener("click",()=>day3MandolineInput(button.dataset.mandolineDirection)));
}

function day3MandolineInput(direction){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||!["day3Mandoline","day4Mandoline"].includes(m.data.mode))return false;
  const data=m.data;
  if(direction!==data.expected)return false;
  data.successInputs++;data.expected=data.directions.find(item=>item!==direction)||data.directions[0];audio.click();
  const ingredient=dom.miniContent.querySelector("#mandolineIngredient");
  ingredient?.classList.remove("move-left","move-right","move-up","move-down");if(ingredient){void ingredient.offsetWidth;ingredient.classList.add(`move-${direction}`);}
  if(data.successInputs>=data.totalInputs){
    if(data.mode==="day4Mandoline"){
      finishDayPrepTask("sliceFriesPotato","감자 채칼 손질 10회 완료");
    }else if(data.taskId==="sliceYakisobaCabbage"){
      completeDayPrepTask("sliceYakisobaCabbage");
      dom.miniTimer.textContent="완료";dom.miniFeedback.textContent="양배추 채썰기 완료 · 당근으로 전환합니다.";
      dom.miniContent.classList.add("prep-complete-flash");
      setTimeout(()=>{if(state.mini===m&&!m.complete){dom.miniContent.classList.remove("prep-complete-flash");setupDay3Mandoline("sliceYakisobaCarrot");}},420);
    }else finishDayPrepTask("sliceYakisobaCarrot","볶음우동 채소 손질 완료");
    return true;
  }
  setTimeout(()=>{if(state.mini===m&&!m.complete&&m.data===data)renderDay3Mandoline();},110);
  return true;
}

function setupYakisobaSauce(){
  if(Number(state.day)!==3)return;
  setupSauceRecipe("yakisoba");
}

function setupSauceRecipe(recipeId){
  const m=state.mini,recipe=SAUCE_RECIPES[recipeId];if(!m||!recipe)return;
  m.data={mode:"sauceMeasure",recipeId,recipe,finishing:false,sauces:recipe.ingredients.map(item=>({...item,amount:0}))};
  dom.miniTitle.textContent=recipeId==="tteokbokki"?"떡볶이 · 양념장 계량":"볶음우동 · 소스 제조";
  dom.miniDescription.textContent="레시피와 정확히 같은 양이 되도록 소스통을 클릭하세요. 초과한 소스는 한 번씩 덜어낼 수 있습니다.";
  renderYakisobaSauce();
}

function renderYakisobaSauce(){
  const data=state.mini.data,totalRatio=data.sauces.reduce((sum,item)=>sum+Math.min(item.amount/item.target,1),0)/data.sauces.length;
  dom.miniTimer.textContent=`${data.sauces.filter(item=>item.amount===item.target).length} / 3`;
  dom.miniContent.innerHTML=`
    <div class="sauce-recipe"><strong>${data.recipe.title}</strong>${data.sauces.map(item=>`<span>${item.label} ${item.target}g</span>`).join("")}</div>
    <div class="yakisoba-sauce-work">
      <div class="sauce-bottles">${data.sauces.map(item=>`<button type="button" class="sauce-bottle ${item.id}" data-sauce-id="${item.id}" ${data.finishing?"disabled":""}><i></i><strong>${item.label}</strong><small>+${item.step}g</small></button>`).join("")}</div>
      <div class="sauce-mixing-bowl" style="--sauce-height:${Math.round(totalRatio*65)}%"><i></i><span>소스볼</span></div>
    </div>
    <div class="sauce-measure-list">${data.sauces.map(item=>{
      const status=item.amount===item.target?"exact":item.amount>item.target?"over":"under";
      return `<div class="sauce-measure ${status}"><span>${item.amount===item.target?"✓":item.amount>item.target?"!":"○"}</span><strong>${item.label}</strong><b>${item.amount} / ${item.target}g</b>${item.amount>item.target?`<button type="button" data-sauce-undo="${item.id}">한 번 덜어내기</button>`:""}</div>`;
    }).join("")}</div>`;
  dom.miniContent.querySelectorAll("[data-sauce-id]").forEach(button=>button.addEventListener("click",()=>addYakisobaSauce(button.dataset.sauceId)));
  dom.miniContent.querySelectorAll("[data-sauce-undo]").forEach(button=>button.addEventListener("click",()=>undoYakisobaSauce(button.dataset.sauceUndo)));
}

function addYakisobaSauce(id){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="sauceMeasure"||m.data.finishing)return;
  const sauce=m.data.sauces.find(item=>item.id===id);if(!sauce)return;
  sauce.amount+=sauce.step;audio.click();dom.miniFeedback.textContent=`${sauce.label} ${sauce.step}g 투입`;
  checkYakisobaSauceComplete(m);
}

function undoYakisobaSauce(id){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="sauceMeasure"||m.data.finishing)return;
  const sauce=m.data.sauces.find(item=>item.id===id);if(!sauce||sauce.amount<=sauce.target)return;
  sauce.amount=Math.max(0,sauce.amount-sauce.step);audio.click();dom.miniFeedback.textContent=`${sauce.label} ${sauce.step}g 덜어냈습니다.`;
  checkYakisobaSauceComplete(m);
}

function checkYakisobaSauceComplete(m){
  const complete=m.data.sauces.every(item=>item.amount===item.target);
  if(complete)m.data.finishing=true;
  renderYakisobaSauce();
  if(complete){
    dom.miniFeedback.textContent="레시피와 정확히 일치합니다!";audio.success();
    setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(m.data.recipe.taskId,m.data.recipe.completionMessage);},360);
  }
}

function setupShrimpCoat(){
  const m=state.mini;if(Number(state.day)!==3)return;
  m.data={mode:"shrimpCoat",step:0,selectedShrimp:false,sequence:[
    {id:"flour",label:"밀가루"},{id:"egg",label:"계란물"},{id:"breadcrumbs",label:"빵가루"}
  ]};
  dom.miniTitle.textContent="새우튀김 · 튀김옷 입히기";
  dom.miniDescription.textContent="새우를 밀가루 → 계란물 → 빵가루 순서로 옮기세요. 새우를 드래그하거나 용기를 클릭할 수 있습니다.";
  renderShrimpCoat();
}

function renderShrimpCoat(){
  const data=state.mini.data,current=data.sequence[data.step];
  dom.miniTimer.textContent=`${data.step} / ${data.sequence.length}`;
  dom.miniContent.innerHTML=`
    <div class="shrimp-coat-order">${data.sequence.map((item,index)=>`<span class="${index<data.step?"done":index===data.step?"current":""}">${index<data.step?"✓ ":""}${item.label}</span>`).join("<b>→</b>")}</div>
    <button type="button" draggable="true" class="prep-shrimp coat-${data.step} ${data.selectedShrimp?"selected":""}" id="prepShrimp" aria-label="튀김옷을 입힐 새우"><i></i></button>
    <div class="shrimp-coat-containers">${data.sequence.map(item=>`<button type="button" class="coat-container ${item.id}" data-coat-id="${item.id}"><i></i><strong>${item.label}</strong></button>`).join("")}</div>
    <div class="cut-count">다음 순서 · ${current?.label||"빵가루 코팅"}</div>`;
  const shrimp=dom.miniContent.querySelector("#prepShrimp");
  shrimp.addEventListener("click",()=>{data.selectedShrimp=!data.selectedShrimp;shrimp.classList.toggle("selected",data.selectedShrimp);dom.miniFeedback.textContent=data.selectedShrimp?"새우를 선택했습니다. 다음 용기를 누르세요.":"새우 선택을 해제했습니다.";});
  shrimp.addEventListener("dragstart",event=>{event.dataTransfer.setData("text/plain","shrimp");event.dataTransfer.effectAllowed="move";});
  dom.miniContent.querySelectorAll("[data-coat-id]").forEach(container=>{
    container.addEventListener("click",()=>applyShrimpCoat(container.dataset.coatId,container));
    container.addEventListener("dragover",event=>event.preventDefault());
    container.addEventListener("drop",event=>{event.preventDefault();applyShrimpCoat(container.dataset.coatId,container);});
  });
}

function applyShrimpCoat(coatId,container){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="shrimpCoat")return;
  const data=m.data,expected=data.sequence[data.step];
  if(coatId!==expected.id){
    container?.classList.remove("wrong");if(container){void container.offsetWidth;container.classList.add("wrong");setTimeout(()=>container.classList.remove("wrong"),300);}
    dom.miniFeedback.textContent=`순서가 달라요. 지금은 ${expected.label} 차례입니다.`;audio.bad();return;
  }
  data.step++;data.selectedShrimp=false;audio.click();dom.miniFeedback.textContent=`${expected.label} 입히기 완료`;
  if(data.step>=data.sequence.length){
    completeDayPrepTask("coatShrimpBatter");
    dom.miniFeedback.textContent="기본 튀김옷 완료 · 빵가루를 고르게 코팅합니다.";
    setTimeout(()=>{if(state.mini===m&&!m.complete)setupBreadcrumbCoat();},420);
  }else renderShrimpCoat();
}

function setupBreadcrumbCoat(){
  const m=state.mini;if(Number(state.day)!==3)return;
  const pair=BREADCRUMB_KEY_PAIRS[Math.floor(Math.random()*BREADCRUMB_KEY_PAIRS.length)];
  m.data={mode:"breadcrumbCoat",keys:[...pair],expectedIndex:0,successes:0,total:14};
  dom.miniTitle.textContent="새우튀김 · 빵가루 코팅";
  dom.miniDescription.textContent="화면에 표시된 두 키를 번갈아 눌러 새우에 빵가루를 고르게 붙이세요.";
  renderBreadcrumbCoat();
}

function renderBreadcrumbCoat(){
  const data=state.mini.data,progress=Math.round(data.successes/data.total*100),stage=progress>=100?3:progress>=70?2:progress>=35?1:0;
  dom.miniTimer.textContent=`${progress}%`;
  dom.miniContent.innerHTML=`
    <div class="breadcrumb-key-pair">${data.keys.map((key,index)=>`<button type="button" data-breadcrumb-key="${key}" class="${index===data.expectedIndex?"expected":""}">${key.toUpperCase()}</button>`).join("<span>↔</span>")}</div>
    <div class="breadcrumb-shrimp stage-${stage}" id="breadcrumbShrimp"><i></i>${Array.from({length:Math.ceil(progress/7)},(_,index)=>`<b style="--crumb-x:${23+(index%7)*15}px;--crumb-y:${14+(index%4)*11}px;--crumb-turn:${index*19}deg"></b>`).join("")}</div>
    <div class="breadcrumb-progress"><i style="width:${progress}%"></i></div>
    <div class="cut-count">빵가루 코팅 ${progress}% · ${data.successes} / ${data.total}</div>`;
  dom.miniContent.querySelectorAll("[data-breadcrumb-key]").forEach(button=>button.addEventListener("click",()=>breadcrumbCoatInput(button.dataset.breadcrumbKey)));
}

function breadcrumbCoatInput(key){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="breadcrumbCoat")return false;
  const data=m.data,normalized=String(key).toLowerCase();
  if(normalized!==data.keys[data.expectedIndex]){dom.miniFeedback.textContent=`${data.keys[data.expectedIndex].toUpperCase()} 차례입니다.`;return false;}
  data.successes++;data.expectedIndex=data.expectedIndex===0?1:0;audio.click();
  if(data.successes>=data.total){finishDayPrepTask("coatShrimpBreadcrumbs","새우튀김 빵가루 코팅 완료");return true;}
  dom.miniFeedback.textContent="좋아요! 반대쪽 키를 누르세요.";renderBreadcrumbCoat();return true;
}

function dayPrepPrimaryAction(){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete)return;
  if(m.data.mode==="rapidCut"){rapidCutKeyDown(false);return;}
  if(m.data.mode==="potatoStarch"){potatoStarchInput(false);return;}
  if(m.data.mode!=="timing")return;
  const data=m.data,zoneStart=data.zoneStarts[data.successes],zoneEnd=zoneStart+data.zoneWidth;
  if(data.requiresDoubleTap&&data.tapStep===1){
    data.tapStep=0;data.tapWindow=0;
    completeDayPrepCut(m);return;
  }
  if(data.marker<zoneStart||data.marker>zoneEnd){
    dom.miniFeedback.textContent="절단선을 놓쳤습니다. 현재 단계에서 다시 시도하세요.";
    audio.bad();
    return;
  }
  if(data.requiresDoubleTap){
    data.tapStep=1;data.tapWindow=.42;
    const work=dom.miniContent.querySelector("#prepWorkObject");
    work?.classList.add("tough-first-hit");
    dom.miniContent.querySelector("#toughCutHint")?.classList.add("first-done");
    const action=dom.miniContent.querySelector("#dayPrepAction");if(action)action.textContent="Space · 한 번 더!";
    dom.miniFeedback.textContent="칼이 걸렸어요 · 빠르게 Space 한 번 더!";audio.click();
    return;
  }
  completeDayPrepCut(m);
}

function completeDayPrepCut(m){
  const data=m.data;
  data.successes++;
  const work=dom.miniContent.querySelector("#prepWorkObject");
  work?.classList.remove("tough-first-hit");
  work?.classList.add("slice-hit");
  const nextAssetKey=timingAssetKey(data.ingredient,data.successes);
  const objectImage=work?.querySelector(".prep-object-asset");
  if(objectImage&&hasDayPrepAsset(nextAssetKey))objectImage.src=dayPrepAssets[nextAssetKey].src;
  dom.miniContent.querySelector(`.cut-line:nth-child(${data.successes})`)?.classList.add("done");
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  const progress=dom.miniContent.querySelector(".cut-count");
  if(progress)progress.textContent=`진행 ${data.successes} / ${data.total}`;
  dom.miniFeedback.textContent=data.requiresDoubleTap?"질긴 고기 절단 성공!":"절단 성공";audio.success();
  if(data.successes>=data.total){
    if(typeof data.onComplete==="function")data.onComplete();
    return;
  }
  setTimeout(()=>{if(state.mini===m&&!m.complete)renderDayPrepTiming();},180);
}

function dayPrepDirectionInput(direction){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="direction")return;
  const data=m.data;
  if(!data.allowedDirections.includes(direction))return;
  if(direction!==data.sequence[data.successes]){
    dom.miniFeedback.textContent="방향이 다릅니다. 검게 변하지 않은 첫 화살표부터 다시 확인하세요.";
    return;
  }
  const completed=dom.miniContent.querySelector(`[data-sequence-index="${data.successes}"]`);
  completed?.classList.remove("current");completed?.classList.add("done");
  data.successes++;
  dom.miniFeedback.textContent="볶기 성공";
  dom.miniContent.querySelector(`[data-sequence-index="${data.successes}"]`)?.classList.add("current");
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  const progress=dom.miniContent.querySelector(".cut-count");
  if(progress)progress.textContent=`진행 ${data.successes} / ${data.total}`;
  const work=dom.miniContent.querySelector("#fryWorkArea");
  if(work){
    const tossClass=direction==="left"?"toss-left":"toss-right";
    work.classList.remove("toss-left","toss-right");void work.offsetWidth;work.classList.add(tossClass);
    setTimeout(()=>work.classList.remove(tossClass),170);
  }
  if(data.successes>=data.total){
    finishDayPrepTask(data.taskId,"두부김치용 김치 볶기 완료");
    return;
  }
}

function updateDayPrepMini(dt){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete)return;
  if(m.data.mode==="rapidCut"){
    const data=m.data,item=currentRapidCutIngredient(data);
    if(item?.cutType===RapidCutType.ToughMeat&&(data.phase==="holding"||data.phase==="embedded")){
      data.holdElapsed=performance.now()/1000-data.holdStart;
      const ratio=Math.min(1,data.holdElapsed/(item.requiredHoldTime||RAPID_CUT_INPUT.toughHoldTime));
      const meter=dom.miniContent.querySelector(".rapid-hold-meter i");if(meter)meter.style.width=`${ratio*100}%`;
      if(data.phase==="holding"&&data.holdElapsed>=RAPID_CUT_INPUT.toughHoldThreshold){data.phase="embedded";dom.miniContent.querySelector("#rapidCutStage")?.classList.add("knife-embedded");dom.miniFeedback.textContent="성공! Space에서 손을 떼세요.";}
    }
    return;
  }
  if(m.data.mode!=="timing")return;
  const data=m.data;
  if(data.requiresDoubleTap&&data.tapStep===1){
    data.tapWindow-=dt;
    if(data.tapWindow<=0){
      data.tapStep=0;data.tapWindow=0;
      dom.miniContent.querySelector("#prepWorkObject")?.classList.remove("tough-first-hit");
      dom.miniContent.querySelector("#toughCutHint")?.classList.remove("first-done");
      const action=dom.miniContent.querySelector("#dayPrepAction");if(action)action.textContent="Space · 빠르게 2번";
      dom.miniFeedback.textContent="두 번째 입력이 늦었어요. 초록 구간에서 다시 두 번!";audio.bad();
    }
    return;
  }
  data.marker+=data.direction*data.speed*dt;
  if(data.marker>=1){data.marker=1;data.direction=-1;}
  if(data.marker<=0){data.marker=0;data.direction=1;}
  const marker=dom.miniContent.querySelector("#dayPrepMarker");
  if(marker)marker.style.left=`${data.marker*100}%`;
}

function finishDayPrepTask(taskId,message){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete)return;
  m.complete=true;
  completeDayPrepTask(taskId);
  dom.miniTimer.textContent="완료";
  dom.miniFeedback.textContent=message;
  dom.miniContent.classList.add("prep-complete-flash");
  setTimeout(()=>{if(state.mini===m)closeDayPrepMini(true);},520);
}

function closeDayPrepMini(completed=false){
  if(!isDayPrepMini())return;
  state.mini=null;
  state.joyX=0;state.joyY=0;state.player.moving=false;
  dom.miniOverlay.classList.remove("open");
  dom.miniClose.hidden=true;
  dom.miniContent.classList.remove("prep-complete-flash");
  dom.miniContent.innerHTML="";
  updateUI(true);
  saveGame();
  if(completed!==true)showToast("준비 작업을 닫았습니다. 다시 상호작용해 이어갈 수 있습니다.");
}
