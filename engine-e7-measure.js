"use strict";

/* ============================================================
   E7 계량 (낮 준비) — 떡볶이 양념장 · 볶음우동 소스

   소스통을 골라 부을 때마다 정해진 양(step)씩 들어갑니다.
   목표량(target)과 정확히 같아야 하고, 넘치면 "한 번 덜어내기"로 되돌립니다.
   세 가지가 모두 정확히 맞으면 완료.

   레시피 데이터(day4-prep-data.js 의 SAUCE_RECIPES)만 갈아끼우면
   떡볶이·볶음우동이 같은 코드를 씁니다. 다른 엔진을 합칠 때 본보기로 삼으세요.
   새 소스를 추가하려면 SAUCE_RECIPES 에 항목 하나만 넣으면 됩니다.

   [화면 구성 — 3단]  컨셉 이미지(양배추 채썰기)와 같은 배치입니다.
     왼쪽   재료 목표 카드 (소스통 그림 · 목표량 · 현재량 · 덜어내기)
     가운데 나무 조리대 : 가운데 소스볼 + 소스통 3개(좌 · 우 · 아래)
     오른쪽 진행도 카드 · 조작 카드

   공용 프레임(ui-mini-frame.js · css/minigame-frame.css)은 건드리지 않고,
   css/day-prep-minigames.css 에서 .sauce-lab 이 있을 때만 가운데 열 제한을
   풀어 좌우 카드 자리를 확보합니다. (닭꼬치·김치전 반죽·멸치와 같은 방식)

   [조작] 키보드와 마우스 둘 다 됩니다.
     ← →        소스통 고르기   (오른쪽 조작 카드의 키 버튼도 같은 동작)
     ↓ / Space  고른 소스통 붓기 (조리대의 소스통을 직접 눌러도 됩니다)
     Backspace  한 번 덜어내기   (넘친 재료만)

   소스통과 볼은 전부 임시 CSS 도형입니다. assets/prep/sauce/ 에 그림을
   넣으면 .has-asset 이 붙어 도형이 꺼지고 <img> 가 대신 보입니다.
   자리 배치는 3개 기준입니다(SAUCE_SLOTS). 재료가 늘면 여기만 늘리세요.
   ============================================================ */

registerDayPrepSetup("yakisobaSauce",()=>setupYakisobaSauce());
registerDayPrepSetup("tteokbokkiSauce",()=>setupSauceRecipe("tteokbokki"));

registerDayPrepEngine("sauceMeasure",{
  key(m,k){
    if(k==="arrowleft"){moveSauceCursor(-1);return true;}
    if(k==="arrowright"){moveSauceCursor(1);return true;}
    if(k==="arrowdown"||k===" "||k==="enter"){pourSelectedSauce();return true;}
    if(k==="backspace"||k==="delete"){undoSelectedSauce();return true;}
    return false;
  }
});

// 재료 id → 에셋 키 (day-prep-minigames.js 의 DAY_PREP_ASSET_PATHS 와 같은 이름)
const SAUCE_ASSET_KEY=Object.freeze({
  soy:"sauceBottleSoy",oyster:"sauceBottleOyster",chili:"sauceBottleChili",
  gochujang:"sauceBottleGochujang",oligosaccharide:"sauceBottleOligosaccharide"
});
// 임시 도형 모양. 여기 없는 재료는 기본 간장병 모양(tall)으로 그립니다.
const SAUCE_BOTTLE_SHAPE=Object.freeze({chili:"cruet",oligosaccharide:"cruet"});
// 조리대 위 소스통 자리. 레시피의 재료 순서대로 왼쪽 → 오른쪽 → 아래에 앉습니다.
const SAUCE_SLOTS=Object.freeze(["at-left","at-right","at-bottom"]);

function setupYakisobaSauce(){
  if(Number(state.day)!==3)return;
  setupSauceRecipe("yakisoba");
}

function setupSauceRecipe(recipeId){
  const recipe=SAUCE_RECIPES[recipeId];if(!state.mini||!recipe)return;
  setDayPrepData({
    mode:"sauceMeasure",recipeId,recipe,finishing:false,shownFill:0,
    cursor:0,                    // 지금 고른 소스통 (레시피 재료 순서)
    sauces:recipe.ingredients.map(item=>({...item,amount:0}))
  });
  dom.miniTitle.textContent=recipeId==="tteokbokki"?"떡볶이 양념장 계량":"볶음우동 소스 제조";
  dom.miniDescription.textContent="←→로 소스통을 고르고 ↓로 부어 정량을 맞추세요! 넘치면 한 번씩 덜어낼 수 있습니다.";
  renderYakisobaSauce();
}

function sauceStatus(item){
  return item.amount===item.target?"exact":item.amount>item.target?"over":"under";
}

// 소스통 하나. 에셋이 있으면 <img>, 없으면 CSS 도형(뚜껑·몸통·라벨)으로 그립니다.
function sauceBottleMarkup(item,extraClass=""){
  const key=SAUCE_ASSET_KEY[item.id]||"";
  return `<span class="sc-bottle ${item.id} ${SAUCE_BOTTLE_SHAPE[item.id]||"tall"} ${hasDayPrepAsset(key)?"has-asset":""} ${extraClass}">
      <i class="sc-cap"></i><i class="sc-body"></i><i class="sc-tag">${item.label}</i>${dayPrepAssetMarkup(key,"sc-bottle-asset",item.label)}
    </span>`;
}

// 왼쪽 재료 목표 카드. 고른 소스통은 테두리가 밝아집니다.
function sauceGoalMarkup(item,selected,disabled){
  const status=sauceStatus(item);
  return `<div class="sc-panel sc-goal ${status} ${selected?"selected":""}">
      <span class="sc-goal-art">${sauceBottleMarkup(item,"mini")}</span>
      <span class="sc-goal-info">
        <b class="sc-goal-name">${item.label}</b>
        <span class="sc-goal-target">목표 <b>${item.target}g</b></span>
        <span class="sc-goal-now">${status==="exact"?"✓ ":status==="over"?"! ":""}현재 ${item.amount}g</span>
      </span>
      ${status==="over"?`<button type="button" class="sc-undo" data-sauce-undo="${item.id}" ${disabled?"disabled":""}>− ${item.step}g 덜어내기</button>`:""}
    </div>`;
}

// 오른쪽 조작 카드 한 줄 : [키] [키] … + 설명
function sauceControlRow(keys,caption,disabled){
  return `<div class="sc-control-row">
      <span class="sc-keys">${keys.map((entry,index)=>
        `${index?'<em aria-hidden="true">→</em>':""}<button type="button" class="sc-key" data-sauce-key="${entry.action}" ${disabled?"disabled":""} aria-label="${entry.label}">${entry.glyph}</button>`
      ).join("")}</span>
      <p>${caption}</p>
    </div>`;
}

function renderYakisobaSauce(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="sauceMeasure")return;
  const data=m.data,total=data.sauces.length;
  const exact=data.sauces.filter(item=>item.amount===item.target).length;
  const current=data.sauces[data.cursor]||data.sauces[0];
  const locked=data.finishing;
  // 볼에 차오르는 높이. 목표를 넘겨도 100% 이상은 올라가지 않습니다.
  const fill=Math.round(data.sauces.reduce((sum,item)=>sum+Math.min(item.amount/item.target,1),0)/total*74);
  dom.miniTimer.textContent=`${exact} / ${total}`;   // 공용 타이머 자리는 이 게임에서 숨깁니다

  dom.miniContent.innerHTML=`
    ${data.recipeId==="tteokbokki"?day4PrepFlowMarkup("tteokbokki",4):""}
    <div class="sauce-lab">
      <aside class="sc-col">
        <h3 class="sc-col-title starred">재료 목표</h3>
        ${data.sauces.map((item,index)=>sauceGoalMarkup(item,index===data.cursor,locked)).join("")}
      </aside>

      <div class="sc-board ${exact===total?"done":""}">
        <div class="sc-bowl ${hasDayPrepAsset("sauceBowl")?"has-asset":""}" style="--sauce-fill:${data.shownFill}%" aria-label="소스볼">
          ${dayPrepAssetMarkup("sauceBowl","sc-bowl-asset","소스볼")}<i class="sc-sauce"></i>
        </div>
        ${data.sauces.map((item,index)=>{
          const slot=SAUCE_SLOTS[index]||"at-bottom",status=sauceStatus(item);
          const selected=index===data.cursor;
          return `<i class="sc-arrow ${slot} ${selected&&status==="under"?"":"off"}" aria-hidden="true"></i>
            <button type="button" class="sc-pourer ${slot} ${status} ${selected?"selected":""}" data-sauce-id="${item.id}" ${locked?"disabled":""} aria-label="${item.label} 넣기 · 1회 ${item.step}g">
              ${sauceBottleMarkup(item)}<i class="sc-pour-stream"></i>
              <span class="sc-step-badge">+${item.step}g</span>
            </button>`;
        }).join("")}
      </div>

      <aside class="sc-col">
        <div class="sc-panel sc-count">
          <h3 class="sc-col-title">진행도</h3>
          <strong>${exact} / ${total}</strong>
        </div>
        <div class="sc-panel sc-control">
          <h3 class="sc-col-title">조작</h3>
          ${sauceControlRow([{action:"left",glyph:"◀",label:"왼쪽 소스통"},{action:"right",glyph:"▶",label:"오른쪽 소스통"}],"좌우로<br />소스통 고르기",locked)}
          ${sauceControlRow([{action:"pour",glyph:"▼",label:"붓기"}],`${current.label} 붓기<br /><b>+${current.step}g</b>`,locked)}
          ${sauceControlRow([{action:"undo",glyph:"⌫",label:"덜어내기"}],"넘친 소스<br />한 번 덜어내기",locked||sauceStatus(current)!=="over")}
        </div>
      </aside>
    </div>`;

  // 볼 높이는 그린 다음 한 프레임 뒤에 바꿔야 CSS transition 이 살아납니다.
  // (innerHTML 을 새로 넣으면 이전 요소가 사라져 전환이 끊깁니다)
  const bowl=dom.miniContent.querySelector(".sc-bowl");
  if(bowl&&data.shownFill!==fill){
    requestAnimationFrame(()=>bowl.style.setProperty("--sauce-fill",`${fill}%`));
    data.shownFill=fill;
  }
  dom.miniContent.querySelectorAll("[data-sauce-id]").forEach(button=>button.addEventListener("click",()=>addYakisobaSauce(button.dataset.sauceId)));
  dom.miniContent.querySelectorAll("[data-sauce-undo]").forEach(button=>button.addEventListener("click",()=>undoYakisobaSauce(button.dataset.sauceUndo)));
  dom.miniContent.querySelectorAll("[data-sauce-key]").forEach(button=>button.addEventListener("click",()=>{
    const action=button.dataset.sauceKey;
    if(action==="left")moveSauceCursor(-1);
    else if(action==="right")moveSauceCursor(1);
    else if(action==="pour")pourSelectedSauce();
    else undoSelectedSauce();
  }));
}

// 소스통이 볼 쪽으로 기울었다가 돌아옵니다. 다시 그린 뒤에 붙여야 살아남습니다.
function playSaucePour(id){
  const pourer=dom.miniContent.querySelector(`.sc-pourer[data-sauce-id="${id}"]`);
  if(pourer){
    pourer.classList.remove("pouring");void pourer.offsetWidth;pourer.classList.add("pouring");
    setTimeout(()=>pourer.classList.remove("pouring"),460);
  }
  const bowl=dom.miniContent.querySelector(".sc-bowl");
  if(bowl){
    bowl.classList.remove("splash");void bowl.offsetWidth;bowl.classList.add("splash");
    setTimeout(()=>bowl.classList.remove("splash"),340);
  }
}

/* ---- 조작 -------------------------------------------------- */

// 지금 조작을 받을 수 있는 상태인지. 아니면 null.
function activeSauceMeasure(){
  const m=state.mini;
  if(!isDayPrepMini(m)||m.complete||m.data.mode!=="sauceMeasure"||m.data.finishing)return null;
  return m;
}

// 소스통 고르기. 조리대 · 왼쪽 목표 카드 · 조작 카드 표시가 함께 움직입니다.
function selectSauce(index){
  const m=activeSauceMeasure();if(!m)return;
  const sauce=m.data.sauces[index];if(!sauce||index===m.data.cursor)return;
  m.data.cursor=index;audio.click();
  renderYakisobaSauce();
  dom.miniFeedback.textContent=`${sauce.label} 소스통 선택 · 1회 ${sauce.step}g`;
}

function moveSauceCursor(delta){
  const m=activeSauceMeasure();if(!m)return;
  const total=m.data.sauces.length;
  selectSauce((m.data.cursor+delta+total)%total);
}

function pourSelectedSauce(){
  const m=activeSauceMeasure();if(!m)return;
  addYakisobaSauce(m.data.sauces[m.data.cursor].id);
}

function undoSelectedSauce(){
  const m=activeSauceMeasure();if(!m)return;
  undoYakisobaSauce(m.data.sauces[m.data.cursor].id);
}

function addYakisobaSauce(id){
  const m=activeSauceMeasure();if(!m)return;
  const index=m.data.sauces.findIndex(item=>item.id===id);if(index<0)return;
  const sauce=m.data.sauces[index];
  m.data.cursor=index;   // 조리대에서 직접 누른 소스통이 곧 지금 고른 소스통입니다
  sauce.amount+=sauce.step;audio.click();dom.miniFeedback.textContent=`${sauce.label} ${sauce.step}g 투입 · 현재 ${sauce.amount}g`;
  checkYakisobaSauceComplete(m);
  playSaucePour(id);
}

function undoYakisobaSauce(id){
  const m=activeSauceMeasure();if(!m)return;
  const index=m.data.sauces.findIndex(item=>item.id===id);if(index<0)return;
  const sauce=m.data.sauces[index];
  if(sauce.amount<=sauce.target){dom.miniFeedback.textContent=`${sauce.label}은(는) 아직 넘치지 않았습니다.`;return;}
  m.data.cursor=index;
  sauce.amount=Math.max(0,sauce.amount-sauce.step);audio.click();dom.miniFeedback.textContent=`${sauce.label} ${sauce.step}g 덜어냈습니다. · 현재 ${sauce.amount}g`;
  checkYakisobaSauceComplete(m);
}

function checkYakisobaSauceComplete(m){
  const complete=m.data.sauces.every(item=>item.amount===item.target);
  if(complete)m.data.finishing=true;
  renderYakisobaSauce();
  if(complete){
    dom.miniFeedback.textContent="레시피와 정확히 일치합니다!";audio.success();
    setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(m.data.recipe.taskId,m.data.recipe.completionMessage);},360);
  }
}
