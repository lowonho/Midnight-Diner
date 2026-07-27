"use strict";

/* ============================================================
   E8 순서 배치 (낮 준비)

   정해진 순서대로 대상을 클릭하거나 끌어다 놓는 게임 묶음입니다.

   · batterIngredients  김치전 반죽 — 밀가루 → 물 → 김치 순서로 클릭.
                        3개를 다 넣으면 곧바로 거품기(E9)로 넘어갑니다.
                        → engine-e9-whisk.js 의 setupWhiskBatter 호출
   · skewer             닭꼬치 꽂기 — 닭 → 파 → 닭 → 파 → 닭 을 3꼬치.
                        클릭으로 고르거나 드래그로 놓을 수 있습니다.
   · tteokSoak /        떡·우동면 불리기 — 재료 → 물 순서로 클릭.
     udonSoak           두 게임이 renderTteokSoak과 공통 순서 판정을 함께 씁니다.
   ============================================================ */

registerDayPrepSetup("batter",()=>setupKimchiBatter());
registerDayPrepSetup("skewer",()=>setupChickenSkewer());
registerDayPrepSetup("tteokSoak",()=>setupTteokSoak());
registerDayPrepSetup("udonSoak",()=>setupUdonSoak());

// 셋 다 클릭·드래그만 쓰므로 키 처리가 없습니다.
registerDayPrepEngine("orderPlace",{});

/* ---- 김치전 반죽 재료 넣기 ---------------------------------
   화면 구성 (그림은 전부 CSS 임시 도형입니다. 에셋이 들어오면 교체)
     왼쪽   재료 카드 3장 — 부침가루 → 물 → 김치, 넣을 차례가 깜빡입니다
     가운데 위에서 내려다본 반죽 볼
     오른쪽 완성 개수 + 참고 모양
   재료를 다 넣으면 화면 틀은 그대로 두고 가운데만 젓기(E9)로 바뀝니다.
   그래서 화면 틀은 batterSceneMarkup 한 곳에서 만들고
   engine-e9-whisk.js 도 같은 함수를 불러 씁니다.

   모양·크기는 css/day-prep-minigames.css 의 "김치전 반죽" 구역에 모여 있습니다.
   공용 프레임(css/minigame-frame.css, ui-mini-frame.js)은 건드리지 않고,
   이 게임이 켜져 있을 때만 적용되는 규칙으로 덮어씁니다.
   ------------------------------------------------------------ */

// 넣는 순서 = 왼쪽 카드가 위에서 아래로 놓이는 순서입니다.
// assets/prep/batter/ 에 파일을 넣으면 CSS 도형 대신 그림이 자동으로 쓰입니다.
const BATTER_INGREDIENTS=Object.freeze([
  {id:"flour",label:"부침가루",asset:"batterFlour"},
  {id:"water",label:"물",asset:"batterWater"},
  {id:"kimchi",label:"김치",asset:"batterKimchi"}
]);

// 반죽 볼 하나. stateClass 로 담긴 양(step-0~3)이나 섞인 정도(stage-0~4)를 줍니다.
function batterBowlMarkup(stateClass,{id="",extra=""}={}){
  return `<div class="bt-bowl ${stateClass} ${hasDayPrepAsset("batterBowl")?"has-asset":""}"${id?` id="${id}"`:""}>
      ${dayPrepAssetMarkup("batterBowl","bt-bowl-asset","반죽 볼")}<i class="bt-batter"></i>${extra}
    </div>`;
}

// 재료 넣기(E8)와 젓기(E9)가 함께 쓰는 화면 틀. 가운데(center)만 갈아 끼웁니다.
//   addedCount 넣은 재료 수(왼쪽 카드 표시)   done 완성 개수(오른쪽 카드 표시)
function batterSceneMarkup(center,addedCount,done=0){
  return `<div class="batter-prep-scene">
      <aside class="bt-col">
        <div class="bt-panel bt-ing-panel">
          <h3 class="bt-col-title starred">재료</h3>
          <div class="bt-ing-list">${BATTER_INGREDIENTS.map((item,index)=>{
            const added=index<addedCount;
            return `<button type="button" class="bt-ing-card ${item.id} ${added?"added":""} ${index===addedCount?"next":""}" data-batter-ingredient="${item.id}" ${added||addedCount>=BATTER_INGREDIENTS.length?"disabled":""}>
              <span class="bt-ing-art ${hasDayPrepAsset(item.asset)?"has-asset":""}"><i></i>${dayPrepAssetMarkup(item.asset,"bt-ing-asset",item.label)}</span>
              <span class="bt-ing-name">${item.label}<b>×1</b></span>
            </button>`;
          }).join("")}</div>
        </div>
      </aside>

      <div class="bt-board">${center}</div>

      <aside class="bt-col">
        <div class="bt-panel bt-count">
          <h3 class="bt-col-title">완성 개수</h3>
          <strong>${done} / 1</strong>
        </div>
        <div class="bt-panel bt-guide">
          <h3 class="bt-col-title">참고 모양</h3>
          <div class="bt-guide-figure">${hasDayPrepAsset("batterDone")
            ?dayPrepAssetMarkup("batterDone","bt-guide-asset","완성된 반죽")
            :batterBowlMarkup("stage-4")}</div>
        </div>
      </aside>
    </div>`;
}

function setupKimchiBatter(){
  setDayPrepData({...createOrderPlacementState("batter"),ingredients:BATTER_INGREDIENTS});
  dom.miniTitle.textContent="김치전 반죽";
  dom.miniDescription.textContent="부침가루 → 물 → 김치 순서로 재료를 볼에 넣어주세요!";
  renderKimchiBatterIngredients();
}

function renderKimchiBatterIngredients(){
  const data=state.mini.data,current=data.ingredients[data.step];
  dom.miniTimer.textContent=`${data.step} / ${data.ingredients.length}`;   // 공용 카드는 CSS 로 숨겨져 있습니다
  dom.miniContent.innerHTML=batterSceneMarkup(`
      <div class="bt-bowl-wrap">${batterBowlMarkup(`step-${data.step}`)}</div>
      <p class="bt-progress">${current?`다음 재료 · <b>${current.label}</b>`:"이제 저어 주세요"}</p>`,
    data.step);
  dom.miniContent.querySelectorAll("[data-batter-ingredient]").forEach(button=>button.addEventListener("click",()=>addBatterIngredient(button.dataset.batterIngredient,button)));
}

function addBatterIngredient(ingredientId,button){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="orderPlace"||m.data.orderConfigId!=="batter")return;
  const expected=m.data.ingredients[m.data.step],result=placeOrderedItem(m.data,ingredientId);
  if(!result.accepted){dom.miniFeedback.textContent=`먼저 ${expected.label}을(를) 넣으세요.`;audio.bad();return;}
  button.classList.add("pouring");button.disabled=true;audio.click();
  dom.miniFeedback.textContent=`${expected.label} 넣기 완료`;
  setTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    // 재료를 다 넣으면 게임 종류가 거품기(E9)로 바뀝니다.
    if(m.data.step>=m.data.ingredients.length)setupWhiskBatter();
    else renderKimchiBatterIngredients();
  },420);
}

/* ---- 닭꼬치 꽂기 -------------------------------------------
   화면 구성 (그림은 전부 CSS 임시 도형입니다. 에셋이 들어오면 교체)
     왼쪽   재료 카드 2장 — 닭고기 ×9 / 파 ×6, 쓸 때마다 개수가 줄어듭니다
     가운데 꼬치 3개 — 아래에서 위로 5칸씩 채웁니다
     오른쪽 완성 개수 + 참고 모양
   재료 카드를 꼬치로 끌어다 놓거나, 카드를 눌러 집은 뒤 꼬치를 눌러도 됩니다.
   꼬치 3개는 어느 것부터 채워도 되고, 각 꼬치 안에서만 순서를 지키면 됩니다.

   모양·크기는 css/day-prep-minigames.css 의 "닭꼬치 꽂기" 구역에 모여 있습니다.
   공용 프레임(css/minigame-frame.css, ui-mini-frame.js)은 건드리지 않고,
   이 게임이 켜져 있을 때만 적용되는 규칙으로 덮어씁니다.
   ------------------------------------------------------------ */

const SKEWER_ORDER=["chicken","greenOnion","chicken","greenOnion","chicken"];  // 아래 → 위 순서
const SKEWER_TOTAL=SKEWER_BATCH_SIZE;                                          // 만들 꼬치 수
const SKEWER_LABEL={chicken:"닭고기",greenOnion:"파"};
// assets/prep/skewer/ 에 파일을 넣으면 CSS 도형 대신 그림이 자동으로 쓰입니다.
// (경로는 day-prep-minigames.js 의 DAY_PREP_ASSET_PATHS 참고)
const SKEWER_ASSET_KEY={chicken:"skewerChicken",greenOnion:"skewerGreenOnion"};

// E8의 공통 순서 데이터. 새 게임은 순서와 트랙 수만 추가하고 같은 판정을 씁니다.
const ORDER_PLACE_CONFIG=Object.freeze({
  batter:Object.freeze({order:Object.freeze(BATTER_INGREDIENTS.map(item=>item.id)),tracks:1}),
  skewer:Object.freeze({order:Object.freeze([...SKEWER_ORDER]),tracks:SKEWER_TOTAL}),
  tteokSoak:Object.freeze({order:Object.freeze(["tteok","water"]),tracks:1}),
  udonSoak:Object.freeze({order:Object.freeze(["udon","water"]),tracks:1})
});

function createOrderPlacementState(configId){
  const config=ORDER_PLACE_CONFIG[configId];
  return {mode:"orderPlace",orderConfigId:configId,order:[...config.order],placements:Array.from({length:config.tracks},()=>[]),step:0};
}

function expectedOrderItem(data,trackIndex=0){
  return data.order[data.placements[trackIndex]?.length??0]??null;
}

function placeOrderedItem(data,item,trackIndex=0){
  const track=data.placements[trackIndex];
  if(!track)return {accepted:false,reason:"missingTrack",expected:null,complete:false};
  const expected=expectedOrderItem(data,trackIndex);
  if(expected!==item)return {accepted:false,reason:"wrongOrder",expected,complete:false};
  track.push(item);
  if(trackIndex===0)data.step=track.length;
  return {accepted:true,expected:null,complete:track.length>=data.order.length};
}

function setupChickenSkewer(){
  const stock={chicken:0,greenOnion:0};
  SKEWER_ORDER.forEach(ingredient=>{stock[ingredient]+=SKEWER_TOTAL;});   // 9 / 6
  setDayPrepData({...createOrderPlacementState("skewer"),total:SKEWER_TOTAL,stock,selected:null});
  dom.miniTitle.textContent="닭꼬치 꽂기";
  dom.miniDescription.textContent="닭과 파를 번갈아 순서대로 꽂아주세요! (재료를 끌어다 놓거나 눌러서 집으세요)";
  renderChickenSkewer();
}

// 재료 한 조각. 에셋이 있으면 <img>, 없으면 CSS 도형으로 그립니다.
function skewerPieceMarkup(ingredient,extraClass=""){
  const key=SKEWER_ASSET_KEY[ingredient];
  return `<span class="sk-piece ${ingredient} ${hasDayPrepAsset(key)?"has-asset":""} ${extraClass}">${dayPrepAssetMarkup(key,"sk-piece-asset",SKEWER_LABEL[ingredient])}</span>`;
}

// 꼬치 하나. 아래에서 위로 채우므로 화면에는 슬롯을 뒤집어 그립니다.
function skewerRackMarkup(stack,index){
  const done=stack.length>=SKEWER_ORDER.length;
  const slots=SKEWER_ORDER.map((ingredient,slot)=>{
    if(slot<stack.length)return `<span class="sk-slot filled">${skewerPieceMarkup(stack[slot])}</span>`;
    return `<span class="sk-slot empty hint-${ingredient} ${slot===stack.length?"next":""}"></span>`;
  }).reverse().join("");
  return `<div class="sk-rack ${done?"done":""}" data-skewer="${index}" role="button" tabindex="0" aria-label="${index+1}번 꼬치 · ${stack.length} / ${SKEWER_ORDER.length}">
      ${skewerRodMarkup()}<div class="sk-slots">${slots}</div>
    </div>`;
}

function skewerRodMarkup(){
  return `<i class="sk-rod ${hasDayPrepAsset("skewerStick")?"has-asset":""}">${dayPrepAssetMarkup("skewerStick","sk-rod-asset")}</i>`;
}

function renderChickenSkewer(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="orderPlace"||m.data.orderConfigId!=="skewer")return;
  const data=m.data,done=skewerDoneCount(data);
  dom.miniTimer.textContent=`${done} / ${data.total}`;   // 공용 타이머 자리는 이 게임에서 숨깁니다
  dom.miniContent.innerHTML=`
    <div class="skewer-prep-scene">
      <aside class="sk-col">
        <h3 class="sk-col-title">★ 재료 ★</h3>
        ${Object.keys(SKEWER_LABEL).map(ingredient=>{
          const left=data.stock[ingredient];
          return `<button type="button" class="sk-panel sk-ing-card ${ingredient} ${left<=0?"used-up":""} ${data.selected===ingredient?"selected":""}" data-ingredient="${ingredient}" draggable="${left>0}" ${left<=0?"disabled":""}>
            <span class="sk-ing-art">${skewerPieceMarkup(ingredient,"art")}${skewerPieceMarkup(ingredient,"art")}${skewerPieceMarkup(ingredient,"art")}</span>
            <span class="sk-ing-name">${SKEWER_LABEL[ingredient]}<b>×${left}</b></span>
          </button>`;
        }).join("")}
      </aside>

      <div class="sk-board">${data.placements.map((stack,index)=>skewerRackMarkup(stack,index)).join("")}</div>

      <aside class="sk-col">
        <div class="sk-panel sk-count">
          <h3 class="sk-col-title">완성 개수</h3>
          <strong>${done} / ${data.total}</strong>
        </div>
        <div class="sk-panel sk-guide">
          <h3 class="sk-col-title">참고 모양</h3>
          <div class="sk-guide-skewer">${skewerRodMarkup()}<span class="sk-guide-pieces">${[...SKEWER_ORDER].reverse().map(ingredient=>skewerPieceMarkup(ingredient,"mini")).join("")}</span></div>
        </div>
      </aside>
    </div>`;
  bindChickenSkewerEvents();
}

function bindChickenSkewerEvents(){
  const scene=dom.miniContent.querySelector(".skewer-prep-scene");if(!scene)return;
  scene.querySelectorAll("[data-ingredient]").forEach(card=>{
    const ingredient=card.dataset.ingredient;
    card.addEventListener("click",()=>selectSkewerIngredient(ingredient));
    card.addEventListener("dragstart",event=>{
      event.dataTransfer.setData("text/plain",ingredient);event.dataTransfer.effectAllowed="copy";
      card.classList.add("dragging");selectSkewerIngredient(ingredient);
    });
    card.addEventListener("dragend",()=>card.classList.remove("dragging"));
  });
  scene.querySelectorAll(".sk-rack").forEach(rack=>{
    const index=Number(rack.dataset.skewer);
    // 놓기(드래그) — dragover 를 막아야 drop 이 들어옵니다. 슬롯에서 올라온 이벤트도 여기서 받습니다.
    rack.addEventListener("dragover",event=>{event.preventDefault();event.dataTransfer.dropEffect="copy";rack.classList.add("drop-hover");});
    rack.addEventListener("dragleave",event=>{if(!rack.contains(event.relatedTarget))rack.classList.remove("drop-hover");});
    rack.addEventListener("drop",event=>{
      event.preventDefault();rack.classList.remove("drop-hover");
      placeSkewerPiece(index,event.dataTransfer.getData("text/plain"));
    });
    // 집어 든 재료를 클릭/엔터로 놓기
    rack.addEventListener("click",()=>placeSelectedSkewerPiece(index));
    rack.addEventListener("keydown",event=>{
      if(event.key!=="Enter"&&event.key!==" ")return;
      event.preventDefault();placeSelectedSkewerPiece(index);
    });
  });
}

function skewerDoneCount(data){
  return data.placements.filter(stack=>stack.length>=data.order.length).length;
}

// 재료 집기. 다시 그리지 않고 선택 표시만 바꿉니다.
function selectSkewerIngredient(ingredient){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="orderPlace"||m.data.orderConfigId!=="skewer")return;
  if(!m.data.stock[ingredient])return;
  m.data.selected=ingredient;
  dom.miniContent.querySelectorAll("[data-ingredient]").forEach(card=>card.classList.toggle("selected",card.dataset.ingredient===ingredient));
  dom.miniFeedback.textContent=`${SKEWER_LABEL[ingredient]}를 집었습니다. 꼬치를 누르거나 끌어다 놓으세요.`;
}

function placeSelectedSkewerPiece(skewerIndex){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="orderPlace"||m.data.orderConfigId!=="skewer")return;
  if(!m.data.selected){dom.miniFeedback.textContent="왼쪽에서 재료를 먼저 집으세요.";return;}
  placeSkewerPiece(skewerIndex,m.data.selected);
}

function placeSkewerPiece(skewerIndex,ingredient){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="orderPlace"||m.data.orderConfigId!=="skewer")return;
  const data=m.data,stack=data.placements[skewerIndex];
  if(!stack||!SKEWER_LABEL[ingredient])return;
  if(stack.length>=SKEWER_ORDER.length)return rejectSkewerPiece(skewerIndex,"이 꼬치는 이미 다 찼습니다.");
  if(!data.stock[ingredient])return rejectSkewerPiece(skewerIndex,`${SKEWER_LABEL[ingredient]}가 남아 있지 않습니다.`);
  const result=placeOrderedItem(data,ingredient,skewerIndex);
  if(!result.accepted)return rejectSkewerPiece(skewerIndex,`이번에는 ${SKEWER_LABEL[result.expected]} 차례입니다.`);

  data.stock[ingredient]--;data.selected=null;audio.click();
  const done=skewerDoneCount(data);
  dom.miniFeedback.textContent=stack.length>=SKEWER_ORDER.length
    ? `꼬치 ${done} / ${data.total} 완성!`
    : `${SKEWER_LABEL[ingredient]}를 꽂았습니다.`;
  renderChickenSkewer();
  if(done>=data.total)finishDayPrepTask("assembleChickenSkewer",`닭꼬치 ${data.total}개 꽂기 완료`);
}

// 잘못 놓았을 때: 상태는 그대로 두고 해당 꼬치만 흔듭니다.
function rejectSkewerPiece(skewerIndex,message){
  dom.miniFeedback.textContent=message;audio.bad();
  const rack=dom.miniContent.querySelector(`.sk-rack[data-skewer="${skewerIndex}"]`);
  if(!rack)return;
  rack.classList.remove("reject");void rack.offsetWidth;rack.classList.add("reject");
  setTimeout(()=>rack.classList.remove("reject"),340);
}

/* ---- 떡 · 우동면 불리기 ------------------------------------ */

function setupTteokSoak(){
  if(Number(state.day)<4||!state.mini)return;
  setDayPrepData({...createOrderPlacementState("tteokSoak"),taskId:DAY4_PREP_CONFIG.soak.taskId,menuId:"tteokbokki",ingredientKey:"tteok",ingredientLabel:"떡",added:{tteok:false,water:false},finishing:false});
  dom.miniTitle.textContent="떡볶이 · 떡 불려두기";
  dom.miniDescription.textContent="떡을 클릭해 볼에 넣고, 물통을 클릭해 물을 채우세요. 별도의 대기 시간은 없습니다.";
  renderTteokSoak();
}

function setupUdonSoak(){
  if(Number(state.day)<3||!state.mini)return;
  setDayPrepData({...createOrderPlacementState("udonSoak"),taskId:"soakUdon",menuId:"yakisoba",ingredientKey:"udon",ingredientLabel:"우동면",added:{udon:false,water:false},finishing:false});
  dom.miniTitle.textContent="볶음우동 · 우동면 불려두기";
  dom.miniDescription.textContent="우동면을 클릭해 볼에 넣고, 물통을 클릭해 물을 채우세요. 별도의 대기 시간은 없습니다.";
  renderTteokSoak();
}

function renderTteokSoak(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="orderPlace"||!["tteokSoak","udonSoak"].includes(m.data.orderConfigId))return;
  const data=m.data,key=data.ingredientKey,label=data.ingredientLabel,count=Object.values(data.added).filter(Boolean).length,isUdon=key==="udon";
  dom.miniTimer.textContent=`${count} / 2`;
  dom.miniContent.innerHTML=`
    ${data.menuId==="tteokbokki"?day4PrepFlowMarkup("tteokbokki",0):""}
    <div class="tteok-soak-scene">
      <button type="button" class="tteok-source ${isUdon?"udon-source":""} ${data.added[key]?"added":""}" data-soak-item="${key}" ${data.added[key]||data.finishing?"disabled":""}><i></i><strong>${label}</strong></button>
      <div class="soaking-bowl ${isUdon?"udon-bowl":""} ${data.added.water?"has-water":""} ${data.added[key]?"has-ingredient":""}" aria-label="${label}을 불리는 볼"><i class="water-fill"></i>${!isUdon?dayPrepAssetMarkup(data.added[key]&&data.added.water?"tteokSoakComplete":data.added[key]?"tteokSoakTteok":data.added.water?"tteokSoakWater":"tteokSoakEmpty","soak-state-asset",""):""}<span>${data.added[key]?Array.from({length:isUdon?5:7},()=>"<b></b>").join(""):"빈 볼"}</span></div>
      <button type="button" class="water-source ${data.added.water?"added":""}" data-soak-item="water" ${data.added.water||data.finishing?"disabled":""}><i></i><strong>물통</strong></button>
    </div>
    <div class="cut-count">${label} ${data.added[key]?"✓":"○"} · 물 ${data.added.water?"✓":"○"}</div>`;
  dom.miniContent.querySelectorAll("[data-soak-item]").forEach(button=>button.addEventListener("click",()=>addTteokSoakItem(button.dataset.soakItem)));
}

function addTteokSoakItem(item){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="orderPlace"||!["tteokSoak","udonSoak"].includes(m.data.orderConfigId)||m.data.finishing||!Object.prototype.hasOwnProperty.call(m.data.added,item)||m.data.added[item])return;
  const data=m.data,result=placeOrderedItem(data,item);
  if(!result.accepted){dom.miniFeedback.textContent=`먼저 ${data.ingredientLabel}을 볼에 담아주세요.`;audio.bad();return;}
  data.added[item]=true;audio.click();dom.miniFeedback.textContent=item===data.ingredientKey?`${data.ingredientLabel}을 볼에 담았습니다.`:"볼에 물을 채웠습니다.";
  if(Object.values(m.data.added).every(Boolean)){
    data.finishing=true;renderTteokSoak();dom.miniFeedback.textContent=`${data.ingredientLabel}과 물이 모두 들어갔습니다. 불려두기 완료!`;
    setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(data.taskId,`${data.ingredientLabel} 불려두기 완료`);},360);
  }else renderTteokSoak();
}
