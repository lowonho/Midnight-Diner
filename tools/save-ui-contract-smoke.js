"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const indexSource=fs.readFileSync(path.join(root,"index.html"),"utf8");
const saveUiSource=fs.readFileSync(path.join(root,"save-ui.js"),"utf8");
let contractChecks=0;

function assert(condition,message){
  contractChecks++;
  if(!condition)throw new Error(message);
}

[
  "continueButton",
  "saveLoadActions",
  "manualSaveButton",
  "loadGameButton",
  "saveSlotOverlay",
  "saveSlotTitle",
  "saveSlotDescription",
  "saveSlotStatus",
  "saveSlotList",
  "saveSlotClose"
].forEach(id=>{
  assert(
    new RegExp(`\\bid=(["'])${id}\\1`).test(indexSource),
    `index.html에 #${id} 요소가 있어야 합니다.`
  );
});

const scriptOrder=[...indexSource.matchAll(/<script\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*>/gi)]
  .map(match=>match[2]);
const gameScriptIndex=scriptOrder.indexOf("game.js");
const saveUiScriptIndex=scriptOrder.indexOf("save-ui.js");
assert(gameScriptIndex>=0,"index.html이 game.js를 불러와야 합니다.");
assert(saveUiScriptIndex>=0,"index.html이 save-ui.js를 불러와야 합니다.");
assert(
  saveUiScriptIndex>gameScriptIndex,
  "save-ui.js는 게임 전역 함수를 사용할 수 있도록 game.js 뒤에 로드되어야 합니다."
);

const bootstrap=`
let runtimeChecks=0;
function check(condition,message){
  runtimeChecks++;
  if(!condition)throw new Error(message);
}
function equal(actual,expected,message){
  check(actual===expected,message+" (actual: "+String(actual)+", expected: "+String(expected)+")");
}

class MockClassList{
  constructor(owner){
    this.owner=owner;
    this.values=new Set();
  }
  setFromString(value){
    this.values=new Set(String(value||"").split(/\\s+/).filter(Boolean));
  }
  sync(){
    this.owner._className=[...this.values].join(" ");
  }
  add(...names){
    names.forEach(name=>this.values.add(name));
    this.sync();
  }
  remove(...names){
    names.forEach(name=>this.values.delete(name));
    this.sync();
  }
  contains(name){
    return this.values.has(name);
  }
  toggle(name,force){
    const enabled=force===undefined?!this.values.has(name):!!force;
    if(enabled)this.values.add(name);
    else this.values.delete(name);
    this.sync();
    return enabled;
  }
}

class MockHTMLElement{
  constructor(tagName="div"){
    this.tagName=String(tagName).toUpperCase();
    this.children=[];
    this.parentElement=null;
    this.dataset={};
    this.attributes=new Map();
    this.listeners=new Map();
    this.classList=new MockClassList(this);
    this._className="";
    this._textContent="";
    this.disabled=false;
    this.hidden=false;
    this.isConnected=true;
    this.type="";
    this.dateTime="";
  }
  set className(value){
    this._className=String(value||"");
    this.classList.setFromString(this._className);
  }
  get className(){
    return this._className;
  }
  set textContent(value){
    this._textContent=String(value??"");
    this.children=[];
  }
  get textContent(){
    return this._textContent+this.children.map(child=>child.textContent||"").join("");
  }
  setAttribute(name,value){
    this.attributes.set(String(name),String(value));
  }
  getAttribute(name){
    return this.attributes.has(String(name))?this.attributes.get(String(name)):null;
  }
  addEventListener(type,listener){
    const listeners=this.listeners.get(type)||[];
    listeners.push(listener);
    this.listeners.set(type,listeners);
  }
  dispatchEvent(event){
    const dispatched=event||{};
    dispatched.type=dispatched.type||"";
    dispatched.target=dispatched.target||this;
    dispatched.currentTarget=this;
    for(const listener of this.listeners.get(dispatched.type)||[])listener(dispatched);
    return !dispatched.defaultPrevented;
  }
  click(){
    if(this.disabled)return false;
    return this.dispatchEvent({
      type:"click",
      target:this,
      preventDefault(){this.defaultPrevented=true;}
    });
  }
  append(...children){
    children.forEach(child=>{
      child.parentElement=this;
      child.isConnected=this.isConnected;
      this.children.push(child);
    });
  }
  replaceChildren(...children){
    this.children.forEach(child=>{
      child.parentElement=null;
      child.isConnected=false;
    });
    this.children=[];
    this.append(...children);
  }
  matches(selector){
    let candidate=String(selector).trim();
    if(candidate.includes(":not(:disabled)")){
      if(this.disabled)return false;
      candidate=candidate.replace(":not(:disabled)","");
    }
    if(candidate.includes(':not([tabindex="-1"])')){
      if(this.getAttribute("tabindex")==="-1")return false;
      candidate=candidate.replace(':not([tabindex="-1"])',"");
    }
    const tag=candidate.match(/^[a-z][a-z0-9-]*/i)?.[0];
    if(tag&&this.tagName!==tag.toUpperCase())return false;
    for(const className of candidate.matchAll(/\\.([a-z0-9_-]+)/gi)){
      if(!this.classList.contains(className[1]))return false;
    }
    for(const attribute of candidate.matchAll(/\\[([a-z0-9_-]+)(?:="([^"]*)")?\\]/gi)){
      const value=this.getAttribute(attribute[1]);
      if(value===null||(attribute[2]!==undefined&&value!==attribute[2]))return false;
    }
    return true;
  }
  querySelectorAll(selector){
    const selectors=String(selector).split(",").map(value=>value.trim()).filter(Boolean);
    const matches=[];
    const visit=node=>{
      node.children.forEach(child=>{
        if(selectors.some(candidate=>child.matches(candidate)))matches.push(child);
        visit(child);
      });
    };
    visit(this);
    return matches;
  }
  querySelector(selector){
    return this.querySelectorAll(selector)[0]||null;
  }
  focus(){
    document.activeElement=this;
  }
  getClientRects(){
    return this.hidden?[]:[{width:1,height:1}];
  }
}

const HTMLElement=MockHTMLElement;
const elementStore=new Map();
const elementTags={
  continueButton:"button",
  manualSaveButton:"button",
  loadGameButton:"button",
  saveSlotClose:"button",
  saveSlotOverlay:"section"
};
[
  "continueButton",
  "manualSaveButton",
  "loadGameButton",
  "saveSlotOverlay",
  "saveSlotTitle",
  "saveSlotDescription",
  "saveSlotStatus",
  "saveSlotList",
  "saveSlotClose"
].forEach(id=>{
  const element=new MockHTMLElement(elementTags[id]||"div");
  element.id=id;
  elementStore.set(id,element);
});
elementStore.get("saveSlotOverlay").className="global-overlay save-slot-overlay";
elementStore.get("saveSlotOverlay").setAttribute("aria-hidden","true");

const documentListeners=new Map();
const document={
  activeElement:elementStore.get("continueButton"),
  createElement(tagName){
    return new MockHTMLElement(tagName);
  },
  getElementById(id){
    return elementStore.get(id)||null;
  },
  addEventListener(type,listener){
    const listeners=documentListeners.get(type)||[];
    listeners.push(listener);
    documentListeners.set(type,listeners);
  },
  dispatchEvent(event){
    const dispatched=event||{};
    dispatched.target=dispatched.target||document;
    for(const listener of documentListeners.get(dispatched.type)||[])listener(dispatched);
  }
};

function requestAnimationFrame(callback){
  callback();
  return 1;
}

const STORY_SCENES={
  "G-02":{title:"입담이 좋아도 자식과의 대화는 어려운 사람"},
  "C1-04B":{title:"돌아갈 자리와 남을 자리"}
};
const GAME_PHASES={
  MENU_SELECT:"menuSelect",
  PREP:"day",
  OPEN:"night",
  RESULT:"result"
};

const savedAt="2026-07-29T12:34:00.000Z";
let slots=[
  {
    id:"auto",label:"자동 저장",manual:false,
    data:{
      savedAt,
      state:{day:2,phase:"night",popularity:7},
      storyCheckpoint:{sceneId:"G-02"}
    }
  },
  {
    id:"manual1",label:"수동 저장 1",manual:true,
    data:{
      savedAt,
      state:{day:7,phase:"day",popularity:13},
      storyCheckpoint:{sceneId:"C1-04B"}
    }
  },
  {id:"manual2",label:"수동 저장 2",manual:true,data:null},
  {id:"manual3",label:"수동 저장 3",manual:true,data:null}
];
function readAllSaveSlots(){
  return slots;
}

const callOrder=[];
const manualSaveCalls=[];
const loadCalls=[];
const toastMessages=[];
let updateContinueCalls=0;
let confirmResult=true;
const confirmMessages=[];
function saveManualGame(slotId){
  callOrder.push("save:"+slotId);
  manualSaveCalls.push(slotId);
  return true;
}
function loadGameFromSlot(slotId){
  callOrder.push("load:"+slotId);
  loadCalls.push(slotId);
  return true;
}
function updateContinueButton(){
  callOrder.push("updateContinue");
  updateContinueCalls++;
}
function showToast(message){
  callOrder.push("toast");
  toastMessages.push(message);
}
const window={
  confirm(message){
    callOrder.push("confirm");
    confirmMessages.push(message);
    return confirmResult;
  }
};

function cards(){
  return elementStore.get("saveSlotList").querySelectorAll(".save-slot-card");
}
function card(slotId){
  return cards().find(button=>button.dataset.slotId===slotId);
}
`;

const tests=`
const overlay=elementStore.get("saveSlotOverlay");
const closeButton=elementStore.get("saveSlotClose");
const manualButton=elementStore.get("manualSaveButton");
const loadButton=elementStore.get("loadGameButton");

equal(closeButton.listeners.get("click")?.length,1,"초기화 시 닫기 버튼 이벤트를 한 번 연결해야 합니다.");
equal(overlay.listeners.get("click")?.length,1,"초기화 시 배경 클릭 이벤트를 한 번 연결해야 합니다.");
equal(manualButton.listeners.get("click")?.length,1,"초기화 시 설정의 저장하기 버튼을 연결해야 합니다.");
equal(loadButton.listeners.get("click")?.length,1,"초기화 시 설정의 불러오기 버튼을 연결해야 합니다.");
equal(documentListeners.get("keydown")?.length,1,"초기화 시 키보드 이벤트를 한 번 연결해야 합니다.");
initializeSaveSlotUI();
equal(documentListeners.get("keydown")?.length,1,"저장 UI 재초기화가 이벤트를 중복 연결하면 안 됩니다.");

check(
  openSaveSlotDialog("load","title",elementStore.get("continueButton")),
  "타이틀 이어하기 슬롯 창을 열 수 있어야 합니다."
);
equal(elementStore.get("saveSlotTitle").textContent,"이어하기","타이틀의 불러오기 모드 제목");
equal(cards().length,4,"타이틀 이어하기는 정확히 네 슬롯을 표시해야 합니다.");
check(!card("auto").disabled,"저장 데이터가 있는 자동 저장 슬롯은 불러올 수 있어야 합니다.");
check(!card("manual1").disabled,"저장 데이터가 있는 수동 저장 슬롯은 불러올 수 있어야 합니다.");
check(card("manual2").disabled&&card("manual3").disabled,"빈 슬롯은 불러오기 모드에서 비활성화되어야 합니다.");
check(
  card("auto").textContent.includes("DAY 2 · 밤 영업 · 인기도 7"),
  "자동 저장 카드에 DAY, 진행 단계, 인기도 요약이 보여야 합니다."
);
check(
  card("auto").textContent.includes("이야기 · 입담이 좋아도 자식과의 대화는 어려운 사람"),
  "자동 저장 카드에 현재 장면 제목이 보여야 합니다."
);
check(
  card("manual1").textContent.includes("DAY 7 · 낮 준비 · 인기도 13")
  &&card("manual1").textContent.includes("이야기 · 돌아갈 자리와 남을 자리"),
  "수동 저장 카드에도 진행 요약과 장면 제목이 보여야 합니다."
);
closeSaveSlotDialog();

manualButton.click();
equal(elementStore.get("saveSlotTitle").textContent,"저장하기","설정의 저장하기 버튼은 저장 모드로 열어야 합니다.");
check(card("auto").disabled,"자동 저장 슬롯은 저장 모드에서 선택할 수 없어야 합니다.");
check(!card("manual1").disabled,"데이터가 있는 수동 슬롯은 저장 모드에서 활성화되어야 합니다.");
check(!card("manual2").disabled&&!card("manual3").disabled,"빈 수동 슬롯도 저장 모드에서 활성화되어야 합니다.");
card("manual2").click();
equal(manualSaveCalls.length,1,"수동 슬롯 클릭은 저장 함수를 한 번 호출해야 합니다.");
equal(manualSaveCalls[0],"manual2","클릭한 수동 슬롯 ID로 저장해야 합니다.");
equal(updateContinueCalls,1,"수동 저장 성공 후 이어하기 상태를 갱신해야 합니다.");
equal(toastMessages[0],"수동 저장 2에 저장했습니다.","수동 저장 성공 안내가 보여야 합니다.");
check(!overlay.classList.contains("open"),"수동 저장 성공 후 슬롯 창을 닫아야 합니다.");
check(
  callOrder.indexOf("save:manual2")<callOrder.indexOf("updateContinue")
  &&callOrder.indexOf("updateContinue")<callOrder.indexOf("toast"),
  "저장 성공 후 이어하기 갱신과 안내를 순서대로 처리해야 합니다."
);

loadButton.click();
equal(elementStore.get("saveSlotTitle").textContent,"불러오기","설정의 불러오기 버튼은 게임 내 불러오기 모드로 열어야 합니다.");
card("manual1").click();
equal(confirmMessages.length,1,"게임 도중 불러오기는 확인 질문을 표시해야 합니다.");
equal(loadCalls[0],"manual1","확인 후 선택한 슬롯 ID를 불러와야 합니다.");
check(
  callOrder.lastIndexOf("confirm")<callOrder.lastIndexOf("load:manual1"),
  "불러오기 확인을 받은 뒤 저장 데이터를 복원해야 합니다."
);
check(!overlay.classList.contains("open"),"불러오기 성공 후 슬롯 창을 닫아야 합니다.");

openSaveSlotDialog("load","game",loadButton);
const escapeEvent={
  type:"keydown",
  key:"Escape",
  defaultPrevented:false,
  propagationStopped:false,
  preventDefault(){this.defaultPrevented=true;},
  stopImmediatePropagation(){this.propagationStopped=true;}
};
document.dispatchEvent(escapeEvent);
check(escapeEvent.defaultPrevented,"ESC로 닫을 때 기본 키 동작을 막아야 합니다.");
check(escapeEvent.propagationStopped,"ESC가 뒤쪽 게임 설정 조작으로 전파되면 안 됩니다.");
check(!overlay.classList.contains("open"),"ESC 키로 저장 슬롯 창을 닫을 수 있어야 합니다.");

runtimeChecks;
`;

const context={
  console:{
    log:message=>process.stdout.write(String(message)+"\n"),
    warn(){}
  },
  Map,
  Set,
  Date,
  Intl,
  String,
  Number,
  Boolean,
  Array,
  Object,
  RegExp,
  Error,
  Math
};

const runtimeChecks=vm.runInNewContext(
  [bootstrap,saveUiSource,tests].join("\n;\n"),
  context,
  {filename:"save-ui-contract-smoke.bundle.js"}
);

console.log(`SAVE_UI_CONTRACT_OK ${contractChecks+runtimeChecks}`);
