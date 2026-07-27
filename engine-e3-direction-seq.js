"use strict";

/* ============================================================
   E3 방향 시퀀스 — 게임 2개

     김치 볶기 (낮 준비 · 두부김치)   ← ↑ → ↓ 12개
     볶음우동 조리 (밤 조리)          ← ↑ → ↓ 8개

   제시된 방향 배열을 왼쪽부터 순서대로 입력합니다.

   [합쳐진 것 / 안 합쳐진 것]
   · "지금 차례와 맞는가 / 다음으로 넘긴다" 판정과 방향 뽑기(같은 방향이
     연달아 나오지 않게 고르기)는 아래 도우미로 합쳤습니다.
   · 화면 구성도 이제 같은 3단 + 아래 화살표 줄입니다.
     (클래스 이름만 kf- / yk- 로 다릅니다. 에셋 작업 영역이라 나눠 두었습니다)
   · 아직 규칙이 다릅니다.
       조작     : 볶음우동은 화살표 키 + 철판 드래그, 김치는 화살표 키만
       오답 처리 : 볶음우동은 12점 감점, 김치는 감점 없이 안내만
       완료 처리 : 밤은 점수 정산, 낮은 준비 태스크 완료
     완전히 한 벌로 만들려면 이 차이를 데이터(표)로 빼야 합니다.
   ============================================================ */

registerDayPrepSetup("kimchiFry",taskId=>setupKimchiFry(taskId));

/* ---- 공통 판정 규칙 ---------------------------------------- */

// 입력이 지금 차례와 맞는가
function sequenceMatches(sequence,index,input){
  return sequence[index]===input;
}

/* ============================================================
   1. 김치 볶기 (낮 준비)

   화면 구성 (그림은 전부 CSS 임시 도형입니다. 에셋이 들어오면 교체)
     왼쪽   재료 카드 — 썰은 김치 ×1 · 설탕 ×1 (보여주기만 합니다)
     가운데 불 위의 팬
     오른쪽 진행도 + 다음 순서 화살표
     아래   화살표 12칸. 지금 눌러야 할 칸이 금색으로 켜집니다.

   조작은 화살표 키만 씁니다(레퍼런스 화면에 클릭 버튼이 없습니다).
   재료 카드 목록·개수·방향 수는 day-prep-minigames.js 의
   DAY_PREP_MINI_CONFIG.fryKimchi 한 곳에서 정합니다.

   [공용 프레임과의 관계]  김치전 반죽·닭꼬치와 같습니다.
   css/minigame-frame.css 와 ui-mini-frame.js 는 건드리지 않고,
   이 게임이 켜져 있을 때만 적용되는 규칙으로 덮어씁니다.
   (css/day-prep-minigames.css 의 "김치 볶기" 구역 참고)
   ------------------------------------------------------------ */

const FRY_DIRECTION_ARROWS=Object.freeze({left:"←",up:"↑",right:"→",down:"↓"});

registerDayPrepEngine("direction",{
  key(m,k){
    const direction=k.startsWith("arrow")?k.slice(5):"";
    if(FRY_DIRECTION_ARROWS[direction]){kimchiFryInput(direction);return true;}
    return false;
  }
});

// 같은 방향이 연달아 나오면 눈으로 세기 어려워서 바로 앞과는 다른 방향만 고릅니다.
function randomFryDirections(allowedDirections,length){
  const sequence=[];
  for(let index=0;index<length;index++){
    const pool=allowedDirections.filter(direction=>direction!==sequence[index-1]);
    sequence.push(pool[Math.floor(Math.random()*pool.length)]);
  }
  return sequence;
}

function setupKimchiFry(taskId="fryTofuKimchi"){
  const config=DAY_PREP_MINI_CONFIG.fryKimchi;
  setDayPrepData({
    mode:"direction",
    taskId,
    successes:0,
    total:config.total,
    allowedDirections:[...config.allowedDirections],
    ingredients:config.ingredients,
    sequence:randomFryDirections(config.allowedDirections,config.total)
  });
  dom.miniTitle.textContent="김치 볶기";
  dom.miniDescription.textContent="화살표 키 순서대로 눌러 김치와 설탕을 함께 볶아주세요!";
  renderKimchiFry();
}

function renderKimchiFry(){
  const data=state.mini.data;
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;   // 공용 카드는 CSS 로 숨겨져 있습니다
  dom.miniContent.innerHTML=`
    <div class="kf-scene">
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

      <div class="kf-board" id="fryWorkArea">
        <div class="kf-stove ${hasDayPrepAsset("fryStove")?"has-asset":""}">
          ${dayPrepAssetMarkup("fryStove","kf-stove-asset","가스레인지")}
          <i class="kf-flame"></i>
          <div class="frying-pan ${hasDayPrepAsset("fryingPan")?"has-prep-asset":""}">
            ${dayPrepAssetMarkup("fryingPan","frying-pan-asset","후라이팬")}
            <i class="frying-kimchi ${hasDayPrepAsset("fryingKimchi")?"has-prep-asset":""}">${dayPrepAssetMarkup("fryingKimchi","frying-kimchi-asset","볶는 김치")}</i>
          </div>
        </div>
      </div>

      <aside class="kf-col">
        <div class="kf-panel kf-count">
          <h3 class="kf-col-title">진행도</h3>
          <strong id="fryCount">${data.successes} / ${data.total}</strong>
        </div>
        <div class="kf-panel kf-next">
          <h3 class="kf-col-title">다음 순서</h3>
          <div class="kf-next-arrow" id="fryNextArrow">${FRY_DIRECTION_ARROWS[data.sequence[data.successes]]||"✓"}</div>
        </div>
      </aside>

      <div class="kf-seq" aria-label="볶기 방향 순서">
        ${data.sequence.map((direction,index)=>`<span class="kf-chip ${index<data.successes?"done":index===data.successes?"current":""}" data-sequence-index="${index}">${FRY_DIRECTION_ARROWS[direction]}</span>`).join("")}
      </div>
    </div>`;
}

function kimchiFryInput(direction){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="direction")return;
  const data=m.data;
  if(!data.allowedDirections.includes(direction))return;
  const current=dom.miniContent.querySelector(`[data-sequence-index="${data.successes}"]`);
  if(!sequenceMatches(data.sequence,data.successes,direction)){
    dom.miniFeedback.textContent=`${FRY_DIRECTION_ARROWS[data.sequence[data.successes]]} 방향입니다. 켜져 있는 칸을 보고 누르세요.`;
    audio.bad();
    if(current){current.classList.remove("wrong");void current.offsetWidth;current.classList.add("wrong");setTimeout(()=>current.classList.remove("wrong"),260);}
    return;
  }
  current?.classList.remove("current");current?.classList.add("done");
  data.successes++;
  audio.click();
  dom.miniFeedback.textContent="볶기 성공";
  dom.miniContent.querySelector(`[data-sequence-index="${data.successes}"]`)?.classList.add("current");
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  const count=dom.miniContent.querySelector("#fryCount");
  if(count)count.textContent=`${data.successes} / ${data.total}`;
  const nextArrow=dom.miniContent.querySelector("#fryNextArrow");
  if(nextArrow)nextArrow.textContent=FRY_DIRECTION_ARROWS[data.sequence[data.successes]]||"✓";
  // 누른 방향으로 팬을 한 번 흔듭니다(위/아래도 같은 규칙).
  const work=dom.miniContent.querySelector("#fryWorkArea");
  if(work){
    const tossClass=`toss-${direction}`;
    work.classList.remove("toss-left","toss-right","toss-up","toss-down");void work.offsetWidth;work.classList.add(tossClass);
    setTimeout(()=>work.classList.remove(tossClass),170);
  }
  if(data.successes>=data.total){
    finishDayPrepTask(data.taskId,"두부김치용 김치 볶기 완료");
    return;
  }
}

/* ============================================================
   2. 볶음우동 조리 (밤 조리 · 철판 볶기)

   화면 구성 (그림은 전부 CSS 임시 도형입니다. 에셋이 들어오면 교체)
     왼쪽   재료 카드 — 우동 ×1 · 소스 ×1 · 손질 야채 ×1 (보여주기만 합니다)
     가운데 불 위의 철판 + 볶이는 면
     오른쪽 진행도 + 다음 순서 화살표
     아래   화살표 8칸. 지금 눌러야 할 칸이 금색으로 켜집니다.

   조작은 화살표 키, 또는 철판 위를 그 방향으로 드래그하는 두 가지입니다.
   (레퍼런스 화면에 조작 버튼이 없어서 클릭 버튼은 두지 않았습니다)

   [제한시간]  레퍼런스 화면에 시계가 없어서 timerRuns 를 꺼 두었습니다.
   되돌리려면 아래 timerRuns 한 줄만 지우면 set() 의 10초가 다시 흐릅니다.

   [공용 프레임과의 관계]  김치 볶기와 같습니다.
   css/minigame-frame.css 와 ui-mini-frame.js 는 건드리지 않고,
   이 게임이 켜져 있을 때만 적용되는 규칙으로 덮어씁니다.
   (css/minigames.css 의 "볶음우동 조리" 구역 참고)
   ------------------------------------------------------------ */

const STIR_TOTAL=8;                                         // 화살표 칸 수 (낮 김치 볶기는 12칸)
const STIR_DIRECTIONS=Object.freeze(["left","up","right","down"]);
const STIR_WRONG_PENALTY=12;                                // 오답 1회당 감점
const STIR_DRAG_STEP=.09;                                   // 철판 짧은 변의 이 비율만큼 끌면 1회 볶기
// 왼쪽 재료 카드. 개수·이름만 바꾸면 카드가 그대로 바뀝니다.
const STIR_INGREDIENTS=Object.freeze([
  Object.freeze({id:"udon",label:"우동",count:1,asset:"stirIngUdon"}),
  Object.freeze({id:"sauce",label:"소스",count:1,asset:"stirIngSauce"}),
  Object.freeze({id:"veggie",label:"손질 야채",count:1,asset:"stirIngVeggie"})
]);

registerMiniEngine("stir",{
  setup(m,{set}){
    set("볶음우동 조리","화살표 키를 순서대로 입력해 볶아주세요! (철판 드래그도 가능)",10);
    m.data={
      arrows:randomFryDirections(STIR_DIRECTIONS,STIR_TOTAL),
      index:0,
      errors:0,
      drag:null                                             // 드래그 시작점. 놓으면 null
    };
    dom.miniTimer.textContent=`0 / ${STIR_TOTAL}`;          // 공용 카드는 CSS 로 숨겨져 있습니다
    renderStirScene();
  },

  // 레퍼런스 화면에 시계가 없습니다(위 [제한시간] 참고)
  timerRuns(){return false;},

  key(m,k){
    const direction=k.startsWith("arrow")?k.slice(5):"";
    if(FRY_DIRECTION_ARROWS[direction]){stirInput(direction);return true;}
    return false;
  }
});

function renderStirScene(){
  const data=state.mini?.data;if(!data)return;
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

      <div class="yk-board" id="stirWorkArea">
        <div class="yk-griddle ${hasDayPrepAsset("stirGriddle")?"has-asset":""}" id="stirPlate">
          ${dayPrepAssetMarkup("stirGriddle","yk-griddle-asset","철판")}
          <i class="yk-steam steam-one"></i><i class="yk-steam steam-two"></i><i class="yk-steam steam-three"></i>
          <div class="yk-food ${hasDayPrepAsset("stirNoodles")?"has-prep-asset":""}" id="stirFood">
            ${dayPrepAssetMarkup("stirNoodles","yk-food-asset","볶이는 우동")}
          </div>
          <i class="yk-fire"></i>
        </div>
      </div>

      <aside class="yk-col">
        <div class="yk-panel yk-count">
          <h3 class="yk-col-title">진행도</h3>
          <strong id="stirCount">${data.index} / ${STIR_TOTAL}</strong>
        </div>
        <div class="yk-panel yk-next">
          <h3 class="yk-col-title">다음 순서</h3>
          <div class="yk-next-arrow" id="stirNextArrow">${FRY_DIRECTION_ARROWS[data.arrows[data.index]]||"✓"}</div>
        </div>
      </aside>

      <div class="yk-seq" aria-label="볶기 방향 순서">
        ${data.arrows.map((direction,index)=>`<span class="yk-chip ${index<data.index?"done":index===data.index?"current":""}" data-stir-index="${index}">${FRY_DIRECTION_ARROWS[direction]}</span>`).join("")}
      </div>
    </div>`;
  bindStirDrag();
}

/* 철판 위를 끄는 조작. 한 획(짧은 변의 STIR_DRAG_STEP 만큼)마다 한 번 볶습니다.
   기준점을 매번 지금 위치로 옮기므로 크게 휘저으면 연속으로 들어갑니다. */
function bindStirDrag(){
  const plate=dom.miniContent.querySelector("#stirPlate");if(!plate)return;
  plate.addEventListener("pointerdown",event=>{
    const m=state.mini;if(!m||m.engine!=="stir"||m.complete)return;
    m.data.drag={x:event.clientX,y:event.clientY};
    plate.setPointerCapture(event.pointerId);
    plate.classList.add("dragging");
  });
  plate.addEventListener("pointermove",event=>{
    const m=state.mini;if(!m||m.engine!=="stir"||m.complete||!m.data.drag)return;
    const rect=plate.getBoundingClientRect();
    const step=Math.min(rect.width,rect.height)*STIR_DRAG_STEP;
    const dx=event.clientX-m.data.drag.x,dy=event.clientY-m.data.drag.y;
    if(Math.max(Math.abs(dx),Math.abs(dy))<step)return;
    m.data.drag={x:event.clientX,y:event.clientY};
    stirInput(Math.abs(dx)>=Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up"));
  });
  ["pointerup","pointercancel"].forEach(type=>plate.addEventListener(type,()=>{
    const m=state.mini;if(m&&m.engine==="stir")m.data.drag=null;
    plate.classList.remove("dragging");
  }));
}

function stirInput(direction){
  const m=state.mini;if(!m||m.engine!=="stir"||m.complete)return;
  const data=m.data;
  const current=dom.miniContent.querySelector(`[data-stir-index="${data.index}"]`);
  if(!sequenceMatches(data.arrows,data.index,direction)){
    data.errors++;
    audio.bad();
    dom.miniFeedback.textContent=`${FRY_DIRECTION_ARROWS[data.arrows[data.index]]} 방향입니다. 켜져 있는 칸을 보고 볶으세요.`;
    if(current){current.classList.remove("wrong");void current.offsetWidth;current.classList.add("wrong");setTimeout(()=>current.classList.remove("wrong"),260);}
    return;
  }
  current?.classList.remove("current");current?.classList.add("done");
  data.index++;
  audio.click();
  dom.miniFeedback.textContent="볶기 성공";
  dom.miniContent.querySelector(`[data-stir-index="${data.index}"]`)?.classList.add("current");
  dom.miniTimer.textContent=`${data.index} / ${STIR_TOTAL}`;
  const count=dom.miniContent.querySelector("#stirCount");
  if(count)count.textContent=`${data.index} / ${STIR_TOTAL}`;
  const nextArrow=dom.miniContent.querySelector("#stirNextArrow");
  if(nextArrow)nextArrow.textContent=FRY_DIRECTION_ARROWS[data.arrows[data.index]]||"✓";
  // 누른 방향으로 철판 위 면이 한 번 쏠립니다(위/아래도 같은 규칙).
  const work=dom.miniContent.querySelector("#stirWorkArea");
  if(work){
    const tossClass=`toss-${direction}`;
    work.classList.remove("toss-left","toss-right","toss-up","toss-down");void work.offsetWidth;work.classList.add(tossClass);
    setTimeout(()=>work.classList.remove(tossClass),170);
  }
  if(data.index>=STIR_TOTAL)finishMini(Math.max(70,100-data.errors*STIR_WRONG_PENALTY));
}
