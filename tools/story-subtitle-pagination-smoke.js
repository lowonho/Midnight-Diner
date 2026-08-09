"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const storySource=fs.readFileSync(path.join(root,"js/story.js"),"utf8");
const storyCss=fs.readFileSync(path.join(root,"css","story.css"),"utf8");

if(!/\.story-text\s*\{[\s\S]*?height:\s*2lh\s*;[\s\S]*?overflow:\s*hidden\s*;/m.test(storyCss)){
  throw new Error("자막 영역은 정확히 두 줄 높이이며 스크롤 없이 숨김 처리되어야 합니다.");
}

const bootstrap=`
function makeClassList(){
  const values=new Set();
  return {
    add(...names){names.forEach(name=>values.add(name));},
    remove(...names){names.forEach(name=>values.delete(name));},
    toggle(name,force){if(force)values.add(name);else values.delete(name);},
    contains(name){return values.has(name);}
  };
}
function makeElement(){
  const element={
    _text:"",innerHTML:"",hidden:false,disabled:false,scrollTop:0,
    clientHeight:0,parentElement:null,
    style:{display:"",setProperty(){}},classList:makeClassList(),
    children:[],dataset:{},addEventListener(){},
    appendChild(child){child.parentElement=this;this.children.push(child);return child;},
    removeAttribute(){},setAttribute(){},
    cloneNode(){const clone=makeElement();clone.clientHeight=this.clientHeight;return clone;},
    set textContent(value){this._text=String(value??"");},get textContent(){return this._text;}
  };
  Object.defineProperty(element,"scrollHeight",{get(){
    if(!this.clientHeight)return 0;
    const lines=String(this._text||"").split("\\n").reduce((total,line)=>
      total+Math.max(1,Math.ceil(Array.from(line).length/10)),0
    );
    return lines*20;
  }});
  return element;
}
const elements=new Map();
const storyText=makeElement();
storyText.clientHeight=40;
const storyTextParent=makeElement();
storyTextParent.appendChild(storyText);
elements.set("storyText",storyText);
const document={
  getElementById(id){if(!elements.has(id))elements.set(id,makeElement());return elements.get(id);},
  createElement(){return makeElement();}
};
const window={
  getComputedStyle(){return {lineHeight:"20px",width:"200px",height:"40px"};},
  matchMedia(){return {matches:true};},
  addEventListener(){}
};
const STORY_CHARACTERS={};
const STORY_SCENES={TEST:{id:"TEST",title:"test",lines:[]}};
const GAME_PHASES={OPEN:"night"};
var state={
  day:1,paused:true,phase:"day",screen:"game",
  story:{loop:1,completed:{},seenScenes:{},flags:{},activeStoryCook:null}
};
var audio=null;
function applyStoryCinematic(){return false;}
function clearStoryCinematic(){}
function updateRelationshipUI(){}
function updateUI(){}
function saveGame(){}
function showToast(){}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
`;

const tests=`
function assert(condition,message){if(!condition)throw new Error(message);}

const longText="하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열 열하나 열둘";
const pages=paginateStorySubtitle(longText,storyText);
assert(pages.length>=2,"3줄 이상 대사는 두 장 이상으로 분리되어야 합니다.");
assert(pages.every(page=>storySubtitlePageFits(page,storyText)),
  "분리된 모든 자막은 두 줄 높이 안에 들어가야 합니다.");
assert(pages.join(" ").replace(/\\s+/g," ")===longText.replace(/\\s+/g," "),
  "페이지를 나눠도 대사 내용이 빠지면 안 됩니다.");

const newlinePages=paginateStorySubtitle("첫째 줄\\n둘째 줄\\n셋째 줄",storyText);
assert(newlinePages.length===2&&newlinePages[1]==="셋째 줄",
  "명시적인 세 번째 줄은 다음 자막으로 넘어가야 합니다.");

const effectLine={text:longText,setsFlag:"finishedLongLine",cook:{dishId:"tofu"}};
storySession={
  queue:["TEST"],queueIndex:0,scene:STORY_SCENES.TEST,lines:[effectLine],lineIndex:0,
  subtitle:null,actors:[],wasPaused:true,
  waitingForCook:false,suspended:false,pendingCook:null
};
showStoryLine();
assert(!state.story.flags.finishedLongLine,
  "첫 페이지가 끝났을 때 대사 완료 효과를 미리 적용하면 안 됩니다.");
storyText.scrollTop=20;
assert(storyAdvance()&&storySession.subtitle.pageIndex===1,
  "계속 입력은 같은 대사의 다음 자막 페이지로 이동해야 합니다.");
assert(storyText.scrollTop===0,"다음 자막 페이지는 스크롤 위치를 맨 위로 초기화해야 합니다.");
while(storySubtitleHasNextPage())storyAdvance();
assert(state.story.flags.finishedLongLine===true,
  "마지막 자막 페이지에서만 대사 완료 효과를 적용해야 합니다.");
assert(document.getElementById("storyNextButton").innerHTML.includes("조리 시작"),
  "조리 시작 버튼은 마지막 자막 페이지에서 표시되어야 합니다.");

const checkpoint=captureStoryCheckpoint();
assert(checkpoint.subtitlePageIndex===storySession.subtitle.pageIndex,
  "저장 체크포인트는 같은 대사 안의 현재 자막 페이지를 보존해야 합니다.");
const savedPageIndex=checkpoint.subtitlePageIndex;
assert(restoreStoryCheckpoint(checkpoint)&&storySession.subtitle.pageIndex===savedPageIndex,
  "같은 화면 폭에서 체크포인트를 복원하면 저장한 자막 페이지가 다시 열려야 합니다.");
const legacyCheckpoint={...checkpoint};
delete legacyCheckpoint.subtitlePageIndex;
delete legacyCheckpoint.subtitleStartOffset;
assert(normalizeStoryCheckpoint(legacyCheckpoint).subtitlePageIndex===0,
  "기존 체크포인트는 대사의 첫 자막 페이지로 호환 복원되어야 합니다.");

const choiceLine={text:longText,choices:[{text:"선택",reply:"응답"}]};
storySession={
  queue:["TEST"],queueIndex:0,scene:STORY_SCENES.TEST,lines:[choiceLine],lineIndex:0,
  subtitle:null,actors:[],wasPaused:true,waitingForCook:false,suspended:false,pendingCook:null
};
showStoryLine();
assert(!document.getElementById("storyChoices").classList.contains("open")
  &&document.getElementById("storyNextButton").style.display==="block",
  "선택지는 중간 자막 페이지에서 미리 표시되면 안 됩니다.");
while(storySubtitleHasNextPage())storyAdvance();
assert(document.getElementById("storyChoices").classList.contains("open")
  &&document.getElementById("storyNextButton").style.display==="none",
  "선택지는 마지막 자막 페이지에서만 표시되어야 합니다.");

console.log("STORY_SUBTITLE_PAGINATION_OK",pages.length+newlinePages.length+12);
`;

vm.runInNewContext(`${bootstrap}\n${storySource}\n${tests}`,{console,setTimeout,clearTimeout});
