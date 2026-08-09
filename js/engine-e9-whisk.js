"use strict";

/* ============================================================
   E9 원 그리기 · 김치전 반죽 젓기

   포인터를 누른 채 볼 중심을 기준으로 원을 그립니다. **시계·반시계 어느 쪽이든**
   됩니다 — 손을 대고 처음 움직인 방향으로 정해지고, 그 뒤로는 같은 방향의 각도
   이동만 진행도로 인정합니다. 진행 중 볼 안쪽·바깥쪽으로 벗어나거나 손을 떼거나
   도중에 방향을 뒤집으면 게임은 계속할 수 있지만 최종 등급이 GOOD이 됩니다.

   그림은 assets/minigame/E9/ 의 납품 에셋입니다
   (경로는 day-prep-minigames.js 의 DAY_PREP_ASSET_PATHS 참고).
   파일이 없으면 예전처럼 CSS 임시 도형으로 되돌아갑니다.
   ============================================================ */

registerDayPrepEngine("whisk",{});

const WHISK_CONFIG=Object.freeze({
  kimchiBatter:Object.freeze({
    innerLimit:.2,
    outerLimit:.47,
    maxAngleDelta:.75,
    minAngleDelta:.006,
    reverseTolerance:.02,
    targetTurns:4,
    target:100,
    finishDelay:850,
    stageAssetPrefix:"batterMix",
    stageAssetCount:10,            // 이어 붙는 반죽 그림 장수
    // 거품기 3종 — 반죽이 묻은 정도로 나뉩니다
    whiskAssets:Object.freeze({clean:"whiskClean",rest:"whiskLight",mix:"whiskMedium"}),
    taskId:"mixKimchiBatter",
    completionMessage:"김치전 반죽 완성"
  })
});

function createWhiskState(configId="kimchiBatter",inheritedMistakes=0){
  const config=WHISK_CONFIG[configId];
  return {
    mode:"whisk",configId,
    progress:0,progressAngle:0,targetAngle:Math.PI*2*config.targetTurns,spin:0,
    // direction 0 = 아직 안 정해짐. 손을 대고 처음 움직인 쪽으로 정해집니다.
    pointerActive:false,lastAngle:null,direction:0,strokeProgress:0,hasStirred:false,
    mistakes:Math.max(0,Number(inheritedMistakes)||0),
    outsideActive:false,reverseActive:false,jumpActive:false,
    finishing:false,completionGrade:""
  };
}

// 반죽 그림 전부를 한자리에 겹쳐 둡니다. 지금 장에만 .show 가 붙고
// 나머지는 투명이라, 장이 바뀔 때 CSS 가 짧게 겹쳐 넘겨 줍니다(연속 재생).
function whiskStageAssetsMarkup(config){
  return `<span class="bt-batter-stage-assets" aria-hidden="true">${Array.from({length:config.stageAssetCount},(_,index)=>
    dayPrepAssetMarkup(`${config.stageAssetPrefix}${index}`,`bt-batter-stage-asset frame-${index}${index===0?" show":""}`)
  ).join("")}</span>`;
}

// 반죽 그림이 한 장이라도 있으면 볼까지 그림이 그려 주므로 CSS 임시 볼을 끕니다.
function hasWhiskStageArt(config){
  return Array.from({length:config.stageAssetCount},(_,index)=>`${config.stageAssetPrefix}${index}`).some(hasDayPrepAsset);
}

// 거품기 3종도 겹쳐 두고 지금 상태만 보입니다.
function whiskToolMarkup(config){
  const states=Object.entries(config.whiskAssets);
  const has=states.some(([,key])=>hasDayPrepAsset(key));
  return `<i class="whisk-tool ${has?"has-asset":""}" id="whiskTool"><span class="whisk-wire"></span>${
    states.map(([state,key])=>dayPrepAssetMarkup(key,`whisk-tool-asset state-${state}${state==="clean"?" show":""}`,"거품기")).join("")
  }</i>`;
}

/* 지금 보여 줄 거품기 상태.
     clean  아직 한 번도 젓지 않았을 때
     mix    젓고 있는 동안
     rest   젓다가 손을 뗐을 때 (다 저은 뒤도 여기입니다) */
function whiskToolState(data){
  if(!data.hasStirred)return "clean";
  return data.pointerActive&&!data.finishing?"mix":"rest";
}

function setupWhiskBatter(configId="kimchiBatter",inheritedMistakes=0){
  const config=WHISK_CONFIG[configId];if(!config)return;
  const m=setDayPrepData(createWhiskState(configId,inheritedMistakes));
  if(!m)return;
  dom.miniTitle.textContent="김치전 반죽";
  // 재료 넣기(E8)에서 넘어온 부제를 젓기용으로 바꿉니다
  dom.miniStation.textContent="마우스로 원을 그리며 반죽을 저어주세요!";
  dom.miniDescription.textContent="마우스를 누른 채 볼 안에서 원을 그리며 반죽을 저어주세요!";
  dom.miniTimer.textContent="0 / 1";
  dom.miniContent.innerHTML=batterSceneMarkup(`
      <div class="bt-bowl-wrap whisk-work-area" id="whiskWorkArea">
        ${batterBowlMarkup(`whisk-bowl stage-0 ${hasWhiskStageArt(config)?"has-mix-art":""}`,{id:"whiskBowl",extra:`${whiskStageAssetsMarkup(config)}<i class="bt-stir-guide"></i>`})}
        <i class="bt-stir-ring" id="whiskRing"></i>
        ${whiskToolMarkup(config)}
        <strong class="order-result whisk-result" id="whiskResult" hidden></strong>
      </div>
      <p class="bt-progress">반죽 진행도 <b id="whiskProgressText">0%</b></p>`,
    // 오른쪽 참고 모양은 "고르게 섞인 반죽" — E8(재료 넣기)의 "재료 3가지" 와 다른 그림입니다.
    BATTER_INGREDIENTS.length,{guide:"mixed"});
  const work=dom.miniContent.querySelector("#whiskWorkArea");
  work.addEventListener("pointerdown",event=>startWhiskPointer(event,work));
  work.addEventListener("pointermove",moveWhiskPointer);
  work.addEventListener("pointerup",event=>endWhiskPointer(event,work));
  work.addEventListener("pointercancel",event=>endWhiskPointer(event,work,true));
  work.addEventListener("lostpointercapture",event=>endWhiskPointer(event,work,true));
}

function startWhiskPointer(event,work){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="whisk"||m.data.finishing)return;
  if(event.pointerType==="mouse"&&event.button!==0)return;
  event.preventDefault();
  const config=WHISK_CONFIG[m.data.configId];
  // 방향은 비워 둡니다 — 손을 대고 처음 움직인 쪽(시계/반시계)이 그 획의 방향이 됩니다.
  m.data.pointerActive=true;m.data.lastAngle=null;m.data.direction=0;m.data.strokeProgress=0;
  m.data.outsideActive=false;m.data.reverseActive=false;m.data.jumpActive=false;
  work.classList.add("stirring");work.classList.remove("off-course");
  audio.loop?.("whisk_mix",m,.7);
  renderWhiskTool(m,config);
  work.setPointerCapture?.(event.pointerId);moveWhiskPointer(event);
}

function endWhiskPointer(event,work,cancelled=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="whisk"||!m.data.pointerActive)return;
  const config=WHISK_CONFIG[m.data.configId];
  m.data.pointerActive=false;m.data.lastAngle=null;m.data.direction=0;
  if(!m.data.finishing&&m.data.strokeProgress>0&&m.data.progressAngle<m.data.targetAngle)m.data.mistakes++;
  m.data.strokeProgress=0;m.data.outsideActive=false;m.data.reverseActive=false;m.data.jumpActive=false;
  work.classList.remove("stirring","off-course");
  audio.stop?.("whisk_mix",m);
  renderWhiskTool(m,config);   // 젓다 멈추면 반죽이 조금 묻은 거품기로 바뀝니다
  if(!cancelled&&work.hasPointerCapture?.(event.pointerId))work.releasePointerCapture?.(event.pointerId);
}

// DOM 없이도 검사할 수 있는 E9 핵심 판정 함수입니다. radiusRatio는 작업 영역 지름 대비 거리입니다.
function sampleWhiskMotion(data,angle,radiusRatio,config=WHISK_CONFIG[data.configId]){
  const inBand=radiusRatio>config.innerLimit&&radiusRatio<config.outerLimit;
  if(data.lastAngle==null){data.lastAngle=angle;return {accepted:false,inBand,reason:"start"};}
  const delta=Math.atan2(Math.sin(angle-data.lastAngle),Math.cos(angle-data.lastAngle));
  data.lastAngle=angle;

  if(!inBand){
    if(data.hasStirred&&!data.outsideActive)data.mistakes++;
    data.outsideActive=true;data.reverseActive=false;data.jumpActive=false;
    return {accepted:false,inBand:false,reason:"outside"};
  }
  data.outsideActive=false;
  if(Math.abs(delta)>config.maxAngleDelta){
    if(data.hasStirred&&!data.jumpActive)data.mistakes++;
    data.jumpActive=true;
    return {accepted:false,inBand:true,reason:"jump"};
  }
  data.jumpActive=false;
  if(Math.abs(delta)<config.minAngleDelta)return {accepted:false,inBand:true,reason:"small"};
  // 이 획의 방향을 처음 움직인 쪽으로 정합니다. 시계·반시계 둘 다 됩니다.
  if(!data.direction)data.direction=Math.sign(delta);

  const directedDelta=delta*data.direction;
  if(directedDelta<=-config.reverseTolerance){
    if(data.hasStirred&&!data.reverseActive)data.mistakes++;
    data.reverseActive=true;
    return {accepted:false,inBand:true,reason:"reverse"};
  }
  if(directedDelta<=0)return {accepted:false,inBand:true,reason:"jitter"};

  data.reverseActive=false;data.hasStirred=true;data.strokeProgress+=directedDelta;
  data.progressAngle=Math.min(data.targetAngle,data.progressAngle+directedDelta);
  data.progress=data.progressAngle/data.targetAngle*config.target;
  data.spin+=delta;
  return {accepted:true,inBand:true,reason:"progress",delta:directedDelta};
}

function moveWhiskPointer(event){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="whisk"||!m.data.pointerActive||m.data.finishing)return;
  const work=dom.miniContent.querySelector("#whiskWorkArea"),bowl=dom.miniContent.querySelector("#whiskBowl"),tool=dom.miniContent.querySelector("#whiskTool");
  if(!work||!bowl||!tool)return;
  event.preventDefault();
  const config=WHISK_CONFIG[m.data.configId],rect=work.getBoundingClientRect(),size=Math.min(rect.width,rect.height);
  if(!size)return;
  const dx=event.clientX-rect.left-rect.width/2,dy=event.clientY-rect.top-rect.height/2;
  const radius=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
  // 거품기는 자리만 따라옵니다. 손에 쥔 각도는 그대로 두는 게 자연스러워
  // 예전의 --tool-rot(진행 방향으로 돌리기)은 뺐습니다.
  tool.style.left=`${clamp(50+dx/rect.width*100,12,88)}%`;
  tool.style.top=`${clamp(50+dy/rect.height*100,12,88)}%`;

  const result=sampleWhiskMotion(m.data,angle,radius/size,config);
  work.classList.toggle("off-course",m.data.hasStirred&&["outside","reverse","jump"].includes(result.reason));
  if(result.accepted){
    bowl.style.setProperty("--batter-x",`calc(${clamp(dx*.03,-7,7).toFixed(2)} * var(--upx))`);
    bowl.style.setProperty("--batter-y",`calc(${clamp(dy*.03,-6,6).toFixed(2)} * var(--upx))`);
    bowl.style.setProperty("--spin",`${(m.data.spin*180/Math.PI).toFixed(1)}deg`);
  }
  renderWhiskProgress(m,config);
  renderWhiskTool(m,config);
  if(m.data.progressAngle>=m.data.targetAngle)completeWhiskBatter(m,config);
}

// 반죽이 얼마나 묻은 거품기를 보여 줄지 고릅니다 (그림이 없으면 아무 일도 안 합니다).
function renderWhiskTool(m,config){
  const tool=dom.miniContent.querySelector("#whiskTool");if(!tool)return;
  const wanted=`state-${whiskToolState(m.data)}`;
  tool.querySelectorAll(".whisk-tool-asset").forEach(img=>img.classList.toggle("show",img.classList.contains(wanted)));
}

function renderWhiskProgress(m,config){
  const bowl=dom.miniContent.querySelector("#whiskBowl"),ring=dom.miniContent.querySelector("#whiskRing"),text=dom.miniContent.querySelector("#whiskProgressText");
  if(!bowl||!ring||!text)return;
  const progress=Math.round(m.data.progressAngle/m.data.targetAngle*100);
  // CSS 임시 반죽(그림이 없을 때)은 예전대로 5단계입니다.
  const stage=Math.min(4,Math.floor(progress/25));
  for(let index=0;index<=4;index++)bowl.classList.toggle(`stage-${index}`,index===stage);
  // 그림은 10장을 진행도에 고루 나눠 겁니다. 0% 가 첫 장, 100% 가 마지막(완성) 장입니다.
  const last=config.stageAssetCount-1,frame=clamp(Math.round(progress/100*last),0,last);
  bowl.querySelectorAll(".bt-batter-stage-asset").forEach(img=>img.classList.toggle("show",img.classList.contains(`frame-${frame}`)));
  ring.style.setProperty("--stir",progress);text.textContent=`${progress}%`;
  dom.miniTimer.textContent=`${progress>=100?1:0} / 1`;
}

function completeWhiskBatter(m,config){
  if(m.data.finishing)return;
  m.data.finishing=true;m.data.pointerActive=false;
  audio.stop?.("whisk_mix",m);
  m.data.completionGrade=m.data.mistakes?"good":"perfect";
  const work=dom.miniContent.querySelector("#whiskWorkArea"),result=dom.miniContent.querySelector("#whiskResult"),count=dom.miniContent.querySelector(".bt-count strong");
  work?.classList.remove("stirring","off-course");work?.classList.add("finishing");
  renderWhiskTool(m,config);   // 다 저었으니 젓는 중 거품기에서 손 뗀 거품기로
  if(count)count.textContent="1 / 1";
  if(result){result.hidden=false;result.textContent=dayPrepGradeText(m.data.completionGrade);result.classList.add(m.data.completionGrade,"show");}
  miniSetTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(config.taskId,config.completionMessage);},config.finishDelay);
}
