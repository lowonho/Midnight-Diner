"use strict";

/* ============================================================
   E12 잡고 흔들기 — 직접 잡아 크게 왕복하는 조작

   현재 적용 게임
     · 볶음우동 양배추 채썰기
     · 볶음우동 당근 채썰기
     · 감자튀김 감자 채썰기

   재료를 한 번 잡은 채 채칼의 대각선 축을 끝까지 오가면 왕복마다
   한 번의 채썰기로 판정합니다. E2의 공용 화면·진행 연출은 공유하지만,
   포인터 캡처·투영·왕복 판정과 엔진 등록은 이 파일이 담당합니다.
   ============================================================ */

registerDayPrepSetup("mandoline",taskId=>setupMandoline(taskId));
registerDayPrepSetup("potatoMandoline",taskId=>setupMandoline(taskId));

registerDayPrepEngine("mandoline",{
  key(m,k,e){
    if(!k.startsWith("arrow"))return false;
    const direction=k.replace("arrow","");
    if(!m.data.directions.includes(direction)){
      rejectAlternateInput(m,`${MANDOLINE_ARROWS[m.data.expected]} 방향 차례입니다. 좌우 키를 번갈아 누르세요.`,"#mandolineScene");
      return true;
    }
    mandolineInput(direction,e.repeat);
    return true;
  }
});

// 채칼은 화면 기준 왼쪽 위에서 오른쪽 아래로 약 33도 기울어져 있습니다.
// 판의 짧은 변 22%를 한쪽 끝으로 삼아 전체 왕복 폭을 44%로 만듭니다.
const MANDOLINE_DRAG_CONFIG=Object.freeze({
  axisX:.839,
  axisY:.545,
  halfTravelRatio:.22,
  visualLimitRatio:.22
});

function mandolineDragProjection(dx,dy){
  return dx*MANDOLINE_DRAG_CONFIG.axisX+dy*MANDOLINE_DRAG_CONFIG.axisY;
}

function mandolineDragDistance(width,height,ratio=MANDOLINE_DRAG_CONFIG.halfTravelRatio){
  return Math.max(1,Math.min(width||0,height||0)*ratio);
}

function updateMandolineDragPose(data){
  const drag=data?.drag,ingredient=dom.miniContent.querySelector("#mandolineIngredient");
  const scene=dom.miniContent.querySelector("#mandolineScene");
  if(!ingredient||!drag||drag.kind!=="mandoline")return;
  ingredient.style.setProperty("--md-drag-x",`${(drag.position*MANDOLINE_DRAG_CONFIG.axisX).toFixed(2)}px`);
  ingredient.style.setProperty("--md-drag-y",`${(drag.position*MANDOLINE_DRAG_CONFIG.axisY).toFixed(2)}px`);
  ingredient.classList.add("dragging");
  scene?.classList.add("mandoline-dragging");
}

function clearMandolineDrag(m,pointerId=null){
  const drag=m?.data?.drag;if(!drag||drag.kind!=="mandoline"||(pointerId!==null&&drag.pointerId!==pointerId))return;
  m.data.drag=null;
  const ingredient=dom.miniContent.querySelector("#mandolineIngredient"),scene=dom.miniContent.querySelector("#mandolineScene");
  ingredient?.classList.remove("dragging");
  ingredient?.style.removeProperty("--md-drag-x");
  ingredient?.style.removeProperty("--md-drag-y");
  scene?.classList.remove("mandoline-dragging");
}

// 매번 썬 뒤 가운데 장면이 다시 그려지므로, 사라지는 재료 대신 계속 남아 있는
// mini-content에 포인터를 캡처해야 한 번 잡은 채 여러 번 왕복할 수 있습니다.
function bindMandolineDrag(){
  const surface=dom.miniContent;if(surface.__mandolineDragBound)return;
  surface.__mandolineDragBound=true;
  surface.addEventListener("pointerdown",event=>{
    const ingredient=event.target?.closest?.("#mandolineIngredient");
    const m=state.mini;
    if(!ingredient||!surface.contains(ingredient)||!isDayPrepMini(m)||m.complete||m.data.mode!=="mandoline"||m.data.inputLocked||m.data.transitioning||m.data.phase==="complete")return;
    if(event.pointerType==="mouse"&&event.button!==0)return;
    event.preventDefault();
    const rect=ingredient.closest(".md-plate")?.getBoundingClientRect()||ingredient.getBoundingClientRect();
    const step=mandolineDragDistance(rect.width,rect.height);
    m.data.drag={kind:"mandoline",pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,position:0,step,limit:mandolineDragDistance(rect.width,rect.height,MANDOLINE_DRAG_CONFIG.visualLimitRatio)};
    try{surface.setPointerCapture?.(event.pointerId);}catch{}
    updateMandolineDragPose(m.data);
  });
  surface.addEventListener("pointermove",event=>{
    const m=state.mini,drag=m?.data?.drag;
    if(!isDayPrepMini(m)||m.complete||m.data.mode!=="mandoline"||!drag||drag.kind!=="mandoline"||drag.pointerId!==event.pointerId)return;
    event.preventDefault();
    if(m.data.inputLocked||m.data.transitioning||m.data.phase==="complete")return;
    const projected=mandolineDragProjection(event.clientX-drag.startX,event.clientY-drag.startY);
    drag.position=clamp(projected,-drag.limit,drag.limit);
    updateMandolineDragPose(m.data);
    const expected=m.data.expected;
    if((expected==="left"&&projected<=-drag.step)||(expected==="right"&&projected>=drag.step)){
      mandolineInput(expected,false,true);
      if(m.data.transitioning||m.data.phase==="complete")clearMandolineDrag(m,event.pointerId);
    }
  });
  const finish=event=>{
    const m=state.mini,drag=m?.data?.drag;
    if(!drag||drag.kind!=="mandoline"||drag.pointerId!==event.pointerId)return;
    clearMandolineDrag(m,event.pointerId);
    try{if(surface.hasPointerCapture?.(event.pointerId))surface.releasePointerCapture?.(event.pointerId);}catch{}
  };
  surface.addEventListener("pointerup",finish);
  surface.addEventListener("pointercancel",finish);
  surface.addEventListener("lostpointercapture",finish);
  surface.addEventListener("dragstart",event=>{if(event.target?.closest?.("#mandolineIngredient"))event.preventDefault();});
}
