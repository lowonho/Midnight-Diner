"use strict";

// 타이틀 화면과 새 게임/이어하기 화면 전환을 전담합니다.
let titleGameReady=false;
let journalReturnFocus=null;
let journalMode="collection";
let journalPageIndex=0;
let journalPages=[];
let journalWasPaused=false;
const JOURNAL_FOCUSABLE_SELECTOR=[
  "button:not(:disabled)",
  "[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])'
].join(",");
// 인게임 일지는 다시 열었을 때 마지막으로 보던 장을 그대로 펼칩니다.
// (로비 컬렉션은 언제나 첫 장부터입니다.)
let journalLastGameplayPageId="";
/* 프롤로그처럼 "필독"으로 여는 일지입니다. 정해진 장을 한 번씩 다 펼치기
   전에는 닫기 버튼이 딤드로 잠기고, ESC·바깥 클릭도 듣지 않습니다.
   책을 닫는 순간 잠금은 풀리고 다음부터 여는 일지는 평소대로 닫힙니다. */
let journalRequiredReadingGate=false;
const journalReadPageIds=new Set();

function initializeTitleScreen(){
  dom.startButton.disabled=true;
  dom.startButton.textContent="게임 불러오는 중…";
  dom.continueButton.disabled=true;
  dom.startButton.addEventListener("click",startNewGame);
  dom.continueButton.addEventListener("click",continueGame);
  dom.titleSettingsButton.addEventListener("click",()=>openSettings("title"));
  dom.returnTitleButton.addEventListener("click",returnTitle);
  initializeJournalUI();
  updateContinueButton();
}

// 특별 손님 페이지에 초상화처럼 얹는 달빛 조각 그림입니다.
// 파일은 tools/build-moonpiece-webp.js 가 PNG 원본에서 뽑습니다.
const JOURNAL_MOON_PIECE_DIR="assets/customer/Special/MoonPiece";
const JOURNAL_MOON_PIECE_ART=Object.freeze({
  first_raindrop:"01_raindrop_glass_keepsake.webp",
  remaining_warmth:"02_miniature_lantern.webp",
  two_half_names:"03_two_shadows_ornament.webp",
  undelivered_letter:"04_letter_and_crow_feather.webp",
  golden_salt:"05_constellation_pendant.webp",
  eastern_scale:"06_wave_and_fish_frame.webp",
  stopped_minute_hand:"07_stopped_pocket_watch.webp",
  daeuns_tomorrow:"08_faceless_daeun_ribbon.webp"
});

function journalMoonPieceArt(page){
  const file=JOURNAL_MOON_PIECE_ART[String(page?.shardId||"")];
  return file?`${JOURNAL_MOON_PIECE_DIR}/${file}`:"";
}

// 엔딩 장의 가로 직사각형에 깔리는 그 엔딩의 컷씬 그림입니다.
// 파일은 tools/build-story-ending-webp.js 가 PNG 원본에서 뽑습니다.
// 열쇠는 story-data.js 의 TITLE_JOURNAL_ENDING_DEFS 의 id 입니다.
const JOURNAL_ENDING_ART_DIR="assets/story/bg";
const JOURNAL_ENDING_ART=Object.freeze({
  loop_return:"01_loop_daeun_reenters_restaurant_entrance_v3.webp",
  alone_morning:"02_morning_alone_loop_restaurant_unified_v7.webp",
  guests_dawn:"03_guests_dawn_loop_restaurant_unified_v2.webp",
  open_forever:"04_eternally_open_trapped_balanced_texture_v9.webp",
  morning_together:"05_morning_together_restaurant_unified_v2.webp"
});

// 아직 못 본 엔딩은 그림을 숨깁니다. 결말이 미리 보이면 안 됩니다.
function journalEndingArt(page){
  if(!page||page.kind!=="ending"||!page.unlocked)return "";
  const file=JOURNAL_ENDING_ART[String(page.id||"")];
  return file?`${JOURNAL_ENDING_ART_DIR}/${file}`:"";
}

function journalElements(){
  return {
    overlay:document.getElementById("journalOverlay"),
    openButton:document.getElementById("journalButton"),
    gameplayButton:document.getElementById("codexButton"),
    closeButton:document.getElementById("journalClose"),
    modeLabel:document.getElementById("journalModeLabel"),
    title:document.getElementById("journalTitle"),
    description:document.getElementById("journalDescription"),
    page:document.getElementById("journalPage"),
    pageKind:document.getElementById("journalPageKind"),
    pageProgress:document.getElementById("journalPageProgress"),
    pagePortrait:document.getElementById("journalPagePortrait"),
    pageTitle:document.getElementById("journalPageTitle"),
    pageNote:document.getElementById("journalPageNote"),
    pageNoteArt:document.getElementById("journalPageNoteArt"),
    pageArtLeft:document.getElementById("journalPageArtLeft"),
    pageArtRight:document.getElementById("journalPageArtRight"),
    pageMeta:document.getElementById("journalPageMeta"),
    relic:document.getElementById("journalPageRelic"),
    relicArt:document.getElementById("journalPageRelicArt"),
    relicName:document.getElementById("journalPageRelicName"),
    previous:document.getElementById("journalPrevious"),
    next:document.getElementById("journalNext"),
    tabs:document.getElementById("journalSectionTabs"),
    pastTabs:document.getElementById("journalSectionTabsPast")
  };
}

function normalizedJournalPage(page,index,mode){
  const id=String(page?.id||page?.guestId||`page-${index+1}`);
  const label=page?.label||page?.guestName||page?.displayName||page?.title||id;
  const unlocked=page?.unlocked===true||page?.locked===false
    ||Number(page?.level)>0||Number(page?.storyLevel)>0;
  return {...page,id,label,unlocked,mode};
}

function collectionJournalPages(){
  const pages=window.MoonlightTableSave?.collectionPages?.()||[];
  return pages.map((page,index)=>normalizedJournalPage(page,index,"collection"));
}

function gameplayJournalPages(){
  const pages=typeof getGameplayJournalPages==="function"?getGameplayJournalPages():[];
  return (Array.isArray(pages)?pages:[]).map((page,index)=>normalizedJournalPage(page,index,"gameplay"));
}

// 글 없이 원화 두 장만 양면에 채우는 장입니다(주의사항 다음 안내 장).
// 이 장은 머리글·제목·본문이 모두 빠지므로 다른 렌더러도 이 판정을 씁니다.
function journalArtSpread(page){
  if(journalMode!=="gameplay"||page?.pageType!=="guide")return null;
  if(!page.artLeft&&!page.artRight)return null;
  return {left:page.artLeft||"",right:page.artRight||""};
}

function journalPageKindLabel(page){
  if(journalMode==="gameplay"){
    if(page.pageType==="recipe")return "현재 진행 · 음식 레시피";
    return page.dayLabel?`현재 진행 · ${page.dayLabel}`:"현재 진행";
  }
  return page.kind==="ending"?"엔딩":"특별 손님";
}

/* 일지 본문은 굵은 소제목을 쓰려고 HTML 로 그립니다.
   그래서 사람이 쓴 글은 여기를 지나 온 뒤에만 본문에 들어갑니다. */
function journalText(value){
  return String(value).replace(/[&<>]/g,ch=>ch==="&"?"&amp;":ch==="<"?"&lt;":"&gt;");
}

function journalHeading(text){
  return `<b class="journal-note-label">${journalText(text)}</b>`;
}

function journalLines(lines){
  return (lines||[]).map(journalText);
}

function journalField(label,value){
  const text=Array.isArray(value)
    ?value.length?value.join(", "):"없음"
    :value==null||value===""?"???":String(value);
  return `${journalHeading(label)} · ${journalText(text)}`;
}

function journalSection(title,fields){
  return [journalHeading(`[${title}]`),...fields].join("\n");
}

function gameplayJournalRecipeNote(page){
  const prepSteps=(page.prepSteps||[]).map((step,index)=>`${index+1}. ${step}`);
  const cookSteps=(page.cookSteps||[]).map((step,index)=>`${index+1}. ${step}`);
  return [
    journalSection("재료",journalLines([(page.ingredients||[]).join(" · ")||"기록 없음"])),
    journalSection("영업 전 준비",journalLines(prepSteps.length?prepSteps:["기록 없음"])),
    journalSection("주문 후 조리",journalLines(cookSteps.length?cookSteps:["기록 없음"]))
  ].join("\n\n");
}

function firstJournalValue(page,keys,fallback="???"){
  for(const key of keys){
    const value=page?.[key];
    if(value!==undefined&&value!==null&&value!=="")return value;
  }
  return fallback;
}

function journalFirstUnlockLabel(page){
  if(!page.unlocked)return "미달성";
  const timestamp=Number(page.unlockedAt);
  if(!Number.isFinite(timestamp)||timestamp<=0)return "달성 기록 있음";
  return new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"})
    .format(new Date(timestamp));
}

function gameplayJournalEntryNote(entry){
  return [
    journalHeading(`[${entry.guestName}]`),
    entry.clue?journalText(`“${entry.clue}”`):"",
    ...journalLines([entry.dishNote,entry.reactionNote,entry.shardNote].filter(Boolean))
  ].filter(Boolean).join("\n");
}

function journalPageNote(page){
  if(journalArtSpread(page))return "";
  if(journalMode==="gameplay"&&page.pageType==="rules"){
    return journalSection("주의사항",journalLines((page.rules||[]).map((rule,index)=>`${index+1}. ${rule}`)));
  }
  if(journalMode==="gameplay"&&page.pageType==="recipe"){
    return gameplayJournalRecipeNote(page);
  }
  if(journalMode==="gameplay"&&page.pageType==="day"){
    if(!page.recorded||!page.entries?.length)return "";
    return page.entries.map(gameplayJournalEntryNote).join("\n────────\n");
  }
  if(!page.unlocked){
    if(journalMode==="gameplay")return [
      journalSection("손님 정보",[
        journalField("이름","???"),
        journalField("등장","기록 없음"),
        journalField("단서","???"),
        journalField("확인 음식","???"),
        journalField("공개 이야기","???")
      ]),
      journalSection("과거 영업 기록",[
        journalField("이전 회차 평가","평가 기록 없음"),
        journalField("이전 회차 부분 조각","없음"),
        journalField("이전 회차 완전 조각","없음"),
        journalField("본 장면","없음")
      ]),
      journalSection("현재 회차",[
        journalField("방문","미방문"),
        journalField("평가","평가 기록 없음"),
        journalField("조각 상태","미획득"),
        journalField("조각명","???")
      ])
    ].join("\n\n");
    if(journalMode==="collection"&&page.kind==="ending")return [
      journalField("엔딩 번호",page.number),
      journalField("엔딩 제목","???"),
      journalField("요약","???"),
      journalField("마지막 대사","???"),
      journalField("최초 달성","미달성")
    ].join("\n");
    return [
      journalField("손님 이름","???"),
      journalField("기억하는 음식","???"),
      journalField("좋아한 스타일","???"),
      journalField("완성된 손님 이야기","???"),
      journalField("남긴 달빛 조각","???"),
      journalField("진엔딩 이후 후일담","???")
    ].join("\n");
  }
  if(journalMode==="collection"&&page.kind==="ending"){
    return [
      journalField("엔딩 번호",page.number),
      journalField("요약",page.summary),
      journalField("마지막 대사",page.lastLine?`“${page.lastLine}”`:"???"),
      journalField("최초 달성",journalFirstUnlockLabel(page))
    ].join("\n");
  }
  if(journalMode==="collection"){
    // 타이틀의 영구 컬렉션도 진행용 날짜 장과 같은 다섯 줄로 읽힙니다.
    // 값은 진행 세이브가 아니라 save.js가 완벽 달성 때 남긴 영구 snapshot입니다.
    const guestRecord=gameplayJournalEntryNote({
      guestName:page.guestName||page.displayName||page.label,
      clue:page.clue,
      dishNote:page.dishNote,
      reactionNote:page.reactionNote,
      shardNote:page.shardNote
    });
    return [
      guestRecord,
      journalSection("진엔딩 이후 후일담",[page.epilogueUnlocked?page.epilogue:"???"])
    ].join("\n\n");
  }
  return [
    journalSection("손님 정보",[
      journalField("이름",page.guestName),
      journalField("등장",page.appearance),
      journalField("단서",page.clue),
      journalField("확인 음식",page.confirmedDish),
      journalField("공개 이야기",page.revealedStory)
    ]),
    journalSection("과거 영업 기록",[
      journalField("이전 회차 평가",firstJournalValue(page,["previousLoopEvaluation","previousEvaluation","pastEvaluation"])),
      journalField("이전 회차 부분 조각",firstJournalValue(page,["previouslyObtainedPartial","previousPartialStory","pastPartialStory"])),
      journalField("이전 회차 완전 조각",firstJournalValue(page,["previouslyObtainedFull","previousCompleteStory","pastCompleteStory"])),
      journalField("본 장면",firstJournalValue(page,["seenStoryScenes","previousSeenScene","pastSeenScene"])),
    ]),
    journalSection("현재 회차",[
      journalField("방문",firstJournalValue(page,["currentLoopVisited","currentVisit","visitStatus"])),
      journalField("평가",firstJournalValue(page,["currentLoopEvaluation","currentEvaluation","latestEvaluation"])),
      journalField("조각 상태",firstJournalValue(page,["currentFragmentState","currentShardStatus","shardStatus"])),
      journalField("조각명",firstJournalValue(page,["currentFragmentName","currentShardName","shardName"]))
    ])
  ].join("\n\n");
}

function journalPageMeta(page){
  if(journalArtSpread(page))return "";
  if(!page.unlocked)return "잠긴 페이지";
  const items=[];
  if(journalMode==="gameplay"){
    if(page.pageType==="rules")return "음식 레시피 8개\n날짜별 기록 7일";
    if(page.pageType==="recipe")return `재료 ${(page.ingredients||[]).length}가지 · 준비 ${(page.prepSteps||[]).length}단계 · 조리 ${(page.cookSteps||[]).length}단계`;
    if(page.pageType==="day")return page.recorded?`${page.entries.length}명의 손님이 남긴 기록`:"";
    if(page.confirmedDish&&page.confirmedDish!=="???")items.push(`확인한 음식 · ${page.confirmedDish}`);
    if(page.currentLoopEvaluation&&page.currentLoopEvaluation!=="미평가"){
      items.push(`현재 평가 · ${page.currentLoopEvaluation}`);
    }
    items.push(`현재 조각 · ${page.currentFragmentState||"미획득"}`);
    return items.join("  ·  ");
  }
  if(journalMode==="collection"&&page.dayLabel)items.push(page.dayLabel);
  if(journalMode==="collection"&&page.dishName)items.push(`찾는 음식 · ${page.dishName}`);
  else if(page.confirmedDish&&page.confirmedDish!=="???")items.push(`확인한 음식 · ${page.confirmedDish}`);
  if(page.latestEvaluation&&page.latestEvaluation!=="평가 기록 없음")items.push(page.latestEvaluation);
  // 달빛 조각 이름은 그림 밑에 이미 적혀 있어서, 그림이 붙는 장에서는 뺍니다.
  if(!journalRelicVisible(page)){
    if(page.shardName&&(journalMode==="collection"||page.shardOwned))items.push(`달빛 조각 · ${page.shardName}`);
    else if(page.shardStatus)items.push(`달빛 조각 · ${page.shardStatus}`);
  }
  if(page.day&&!page.dayLabel)items.push(`DAY ${page.day}`);
  return items.join("  ·  ")||"기록 완료";
}

// 일지 오른쪽에 붙는 견출지입니다. 인게임은 주의사항·요리·일기 세 장,
// 로비 컬렉션은 특별 손님·엔딩 두 장입니다.
function journalSectionDefs(){
  if(journalMode==="gameplay")return [
    // 안내 장(guide)은 주의사항 바로 다음 장이라 견출지를 따로 만들지 않고
    // 주의사항 구역에 함께 묶습니다. 넘겨도 견출지가 그대로 켜져 있습니다.
    {id:"rules",label:"주의사항",matches:page=>page.pageType==="rules"||page.pageType==="guide"},
    {id:"recipe",label:"레시피",matches:page=>page.pageType==="recipe"},
    {id:"day",label:"일기",matches:page=>page.pageType==="day"}
  ];
  return [
    {id:"guest",label:"특별 손님",matches:page=>page.kind!=="ending"},
    {id:"ending",label:"엔딩",matches:page=>page.kind==="ending"}
  ];
}

// slot 은 견출지가 붙는 세로 자리입니다. 왼쪽으로 넘어가도 같은 높이에
// 남아 있어야 책장을 넘긴 것처럼 보여서, 구역 순서를 그대로 씁니다.
function journalSections(){
  return journalSectionDefs().map((section,slot)=>{
    const indexes=journalPages.reduce((collected,page,index)=>{
      if(section.matches(page))collected.push(index);
      return collected;
    },[]);
    return {...section,slot,indexes,first:indexes.length?indexes[0]:-1};
  }).filter(section=>section.first>=0);
}

function journalActiveSectionSlot(sections){
  const current=sections.find(section=>section.indexes.includes(journalPageIndex));
  if(current)return current.slot;
  return sections.length?sections[sections.length-1].slot:0;
}

// 요리 견출지는 첫 요리로, 일기 견출지는 지금 진행 중인 날짜로 펼칩니다.
function journalSectionEntryIndex(section){
  if(journalMode==="gameplay"&&section.id==="day"){
    const day=Math.max(1,Math.floor(Number(typeof state!=="undefined"?state.day:1)||1));
    const matched=section.indexes.find(index=>Number(journalPages[index]?.day)===day);
    if(matched!==undefined)return matched;
  }
  return section.first;
}

function createJournalSectionTab(section,activeSlot){
  const button=document.createElement("button");
  button.type="button";
  button.className=`journal-section-tab is-${section.id}`;
  button.classList.toggle("is-active",section.slot===activeSlot);
  button.classList.toggle("is-past",section.slot<activeSlot);
  button.classList.toggle("is-new",section.indexes.some(index=>journalPages[index]?.notificationPending));
  button.style.setProperty("--journal-tab-slot",String(section.slot));
  button.textContent=section.label;
  button.title=section.label;
  button.setAttribute("role","tab");
  button.setAttribute("aria-selected",String(section.slot===activeSlot));
  button.setAttribute("aria-label",`${section.label} 구역 펼치기`);
  button.addEventListener("click",()=>selectJournalPage(journalSectionEntryIndex(section),true));
  return button;
}

function renderJournalTabs(elements){
  if(!elements.tabs&&!elements.pastTabs)return;
  const sections=journalSections();
  const activeSlot=journalActiveSectionSlot(sections);
  const build=list=>list.map(section=>createJournalSectionTab(section,activeSlot));
  elements.pastTabs?.replaceChildren(...build(sections.filter(section=>section.slot<activeSlot)));
  elements.tabs?.replaceChildren(...build(sections.filter(section=>section.slot>=activeSlot)));
}

// 제목 아래에 그림 한 장이 더 붙는 장이 둘 있습니다.
//   relic — 로비 컬렉션 특별 손님 장의 달빛 조각 (엔딩 장에는 없습니다)
//   dish  — 인게임 레시피 장의 음식 프롭 (이름은 제목에 이미 있어 캡션 없음)
function journalFigure(page){
  if(journalMode==="collection"&&!!page&&page.kind!=="ending"&&journalMoonPieceArt(page)){
    return {kind:"relic",src:journalMoonPieceArt(page)};
  }
  if(journalMode==="gameplay"&&page?.pageType==="recipe"&&typeof foodPropUrl==="function"){
    // 레시피 장은 아직 조리 전이라, 메뉴판 카드와 같은 기본 등급(normal)입니다.
    // 잘 만든 모습(perfect)을 미리 보여 주면 목표를 앞질러 알려 주는 셈입니다.
    const src=foodPropUrl(page.dishId);
    if(src)return {kind:"dish",src};
  }
  return null;
}

// 달빛 조각 이름은 요약 줄에서 빼야 하므로 그 장인지만 따로 봅니다.
function journalRelicVisible(page){
  return journalFigure(page)?.kind==="relic";
}

function renderJournalRelic(elements,page){
  if(!elements.relic)return;
  const figure=journalFigure(page);
  elements.relic.hidden=!figure;
  // 조각 장은 표제 면에 초상화까지 둘이 들어가서 그 장만 자리를 좁힙니다.
  // 레시피 장은 그림이 가로로 납작해 좁히지 않아도 들어갑니다.
  elements.page?.classList.toggle("has-relic",figure?.kind==="relic");
  elements.page?.classList.toggle("has-dish",figure?.kind==="dish");
  elements.relic.classList.toggle("is-dish",figure?.kind==="dish");
  if(!figure){
    elements.relicArt.style.backgroundImage="";
    return;
  }
  // 잠긴 손님은 그림 대신 자리만 남깁니다. 조각 모양이 미리 보이면 안 됩니다.
  const unlocked=figure.kind!=="relic"||!!page.unlocked;
  elements.relic.classList.toggle("is-locked",!unlocked);
  elements.relicArt.style.backgroundImage=unlocked?`url("${figure.src}")`:"";
  elements.relicArt.textContent=unlocked?"":"?";
  elements.relicName.textContent=figure.kind!=="relic"?""
    :unlocked?`「${page.shardName}」`:"「???」";
}

// 양면 그림 장에서만 두 면의 그림을 켭니다. 그림 주소는 페이지 자료가
// 들고 있고(story.js), 켜는 순간 .is-art-spread 가 글자 자리를 통째로 비웁니다.
// 인라인 style 의 url() 은 스타일시트가 아니라 문서(index.html) 기준이라
// assets/ 로 시작하는 주소를 그대로 씁니다.
function renderJournalArtSpread(elements,page){
  const spread=journalArtSpread(page);
  elements.page?.classList.toggle("is-art-spread",!!spread);
  const apply=(node,src)=>{
    if(!node)return;
    node.hidden=!src;
    node.style.backgroundImage=src?`url("${src}")`:"";
  };
  apply(elements.pageArtLeft,spread?.left);
  apply(elements.pageArtRight,spread?.right);
}

function renderJournalPage({acknowledge=false}={}){
  const elements=journalElements();
  const page=journalPages[journalPageIndex]||null;
  if(!page){
    elements.pageKind.textContent="영업일지";
    elements.pageProgress.textContent="0 / 0";
    elements.pageTitle.textContent="표시할 기록이 없습니다.";
    elements.pageNote.textContent="이야기가 시작되면 이곳에 기록이 생깁니다.";
    if(elements.pageNoteArt)elements.pageNoteArt.hidden=true;
    renderJournalArtSpread(elements,null);
    elements.pageMeta.textContent="";
    elements.pagePortrait.textContent="?";
    elements.previous.disabled=true;elements.next.disabled=true;
    renderJournalRelic(elements,null);
    renderJournalTabs(elements);
    updateJournalCloseLock();
    return;
  }
  // 지금 펼친 장은 읽은 것으로 칩니다(필독으로 열었을 때만 셉니다).
  if(journalRequiredReadingGate)journalReadPageIds.add(page.id);
  const isGameplayRecord=journalMode==="gameplay";
  elements.page.classList.toggle("is-locked",!page.unlocked);
  elements.page.classList.toggle("is-ending",page.kind==="ending");
  elements.page.classList.toggle("is-gameplay-page",isGameplayRecord);
  elements.pageKind.textContent=journalPageKindLabel(page);
  elements.pageProgress.textContent=`${journalPageIndex+1} / ${journalPages.length}`;
  const portraitRow=Number(page.portraitRow);
  const isGuestPortrait=!isGameplayRecord&&page.kind!=="ending";
  const hasPortrait=isGuestPortrait&&Number.isFinite(portraitRow)&&portraitRow>=0&&portraitRow<=5;
  elements.pagePortrait.classList.toggle("has-portrait",hasPortrait);
  elements.pagePortrait.classList.toggle("portrait-placeholder",isGuestPortrait&&!hasPortrait);
  elements.pagePortrait.classList.toggle("journal-page-icon",isGameplayRecord);
  // 인게임 세 구역은 각자 원화 액자를 씁니다.
  const frame=!isGameplayRecord?""
    :page.pageType==="rules"?"rules"
      :page.pageType==="recipe"?"recipe"
        :page.pageType==="day"?"day":"";
  elements.pagePortrait.classList.toggle("has-frame",!!frame);
  elements.pagePortrait.classList.toggle("frame-rules",frame==="rules");
  elements.pagePortrait.classList.toggle("frame-recipe",frame==="recipe");
  elements.pagePortrait.classList.toggle("frame-day",frame==="day");
  if(hasPortrait){
    const row=Math.floor(portraitRow);
    elements.pagePortrait.style.setProperty("--journal-portrait-y",row===5?"100%":`${row*20}%`);
  }
  // 본 엔딩은 ☾ 자리에 그 엔딩의 컷씬 그림이 대신 들어갑니다.
  const endingArt=journalEndingArt(page);
  elements.pagePortrait.classList.toggle("has-cutscene",!!endingArt);
  elements.pagePortrait.style.backgroundImage=endingArt?`url("${endingArt}")`:"";
  elements.pagePortrait.textContent=!page.unlocked
    ?"?"
    :isGameplayRecord?page.pageType==="rules"?"!":page.pageType==="recipe"?String(page.recipeNumber||"·"):String(page.day||"·")
      :page.kind==="ending"?endingArt?"":"☾":"";
  elements.pageTitle.textContent=page.unlocked?page.label:"잠긴 기록";
  elements.pageNote.innerHTML=journalPageNote(page);
  // 주의사항 장에만 마지막 줄 아래 손글씨가 붙습니다. 레시피·일기 장은
  // 글이 종이를 거의 다 채워서 그림이 들어갈 자리가 없습니다.
  if(elements.pageNoteArt)elements.pageNoteArt.hidden=!(isGameplayRecord&&page.pageType==="rules");
  // 요약이 여러 줄이면(주의사항 장) 줄바꿈을 그대로 살립니다. 한 줄짜리
  // 요약은 '  ·  ' 간격을 그대로 두려고 기본 줄바꿈 규칙을 씁니다.
  const metaText=journalPageMeta(page);
  elements.pageMeta.classList.toggle("is-multiline",metaText.includes("\n"));
  elements.pageMeta.textContent=metaText;
  renderJournalRelic(elements,page);
  renderJournalArtSpread(elements,page);
  elements.previous.disabled=journalPageIndex<=0;
  elements.next.disabled=journalPageIndex>=journalPages.length-1;
  if(isGameplayRecord)journalLastGameplayPageId=page.id;
  renderJournalTabs(elements);
  updateJournalCloseLock();
  if(acknowledge&&journalMode==="collection"&&page.unlocked&&page.notificationPending){
    page.notificationPending=false;
    window.MoonlightTableSave?.acknowledgeUnlock?.(page.kind,page.id);
  }
}

function selectJournalPage(index,acknowledge=false){
  if(!journalPages.length)return false;
  const nextIndex=Math.max(0,Math.min(journalPages.length-1,Number(index)||0));
  const changed=nextIndex!==journalPageIndex;
  journalPageIndex=nextIndex;
  renderJournalPage({acknowledge});
  if(changed)audio?.play?.("journal_page_turn",{gain:.9});
  return true;
}

/* ── 필독 잠금 ────────────────────────────────────────────────
   프롤로그에서 처음 펼치는 영업일지는 규칙을 다 읽기 전에 덮을 수 없습니다.
   필독은 주의사항 구역까지입니다 — 주의사항 장과 그 다음 안내 장 두 장이고,
   견출지로도 한 구역으로 묶여 있습니다(journalSectionDefs 의 rules 참고).
   레시피·일기 장은 언제든 읽으면 되는 자료라 잠금에 넣지 않습니다. */
function journalPageNeedsReading(page){
  return page?.pageType==="rules"||page?.pageType==="guide";
}

function journalUnreadPageCount(){
  if(!journalRequiredReadingGate)return 0;
  return journalPages.filter(page=>journalPageNeedsReading(page)&&!journalReadPageIds.has(page.id)).length;
}

function journalCloseLocked(){return journalRequiredReadingGate&&journalUnreadPageCount()>0;}

// 잠긴 동안에는 왜 못 닫는지 제목 옆 안내문이 대신 알려 줍니다.
function journalDescriptionText(){
  if(journalRequiredReadingGate){
    const remaining=journalUnreadPageCount();
    return remaining>0
      ?`주의사항을 끝까지 읽어야 일지를 덮을 수 있습니다. (아직 ${remaining}장 남았습니다)`
      :"주의사항을 다 읽었습니다. 이제 영업일지를 덮을 수 있습니다.";
  }
  return journalMode==="gameplay"
    ?"첫 장에는 영업 규칙이, 음식 장에는 레시피가, 날짜 장에는 직접 만난 뒤의 기록만 남습니다."
    :"특별 손님 8장과 엔딩 5장은 새로운 플레이에서도 남습니다.";
}

// 닫기 버튼은 남은 장이 있는 동안 딤드로 잠깁니다. 눌리지 않으므로 클릭으로
// 닫힐 일이 없고, ESC·바깥 클릭은 closeJournal 쪽에서 함께 막습니다.
function updateJournalCloseLock(){
  const elements=journalElements();
  const remaining=journalUnreadPageCount();
  const locked=journalRequiredReadingGate&&remaining>0;
  if(elements.closeButton){
    // 딤드 모양은 CSS 의 .journal-close:disabled 하나가 맡습니다.
    elements.closeButton.disabled=locked;
    elements.closeButton.title=locked
      ?`주의사항이 아직 ${remaining}장 남았습니다.`
      :"영업일지 닫기";
  }
  if(elements.description)elements.description.textContent=journalDescriptionText();
}

function refreshJournalUI({restoreLastPage=false}={}){
  const elements=journalElements();
  journalPages=journalMode==="gameplay"?gameplayJournalPages():collectionJournalPages();
  if(restoreLastPage&&journalLastGameplayPageId){
    const lastIndex=journalPages.findIndex(page=>page.id===journalLastGameplayPageId);
    if(lastIndex>=0)journalPageIndex=lastIndex;
  }
  journalPageIndex=Math.max(0,Math.min(journalPageIndex,Math.max(0,journalPages.length-1)));
  elements.modeLabel.textContent=journalMode==="gameplay"?"CURRENT SAVE":"PERMANENT COLLECTION";
  elements.description.textContent=journalDescriptionText();
  renderJournalPage();
}

function journalOverlayIsOpen(){
  return !!journalElements().overlay?.classList.contains("open");
}

function journalFocusableElements(){
  const overlay=journalElements().overlay;
  if(!overlay)return [];
  return [...overlay.querySelectorAll(JOURNAL_FOCUSABLE_SELECTOR)]
    .filter(element=>!element.hidden&&element.getClientRects().length>0);
}

function focusFirstJournalControl(){
  const elements=journalElements();
  const preferred=!elements.closeButton?.disabled&&!elements.closeButton?.hidden
    ?elements.closeButton
    :journalFocusableElements()[0];
  preferred?.focus?.({preventScroll:true});
}

function setJournalBackgroundInert(inert){
  if(typeof setModalBackgroundInert==="function"){
    setModalBackgroundInert("journal",inert);
    return;
  }
  // game.js가 아직 초기화되지 않은 매우 이른 호출에서도 최소한 배경을 잠급니다.
  [document.getElementById("titleScreen"),document.getElementById("gameScreen")]
    .forEach(screen=>inert?screen?.setAttribute("inert",""):screen?.removeAttribute("inert"));
}

function resetGameplayJournalView(){
  journalLastGameplayPageId="";
  journalPageIndex=0;
}

function openJournal(mode="collection",{requireReading=false}={}){
  if(journalOverlayIsOpen())return false;
  journalMode=mode==="gameplay"?"gameplay":"collection";
  journalPageIndex=0;
  // 필독으로 여는 일지는 펼칠 때마다 읽은 장 표시를 처음부터 다시 셉니다.
  journalRequiredReadingGate=!!requireReading&&journalMode==="gameplay";
  journalReadPageIds.clear();
  const elements=journalElements();
  if(!elements.overlay){journalRequiredReadingGate=false;return false;}
  journalReturnFocus=typeof document.activeElement?.focus==="function"
    ?document.activeElement
    :elements.openButton;
  if(journalMode==="gameplay"&&typeof state!=="undefined"){
    journalWasPaused=!!state.paused;
    state.paused=true;
    audio?.pauseLoops?.();
  }
  if(typeof resetPlayerKeyboardInput==="function")resetPlayerKeyboardInput();
  else window.clearPhysicalMoveKeys?.();
  // 필독으로 열 때는 마지막으로 보던 장이 아니라 언제나 첫 장부터 펼칩니다.
  if(journalRequiredReadingGate)resetGameplayJournalView();
  refreshJournalUI({restoreLastPage:journalMode==="gameplay"});
  setJournalBackgroundInert(true);
  elements.overlay.classList.add("open");
  elements.overlay.setAttribute("aria-hidden","false");
  focusFirstJournalControl();
  renderJournalPage({acknowledge:true});
  return true;
}

function openTitleJournal(){return openJournal("collection");}
function openGameplayJournal(){return openJournal("gameplay");}
function openGameplayJournalPage(pageId){
  journalLastGameplayPageId=String(pageId||"");
  return openJournal("gameplay");
}
// 프롤로그에서 처음 펼치는 영업일지입니다. 주의사항 구역(주의사항 장 + 다음
// 안내 장)을 다 펼쳐 보기 전에는 닫기 버튼이 딤드로 잠깁니다(SCN-P04).
// 다만 2회차부터는 이미 다 읽은 규칙이라 잠그지 않고 언제든 덮게 둡니다.
function journalRequiredReadingActive(){
  const loop=Math.floor(Number(typeof state!=="undefined"?state?.story?.loop:1)||1);
  return loop<=1;
}
function openGameplayJournalRequiredReading(){
  return openJournal("gameplay",{requireReading:journalRequiredReadingActive()});
}

function closeJournal(){
  const elements=journalElements();
  if(!elements.overlay?.classList.contains("open"))return false;
  /* 필독으로 연 일지는 남은 장이 있으면 여기서 막힙니다. 닫기 버튼은 이미
     딤드로 잠겨 눌리지 않고, ESC·바깥 클릭이 이 길로 들어옵니다. */
  if(journalCloseLocked()){updateJournalCloseLock();return false;}
  journalRequiredReadingGate=false;
  journalReadPageIds.clear();
  updateJournalCloseLock();
  const resumeStory=journalMode==="gameplay"
    &&typeof resumeStoryAfterJournal==="function";
  elements.overlay.classList.remove("open");
  elements.overlay.setAttribute("aria-hidden","true");
  setJournalBackgroundInert(false);
  if(journalMode==="gameplay"&&typeof state!=="undefined"){
    state.paused=journalWasPaused||state.phase===GAME_PHASES.RESULT
      ||(typeof storyDialogueIsActive==="function"&&storyDialogueIsActive());
    if(!state.paused)audio?.resumeLoops?.();
  }
  if(journalReturnFocus?.isConnected&&!journalReturnFocus.hidden
    &&!journalReturnFocus.closest?.("[inert]")){
    journalReturnFocus.focus?.({preventScroll:true});
  }else if(elements.overlay.contains(document.activeElement)){
    document.activeElement?.blur?.();
  }
  journalReturnFocus=null;
  if(resumeStory)setTimeout(resumeStoryAfterJournal,0);
  return true;
}

function initializeJournalUI(){
  const elements=journalElements();
  if(!elements.overlay||elements.overlay.dataset.initialized==="true")return;
  elements.overlay.dataset.initialized="true";
  elements.openButton?.addEventListener("click",openTitleJournal);
  elements.gameplayButton?.addEventListener("click",openGameplayJournal);
  elements.closeButton?.addEventListener("click",closeJournal);
  elements.previous?.addEventListener("click",()=>selectJournalPage(journalPageIndex-1,true));
  elements.next?.addEventListener("click",()=>selectJournalPage(journalPageIndex+1,true));
  elements.overlay.addEventListener("click",event=>{
    if(event.target===elements.overlay)closeJournal();
  });
  document.addEventListener("keydown",event=>{
    if(!journalOverlayIsOpen())return;
    if(event.key==="Escape"){
      event.preventDefault();
      event.stopImmediatePropagation();
      closeJournal();
      return;
    }
    if(event.key==="Tab"){
      const focusable=journalFocusableElements();
      if(!focusable.length){event.preventDefault();return;}
      const first=focusable[0],last=focusable[focusable.length-1];
      if(!elements.overlay.contains(document.activeElement)){
        event.preventDefault();
        (event.shiftKey?last:first).focus();
      }else if(event.shiftKey&&document.activeElement===first){
        event.preventDefault();last.focus();
      }else if(!event.shiftKey&&document.activeElement===last){
        event.preventDefault();first.focus();
      }
      return;
    }
    if(!elements.overlay.contains(event.target)){
      event.preventDefault();
      event.stopImmediatePropagation();
      focusFirstJournalControl();
    }
  },true);
  ["pointerdown","click"].forEach(type=>document.addEventListener(type,event=>{
    if(!journalOverlayIsOpen()||elements.overlay.contains(event.target))return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true));
  document.addEventListener("focusin",event=>{
    if(journalOverlayIsOpen()&&!elements.overlay.contains(event.target))focusFirstJournalControl();
  },true);
  refreshJournalUI();
}

window.refreshJournalUI=refreshJournalUI;
window.openJournal=openJournal;
window.openTitleJournal=openTitleJournal;
window.openGameplayJournal=openGameplayJournal;
window.openGameplayJournalPage=openGameplayJournalPage;
window.openGameplayJournalRequiredReading=openGameplayJournalRequiredReading;

function savePhaseLabel(phase){
  return phase===GAME_PHASES.MENU_SELECT?"메뉴 선택":phase===GAME_PHASES.INGREDIENT_SELECT?"재료 고르기":phase===GAME_PHASES.PREP?"낮 준비":phase===GAME_PHASES.OPEN?"밤 영업":"영업 마감";
}

function updateContinueButton(){
  const slots=readAllSaveSlots();
  const saves=slots.filter(slot=>slot.data);
  const latest=saves.reduce((current,slot)=>
    !current||slot.data.savedAt>current.data.savedAt?slot:current
  ,null);
  dom.continueButton.disabled=!titleGameReady||!saves.length;
  dom.continueButton.textContent="이어하기";
  if(!latest){dom.saveInfo.textContent="저장 데이터가 없습니다.";return;}
  dom.saveInfo.textContent=`저장 ${saves.length}/4 · 최근 DAY ${latest.data.state.day} · ${savePhaseLabel(latest.data.state.phase)}`;
}

function markTitleGameReady(){
  titleGameReady=true;
  dom.startButton.disabled=false;
  dom.startButton.textContent="새 게임";
  updateContinueButton();
  setTimeout(showPendingEndingRetryCheckpoint,0);
}

function markTitleLoadFailed(){
  titleGameReady=false;
  dom.startButton.disabled=true;
  dom.startButton.textContent="에셋 로딩 실패";
  dom.continueButton.disabled=true;
  dom.pauseMessage.textContent="게임 이미지를 불러오지 못했습니다. 파일 위치를 확인해 주세요.";
}

function openGameScreen(){
  dom.settingsOverlay.classList.remove("open");dom.miniOverlay.classList.remove("open");
  dom.titleScreen.classList.remove("active");dom.gameScreen.classList.add("active");
  requestAnimationFrame(()=>phaserScene?.scale.refresh());showGameHud(true);
}

function sameEndingRetryAction(left,right){
  return !!left&&!!right
    &&left.type==="endingRetryMenu"
    &&right.type==="endingRetryMenu"
    &&left.judgementSceneId===right.judgementSceneId
    &&left.endingSceneId===right.endingSceneId
    &&(left.acceptPolicy||"nextLoop")===(right.acceptPolicy||"nextLoop");
}

function showPendingEndingRetryCheckpoint(){
  const checkpoint=window.MoonlightTableSave?.readEndingRetryCheckpoint?.();
  if(!checkpoint)return false;
  const shown=typeof showEndingRetryMenu==="function"
    &&showEndingRetryMenu(checkpoint.action,{restoredCheckpoint:true});
  if(!shown)window.MoonlightTableSave?.clearEndingRetryCheckpoint?.();
  return !!shown;
}

// 숨은 엔딩 체크포인트는 이어하기 슬롯으로 취급하지 않습니다. 사용자가 엔딩
// 결론창의 버튼을 눌렀을 때만 게임 상태를 복원하고 실제 게임 화면으로 전환합니다.
function restoreEndingRetryCheckpointGame(expectedAction){
  const checkpoint=window.MoonlightTableSave?.readEndingRetryCheckpoint?.();
  if(!checkpoint||!sameEndingRetryAction(checkpoint.action,expectedAction))return false;
  try{restoreGameState(checkpoint.saveData);}
  catch(error){
    console.warn("엔딩 재시도 상태를 복원하지 못했습니다.",error);
    window.MoonlightTableSave?.clearEndingRetryCheckpoint?.();
    return false;
  }

  audio.init();if(audio.ctx?.state==="suspended")audio.ctx.resume();audio.apply();syncAudioControls();
  dom.settingsOverlay.classList.remove("open");
  dom.miniOverlay.classList.remove("open");
  dom.resultOverlay.classList.remove("open");
  dom.menuSelectOverlay.classList.remove("open");
  dom.ingredientSelectOverlay.classList.remove("open");
  buildMenuCards();openGameScreen();updateUI(true);syncPhaserObjects();audio.startBgm();
  return true;
}

function continueGame(){
  if(!hasAnySaveData()){updateContinueButton();return;}
  openSaveSlotDialog("load","title",dom.continueButton);
}

function loadGameFromSlot(slotId=AUTO_SAVE_SLOT){
  const data=readSaveData(slotId);if(!data){updateContinueButton();return false;}
  restoreGameState(data);

  audio.init();if(audio.ctx?.state==="suspended")audio.ctx.resume();audio.apply();syncAudioControls();
  dom.settingsOverlay.classList.remove("open");dom.miniOverlay.classList.remove("open");
  dom.resultOverlay.classList.toggle("open",state.phase==="result");
  // 메뉴 선택 단계의 저장을 불러와도 냉장고 앞 상호작용부터 다시 시작합니다.
  dom.menuSelectOverlay.classList.remove("open");
  dom.ingredientSelectOverlay.classList.toggle("open",state.phase===GAME_PHASES.INGREDIENT_SELECT);
  buildMenuCards();openGameScreen();updateUI(true);syncPhaserObjects();
  if(state.phase==="result")renderNightResult();
  else audio.startBgm();
  setTimeout(resumeStoryForCurrentPhase,0);
  return true;
}

function startNewGame(){
  if(readSaveData(AUTO_SAVE_SLOT)&&!window.confirm("자동 저장을 새 게임으로 교체할까요?\n수동 저장 3칸은 그대로 유지됩니다."))return;
  window.MoonlightTableSave?.clearEndingRetryCheckpoint?.();
  if(typeof closeEndingRetryMenu==="function")closeEndingRetryMenu();
  clearSaveData(AUTO_SAVE_SLOT);clearStoryRuntime();resetGameplayJournalView();startGame();saveGame(true);updateContinueButton();
}

function startGame(){
  audio.init();if(audio.ctx?.state==="suspended")audio.ctx.resume();
  state.screen="game";state.phase=GAME_PHASES.PREP;state.paused=false;state.settingsFrom="game";
  state.day=DayManager.setDay(1);state.money=0;state.popularity=0;state.story=createStoryState();state.departures=[];nextOrderId=1;resetDay(true);
  openGameScreen();queueStoryMoments(["newGame","dayStart"]);
  audio.startBgm();
}

function returnTitle(){
  if(state.mini||state.story?.activeStoryCook||state.phase===GAME_PHASES.INGREDIENT_SELECT){
    showToast("진행 중인 미니게임을 마친 뒤 타이틀로 돌아갈 수 있습니다.",true);
    return;
  }
  if(!saveGame(true)){
    showToast("자동 저장에 실패해 타이틀로 이동하지 않았습니다.",true);
    return;
  }
  // 캡처 단계에서 막 재생한 타이틀 복귀 클릭음은 남기고 조리음만 정리합니다.
  audio.stopAllFiles?.("ui_click");
  clearStoryRuntime();state.screen="title";state.paused=true;state.mini=null;
  stopIngredientTimer();
  dom.settingsOverlay.classList.remove("open");dom.resultOverlay.classList.remove("open");dom.miniOverlay.classList.remove("open");dom.menuSelectOverlay.classList.remove("open");dom.ingredientSelectOverlay.classList.remove("open");
  dom.gameScreen.classList.remove("active");dom.titleScreen.classList.add("active");
  showGameHud(false);audio.stopBgm();updateContinueButton();
}
