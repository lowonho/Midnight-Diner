"use strict";

// QA 전용 모듈입니다. URL에 ?qa=1을 붙였을 때만 활성화됩니다.
// 제거 방법: 이 파일, css/qa-mode.css, index.html의 QA_REMOVE 버튼/두 연결 줄,
//            save.js의 QA_REMOVE 두 줄을 삭제합니다.
const QA_MODE_ENABLED=new URLSearchParams(window.location.search).get("qa")==="1";
window.QA_MODE=Object.freeze({enabled:QA_MODE_ENABLED});

function qaBeginSession(message="임시 QA 세션을 시작했습니다."){
  if(!titleGameReady)return;
  startGame();qaRefreshPanel(message);
}

function qaStartNewSession(event){
  event.preventDefault();event.stopImmediatePropagation();
  qaBeginSession();
}

function qaOpenFromTitle(){
  if(QA_MODE_ENABLED){qaBeginSession();return;}
  const url=new URL(window.location.href);
  url.searchParams.set("qa","1");
  url.searchParams.set("qaStart","1");
  window.location.href=url.toString();
}

// 기존 새 게임 핸들러보다 먼저 가로채 저장 데이터 삭제를 방지합니다.
if(QA_MODE_ENABLED)document.getElementById("startButton")?.addEventListener("click",qaStartNewSession,true);
document.getElementById("qaModeButton")?.addEventListener("click",qaOpenFromTitle);

function qaMenuNames(ids){
  return ids.map(id=>menuDataById(id)?.displayName||id).join(", ")||"없음";
}

function qaCancelTransientState(){
  if(typeof storyTypingTimer!=="undefined"&&storyTypingTimer)clearTimeout(storyTypingTimer);
  if(typeof storyRevealTimer!=="undefined"&&storyRevealTimer)clearTimeout(storyRevealTimer);
  if(typeof storySession!=="undefined")storySession=null;
  document.getElementById("storyOverlay")?.classList.remove("open");
  dom.settingsOverlay.classList.remove("open");
  dom.resultOverlay.classList.remove("open");
  dom.miniOverlay.classList.remove("open");
  state.mini=null;state.paused=false;
}

function qaJumpToDay(day){
  if(!QA_MODE_ENABLED)return false;
  if(state.screen!=="game"){
    if(!titleGameReady){qaRefreshPanel("게임 로딩이 끝난 뒤 다시 눌러주세요.");return false;}
    startGame();
  }
  qaCancelTransientState();
  state.day=DayManager.setDay(day);
  resetDay(false);
  updateUI(true);syncPhaserObjects();
  qaRefreshPanel(`Day ${state.day} 시작 상태로 이동했습니다.`);
  return true;
}

function qaRefreshPanel(message=""){
  const panel=document.getElementById("qaModePanel");
  if(!panel||typeof state==="undefined")return;
  const day=DayManager.setDay(state.day),data=DayManager.getDayData(day);
  panel.querySelectorAll("[data-qa-day]").forEach(button=>button.classList.toggle("active",Number(button.dataset.qaDay)===day));
  panel.querySelector("[data-qa-prev]").disabled=day<=DayManager.minDay;
  panel.querySelector("[data-qa-next]").disabled=day>=DayManager.maxDay;
  panel.querySelector("[data-qa-state]").textContent=[
    `현재: Day ${day} · ${state.phase}`,
    `필수: ${qaMenuNames(data.requiredMenus)}`,
    `선택: ${qaMenuNames(data.optionalMenus)}`,
    `확정: ${qaMenuNames(state.selectedMenus||[])}`,
    `선택 범위: ${data.minSelectedMenus}~${data.maxSelectedMenus}`,
    data.specialMenu?`특별: ${qaMenuNames([data.specialMenu])}`:"특별: 없음",
    message
  ].filter(Boolean).join("\n");
}

function qaExitMode(){
  const url=new URL(window.location.href);
  url.searchParams.delete("qa");
  window.location.href=url.toString();
}

function initializeQaMode(){
  if(!QA_MODE_ENABLED)return;
  document.body.classList.add("qa-mode-enabled");
  const panel=document.createElement("aside");
  panel.id="qaModePanel";panel.className="qa-mode-panel";
  panel.innerHTML=`
    <header><strong>QA MODE</strong><span>저장 OFF</span><button data-qa-collapse type="button" aria-label="QA 패널 접기">−</button></header>
    <div class="qa-mode-body">
      <div class="qa-day-nav"><button data-qa-prev type="button">이전</button><strong>DAY 이동</strong><button data-qa-next type="button">다음</button></div>
      <div class="qa-day-grid">${Array.from({length:DayManager.maxDay},(_,index)=>`<button data-qa-day="${index+1}" type="button">D${index+1}</button>`).join("")}</div>
      <pre data-qa-state></pre>
      <small>Alt + 1~7로도 이동할 수 있습니다.</small>
      <button class="qa-exit" data-qa-exit type="button">QA 모드 종료</button>
    </div>`;
  document.body.appendChild(panel);
  panel.querySelectorAll("[data-qa-day]").forEach(button=>button.addEventListener("click",()=>qaJumpToDay(Number(button.dataset.qaDay))));
  panel.querySelector("[data-qa-prev]").addEventListener("click",()=>qaJumpToDay(DayManager.currentDay-1));
  panel.querySelector("[data-qa-next]").addEventListener("click",()=>qaJumpToDay(DayManager.currentDay+1));
  panel.querySelector("[data-qa-collapse]").addEventListener("click",event=>{
    panel.classList.toggle("collapsed");event.currentTarget.textContent=panel.classList.contains("collapsed")?"+":"−";
  });
  panel.querySelector("[data-qa-exit]").addEventListener("click",qaExitMode);
  window.addEventListener("keydown",event=>{
    if(event.altKey&&/^[1-7]$/.test(event.key)){event.preventDefault();qaJumpToDay(Number(event.key));}
  });
  setInterval(()=>qaRefreshPanel(),500);
  qaRefreshPanel("날짜 버튼을 누르면 해당 날짜의 시작 상태로 이동합니다.");
  const params=new URLSearchParams(window.location.search);
  if(params.get("qaStart")==="1"){
    const url=new URL(window.location.href);url.searchParams.delete("qaStart");
    window.history.replaceState(null,"",url.toString());
    if(titleGameReady)qaBeginSession("타이틀의 QA 모드 버튼으로 시작했습니다.");
    else{
      const readyTimer=setInterval(()=>{
        if(!titleGameReady)return;
        clearInterval(readyTimer);qaBeginSession("타이틀의 QA 모드 버튼으로 시작했습니다.");
      },200);
    }
  }
}

window.addEventListener("load",initializeQaMode,{once:true});
