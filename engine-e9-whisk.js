"use strict";

/* ============================================================
   E9 원 그리기 · 김치전 반죽 젓기

   포인터를 누른 채 볼 중심을 기준으로 원을 그립니다. 첫 유효 움직임으로
   시계/반시계 방향을 정하고, 같은 방향의 각도 이동만 진행도로 인정합니다.
   진행 중 볼 안쪽·바깥쪽으로 벗어나거나 손을 떼거나 방향을 바꾸면 게임은
   계속할 수 있지만 최종 등급이 GOOD이 됩니다.

   시각 요소는 선택 에셋 키로 분리되어 있습니다. 에셋이 없으면 CSS 임시
   도형을 사용하고, 나중에 batterMix0~4와 batterWhisk 파일만 넣으면 같은
   판정 로직을 유지한 채 그림만 교체됩니다.
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
    whiskAsset:"batterWhisk",
    taskId:"mixKimchiBatter",
    completionMessage:"김치전 반죽 완성"
  })
});

function createWhiskState(configId="kimchiBatter",inheritedMistakes=0){
  const config=WHISK_CONFIG[configId];
  return {
    mode:"whisk",configId,
    progress:0,progressAngle:0,targetAngle:Math.PI*2*config.targetTurns,spin:0,
    pointerActive:false,lastAngle:null,direction:0,strokeProgress:0,hasStirred:false,
    mistakes:Math.max(0,Number(inheritedMistakes)||0),
    outsideActive:false,reverseActive:false,jumpActive:false,
    finishing:false,completionGrade:""
  };
}

function whiskStageAssetsMarkup(config){
  return `<span class="bt-batter-stage-assets" aria-hidden="true">${Array.from({length:5},(_,index)=>
    dayPrepAssetMarkup(`${config.stageAssetPrefix}${index}`,`bt-batter-stage-asset stage-${index}`)
  ).join("")}</span>`;
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
        ${batterBowlMarkup("whisk-bowl stage-0",{id:"whiskBowl",extra:`${whiskStageAssetsMarkup(config)}<i class="bt-stir-guide"></i>`})}
        <i class="bt-stir-ring" id="whiskRing"></i>
        <i class="whisk-tool ${hasDayPrepAsset(config.whiskAsset)?"has-asset":""}" id="whiskTool"><span class="whisk-wire"></span>${dayPrepAssetMarkup(config.whiskAsset,"whisk-tool-asset","거품기")}</i>
        <strong class="order-result whisk-result" id="whiskResult" hidden></strong>
      </div>
      <p class="bt-progress">반죽 진행도 <b id="whiskProgressText">0%</b></p>`,
    BATTER_INGREDIENTS.length);
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
  m.data.pointerActive=true;m.data.lastAngle=null;m.data.direction=0;m.data.strokeProgress=0;
  m.data.outsideActive=false;m.data.reverseActive=false;m.data.jumpActive=false;
  work.classList.add("stirring");work.classList.remove("off-course");
  audio.loop?.("whisk_mix",m,.72);
  work.setPointerCapture?.(event.pointerId);moveWhiskPointer(event);
}

function endWhiskPointer(event,work,cancelled=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="whisk"||!m.data.pointerActive)return;
  m.data.pointerActive=false;m.data.lastAngle=null;m.data.direction=0;
  if(!m.data.finishing&&m.data.strokeProgress>0&&m.data.progressAngle<m.data.targetAngle)m.data.mistakes++;
  m.data.strokeProgress=0;m.data.outsideActive=false;m.data.reverseActive=false;m.data.jumpActive=false;
  work.classList.remove("stirring","off-course");
  audio.stop?.("whisk_mix",m);
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
  tool.style.left=`${clamp(50+dx/rect.width*100,12,88)}%`;
  tool.style.top=`${clamp(50+dy/rect.height*100,12,88)}%`;
  tool.style.setProperty("--tool-rot",`${(angle*180/Math.PI+90).toFixed(1)}deg`);

  const result=sampleWhiskMotion(m.data,angle,radius/size,config);
  work.classList.toggle("off-course",m.data.hasStirred&&["outside","reverse","jump"].includes(result.reason));
  if(result.accepted){
    bowl.style.setProperty("--batter-x",`calc(${clamp(dx*.03,-7,7).toFixed(2)} * var(--upx))`);
    bowl.style.setProperty("--batter-y",`calc(${clamp(dy*.03,-6,6).toFixed(2)} * var(--upx))`);
    bowl.style.setProperty("--spin",`${(m.data.spin*180/Math.PI).toFixed(1)}deg`);
  }
  renderWhiskProgress(m,config);
  if(m.data.progressAngle>=m.data.targetAngle)completeWhiskBatter(m,config);
}

function renderWhiskProgress(m,config){
  const bowl=dom.miniContent.querySelector("#whiskBowl"),ring=dom.miniContent.querySelector("#whiskRing"),text=dom.miniContent.querySelector("#whiskProgressText");
  if(!bowl||!ring||!text)return;
  const progress=Math.round(m.data.progressAngle/m.data.targetAngle*100),stage=Math.min(4,Math.floor(progress/25));
  for(let index=0;index<=4;index++)bowl.classList.toggle(`stage-${index}`,index===stage);
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
  if(count)count.textContent="1 / 1";
  if(result){result.hidden=false;result.textContent=m.data.completionGrade==="perfect"?"PERFECT":"GOOD";result.classList.add(m.data.completionGrade,"show");}
  setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(config.taskId,config.completionMessage);},config.finishDelay);
}
