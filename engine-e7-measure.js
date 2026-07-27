"use strict";

/* ============================================================
   E7 계량 (낮 준비) — 떡볶이 양념장 · 볶음우동 소스

   소스통을 클릭할 때마다 정해진 양(step)씩 들어갑니다.
   목표량(target)과 정확히 같아야 하고, 넘치면 "한 번 덜어내기"로 되돌립니다.
   세 가지가 모두 정확히 맞으면 완료.

   ✅ 이 엔진은 원래부터 잘 만들어져 있었습니다.
   레시피 데이터(day4-prep-data.js 의 SAUCE_RECIPES)만 갈아끼우면
   떡볶이·볶음우동이 같은 코드를 씁니다. 다른 엔진을 합칠 때 본보기로 삼으세요.
   새 소스를 추가하려면 SAUCE_RECIPES 에 항목 하나만 넣으면 됩니다.
   ============================================================ */

registerDayPrepSetup("yakisobaSauce",()=>setupYakisobaSauce());
registerDayPrepSetup("tteokbokkiSauce",()=>setupSauceRecipe("tteokbokki"));

// 클릭만 쓰는 게임이라 키 처리가 없습니다.
registerDayPrepEngine("sauceMeasure",{});

function setupYakisobaSauce(){
  if(Number(state.day)<3)return;
  setupSauceRecipe("yakisoba");
}

function setupSauceRecipe(recipeId){
  const recipe=SAUCE_RECIPES[recipeId];if(!state.mini||!recipe)return;
  setDayPrepData({mode:"sauceMeasure",recipeId,recipe,finishing:false,sauces:recipe.ingredients.map(item=>({...item,amount:0}))});
  dom.miniTitle.textContent=recipeId==="tteokbokki"?"떡볶이 · 양념장 계량":"볶음우동 · 소스 제조";
  dom.miniDescription.textContent="레시피와 정확히 같은 양이 되도록 소스통을 클릭하세요. 초과한 소스는 한 번씩 덜어낼 수 있습니다.";
  renderYakisobaSauce();
}

function renderYakisobaSauce(){
  const data=state.mini.data,totalRatio=data.sauces.reduce((sum,item)=>sum+Math.min(item.amount/item.target,1),0)/data.sauces.length;
  dom.miniTimer.textContent=`${data.sauces.filter(item=>item.amount===item.target).length} / 3`;
  dom.miniContent.innerHTML=`
    ${data.recipeId==="tteokbokki"?day4PrepFlowMarkup("tteokbokki",4):""}
    <div class="sauce-recipe"><strong>${data.recipe.title}</strong>${data.sauces.map(item=>`<span>${item.label} ${item.target}g</span>`).join("")}</div>
    <div class="yakisoba-sauce-work">
      <div class="sauce-bottles">${data.sauces.map(item=>`<button type="button" class="sauce-bottle ${item.id}" data-sauce-id="${item.id}" ${data.finishing?"disabled":""}><i></i><strong>${item.label}</strong><small>+${item.step}g</small></button>`).join("")}</div>
      <div class="sauce-mixing-bowl" style="--sauce-height:${Math.round(totalRatio*65)}%"><i></i><span>소스볼</span></div>
    </div>
    <div class="sauce-measure-list">${data.sauces.map(item=>{
      const status=item.amount===item.target?"exact":item.amount>item.target?"over":"under";
      return `<div class="sauce-measure ${status}"><span>${item.amount===item.target?"✓":item.amount>item.target?"!":"○"}</span><strong>${item.label}</strong><b>${item.amount} / ${item.target}g</b>${item.amount>item.target?`<button type="button" data-sauce-undo="${item.id}">한 번 덜어내기</button>`:""}</div>`;
    }).join("")}</div>`;
  dom.miniContent.querySelectorAll("[data-sauce-id]").forEach(button=>button.addEventListener("click",()=>addYakisobaSauce(button.dataset.sauceId)));
  dom.miniContent.querySelectorAll("[data-sauce-undo]").forEach(button=>button.addEventListener("click",()=>undoYakisobaSauce(button.dataset.sauceUndo)));
}

function addYakisobaSauce(id){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="sauceMeasure"||m.data.finishing)return;
  const sauce=m.data.sauces.find(item=>item.id===id);if(!sauce)return;
  sauce.amount+=sauce.step;audio.click();dom.miniFeedback.textContent=`${sauce.label} ${sauce.step}g 투입`;
  checkYakisobaSauceComplete(m);
}

function undoYakisobaSauce(id){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="sauceMeasure"||m.data.finishing)return;
  const sauce=m.data.sauces.find(item=>item.id===id);if(!sauce||sauce.amount<=sauce.target)return;
  sauce.amount=Math.max(0,sauce.amount-sauce.step);audio.click();dom.miniFeedback.textContent=`${sauce.label} ${sauce.step}g 덜어냈습니다.`;
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
