"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const gameDataSource=read("game-data.js");
const sandbox={};
vm.runInNewContext(`${gameDataSource}\n;globalThis.__prepContract={PREP_TASKS,MENU_DATA,DAY_DATA};`,sandbox,{filename:"game-data.js"});
const {PREP_TASKS,MENU_DATA,DAY_DATA}=sandbox.__prepContract;

assert(MENU_DATA.every(menu=>menu.unlockDay===1),"모든 메뉴가 Day 1부터 열려야 합니다.");
assert(Object.values(PREP_TASKS).every(task=>!("minDay" in task)),"준비 작업에 minDay 제한이 남아 있습니다.");
const allMenuIds=MENU_DATA.map(menu=>menu.id).sort();
Object.values(DAY_DATA).forEach(day=>{
  const available=[...day.requiredMenus,...day.optionalMenus].sort();
  assert(JSON.stringify(available)===JSON.stringify(allMenuIds),`Day ${day.day}에서 모든 메뉴를 선택할 수 있어야 합니다.`);
});

const prepFiles=[
  "day-prep-minigames.js",
  ...fs.readdirSync(root).filter(file=>/^engine-e\d+-.*\.js$/.test(file))
];
const prepSource=prepFiles.map(file=>`// ${file}\n${read(file)}`).join("\n");

assert(!/state\.day/.test(prepSource),"준비 미니게임 엔진에 날짜 의존 코드가 남아 있습니다.");
assert(!/task\.minDay/.test(prepSource),"준비 미니게임 진입부에 minDay 제한이 남아 있습니다.");

const setupKeys=new Set([...prepSource.matchAll(/registerDayPrepSetup\(\s*"([^"]+)"/g)].map(match=>match[1]));
const missing=Object.values(PREP_TASKS).filter(task=>task.isImplemented&&!setupKeys.has(task.miniGame));
assert(!missing.length,`시작 함수가 없는 준비 작업: ${missing.map(task=>task.id).join(", ")}`);

console.log(`PREP_ALL_DAYS_CONTRACT_OK ${Object.keys(PREP_TASKS).length} tasks / ${setupKeys.size} setups`);
