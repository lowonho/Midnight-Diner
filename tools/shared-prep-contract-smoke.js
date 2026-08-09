"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const context=vm.createContext({console});

vm.runInContext(read("js/game-data.js"),context,{filename:"js/game-data.js"});
vm.runInContext(`${read("js/day.js")}
globalThis.__sharedPrep={PREP_TASKS,MENU_DATA,prepTaskCompleted,prepTaskScore,prepTaskProgress,prepComplete,nextPrepTask,renderPrepChecklist,completeDayPrepTask};`,context,{filename:"js/day.js"});
vm.runInContext(`${read("js/prep.js")}
globalThis.__prepDishGroups=prepDishGroups;`,context,{filename:"js/prep.js"});

const {
  PREP_TASKS,MENU_DATA,prepTaskCompleted,prepTaskScore,prepTaskProgress,
  prepComplete,nextPrepTask,renderPrepChecklist,completeDayPrepTask
}=context.__sharedPrep;
const sameKey=(...ids)=>ids.every(id=>PREP_TASKS[id].sharedPrepKey===PREP_TASKS[ids[0]].sharedPrepKey);

assert(sameKey("cutTofuKimchi","cutPancakeKimchi"),"두부김치와 김치전의 김치 썰기는 공용이어야 합니다.");
assert(PREP_TASKS.cutTofuKimchi.showSharedPrepPerMenu===true
  &&PREP_TASKS.cutPancakeKimchi.showSharedPrepPerMenu===true,
  "공용 김치 썰기의 완료는 공유하되 두 메뉴 준비물은 처음부터 따로 표시해야 합니다.");
assert(sameKey("cutFishCake","cutTteokbokkiFishCake"),"어묵탕과 떡볶이의 어묵 썰기는 공용이어야 합니다.");
assert(sameKey("cutSkewerGreenOnion","cutTteokbokkiGreenOnion"),"닭꼬치와 떡볶이의 대파 썰기는 공용이어야 합니다.");
assert(!PREP_TASKS.sliceYakisobaCabbage.sharedPrepKey&&!PREP_TASKS.cutTteokbokkiCabbage.sharedPrepKey,
  "채썰기와 떡볶이용 썰기는 모양이 다르므로 양배추를 공용 처리하면 안 됩니다.");

context.state={prepProgress:{},prepTaskScores:{}};
assert(!prepTaskCompleted("cutPancakeKimchi"),"아직 하지 않은 공용 작업이 완료로 판정되면 안 됩니다.");
context.state.prepProgress.cutTofuKimchi=true;
context.state.prepTaskScores.cutTofuKimchi=87;
assert(prepTaskCompleted("cutPancakeKimchi"),"김치를 한 번 썰면 김치전 쪽도 완료되어야 합니다.");
assert(prepTaskScore("cutPancakeKimchi")===87,"공용 김치 작업의 점수가 두 메뉴에 동일하게 반영되어야 합니다.");

context.state.prepProgress.cutFishCake=true;
context.state.prepTaskScores.cutFishCake=92;
assert(prepTaskCompleted("cutTteokbokkiFishCake"),"어묵을 한 번 썰면 떡볶이 쪽도 완료되어야 합니다.");
assert(prepTaskScore("cutTteokbokkiFishCake")===92,"공용 어묵 작업의 점수가 두 메뉴에 동일하게 반영되어야 합니다.");

context.state.prepProgress.cutSkewerGreenOnion=true;
assert(prepTaskCompleted("cutTteokbokkiGreenOnion"),"대파를 한 번 썰면 떡볶이 쪽도 완료되어야 합니다.");
context.state.prepProgress.sliceYakisobaCabbage=true;
assert(!prepTaskCompleted("cutTteokbokkiCabbage"),"볶음우동용 채썬 양배추가 떡볶이용 양배추까지 완료하면 안 됩니다.");

const dishes=MENU_DATA.map(menu=>({...menu,name:menu.displayName,prepTasks:menu.requiredPrepTasks}));
context.dishById=id=>dishes.find(dish=>dish.id===id)||null;
context.updateUI=()=>{};
context.saveGame=()=>{};
context.showToast=()=>{};
context.state={
  day:1,
  selectedMenus:["tofu","kimchi"],
  prepProgress:Object.fromEntries(Object.keys(PREP_TASKS).map(id=>[id,false])),
  prepTaskScores:{},
  inventory:{tofu:{count:0,quality:0,prepared:false},kimchi:{count:0,quality:0,prepared:false}},
  mini:null
};
let visiblePrepGroups=context.__prepDishGroups();
assert(visiblePrepGroups.map(group=>group.dish.id).join(",")==="tofu,kimchi"
  &&visiblePrepGroups.map(group=>group.task.id).join(",")==="cutTofuKimchi,cutPancakeKimchi",
  "공용 김치 썰기를 시작하기 전에도 두부김치와 김치전 준비물이 각각 보여야 합니다.");
completeDayPrepTask("cutTofuKimchi",87);
assert(prepTaskCompleted("cutPancakeKimchi"),"실제 김치 완료 처리도 두 메뉴에 공유되어야 합니다.");
visiblePrepGroups=context.__prepDishGroups();
assert(visiblePrepGroups.map(group=>group.dish.id).join(",")==="tofu,kimchi"
  &&visiblePrepGroups.map(group=>group.task.id).join(",")==="fryTofuKimchi,mixKimchiBatter",
  "공용 김치 썰기 뒤에도 두 메뉴 준비물이 함께 남아 각자의 다음 작업을 보여야 합니다.");
completeDayPrepTask("fryTofuKimchi",91);
completeDayPrepTask("mixKimchiBatter",93);
assert(context.state.inventory.tofu.prepared&&context.state.inventory.tofu.quality===89,
  "두부김치 품질에는 공용 김치 점수가 포함되어야 합니다.");
assert(context.state.inventory.kimchi.prepared&&context.state.inventory.kimchi.quality===90,
  "김치전 품질에도 같은 공용 김치 점수가 포함되어야 합니다.");

// 실제 제보 조합: 김치전 + 두부김치 + 감자튀김.
// 김치 썰기 한 번이 두 메뉴의 요구 작업 두 칸을 충족하므로 실제 실행은
// 다섯 번이지만 체크리스트의 논리적 요구 작업은 여섯 칸입니다. 표시와
// 영업 시작 판정 모두 prepTaskCompleted()의 같은 의미를 사용해야 합니다.
context.dom={inventoryList:{dataset:{},innerHTML:""}};
context.state={
  day:1,
  selectedMenus:["kimchi","tofu","fries"],
  prepProgress:Object.fromEntries(Object.keys(PREP_TASKS).map(id=>[id,false])),
  prepTaskScores:{},
  inventory:{
    kimchi:{count:0,quality:0,prepared:false},
    tofu:{count:0,quality:0,prepared:false},
    fries:{count:0,quality:0,prepared:false}
  },
  mini:null
};
completeDayPrepTask("cutPancakeKimchi",88);
completeDayPrepTask("fryTofuKimchi",90);
completeDayPrepTask("mixKimchiBatter",92);
completeDayPrepTask("sliceFriesPotato",94);

let progress=prepTaskProgress();
assert(progress.doneCount===5&&progress.totalCount===6&&!progress.complete,
  "감자 전분 털기가 남은 5/6 상태는 준비 미완료여야 합니다.");
assert(!prepComplete(),"체크리스트가 5/6이면 영업 시작 판정이 열리면 안 됩니다.");
assert(nextPrepTask()?.id==="shakeFriesStarch",
  "공용 김치 썰기를 다시 요구하지 말고 남은 감자 전분 털기를 안내해야 합니다.");
renderPrepChecklist();
assert(context.dom.inventoryList.innerHTML.includes("준비 완료 5 / 6"),
  "실제 남은 작업이 하나일 때 체크리스트에 준비 완료 5 / 6을 표시해야 합니다.");

completeDayPrepTask("shakeFriesStarch",96);
progress=prepTaskProgress();
assert(progress.doneCount===6&&progress.totalCount===6&&progress.complete&&prepComplete(),
  "모든 요구 작업이 끝나면 카운트와 영업 시작 판정이 함께 완료되어야 합니다.");
renderPrepChecklist();
assert(context.dom.inventoryList.innerHTML.includes("준비 완료 6 / 6"),
  "공용 김치 썰기를 양쪽 메뉴에 반영해 최종 카운트를 6 / 6으로 표시해야 합니다.");

console.log("SHARED_PREP_CONTRACT_OK kimchi / fish cake / green onion / 5-of-6 gate");
