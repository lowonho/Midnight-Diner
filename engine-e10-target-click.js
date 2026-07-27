"use strict";

/* ============================================================
   E10 표적 클릭 (낮 준비) — 멸치 머리 떼기

   멸치 7마리가 도마에 무작위 위치·각도·크기로 흩어집니다.
   각 멸치의 원형 "머리"만 정확히 눌러야 손질됩니다.
   몸통을 누르면 실패가 아니라 안내 문구만 뜨고 다시 시도할 수 있습니다.

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

// 클릭만 쓰므로 키 처리가 없습니다.
registerDayPrepEngine("anchovy",{});

function setupAnchovyPrep(){
  const config=DAY_PREP_MINI_CONFIG.cleanAnchovy;
  // 도마를 3x3 칸으로 나눠 그중 total 칸을 골라 한 마리씩 놓습니다.
  // 칸 안에서 위치·각도·크기를 조금씩 흔들어 자연스럽게 흩어 보이게 합니다.
  const slots=shuffle(Array.from({length:9},(_,index)=>index)).slice(0,config.total);
  setDayPrepData({mode:"anchovy",cleaned:0,total:config.total,items:slots.map((slot,index)=>({
    id:index,cleaned:false,x:3+(slot%3)*30+Math.random()*6,y:5+Math.floor(slot/3)*29+Math.random()*7,
    rotation:-14+Math.random()*28,scale:.9+Math.random()*.18,flip:Math.random()>.5?-1:1
  }))});
  dom.miniTitle.textContent=config.title;
  dom.miniDescription.textContent="멸치 머리를 클릭해 떼어주세요!";
  renderAnchovyPrep();
}

// 사이드 카드(재료 · 참고 모양)에 들어가는 견본 멸치입니다.
// 도마 위 멸치와 같은 조각을 쓰되 클릭 대상이 아니므로 <i> 로 그립니다.
function anchovySampleMarkup(cleaned,turn,size){
  const body=`<i class="anchovy-body ${hasDayPrepAsset("anchovyBody")?"has-prep-asset":""}">${dayPrepAssetMarkup("anchovyBody","anchovy-body-asset","")}</i>`;
  const head=cleaned?"":`<i class="anchovy-head ${hasDayPrepAsset("anchovyHead")?"has-prep-asset":""}">${dayPrepAssetMarkup("anchovyHead","anchovy-head-asset","")}</i>`;
  return `<div class="anchovy anchovy-preview ${cleaned?"cleaned":""}" style="--turn:${turn}deg;--size:${size};--flip:1" aria-hidden="true">${body}${head}</div>`;
}

function renderAnchovyPrep(){
  const data=state.mini.data;
  dom.miniTimer.textContent=`${data.cleaned} / ${data.total}`;
  dom.miniContent.innerHTML=`
    <div class="anchovy-screen">
      <aside class="anchovy-card anchovy-ingredient-card">
        <h3 class="anchovy-card-title starred">재료</h3>
        <div class="anchovy-card-figure">${anchovySampleMarkup(false,-32,.72)}</div>
        <p class="anchovy-card-caption">멸치 <b>×${data.total}</b></p>
      </aside>
      <div class="anchovy-work-area" id="anchovyWorkArea">
        ${data.items.map(item=>`<div class="anchovy ${item.cleaned?"cleaned":""}" data-id="${item.id}" style="left:${item.x}%;top:${item.y}%;--turn:${item.rotation}deg;--size:${item.scale};--flip:${item.flip}">
          <button class="anchovy-body ${hasDayPrepAsset("anchovyBody")?"has-prep-asset":""}" type="button" aria-label="${item.id+1}번 멸치 몸통">${dayPrepAssetMarkup("anchovyBody","anchovy-body-asset","")}</button>
          <button class="anchovy-head ${hasDayPrepAsset("anchovyHead")?"has-prep-asset":""}" type="button" aria-label="${item.id+1}번 멸치 머리">${dayPrepAssetMarkup("anchovyHead","anchovy-head-asset","")}</button>
        </div>`).join("")}
      </div>
      <aside class="anchovy-right">
        <div class="anchovy-card anchovy-count-card">
          <h3 class="anchovy-card-title">완성 개수</h3>
          <p class="anchovy-count" id="anchovyCount"><b>${data.cleaned}</b> / ${data.total}</p>
        </div>
        <div class="anchovy-card anchovy-ref-card">
          <h3 class="anchovy-card-title">참고 모양</h3>
          <div class="anchovy-card-figure">${anchovySampleMarkup(true,-8,.8)}</div>
        </div>
      </aside>
    </div>`;
  // 사이드 카드의 견본 멸치는 클릭 대상이 아니므로 도마 안쪽만 골라 겁니다.
  dom.miniContent.querySelectorAll("#anchovyWorkArea .anchovy-body").forEach(button=>button.addEventListener("click",()=>{
    dom.miniFeedback.textContent="몸통이 아니라 머리를 클릭하세요.";
  }));
  dom.miniContent.querySelectorAll("#anchovyWorkArea .anchovy-head").forEach(button=>button.addEventListener("click",()=>cleanAnchovyHead(button)));
}

function cleanAnchovyHead(button){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="anchovy")return;
  const wrapper=button.closest(".anchovy"),item=m.data.items.find(entry=>entry.id===Number(wrapper.dataset.id));
  if(!item||item.cleaned)return;
  item.cleaned=true;m.data.cleaned++;
  wrapper.classList.add("cleaned");button.disabled=true;
  dom.miniTimer.textContent=`${m.data.cleaned} / ${m.data.total}`;
  dom.miniContent.querySelector("#anchovyCount").innerHTML=`<b>${m.data.cleaned}</b> / ${m.data.total}`;
  dom.miniFeedback.textContent="머리 손질 성공";
  if(m.data.cleaned===m.data.total)showOdenIngredientDrop("cleanAnchovy","anchovy","멸치 손질 완료");
}
