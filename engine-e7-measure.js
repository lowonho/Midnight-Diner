"use strict";

/* ============================================================
   E7 계량 (낮 준비) — 떡볶이 양념장 · 볶음우동 소스

   소스통을 고른 뒤 한 번 부으면 레시피 분량 전체가 들어갑니다.
   세 가지 재료를 **레시피 순서대로** 한 번씩 넣으면 완료됩니다.
     떡볶이 양념장  고추장 → 올리고당 → 간장
     볶음우동 소스  간장 → 굴소스 → 고추기름
   순서는 SAUCE_RECIPES.ingredients 의 나열 순서 그대로입니다. 순서를 바꾸려면
   그 배열만 고치면 되는데, **소스볼 그림 4장도 같은 순서로 그려져 있으니**
   그림을 새로 받지 않고 배열만 바꾸면 안 됩니다 (아래 [그림] 항 참고).
   차례가 아닌 소스통은 눌러도 들어가지 않고 어느 것이 먼저인지 알려 줍니다.

   레시피 데이터(day4-prep-data.js 의 SAUCE_RECIPES)만 갈아끼우면
   떡볶이·볶음우동이 같은 코드를 씁니다. 다른 엔진을 합칠 때 본보기로 삼으세요.
   새 소스를 추가하려면 SAUCE_RECIPES 에 항목 하나만 넣으면 됩니다.

   [화면 구성 — 3단]  컨셉 이미지(양배추 채썰기)와 같은 배치입니다.
     왼쪽   재료 목표 카드 (소스통 그림 · 레시피 분량 · 투입 여부)
     가운데 나무 조리대 : 가운데 소스볼 + 소스통 3개(좌 · 우 · 아래)
     오른쪽 진행도 카드 · 조작 카드

   공용 프레임(ui-mini-frame.js · css/minigame-frame.css)은 건드리지 않고,
   css/day-prep-minigames.css 에서 .sauce-lab 이 있을 때만 가운데 열 제한을
   풀어 좌우 카드 자리를 확보합니다. (닭꼬치·김치전 반죽·멸치와 같은 방식)

   [조작] 키보드와 마우스 둘 다 됩니다.
     ← →        소스통 고르기   (오른쪽 조작 카드의 키 버튼도 같은 동작)
     ↓ / Space  고른 소스통 붓기 (조리대의 소스통을 직접 눌러도 됩니다)

   [그림] assets/minigame/E7 의 납품 에셋입니다 (경로는 day-prep-minigames.js 의
   DAY_PREP_ASSET_PATHS). 소스통·소스볼·화살표 모두 그림이 있고, 아직 임시 CSS
   도형인 것은 부어지는 줄기 하나뿐입니다. 그림이 빠지면 .has-asset 이 안 붙어
   예전 도형으로 되돌아갑니다.
     소스통  레시피마다 3장. **조리대와 왼쪽 재료 카드가 같은 장**을 씁니다.
     뚜껑열림 레시피마다 3장. 병을 눌러 들어 올리는 동안만 이 그림으로 바뀝니다.
     소스볼  레시피마다 4장. 넣은 재료 **개수**가 곧 장 번호입니다(0 빈 볼 → 3 완성).
             넣는 순서가 고정이라 개수만으로 그림과 내용이 정확히 맞습니다
             (02 = 고추장만, 03 = 고추장+올리고당 …). 순서를 풀면 여기가 어긋납니다.
     화살표  한 장을 세 자리가 CSS 회전으로 돌려 씁니다(→ · ← · ↓).
             **지금 넣을 차례**의 소스통 옆만 밝습니다.
   자리 배치는 3개 기준입니다(SAUCE_SLOTS). 재료가 늘면 여기와 소스볼 장수를
   같이 늘려야 합니다.
   ============================================================ */

registerDayPrepSetup("yakisobaSauce",()=>setupYakisobaSauce());
registerDayPrepSetup("tteokbokkiSauce",()=>setupSauceRecipe("tteokbokki"));

registerDayPrepEngine("sauceMeasure",{
  key(m,k,e){
    if(e?.repeat&&["arrowleft","arrowright","arrowdown"," ","enter"].includes(k))return true;
    if(k==="arrowleft"){moveSauceCursor(-1);return true;}
    if(k==="arrowright"){moveSauceCursor(1);return true;}
    if(k==="arrowdown"||k===" "||k==="enter"){pourSelectedSauce();return true;}
    return false;
  }
});

/* 레시피 + 재료 id → 소스통 에셋 키 (day-prep-minigames.js 의 DAY_PREP_ASSET_PATHS 와 같은 이름).
   ⚠️ 재료 id 하나로는 부족합니다 — **간장은 두 레시피에 다 나오는데 납품 그림이
      서로 다릅니다.** 자리(왼쪽/아래)도 갈려서 크기까지 다르므로 합칠 수 없습니다. */
const SAUCE_ASSET_KEY=Object.freeze({
  tteokbokki:Object.freeze({
    gochujang:"sauceBottleTteokbokkiGochujang",
    oligosaccharide:"sauceBottleTteokbokkiOligosaccharide",
    soy:"sauceBottleTteokbokkiSoy"
  }),
  yakisoba:Object.freeze({
    soy:"sauceBottleYakisobaSoy",
    oyster:"sauceBottleYakisobaOyster",
    chili:"sauceBottleYakisobaChili"
  })
});
/* 소스볼 4장. **넣은 재료 개수**가 곧 장 번호입니다 (0 빈 볼 → 3 완성).
   넣는 순서가 레시피 순서로 고정이라 개수만으로 그림과 내용이 딱 맞습니다. */
function sauceBowlAssetKey(recipeId,poured){
  return `sauceBowl${recipeId==="tteokbokki"?"Tteokbokki":"Yakisoba"}${Math.min(poured,3)}`;
}
function sauceBottleAssetKey(recipeId,id){
  return SAUCE_ASSET_KEY[recipeId]?.[id]||"";
}
// 뚜껑 연 그림은 닫힌 그림 키에 Open 을 붙인 이름입니다 (DAY_PREP_ASSET_PATHS)
function sauceBottleOpenAssetKey(recipeId,id){
  const key=sauceBottleAssetKey(recipeId,id);
  return key?`${key}Open`:"";
}

/* .sc-bottle 상자의 가로/세로 (css/day-prep-minigames.css 의 `height: 1.72 * --bw`).
   아래 계산이 상자 대비 % 로만 나오므로 --bw 가 자리마다 달라도 그대로 맞습니다. */
const SAUCE_BOTTLE_BOX_RATIO=1/1.72;

/* 뚜껑 연 병을 **닫힌 병과 같은 배율**로 겹쳐 놓기 위한 값(상자 대비 %).
   ⚠️ 그냥 같은 상자에 object-fit:contain 으로 넣으면 안 됩니다. 납품 그림이 짝마다
      캔버스가 달라서 — 뚜껑을 뺀 만큼 짧은 것도 있고 고추기름처럼 젖힌 뚜껑이
      위로 삐져나와 오히려 큰 것도 있습니다 — 뚜껑을 여는 순간 병 몸통이
      커졌다 작아졌다 합니다. 병을 드는 바로 그 순간이라 눈에 그대로 띕니다.
   닫힌 그림의 아래끝에 맞춰 세우므로(뚜껑은 위로만 자랍니다) 몸통이 제자리에 섭니다.
   tools/build-minigame-art-webp.js 의 뚜껑 열림 6장도 같은 계산으로 크기를
   잡아 뒀습니다 — 한쪽만 고치면 어긋납니다. */
function sauceOpenBottleStyle(closedKey,openKey){
  const closed=dayPrepAssets[closedKey]?.image,open=dayPrepAssets[openKey]?.image;
  if(!closed?.naturalWidth||!open?.naturalWidth)return "";
  const ratio=closed.naturalWidth/closed.naturalHeight;
  // contain 결과 — 그림이 상자보다 넓으면 가로가, 좁으면 세로가 먼저 막힙니다
  const wide=ratio>SAUCE_BOTTLE_BOX_RATIO;
  const closedW=wide?1:ratio/SAUCE_BOTTLE_BOX_RATIO;
  const closedH=wide?SAUCE_BOTTLE_BOX_RATIO/ratio:1;
  const pct=value=>`${(value*100).toFixed(2)}%`;
  return `--open-w:${pct(closedW*open.naturalWidth/closed.naturalWidth)};`
    +`--open-h:${pct(closedH*open.naturalHeight/closed.naturalHeight)};`
    +`--open-bottom:${pct((1-closedH)/2)}`;
}
// 임시 도형 모양. 여기 없는 재료는 기본 간장병 모양(tall)으로 그립니다.
const SAUCE_BOTTLE_SHAPE=Object.freeze({chili:"cruet",oligosaccharide:"cruet"});
const SAUCE_FLOW_ASSET=Object.freeze({thin:"sauceFlowThin",syrup:"sauceFlowSyrup",thick:"sauceFlowThick"});
// 조리대 위 소스통 자리. 레시피의 재료 순서대로 왼쪽 → 오른쪽 → 아래에 앉습니다.
const SAUCE_SLOTS=Object.freeze(["at-left","at-right","at-bottom"]);
const SAUCE_POUR_DURATION=680;

function setupYakisobaSauce(){
  setupSauceRecipe("yakisoba");
}

function setupSauceRecipe(recipeId){
  const recipe=SAUCE_RECIPES[recipeId];if(!state.mini||!recipe)return;
  setDayPrepData({
    // shownStage = 지금 화면에 깔린 소스볼 그림 번호(= 넣은 재료 개수).
    // 실제 개수보다 늦게 따라옵니다 — 줄기가 볼에 닿는 순간에 갈아 끼웁니다(playSaucePour).
    mode:"sauceMeasure",recipeId,recipe,finishing:false,pourLocked:false,shownFill:0,shownStage:0,completionGrade:"",pendingCursor:null,
    cursor:0,                    // 지금 고른 소스통 (레시피 재료 순서)
    sauces:recipe.ingredients.map(item=>({...item,amount:0}))
  });
  dom.miniTitle.textContent=recipeId==="tteokbokki"?"떡볶이 양념장 만들기":"볶음우동 소스 만들기";
  dom.miniDescription.textContent=`←→로 소스통을 고르고 ↓로 부어주세요. ${recipe.ingredients.map(item=>item.label).join(" → ")} 순서로 넣어야 합니다!`;
  renderYakisobaSauce();
}

function sauceStatus(item){return item.amount===item.target?"exact":"under";}

function sauceCompletionGrade(){return "perfect";}

/* 지금 넣을 차례. 레시피 순서대로 고정이라 "아직 안 넣은 첫 번째" 가 곧 차례입니다.
   다 넣었으면 -1 입니다. 화살표·카드 표시·붓기 판정이 전부 이 하나를 봅니다. */
function sauceTurnIndex(data){
  return data.sauces.findIndex(item=>item.amount!==item.target);
}

function nextIncompleteSauceIndex(data,fromIndex){
  for(let offset=1;offset<=data.sauces.length;offset++){
    const index=(fromIndex+offset)%data.sauces.length;
    if(data.sauces[index].amount!==data.sauces[index].target)return index;
  }
  return fromIndex;
}

function sauceStreamMarkup(item){
  const flow=item.flow||"thin",key=SAUCE_FLOW_ASSET[flow],asset=hasDayPrepAsset(key);
  const mask=asset?`--stream-mask:url(${dayPrepAssets[key].src});`:"";
  return `<i class="sc-pour-stream flow-${flow} ${asset?"has-stream-asset":""}" style="--stream-color:${item.color||"#71351c"};${mask}"></i>`;
}

/* 소스통 하나. 에셋이 있으면 <img>, 없으면 CSS 도형(뚜껑·몸통·라벨)으로 그립니다.
   withOpen 을 주면 뚜껑 연 그림을 한 장 더 겹쳐 둡니다. 평소에는 안 보이다가
   병을 드는 동안(.sc-pourer.pouring)만 바뀝니다 — 미리 깔아 두므로 그 순간
   새로 불러오느라 깜빡이지 않습니다. 왼쪽 재료 카드(mini)는 들 일이 없어 뺍니다. */
function sauceBottleMarkup(recipeId,item,extraClass="",withOpen=false){
  const key=sauceBottleAssetKey(recipeId,item.id);
  const openKey=withOpen?sauceBottleOpenAssetKey(recipeId,item.id):"";
  const open=hasDayPrepAsset(openKey)
    ? `<img class="prep-asset sc-bottle-asset is-open" src="${dayPrepAssets[openKey].src}" alt="" draggable="false" style="${sauceOpenBottleStyle(key,openKey)}" />`
    : "";
  return `<span class="sc-bottle ${item.id} ${SAUCE_BOTTLE_SHAPE[item.id]||"tall"} ${hasDayPrepAsset(key)?"has-asset":""} ${open?"has-open-asset":""} ${extraClass}">
      <i class="sc-cap"></i><i class="sc-body"></i><i class="sc-tag">${item.label}</i>${dayPrepAssetMarkup(key,"sc-bottle-asset",item.label)}${open}
    </span>`;
}

/* 소스통 → 볼 화살표. 에셋이 있으면 <img>, 없으면 CSS 도형(clip-path)입니다.
   한 장을 세 자리가 돌려 씁니다 — 오른쪽 통은 180도, 아래 통은 -90도 회전(CSS). */
function sauceArrowMarkup(slot,dim){
  const has=hasDayPrepAsset("sauceArrow");
  return `<i class="sc-arrow ${slot} ${has?"has-asset":""} ${dim?"off":""}" aria-hidden="true">${dayPrepAssetMarkup("sauceArrow","sc-arrow-asset")}</i>`;
}

// 왼쪽 재료 목표 카드. 고른 소스통은 테두리가 밝아집니다.
// 좌 칸 통일 뒤로는 .sc-ing-panel 안에 들어가는 '안쪽 카드'라 바깥 카드
// 껍데기(.sc-panel)를 쓰지 않습니다. 겉모습은 css/minigame-parts.css 가 줍니다.
function sauceGoalMarkup(recipeId,item,selected,order,turn){
  const status=sauceStatus(item);
  // [그림 | 이름 · 레시피 분량 · 투입 여부] 가로 2열입니다.
  // ⚠️ 세로 2줄(E8 반죽 꼴)로 바꿨다가 되돌렸습니다. 세 줄을 세로로 쌓으면
  //    카드 한 장이 최소 169 를 요구하는데, 떡볶이 양념장은 위에 준비 진행 띠가
  //    붙어 좌 칸이 480 뿐이라 카드 세 장이 각 153 밖에 못 씁니다. 48 이 넘쳤습니다.
  //    가로로 두면 그림(110)과 글자(114)가 나란히 서서 최소 134 면 되고 둘 다 들어갑니다.
  /* 순서가 고정이라 카드에도 몇 번째인지 · 지금 차례인지를 같이 적습니다.
     ⚠️ **한 줄에 들어가는 길이로만 쓰세요.** 줄이 접히면 카드가 한 줄만큼 높아지는데,
        떡볶이 양념장은 위에 준비 진행 띠가 붙어 카드 세 장이 각 153 밖에 못 씁니다
        (위 주석 참고). "차례 기다리는 중" 이 두 줄로 접혀 "대기 중" 으로 줄였습니다. */
  const now=status==="exact"?"✓ 넣기 완료":(turn?"지금 넣을 차례":"대기 중");
  return `<div class="sc-goal ${status} ${selected?"selected":""} ${turn?"turn":""}">
      <span class="sc-goal-art"><b class="sc-goal-order">${order}</b>${sauceBottleMarkup(recipeId,item,"mini")}</span>
      <span class="sc-goal-info">
        <b class="sc-goal-name">${item.label}</b>
        <span class="sc-goal-target">레시피 분량 <b>${item.target}g</b></span>
        <span class="sc-goal-now">${now}</span>
      </span>
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
  // 에셋을 쓸 때는 볼 그림 자체가 소스를 그리므로 위 fill(임시 도형 높이)은 안 쓰입니다.
  const bowlKey=sauceBowlAssetKey(data.recipeId,data.shownStage);
  const turn=sauceTurnIndex(data);   // 지금 넣을 차례 (다 넣었으면 -1)
  const turnItem=turn>=0?data.sauces[turn]:null;
  dom.miniTimer.textContent=`${exact} / ${total}`;   // 공용 타이머 자리는 이 게임에서 숨깁니다

  dom.miniContent.innerHTML=`
    <div class="sauce-lab">
      <aside class="sc-col">
        <div class="sc-panel sc-ing-panel">
          <h3 class="sc-col-title starred">재료 목표</h3>
          <div class="sc-ing-list">${data.sauces.map((item,index)=>sauceGoalMarkup(data.recipeId,item,index===data.cursor,index+1,index===turn)).join("")}</div>
        </div>
      </aside>

      <div class="sc-board ${exact===total?"done mixing":""}" style="--sauce-main:${data.recipe.bowlColor||"#a24a1f"};--sauce-dark:${data.recipe.bowlDark||"#3d1a0e"}">
        <div class="sc-bowl ${hasDayPrepAsset(bowlKey)?"has-asset":""}" style="--sauce-fill:${data.shownFill}%" aria-label="소스볼">
          ${dayPrepAssetMarkup(bowlKey,"sc-bowl-asset","소스볼")}<i class="sc-sauce"></i>
        </div>
        ${data.sauces.map((item,index)=>{
          const slot=SAUCE_SLOTS[index]||"at-bottom",status=sauceStatus(item);
          const selected=index===data.cursor,myTurn=index===turn;
          /* 차례가 아닌 소스통은 **disabled 로 막지 않습니다.** 눌러 봐야 왜 안 되는지
             (어느 것이 먼저인지) 알려 줄 수 있어서입니다 — addYakisobaSauce 가 되돌립니다.
             다 넣은 소스통만 진짜로 막습니다. */
          return `${sauceArrowMarkup(slot,!myTurn)}
            <button type="button" class="sc-pourer ${slot} ${status} ${selected?"selected":""} ${myTurn?"turn":"waiting"}" data-sauce-id="${item.id}" ${locked||status==="exact"?"disabled":""} aria-label="${item.label} ${status==="exact"?"넣기 완료":myTurn?"지금 한 번에 넣기":`${index+1}번째 차례`}">
              <span class="sc-pour-visual">${sauceBottleMarkup(data.recipeId,item,"",true)}${sauceStreamMarkup(item)}</span>
              <span class="sc-step-badge">${status==="exact"?"넣기 완료":myTurn?"한 번 넣기":`${index+1}번째`}</span>
            </button>`;
        }).join("")}
        ${data.finishing?`<strong class="sc-result ${data.completionGrade||"good"} show" id="sauceResult">${data.completionGrade==="perfect"?"PERFECT":"GOOD"}</strong>`:""}
      </div>

      <aside class="sc-col">
        <div class="sc-panel sc-count">
          <h3 class="sc-col-title">진행도</h3>
          <strong>${exact} / ${total}</strong>
        </div>
        <div class="sc-panel sc-control">
          <h3 class="sc-col-title">조작</h3>
          ${sauceControlRow([{action:"left",glyph:"◀",label:"왼쪽 소스통"},{action:"right",glyph:"▶",label:"오른쪽 소스통"}],"좌우로<br />소스통 고르기",locked)}
          ${sauceControlRow([{action:"pour",glyph:"▼",label:"붓기"}],
            sauceStatus(current)==="exact"?`${current.label}<br /><b>넣기 완료</b>`
              :data.cursor===turn?`${current.label}<br /><b>한 번에 넣기</b>`
              :`${turnItem?turnItem.label:""}<br /><b>먼저 넣어주세요</b>`,
            locked||sauceStatus(current)==="exact"||data.cursor!==turn)}
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
  dom.miniContent.querySelectorAll("[data-sauce-key]").forEach(button=>button.addEventListener("click",()=>{
    const action=button.dataset.sauceKey;
    if(action==="left")moveSauceCursor(-1);
    else if(action==="right")moveSauceCursor(1);
    else if(action==="pour")pourSelectedSauce();
  }));
}

/* 병 그림이 **실제로 그려진** 상자. object-fit:contain 이라 상자보다 납작한 통
   (고추장 · 굴소스)은 위아래에, 홀쭉한 통은 좌우에 빈 자리가 생깁니다.
   그 빈 자리까지 병으로 치면 마개 반지름이 부풀어 줄기가 소스면 위에 뜹니다.
   가운데는 상자와 같으므로 크기만 다시 잽니다. */
function sauceBottleArtRect(bottle){
  /* 붓는 동안 실제로 보이는 것은 **뚜껑 연 그림**입니다. 그쪽 상자는
     sauceOpenBottleStyle 이 그림 크기에 딱 맞춰 잡아 두었으므로 그대로 잽니다
     (여백이 없어 다시 계산할 것이 없습니다). */
  const open=bottle.querySelector(".sc-bottle-asset.is-open");
  if(open)return open.getBoundingClientRect();
  const rect=bottle.getBoundingClientRect();
  const image=bottle.querySelector(".sc-bottle-asset");
  const ratio=image&&image.naturalWidth&&image.naturalHeight?image.naturalWidth/image.naturalHeight:0;
  if(!ratio)return rect;   // 에셋이 없으면 임시 도형이 상자를 꽉 채웁니다
  const width=Math.min(rect.width,rect.height*ratio);
  const height=Math.min(rect.height,rect.width/ratio);
  return {left:rect.left+(rect.width-width)/2,top:rect.top+(rect.height-height)/2,width,height};
}

/* 줄기가 소스면에 닿는 순간 소스볼 그림을 다음 장으로 갈아 끼웁니다.
   부을 때 곧바로 바꾸면 병이 아직 날아가는 중인데 볼이 먼저 차 있습니다. */
function advanceSauceBowlStage(m,bowl){
  if(state.mini!==m)return;
  const data=m.data,poured=data.sauces.filter(item=>item.amount===item.target).length;
  if(poured===data.shownStage)return;
  data.shownStage=poured;
  const key=sauceBowlAssetKey(data.recipeId,poured);
  const image=bowl.querySelector(".sc-bowl-asset");
  if(image&&hasDayPrepAsset(key))image.src=dayPrepAssets[key].src;
}

// 소스통이 볼 쪽으로 기울었다가 돌아옵니다. 다시 그린 뒤에 붙여야 살아남습니다.
function playSaucePour(m,id){
  const pourer=dom.miniContent.querySelector(`.sc-pourer[data-sauce-id="${id}"]`);
  if(pourer){
    const visual=pourer.querySelector(".sc-pour-visual");
    const bottle=pourer.querySelector(".sc-bottle");
    const stream=pourer.querySelector(".sc-pour-stream");
    const bowl=dom.miniContent.querySelector(".sc-bowl");
    if(visual&&bottle&&stream&&bowl){
      const visualRect=visual.getBoundingClientRect();
      const bottleRect=sauceBottleArtRect(bottle);
      const bowlRect=bowl.getBoundingClientRect();
      const fromRight=pourer.classList.contains("at-right");
      const fromBottom=pourer.classList.contains("at-bottom");
      const tilt=fromRight?-96:(fromBottom?108:96);
      const radians=tilt*Math.PI/180;
      const capRadius=bottleRect.height*.45;
      const surfaceX=bowlRect.left+bowlRect.width*.5;
      /* 줄기가 닿을 소스면. 볼 상자 위에서 30% 되는 높이입니다.
         ⚠️ 원래 14% 였습니다 — 임시 CSS 볼은 상자를 꽉 채운 그릇이라 그 언저리가
            테두리였는데, 납품 그림은 위쪽이 그릇 안쪽(빈 공간)이라 줄기가 **허공에서
            끊겼습니다.** 게다가 병이 그만큼 더 위로 날아가 조리대 액자를 뚫었습니다
            (14% 로 잡으면 왼쪽 병 윗변이 6 근처까지 올라가는데 홈선이 46 입니다).
            30% 는 그림 속 소스면 언저리라 줄기가 소스에 닿아 보이고, 병도 홈선 안에
            들어옵니다. 볼 그림을 바꾸면 이 값도 같이 봐야 합니다. */
      const surfaceY=bowlRect.top+bowlRect.height*.30;
      const streamHeight=Math.max(34,Math.min(68,bowlRect.height*(stream.classList.contains("flow-thick")?.16:.22)));
      const mouthY=surfaceY-streamHeight;
      const capDx=Math.sin(radians)*capRadius;
      const capDy=-Math.cos(radians)*capRadius;
      const desiredCenterX=surfaceX-capDx;
      const desiredCenterY=mouthY-capDy;
      const flyX=desiredCenterX-(bottleRect.left+bottleRect.width*.5);
      const flyY=desiredCenterY-(bottleRect.top+bottleRect.height*.5);
      const streamWidth=stream.getBoundingClientRect().width||10;
      visual.style.setProperty("--fly-x",`${flyX}px`);
      visual.style.setProperty("--fly-y",`${flyY}px`);
      visual.style.setProperty("--pour-tilt",`${tilt}deg`);
      visual.style.setProperty("--stream-left",`${surfaceX-(visualRect.left+flyX)-streamWidth*.5}px`);
      visual.style.setProperty("--stream-top",`${mouthY-(visualRect.top+flyY)}px`);
      visual.style.setProperty("--stream-height",`${streamHeight}px`);
    }
    pourer.classList.remove("pouring");void pourer.offsetWidth;pourer.classList.add("pouring");
    setTimeout(()=>pourer.classList.remove("pouring"),SAUCE_POUR_DURATION);
  }
  const bowl=dom.miniContent.querySelector(".sc-bowl");
  if(bowl){
    setTimeout(()=>{
      if(!bowl.isConnected)return;
      advanceSauceBowlStage(m,bowl);
      bowl.classList.remove("splash");void bowl.offsetWidth;bowl.classList.add("splash");
      setTimeout(()=>bowl.classList.remove("splash"),300);
    },230);
  }
}

function finishSaucePour(m){
  if(state.mini!==m||m.complete||m.data.finishing||!m.data.pourLocked)return;
  if(Number.isInteger(m.data.pendingCursor))m.data.cursor=m.data.pendingCursor;
  m.data.pendingCursor=null;
  m.data.pourLocked=false;
  checkYakisobaSauceComplete(m);
}

/* ---- 조작 -------------------------------------------------- */

// 지금 조작을 받을 수 있는 상태인지. 아니면 null.
function activeSauceMeasure(){
  const m=state.mini;
  if(!isDayPrepMini(m)||m.complete||m.data.mode!=="sauceMeasure"||m.data.finishing||m.data.pourLocked)return null;
  return m;
}

// 소스통 고르기. 조리대 · 왼쪽 목표 카드 · 조작 카드 표시가 함께 움직입니다.
function selectSauce(index){
  const m=activeSauceMeasure();if(!m)return;
  const sauce=m.data.sauces[index];if(!sauce||index===m.data.cursor)return;
  m.data.cursor=index;audio.uiClick();
  renderYakisobaSauce();
  dom.miniFeedback.textContent=`${sauce.label} 소스통 선택 · 한 번에 넣어주세요`;
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

function addYakisobaSauce(id){
  const m=activeSauceMeasure();if(!m)return;
  const index=m.data.sauces.findIndex(item=>item.id===id);if(index<0)return;
  const sauce=m.data.sauces[index];
  m.data.cursor=index;   // 조리대에서 직접 누른 소스통이 곧 지금 고른 소스통입니다
  if(sauce.amount===sauce.target){dom.miniFeedback.textContent=`${sauce.label}은(는) 이미 넣었습니다. 다른 재료를 골라주세요.`;return;}
  /* 순서가 고정입니다. 차례가 아니면 넣지 않고 어느 것이 먼저인지 알려 줍니다.
     막아 두는 대신 눌리게 두는 이유는 여기서 이유를 말해 주기 위해서입니다. */
  const turn=sauceTurnIndex(m.data);
  if(index!==turn){
    const first=m.data.sauces[turn];
    audio.bad();
    dom.miniFeedback.textContent=`아직 ${sauce.label} 차례가 아닙니다. ${first.label}을(를) 먼저 넣어주세요!`;
    renderYakisobaSauce();
    const pourer=dom.miniContent.querySelector(`.sc-pourer[data-sauce-id="${id}"]`);
    if(pourer){pourer.classList.add("wrong");setTimeout(()=>pourer.classList.remove("wrong"),400);}
    return;
  }
  sauce.amount=sauce.target;m.data.pourLocked=true;m.data.pendingCursor=nextIncompleteSauceIndex(m.data,index);
  audio.play?.(`pour_${sauce.flow||"thin"}`,{owner:m});dom.miniFeedback.textContent=`${sauce.label}을(를) 한 번에 넣는 중입니다!`;
  renderYakisobaSauce();
  playSaucePour(m,id);
  setTimeout(()=>finishSaucePour(m),SAUCE_POUR_DURATION);
}

function checkYakisobaSauceComplete(m){
  const complete=m.data.sauces.every(item=>item.amount===item.target);
  if(complete){m.data.finishing=true;m.data.pourLocked=true;m.data.completionGrade=sauceCompletionGrade(m.data);}
  renderYakisobaSauce();
  if(complete){
    dom.miniFeedback.textContent="레시피와 정확히 일치합니다!";
    setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(m.data.recipe.taskId,m.data.recipe.completionMessage);},720);
  }
  return complete;
}
