"use strict";

/* ============================================================
   E9 원 그리기 (낮 준비) — 김치전 반죽 거품기

   믹스볼 안에서 마우스를 누른 채 원을 그립니다.
   중심에서 잰 각도가 얼마나 돌았는지를 누적해 진행도로 씁니다.
   너무 중심(반지름 35px 이하)이거나 너무 바깥이면 세어 주지 않고,
   한 번에 크게 튄 입력(1.2 라디안 이상)도 무시합니다. 100%면 완료.

   [들어오는 길]
   시작 함수(registerDayPrepSetup)가 없습니다.
   김치전 반죽 재료를 다 넣으면 engine-e8-order-place.js 가
   setupWhiskBatter 를 불러 이 게임으로 넘어옵니다.

   이 엔진을 쓰는 게임은 지금 이것 하나뿐입니다.
   ============================================================ */

// 마우스 원 운동만 쓰므로 키 처리가 없습니다.
registerDayPrepEngine("whisk",{});

function setupWhiskBatter(){
  const m=setDayPrepData({mode:"whisk",progress:0,pointerActive:false,lastAngle:null});
  if(!m)return;
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
  // 반죽 출렁임도 화면 크기 비례 단위(--upx, css/base.css)로 줍니다.
  bowl.style.setProperty("--batter-x",`calc(${clamp(dx*.045,-7,7)} * var(--upx))`);
  bowl.style.setProperty("--batter-y",`calc(${clamp(dy*.045,-6,6)} * var(--upx))`);
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
