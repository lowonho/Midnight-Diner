"use strict";

// 브라우저 저장소와 게임 상태 직렬화/복원을 전담합니다.
const SAVE_KEY="midnightDiner.save.v1";
const SAVE_VERSION=1;
let autosaveElapsed=0;
let saveSystemInitialized=false;

function initializeSaveSystem(){
  if(saveSystemInitialized)return;
  saveSystemInitialized=true;
  window.addEventListener("pagehide",()=>saveGame());
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden")saveGame();
  });
}

function readSaveData(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;
    const data=JSON.parse(raw);
    const validInventory=data.state?.inventory&&typeof data.state.inventory==="object";
    if(data.version!==SAVE_VERSION||!data.state||!["day","night","result"].includes(data.state.phase)||!Number.isFinite(data.state.day)||!validInventory){
      throw new Error("지원하지 않는 저장 데이터");
    }
    return data;
  }catch(error){
    console.warn("저장 데이터를 읽지 못했습니다.",error);
    try{localStorage.removeItem(SAVE_KEY);}catch(_error){}
    return null;
  }
}

function saveGame(){
  if(state.screen!=="game"||!["day","night","result"].includes(state.phase)||state.mini)return false;
  try{
    const snapshot=JSON.parse(JSON.stringify(state));
    snapshot.screen="game";snapshot.settingsFrom="game";snapshot.paused=snapshot.phase==="result";
    snapshot.mini=null;snapshot.particles=[];snapshot.popups=[];snapshot.joyX=0;snapshot.joyY=0;snapshot.player.moving=false;
    localStorage.setItem(SAVE_KEY,JSON.stringify({version:SAVE_VERSION,savedAt:Date.now(),nextOrderId,state:snapshot}));
    autosaveElapsed=0;
    return true;
  }catch(error){console.warn("게임을 저장하지 못했습니다.",error);return false;}
}

function clearSaveData(){
  try{localStorage.removeItem(SAVE_KEY);}catch(error){console.warn("저장 데이터를 삭제하지 못했습니다.",error);}
  autosaveElapsed=0;
}

function restoreGameState(data){
  const saved=data.state;
  const savedAudio={...state.audio,...(saved.audio||{})};
  Object.assign(state,saved);

  const numericDefaults={
    day:1,money:0,popularity:0,popularityBeforeResult:0,popularityDelta:0,
    dailyRevenue:0,wasteLoss:0,leftoverCount:0,nightCustomerTarget:0,
    spawnedCustomers:0,served:0,satisfactionTotal:0,fiveStar:0,
    cleanliness:100,dirtyDishes:0,trash:0
  };
  Object.entries(numericDefaults).forEach(([key,fallback])=>{
    if(!Number.isFinite(state[key]))state[key]=fallback;
  });

  state.audio=savedAudio;
  state.inventory=Object.fromEntries(DISHES.map(dish=>[
    dish.id,{count:0,quality:0,...(saved.inventory?.[dish.id]||{})}
  ]));
  state.orders=Array.isArray(saved.orders)?saved.orders:[];
  state.respawns=Array.isArray(saved.respawns)?saved.respawns:[];
  state.player={x:620,y:430,facing:"down",moving:false,speed:205,...(saved.player||{}),moving:false};
  state.screen="game";state.settingsFrom="game";state.paused=state.phase==="result";
  state.mini=null;state.particles=[];state.popups=[];state.joyX=0;state.joyY=0;
  if(state.phase==="day")state.phaseTime=null;
  else if(!Number.isFinite(state.phaseTime))state.phaseTime=0;
  nextOrderId=Math.max(Number(data.nextOrderId)||1,...state.orders.map(order=>(Number(order.id)||0)+1));
  autosaveElapsed=0;
}

function updateAutosave(dt){
  if(state.mini)return;
  autosaveElapsed+=dt;
  if(autosaveElapsed>=5){autosaveElapsed=0;saveGame();}
}
