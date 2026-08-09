"use strict";

const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const game=read("game.js");
const day=read("day.js");
const dayPrep=read("day-prep-minigames.js");
const ingredient=read("ingredient-select.js");
const kitchen=read("kitchen.js");
const player=read("player.js");
const night=read("night.js");
const customers=read("customers.js");
const story=read("story.js");
const title=read("title.js");
const gameData=read("game-data.js");
const miniFrame=read("ui-mini-frame.js");
const miniFrameCss=read("css/minigame-frame.css");
const interactionCss=read("css/interaction.css");
const orderPlace=read("engine-e8-order-place.js");
const index=read("index.html");

assert(game.includes("if(state.mini&&!settingsOpen&&!storyDialogueOpen){updateMini(dt);updateUI(false);}"),
  "설정창이나 이야기 대화가 열린 동안 미니게임 갱신을 멈춰야 합니다.");
assert(game.includes('const pauseNightCustomerPresentation=state.phase==="night"&&!!state.mini;')
  &&game.includes("updateNightOrderEntrances(dt,pauseNightCustomerPresentation);")
  &&game.includes("if(!pauseNightCustomerPresentation)ensureNightOrders();")
  &&game.includes('if(pauseNightCustomerPresentation&&order.customerType!=="story")return;')
  &&game.includes("if(pauseNightCustomerPresentation&&!item.guestId)return;"),
  "밤 미니게임 중에는 일반 손님의 등장·재등장·대기 말풍선·퇴장 수명이 멈춰야 합니다.");
assert(game.includes('if(order.customerType==="story"){')
  &&game.includes('const hadGeneralWaitingBubble=order.waitingBubbleShown===true;')
  &&game.includes('order.waitingTime=0;order.waitingBubbleShown=false;')
  &&game.includes('if(hadGeneralWaitingBubble){order.bubble="";order.bubbleTime=0;}')
  &&game.includes('else if(order.bubbleTime>0)order.bubbleTime=Math.max(0,order.bubbleTime-dt);'),
  "특별 손님은 전용 등장 말풍선은 유지하되 일반 손님용 대기 타이머와 말풍선을 사용하면 안 됩니다.");
assert(miniFrame.includes('id="miniPause"')
  &&miniFrameCss.includes("#miniPause { display: grid; }")
  &&miniFrameCss.includes("#miniClose:not([hidden]) + #miniPause"),
  "닫을 수 있는 낮 준비 미니게임을 포함해 공용 미니게임에는 항상 설정 버튼이 보여야 합니다.");
assert(index.includes('id="ingredientPause"')
  &&game.includes('"ingredientPause"')
  &&game.includes('dom.ingredientPause.addEventListener("click",()=>openSettings("game"));'),
  "냉장고 재료 찾기 미니게임에서도 설정창을 열 수 있어야 합니다.");
assert(index.includes('id="ingredientSelectOverlay" class="overlay mini-overlay ingredient-select-overlay"')
  &&index.includes('id="ingredientPause" class="mini-icon-button mini-pause"')
  &&miniFrameCss.includes(".mini-icon-button {")
  &&miniFrameCss.includes(".mini-pause { background-image: var(--ui-pause); }"),
  "독립 냉장고 오버레이에서도 설정 버튼의 공용 위치와 그림 스타일이 적용되어야 합니다.");
assert(game.includes("||state.phase===GAME_PHASES.INGREDIENT_SELECT;")
  &&game.includes('if(from==="game"&&!saveBlocked)saveGame(true);')
  &&game.indexOf("const saveBlocked=")<game.indexOf('if(from==="game"&&!saveBlocked)saveGame(true);')
  &&title.includes("state.mini||state.story?.activeStoryCook||state.phase===GAME_PHASES.INGREDIENT_SELECT"),
  "냉장고 미니게임 중에는 완료 지연 상태를 저장하거나 타이틀로 이동할 수 없어야 합니다.");
assert(game.includes('if(k==="escape")')
  &&game.includes('else if(state.screen==="game")openSettings("game");')
  &&game.includes("if(settingsOverlayIsOpen())return;"),
  "모든 미니게임에서 ESC로 설정을 열고 설정 뒤쪽 입력은 차단해야 합니다.");
const endingRetryGuard=game.indexOf('if(typeof endingRetryMenuIsOpen==="function"&&endingRetryMenuIsOpen())return;');
const saveDialogEscapeGuard=game.indexOf('if(typeof isSaveSlotDialogOpen==="function"&&isSaveSlotDialogOpen())',endingRetryGuard);
assert(game.includes('setSettingsBackgroundInert(true);')
  &&game.includes('setSettingsBackgroundInert(false);')
  &&game.includes('new MutationObserver(()=>{')
  &&game.includes('window.addEventListener("keydown",event=>{')
  &&game.includes('if(event.key==="Tab")')
  &&/if\(settingsOverlayIsOpen\(\)\)return;\s*beginNight\(\);/.test(game)
  &&endingRetryGuard>=0
  &&saveDialogEscapeGuard>endingRetryGuard,
  "설정창은 배경을 inert 처리하고 포커스를 가두며 영업 시작과 엔딩창 뒤 ESC를 차단해야 합니다.");
const settingsInputGuard=game.indexOf('if(settingsOverlayIsOpen())return;',game.indexOf('window.addEventListener("keydown",e=>{'));
const gameKeyPrevent=game.indexOf('e.preventDefault();',settingsInputGuard);
assert(settingsInputGuard>=0&&gameKeyPrevent>settingsInputGuard,
  "설정창 안에서는 게임 키 입력만 차단하고 슬라이더 방향키와 버튼 Space 기본 조작은 허용해야 합니다.");

const hud=read("ui-hud.js");
assert(index.includes('<span id="satisfactionLabel">오늘의 특별 손님</span><strong id="satisfactionText">-</strong>')
  &&hud.includes('satisfactionLabelOther: "손님 반응"')
  &&index.includes('<span>손님들의 반응</span><strong id="satisfactionResult">-</strong>')
  &&index.includes('<span>오늘의 접시</span><strong id="fiveStarResult">-</strong>')
  &&!hud.match(/miniScore:\s*score\s*=>[^\n]*\$\{score\}/)
  &&!hud.match(/prepGain:\s*\([^)]*quality[^)]*\)\s*=>[^\n]*\$\{quality\}/)
  &&game.includes("UI_TEXT.guestResponse(avgSatisfaction())"),
  "조리 피드백과 HUD·정산 화면은 정확한 점수 대신 정성적인 반응을 보여야 합니다.");

/* 낮 우상단 스탯은 밤과 같은 5칸이고, 두 칸의 이름·값만 낮으로 바뀝니다.
   그날의 특별 손님 이름은 그 날짜를 플레이해 만난 적이 있을 때만 밝힙니다. */
const hudCss=read("css/hud.css");
const hudSpecialGuest=read("hud-special-guest.js");
const save=read("save.js");
assert(!hudCss.includes(".phase-prep .stat-time")
  &&!/\.phase-prep \.hud-stats \{ grid-template-columns/.test(hudCss)
  &&index.includes('<span id="timeLabel">방문 예정 손님</span>')
  &&index.includes('<script src="hud-special-guest.js">')
  &&hud.includes('timeLabelPrep: "방문 예정 손님"')
  &&hud.includes('satisfactionLabelPrep: "오늘의 특별 손님"')
  &&game.includes("UI_TEXT.guestsLeft(nightGeneralOrderTarget(state.day))")
  &&game.includes("dom.satisfactionLabel.textContent=isDayPreparation?UI_TEXT.satisfactionLabelPrep:UI_TEXT.satisfactionLabelOther;")
  &&game.includes("?hudSpecialGuestLabel(state.day)"),
  "낮 영업시간의 우상단 UI는 밤과 같은 5칸으로, 방문 예정 손님 수와 오늘의 특별 손님을 보여야 합니다.");
assert(hud.includes('specialGuestUnknown: "???"')
  &&hudSpecialGuest.includes("function hudSpecialGuestLabel(")
  &&hudSpecialGuest.includes("window.MoonlightTableSave?.guestMet?.(guestId)")
  &&hudSpecialGuest.includes("return UI_TEXT.specialGuestUnknown;")
  &&save.includes("metGuests:{}")
  &&save.includes("base.metGuests=normalizeJournalCollection(raw.metGuests);")
  &&save.includes("guestMet:journalGuestMet,")
  &&story.includes("window.MoonlightTableSave?.recordGuestMeeting?.(guestId,{"),
  "특별 손님 이름은 그 날짜에서 만난 영구 기록이 있을 때만 열리고, 처음 가는 날짜는 ??? 여야 합니다.");

assert(game.includes('nearestStation(state.phase==="night"&&state.carrying?"trash":required)')
  &&game.includes('if(station?.id==="trash"){')
  &&game.includes("discardCarriedDish();")
  &&game.includes('const trash=nearestStation("trash");')
  &&game.includes("text=UI_TEXT.prompt.discard(dish.name);")
  &&game.includes("visibleText=UI_TEXT.prompt.discardVisible;")
  &&game.includes("dom.stationPromptLabel.textContent=visibleText;")
  &&night.includes("function discardCarriedDish(){")
  &&night.includes("order.cookStep=0;")
  &&night.includes("order.cookScores=[];")
  &&night.includes("saveGame(storyCookingIsActive());")
  &&kitchen.includes('if(state.carrying)return s.id==="trash";')
  &&kitchen.includes('const preferred=state.phase==="night"&&state.carrying?"trash":currentRequirement();')
  &&kitchen.includes("function playTrashDiscardAnimation")
  &&hud.includes('discard: name => `E · ${name} 폐기`')
  &&hud.includes('discardVisible: "폐기"')
  &&index.includes('id="stationPromptLabel" class="prompt-label"')
  &&interactionCss.includes(".station-prompt .prompt-label")
  &&!game.includes("autoDelivery();")
  &&!night.includes("function autoDelivery()"),
  "완성 음식은 쓰레기통 가까이에서 E를 눌러 폐기하고 같은 주문을 처음부터 다시 조리해야 합니다.");
assert(miniFrameCss.includes(".mini-overlay.open .mini-stage * {")
  &&miniFrameCss.includes("-webkit-user-select: none;")
  &&miniFrameCss.includes("user-select: none;")
  &&miniFrameCss.includes("touch-action: none;")
  &&miniFrameCss.includes(".mini-overlay.open .mini-stage img,")
  &&miniFrameCss.includes("-webkit-user-drag: none;")
  &&/source\.addEventListener\("pointerdown",event=>\{[\s\S]*?source\.disabled\)return;[\s\S]*?event\.preventDefault\(\);/.test(orderPlace),
  "드래그 미니게임에서는 텍스트 블록 지정과 브라우저 기본 이미지 드래그를 막아야 합니다.");

assert(game.includes("prepTaskScores:{}")
  &&day.includes("state.prepTaskScores[taskId]")
  &&day.includes("const quality=Math.round(taskScores.reduce"),
  "낮 준비 작업 점수를 메뉴 품질 평균으로 저장해야 합니다.");
assert(night.includes("function satisfactionScore(cookScore)")
  &&night.includes("const satisfaction=satisfactionScore(cookScore);")
  &&night.includes("const serviceScore=satisfaction;")
  &&!night.includes("inv.quality"),
  "일반·이야기 손님의 최종 평가는 낮 준비 품질 없이 밤 조리 점수만 사용해야 합니다.");
assert(!night.includes("const expected=satisfactionScore(inv,state.carrying.cookScore);")
  &&!night.includes("${expectedLabel} ${expected}점"),
  "손님 반응 전에 운반 UI가 예상 평가 점수를 공개하면 안 됩니다.");

assert(day.includes("function openMenuSelectionAtFridge()")
  &&game.includes('if(state.phase===GAME_PHASES.MENU_SELECT)return "fridge";')
  &&game.includes("openMenuSelectionAtFridge();")
  &&player.includes('["menuSelect","day","night"]')
  &&kitchen.includes('if(state.phase==="menuSelect")return s.id==="fridge";'),
  "메뉴 선택 단계에는 냉장고까지 이동해 E로 상호작용할 수 있어야 합니다.");
assert(title.includes('dom.menuSelectOverlay.classList.remove("open");'),
  "메뉴 선택 저장을 불러와도 선택창을 자동으로 띄우면 안 됩니다.");

assert(night.includes("function ordersInArrivalOrder()")
  &&night.includes("function syncSelectedOrderToQueue()")
  &&night.includes("const order=alreadyStartedOrder()||ordersInArrivalOrder()[0]||null;")
  &&!night.includes("function selectOrder(")
  &&!night.includes("data-order-id")
  &&!game.includes('["1","2","3","4"].includes(k)')
  &&!index.includes("손님 선택"),
  "손님은 클릭·숫자 선택 없이 실제 도착 순서대로만 처리되어야 합니다.");
assert(customers.includes("const CUSTOMER_SERVICE_Y = toLogic(CHEF_WALK_AREA.bottomY);")
  &&customers.includes("const CUSTOMER_SERVE_REACH = 12;")
  &&game.includes("<=CUSTOMER_SERVE_REACH")
  &&!game.includes("autoDelivery();")
  &&!night.includes("function autoDelivery()"),
  "서빙은 손님 정면에 밀착해 E를 눌렀을 때만 완료되어야 합니다.");
assert(story.includes("function storyGeneralArrivals()")
  &&story.includes("if(!storyOrderDialogueReady(order))return false;")
  &&story.includes('if(state.mini||state.carrying)return false;')
  &&story.includes('if(state.departures?.length)return false;')
  &&night.includes('entryDelay:plan&&plan.triggerTiming!=="before"&&plan.arrival!=="last" ? .65 : 0'),
  "특별 손님은 예약된 도착 순서를 지키고 안전한 FIFO 차례에서만 대화를 시작해야 합니다.");
assert(story.includes('prompt:"어떤 음식을 내줄까?"')
  &&story.includes("order.dishId=chosenDish.id;")
  &&story.includes("order.awaitingDishChoice=false;")
  &&story.includes("scene?.wrongDishSceneId||scene?.missingMenuSceneId"),
  "특별 손님은 준비 메뉴 선택 뒤 그 음식으로 기존 조리를 진행하고 오답은 단서 장면으로 보내야 합니다.");
const serveOrderSource=night.match(/function serveOrder\(order\) \{[\s\S]+?\n\}/)?.[0]||"";
assert(serveOrderSource.includes("const mismatchedStoryDish=storyResult?.matched===false;")
  &&serveOrderSource.includes("if(!isStoryOrder){")
  &&serveOrderSource.includes("bubble:pickGeneralGuestBubble(tier)")
  &&!serveOrderSource.includes("spawnPopup(CUSTOMER_SEATS")
  &&!serveOrderSource.includes("만족도 ${serviceScore}점"),
  "일반 손님 평가는 말풍선으로만 보여 주고 특별 손님은 결과 대화 뒤 같은 반응을 반복하면 안 됩니다.");

assert(dayPrep.includes("현재 작업은 초기화되어 다음에 처음부터 다시 해야 합니다."),
  "준비 미니게임 닫기 안내는 이어하기가 아닌 초기화를 알려야 합니다.");

const dayRules=[...gameData.matchAll(/\b\d:\{day:\d,requiredMenus:\[\],optionalMenus:\[\.\.\.ALL_MENU_IDS\],minSelectedMenus:(\d),maxSelectedMenus:(\d)/g)];
assert(dayRules.length===7&&dayRules.every(match=>match[1]==="5"&&match[2]==="5"),
  "요청에 따라 현재 일차별 조리 메뉴 수는 다섯 개로 유지해야 합니다.");

console.log("GAMEPLAY_FLOW_CONTRACT_OK pause · cook-only evaluation · fridge menu · FIFO story arrival");
