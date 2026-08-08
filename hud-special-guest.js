"use strict";

/* ============================================================
   낮 영업시간 상단 HUD의 "오늘의 특별 손님"

   [무엇을 정하는 파일인가]
   낮에도 밤과 같은 5칸 스탯이 뜨는데, 낮의 두 칸은 이름과 값이 다릅니다.
     · 방문 예정 손님   그 날 밤에 받을 일반 손님 수 (밤의 "남은 손님"과 같은 값)
     · 오늘의 특별 손님 그 날의 특별 손님 이름 또는 ???
   여기서는 뒤쪽 한 칸, 이름을 밝힐지 ??? 로 가릴지만 정합니다.
   글자 자체는 ui-hud.js(UI_TEXT), 칸 배치는 css/hud.css 가 갖습니다.

   [언제 이름이 열리나]
   그 날짜를 플레이해 특별 손님을 실제로 만난 적이 있으면 열립니다.
   만남은 story.js 가 등장 장면 끝에서 영구 기록(save.js metGuests)에
   적으므로, 새 게임을 시작해도 남습니다. 그래서 1회차에는 ??? 로 뜨고
   2회차부터 같은 날짜에서 이름이 보입니다.
   진행 중인 회차에서 이미 만난 손님은 세이브 상태로도 판정합니다.

   [로드 순서]
   ui-hud.js 다음, game.js 보다 먼저. (story.js·save.js 는 호출 시점에만
   필요하므로 순서와 무관합니다)
   ============================================================ */

// 날짜 → 특별 손님 id. 장면 표를 매 프레임 훑지 않도록 한 번만 찾아 둡니다.
// (날짜별 첫 손님은 진행 상황과 무관하게 고정입니다)
const hudSpecialGuestIdCache=new Map();

// 영구 기록(localStorage)은 매 프레임 읽지 않고 기억해 둡니다.
// 기록이 바뀌면 save.js·qa-mode.js 가 clearHudSpecialGuestCache() 로 지웁니다.
const hudSpecialGuestMetCache=new Map();

function clearHudSpecialGuestCache(){
  hudSpecialGuestMetCache.clear();
}
window.clearHudSpecialGuestCache=clearHudSpecialGuestCache;

/* 그 날짜에 반드시 오는 특별 손님 한 명입니다.
   7일차의 마지막 예약(SCN-G8-A)은 달빛 조각 7개가 모여야 열리는 추가
   손님이라 storyPrimaryGuestForDay 가 이미 제외합니다. */
function hudSpecialGuestIdForDay(day){
  const dayNumber=Math.max(1,Math.floor(Number(day)||1));
  if(hudSpecialGuestIdCache.has(dayNumber))return hudSpecialGuestIdCache.get(dayNumber);
  let guestId=null;
  if(typeof storyPrimaryGuestForDay==="function"){
    const scene=storyPrimaryGuestForDay(dayNumber);
    if(scene){
      guestId=typeof storyGuestIdForScene==="function"
        ?storyGuestIdForScene(scene)
        :scene.character||null;
    }
  }
  hudSpecialGuestIdCache.set(dayNumber,guestId);
  return guestId;
}

// 대화창에 뜨는 짧은 호칭을 씁니다. 영업일지의 긴 표기(displayName)는
// 칸을 넘겨서 예비로만 둡니다.
function hudSpecialGuestName(guestId){
  if(!guestId)return "";
  const character=typeof STORY_CHARACTERS!=="undefined"?STORY_CHARACTERS?.[guestId]:null;
  if(character?.name)return character.name;
  const definition=typeof GAMEPLAY_JOURNAL_PAGE_DEFS!=="undefined"
    ?GAMEPLAY_JOURNAL_PAGE_DEFS.find(page=>page.guestId===guestId)
    :null;
  return definition?.displayName||"";
}

// 지난 회차(또는 지운 세이브)에서 만난 적이 있는지 — 영구 기록만 봅니다.
function hudSpecialGuestMetBefore(guestId){
  if(!guestId)return false;
  if(hudSpecialGuestMetCache.has(guestId))return hudSpecialGuestMetCache.get(guestId);
  const met=!!window.MoonlightTableSave?.guestMet?.(guestId);
  hudSpecialGuestMetCache.set(guestId,met);
  return met;
}

function hudSpecialGuestKnown(guestId){
  if(!guestId)return false;
  const guest=typeof state!=="undefined"?state?.story?.guestState?.[guestId]:null;
  const result=typeof state!=="undefined"?state?.story?.guestResults?.[guestId]:null;
  // 이번 진행에서 이미 만났으면(루프를 한 바퀴 돈 경우 포함) 바로 이름을 씁니다.
  if(Number(guest?.visits)>0||guest?.previousLoopVisited||result?.visited)return true;
  return hudSpecialGuestMetBefore(guestId);
}

// 낮 상단 HUD "오늘의 특별 손님" 칸에 넣을 글자입니다.
function hudSpecialGuestLabel(day=typeof state!=="undefined"?state?.day:1){
  const guestId=hudSpecialGuestIdForDay(day);
  if(!guestId)return UI_TEXT.blank;
  if(!hudSpecialGuestKnown(guestId))return UI_TEXT.specialGuestUnknown;
  return hudSpecialGuestName(guestId)||UI_TEXT.specialGuestUnknown;
}
