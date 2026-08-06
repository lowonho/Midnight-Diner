"use strict";

const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const game=read("game.js");
const day=read("day.js");
const dayPrep=read("day-prep-minigames.js");
const ingredient=read("ingredient-select.js");
const kitchen=read("kitchen.js");
const player=read("player.js");
const night=read("night.js");
const story=read("story.js");
const title=read("title.js");
const gameData=read("game-data.js");
const miniFrame=read("ui-mini-frame.js");
const miniFrameCss=read("css/minigame-frame.css");
const index=read("index.html");

assert(game.includes("if(state.mini&&!settingsOpen){updateMini(dt);updateUI(false);}"),
  "설정창이 열린 동안 미니게임 갱신을 멈춰야 합니다.");
assert(ingredient.includes("if(state.paused)return;"),
  "설정 중에는 냉장고 경과 기록도 멈춰야 합니다.");
assert(miniFrame.includes('id="miniPause"')
  &&miniFrameCss.includes("#miniPause { display: grid; }")
  &&miniFrameCss.includes("#miniClose:not([hidden]) + #miniPause"),
  "닫을 수 있는 낮 준비 미니게임을 포함해 공용 미니게임에는 항상 설정 버튼이 보여야 합니다.");
assert(index.includes('id="ingredientPause"')
  &&game.includes('"ingredientPause"')
  &&game.includes('dom.ingredientPause.addEventListener("click",()=>openSettings("game"));'),
  "냉장고 재료 찾기 미니게임에서도 설정창을 열 수 있어야 합니다.");
assert(index.includes('id="ingredientSelectOverlay" class="overlay mini-overlay ingredient-select-overlay"')
  &&index.includes('id="ingredientPause" class="mini-icon-button mini-pause"')
  &&miniFrameCss.includes(".mini-icon-button {")
  &&miniFrameCss.includes(".mini-pause { background-image: var(--ui-pause); }"),
  "독립 냉장고 오버레이에서도 설정 버튼의 공용 위치와 그림 스타일이 적용되어야 합니다.");
assert(game.includes("||state.phase===GAME_PHASES.INGREDIENT_SELECT;")
  &&game.includes('if(from==="game"&&!saveBlocked)saveGame(true);')
  &&game.indexOf("const saveBlocked=")<game.indexOf('if(from==="game"&&!saveBlocked)saveGame(true);')
  &&title.includes("state.mini||state.story?.activeStoryCook||state.phase===GAME_PHASES.INGREDIENT_SELECT"),
  "냉장고 미니게임 중에는 완료 지연 상태를 저장하거나 타이틀로 이동할 수 없어야 합니다.");
assert(game.includes('if(k==="escape")')
  &&game.includes('else if(state.screen==="game")openSettings("game");')
  &&game.includes("if(settingsOverlayIsOpen())return;"),
  "모든 미니게임에서 ESC로 설정을 열고 설정 뒤쪽 입력은 차단해야 합니다.");

assert(game.includes("prepTaskScores:{}")
  &&day.includes("state.prepTaskScores[taskId]")
  &&day.includes("const quality=Math.round(taskScores.reduce"),
  "낮 준비 작업 점수를 메뉴 품질 평균으로 저장해야 합니다.");
assert(night.includes("const serviceScore=satisfaction;")
  &&night.includes("const expected=satisfactionScore(inv,state.carrying.cookScore);"),
  "낮 준비 품질은 일반·이야기 손님의 저녁 평가에 모두 반영되어야 합니다.");

assert(day.includes("function openMenuSelectionAtFridge()")
  &&game.includes('if(state.phase===GAME_PHASES.MENU_SELECT)return "fridge";')
  &&game.includes("openMenuSelectionAtFridge();")
  &&player.includes('["menuSelect","day","night"]')
  &&kitchen.includes('if(state.phase==="menuSelect")return s.id==="fridge";'),
  "메뉴 선택 단계에는 냉장고까지 이동해 E로 상호작용할 수 있어야 합니다.");
assert(title.includes('dom.menuSelectOverlay.classList.remove("open");'),
  "메뉴 선택 저장을 불러와도 선택창을 자동으로 띄우면 안 됩니다.");

assert(night.includes('if(order.customerType==="story"&&isCookableOrder(order))state.selectedOrderId=order.id;')
  &&night.includes("const priorityStoryOrder=state.orders.find"),
  "조리 가능한 특별 손님은 일반 주문보다 우선 선택·처리되어야 합니다.");
assert(story.includes('prompt:"어떤 음식을 내줄까?"')
  &&story.includes("order.dishId=chosenDish.id;")
  &&story.includes("order.awaitingDishChoice=false;")
  &&story.includes("scene?.wrongDishSceneId||scene?.missingMenuSceneId"),
  "특별 손님은 준비 메뉴 선택 뒤 그 음식으로 기존 조리를 진행하고 오답은 단서 장면으로 보내야 합니다.");
assert(night.includes("const mismatchedStoryDish=storyResult?.matched===false;")
  &&night.includes("if(!mismatchedStoryDish)spawnPopup"),
  "잘못 고른 특별 손님 음식은 점수 평가 팝업으로 오인되지 않아야 합니다.");

assert(dayPrep.includes("현재 작업은 초기화되어 다음에 처음부터 다시 해야 합니다."),
  "준비 미니게임 닫기 안내는 이어하기가 아닌 초기화를 알려야 합니다.");

const dayRules=[...gameData.matchAll(/\b\d:\{day:\d,requiredMenus:\[\],optionalMenus:\[\.\.\.ALL_MENU_IDS\],minSelectedMenus:(\d),maxSelectedMenus:(\d)/g)];
assert(dayRules.length===7&&dayRules.every(match=>match[1]==="5"&&match[2]==="5"),
  "요청에 따라 현재 일차별 조리 메뉴 수는 다섯 개로 유지해야 합니다.");

console.log("GAMEPLAY_FLOW_CONTRACT_OK pause · prep quality · fridge menu · story priority");
