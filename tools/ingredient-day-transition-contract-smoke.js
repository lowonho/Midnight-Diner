"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

let removedCompletionBanners=0;
const staleCompletionBanner={remove(){removedCompletionBanners+=1;}};
const cabinet={querySelector:selector=>selector===".fridge-clear"?staleCompletionBanner:null};
const classList={add(){},remove(){}};
const sandbox={
  document:{currentScript:{src:"file:///ingredient-select.js"},baseURI:"file:///"},
  URL,
  console,
  setInterval:()=>1,
  clearInterval:()=>{},
  setTimeout:()=>1,
  clearTimeout:()=>{},
  miniSetInterval:()=>({type:"interval"}),
  miniClearInterval:()=>{},
  miniSetTimeout:()=>({type:"timeout"}),
  miniClearTimeout:()=>{},
  shuffle:items=>[...items],
  GAME_PHASES:{MENU_SELECT:"menuSelect",INGREDIENT_SELECT:"ingredientSelect",PREP:"day"},
  state:{
    day:2,
    phase:"menuSelect",
    paused:false,
    selectedMenus:["tofu","kimchi","skewer","yakisoba","shrimpTempura"],
    // 1일차에서 완료된 진행 상태가 남아 있는 상황을 재현합니다.
    ingredientSelection:{required:["tofu"],found:["tofu"],slots:Array(24).fill(null)}
  },
  dom:{
    ingredientGrid:{closest:selector=>selector===".fridge-cabinet"?cabinet:null},
    menuSelectOverlay:{classList},
    ingredientSelectOverlay:{classList,dataset:{}},
    ingredientSelectFeedback:{textContent:""}
  },
  showToast:()=>{},
  updateUI:()=>{},
  saveGame:()=>{}
};
sandbox.globalThis=sandbox;

const context=vm.createContext(sandbox);
vm.runInContext(read("js/engine-e13-fridge-find.js"),context,{filename:"js/engine-e13-fridge-find.js"});
vm.runInContext(read("js/ingredient-select.js"),context,{filename:"js/ingredient-select.js"});
// 이 검사는 냉장고 새 판의 상태와 완료 배너 수명만 확인합니다. 화면 렌더링과 냉기
// 애니메이션은 별도 시각 QA의 책임이므로 부수 효과를 막습니다.
vm.runInContext("startFridgeColdAir=()=>{}; renderIngredientSelection=()=>{};",context);

const started=vm.runInContext("startIngredientSelection()",context);
const result=vm.runInContext("({phase:state.phase,progress:state.ingredientSelection})",context);

assert(started===true,"2일차 냉장고 재료 선택이 시작되지 않았습니다.");
assert(removedCompletionBanners===1,"전날의 '재료 준비 완료' 배너가 새 냉장고 판에서 제거되지 않았습니다.");
assert(result.phase==="ingredientSelect","새 날짜의 냉장고 단계로 전환되지 않았습니다.");
assert(result.progress.engine==="E13"&&result.progress.found.length===0,
  "전날 완료 상태를 이어받지 않고 새 재료 선택 상태로 초기화해야 합니다.");
assert(result.progress.required.length>0,"2일차에 선택할 냉장고 재료가 생성되지 않았습니다.");

console.log("INGREDIENT_DAY_TRANSITION_CONTRACT_OK stale completion banner removed · progress reset");
