"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

let now=0;
let nextHandle=1;
const nativeTimers=new Map();
const setTimeoutFake=(callback,delay=0)=>{
  const handle=nextHandle++;
  nativeTimers.set(handle,{callback,due:now+Math.max(0,Number(delay)||0)});
  return handle;
};
const clearTimeoutFake=handle=>nativeTimers.delete(handle);
function advance(ms){
  const target=now+ms;
  while(true){
    const ready=[...nativeTimers.entries()]
      .filter(([,timer])=>timer.due<=target)
      .sort((a,b)=>a[1].due-b[1].due||a[0]-b[0])[0];
    if(!ready)break;
    const [handle,timer]=ready;
    nativeTimers.delete(handle);
    now=timer.due;
    timer.callback();
  }
  now=target;
}

const sandbox={
  console,
  performance:{now:()=>now},
  setTimeout:setTimeoutFake,
  clearTimeout:clearTimeoutFake,
  state:{mini:{engine:"test"}},
  clamp:(value,min,max)=>Math.max(min,Math.min(max,value))
};
sandbox.globalThis=sandbox;
const context=vm.createContext(sandbox);
vm.runInContext(read("mini-engine.js"),context,{filename:"mini-engine.js"});

vm.runInContext(`
  globalThis.pauseEvents=[];
  globalThis.first=miniSetTimeout(()=>pauseEvents.push("first"),1000);
`,context);
advance(400);
vm.runInContext("pauseMiniAsyncTasks()",context);
advance(5000);
assert(vm.runInContext("pauseEvents.length",context)===0,
  "설정창이 열린 동안 기존 미니게임 타이머가 실행되면 안 됩니다.");

vm.runInContext(`
  globalThis.second=miniSetTimeout(()=>pauseEvents.push("second"),250);
`,context);
assert(nativeTimers.size===0,"설정 중 새로 예약된 작업은 즉시 흐르지 않아야 합니다.");
vm.runInContext("resumeMiniAsyncTasks()",context);
advance(249);
assert(vm.runInContext("pauseEvents.length",context)===0,
  "복귀 후에는 설정 전·설정 중 작업 모두 남은 시간을 보존해야 합니다.");
advance(1);
assert(vm.runInContext("pauseEvents.join(',')",context)==="second",
  "설정 중 예약된 작업은 복귀 뒤 자기 지연시간을 채우고 실행되어야 합니다.");
advance(350);
assert(vm.runInContext("pauseEvents.join(',')",context)==="second,first",
  "설정 전에 시작한 작업은 복귀 뒤 남은 시간만큼 이어져야 합니다.");

vm.runInContext(`
  globalThis.ticks=0;
  globalThis.repeater=miniSetInterval(()=>{ticks+=1;},100);
`,context);
advance(40);
vm.runInContext("pauseMiniAsyncTasks()",context);
advance(1000);
assert(vm.runInContext("ticks",context)===0,"설정 중 반복 작업도 멈춰야 합니다.");
vm.runInContext("resumeMiniAsyncTasks()",context);
advance(60);
assert(vm.runInContext("ticks",context)===1,"반복 작업은 복귀 뒤 남은 간격부터 이어져야 합니다.");
vm.runInContext("miniClearInterval(repeater)",context);
advance(500);
assert(vm.runInContext("ticks",context)===1,"해제한 반복 작업은 다시 실행되면 안 됩니다.");

const asyncFiles=[
  "day-prep-minigames.js","ingredient-select.js","engine-e1-timing-cut.js",
  "engine-e2-alternate-input.js","engine-e3-direction-seq.js","engine-e4-gauge-hold.js",
  "engine-e5-two-side-cook.js","engine-e6-deep-fry.js","engine-e7-measure.js",
  "engine-e8-order-place.js","engine-e9-whisk.js","engine-e10-target-click.js",
  "engine-e11-one-shot.js","engine-e12-grab-shake.js","engine-e13-fridge-find.js",
  "engine-legacy-night.js"
];
asyncFiles.forEach(file=>{
  const source=read(file);
  assert(!/(^|[^\w])setTimeout\s*\(/m.test(source),`${file}에 pause-aware가 아닌 setTimeout이 남아 있습니다.`);
  assert(!/(^|[^\w])setInterval\s*\(/m.test(source),`${file}에 pause-aware가 아닌 setInterval이 남아 있습니다.`);
  assert(!/(^|[^\w])clearTimeout\s*\(/m.test(source),`${file}에 기본 clearTimeout이 남아 있습니다.`);
  assert(!/(^|[^\w])clearInterval\s*\(/m.test(source),`${file}에 기본 clearInterval이 남아 있습니다.`);
});

const game=read("game.js"),css=read("css/minigame-frame.css");
assert(game.includes("pauseMiniAsyncTasks();")&&game.includes("resumeMiniAsyncTasks();"),
  "설정 열기·닫기에 공용 미니게임 타이머 pause/resume이 연결되어야 합니다.");
assert(css.includes("body:has(#settingsOverlay.open) .mini-overlay *")
  &&css.includes("animation-play-state: paused !important;"),
  "설정 중에는 미니게임 CSS 애니메이션도 멈춰야 합니다.");

console.log("MINIGAME_SETTINGS_PAUSE_CONTRACT_OK timeout · interval · new-during-pause · css animations");
