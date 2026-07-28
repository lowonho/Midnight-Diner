"use strict";

/* ============================================================
   E9 원 그리기 (낮 준비) — 김치전 반죽 젓기

   볼 안에서 마우스를 누른 채 원을 그립니다.
   중심에서 잰 각도가 얼마나 돌았는지를 누적해 진행도로 씁니다.
   너무 중심이거나 너무 바깥이면(작업 영역 지름의 12% 안 / 52% 밖) 세어 주지
   않고, 한 번에 크게 튄 입력(1.2 라디안 이상)도 무시합니다. 100%면 완료.

   [들어오는 길]
   시작 함수(registerDayPrepSetup)가 없습니다.
   김치전 반죽 재료를 다 넣으면 engine-e8-order-place.js 가
   setupWhiskBatter 를 불러 이 게임으로 넘어옵니다.

   [화면]
   재료 카드 · 완성 개수 · 참고 모양이 있는 화면 틀은 재료 넣기 단계와
   똑같습니다. engine-e8-order-place.js 의 batterSceneMarkup 을 그대로 쓰고,
   이 파일은 가운데 볼(젓기용)만 그립니다.

   이 엔진을 쓰는 게임은 지금 이것 하나뿐입니다.
   ============================================================ */

// 마우스 원 운동만 쓰므로 키 처리가 없습니다.
registerDayPrepEngine("whisk",{});

const WHISK_CONFIG=Object.freeze({
  kimchiBatter:Object.freeze({
    innerLimit:.12,        // 볼 한가운데를 문지르는 것은 세지 않습니다
    outerLimit:.52,        // 볼 바깥을 도는 것도 세지 않습니다
    maxAngleDelta:1.2,     // 한 번에 크게 튄 포인터 입력은 무시합니다
    gain:6,                // 1 라디안당 진행도
    target:100,
    taskId:"mixKimchiBatter",
    completionMessage:"김치전 반죽 완성"
  })
});

function setupWhiskBatter(configId="kimchiBatter"){
  const config=WHISK_CONFIG[configId];if(!config)return;
  const m=setDayPrepData({mode:"whisk",configId,progress:0,spin:0,pointerActive:false,lastAngle:null});
  if(!m)return;
  dom.miniTitle.textContent="김치전 반죽";
  dom.miniDescription.textContent="재료를 넣고 마우스로 원을 그리며 저어주세요!";
  dom.miniTimer.textContent="0 / 1";                       // 공용 카드는 CSS 로 숨겨져 있습니다
  dom.miniContent.innerHTML=batterSceneMarkup(`
      <div class="bt-bowl-wrap whisk-work-area" id="whiskWorkArea">
        ${batterBowlMarkup("whisk-bowl stage-0",{id:"whiskBowl",extra:`<i class="bt-stir-guide"></i>`})}
        <i class="bt-stir-ring" id="whiskRing"></i>
        <i class="whisk-tool" id="whiskTool"></i>
      </div>
      <p class="bt-progress">반죽 진행도 <b id="whiskProgressText">0%</b></p>`,
    BATTER_INGREDIENTS.length);
  const work=dom.miniContent.querySelector("#whiskWorkArea");
  work.addEventListener("pointerdown",event=>{
    m.data.pointerActive=true;m.data.lastAngle=null;
    work.classList.add("stirring");                        // 안내 고리를 감춥니다
    work.setPointerCapture(event.pointerId);moveWhiskPointer(event);
  });
  work.addEventListener("pointermove",moveWhiskPointer);
  ["pointerup","pointercancel"].forEach(type=>work.addEventListener(type,()=>{
    m.data.pointerActive=false;m.data.lastAngle=null;work.classList.remove("stirring");
  }));
}

function moveWhiskPointer(event){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="whisk"||!m.data.pointerActive)return;
  const work=dom.miniContent.querySelector("#whiskWorkArea"),bowl=dom.miniContent.querySelector("#whiskBowl"),tool=dom.miniContent.querySelector("#whiskTool");
  if(!work||!bowl||!tool)return;
  const config=WHISK_CONFIG[m.data.configId],rect=work.getBoundingClientRect(),size=Math.min(rect.width,rect.height);
  const dx=event.clientX-rect.left-rect.width/2,dy=event.clientY-rect.top-rect.height/2;
  const radius=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
  // 주걱은 마우스를 따라가고, 손잡이가 볼 바깥쪽을 향하도록 돌려 줍니다.
  tool.style.left=`${clamp(50+dx/rect.width*100,12,88)}%`;
  tool.style.top=`${clamp(50+dy/rect.height*100,12,88)}%`;
  tool.style.setProperty("--tool-rot",`${(angle*180/Math.PI+90).toFixed(1)}deg`);
  if(m.data.lastAngle!=null&&radius>size*config.innerLimit&&radius<size*config.outerLimit){
    const delta=Math.atan2(Math.sin(angle-m.data.lastAngle),Math.cos(angle-m.data.lastAngle));
    if(Math.abs(delta)<config.maxAngleDelta){
      m.data.progress=clamp(m.data.progress+Math.abs(delta)*config.gain,0,config.target);
      m.data.spin+=delta;                                  // 반죽도 저은 만큼 같이 돕니다
    }
  }
  m.data.lastAngle=angle;
  // 반죽 출렁임도 화면 크기 비례 단위(--upx, css/base.css)로 줍니다.
  bowl.style.setProperty("--batter-x",`calc(${clamp(dx*.03,-7,7).toFixed(2)} * var(--upx))`);
  bowl.style.setProperty("--batter-y",`calc(${clamp(dy*.03,-6,6).toFixed(2)} * var(--upx))`);
  bowl.style.setProperty("--spin",`${(m.data.spin*180/Math.PI).toFixed(1)}deg`);
  const progress=Math.round(m.data.progress/config.target*100),stage=Math.min(4,Math.floor(progress/25));
  for(let index=0;index<=4;index++)bowl.classList.toggle(`stage-${index}`,index===stage);
  dom.miniContent.querySelector("#whiskRing").style.setProperty("--stir",progress);
  dom.miniContent.querySelector("#whiskProgressText").textContent=`${progress}%`;
  dom.miniTimer.textContent=`${progress>=100?1:0} / 1`;
  if(m.data.progress>=config.target){
    const count=dom.miniContent.querySelector(".bt-count strong");
    if(count)count.textContent="1 / 1";
    finishDayPrepTask(config.taskId,config.completionMessage);
  }
}
