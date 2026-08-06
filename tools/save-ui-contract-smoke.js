"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const indexSource=fs.readFileSync(path.join(root,"index.html"),"utf8");
const saveUiSource=fs.readFileSync(path.join(root,"save-ui.js"),"utf8");
const saveSource=fs.readFileSync(path.join(root,"save.js"),"utf8");
const titleSource=fs.readFileSync(path.join(root,"title.js"),"utf8");
const storySource=fs.readFileSync(path.join(root,"story.js"),"utf8");
const gameSource=fs.readFileSync(path.join(root,"game.js"),"utf8");
const titleCssSource=fs.readFileSync(path.join(root,"css","title.css"),"utf8");
const storyCssSource=fs.readFileSync(path.join(root,"css","story.css"),"utf8");
const hudCssSource=fs.readFileSync(path.join(root,"css","hud.css"),"utf8");
const settingsCssSource=fs.readFileSync(path.join(root,"css","settings.css"),"utf8");
const saveSlotsCssSource=fs.readFileSync(path.join(root,"css","save-slots.css"),"utf8");
const packageData=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
let contractChecks=0;

function assert(condition,message){
  contractChecks++;
  if(!condition)throw new Error(message);
}

[
  "continueButton",
  "titleSettingsButton",
  "masterAudioToggle",
  "bgmAudioToggle",
  "sfxAudioToggle",
  "saveLoadActions",
  "manualSaveButton",
  "loadGameButton",
  "saveSlotOverlay",
  "saveSlotTitle",
  "saveSlotDescription",
  "saveSlotStatus",
  "saveSlotList",
  "saveSlotClose",
  "journalButton",
  "journalOverlay",
  "journalClose",
  "journalPage",
  "journalPageKind",
  "journalPageTitle",
  "journalPageNote",
  "journalPageProgress",
  "journalPrevious",
  "journalNext",
  "journalPageTabs",
  "storySkipButton"
].forEach(id=>{
  assert(
    new RegExp(`\\bid=(["'])${id}\\1`).test(indexSource),
    `index.html에 #${id} 요소가 있어야 합니다.`
  );
});
assert(!/\bid=(["'])(?:journalGuestList|journalFragmentList|journalEndingList)\1/.test(indexSource),
  "이전 가변 목록 UI가 남아 타이틀 고정 13페이지와 중복되면 안 됩니다.");
assert(indexSource.includes('class="journal-page-leaf journal-page-left"')
  &&indexSource.includes('class="journal-page-leaf journal-page-right"')
  &&indexSource.includes('aria-label="펼쳐진 영업일지"'),
  "영업일지는 화면 중앙에서 좌우 두 장으로 펼쳐지는 책 구조여야 합니다.");

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

assert(indexSource.includes("<title>달빛식탁 - 낮의 준비, 밤의 한 접시</title>"),
  "브라우저 제목에 새 게임명 달빛식탁이 표시되어야 합니다.");
assert(indexSource.includes("<strong>달빛식탁</strong>"),
  "타이틀과 게임 HUD 로고에 달빛식탁이 표시되어야 합니다.");
assert(indexSource.includes('aria-label="달빛식탁 게임 화면"')
  &&indexSource.includes('aria-label="달빛식탁 게임"'),
  "게임 화면 접근성 이름도 달빛식탁으로 변경되어야 합니다.");
assert(/id="codexButton"[^>]*aria-label="영업일지 열기"/.test(indexSource),
  "게임 내 도감 버튼은 진행용 영업일지를 여는 버튼으로 안내해야 합니다.");
assert(!indexSource.includes("심야식당"),
  "실제 게임 화면에 이전 게임명 심야식당이 남아 있으면 안 됩니다.");
assert(packageData.description.startsWith("달빛식탁 Phaser 프로토타입"),
  "프로젝트 설명에도 새 게임명을 사용해야 합니다.");
assert(/id="journalButton"[^>]*class="title-meta-button"/.test(indexSource)
  &&/id="titleSettingsButton"[^>]*class="title-meta-button"/.test(indexSource),
  "이어하기 아래 영업일지와 설정은 같은 사각 버튼 스타일을 사용해야 합니다.");
assert(indexSource.indexOf('id="continueButton"')<indexSource.indexOf('id="journalButton"')
  &&indexSource.indexOf('id="journalButton"')<indexSource.indexOf('id="saveInfo"'),
  "영업일지와 설정 사각 버튼은 이어하기 바로 아래에 있어야 합니다.");
assert(/\.title-meta-actions\s*\{[\s\S]*grid-template-columns:\s*repeat\(2/.test(titleCssSource)
  &&/\.title-meta-button\s*\{[\s\S]*border:\s*1px solid/.test(titleCssSource),
  "타이틀 보조 동작은 두 개의 테두리 있는 사각 버튼으로 배치해야 합니다.");
assert(["masterAudioToggle","bgmAudioToggle","sfxAudioToggle"].every(id=>
  new RegExp(`id="${id}"[\\s\\S]*?aria-pressed="true"[\\s\\S]*?>ON<\\/button>`).test(indexSource)),
  "설정창의 전체 음향·배경음악·효과음에 각각 ON/OFF 버튼이 있어야 합니다.");
assert(gameSource.includes("function audioIsEnabled()")
  &&gameSource.includes("function bgmAudioIsEnabled()")
  &&gameSource.includes("function sfxAudioIsEnabled()")
  &&gameSource.includes("function audioMasterGain()")
  &&gameSource.includes("function syncAudioToggle(button,enabled,label)")
  &&gameSource.includes("syncAudioToggle(dom.masterAudioToggle")
  &&gameSource.includes("syncAudioToggle(dom.bgmAudioToggle")
  &&gameSource.includes("syncAudioToggle(dom.sfxAudioToggle"),
  "세 음향 버튼은 실제 설정과 ON/OFF 표시를 함께 갱신해야 합니다.");
assert(gameSource.includes("fileGain(entry){return sfxAudioIsEnabled()")
  &&gameSource.includes("bgmFileGain(){return bgmAudioIsEnabled()")
  &&gameSource.includes("this.master.gain.value = audioMasterGain()"),
  "전체·배경음악·효과음 OFF는 각 파일 및 Web Audio 출력에 적용되어야 합니다.");
assert(saveSource.includes('const AUDIO_SETTINGS_KEY="moonlightTable.audio.v1"')
  &&saveSource.includes("bgmEnabled:true")
  &&saveSource.includes("sfxEnabled:true")
  &&saveSource.includes("function readAudioSettings(")
  &&saveSource.includes("function writeAudioSettings("),
  "음향 ON/OFF와 볼륨은 진행 저장과 분리된 전역 설정으로 유지해야 합니다.");
assert(settingsCssSource.includes(".audio-toggle-button.is-off")
  &&settingsCssSource.includes(".settings-overlay.audio-muted")
  &&settingsCssSource.includes(".volume-row.is-muted"),
  "음향 OFF 상태는 설정창에서 시각적으로 구분되어야 합니다.");
assert(settingsCssSource.includes("--journal-book-image")
  &&/\.journal-page\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/.test(settingsCssSource)
  &&settingsCssSource.includes(".journal-page::before")
  &&settingsCssSource.includes(".journal-page-right"),
  "영업일지는 향후 책 에셋을 적용할 수 있는 중앙 펼침책 레이아웃이어야 합니다.");

assert(/id="storySkipButton"[^>]*\bhidden\b/.test(indexSource),
  "SKIP 버튼은 story.js가 이미 본 대화임을 확인하기 전까지 숨겨져 있어야 합니다.");
assert(/\.story-skip\[hidden\]\s*\{\s*display\s*:\s*none/.test(storyCssSource),
  "숨긴 SKIP 버튼을 대화 CSS가 다시 표시하면 안 됩니다.");
assert(titleSource.includes("function openJournal(")
  &&titleSource.includes("function closeJournal(")
  &&titleSource.includes("function refreshJournalUI("),
  "타이틀에서 영업일지를 열고 닫고 다시 그릴 수 있어야 합니다.");
assert(titleSource.includes("collectionPages")
  &&titleSource.includes("journalPageProgress")
  &&titleSource.includes("journalPageTabs"),
  "타이틀 영업일지는 고정 13페이지 API로 페이지 수와 탭을 그려야 합니다.");
assert(titleSource.includes('function openTitleJournal(){return openJournal("collection");}')
  &&titleSource.includes('function openGameplayJournal(){return openJournal("gameplay");}'),
  "타이틀 영구 컬렉션과 게임 내 진행 기록은 서로 다른 모드로 열려야 합니다.");
const openJournalSource=titleSource.match(/function openJournal\([\s\S]+?\r?\n}\r?\n\r?\nfunction openTitleJournal/)?.[0]||"";
assert(openJournalSource.includes('journalMode==="gameplay"')
  &&openJournalSource.includes("journalWasPaused=!!state.paused")
  &&openJournalSource.includes("state.paused=true"),
  "게임 내 영업일지를 열 때만 기존 일시정지 상태를 저장하고 게임을 멈춰야 합니다.");
const closeJournalSource=titleSource.match(/function closeJournal\([\s\S]+?\r?\n}\r?\n\r?\nfunction initializeJournalUI/)?.[0]||"";
assert(closeJournalSource.includes('journalMode==="gameplay"')
  &&closeJournalSource.includes("state.paused=journalWasPaused"),
  "게임 내 영업일지를 닫으면 기존 일시정지 상태를 복원해야 합니다.");
assert(titleSource.includes('if(event.target===elements.overlay)closeJournal()')
  &&titleSource.includes('if(event.key!=="Escape"')
  &&titleSource.includes("closeJournal();"),
  "배경 클릭과 ESC로 닫아도 같은 영업일지 상태 복원 경로를 사용해야 합니다.");
assert(titleSource.includes('typeof getGameplayJournalPages==="function"?getGameplayJournalPages():[]'),
  "게임 내 영업일지는 현재 세이브에 종속된 생성 함수를 사용해야 합니다.");
assert(titleSource.includes("첫 장에는 영업 규칙이, 음식 장에는 레시피가, 날짜 장에는 직접 만난 뒤의 기록만 남습니다."),
  "진행용 영업일지는 규칙·음식 레시피·직접 만난 뒤의 날짜 기록을 안내해야 합니다.");
assert(titleSource.includes('page.pageType==="rules"')
  &&titleSource.includes('page.pageType==="recipe"')
  &&titleSource.includes('page.pageType==="day"')
  &&titleSource.includes("기록 없음")
  &&titleSource.includes("gameplayJournalRecipeNote(page)")
  &&titleSource.includes("page.entries.map(gameplayJournalEntryNote)"),
  "진행용 영업일지는 주의사항·음식별 레시피·방문 뒤 채워지는 날짜별 기록을 구분해야 합니다.");
[
  "주의사항","재료","영업 전 준비","주문 후 조리","과거 영업 기록","현재 회차"
].forEach(label=>assert(titleSource.includes(`journalSection("${label}"`),
  `진행용 영업일지에 '[${label}]' 구역이 있어야 합니다.`));
[
  "음식 단서","확인 음식","최근 평가","공개 이야기",
  "이전 회차 평가","이전 회차 부분 조각","이전 회차 완전 조각","본 장면",
  "방문","평가","조각 상태","조각명"
].forEach(label=>assert(titleSource.includes(`journalField("${label}"`),
  `진행용 영업일지에 '${label}' 필드가 있어야 합니다.`));
[
  "previousLoopEvaluation","previouslyObtainedPartial","previouslyObtainedFull","seenStoryScenes",
  "currentLoopVisited","currentLoopEvaluation","currentFragmentState","currentFragmentName"
].forEach(field=>assert(titleSource.includes(`"${field}"`),
  `진행용 영업일지는 '${field}' 값을 표시해야 합니다.`));
const journalMetaSource=titleSource.match(/function journalPageMeta\([\s\S]+?\r?\n}\r?\n\r?\nfunction renderJournalTabs/)?.[0]||"";
assert(journalMetaSource.includes('journalMode==="gameplay"')
  &&journalMetaSource.includes('현재 평가 · ${page.currentLoopEvaluation}')
  &&journalMetaSource.includes('현재 조각 · ${page.currentFragmentState||"미획득"}'),
  "진행용 영업일지 상단 요약은 과거 조각이 아니라 현재 회차 평가와 조각 상태를 표시해야 합니다.");
[
  "이름","기억의 음식","좋아한 스타일","완성된 이야기","달빛 조각","진엔딩 이후 후일담"
].forEach(label=>assert(titleSource.includes(`journalField("${label}"`),
  `타이틀 손님 페이지에 '${label}' 필드가 있어야 합니다.`));
[
  "엔딩 번호","엔딩 제목","요약","마지막 대사","최초 달성"
].forEach(label=>assert(titleSource.includes(`journalField("${label}"`),
  `타이틀 엔딩 페이지에 '${label}' 필드가 있어야 합니다.`));
assert(settingsCssSource.includes(".journal-page-tab")
  &&settingsCssSource.includes(".is-locked")
  &&settingsCssSource.includes(".is-new"),
  "타이틀 영업일지는 고정 페이지의 잠금과 최초 해금 상태를 구분해야 합니다.");
assert(settingsCssSource.includes(".journal-page-portrait.journal-page-icon")
  &&titleSource.includes('classList.toggle("journal-page-icon",isGameplayRecord)'),
  "날짜별 기록은 미래 손님 실루엣 대신 중립적인 날짜 아이콘을 표시해야 합니다.");
const journalScrollRule=settingsCssSource.match(/\.journal-page-right\s*\{([^}]+)\}/);
const journalBodyRule=settingsCssSource.match(/\.journal-page p\s*\{([^}]+)\}/);
assert(journalScrollRule
  &&/overflow-y\s*:\s*auto/.test(journalScrollRule[1])
  &&journalBodyRule
  &&/overflow-wrap\s*:\s*anywhere/.test(journalBodyRule[1])
  &&/white-space\s*:\s*pre-line/.test(journalBodyRule[1]),
  "긴 영업일지 본문은 문서 영역 안에서 스크롤되고 자동 줄바꿈되어야 합니다.");
assert(saveSource.includes('const SAVE_VERSION=4;')
  &&saveSource.includes("function migrateSaveStorage()"),
  "새 시나리오는 저장 버전을 올리고 일회성 저장 초기화를 제공해야 합니다.");
assert(saveSource.includes("window.MoonlightTableSave=Object.freeze")
  &&saveSource.includes("clearAutoSaveForTrueEnding"),
  "스토리에서 영업일지 기록과 진엔딩 자동 저장 삭제 helper를 호출할 수 있어야 합니다.");
assert(!saveSource.includes('addEventListener("pagehide"')
  &&!saveSource.includes('addEventListener("visibilitychange"'),
  "화면 이탈·백그라운드 전환은 자동 저장을 새로 만들면 안 됩니다.");
assert(saveSource.includes("saveEndingRetryCheckpoint")
  &&saveSource.includes("readEndingRetryCheckpoint")
  &&saveSource.includes("clearEndingRetryCheckpoint"),
  "일반 엔딩은 이어하기 슬롯과 분리된 숨은 재시도 체크포인트 API를 제공해야 합니다.");
assert(titleSource.includes("showPendingEndingRetryCheckpoint")
  &&titleSource.includes("restoreEndingRetryCheckpointGame")
  &&titleSource.includes("clearEndingRetryCheckpoint"),
  "타이틀은 숨은 엔딩 체크포인트를 표시·복원하고 새 게임에서 정리해야 합니다.");
assert(storySource.includes('window.addEventListener("keydown"')
  &&storySource.includes("endingRetryMenuIsOpen()")
  &&storySource.includes("stopImmediatePropagation()"),
  "엔딩 결론창의 ESC 입력이 뒤쪽 설정창으로 전파되면 안 됩니다.");
assert((indexSource.match(/class="[^"]*retired-economy-ui[^"]*"/g)||[]).length>=5,
  "인기도·매출·폐기 HUD와 영업 결과 요소를 비노출 대상으로 표시해야 합니다.");
assert(/\.retired-economy-ui\s*\{\s*display\s*:\s*none\s*!important/.test(hudCssSource),
  "폐기된 경제 UI는 게임 화면에 나타나지 않아야 합니다.");

const storyUiOnlyRule=storyCssSource.match(
  /\.game-frame:has\(>\s*#storyOverlay\.open:not\(\.show-game-ui\)\)\s*>\s*:not\(#gameCanvas\):not\(#storyOverlay\)\s*\{([^}]+)\}/
);
assert(storyUiOnlyRule,
  "스토리 대화가 열리면 게임 캔버스와 스토리 오버레이 외 형제 UI를 숨기는 규칙이 있어야 합니다.");
const normalizedStoryUiOnlyRule=storyUiOnlyRule[1].replace(/\s+/g,"");
assert(normalizedStoryUiOnlyRule.includes("opacity:0!important")
  &&normalizedStoryUiOnlyRule.includes("visibility:hidden!important")
  &&normalizedStoryUiOnlyRule.includes("pointer-events:none!important"),
  "스토리 중 다른 UI는 보이지 않고 입력도 받지 않아야 합니다.");
const storyTextRule=storyCssSource.match(/\.story-text\s*\{([^}]+)\}/);
assert(storyTextRule&&/white-space\s*:\s*pre-line\s*;/.test(storyTextRule[1]),
  "스토리 자막은 데이터에 지정한 줄바꿈을 화면에 그대로 표시해야 합니다.");
const saveSlotItemRule=saveSlotsCssSource.match(/\.save-slot-item\s*\{([^}]+)\}/);
assert(saveSlotItemRule&&/display\s*:\s*grid/.test(saveSlotItemRule[1])
  &&/grid-template-columns\s*:\s*minmax\(0,\s*1fr\)\s+auto/.test(saveSlotItemRule[1]),
  "저장 슬롯 카드와 삭제 버튼은 중첩하지 않고 나란한 열에 배치해야 합니다.");
const saveSlotDeleteRule=saveSlotsCssSource.match(/\.save-slot-delete\s*\{([^}]+)\}/);
assert(saveSlotDeleteRule&&/min-height\s*:\s*calc\(44\s*\*\s*var\(--upx\)\)/.test(saveSlotDeleteRule[1]),
  "저장 삭제 버튼은 키보드와 포인터로 누르기 충분한 크기여야 합니다.");

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
      state:{day:2,phase:"night",story:{loop:2,guestResults:{rainyChild:{fragmentState:"partial"}}}},
      storyCheckpoint:{sceneId:"G-02"}
    }
  },
  {
    id:"manual1",label:"수동 저장 1",manual:true,
    data:{
      savedAt,
      state:{day:7,phase:"day",story:{loop:3,guestResults:{rainyChild:{fragmentState:"partial"},lanternGuest:{fragmentState:"full"}}}},
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
const deleteCalls=[];
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
function clearSaveData(slotId){
  callOrder.push("delete:"+slotId);
  deleteCalls.push(slotId);
  const target=slots.find(slot=>slot.id===slotId);
  if(!target)return false;
  target.data=null;
  return true;
}
function hasAnySaveData(){
  return slots.some(slot=>!!slot.data);
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
function deleteButtons(){
  return elementStore.get("saveSlotList").querySelectorAll(".save-slot-delete");
}
function deleteButton(slotId){
  return deleteButtons().find(button=>button.dataset.slotId===slotId);
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
  card("auto").textContent.includes("DAY 2 · 밤 영업 · 루프 2 · 달빛 조각 1/8"),
  "자동 저장 카드에 DAY, 진행 단계, 루프와 달빛 조각 요약이 보여야 합니다."
);
check(
  card("auto").textContent.includes("이야기 · 입담이 좋아도 자식과의 대화는 어려운 사람"),
  "자동 저장 카드에 현재 장면 제목이 보여야 합니다."
);
check(
  card("manual1").textContent.includes("DAY 7 · 낮 준비 · 루프 3 · 달빛 조각 2/8")
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

openSaveSlotDialog("load","title",elementStore.get("continueButton"));
check(!!deleteButton("auto")&&!!deleteButton("manual1"),
  "데이터가 있는 자동·수동 저장 슬롯에는 삭제 버튼이 있어야 합니다.");
check(!deleteButton("manual2")&&!deleteButton("manual3"),
  "빈 저장 슬롯에는 삭제 버튼이 없어야 합니다.");
check(
  deleteButton("auto").parentElement===card("auto").parentElement
  &&!card("auto").querySelector(".save-slot-delete"),
  "삭제 버튼은 슬롯 선택 버튼 안이 아니라 같은 슬롯의 형제 요소여야 합니다."
);

const loadCountBeforeDelete=loadCalls.length;
const saveCountBeforeDelete=manualSaveCalls.length;
const updateCountBeforeDelete=updateContinueCalls;
confirmResult=false;
deleteButton("auto").click();
equal(deleteCalls.length,0,"삭제 확인을 취소하면 저장 데이터를 지우면 안 됩니다.");
check(!!deleteButton("auto"),"삭제 취소 뒤에는 해당 저장 슬롯이 그대로 남아야 합니다.");
equal(loadCalls.length,loadCountBeforeDelete,
  "삭제 버튼을 눌러도 저장 불러오기가 실행되면 안 됩니다.");
equal(manualSaveCalls.length,saveCountBeforeDelete,
  "삭제 버튼을 눌러도 수동 저장이 실행되면 안 됩니다.");

confirmResult=true;
deleteButton("auto").click();
equal(deleteCalls.at(-1),"auto","자동 저장 삭제는 auto 슬롯 ID를 전달해야 합니다.");
check(card("auto").classList.contains("is-empty")&&card("auto").disabled,
  "삭제된 자동 저장은 불러오기 화면에서 빈 비활성 슬롯으로 다시 그려져야 합니다.");
check(!deleteButton("auto"),"삭제가 끝난 빈 슬롯에는 삭제 버튼이 남으면 안 됩니다.");
equal(updateContinueCalls,updateCountBeforeDelete+1,
  "저장 삭제 후 타이틀의 이어하기 상태를 갱신해야 합니다.");
equal(loadCalls.length,loadCountBeforeDelete,
  "자동 저장 삭제가 슬롯 불러오기로 이어지면 안 됩니다.");
check(overlay.classList.contains("open"),
  "저장 삭제 후에도 슬롯 창을 열어 두어 다른 저장을 관리할 수 있어야 합니다.");
check(elementStore.get("saveSlotStatus").textContent.includes("삭제했습니다"),
  "저장 삭제 성공 상태를 화면에 알려야 합니다.");

closeSaveSlotDialog();
loadButton.disabled=false;
openSaveSlotDialog("load","game",loadButton);
const updateCountBeforeLastDelete=updateContinueCalls;
deleteButton("manual1").click();
equal(deleteCalls.at(-1),"manual1",
  "수동 저장 삭제는 선택한 수동 슬롯 ID를 전달해야 합니다.");
check(card("manual1").classList.contains("is-empty")&&card("manual1").disabled,
  "삭제된 수동 저장도 불러오기 화면에서 빈 비활성 슬롯으로 다시 그려져야 합니다.");
equal(updateContinueCalls,updateCountBeforeLastDelete+1,
  "마지막 저장 삭제 후에도 이어하기 상태를 갱신해야 합니다.");
check(loadButton.disabled,
  "마지막 저장을 삭제하면 설정의 불러오기 버튼을 즉시 비활성화해야 합니다.");

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
