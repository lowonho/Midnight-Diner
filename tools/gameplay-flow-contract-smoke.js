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
const title=read("title.js");
const gameData=read("game-data.js");

assert(game.includes("if(state.mini&&!settingsOpen){updateMini(dt);updateUI(false);}"),
  "설정창이 열린 동안 미니게임 갱신을 멈춰야 합니다.");
assert(ingredient.includes("if(state.paused)return;"),
  "설정 중에는 냉장고 경과 기록도 멈춰야 합니다.");

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

assert(dayPrep.includes("현재 작업은 초기화되어 다음에 처음부터 다시 해야 합니다."),
  "준비 미니게임 닫기 안내는 이어하기가 아닌 초기화를 알려야 합니다.");

const dayRules=[...gameData.matchAll(/\b\d:\{day:\d,requiredMenus:\[\],optionalMenus:\[\.\.\.ALL_MENU_IDS\],minSelectedMenus:(\d),maxSelectedMenus:(\d)/g)];
assert(dayRules.length===7&&dayRules.every(match=>match[1]==="5"&&match[2]==="5"),
  "요청에 따라 현재 일차별 조리 메뉴 수는 다섯 개로 유지해야 합니다.");

console.log("GAMEPLAY_FLOW_CONTRACT_OK pause · prep quality · fridge menu · story priority");
