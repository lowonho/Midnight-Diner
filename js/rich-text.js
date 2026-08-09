"use strict";

/* ============================================================
   「 」 강조 → 굵은 글씨
   ------------------------------------------------------------
   담당 범위: 화면에 이미 나온 글자 중 「…」 로 감싼 부분을 굵은 글씨로
              바꿔 다는 일 하나뿐입니다. 대사·영업일지·토스트·선택지·
              좌우 패널·정산창 등 HTML 로 그리는 글자 전부에 걸립니다.

   담당 범위가 아님: 무슨 글자를 언제 띄울지 → story.js / title.js / game.js …

   [글쓴이가 알아야 할 것] 데이터에 그냥 「단어」 라고 적으면 됩니다.
   따로 태그를 달거나 함수를 부를 필요가 없습니다.

   ------------------------------------------------------------
   [왜 각 파일을 고치지 않고 여기 한 곳에 몰았나]
   글자를 화면에 다는 곳이 story.js·title.js·game.js·day.js·night.js·
   save.js 에 흩어져 있고, 그중 상당수가 게임 로직과 같은 함수 안에
   있습니다. 그 파일들을 건드리지 않으려고, 이미 화면에 붙은 글자를
   뒤에서 한 번 훑는 방식(MutationObserver)을 씁니다. 이 파일과
   index.html 의 <script> 한 줄만 지우면 원래대로 돌아갑니다.
   settings-ui.js / hud-list-drag-scroll.js 와 같은 "표시 전용" 부류입니다.

   [textContent 는 그대로입니다] 「」 를 지우지 않고 <b> 로 감싸기만 하므로
   element.textContent 로 읽는 값이 예전과 한 글자도 다르지 않습니다.
   글자 폭을 재는 코드(story.js 의 자막 쪽수 계산)나 계약 테스트가
   영향을 받지 않는 이유입니다.

   [괄호를 남기는 이유] 「영업일지」라고 적힌 낡은 장부 처럼, 지금 글에서
   「」 는 강조인 동시에 따옴표 노릇을 합니다. 괄호를 지우면 문장이
   읽히지 않습니다. 굵기만 얹고 글자는 건드리지 않습니다.
   괄호를 감추고 싶어지면 아래 RICH_TEXT.keepMarks 를 false 로 두세요.

   [캔버스는 해당 없음] 손님 말풍선처럼 캔버스에 직접 그리는 글자는
   HTML 이 아니라서 여기를 지나가지 않습니다. 그쪽은 지금도 글자
   전체가 bold 12px Malgun Gothic 한 벌이라 구분할 굵기 자체가 없습니다.
   나중에 필요해지면 richTextSegments() 를 그대로 쓰면 됩니다.
   ============================================================ */

const RICH_TEXT = {
  open:"「",
  close:"」",
  keepMarks:true,     // 괄호를 화면에 남길지. false 면 굵은 글씨만 남습니다.
  className:"emph"    // css/base.css 의 b.emph
};

/* 들여다보지 않는 자리 — 글자가 아니거나, 태그를 넣으면 깨지는 곳입니다. */
const RICH_TEXT_SKIP_TAGS = new Set(["SCRIPT","STYLE","TEXTAREA","INPUT","SELECT","OPTION","CANVAS","SVG","TITLE","NOSCRIPT"]);

/* 이미 굵게 나오는 자리 — 한 번 더 감싸도 화면은 그대로라 그냥 지나갑니다.
   (css/base.css 85줄이 이 태그들을 통째로 --font-bold 로 돌립니다) */
const RICH_TEXT_BOLD_TAGS = new Set(["B","STRONG","H1","H2","H3","H4","H5","H6","TH"]);

/* 감춰 둔 글자 폭 측정용 사본. 여기에 태그를 넣어도 보이지 않고
   재는 값만 흔들립니다. (story.js storySubtitleMeasurementElement) */
const RICH_TEXT_SKIP_CLASS = "story-text-measure";


/* ------------------------------------------------------------
   1. 글 쪼개기
   ------------------------------------------------------------ */

/* 글 한 덩어리를 { text, bold } 조각들로 나눕니다.
   닫는 괄호가 없으면 남은 글자를 전부 굵은 쪽으로 봅니다 — 대사가 한 글자씩
   찍히는 동안(story.js 타자 효과) 「 가 나온 순간부터 굵게 나오게 하려는
   것입니다. 닫히는 순간에 굵기가 바뀌면 그 자리에서 글자가 밀립니다. */
function richTextSegments(text){
  const source=String(text??"");
  const segments=[];
  let cursor=0;
  while(cursor<source.length){
    const open=source.indexOf(RICH_TEXT.open,cursor);
    if(open<0){segments.push({text:source.slice(cursor),bold:false});break;}
    if(open>cursor)segments.push({text:source.slice(cursor,open),bold:false});
    const close=source.indexOf(RICH_TEXT.close,open+RICH_TEXT.open.length);
    const end=close<0?source.length:close+RICH_TEXT.close.length;
    const marked=source.slice(open,end);
    segments.push({
      text:RICH_TEXT.keepMarks
        ?marked
        :marked.slice(RICH_TEXT.open.length,close<0?undefined:-RICH_TEXT.close.length),
      bold:true
    });
    cursor=end;
  }
  return segments;
}

// HTML 문자열이 필요한 곳을 위한 것입니다. 이 파일 안에서는 쓰지 않습니다.
function richTextHtml(text){
  const escape=value=>String(value).replace(/[&<>]/g,ch=>ch==="&"?"&amp;":ch==="<"?"&lt;":"&gt;");
  return richTextSegments(text)
    .filter(segment=>segment.text)
    .map(segment=>segment.bold
      ?`<b class="${RICH_TEXT.className}">${escape(segment.text)}</b>`
      :escape(segment.text))
    .join("");
}


/* ------------------------------------------------------------
   2. 화면에 붙은 글자 훑기
   ------------------------------------------------------------ */

function richTextSkipsElement(element){
  if(!element||element.nodeType!==Node.ELEMENT_NODE)return true;
  const tag=element.tagName;
  if(RICH_TEXT_SKIP_TAGS.has(tag)||RICH_TEXT_BOLD_TAGS.has(tag))return true;
  if(element.classList?.contains(RICH_TEXT_SKIP_CLASS))return true;
  return !!element.closest?.("[data-no-rich-text]");
}

/* 글자 마디 하나를 <b> 가 섞인 여러 마디로 갈아 끼웁니다.
   이미 <b> 안에 들어 있는 글자는 위 skip 에서 걸러지므로 두 번 감싸지 않습니다. */
function richTextApplyToTextNode(node){
  const source=node?.data;
  if(!source||!source.includes(RICH_TEXT.open))return;
  const parent=node.parentNode;
  if(!parent||richTextSkipsElement(node.parentElement))return;

  const fragment=document.createDocumentFragment();
  richTextSegments(source).forEach(segment=>{
    if(!segment.text)return;
    if(!segment.bold){fragment.appendChild(document.createTextNode(segment.text));return;}
    const bold=document.createElement("b");
    bold.className=RICH_TEXT.className;
    bold.textContent=segment.text;
    fragment.appendChild(bold);
  });
  parent.replaceChild(fragment,node);
}

/* 새로 붙은 덩어리 하나를 훑습니다.
   「 가 하나도 없으면 TreeWalker 를 만들지 않고 바로 빠집니다 — 이 함수는
   HUD 가 매 프레임 다시 그리는 목록에도 걸리므로 그냥 지나가는 경우가
   최대한 싸야 합니다. */
function richTextScan(root){
  if(!root)return;
  if(root.nodeType===Node.TEXT_NODE){richTextApplyToTextNode(root);return;}
  if(root.nodeType!==Node.ELEMENT_NODE||richTextSkipsElement(root))return;
  if(!root.textContent?.includes(RICH_TEXT.open))return;

  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
    acceptNode:node=>node.data.includes(RICH_TEXT.open)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT
  });
  // 훑는 도중에 갈아 끼우면 walker 가 길을 잃으므로 먼저 모아 둡니다.
  const nodes=[];
  for(let node=walker.nextNode();node;node=walker.nextNode())nodes.push(node);
  nodes.forEach(richTextApplyToTextNode);
}


/* ------------------------------------------------------------
   3. 감시 시작
   ------------------------------------------------------------ */

let richTextObserver=null;
let richTextBusy=false;

/* [자기 자신에게 다시 걸리지 않게] 우리가 넣은 <b> 도 새 노드라 기록이
   쌓입니다. 한 번 처리하는 동안 쌓인 기록은 takeRecords() 로 버립니다.
   (busy 플래그만으로는 다음 차례에 그대로 다시 들어옵니다) */
function richTextFlush(records){
  if(richTextBusy)return;
  richTextBusy=true;
  try{
    records.forEach(record=>{
      if(record.type==="characterData"){richTextApplyToTextNode(record.target);return;}
      record.addedNodes.forEach(richTextScan);
    });
  }finally{
    richTextObserver?.takeRecords();
    richTextBusy=false;
  }
}

function startRichText(){
  if(richTextObserver||!document.body)return;
  richTextScan(document.body);
  richTextObserver=new MutationObserver(richTextFlush);
  richTextObserver.observe(document.body,{childList:true,characterData:true,subtree:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",startRichText);
else startRichText();
