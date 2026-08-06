"use strict";

/* ============================================================
   E10 표적 손질 (낮 준비) — 멸치 머리 떼기

   멸치 7마리가 도마에 무작위 위치·각도·크기로 흩어집니다.
   (마리 수는 day-prep-minigames.js 의 DAY_PREP_MINI_CONFIG.cleanAnchovy.total)
   머리를 누른 채 좌우로 세 번 크게 흔들면 접합부가 버티다가 뜯어집니다.
   몸통을 누르면 실패가 아니라 안내만 보여주고 다시 시도할 수 있습니다.

   [화면 구성] 컨셉 이미지와 같은 3열입니다.
     [재료 카드] [도마] [완성 개수 카드 · 참고 모양 카드]
   좌우 카드는 #miniContent 안에서 이 게임이 직접 그립니다.
   공용 프레임(ui-mini-frame.js · css/minigame-frame.css)은 건드리지 않고,
   css/day-prep-minigames.css 에서 .anchovy-screen 이 있을 때만
   가운데 열 제한을 풀어 좌우 카드 자리를 확보합니다.

   7마리를 다 손질하면 냄비에 넣는 연출(E11, engine-e11-one-shot.js)로
   넘어가고 거기서 태스크가 완료됩니다.

   이 엔진을 쓰는 게임은 지금 이것 하나뿐입니다.
   ============================================================ */

registerDayPrepSetup("anchovy",()=>setupAnchovyPrep());

// 도마 위 멸치 그림 4종. 종류마다 머리·몸통 크기가 달라서 붙이는 좌표도 다릅니다.
// 그 좌표는 css/day-prep-minigames.css 의 .anchovy.v01 ~ .v04 변수에 있습니다.
const ANCHOVY_VARIANTS=Object.freeze(["01","02","03","04"]);

// 시간이 끝났을 때 TIME OVER 판을 보여주는 시간. 이 뒤에는 다시 시도 없이 마감합니다.
const ANCHOVY_TIMEOUT_END_MS=1200;

// 포인터로 머리를 잡아 흔드는 게임이라 키 처리는 없습니다.
registerDayPrepEngine("anchovy",{
  update(m,dt){updateAnchovyTimer(m,dt);}
});

function setupAnchovyPrep(){
  const config=DAY_PREP_MINI_CONFIG.cleanAnchovy;
  // 도마를 2열 x 4행(8칸)으로 나눠 그중 total 칸을 골라 한 마리씩 놓습니다.
  // 칸 안에서 위치·각도·크기를 조금씩 흔들어 자연스럽게 흩어 보이게 합니다.
  //
  // ⚠️ 원래 3열 x 3행이었습니다. 멸치를 210 → 270 으로 키우면서 한 줄에 세
  //    마리가 안 들어가(270 x 3 = 810 > 바닥 730) 2열로 바꿨습니다.
  // ⚠️ x·y 는 .anchovy-floor(나무 쟁반 테두리 **안쪽** 바닥 730 x 506) 기준 %입니다.
  //    멸치는 270 x 최대 66 크기에 ±11° 회전 · 최대 1.06배 확대가 걸려서 자기
  //    자리보다 가로 14 · 세로 29 쯤 더 삐져나옵니다. 아래 범위는 그 몫까지
  //    바닥 안에 들어오고, 옆·아래 이웃과도 안 겹치도록 잡은 값입니다.
  //      가로  왼줄 2~9% (짝수 줄) / 6~13% (홀수 줄)
  //            오른줄 53~56% / 57~60%
  //      세로  6~9 / 30~33 / 54~57 / 78~81%   (줄 간격 24% = 121 > 한 마리 118)
  //
  //    stagger : 한 줄 걸러 4% 씩 오른쪽으로 밀어 놓습니다. 8칸 격자를 그대로
  //    쓰면 두 줄이 세로로 딱 맞아떨어져 "오와열 맞춘" 느낌이 납니다.
  //    가로로 남는 자리가 190 뿐이라(730 - 270 x 2) 흔들 폭을 더 못 키우는
  //    대신, 줄마다 어긋나게 해서 흩어진 느낌을 냅니다.
  const slots=shuffle(Array.from({length:8},(_,index)=>index)).slice(0,config.total);
  // 멸치 그림 4종을 두 벌 섞어 돌려 씁니다. 7마리면 4종이 최소 한 번씩은 나옵니다.
  // 붙이는 좌표는 css/day-prep-minigames.css 의 .anchovy.v01~v04 가 갖고 있습니다.
  const variants=shuffle(ANCHOVY_VARIANTS.concat(ANCHOVY_VARIANTS)).slice(0,config.total);
  setDayPrepData({mode:"anchovy",cleaned:0,total:config.total,timeLimit:config.timeLimit,timeLeft:config.timeLimit,timerWarningPlayed:false,requiredShakes:config.requiredShakes,swingDistance:config.swingDistance,timedOut:false,finishing:false,grip:null,items:slots.map((slot,index)=>{
    const col=slot%2,row=Math.floor(slot/2),stagger=(row%2)*4;
    return {
      id:index,cleaned:false,variant:variants[index],
      x:(col?53:2)+stagger+Math.random()*(col?3:7),
      y:6+row*24+Math.random()*3,
      rotation:-11+Math.random()*22,scale:.94+Math.random()*.12,flip:Math.random()>.5?-1:1
    };
  })});
  dom.miniTitle.textContent=config.title;
  dom.miniDescription.textContent="멸치 머리를 잡고 좌우로 흔들어 뜯어주세요. 제한시간 안에 모두 손질해야 합니다!";
  renderAnchovyPrep();
}

// 사이드 카드(재료 · 참고 모양)에 들어가는 견본 멸치입니다.
// 도마 위 멸치와 같은 조각을 쓰되 클릭 대상이 아니므로 <i> 로 그립니다.
// 견본은 종류를 섞을 이유가 없어 01 로 고정합니다.
function anchovySampleMarkup(cleaned,turn,size,variant="01"){
  const bodyKey=`anchovyBody${variant}`,headKey=`anchovyHead${variant}`;
  const body=`<i class="anchovy-body ${hasDayPrepAsset(bodyKey)?"has-prep-asset":""}">${dayPrepAssetMarkup(bodyKey,"anchovy-body-asset","")}</i>`;
  const head=cleaned?"":`<i class="anchovy-head ${hasDayPrepAsset(headKey)?"has-prep-asset":""}">${dayPrepAssetMarkup(headKey,"anchovy-head-asset","")}</i>`;
  return `<div class="anchovy anchovy-preview v${variant} ${cleaned?"cleaned":""}" style="--turn:${turn}deg;--size:${size};--flip:1" aria-hidden="true">${body}${head}</div>`;
}

// 왼쪽 재료 카드 그림. 이 게임은 "머리를 떼기 전"이라 통멸치 묶음
// (anchovyWholeGroup)을 씁니다. 손질을 마친 묶음 그림은 anchovyGroup 으로
// 따로 있으니 두 그림을 섞지 마세요.
// 그림이 없으면 예전처럼 견본 멸치 한 마리를 그립니다.
function anchovyIngredientArtMarkup(){
  if(!hasDayPrepAsset("anchovyWholeGroup"))return anchovySampleMarkup(false,-32,.72);
  return dayPrepAssetMarkup("anchovyWholeGroup","anchovy-group-asset","통멸치");
}

function renderAnchovyPrep(){
  const data=state.mini.data;
  dom.miniTimer.textContent=`${data.cleaned} / ${data.total}`;
  dom.miniContent.innerHTML=`
    <div class="anchovy-screen">
      <aside class="anchovy-col">
        <div class="anchovy-card anchovy-ing-panel">
          <h3 class="anchovy-card-title starred">재료</h3>
          <div class="anchovy-ing-list">
            <div class="anchovy-ing-card">
              <div class="anchovy-card-figure">${anchovyIngredientArtMarkup()}</div>
              <p class="anchovy-card-caption">멸치 <b>×${data.total}</b></p>
            </div>
          </div>
        </div>
      </aside>
      <div class="anchovy-work-area" id="anchovyWorkArea">
        <div class="anchovy-floor">
        ${data.items.map(item=>`<div class="anchovy v${item.variant} ${item.cleaned?"cleaned":""}" data-id="${item.id}" style="left:${item.x}%;top:${item.y}%;--turn:${item.rotation}deg;--size:${item.scale};--flip:${item.flip}">
          <i class="anchovy-innards ${hasDayPrepAsset("anchovyInnards")?"has-prep-asset":""}" aria-hidden="true"></i>
          <button class="anchovy-body ${hasDayPrepAsset(`anchovyBody${item.variant}`)?"has-prep-asset":""}" type="button" aria-label="${item.id+1}번 멸치 몸통">${dayPrepAssetMarkup(`anchovyBody${item.variant}`,"anchovy-body-asset","")}</button>
          <button class="anchovy-head ${hasDayPrepAsset(`anchovyHead${item.variant}`)?"has-prep-asset":""}" type="button" aria-label="${item.id+1}번 멸치 머리">${dayPrepAssetMarkup(`anchovyHead${item.variant}`,"anchovy-head-asset","")}</button>
        </div>`).join("")}
        </div>
      </div>
      <aside class="anchovy-right">
        <div class="anchovy-card anchovy-count-card">
          <h3 class="anchovy-card-title">완성 개수</h3>
          <p class="anchovy-count" id="anchovyCount"><b>${data.cleaned}</b> / ${data.total}</p>
          <p class="anchovy-time" id="anchovyTime"><span>남은 시간</span><b>${data.timeLeft.toFixed(1)}초</b></p>
        </div>
        <div class="anchovy-card anchovy-ref-card">
          <h3 class="anchovy-card-title">참고 모양</h3>
          <div class="anchovy-card-figure">${anchovySampleMarkup(true,-8,.8)}</div>
        </div>
      </aside>
    </div>`;
  // 사이드 카드의 견본 멸치는 클릭 대상이 아니므로 도마 안쪽만 골라 겁니다.
  dom.miniContent.querySelectorAll("#anchovyWorkArea .anchovy-body").forEach(button=>button.addEventListener("click",()=>{
    dom.miniFeedback.textContent="몸통이 아니라 머리를 잡아주세요.";
  }));
  bindAnchovyTugControls();
}

function createAnchovyGrip(pointerId,x,y){
  return {pointerId,startX:x,startY:y,peakX:x,direction:0,reversals:0,lastDirection:1};
}

function updateAnchovyGrip(grip,x,swingDistance){
  if(!grip.direction){
    const first=x-grip.peakX;
    if(Math.abs(first)>=swingDistance*.45){grip.direction=Math.sign(first);grip.peakX=x;grip.lastDirection=grip.direction;}
    return false;
  }
  if(grip.direction>0){
    grip.peakX=Math.max(grip.peakX,x);
    if(x<=grip.peakX-swingDistance){grip.direction=-1;grip.peakX=x;grip.lastDirection=-1;grip.reversals++;return true;}
  }else{
    grip.peakX=Math.min(grip.peakX,x);
    if(x>=grip.peakX+swingDistance){grip.direction=1;grip.peakX=x;grip.lastDirection=1;grip.reversals++;return true;}
  }
  return false;
}

function anchovyTugPose(tugX,tugY,flip=1){
  // 판정은 포인터의 전체 이동량을 쓰되, 화면에서는 접합부가 벌어지지 않을 만큼만 움직입니다.
  return {
    x:clamp(tugX*.12,-5,5)*flip,
    y:clamp(tugY*.12,-1.5,1.5),
    turn:tugX*.28*flip
  };
}

function bindAnchovyTugControls(){
  dom.miniContent.querySelectorAll("#anchovyWorkArea .anchovy-head").forEach(button=>{
    button.addEventListener("pointerdown",event=>startAnchovyTug(button,event));
    button.addEventListener("pointermove",event=>moveAnchovyTug(button,event));
    button.addEventListener("pointerup",event=>releaseAnchovyTug(button,event));
    button.addEventListener("pointercancel",event=>releaseAnchovyTug(button,event,true));
    button.addEventListener("lostpointercapture",event=>releaseAnchovyTug(button,event,true));
    button.addEventListener("dragstart",event=>event.preventDefault());
  });
}

function activeAnchovyMini(){
  const m=state.mini;
  return isDayPrepMini(m)&&m.data.mode==="anchovy"&&!m.data.timedOut&&!m.data.finishing?m:null;
}

function startAnchovyTug(button,event){
  const m=activeAnchovyMini();if(!m||event.pointerType==="mouse"&&event.button!==0)return;
  // 한 번에 한 머리만 잡습니다. 두 번째 손가락이 현재 당기기를 가로채지 못하게 합니다.
  if(m.data.grip)return;
  const wrapper=button.closest(".anchovy"),item=m.data.items.find(entry=>entry.id===Number(wrapper?.dataset.id));
  if(!wrapper||!item||item.cleaned)return;
  event.preventDefault();
  m.data.grip={...createAnchovyGrip(event.pointerId,event.clientX,event.clientY),id:item.id,flip:item.flip,button,wrapper};
  wrapper.classList.remove("tug-snap");wrapper.classList.add("grabbing");wrapper.dataset.tug="0";
  button.setPointerCapture?.(event.pointerId);
  dom.miniFeedback.textContent=`${item.id+1}번 멸치 머리를 잡았습니다 · 좌우로 흔드세요!`;
}

function moveAnchovyTug(button,event){
  const m=activeAnchovyMini(),grip=m?.data.grip;
  if(!grip||grip.button!==button||grip.pointerId!==event.pointerId)return;
  event.preventDefault();
  const tugX=clamp(event.clientX-grip.startX,-42,42),tugY=clamp(event.clientY-grip.startY,-12,12);
  const pose=anchovyTugPose(tugX,tugY,grip.flip||1);
  // 머리 안쪽을 회전축으로 고정해 흔드는 동안에는 몸통에 붙어 있고, 성공 순간에만 분리합니다.
  grip.wrapper.style.setProperty("--tug-x",`${pose.x}px`);
  grip.wrapper.style.setProperty("--tug-y",`${pose.y}px`);
  grip.wrapper.style.setProperty("--tug-turn",`${pose.turn}deg`);
  if(!updateAnchovyGrip(grip,event.clientX,m.data.swingDistance))return;
  grip.wrapper.dataset.tug=String(grip.reversals);
  grip.wrapper.classList.remove("tug-pulse");void grip.wrapper.offsetWidth;grip.wrapper.classList.add("tug-pulse");
  audio.play?.("anchovy_tension",{owner:m});
  dom.miniFeedback.textContent=`흔들기 ${Math.min(grip.reversals,m.data.requiredShakes)} / ${m.data.requiredShakes}`;
  if(grip.reversals>=m.data.requiredShakes)finishAnchovyTug(m,grip);
}

function releaseAnchovyTug(button,event,cancelled=false){
  const m=state.mini,grip=m?.data?.grip;
  if(!grip||grip.button!==button||grip.pointerId!==event.pointerId)return;
  m.data.grip=null;
  grip.wrapper.classList.remove("grabbing","tug-pulse");grip.wrapper.classList.add("tug-snap");
  delete grip.wrapper.dataset.tug;
  grip.wrapper.style.removeProperty("--tug-x");grip.wrapper.style.removeProperty("--tug-y");grip.wrapper.style.removeProperty("--tug-turn");
  if(!cancelled)dom.miniFeedback.textContent="아직 붙어 있어요 · 머리를 놓지 말고 조금 더 크게 흔들어주세요!";
}

function finishAnchovyTug(m,grip){
  const item=m.data.items.find(entry=>entry.id===grip.id);if(!item||item.cleaned)return;
  item.cleaned=true;m.data.cleaned++;m.data.grip=null;
  try{grip.button.releasePointerCapture?.(grip.pointerId);}catch{}
  // 마지막 포인터 방향과 무관하게 머리의 바깥쪽으로 뜯어 둡니다.
  // 멸치 전체 반전은 부모 transform이 처리하므로 로컬 좌표는 항상 음수여야 합니다.
  grip.wrapper.style.setProperty("--tear-x","calc(-38 * var(--upx))");
  grip.wrapper.classList.remove("grabbing","tug-pulse");grip.wrapper.classList.add("cleaned","torn");
  grip.button.disabled=true;
  dom.miniTimer.textContent=`${m.data.cleaned} / ${m.data.total}`;
  dom.miniContent.querySelector("#anchovyCount").innerHTML=`<b>${m.data.cleaned}</b> / ${m.data.total}`;
  dom.miniFeedback.textContent="흔들어 뜯기 성공!";audio.play?.("anchovy_finish",{owner:m});
  if(m.data.cleaned===m.data.total){m.data.finishing=true;finishDayPrepTask("cleanAnchovy","멸치 손질 완료");}
}

function updateAnchovyTimer(m,dt){
  if(m.data.timedOut||m.data.finishing)return;
  const previousTime=m.data.timeLeft;
  m.data.timeLeft=Math.max(0,m.data.timeLeft-dt);
  if(previousTime>7&&m.data.timeLeft<=7&&!m.data.timerWarningPlayed){m.data.timerWarningPlayed=true;audio.play?.("timer_warning",{owner:m,gain:.85});}
  const timer=dom.miniContent.querySelector("#anchovyTime");
  if(timer){timer.classList.toggle("warning",m.data.timeLeft<=7);timer.querySelector("b").textContent=`${m.data.timeLeft.toFixed(1)}초`;}
  if(m.data.timeLeft<=0)timeoutAnchovy(m);
}

function timeoutAnchovy(m){
  if(state.mini!==m||m.data.timedOut||m.data.finishing)return;
  m.data.timedOut=true;
  if(m.data.grip){
    const grip=m.data.grip;m.data.grip=null;
    try{grip.button.releasePointerCapture?.(grip.pointerId);}catch{}
    grip.wrapper.classList.remove("grabbing","tug-pulse");
    grip.wrapper.style.removeProperty("--tug-x");grip.wrapper.style.removeProperty("--tug-y");grip.wrapper.style.removeProperty("--tug-turn");
  }
  const area=dom.miniContent.querySelector("#anchovyWorkArea");
  if(area){
    area.classList.add("time-over");
    area.querySelectorAll("button").forEach(button=>button.disabled=true);
    area.insertAdjacentHTML("beforeend",`<div class="anchovy-timeout"><strong>TIME OVER</strong><span>${m.data.cleaned} / ${m.data.total} 손질</span></div>`);
  }
  dom.miniFeedback.textContent="시간이 끝났습니다. 손질을 여기서 마칩니다.";audio.bad();
  // 다시 시도 없이 그대로 끝냅니다. TIME OVER 판을 잠깐 보여준 뒤 태스크를 마감해
  // 다음 준비 작업(또는 준비 화면 닫기)으로 넘어갑니다.
  // timedOut 이 켜져 있으므로 finishDayPrepTask 의 판정은 perfect 가 아닌 good 입니다.
  miniSetTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask("cleanAnchovy","멸치 손질 시간 종료");},ANCHOVY_TIMEOUT_END_MS);
}
