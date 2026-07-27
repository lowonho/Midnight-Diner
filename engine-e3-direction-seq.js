"use strict";

/* ============================================================
   E3 방향 시퀀스 — 단일 입력·판정 컨트롤러

     김치 볶기 (낮 준비)   ← → 중 10회
     볶음우동 (밤 조리)    ← ↑ → ↓ 중 12회

   입력 순서 생성, 정답·오답 판정, 진행 및 완료 처리는 같은 컨트롤러가
   담당합니다. 두 게임의 화면 마크업은 에셋을 따로 붙일 수 있도록 유지합니다.
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
     아래   화살표 10칸. 지금 눌러야 할 칸이 금색으로 켜집니다.

   조작은 화살표 키만 씁니다(레퍼런스 화면에 클릭 버튼이 없습니다).
   횟수·허용 방향·오답 감점은 아래 E3 공통 설정에서 정합니다.

   [공용 프레임과의 관계]  김치전 반죽·닭꼬치와 같습니다.
   css/minigame-frame.css 와 ui-mini-frame.js 는 건드리지 않고,
   이 게임이 켜져 있을 때만 적용되는 규칙으로 덮어씁니다.
   (css/day-prep-minigames.css 의 "김치 볶기" 구역 참고)
   ------------------------------------------------------------ */

const FRY_DIRECTION_ARROWS=Object.freeze({left:"←",up:"↑",right:"→",down:"↓"});

const DIRECTION_SEQUENCE_CONFIG=Object.freeze({
  kimchi:Object.freeze({
    total:10,
    directions:Object.freeze(["left","right"]),
    wrongPenalty:0,
    ingredients:Object.freeze([
      Object.freeze({id:"kimchi",label:"썰은 김치",count:1,asset:"fryIngKimchi"}),
      Object.freeze({id:"sugar",label:"설탕",count:1,asset:"fryIngSugar"})
    ])
  }),
  yakisoba:Object.freeze({
    total:12,
    directions:Object.freeze(["left","up","right","down"]),
    wrongPenalty:12
  })
});

const E3_FEEL_CONFIG=Object.freeze({
  maxDirectionRun:2,
  wrongLockMs:150,
  actionMs:240,
  completeDelayMs:620
});

function directionCompletionGrade(data){return (data.errors||0)===0?"perfect":"good";}

function directionVisualStage(index,total){
  if(index>=total)return 3;
  return Math.min(2,Math.floor(index/Math.max(1,total)*3));
}

function processDirectionSequenceInput(m,direction,{sequenceKey,indexKey,onWrong,onCorrect,onComplete}){
  const data=m?.data,config=data&&DIRECTION_SEQUENCE_CONFIG[data.configId];
  if(!data||!config||m.complete||data.inputLocked||data.transitioning||data.phase==="complete")return false;
  const index=data[indexKey];
  if(!sequenceMatches(data[sequenceKey],index,direction)){
    data.errors=(data.errors||0)+1;
    audio.bad();
    onWrong?.(data,index);
    return true;
  }
  data[indexKey]=index+1;
  audio.click();
  onCorrect?.(data,index);
  if(data[indexKey]>=config.total)onComplete?.(data,config);
  return true;
}

registerDayPrepEngine("direction",{
  key(m,k,e){
    const direction=k.startsWith("arrow")?k.slice(5):"";
    if(FRY_DIRECTION_ARROWS[direction]){kimchiFryInput(direction,e?.repeat);return true;}
    return false;
  }
});

// 같은 동작을 두 번까지 이어 허용하되, 세 번 연속은 나오지 않게 합니다.
// 좌우만 쓰는 김치 볶기도 단순 번갈아 입력이 되지 않아 E2와 손맛이 구분됩니다.
function randomFryDirections(allowedDirections,length,random=Math.random){
  const sequence=[];
  for(let index=0;index<length;index++){
    const previous=sequence[index-1];
    let runLength=0;
    for(let cursor=index-1;cursor>=0&&sequence[cursor]===previous;cursor--)runLength++;
    const limitedPool=runLength>=E3_FEEL_CONFIG.maxDirectionRun?allowedDirections.filter(direction=>direction!==previous):allowedDirections;
    const pool=limitedPool.length?limitedPool:allowedDirections;
    sequence.push(pool[Math.floor(random()*pool.length)]);
  }
  return sequence;
}

function directionSequenceClasses(index,current){
  if(index<current)return "done";
  if(index===current)return "current";
  return index<=current+2?"upcoming":"queued";
}

function showDirectionGrade(grade){
  const result=dom.miniContent.querySelector("#e3Result");
  if(!result)return;
  result.textContent=grade==="perfect"?"PERFECT":"GOOD";
  result.className=`e3-result show ${grade}`;
}

function lockDirectionInput(m,targetSelector,message){
  const data=m.data;if(data.inputLocked||data.phase==="complete")return;
  data.inputLocked=true;
  const work=dom.miniContent.querySelector(targetSelector);
  work?.classList.add("input-wrong");
  dom.miniFeedback.textContent=message;
  setTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    data.inputLocked=false;work?.classList.remove("input-wrong");
  },E3_FEEL_CONFIG.wrongLockMs);
}

function completeDirectionSequence(m,{workSelector,feedback,onDone}){
  const data=m.data,grade=directionCompletionGrade(data);
  data.transitioning=true;data.inputLocked=true;data.phase="complete";
  dom.miniContent.querySelector(workSelector)?.classList.add("e3-complete",`cook-stage-${directionVisualStage(data.successes??data.index,data.total)}`);
  showDirectionGrade(grade);
  dom.miniFeedback.textContent=feedback(grade);
  audio.success();
  setTimeout(()=>{if(state.mini===m&&!m.complete)onDone(grade);},E3_FEEL_CONFIG.completeDelayMs);
}

function setupKimchiFry(taskId="fryTofuKimchi"){
  const config=DIRECTION_SEQUENCE_CONFIG.kimchi;
  setDayPrepData({
    mode:"direction",
    configId:"kimchi",
    taskId,
    successes:0,
    errors:0,
    phase:"ready",
    inputLocked:false,
    transitioning:false,
    total:config.total,
    allowedDirections:[...config.directions],
    ingredients:config.ingredients,
    sequence:randomFryDirections(config.directions,config.total)
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

      <div class="kf-board cook-stage-${directionVisualStage(data.successes,data.total)}" id="fryWorkArea">
        <div class="kf-stove ${hasDayPrepAsset("fryStove")?"has-asset":""}">
          ${dayPrepAssetMarkup("fryStove","kf-stove-asset","가스레인지")}
          <i class="kf-flame"></i>
          <div class="frying-pan ${hasDayPrepAsset("fryingPan")?"has-prep-asset":""}">
            ${dayPrepAssetMarkup("fryingPan","frying-pan-asset","후라이팬")}
            <i class="frying-kimchi ${hasDayPrepAsset("fryingKimchi")?"has-prep-asset":""}">${dayPrepAssetMarkup("fryingKimchi","frying-kimchi-asset","볶는 김치")}</i>
            <i class="kf-steam steam-one"></i><i class="kf-steam steam-two"></i>
            <i class="kf-wood-spatula ${hasDayPrepAsset("fryWoodenSpatula")?"has-prep-asset":""}">${dayPrepAssetMarkup("fryWoodenSpatula","kf-wood-spatula-asset","나무 주걱")}</i>
          </div>
        </div>
        <span class="e3-result" id="e3Result" aria-live="polite"></span>
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
        ${data.sequence.map((direction,index)=>`<span class="kf-chip ${directionSequenceClasses(index,data.successes)}" data-sequence-index="${index}">${FRY_DIRECTION_ARROWS[direction]}</span>`).join("")}
      </div>
    </div>`;
}

function kimchiFryInput(direction,repeat=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="direction")return;
  if(repeat)return false;
  const data=m.data;
  const current=dom.miniContent.querySelector(`[data-sequence-index="${data.successes}"]`);
  processDirectionSequenceInput(m,direction,{
    sequenceKey:"sequence",indexKey:"successes",
    onWrong(){
      if(current){current.classList.remove("wrong");void current.offsetWidth;current.classList.add("wrong");setTimeout(()=>current.classList.remove("wrong"),260);}
      lockDirectionInput(m,"#fryWorkArea",`${FRY_DIRECTION_ARROWS[data.sequence[data.successes]]} 방향입니다. 나무 주걱을 그 방향으로 움직이세요.`);
    },
    onCorrect(){
      current?.classList.remove("current");current?.classList.add("done");
      dom.miniFeedback.textContent="볶기 성공";
      dom.miniContent.querySelector(`[data-sequence-index="${data.successes}"]`)?.classList.remove("upcoming");
      dom.miniContent.querySelector(`[data-sequence-index="${data.successes}"]`)?.classList.add("current");
      dom.miniContent.querySelector(`[data-sequence-index="${data.successes+2}"]`)?.classList.remove("queued");
      dom.miniContent.querySelector(`[data-sequence-index="${data.successes+2}"]`)?.classList.add("upcoming");
      dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
      const count=dom.miniContent.querySelector("#fryCount");
      if(count)count.textContent=`${data.successes} / ${data.total}`;
      const nextArrow=dom.miniContent.querySelector("#fryNextArrow");
      if(nextArrow)nextArrow.textContent=FRY_DIRECTION_ARROWS[data.sequence[data.successes]]||"✓";
      const work=dom.miniContent.querySelector("#fryWorkArea");
      if(work){
        const actionClass=`stir-${direction}`,stage=`cook-stage-${directionVisualStage(data.successes,data.total)}`;
        work.classList.remove("stir-left","stir-right","cook-stage-0","cook-stage-1","cook-stage-2","cook-stage-3");void work.offsetWidth;work.classList.add(actionClass,stage);
        setTimeout(()=>work.classList.remove(actionClass),E3_FEEL_CONFIG.actionMs);
      }
    },
    onComplete(){completeDirectionSequence(m,{
      workSelector:"#fryWorkArea",
      feedback:grade=>grade==="perfect"?"나무 주걱으로 완벽하게 볶았습니다!":"김치를 먹음직스럽게 볶았습니다!",
      onDone:()=>finishDayPrepTask(data.taskId,"두부김치용 김치 볶기 완료")
    });}
  });
}

/* ============================================================
   2. 볶음우동 조리 (밤 조리 · 철판 볶기)

   화면 구성 (그림은 전부 CSS 임시 도형입니다. 에셋이 들어오면 교체)
     왼쪽   재료 카드 — 우동 ×1 · 소스 ×1 · 손질 야채 ×1 (보여주기만 합니다)
     가운데 불 위의 철판 + 볶이는 면
     오른쪽 진행도 + 다음 순서 화살표
     아래   화살표 12칸. 지금 눌러야 할 칸이 금색으로 켜집니다.

   조작은 화살표 키, 또는 철판 위를 그 방향으로 드래그하는 두 가지입니다.
   (레퍼런스 화면에 조작 버튼이 없어서 클릭 버튼은 두지 않았습니다)

   [제한시간]  레퍼런스 화면에 시계가 없어서 timerRuns 를 꺼 두었습니다.
   되돌리려면 아래 timerRuns 한 줄만 지우면 set() 의 10초가 다시 흐릅니다.

   [공용 프레임과의 관계]  김치 볶기와 같습니다.
   css/minigame-frame.css 와 ui-mini-frame.js 는 건드리지 않고,
   이 게임이 켜져 있을 때만 적용되는 규칙으로 덮어씁니다.
   (css/minigames.css 의 "볶음우동 조리" 구역 참고)
   ------------------------------------------------------------ */

const STIR_TOTAL=DIRECTION_SEQUENCE_CONFIG.yakisoba.total;
const STIR_DIRECTIONS=DIRECTION_SEQUENCE_CONFIG.yakisoba.directions;
const STIR_WRONG_PENALTY=DIRECTION_SEQUENCE_CONFIG.yakisoba.wrongPenalty;
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
      configId:"yakisoba",
      arrows:randomFryDirections(STIR_DIRECTIONS,STIR_TOTAL),
      index:0,
      errors:0,
      total:STIR_TOTAL,
      phase:"ready",
      inputLocked:false,
      transitioning:false,
      drag:null                                             // 드래그 시작점. 놓으면 null
    };
    dom.miniTimer.textContent=`0 / ${STIR_TOTAL}`;          // 공용 카드는 CSS 로 숨겨져 있습니다
    renderStirScene();
  },

  // 레퍼런스 화면에 시계가 없습니다(위 [제한시간] 참고)
  timerRuns(){return false;},

  key(m,k,e){
    const direction=k.startsWith("arrow")?k.slice(5):"";
    if(FRY_DIRECTION_ARROWS[direction]){stirInput(direction,e?.repeat);return true;}
    return false;
  }
});

function renderStirScene(){
  const data=state.mini?.data;if(!data)return;
  const noodleStrands=Array.from({length:22},(_,index)=>{
    const x=5+(index*17)%76,y=5+(index*29)%72,turn=-42+(index*23)%84,width=26+(index*11)%25;
    return `<i class="yk-noodle" style="--yk-x:${x}%;--yk-y:${y}%;--yk-turn:${turn}deg;--yk-width:${width}%"></i>`;
  }).join("");
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

      <div class="yk-board cook-stage-${directionVisualStage(data.index,STIR_TOTAL)}" id="stirWorkArea">
        <div class="yk-griddle ${hasDayPrepAsset("stirGriddle")?"has-asset":""}" id="stirPlate">
          ${dayPrepAssetMarkup("stirGriddle","yk-griddle-asset","철판")}
          <i class="yk-steam steam-one"></i><i class="yk-steam steam-two"></i><i class="yk-steam steam-three"></i>
          <div class="yk-food ${hasDayPrepAsset("stirNoodles")?"has-prep-asset":""}" id="stirFood">
            <span class="yk-food-fallback" aria-hidden="true">
              ${noodleStrands}
              <b class="yk-garnish cabbage garnish-one"></b><b class="yk-garnish cabbage garnish-two"></b>
              <b class="yk-garnish carrot garnish-one"></b><b class="yk-garnish carrot garnish-two"></b>
              <b class="yk-garnish onion garnish-one"></b><b class="yk-garnish onion garnish-two"></b>
            </span>
            ${dayPrepAssetMarkup("stirNoodles","yk-food-asset","볶이는 우동")}
          </div>
          <i class="yk-spatula spatula-left ${hasDayPrepAsset("stirTeppanSpatula")?"has-prep-asset":""}">${dayPrepAssetMarkup("stirTeppanSpatula","yk-spatula-asset","왼쪽 철판 뒤집개")}</i>
          <i class="yk-spatula spatula-right ${hasDayPrepAsset("stirTeppanSpatula")?"has-prep-asset":""}">${dayPrepAssetMarkup("stirTeppanSpatula","yk-spatula-asset","오른쪽 철판 뒤집개")}</i>
          <i class="yk-fire"></i>
        </div>
        <span class="e3-result" id="e3Result" aria-live="polite"></span>
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
        ${data.arrows.map((direction,index)=>`<span class="yk-chip ${directionSequenceClasses(index,data.index)}" data-stir-index="${index}">${FRY_DIRECTION_ARROWS[direction]}</span>`).join("")}
      </div>
    </div>`;
  bindStirDrag();
}

/* 철판 위를 끄는 조작. 한 획(짧은 변의 STIR_DRAG_STEP 만큼)마다 한 번 볶습니다.
   기준점을 매번 지금 위치로 옮기므로 크게 휘저으면 연속으로 들어갑니다. */
function bindStirDrag(){
  const plate=dom.miniContent.querySelector("#stirPlate");if(!plate)return;
  plate.addEventListener("pointerdown",event=>{
    const m=state.mini;if(!m||m.engine!=="stir"||m.complete||m.data.inputLocked||m.data.phase==="complete")return;
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

function stirInput(direction,repeat=false){
  const m=state.mini;if(!m||m.engine!=="stir"||m.complete)return;
  if(repeat)return false;
  const data=m.data;
  const current=dom.miniContent.querySelector(`[data-stir-index="${data.index}"]`);
  processDirectionSequenceInput(m,direction,{
    sequenceKey:"arrows",indexKey:"index",
    onWrong(){
      if(current){current.classList.remove("wrong");void current.offsetWidth;current.classList.add("wrong");setTimeout(()=>current.classList.remove("wrong"),260);}
      lockDirectionInput(m,"#stirWorkArea",`${FRY_DIRECTION_ARROWS[data.arrows[data.index]]} 방향입니다. 철판 뒤집개를 그 방향으로 움직이세요.`);
    },
    onCorrect(){
      current?.classList.remove("current");current?.classList.add("done");
      dom.miniFeedback.textContent="볶기 성공";
      dom.miniContent.querySelector(`[data-stir-index="${data.index}"]`)?.classList.remove("upcoming");
      dom.miniContent.querySelector(`[data-stir-index="${data.index}"]`)?.classList.add("current");
      dom.miniContent.querySelector(`[data-stir-index="${data.index+2}"]`)?.classList.remove("queued");
      dom.miniContent.querySelector(`[data-stir-index="${data.index+2}"]`)?.classList.add("upcoming");
      dom.miniTimer.textContent=`${data.index} / ${STIR_TOTAL}`;
      const count=dom.miniContent.querySelector("#stirCount");
      if(count)count.textContent=`${data.index} / ${STIR_TOTAL}`;
      const nextArrow=dom.miniContent.querySelector("#stirNextArrow");
      if(nextArrow)nextArrow.textContent=FRY_DIRECTION_ARROWS[data.arrows[data.index]]||"✓";
      const work=dom.miniContent.querySelector("#stirWorkArea");
      if(work){
        const actionClass=`scrape-${direction}`,stage=`cook-stage-${directionVisualStage(data.index,STIR_TOTAL)}`;
        work.classList.remove("scrape-left","scrape-right","scrape-up","scrape-down","cook-stage-0","cook-stage-1","cook-stage-2","cook-stage-3");void work.offsetWidth;work.classList.add(actionClass,stage);
        setTimeout(()=>work.classList.remove(actionClass),E3_FEEL_CONFIG.actionMs);
      }
    },
    onComplete(){completeDirectionSequence(m,{
      workSelector:"#stirWorkArea",
      feedback:grade=>grade==="perfect"?"철판 위 우동을 완벽하게 볶았습니다!":"우동을 맛있게 볶았습니다!",
      onDone:()=>finishMini(Math.max(70,100-data.errors*STIR_WRONG_PENALTY))
    });}
  });
}
