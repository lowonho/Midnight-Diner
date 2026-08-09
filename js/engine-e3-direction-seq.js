"use strict";

/* ============================================================
   E3 방향 시퀀스 — 슬라이드 입력·단일 판정 컨트롤러

     김치 볶기 (낮 준비)   ← ↑ → ↓ 중 10회
     볶음우동 (밤 조리)    ← ↑ → ↓ 중 10회

   화면에 나온 화살표 방향으로 팬·철판 영역을 슬라이드합니다. 입력 순서 생성,
   포인터 방향 판정, 정답·오답 판정, 진행 및 완료 처리는 같은 컨트롤러가
   담당합니다. 키보드 방향키는 진행 입력으로 사용하지 않습니다.
   ============================================================ */

registerDayPrepSetup("kimchiFry",taskId=>setupKimchiFry(taskId));

/* ---- 공통 판정 규칙 ---------------------------------------- */

// 입력이 지금 차례와 맞는가
function sequenceMatches(sequence,index,input){
  return sequence[index]===input;
}

/* ============================================================
   1. 김치 볶기 (낮 준비)

   화면 구성 (그림은 assets/minigame/E3 · E3/Kimchi 의 납품 에셋입니다)
     왼쪽   재료 카드 — 썰은 김치 ×1 · 설탕 ×1 (보여주기만 합니다)
     가운데 불 위의 팬
     오른쪽 진행도 + 다음 순서 화살표
     아래   화살표 10칸. 지금 눌러야 할 칸이 금색으로 켜집니다.

   조작은 팬 영역을 화살표 방향으로 슬라이드합니다.
   횟수·허용 방향·슬라이드 거리·오답 감점은 아래 E3 공통 설정에서 정합니다.

   [공용 프레임과의 관계]  김치전 반죽·닭꼬치와 같습니다.
   css/minigame-frame.css 와 ui-mini-frame.js 는 건드리지 않고,
   이 게임이 켜져 있을 때만 적용되는 규칙으로 덮어씁니다.
   (css/day-prep-minigames.css 의 "김치 볶기" 구역 참고)
   ------------------------------------------------------------ */

const FRY_DIRECTION_ARROWS=Object.freeze({left:"←",up:"↑",right:"→",down:"↓"});

/* ---- 방향 화살표 그림 --------------------------------------
   assets/minigame/E3/ui_arrow_*.webp 를 아래 화살표 칩과 오른쪽 '다음 순서'
   칸 두 자리에 씁니다. 김치 볶기와 볶음우동이 같은 파일을 나눠 씁니다.
   파일이 없으면 예전처럼 글자 화살표(← ↑ → ↓)가 그대로 나옵니다.
   (경로는 day-prep-minigames.js 의 DAY_PREP_ASSET_PATHS 참고) */
function directionArrowAssetKey(direction){
  return direction?`arrow${direction[0].toUpperCase()}${direction.slice(1)}`:"";
}
// className 은 자리마다 크기가 달라서 받습니다 (칩 안 46 / '다음 순서' 128).
function directionArrowMarkup(direction,className){
  const glyph=FRY_DIRECTION_ARROWS[direction];
  if(!glyph)return "✓";                    // 다 볶아서 다음 순서가 없을 때
  const key=directionArrowAssetKey(direction);
  return hasDayPrepAsset(key)?dayPrepAssetMarkup(key,className,glyph):glyph;
}

const DIRECTION_SEQUENCE_CONFIG=Object.freeze({
  kimchi:Object.freeze({
    total:10,
    // 볶음우동과 같은 네 방향입니다. 김치 그림도 방향마다 한 장씩 있습니다
    // (assets/minigame/E3/Kimchi/food_stirfried_kimchi_stir_*.png).
    directions:Object.freeze(["left","up","right","down"]),
    // 작업 영역 짧은 변의 45%를 한 번에 밀어야 판정합니다.
    // 화살표마다 손을 떼고 팬을 가로지르듯 크게 휘젓습니다.
    // ⚠️ 짧은 변 기준이라 네 방향이 전부 같은 거리(226)입니다 — 위아래만 멀지 않습니다.
    slideStep:.45,
    wrongPenalty:0,
    ingredients:Object.freeze([
      Object.freeze({id:"kimchi",label:"썰은 김치",count:1,asset:"fryIngKimchi"}),
      Object.freeze({id:"sugar",label:"설탕",count:1,asset:"fryIngSugar"})
    ])
  }),
  yakisoba:Object.freeze({
    total:10,
    directions:Object.freeze(["left","up","right","down"]),
    // 철판도 한 획마다 짧은 변의 45%를 크게 밀도록 김치 볶기와 통일합니다.
    slideStep:.45,
    wrongPenalty:10,
    wrongOncePerStep:true
  })
});

const E3_FEEL_CONFIG=Object.freeze({
  maxDirectionRun:2,
  wrongLockMs:150,
  actionMs:240,
  completeDelayMs:620
});

function directionCompletionGrade(data){return (data.errors||0)===0?"perfect":"good";}

function directionVisualStage(index,total){
  if(index>=total)return 3;
  return Math.min(2,Math.floor(index/Math.max(1,total)*3));
}

function processDirectionSequenceInput(m,direction,{sequenceKey,indexKey,onWrong,onCorrect,onComplete}){
  const data=m?.data,config=data&&DIRECTION_SEQUENCE_CONFIG[data.configId];
  if(!data||!config||m.complete||data.inputLocked||data.transitioning||data.phase==="complete")return false;
  const index=data[indexKey];
  if(!sequenceMatches(data[sequenceKey],index,direction)){
    const alreadyWrong=config.wrongOncePerStep&&data.wrongSteps?.includes(index);
    if(!alreadyWrong){
      data.errors=(data.errors||0)+1;
      if(config.wrongOncePerStep)(data.wrongSteps||(data.wrongSteps=[])).push(index);
    }
    audio.bad();
    onWrong?.(data,index);
    return true;
  }
  data[indexKey]=index+1;
  onCorrect?.(data,index);
  if(data[indexKey]>=config.total)onComplete?.(data,config);
  return true;
}

registerDayPrepEngine("direction",{});

/* ---- 공통 슬라이드 입력 ------------------------------------
   누른 지점부터 작업 영역 짧은 변의 slideStep 만큼 크게 밀면 방향 입력 1회입니다.
   한 번 누른 동안에는 한 획만 인정하며, 다음 화살표는 손을 떼고 다시 휘젓습니다. */
function bindDirectionSlide({surfaceSelector,gestureScaleSelector,isActive,onDirection,onDragStart,onDragEnd}){
  const surface=dom.miniContent.querySelector(surfaceSelector);if(!surface)return;
  surface.addEventListener("pointerdown",event=>{
    const m=state.mini;if(!isActive(m)||m.complete||m.data.inputLocked||m.data.phase==="complete")return;
    if(event.pointerType==="mouse"&&event.button!==0)return;
    event.preventDefault();m.data.drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,accepted:false};
    surface.setPointerCapture?.(event.pointerId);surface.classList.add("direction-sliding");
    onDragStart?.(m.data);
  });
  surface.addEventListener("pointermove",event=>{
    const m=state.mini,drag=m?.data?.drag;if(!isActive(m)||m.complete||!drag||drag.pointerId!==event.pointerId)return;
    event.preventDefault();
    if(drag.accepted)return;
    if(m.data.inputLocked||m.data.phase==="complete"){
      drag.x=event.clientX;drag.y=event.clientY;return;
    }
    const scaleSurface=gestureScaleSelector?dom.miniContent.querySelector(gestureScaleSelector):surface;
    const scaleRect=(scaleSurface||surface).getBoundingClientRect(),surfaceRect=surface.getBoundingClientRect();
    const scaleSize=Math.min(scaleRect.width,scaleRect.height),surfaceSize=Math.min(surfaceRect.width,surfaceRect.height);
    const config=DIRECTION_SEQUENCE_CONFIG[m.data.configId],step=(scaleSize||surfaceSize)*(config?.slideStep||.17);
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!step||Math.max(Math.abs(dx),Math.abs(dy))<step)return;
    drag.accepted=true;
    onDirection(Math.abs(dx)>=Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up"));
  });
  const finish=event=>{
    const m=state.mini,drag=m?.data?.drag;if(!isActive(m)||!drag||drag.pointerId!==event.pointerId)return;
    m.data.drag=null;surface.classList.remove("direction-sliding");
    onDragEnd?.(m.data);
  };
  surface.addEventListener("pointerup",finish);
  surface.addEventListener("pointercancel",finish);
  surface.addEventListener("lostpointercapture",finish);
  surface.addEventListener("dragstart",event=>event.preventDefault());
}

// 같은 동작을 두 번까지 이어 허용하되, 세 번 연속은 나오지 않게 합니다.
// 두 게임 다 네 방향이라 순서가 충분히 흩어지고, 번갈아 누르기로는 안 풀립니다.
function randomFryDirections(allowedDirections,length,random=Math.random){
  const sequence=[];
  for(let index=0;index<length;index++){
    const previous=sequence[index-1];
    let runLength=0;
    for(let cursor=index-1;cursor>=0&&sequence[cursor]===previous;cursor--)runLength++;
    const limitedPool=runLength>=E3_FEEL_CONFIG.maxDirectionRun?allowedDirections.filter(direction=>direction!==previous):allowedDirections;
    const pool=limitedPool.length?limitedPool:allowedDirections;
    sequence.push(pool[Math.floor(random()*pool.length)]);
  }
  return sequence;
}

function directionSequenceClasses(index,current){
  if(index<current)return "done";
  if(index===current)return "current";
  return index<=current+2?"upcoming":"queued";
}

function showDirectionGrade(grade,score=null){
  const result=dom.miniContent.querySelector("#e3Result");
  if(!result)return;
  // 점수가 있는 밤 조리는 그 점수로, 등급만 있는 낮 준비는 등급으로 —
  // 어느 쪽이든 나오는 말은 "완벽해요! / 맛있어요! / 아쉬워요!" 한 벌입니다.
  result.textContent=Number.isFinite(score)?cookingScoreMessage(score):dayPrepGradeText(grade);
  result.className=`e3-result show ${grade}`;
}

function lockDirectionInput(m,targetSelector,message){
  const data=m.data;if(data.inputLocked||data.phase==="complete")return;
  data.inputLocked=true;
  const work=dom.miniContent.querySelector(targetSelector);
  work?.classList.add("input-wrong");
  dom.miniFeedback.textContent=message;
  miniSetTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    data.inputLocked=false;work?.classList.remove("input-wrong");
  },E3_FEEL_CONFIG.wrongLockMs);
}

function completeDirectionSequence(m,{workSelector,feedback,onDone,score=null}){
  const data=m.data,grade=directionCompletionGrade(data);
  data.completionGrade=grade;
  data.transitioning=true;data.inputLocked=true;data.phase="complete";
  dom.miniContent.querySelector(workSelector)?.classList.add("e3-complete",`cook-stage-${directionVisualStage(data.successes??data.index,data.total)}`);
  showDirectionGrade(grade,score);
  dom.miniFeedback.textContent=feedback(grade);
  miniSetTimeout(()=>{if(state.mini===m&&!m.complete)onDone(grade);},E3_FEEL_CONFIG.completeDelayMs);
}

/* ---- 김치 볶기 그림 두 벌 ----------------------------------
   팬 안의 김치와 나무 주걱은 둘 다 **한 자리에 겹쳐 두고 갈아 끼우는 연속 그림**입니다.
   어느 장이 보이는지는 전부 CSS 가 정합니다 — 자바스크립트는 `.kf-board` 의
   stir-○ 클래스(이미 있던 것)와 주걱의 data-spatula 만 바꿉니다.
   (파일 경로는 day-prep-minigames.js 의 DAY_PREP_ASSET_PATHS 참고) */

// 방향 → 그 방향으로 뒤집은 김치 그림 키. 방향 문자열이 그대로 키가 됩니다.
function fryKimchiStirAssetKey(direction){
  return direction?`fryKimchiStir${direction[0].toUpperCase()}${direction.slice(1)}`:"";
}

/* 팬 안에 겹쳐 깔 김치 그림. 평소 모습 1장 + 방향 4장입니다.
   순서에 쓰는 방향(DIRECTION_SEQUENCE_CONFIG.kimchi.directions)과 상관없이 넷을 다
   깔아 둡니다 — 방향을 줄였다 늘렸다 해도 코드를 고칠 것이 없습니다. */
const FRY_KIMCHI_STIR_POSES=Object.freeze(["left","up","right","down"]);
const FRY_STIR_CLASSES=Object.freeze(FRY_KIMCHI_STIR_POSES.map(pose=>`stir-${pose}`));

function fryKimchiHasArt(){return hasDayPrepAsset("fryKimchiBase");}
function fryKimchiFramesMarkup(){
  return [["fryKimchiBase","base"],...FRY_KIMCHI_STIR_POSES.map(pose=>[fryKimchiStirAssetKey(pose),pose])]
    .map(([key,pose])=>dayPrepAssetMarkup(key,`frying-kimchi-asset kimchi-${pose}`,pose==="base"?"볶는 김치":""))
    .join("");
}

/* 나무 주걱(토끼 손잡이) 3장. 어느 장을 보일지는 손놀림이 정합니다.
     clean     한 번도 안 저은 깨끗한 주걱
     stirring  젓는 중 — 손을 대고 있는 동안
     rested    한 번 젓고 손을 뗀 상태
   ⚠️ 세 장이 다 있어야 has-prep-asset 을 붙입니다. 한 장이라도 없으면 상태가 바뀔 때
      주걱이 사라져 버리므로, 그럴 바에는 임시 CSS 도형을 그대로 쓰는 편이 낫습니다. */
const FRY_SPATULA_ASSETS=Object.freeze({clean:"frySpatulaClean",stirring:"frySpatulaStirring",rested:"frySpatulaRested"});

function frySpatulaHasArt(){return Object.values(FRY_SPATULA_ASSETS).every(hasDayPrepAsset);}

/* 주걱을 커서로 내보낼지, 팬에 붙여 둘지.
   ⚠️ **지금은 언제나 팬에 붙입니다.** 볶음우동(철판 볶기)과 같이 주걱을 **김치와 팬
      사이에** 끼워 두기로 했습니다 — 날이 김치 더미에 파묻혀야 퍼 올리는 것처럼
      보입니다(css/minigame/e3-kimchi-fry.css 의 .kf-wood-spatula 주석).
      포인터를 따라다니는 주걱은 화면 맨 위(z-index 70)에 떠 있어서 그 층에 못 들어갑니다.
   되돌리려면 이 함수만 예전 조건으로 돌리면 됩니다 — 아래 커서 장치
   (mountFrySpatulaCursor 아래 한 묶음)는 그대로 남겨 두었습니다.
     if(!frySpatulaHasArt())return false;
     return window.matchMedia?window.matchMedia("(hover: hover)").matches:true; */
function frySpatulaAsCursor(){
  return false;
}
function frySpatulaFramesMarkup(){
  return Object.entries(FRY_SPATULA_ASSETS)
    .map(([pose,key])=>dayPrepAssetMarkup(key,`kf-wood-spatula-asset spatula-${pose}`,pose==="clean"?"나무 주걱":""))
    .join("");
}
function frySpatulaState(data,dragging){
  return dragging?"stirring":(data.stirred?"rested":"clean");
}
// 주걱은 커서로 나갔을 때와 팬 위에 붙어 있을 때(임시 도형) 자리가 다릅니다. 둘 다 씁니다.
function setFrySpatulaState(data,dragging){
  const pose=frySpatulaState(data,dragging);
  const tool=dom.miniContent.querySelector(".kf-wood-spatula");
  if(tool)tool.dataset.spatula=pose;
  if(frySpatulaCursor)frySpatulaCursor.dataset.spatula=pose;
}

/* ---- 나무 주걱 커서 -----------------------------------------
   팬 칸 위에 마우스를 올리면 포인터가 나무 주걱으로 바뀝니다. 그림이 세 장 다
   있을 때만이고, 그때는 팬에 붙어 있던 주걱을 빼서 **커서 한 자루만** 남깁니다.
   (E5 김치전의 고양이 발 뒤집개 · E6 튀기기의 집게와 같은 방식입니다)

   CSS `cursor: url()` 이 아니라 DOM 한 겹을 body 에 붙여 따라다니게 합니다 —
   크롬이 커서 그림을 128x128 로 제한해서 그 크기로는 주걱이 뭉개집니다.
   기본 포인터를 숨기는 것은 css 의 `.kf-scene.has-spatula .kf-board { cursor:none }` 입니다.

   [치우기] 미니게임 엔진에는 teardown 이 없습니다. 그래서 포인터가 움직일 때마다
   화면이 아직 있는지 보고, 없으면 그때 스스로 지웁니다 (E5 와 같은 한계입니다 —
   미니게임을 닫고 마우스를 **한 번도 안 움직이면** 주걱이 잠깐 남아 있습니다). */
const FRY_SPATULA_ZONE=".kf-board";        // 화구 + 팬이 있는 가운데 칸
let frySpatulaCursor=null;                 // document.body 에 붙는 <div>
let frySpatulaCursorListening=false;

function mountFrySpatulaCursor(){
  if(!frySpatulaCursor){
    const root=document.createElement("div");
    root.className="kf-spatula-cursor";
    root.dataset.spatula="clean";
    root.setAttribute("aria-hidden","true");
    // 회전은 안쪽 <i> 가 맡습니다 — 바깥 상자의 transform 은 포인터에 맞추는
    // 자리 잡기(translate)라, 여기에 회전을 얹으면 서로 덮어씁니다.
    root.innerHTML=`<i class="kf-spatula-cursor-art">${frySpatulaFramesMarkup()}</i>`;
    document.body.appendChild(root);
    frySpatulaCursor=root;
  }
  if(frySpatulaCursorListening)return;
  frySpatulaCursorListening=true;
  // capture 로 받습니다 — 중간에서 이벤트를 막아도 커서는 따라가야 합니다.
  ["pointermove","pointerdown","pointerup","pointercancel"]
    .forEach(type=>document.addEventListener(type,trackFrySpatulaCursor,true));
}

function removeFrySpatulaCursor(){
  frySpatulaCursor?.remove();
  frySpatulaCursor=null;
  frySpatulaCursorListening=false;
  ["pointermove","pointerdown","pointerup","pointercancel"]
    .forEach(type=>document.removeEventListener(type,trackFrySpatulaCursor,true));
}

function trackFrySpatulaCursor(event){
  if(!frySpatulaCursor)return;
  const scene=dom.miniContent?.querySelector(".kf-scene.has-spatula");
  if(!scene){removeFrySpatulaCursor();return;}          // 미니게임이 끝났습니다
  /* 젓는 동안에는 팬 칸을 벗어나도 계속 보입니다. 한 획이 짧은 변의 45%(226)라
     팬 칸 밖까지 밀고 나가는 일이 흔한데, 거기서 주걱이 사라지면 손이 끊깁니다.
     (포인터가 이미 붙잡혀 있어서 입력은 계속 들어갑니다)
     ⚠️ 손을 떼는 순간은 젓는 중으로 치지 않습니다. 이 listener 는 capture 라
        bindDirectionSlide 가 drag 를 비우기 **전에** 불리는데, 그걸 그대로 믿으면
        칸 밖에서 손을 뗐을 때 주걱이 다음 마우스 움직임까지 남아 있습니다. */
  const releasing=event.type==="pointerup"||event.type==="pointercancel";
  const dragging=!releasing&&!!state.mini?.data?.drag;
  const over=dragging||(event.target instanceof Element&&scene.contains(event.target)
    &&!!event.target.closest(FRY_SPATULA_ZONE));
  frySpatulaCursor.classList.toggle("show",over);
  if(!over)return;
  frySpatulaCursor.style.left=`${event.clientX}px`;
  frySpatulaCursor.style.top=`${event.clientY}px`;
}

// 틀린 방향으로 저었을 때의 짧은 도리질. 팬에 붙은 주걱은 CSS(.kf-board.input-wrong)가
// 맡지만, 커서는 body 에 있어 그 규칙이 안 닿으므로 여기서 직접 붙였다 뗍니다.
function shakeFrySpatulaCursor(){
  const root=frySpatulaCursor;if(!root)return;
  root.classList.remove("wrong");void root.offsetWidth;root.classList.add("wrong");
  miniSetTimeout(()=>root.classList.remove("wrong"),E3_FEEL_CONFIG.wrongLockMs);
}

function setupKimchiFry(taskId="fryTofuKimchi"){
  const config=DIRECTION_SEQUENCE_CONFIG.kimchi;
  const m=setDayPrepData({
    mode:"direction",
    configId:"kimchi",
    taskId,
    successes:0,
    errors:0,
    phase:"ready",
    inputLocked:false,
    transitioning:false,
    drag:null,
    // 한 번이라도 저었는지. 나무 주걱 그림이 깨끗한 장 → 김치가 묻은 장으로 바뀝니다.
    stirred:false,
    total:config.total,
    allowedDirections:[...config.directions],
    ingredients:config.ingredients,
    sequence:randomFryDirections(config.directions,config.total)
  });
  audio.loop?.("pan_sizzle",m,.6);
  dom.miniTitle.textContent="김치 볶기";
  dom.miniDescription.textContent="화살표 방향대로 팬 위를 슬라이드해 김치와 설탕을 함께 볶아주세요!";
  renderKimchiFry();
}

function renderKimchiFry(){
  const data=state.mini.data;
  /* 주걱을 커서로 내보내면 팬에는 붙이지 않습니다 — 둘 다 두면 두 자루로 보입니다.
     터치 화면이나 그림이 없을 때는 예전처럼 팬 위에 남습니다 (frySpatulaAsCursor). */
  const spatulaAsCursor=frySpatulaAsCursor();
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;   // 공용 카드는 CSS 로 숨겨져 있습니다
  dom.miniContent.innerHTML=`
    <div class="kf-scene ${spatulaAsCursor?"has-spatula":""}">
      <aside class="kf-col">
        <div class="kf-panel kf-ing-panel">
          <h3 class="kf-col-title starred">재료</h3>
          <div class="kf-ing-list">${data.ingredients.map(item=>`
            <div class="kf-ing-card ${item.id}">
              <span class="kf-ing-art ${hasDayPrepAsset(item.asset)?"has-asset":""}"><i></i>${dayPrepAssetMarkup(item.asset,"kf-ing-asset",item.label)}</span>
              <span class="kf-ing-name">${item.label}<b>×${item.count}</b></span>
            </div>`).join("")}</div>
        </div>
      </aside>

      <div class="kf-board cook-stage-${directionVisualStage(data.successes,data.total)}" id="fryWorkArea">
        ${minigameBurnerMarkup("gas")}
        <div class="frying-pan ${hasDayPrepAsset("fryingPan")?"has-prep-asset":""}">
          ${dayPrepAssetMarkup("fryingPan","frying-pan-asset","후라이팬")}
          <i class="frying-kimchi ${fryKimchiHasArt()?"has-prep-asset":""}">${fryKimchiFramesMarkup()}</i>
          ${minigameSmokeMarkup(3)||`<i class="kf-steam steam-one"></i><i class="kf-steam steam-two"></i>`}
          ${spatulaAsCursor?"":`<i class="kf-wood-spatula ${frySpatulaHasArt()?"has-prep-asset":""}" data-spatula="${frySpatulaState(data,false)}">${frySpatulaFramesMarkup()}</i>`}
        </div>
        <span class="e3-result" id="e3Result" aria-live="polite"></span>
      </div>

      <aside class="kf-col">
        <div class="kf-panel kf-count">
          <h3 class="kf-col-title">진행도</h3>
          <strong id="fryCount">${data.successes} / ${data.total}</strong>
        </div>
        <div class="kf-panel kf-next">
          <h3 class="kf-col-title">다음 순서</h3>
          <div class="kf-next-arrow" id="fryNextArrow">${directionArrowMarkup(data.sequence[data.successes],"kf-next-arrow-asset")}</div>
        </div>
      </aside>

      <div class="kf-seq" aria-label="볶기 방향 순서">
        ${data.sequence.map((direction,index)=>`<span class="kf-chip ${directionSequenceClasses(index,data.successes)}" data-sequence-index="${index}">${directionArrowMarkup(direction,"kf-chip-asset")}</span>`).join("")}
      </div>
    </div>`;
  // 연기 기둥의 첫 자리를 잡습니다 (day-prep-minigames.js 의 mountMinigameSmoke).
  // 이걸 빼면 기둥이 공용 기본 자리에 겹쳐 서서 한 줄로만 보입니다.
  mountMinigameSmoke(dom.miniContent);
  bindDirectionSlide({
    surfaceSelector:".kf-scene",
    gestureScaleSelector:"#fryWorkArea",
    isActive:m=>isDayPrepMini(m)&&m.data.mode==="direction"&&m.data.configId==="kimchi",
    onDirection:direction=>kimchiFryInput(direction),
    // 주걱은 손을 대는 순간부터 젓는 장으로 바뀝니다 (한 획을 다 밀 때까지 기다리지 않습니다)
    onDragStart:data=>setFrySpatulaState(data,true),
    onDragEnd:data=>setFrySpatulaState(data,false)
  });
  if(spatulaAsCursor)mountFrySpatulaCursor();
}

function kimchiFryInput(direction,repeat=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="direction")return;
  if(repeat)return false;
  const data=m.data;
  // 한 획을 밀었으면 방향이 틀렸어도 주걱에는 김치가 묻습니다
  data.stirred=true;
  const current=dom.miniContent.querySelector(`[data-sequence-index="${data.successes}"]`);
  processDirectionSequenceInput(m,direction,{
    sequenceKey:"sequence",indexKey:"successes",
    onWrong(){
      if(current){current.classList.remove("wrong");void current.offsetWidth;current.classList.add("wrong");miniSetTimeout(()=>current.classList.remove("wrong"),260);}
      lockDirectionInput(m,"#fryWorkArea",`${FRY_DIRECTION_ARROWS[data.sequence[data.successes]]} 방향입니다. 나무 주걱을 그 방향으로 움직이세요.`);
      shakeFrySpatulaCursor();
    },
    onCorrect(){
      audio.play?.("wood_stir",{owner:m});
      current?.classList.remove("current");current?.classList.add("done");
      dom.miniFeedback.textContent="볶기 성공";
      dom.miniContent.querySelector(`[data-sequence-index="${data.successes}"]`)?.classList.remove("upcoming");
      dom.miniContent.querySelector(`[data-sequence-index="${data.successes}"]`)?.classList.add("current");
      dom.miniContent.querySelector(`[data-sequence-index="${data.successes+2}"]`)?.classList.remove("queued");
      dom.miniContent.querySelector(`[data-sequence-index="${data.successes+2}"]`)?.classList.add("upcoming");
      dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
      const count=dom.miniContent.querySelector("#fryCount");
      if(count)count.textContent=`${data.successes} / ${data.total}`;
      const nextArrow=dom.miniContent.querySelector("#fryNextArrow");
      if(nextArrow)nextArrow.innerHTML=directionArrowMarkup(data.sequence[data.successes],"kf-next-arrow-asset");
      const work=dom.miniContent.querySelector("#fryWorkArea");
      if(work){
        // stir-○ 는 팬 안의 김치를 그 방향으로 뒤집은 장으로 바꿉니다 (240ms 뒤 base 로 돌아옵니다)
        const actionClass=`stir-${direction}`,stage=`cook-stage-${directionVisualStage(data.successes,data.total)}`;
        work.classList.remove(...FRY_STIR_CLASSES,"cook-stage-0","cook-stage-1","cook-stage-2","cook-stage-3");void work.offsetWidth;work.classList.add(actionClass,stage);
        miniSetTimeout(()=>work.classList.remove(actionClass),E3_FEEL_CONFIG.actionMs);
      }
    },
    onComplete(){completeDirectionSequence(m,{
      workSelector:"#fryWorkArea",
      feedback:grade=>grade==="perfect"?"나무 주걱으로 완벽하게 볶았습니다!":"김치를 먹음직스럽게 볶았습니다!",
      onDone:()=>finishDayPrepTask(data.taskId,"두부김치용 김치 볶기 완료")
    });}
  });
}

/* ============================================================
   2. 볶음우동 조리 (밤 조리 · 철판 볶기)

   화면 구성 (그림은 assets/minigame/E3 의 납품 에셋입니다)
     왼쪽   재료 카드 — 우동 ×1 · 소스 ×1 · 손질 야채 ×1 (보여주기만 합니다)
     가운데 불 위의 철판 + 볶이는 면
     오른쪽 진행도 + 다음 순서 화살표
     아래   화살표 10칸. 지금 눌러야 할 칸이 금색으로 켜집니다.

   조작은 철판 위를 화살표 방향으로 슬라이드하는 방식만 사용합니다.
   (레퍼런스 화면에 조작 버튼이 없어서 클릭 버튼은 두지 않았습니다)

   [제한시간]  레퍼런스 화면에 시계가 없어서 timerRuns 를 꺼 두었습니다.
   되돌리려면 아래 timerRuns 한 줄만 지우면 set() 의 10초가 다시 흐릅니다.

   [공용 프레임과의 관계]  김치 볶기와 같습니다.
   css/minigame-frame.css 와 ui-mini-frame.js 는 건드리지 않고,
   이 게임이 켜져 있을 때만 적용되는 규칙으로 덮어씁니다.
   (css/minigames.css 의 "볶음우동 조리" 구역 참고)
   ------------------------------------------------------------ */

const STIR_TOTAL=DIRECTION_SEQUENCE_CONFIG.yakisoba.total;
const STIR_DIRECTIONS=DIRECTION_SEQUENCE_CONFIG.yakisoba.directions;
const STIR_WRONG_PENALTY=DIRECTION_SEQUENCE_CONFIG.yakisoba.wrongPenalty;
// 왼쪽 재료 카드. 개수·이름만 바꾸면 카드가 그대로 바뀝니다.
const STIR_INGREDIENTS=Object.freeze([
  Object.freeze({id:"udon",label:"우동",count:1,asset:"stirIngUdon"}),
  Object.freeze({id:"sauce",label:"소스",count:1,asset:"stirIngSauce"}),
  Object.freeze({id:"veggie",label:"손질 야채",count:1,asset:"stirIngVeggie"})
]);

/* ---- 볶음우동 그림 두 벌 ----------------------------------
   **김치 볶기와 같은 규칙입니다** (위 "김치 볶기 그림 두 벌" 참고) — 철판 위의 면과
   뒤집개는 둘 다 한 자리에 겹쳐 두고 갈아 끼우는 연속 그림이고, 어느 장이 보이는지는
   전부 CSS 가 정합니다. 자바스크립트는 `.yk-board` 의 scrape-○ 클래스(이미 있던 것)와
   뒤집개의 data-spatula 만 바꿉니다.

   ⚠️ 김치 볶기와 **다른 점 두 가지**입니다.
     · 뒤집개가 **두 자루**입니다 (임시 도형 시절과 같은 좌우 한 쌍). 한 장을 좌우로
       뒤집어 나눠 쓰므로 그림은 그대로 3장입니다 — css 의 .spatula-left 참고.
     · 뒤집개를 **마우스 포인터로 내보내지 않습니다.** 김치 볶기의 나무 주걱은
       포인터를 따라다니지만(mountFrySpatulaCursor), 여기는 철판 위에 늘 놓여
       있는 두 자루가 화면의 일부입니다.
   (파일 경로는 day-prep-minigames.js 의 DAY_PREP_ASSET_PATHS 참고) */

// 방향 → 그 방향으로 볶은 면 그림 키. 방향 문자열이 그대로 키가 됩니다.
function stirUdonPoseAssetKey(direction){
  return direction?`stirUdon${direction[0].toUpperCase()}${direction.slice(1)}`:"";
}

/* 철판 위에 겹쳐 깔 면 그림. 평소 모습 1장 + 방향 4장입니다.
   순서에 쓰는 방향(STIR_DIRECTIONS)과 상관없이 넷을 다 깔아 둡니다. */
const STIR_UDON_POSES=Object.freeze(["left","up","right","down"]);
const STIR_SCRAPE_CLASSES=Object.freeze(STIR_UDON_POSES.map(pose=>`scrape-${pose}`));

function stirUdonHasArt(){return hasDayPrepAsset("stirUdonBase");}
function stirUdonFramesMarkup(){
  return [["stirUdonBase","base"],...STIR_UDON_POSES.map(pose=>[stirUdonPoseAssetKey(pose),pose])]
    .map(([key,pose])=>dayPrepAssetMarkup(key,`yk-food-asset udon-${pose}`,pose==="base"?"볶이는 우동":""))
    .join("");
}

/* 철판 뒤집개(너구리 손잡이) 3장. 김치 볶기의 나무 주걱과 상태 이름이 같습니다.
     clean     한 번도 안 볶은 깨끗한 뒤집개
     stirring  볶는 중 — 손을 대고 있는 동안
     rested    한 번 볶고 손을 뗀 상태
   ⚠️ 세 장이 다 있어야 has-prep-asset 을 붙입니다 (김치 볶기와 같은 이유 —
      한 장이라도 없으면 상태가 바뀔 때 뒤집개가 사라집니다). */
const STIR_SPATULA_ASSETS=Object.freeze({clean:"stirSpatulaClean",stirring:"stirSpatulaStirring",rested:"stirSpatulaRested"});

function stirSpatulaHasArt(){return Object.values(STIR_SPATULA_ASSETS).every(hasDayPrepAsset);}
function stirSpatulaFramesMarkup(side){
  return Object.entries(STIR_SPATULA_ASSETS)
    .map(([pose,key])=>dayPrepAssetMarkup(key,`yk-spatula-asset spatula-${pose}`,pose==="clean"?`${side} 철판 뒤집개`:""))
    .join("");
}
function stirSpatulaState(data,dragging){
  return dragging?"stirring":(data.stirred?"rested":"clean");
}
// 두 자루가 늘 같은 자세입니다 — 한쪽만 면이 묻어 있으면 짝이 안 맞아 보입니다.
function setStirSpatulaState(data,dragging){
  const pose=stirSpatulaState(data,dragging);
  dom.miniContent.querySelectorAll(".yk-spatula").forEach(tool=>{tool.dataset.spatula=pose;});
}

registerMiniEngine("stir",{
  score(m){
    const data=m?.data;
    return Math.max(0,100-(data?.errors||0)*STIR_WRONG_PENALTY);
  },
  setup(m,{set}){
    set("볶음우동 조리","화살표 방향대로 철판 위를 슬라이드해 볶아주세요!",10);
    m.data={
      configId:"yakisoba",
      arrows:randomFryDirections(STIR_DIRECTIONS,STIR_TOTAL),
      index:0,
      errors:0,
      wrongSteps:[],
      total:STIR_TOTAL,
      phase:"ready",
      inputLocked:false,
      transitioning:false,
      // 한 번이라도 볶았는지. 뒤집개 그림이 깨끗한 장 → 면이 묻은 장으로 바뀝니다.
      stirred:false,
      drag:null
    };
    audio.loop?.("griddle_sizzle",m,.62);
    dom.miniTimer.textContent=`0 / ${STIR_TOTAL}`;          // 공용 카드는 CSS 로 숨겨져 있습니다
    renderStirScene();
  },

  // 레퍼런스 화면에 시계가 없습니다(위 [제한시간] 참고)
  timerRuns(){return false;}
});

function renderStirScene(){
  const data=state.mini?.data;if(!data)return;
  const noodleStrands=Array.from({length:22},(_,index)=>{
    const x=5+(index*17)%76,y=5+(index*29)%72,turn=-42+(index*23)%84,width=26+(index*11)%25;
    return `<i class="yk-noodle" style="--yk-x:${x}%;--yk-y:${y}%;--yk-turn:${turn}deg;--yk-width:${width}%"></i>`;
  }).join("");
  dom.miniContent.innerHTML=`
    <div class="yk-scene">
      <aside class="yk-col">
        <div class="yk-panel yk-ing-panel">
          <h3 class="yk-col-title starred">재료</h3>
          <div class="yk-ing-list">${STIR_INGREDIENTS.map(item=>`
            <div class="yk-ing-card ${item.id}">
              <span class="yk-ing-art ${hasDayPrepAsset(item.asset)?"has-asset":""}"><i></i>${dayPrepAssetMarkup(item.asset,"yk-ing-asset",item.label)}</span>
              <span class="yk-ing-name">${item.label}<b>×${item.count}</b></span>
            </div>`).join("")}</div>
        </div>
      </aside>

      <div class="yk-board cook-stage-${directionVisualStage(data.index,STIR_TOTAL)}" id="stirWorkArea">
        ${minigameBurnerMarkup("griddle")}
        <div class="yk-griddle ${hasDayPrepAsset("stirGriddle")?"has-asset":""}" id="stirPlate">
          ${dayPrepAssetMarkup("stirGriddle","yk-griddle-asset","철판")}
          ${minigameSmokeMarkup(3)||`<i class="yk-steam steam-one"></i><i class="yk-steam steam-two"></i>`}
          <div class="yk-food ${stirUdonHasArt()?"has-prep-asset":""}" id="stirFood">
            <span class="yk-food-fallback" aria-hidden="true">
              ${noodleStrands}
              <b class="yk-garnish cabbage garnish-one"></b><b class="yk-garnish cabbage garnish-two"></b>
              <b class="yk-garnish carrot garnish-one"></b><b class="yk-garnish carrot garnish-two"></b>
              <b class="yk-garnish onion garnish-one"></b><b class="yk-garnish onion garnish-two"></b>
            </span>
            ${stirUdonFramesMarkup()}
          </div>
          ${["left","right"].map(side=>`<i class="yk-spatula spatula-${side} ${stirSpatulaHasArt()?"has-prep-asset":""}" data-spatula="${stirSpatulaState(data,false)}">${stirSpatulaFramesMarkup(side==="left"?"왼쪽":"오른쪽")}</i>`).join("")}
        </div>
        <span class="e3-result" id="e3Result" aria-live="polite"></span>
      </div>

      <aside class="yk-col">
        ${miniScorePanelMarkup("yk-panel yk-count","yk-col-title")}
        <div class="yk-panel yk-next">
          <h3 class="yk-col-title">다음 순서</h3>
          <div class="yk-next-arrow" id="stirNextArrow">${directionArrowMarkup(data.arrows[data.index],"yk-next-arrow-asset")}</div>
        </div>
      </aside>

      <div class="yk-seq" aria-label="볶기 방향 순서">
        ${data.arrows.map((direction,index)=>`<span class="yk-chip ${directionSequenceClasses(index,data.index)}" data-stir-index="${index}">${directionArrowMarkup(direction,"yk-chip-asset")}</span>`).join("")}
      </div>
    </div>`;
  // 연기 기둥의 첫 자리를 잡습니다 (위 renderKimchiFry 와 같습니다)
  mountMinigameSmoke(dom.miniContent);
  bindDirectionSlide({
    surfaceSelector:".yk-scene",
    gestureScaleSelector:"#stirPlate",
    isActive:m=>m?.engine==="stir"&&m.data.configId==="yakisoba",
    onDirection:direction=>stirInput(direction),
    // 뒤집개는 손을 대는 순간부터 볶는 장으로 바뀝니다 (김치 볶기와 같습니다)
    onDragStart:data=>setStirSpatulaState(data,true),
    onDragEnd:data=>setStirSpatulaState(data,false)
  });
}

function stirInput(direction,repeat=false){
  const m=state.mini;if(!m||m.engine!=="stir"||m.complete)return;
  if(repeat)return false;
  const data=m.data;
  // 한 획을 밀었으면 방향이 틀렸어도 뒤집개에는 면이 묻습니다 (김치 볶기와 같습니다)
  data.stirred=true;
  const current=dom.miniContent.querySelector(`[data-stir-index="${data.index}"]`);
  processDirectionSequenceInput(m,direction,{
    sequenceKey:"arrows",indexKey:"index",
    onWrong(){
      if(current){current.classList.remove("wrong");void current.offsetWidth;current.classList.add("wrong");miniSetTimeout(()=>current.classList.remove("wrong"),260);}
      lockDirectionInput(m,"#stirWorkArea",`${FRY_DIRECTION_ARROWS[data.arrows[data.index]]} 방향입니다. 철판 뒤집개를 그 방향으로 움직이세요. (${MINI_ENGINES.stir.score(m)}점)`);
      updateMiniScore(m);
    },
    onCorrect(){
      audio.play?.("metal_scrape",{owner:m});
      current?.classList.remove("current");current?.classList.add("done");
      dom.miniFeedback.textContent="볶기 성공";
      dom.miniContent.querySelector(`[data-stir-index="${data.index}"]`)?.classList.remove("upcoming");
      dom.miniContent.querySelector(`[data-stir-index="${data.index}"]`)?.classList.add("current");
      dom.miniContent.querySelector(`[data-stir-index="${data.index+2}"]`)?.classList.remove("queued");
      dom.miniContent.querySelector(`[data-stir-index="${data.index+2}"]`)?.classList.add("upcoming");
      dom.miniTimer.textContent=`${data.index} / ${STIR_TOTAL}`;
      const count=dom.miniContent.querySelector("#stirCount");
      if(count)count.textContent=`${data.index} / ${STIR_TOTAL}`;
      const nextArrow=dom.miniContent.querySelector("#stirNextArrow");
      if(nextArrow)nextArrow.innerHTML=directionArrowMarkup(data.arrows[data.index],"yk-next-arrow-asset");
      const work=dom.miniContent.querySelector("#stirWorkArea");
      if(work){
        // scrape-○ 는 철판 위의 면을 그 방향으로 볶은 장으로 바꿉니다 (240ms 뒤 base 로 돌아옵니다)
        const actionClass=`scrape-${direction}`,stage=`cook-stage-${directionVisualStage(data.index,STIR_TOTAL)}`;
        work.classList.remove(...STIR_SCRAPE_CLASSES,"cook-stage-0","cook-stage-1","cook-stage-2","cook-stage-3");void work.offsetWidth;work.classList.add(actionClass,stage);
        miniSetTimeout(()=>work.classList.remove(actionClass),E3_FEEL_CONFIG.actionMs);
      }
    },
    onComplete(){completeDirectionSequence(m,{
      workSelector:"#stirWorkArea",
      feedback:grade=>grade==="perfect"?"철판 위 우동을 완벽하게 볶았습니다!":"우동을 맛있게 볶았습니다!",
      score:MINI_ENGINES.stir.score(m),
      onDone:()=>finishMini(Math.max(0,100-data.errors*STIR_WRONG_PENALTY))
    });}
  });
}
