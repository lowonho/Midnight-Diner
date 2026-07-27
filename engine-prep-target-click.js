"use strict";

/* ============================================================
   E10 표적 클릭 (낮 준비) — 멸치 머리 떼기

   멸치 5마리가 작업대에 무작위 위치·각도·크기로 흩어집니다.
   각 멸치의 작은 원형 "머리"만 정확히 눌러야 손질됩니다.
   몸통을 누르면 실패가 아니라 안내 문구만 뜨고 다시 시도할 수 있습니다.

   5마리를 다 손질하면 냄비에 넣는 연출(E11, engine-prep-one-shot.js)로
   넘어가고 거기서 태스크가 완료됩니다.

   이 엔진을 쓰는 게임은 지금 이것 하나뿐입니다.
   ============================================================ */

registerDayPrepSetup("anchovy",()=>setupAnchovyPrep());

// 클릭만 쓰므로 키 처리가 없습니다.
registerDayPrepEngine("anchovy",{});

function setupAnchovyPrep(){
  const config=DAY_PREP_MINI_CONFIG.cleanAnchovy;
  const slots=shuffle(Array.from({length:10},(_,index)=>index)).slice(0,config.total);
  setDayPrepData({mode:"anchovy",cleaned:0,total:config.total,items:slots.map((slot,index)=>({
    id:index,cleaned:false,x:8+(slot%5)*18+Math.random()*4,y:10+Math.floor(slot/5)*48+Math.random()*5,
    rotation:-22+Math.random()*44,scale:.82+Math.random()*.3,flip:Math.random()>.5?-1:1
  }))});
  dom.miniTitle.textContent=config.title;
  dom.miniDescription.textContent="멸치의 작은 원형 머리를 클릭하세요. 몸통을 누르면 같은 멸치를 다시 시도합니다.";
  renderAnchovyPrep();
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
