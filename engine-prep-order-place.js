"use strict";

/* ============================================================
   E8 순서 배치 (낮 준비)

   정해진 순서대로 대상을 클릭하거나 끌어다 놓는 게임 묶음입니다.

   · batterIngredients  김치전 반죽 — 밀가루 → 물 → 김치 순서로 클릭.
                        3개를 다 넣으면 곧바로 거품기(E9)로 넘어갑니다.
                        → engine-prep-whisk.js 의 setupWhiskBatter 호출
   · skewer             닭꼬치 조립 — 닭 → 대파 → 닭 → 대파 → 닭 을 4꼬치.
                        클릭으로 고르거나 드래그로 놓을 수 있습니다.
   · tteokSoak /        떡·우동면 불리기 — 재료와 물을 각각 클릭. 순서는 자유.
     udonSoak           ✅ 두 게임이 이미 renderTteokSoak 하나를 함께 씁니다.
                        데이터만 다르게 넣는 방식이라 합치기 좋은 본보기입니다.
   ============================================================ */

registerDayPrepSetup("batter",()=>setupKimchiBatter());
registerDayPrepSetup("skewer",()=>setupChickenSkewer());
registerDayPrepSetup("tteokSoak",()=>setupTteokSoak());
registerDayPrepSetup("udonSoak",()=>setupUdonSoak());

// 셋 다 클릭·드래그만 쓰므로 키 처리가 없습니다.
registerDayPrepEngine("batterIngredients",{});
registerDayPrepEngine("skewer",{});
registerDayPrepEngine(["tteokSoak","udonSoak"],{});

/* ---- 김치전 반죽 재료 넣기 --------------------------------- */

function setupKimchiBatter(){
  setDayPrepData({mode:"batterIngredients",step:0,ingredients:[
    {id:"flour",label:"밀가루 봉투"},{id:"water",label:"물"},{id:"kimchi",label:"썰어 둔 김치"}
  ]});
  dom.miniTitle.textContent="김치전 · 반죽 만들기";
  dom.miniDescription.textContent="밀가루 → 물 → 썰어 둔 김치 순서로 믹스볼에 넣으세요.";
  renderKimchiBatterIngredients();
}

function renderKimchiBatterIngredients(){
  const data=state.mini.data,current=data.ingredients[data.step];
  dom.miniTimer.textContent=`${data.step} / ${data.ingredients.length}`;
  dom.miniContent.innerHTML=`
    <div class="batter-prep-scene">
      <div class="batter-ingredients">${data.ingredients.map((item,index)=>`<button type="button" class="batter-ingredient ${item.id} ${index<data.step?"added":""}" data-batter-ingredient="${item.id}" ${index<data.step?"disabled":""}><i></i><span>${item.label}</span></button>`).join("")}</div>
      <div class="mixing-bowl ingredient-step-${data.step}"><i class="batter-fill"></i></div>
    </div>
    <div class="cut-count">다음 재료 · ${current?.label||"거품기"}</div>`;
  dom.miniContent.querySelectorAll("[data-batter-ingredient]").forEach(button=>button.addEventListener("click",()=>addBatterIngredient(button.dataset.batterIngredient,button)));
}

function addBatterIngredient(ingredientId,button){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="batterIngredients")return;
  const expected=m.data.ingredients[m.data.step];
  if(ingredientId!==expected.id){dom.miniFeedback.textContent=`먼저 ${expected.label}을 넣으세요.`;audio.bad();return;}
  button.classList.add("pouring");button.disabled=true;m.data.step++;audio.click();
  dom.miniFeedback.textContent=`${expected.label} 넣기 완료`;
  setTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    // 재료를 다 넣으면 게임 종류가 거품기(E9)로 바뀝니다.
    if(m.data.step>=m.data.ingredients.length)setupWhiskBatter();
    else renderKimchiBatterIngredients();
  },420);
}

/* ---- 닭꼬치 조립 ------------------------------------------- */

function setupChickenSkewer(){
  setDayPrepData({mode:"skewer",sequence:["chicken","greenOnion","chicken","greenOnion","chicken"],placed:[],used:[],selectedPiece:null,completedSkewers:0,totalSkewers:4});
  dom.miniTitle.textContent="닭꼬치 4개 조립";
  dom.miniDescription.textContent="닭 → 대파 → 닭 → 대파 → 닭 순서로 재료를 꽂아 숯불에 올릴 꼬치 4개를 만드세요.";
  renderChickenSkewer();
}

function renderChickenSkewer(){
  const data=state.mini.data;
  dom.miniTimer.textContent=`꼬치 ${data.completedSkewers+1} / ${data.totalSkewers} · ${data.placed.length} / ${data.sequence.length}`;
  dom.miniContent.innerHTML=`
    <div class="skewer-prep-scene">
      <div class="skewer-batch-progress" aria-label="완성된 닭꼬치 수">${Array.from({length:data.totalSkewers},(_,index)=>`<span class="batch-skewer ${index<data.completedSkewers?"done":index===data.completedSkewers?"current":""}"><i></i><b></b><em></em><b></b><em></em><b></b></span>`).join("")}</div>
      <div class="skewer-sources">${data.sequence.map((ingredient,index)=>`<button type="button" draggable="true" class="skewer-piece ${ingredient} ${data.used.includes(index)?"used":""}" data-piece-index="${index}" data-ingredient="${ingredient}" ${data.used.includes(index)?"disabled":""}>${ingredient==="chicken"?"닭":"대파"}</button>`).join("")}</div>
      <div class="skewer-stick"><i></i>${data.sequence.map((ingredient,index)=>`<button type="button" class="skewer-slot ${index<data.placed.length?ingredient:""} ${index===data.placed.length?"current":""}" data-slot-index="${index}">${index<data.placed.length?(ingredient==="chicken"?"닭":"대파"):index+1}</button>`).join("")}</div>
    </div>
    <div class="cut-count">순서 · 닭 → 대파 → 닭 → 대파 → 닭</div>`;
  dom.miniContent.querySelectorAll("[data-piece-index]").forEach(piece=>{
    piece.addEventListener("dragstart",event=>{event.dataTransfer.setData("text/plain",piece.dataset.pieceIndex);event.dataTransfer.effectAllowed="move";});
    piece.addEventListener("click",()=>{data.selectedPiece=Number(piece.dataset.pieceIndex);dom.miniContent.querySelectorAll(".skewer-piece").forEach(item=>item.classList.toggle("selected",item===piece));});
  });
  dom.miniContent.querySelectorAll("[data-slot-index]").forEach(slot=>{
    slot.addEventListener("dragover",event=>event.preventDefault());
    slot.addEventListener("drop",event=>{event.preventDefault();placeSkewerPiece(Number(event.dataTransfer.getData("text/plain")),Number(slot.dataset.slotIndex));});
    slot.addEventListener("click",()=>{if(data.selectedPiece!=null)placeSkewerPiece(data.selectedPiece,Number(slot.dataset.slotIndex));});
  });
}

function placeSkewerPiece(pieceIndex,slotIndex){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="skewer")return;
  const data=m.data,ingredient=data.sequence[pieceIndex],expected=data.sequence[data.placed.length];
  if(data.used.includes(pieceIndex))return;
  if(slotIndex!==data.placed.length||ingredient!==expected){dom.miniFeedback.textContent=`다음에는 ${expected==="chicken"?"닭":"대파"}을 ${data.placed.length+1}번 슬롯에 놓으세요.`;audio.bad();return;}
  data.used.push(pieceIndex);data.placed.push(ingredient);data.selectedPiece=null;audio.click();dom.miniFeedback.textContent="재료를 꼬치에 꽂았습니다.";
  if(data.placed.length>=data.sequence.length){
    data.completedSkewers++;
    if(data.completedSkewers>=data.totalSkewers){finishDayPrepTask("assembleChickenSkewer","닭꼬치 4개 조립 완료");return;}
    data.placed=[];data.used=[];data.selectedPiece=null;
    dom.miniFeedback.textContent=`${data.completedSkewers}개 완성! 다음 꼬치를 같은 순서로 꽂으세요.`;
  }
  renderChickenSkewer();
}

/* ---- 떡 · 우동면 불리기 ------------------------------------ */

function setupTteokSoak(){
  if(Number(state.day)!==4||!state.mini)return;
  setDayPrepData({mode:"tteokSoak",taskId:DAY4_PREP_CONFIG.soak.taskId,menuId:"tteokbokki",ingredientKey:"tteok",ingredientLabel:"떡",added:{tteok:false,water:false},finishing:false});
  dom.miniTitle.textContent="떡볶이 · 떡 불려두기";
  dom.miniDescription.textContent="떡을 클릭해 볼에 넣고, 물통을 클릭해 물을 채우세요. 별도의 대기 시간은 없습니다.";
  renderTteokSoak();
}

function setupUdonSoak(){
  if(Number(state.day)!==3||!state.mini)return;
  setDayPrepData({mode:"udonSoak",taskId:"soakUdon",menuId:"yakisoba",ingredientKey:"udon",ingredientLabel:"우동면",added:{udon:false,water:false},finishing:false});
  dom.miniTitle.textContent="볶음우동 · 우동면 불려두기";
  dom.miniDescription.textContent="우동면을 클릭해 볼에 넣고, 물통을 클릭해 물을 채우세요. 별도의 대기 시간은 없습니다.";
  renderTteokSoak();
}

function renderTteokSoak(){
  const m=state.mini;if(!isDayPrepMini(m)||!["tteokSoak","udonSoak"].includes(m.data.mode))return;
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
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||!["tteokSoak","udonSoak"].includes(m.data.mode)||m.data.finishing||!Object.prototype.hasOwnProperty.call(m.data.added,item)||m.data.added[item])return;
  const data=m.data;data.added[item]=true;audio.click();dom.miniFeedback.textContent=item===data.ingredientKey?`${data.ingredientLabel}을 볼에 담았습니다.`:"볼에 물을 채웠습니다.";
  if(Object.values(m.data.added).every(Boolean)){
    data.finishing=true;renderTteokSoak();dom.miniFeedback.textContent=`${data.ingredientLabel}과 물이 모두 들어갔습니다. 불려두기 완료!`;
    setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(data.taskId,`${data.ingredientLabel} 불려두기 완료`);},360);
  }else renderTteokSoak();
}
