"use strict";

// 자동 저장 1칸과 수동 저장 3칸의 선택 화면을 전담합니다.
let saveSlotUiInitialized=false;
let saveSlotDialogMode="load";
let saveSlotDialogOrigin="title";
let saveSlotReturnFocus=null;

function saveSlotElements(){
  return {
    overlay:document.getElementById("saveSlotOverlay"),
    title:document.getElementById("saveSlotTitle"),
    description:document.getElementById("saveSlotDescription"),
    status:document.getElementById("saveSlotStatus"),
    list:document.getElementById("saveSlotList"),
    close:document.getElementById("saveSlotClose"),
    manualSave:document.getElementById("manualSaveButton"),
    load:document.getElementById("loadGameButton")
  };
}

function initializeSaveSlotUI(){
  if(saveSlotUiInitialized)return;
  const elements=saveSlotElements();
  if(!elements.overlay||!elements.list||!elements.close)return;
  saveSlotUiInitialized=true;

  elements.close.addEventListener("click",closeSaveSlotDialog);
  elements.overlay.addEventListener("click",event=>{
    if(event.target===elements.overlay)closeSaveSlotDialog();
  });
  elements.manualSave?.addEventListener("click",event=>{
    openSaveSlotDialog("save","game",event.currentTarget);
  });
  elements.load?.addEventListener("click",event=>{
    openSaveSlotDialog("load","game",event.currentTarget);
  });
  document.addEventListener("keydown",handleSaveSlotDialogKeydown,true);
}

function openSaveSlotDialog(mode="load",origin="title",trigger=null){
  initializeSaveSlotUI();
  const elements=saveSlotElements();
  if(!elements.overlay)return false;

  saveSlotDialogMode=mode==="save"?"save":"load";
  saveSlotDialogOrigin=origin==="game"?"game":"title";
  saveSlotReturnFocus=trigger instanceof HTMLElement?trigger:document.activeElement;

  elements.title.textContent=saveSlotDialogMode==="save"
    ?"저장하기"
    :saveSlotDialogOrigin==="game"?"불러오기":"이어하기";
  // 판 안쪽 폭(css/save-slots.css --sv-inner-w)에 한 줄로 들어가는 길이입니다.
  // 더 길게 쓰면 두 줄이 되고, 두 줄까지는 아래 슬롯 네 칸을 밀지 않습니다.
  elements.description.textContent=saveSlotDialogMode==="save"
    ?"칸을 고르면 지금까지의 이야기가 그 자리에 남습니다."
    :(saveSlotDialogOrigin==="game"
      ?"돌아갈 자리를 고르세요. 저장하지 않은 지금 진행은 사라집니다."
      :"이어서 열 자리를 고르세요.");
  setSaveSlotStatus("");
  renderSaveSlotList();
  elements.overlay.classList.add("open");
  elements.overlay.setAttribute("aria-hidden","false");

  requestAnimationFrame(()=>{
    const firstActive=elements.list.querySelector(".save-slot-card:not(:disabled)");
    (firstActive||elements.close).focus();
  });
  return true;
}

function closeSaveSlotDialog(){
  const elements=saveSlotElements();
  if(!elements.overlay||!isSaveSlotDialogOpen())return false;
  elements.overlay.classList.remove("open");
  elements.overlay.setAttribute("aria-hidden","true");
  const focusTarget=saveSlotReturnFocus;
  saveSlotReturnFocus=null;
  requestAnimationFrame(()=>{
    if(
      focusTarget instanceof HTMLElement
      &&focusTarget.isConnected
      &&!focusTarget.hidden
      &&focusTarget.getClientRects().length
    )focusTarget.focus();
  });
  return true;
}

function isSaveSlotDialogOpen(){
  return !!document.getElementById("saveSlotOverlay")?.classList.contains("open");
}

function renderSaveSlotList(){
  const {list}=saveSlotElements();
  if(!list)return [];

  let slots=[];
  try{
    slots=typeof readAllSaveSlots==="function"?readAllSaveSlots():[];
  }catch(error){
    console.warn("저장 슬롯 목록을 읽지 못했습니다.",error);
    setSaveSlotStatus("저장 슬롯을 읽지 못했습니다.",true);
  }
  if(!Array.isArray(slots))slots=[];
  list.replaceChildren(...slots.map(createSaveSlotItem));
  return slots;
}

function createSaveSlotItem(slot){
  const item=document.createElement("div");
  item.className=`save-slot-item${slot.data?" has-data":""}`;
  item.setAttribute("role","listitem");

  const button=document.createElement("button");
  button.type="button";
  button.className=`save-slot-card${slot.manual?"":" is-auto"}${slot.data?"":" is-empty"}`;
  button.dataset.slotId=slot.id;
  button.disabled=saveSlotDialogMode==="save"?!slot.manual:!slot.data;
  button.setAttribute("aria-label",saveSlotAccessibleLabel(slot));
  button.addEventListener("click",()=>selectSaveSlot(slot));

  // 칸 이름(자동 저장 / 수동 저장 1~3)만 적습니다. 자동인지 수동인지는 그
  // 이름에 이미 들어 있어서, 밑에 따로 붙이던 설명 뱃지는 두지 않습니다.
  const name=document.createElement("span");
  name.className="save-slot-name";
  const nameText=document.createElement("strong");
  nameText.textContent=slot.label;
  name.append(nameText);

  const details=document.createElement("span");
  details.className="save-slot-details";
  if(slot.data){
    const summary=document.createElement("span");
    summary.className="save-slot-summary";
    summary.textContent=saveSlotSummary(slot.data);
    details.append(summary);
    const progressLabel=saveSlotProgressLabel(slot.data);
    if(progressLabel){
      const story=document.createElement("span");
      story.className="save-slot-story";
      story.textContent=`진행 · ${progressLabel}`;
      details.append(story);
    }
  }else{
    // 이 글자는 작은 나무 명패(ui_save_empty_notice) 위에 얹힙니다.
    // 명패 폭이 곧 글자 자리라 여섯 자를 넘기면 안 됩니다.
    const empty=document.createElement("span");
    empty.className="save-slot-empty-text";
    empty.textContent=saveSlotDialogMode==="save"&&slot.manual
      ?"여기에 저장"
      :"빈 칸";
    details.append(empty);
  }

  const savedTime=document.createElement("time");
  savedTime.className="save-slot-time";
  if(slot.data?.savedAt){
    const date=new Date(slot.data.savedAt);
    if(!Number.isNaN(date.getTime())){
      savedTime.dateTime=date.toISOString();
      savedTime.textContent=formatSaveSlotTime(date);
    }
  }
  // 빈 칸에는 자리만 비워 둡니다. 기록은 있는데 시각을 못 읽은 경우에만 "—".
  if(!savedTime.textContent&&slot.data)savedTime.textContent="—";

  button.append(name,details,savedTime);
  item.append(button);
  if(slot.data){
    const deleteButton=document.createElement("button");
    deleteButton.type="button";
    deleteButton.className="save-slot-delete";
    deleteButton.dataset.slotId=slot.id;
    deleteButton.textContent="삭제";
    deleteButton.title=`${slot.label} 데이터 삭제`;
    deleteButton.setAttribute("aria-label",`${slot.label} 저장 데이터 삭제`);
    deleteButton.addEventListener("click",event=>deleteSaveSlot(slot,event));
    item.append(deleteButton);
  }
  return item;
}

function saveSlotSummary(data){
  const saved=data?.state||{};
  const day=Number.isFinite(saved.day)?saved.day:"-";
  const loop=Math.max(1,Math.floor(Number(saved.story?.loop)||1));
  const currentLoop=saved.story?.currentLoop||saved.story||{};
  const loopResults=currentLoop.guestResults||{};
  const countedShards=Object.values(loopResults).filter(result=>
    result?.fragmentState==="partial"||result?.fragmentState==="full"
  ).length;
  const storedCount=Number(currentLoop.moonFragmentCount);
  const shards=Number.isFinite(storedCount)
    ?Math.max(0,Math.min(8,Math.floor(storedCount)))
    :countedShards;
  return `DAY ${day} · ${saveSlotPhaseLabel(saved.phase)} · 루프 ${loop} · 달빛 조각 ${shards}/8`;
}

function saveSlotPhaseLabel(phase){
  if(typeof savePhaseLabel==="function")return savePhaseLabel(phase);
  const phases=typeof GAME_PHASES==="object"&&GAME_PHASES?GAME_PHASES:{};
  if(phase===phases.MENU_SELECT||phase==="menuSelect")return "메뉴 선택";
  if(phase===phases.PREP||phase==="day")return "낮 준비";
  if(phase===phases.OPEN||phase==="night")return "밤 영업";
  if(phase===phases.RESULT||phase==="result")return "영업 마감";
  return "진행 중";
}

function saveSlotCheckpointScene(data){
  const checkpoint=data?.storyCheckpoint;
  const sceneId=checkpoint?.sceneId
    ||checkpoint?.scene?.id
    ||checkpoint?.queue?.[checkpoint?.queueIndex||0]
    ||checkpoint?.queue?.[0];
  if(!sceneId||typeof STORY_SCENES!=="object"||!STORY_SCENES)return null;
  return STORY_SCENES[sceneId]||null;
}

function saveSlotProgressLabel(data){
  const saved=data?.state||{};
  const numericDay=Math.floor(Number(saved.day));
  const dayLabel=Number.isFinite(numericDay)&&numericDay>0?`${numericDay}일차`:"현재 회차";
  const scene=saveSlotCheckpointScene(data);
  const sceneType=String(scene?.sceneType||"");
  const isPrologue=saved.story?.prologueComplete===false
    ||scene?.moment==="newGame"
    ||sceneType==="prologue"
    ||sceneType==="prologueInteraction";
  if(isPrologue)return "0일차 · 프롤로그 진행 중";

  const orders=Array.isArray(saved.orders)?saved.orders:[];
  const activeOrderId=saved.carrying?.orderId??saved.selectedOrderId;
  const selectedOrder=orders.find(order=>order?.id===activeOrderId)||null;
  const firstQueuedOrder=orders
    .map((order,index)=>({order,index}))
    .sort((a,b)=>(Number(a.order?.id)||0)-(Number(b.order?.id)||0)||a.index-b.index)[0]?.order||null;
  const activeOrder=selectedOrder||firstQueuedOrder;
  const specialScene=scene?.specialGuest===true
    ||sceneType==="specialGuestArrival"
    ||sceneType==="specialGuestMissing"
    ||sceneType==="specialGuestResult";
  const specialOrder=activeOrder?.customerType==="story"||!!activeOrder?.storySceneId;

  const phases=typeof GAME_PHASES==="object"&&GAME_PHASES?GAME_PHASES:{};
  const phase=saved.phase;
  const isOpen=phase===phases.OPEN||phase==="night";
  if(isOpen&&(specialScene||specialOrder))return `${dayLabel} · 특별 손님 응대 중`;
  if(isOpen&&activeOrder){
    const served=Math.max(0,Math.floor(Number(saved.generalServed)||0));
    return `${dayLabel} · ${served+1}번째 손님 응대 중`;
  }
  if(isOpen)return `${dayLabel} · 영업 중`;
  if(phase===phases.RESULT||phase==="result")return `${dayLabel} · 영업 마감`;
  if(
    phase===phases.MENU_SELECT||phase==="menuSelect"
    ||phase===phases.INGREDIENT_SELECT||phase==="ingredientSelect"
    ||phase===phases.PREP||phase==="day"
  )return `${dayLabel} · 영업 준비 중`;
  return `${dayLabel} · 진행 중`;
}

function formatSaveSlotTime(date){
  return new Intl.DateTimeFormat("ko-KR",{
    month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"
  }).format(date);
}

function saveSlotAccessibleLabel(slot){
  if(!slot.data)return `${slot.label}, 빈 슬롯`;
  const progress=saveSlotProgressLabel(slot.data);
  const date=new Date(slot.data.savedAt);
  const time=Number.isNaN(date.getTime())?"":`, ${formatSaveSlotTime(date)} 저장`;
  return `${slot.label}, ${saveSlotSummary(slot.data)}${progress?`, 진행 ${progress}`:""}${time}`;
}

function selectSaveSlot(slot){
  if(saveSlotDialogMode==="save"){
    saveToManualSlot(slot);
    return;
  }
  loadFromSelectedSlot(slot);
}

function saveToManualSlot(slot){
  if(!slot.manual)return;
  if(slot.data&&!window.confirm(`${slot.label}의 기존 저장 데이터를 덮어쓸까요?`))return;
  let saved=false;
  try{
    saved=typeof saveManualGame==="function"&&saveManualGame(slot.id);
  }catch(error){
    console.warn("수동 저장에 실패했습니다.",error);
  }
  if(!saved){
    setSaveSlotStatus("지금은 저장할 수 없습니다. 진행 중인 미니게임이나 직접 조리를 마친 뒤 다시 시도해 주세요.",true);
    return;
  }

  renderSaveSlotList();
  if(typeof updateContinueButton==="function")updateContinueButton();
  if(typeof showToast==="function")showToast(`${slot.label}에 저장했습니다.`);
  closeSaveSlotDialog();
}

function loadFromSelectedSlot(slot){
  if(!slot.data)return;
  if(
    saveSlotDialogOrigin==="game"
    &&!window.confirm(`${slot.label}의 저장 시점으로 돌아갈까요?\n현재 저장하지 않은 진행 상황은 사라집니다.`)
  )return;

  let loaded=false;
  try{
    loaded=typeof loadGameFromSlot==="function"&&loadGameFromSlot(slot.id);
  }catch(error){
    console.warn("저장 데이터를 불러오지 못했습니다.",error);
  }
  if(!loaded){
    setSaveSlotStatus("저장 데이터를 불러오지 못했습니다.",true);
    renderSaveSlotList();
    if(typeof updateContinueButton==="function")updateContinueButton();
    return;
  }
  closeSaveSlotDialog();
}

function deleteSaveSlot(slot,event=null){
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if(!slot?.data)return false;

  const autoSaveNotice=!slot.manual&&saveSlotDialogOrigin==="game"
    ?"\n게임을 계속하면 현재 진행 상황이 다시 자동 저장됩니다."
    :"";
  if(!window.confirm(
    `${slot.label} 데이터를 삭제할까요?\n삭제한 데이터는 복구할 수 없습니다.${autoSaveNotice}`
  ))return false;

  let deleted=false;
  try{
    deleted=typeof clearSaveData==="function"&&clearSaveData(slot.id);
  }catch(error){
    console.warn("저장 데이터를 삭제하지 못했습니다.",error);
  }
  if(!deleted){
    setSaveSlotStatus("저장 데이터를 삭제하지 못했습니다.",true);
    return false;
  }

  renderSaveSlotList();
  if(typeof updateContinueButton==="function")updateContinueButton();
  const {list,close,load}=saveSlotElements();
  if(load&&typeof hasAnySaveData==="function"){
    load.disabled=saveSlotDialogOrigin!=="game"||!hasAnySaveData();
  }
  setSaveSlotStatus(
    !slot.manual&&saveSlotDialogOrigin==="game"
      ?"자동 저장 데이터를 삭제했습니다. 게임을 계속하면 다시 자동 저장됩니다."
      :`${slot.label} 데이터를 삭제했습니다.`
  );
  requestAnimationFrame(()=>{
    const nextControl=list?.querySelector(
      ".save-slot-card:not(:disabled), .save-slot-delete:not(:disabled)"
    );
    (nextControl||close)?.focus();
  });
  return true;
}

function setSaveSlotStatus(message,isError=false){
  const status=document.getElementById("saveSlotStatus");
  if(!status)return;
  status.textContent=message;
  status.classList.toggle("is-error",!!isError);
}

function handleSaveSlotDialogKeydown(event){
  if(!isSaveSlotDialogOpen())return;
  if(event.key==="Escape"){
    event.preventDefault();
    event.stopImmediatePropagation();
    closeSaveSlotDialog();
    return;
  }
  if(event.key!=="Tab")return;

  const overlay=document.getElementById("saveSlotOverlay");
  const focusable=[...overlay.querySelectorAll(
    'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'
  )].filter(element=>!element.hidden);
  if(!focusable.length){
    event.preventDefault();
    return;
  }
  const first=focusable[0];
  const last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){
    event.preventDefault();
    last.focus();
  }else if(!event.shiftKey&&document.activeElement===last){
    event.preventDefault();
    first.focus();
  }
}

initializeSaveSlotUI();
