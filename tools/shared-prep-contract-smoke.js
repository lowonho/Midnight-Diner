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
globalThis.__sharedPrep={PREP_TASKS,MENU_DATA,prepTaskCompleted,prepTaskScore,completeDayPrepTask};`,context,{filename:"js/day.js"});

const {PREP_TASKS,MENU_DATA,prepTaskCompleted,prepTaskScore,completeDayPrepTask}=context.__sharedPrep;
const sameKey=(...ids)=>ids.every(id=>PREP_TASKS[id].sharedPrepKey===PREP_TASKS[ids[0]].sharedPrepKey);

assert(sameKey("cutTofuKimchi","cutPancakeKimchi"),"두부김치와 김치전의 김치 썰기는 공용이어야 합니다.");
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
completeDayPrepTask("cutTofuKimchi",87);
assert(prepTaskCompleted("cutPancakeKimchi"),"실제 김치 완료 처리도 두 메뉴에 공유되어야 합니다.");
completeDayPrepTask("fryTofuKimchi",91);
completeDayPrepTask("mixKimchiBatter",93);
assert(context.state.inventory.tofu.prepared&&context.state.inventory.tofu.quality===89,
  "두부김치 품질에는 공용 김치 점수가 포함되어야 합니다.");
assert(context.state.inventory.kimchi.prepared&&context.state.inventory.kimchi.quality===90,
  "김치전 품질에도 같은 공용 김치 점수가 포함되어야 합니다.");

console.log("SHARED_PREP_CONTRACT_OK kimchi / fish cake / green onion");
