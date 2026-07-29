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
  elements.description.textContent=saveSlotDialogMode==="save"
    ?"수동 저장 슬롯을 선택하세요. 자동 저장 슬롯은 게임 진행에 따라 갱신됩니다."
    :(saveSlotDialogOrigin==="game"
      ?"불러올 슬롯을 선택하세요. 현재 진행 상황은 선택한 저장 시점으로 바뀝니다."
      :"이어갈 저장 슬롯을 선택하세요.");
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
  item.className="save-slot-item";
  item.setAttribute("role","listitem");

  const button=document.createElement("button");
  button.type="button";
  button.className=`save-slot-card${slot.manual?"":" is-auto"}${slot.data?"":" is-empty"}`;
  button.dataset.slotId=slot.id;
  button.disabled=saveSlotDialogMode==="save"?!slot.manual:!slot.data;
  button.setAttribute("aria-label",saveSlotAccessibleLabel(slot));
  button.addEventListener("click",()=>selectSaveSlot(slot));

  const name=document.createElement("span");
  name.className="save-slot-name";
  const nameText=document.createElement("strong");
  nameText.textContent=slot.label;
  const badge=document.createElement("small");
  badge.className="save-slot-badge";
  badge.textContent=slot.manual?(slot.data?"수동 저장":"빈 슬롯"):"자동 전용";
  name.append(nameText,badge);

  const details=document.createElement("span");
  details.className="save-slot-details";
  if(slot.data){
    const summary=document.createElement("span");
    summary.className="save-slot-summary";
    summary.textContent=saveSlotSummary(slot.data);
    details.append(summary);
    const sceneTitle=saveSlotSceneTitle(slot.data);
    if(sceneTitle){
      const story=document.createElement("span");
      story.className="save-slot-story";
      story.textContent=`이야기 · ${sceneTitle}`;
      details.append(story);
    }
  }else{
    const empty=document.createElement("span");
    empty.className="save-slot-empty-text";
    empty.textContent=saveSlotDialogMode==="save"&&slot.manual
      ?"선택하면 현재 진행 상황을 저장합니다."
      :"저장 데이터가 없습니다.";
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
  if(!savedTime.textContent)savedTime.textContent="—";

  button.append(name,details,savedTime);
  item.append(button);
  return item;
}

function saveSlotSummary(data){
  const saved=data?.state||{};
  const day=Number.isFinite(saved.day)?saved.day:"-";
  const popularity=Number.isFinite(saved.popularity)?saved.popularity:0;
  return `DAY ${day} · ${saveSlotPhaseLabel(saved.phase)} · 인기도 ${popularity}`;
}

function saveSlotPhaseLabel(phase){
  if(typeof savePhaseLabel==="function")return savePhaseLabel(phase);
  const phases=typeof GAME_PHASES==="object"&&GAME_PHASES?GAME_PHASES:{};
  if(phase===phases.MENU_SELECT||phase==="menuSelect")return "메뉴 선택";
  if(phase===phases.PREP||phase==="day")return "낮 준비";
  if(phase===phases.OPEN||phase==="night")return "밤 영업";
  if(phase===phases.RESULT||phase==="result")return "영업 정산";
  return "진행 중";
}

function saveSlotSceneTitle(data){
  const checkpoint=data?.storyCheckpoint;
  const sceneId=checkpoint?.sceneId
    ||checkpoint?.scene?.id
    ||checkpoint?.queue?.[checkpoint?.queueIndex||0]
    ||checkpoint?.queue?.[0];
  if(!sceneId)return "";
  if(typeof STORY_SCENES==="object"&&STORY_SCENES?.[sceneId]?.title)return STORY_SCENES[sceneId].title;
  return checkpoint?.sceneTitle||sceneId;
}

function formatSaveSlotTime(date){
  return new Intl.DateTimeFormat("ko-KR",{
    month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"
  }).format(date);
}

function saveSlotAccessibleLabel(slot){
  if(!slot.data)return `${slot.label}, 빈 슬롯`;
  const scene=saveSlotSceneTitle(slot.data);
  const date=new Date(slot.data.savedAt);
  const time=Number.isNaN(date.getTime())?"":`, ${formatSaveSlotTime(date)} 저장`;
  return `${slot.label}, ${saveSlotSummary(slot.data)}${scene?`, 이야기 ${scene}`:""}${time}`;
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
