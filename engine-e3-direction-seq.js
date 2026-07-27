"use strict";

/* ============================================================
   E3 방향 시퀀스 — 게임 2개

     김치 볶기 (낮 준비 · 두부김치)   ← ↑ → ↓ 12개
     볶음우동 조리 (밤 조리)          ← ↑ → ↓ 8개

   제시된 방향 배열을 왼쪽부터 순서대로 입력합니다.

   [합쳐진 것 / 안 합쳐진 것]
   · "지금 차례와 맞는가 / 다음으로 넘긴다" 판정은 아래 도우미로 합쳤습니다.
   · 두 게임은 아직 규칙이 다릅니다.
       오답 처리 : 볶음우동은 12점 감점, 김치는 감점 없이 안내만
       완료 처리 : 밤은 점수 정산, 낮은 준비 태스크 완료
     완전히 한 벌로 만들려면 이 차이를 데이터(표)로 빼야 합니다.
     화면 마크업도 서로 다른데, 이쪽은 에셋 작업 영역이라 두었습니다.
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
   2. 볶음우동 조리 (밤 조리)
   ============================================================ */

registerMiniEngine("stir",{
  setup(m,{set}){
    set("철판 볶기","표시된 방향 순서를 빠르게 입력해 면과 채소를 골고루 볶으세요.",10);
    const arrows=Array.from({length:8},()=>["←","↑","→","↓"][Math.floor(Math.random()*4)]);
    m.data={arrows,index:0,errors:0};
    renderArrowGame();
  },

  key(m,k){
    const map={arrowleft:"←",arrowup:"↑",arrowright:"→",arrowdown:"↓"};
    if(map[k]){arrowInput(map[k]);return true;}
    return false;
  }
});

function renderArrowGame(){
  const m=state.mini;if(!m)return;
  dom.miniContent.innerHTML=`<div class="sequence-view" id="arrowSequence">${m.data.arrows.map((a,i)=>`<span class="sequence-chip arrow-sequence-chip ${i===m.data.index?"current":""}" data-i="${i}">${a}</span>`).join("")}</div><div class="cut-count" id="arrowProgress">진행 ${m.data.index} / ${m.data.arrows.length}</div><div class="arrow-grid" id="arrowGrid"></div>`;
  const grid=dom.miniContent.querySelector("#arrowGrid");
  ["←","↑","→","↓"].forEach(a=>{const b=document.createElement("button");b.type="button";b.className="arrow-button";b.dataset.arrow=a;b.textContent=a;b.addEventListener("click",()=>arrowInput(a));grid.appendChild(b);});
}

function arrowInput(a){
  const m=state.mini;if(!m||m.engine!=="stir")return;
  const pressed=dom.miniContent.querySelector(`.arrow-button[data-arrow="${a}"]`);
  if(pressed){pressed.classList.remove("pressed");void pressed.offsetWidth;pressed.classList.add("pressed");setTimeout(()=>pressed.classList.remove("pressed"),150);}
  if(sequenceMatches(m.data.arrows,m.data.index,a)){
    const completed=dom.miniContent.querySelector(`[data-i="${m.data.index}"]`);
    completed.classList.remove("current");completed.classList.add("correct");
    m.data.index++;
    const next=dom.miniContent.querySelector(`[data-i="${m.data.index}"]`);if(next)next.classList.add("current");
    const progress=dom.miniContent.querySelector("#arrowProgress");if(progress)progress.textContent=`진행 ${m.data.index} / ${m.data.arrows.length}`;
    audio.click();if(m.data.index===m.data.arrows.length)finishMini(Math.max(70,100-m.data.errors*12));
  }
  else{m.data.errors++;audio.bad();dom.miniFeedback.textContent="볶는 방향이 엇갈렸어요.";}
}
