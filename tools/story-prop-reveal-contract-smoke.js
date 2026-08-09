"use strict";

/* 소품 띄우기(js/story-prop-reveal.js)의 계약 검사.
   지키려는 것은 넷입니다.
     · 등록된 소품 그림 파일이 실제로 있는지
     · 달빛 조각과 섞이지 않는지 (글자 없음 · 흰빛)
     · 자막보다 먼저 뜨고, 그동안만 자막을 붙잡는지
     · 장면이 바뀌면 붙잡아 둔 자막이 다음 장면에 흘러넘치지 않는지
   그림이 예쁘게 뜨는지는 여기서 못 봅니다 — 그건 실제 화면 캡처로 봅니다. */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const propSource = fs.readFileSync(path.join(root, "js/story-prop-reveal.js"), "utf8");
const storySource = fs.readFileSync(path.join(root, "js/story.js"), "utf8");
const storyDataSource = fs.readFileSync(path.join(root, "js/story-data.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const storyCssSource = fs.readFileSync(path.join(root, "css", "story.css"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/* ── 마크업 · 로드 순서 ────────────────────────────────────── */
assert(indexSource.includes('id="storyPropReveal"')
  && indexSource.includes('class="story-prop-focus"')
  && indexSource.includes('class="story-prop-art"'),
  "대사 오버레이 안에 소품 레이어(빛무리 + 그림)가 있어야 합니다.");
/* 글자 요소가 있으면 아이템 획득 연출로 읽힙니다. 조각 이름표
   (.story-fragment-kicker / .story-fragment-name)를 베껴 오지 않았는지 봅니다. */
const propMarkup = indexSource.split('id="storyPropReveal"')[1].split("story-dialogue-box")[0];
assert(!/story-prop-(kicker|name)/.test(propMarkup) && !/<(strong|span|p)\b/.test(propMarkup),
  "소품에는 이름표를 달면 안 됩니다(달빛 조각과 달리 다음 자막이 그것을 말해 줍니다).");
assert(indexSource.indexOf('src="js/story-prop-reveal.js"') < indexSource.indexOf('src="js/story.js"'),
  "js/story-prop-reveal.js 는 js/story.js 보다 먼저 로드되어야 합니다.");

/* ── 그림 파일 ─────────────────────────────────────────────
   경로가 틀려도 에러가 안 납니다. 빛무리만 뜬 빈 자리가 보일 뿐입니다. */
const artPaths = [...propSource.matchAll(/art:"(assets\/[^"]+\.webp)"/g)].map(m => m[1]);
assert(artPaths.length >= 1, "등록된 소품이 하나도 없습니다.");
for (const art of artPaths) {
  assert(fs.existsSync(path.join(root, ...art.split("/"))),
    `소품 그림이 없습니다: ${art}\n  npm run build:story-prop 으로 PNG 에서 뽑으세요.`);
}

/* js/story-data.js 가 부르는 소품 이름이 실제로 등록돼 있는지.
   오타가 나면 그 대사에서 소품이 그냥 안 뜹니다(에러 없음). */
const declaredProps = new Set([...propSource.matchAll(/^\s{2}(\w+):Object\.freeze/gm)].map(m => m[1]));
const usedProps = [...storyDataSource.matchAll(/propReveal:\s*\{\s*prop:\s*"([^"]+)"/g)].map(m => m[1]);
assert(usedProps.includes("businessJournalClosed"),
  "프롤로그에서 영업일지를 발견하는 대사에 소품이 걸려 있어야 합니다.");
for (const prop of usedProps) {
  assert(declaredProps.has(prop), `js/story-data.js 가 없는 소품을 부릅니다: ${prop}`);
}
/* 소품은 영업일지 UI(openJournalOnAdvance)와 다른 일입니다. 그림을 보고 자막을
   읽은 뒤에 책이 펼쳐지는 순서라, 같은 줄에 둘 다 걸려 있어야 합니다. */
const journalLine = storyDataSource.split('propReveal: { prop: "businessJournalClosed" }')[1] || "";
assert(/^\s*,?\s*openJournalOnAdvance:\s*true/m.test(journalLine.slice(0, 200)),
  "영업일지 소품은 그 자막을 다 읽고 책이 펼쳐지는 줄에 걸려야 합니다.");

/* ── 달빛 조각과 섞이지 않아야 합니다 ────────────────────────
   푸른빛은 조각의 색입니다. 소품 기본색은 흰빛이어야 합니다. */
assert(/white:"255,255,255"/.test(propSource)
  && /tone:"white"/.test(propSource),
  "소품 빛은 기본이 흰빛이어야 합니다(푸른빛은 달빛 조각의 색입니다).");
assert(/--prop-glow,255,255,255/.test(storyCssSource),
  "CSS 는 JS 가 넘기는 --prop-glow 를 쓰고, 기본값도 흰빛이어야 합니다.");
assert(/\.story-prop-reveal\s*\{[^}]*z-index:\s*3/.test(storyCssSource)
  && /\.story-prop-reveal\.show\s*\{[^}]*visibility:\s*visible/.test(storyCssSource),
  "소품 레이어는 조각과 같은 높이(z-index 3)에서 .show 로 열려야 합니다.");
/* 애니를 끄는 설정에서 opacity:0 인 시작 상태가 남으면 소품이 아예 안 보입니다. */
assert(/prefers-reduced-motion[\s\S]*?\.story-prop-art\s*\{\s*animation:\s*none;\s*opacity:\s*1/.test(storyCssSource),
  "애니를 끄면 소품이 안 보이는 게 아니라 그냥 떠 있어야 합니다.");
/* CSS 등장 애니와 JS 가 자막을 붙잡는 시간은 같은 값이어야 합니다. */
const revealMs = Number((propSource.match(/STORY_PROP_REVEAL_MS=(\d+)/) || [])[1]);
const revealSec = Number((storyCssSource.match(/animation:\s*storyPropReveal\s+([\d.]+)s/) || [])[1]);
assert(revealMs > 0 && Math.round(revealSec * 1000) === revealMs,
  `등장 애니(${revealSec}s)와 자막을 붙잡는 시간(${revealMs}ms)이 어긋납니다.`);

/* ── js/story.js 와의 배선 ────────────────────────────────────── */
assert(String(storySource).includes("scheduleStoryPropReveal(line,()=>startStorySubtitleTyping(line))"),
  "자막 타이핑은 소품이 다 떠오른 뒤에 시작해야 합니다.");
const advanceBody = storySource.split("function storyAdvance()")[1] || "";
assert(advanceBody.indexOf("releaseStoryPropReveal") > 0
  && advanceBody.indexOf("releaseStoryPropReveal") < advanceBody.indexOf("storySession.typing"),
  "소품이 떠오르는 동안의 클릭은 자막 쪽 넘김보다 먼저 '기다림 끝내기'로 가야 합니다.");
assert(/function resetStoryStage\([^)]*\)[\s\S]{0,500}?clearStoryPropReveal\(\)/.test(storySource)
  && /function clearStoryRuntime\(\)[\s\S]{0,400}?clearStoryPropReveal\(\)/.test(storySource),
  "소품은 장면 전환과 런타임 종료에서 반드시 정리되어야 합니다.");
/* 영업일지를 펼치는 줄은 다음 줄의 showStoryLine 을 부르지 않습니다(책을 닫아야
   이어집니다). 그래서 소품을 여기서 직접 내리지 않으면 펼친 책 뒤로 같은 책이
   한 권 더 비칩니다 — 실제로 캡처에서 보인 증상입니다. */
const journalBranch = (advanceBody.split("openJournalOnAdvance")[1] || "").slice(0, 700);
assert(journalBranch.includes("clearStoryPropReveal()"),
  "영업일지를 펼칠 때 소품으로 띄운 책을 내려야 합니다(같은 책이 두 권 보입니다).");

/* ── 런타임 동작 ────────────────────────────────────────────
   진짜 DOM 대신 필요한 만큼만 흉내 낸 판 위에서 돌립니다. */
const layerClasses = new Set();
const layerStyles = {};
const layer = {
  dataset: {},
  classList: {
    add(name) { layerClasses.add(name); },
    remove(name) { layerClasses.delete(name); },
    has(name) { return layerClasses.has(name); }
  },
  style: {
    setProperty(name, value) { layerStyles[name] = value; },
    removeProperty(name) { delete layerStyles[name]; }
  },
  setAttribute() {}
};
const timers = new Map();
let nextTimerId = 1;
const context = {
  console,
  // 브라우저에는 있는 것들입니다. 빠뜨리면 경로 풀이가 조용히 상대경로로
  // 물러나서(try/catch), 정작 잡으려던 404 함정을 검사가 못 봅니다.
  URL,
  layer, layerStyles,
  layerClassNames: () => [...layerClasses],
  // 시간은 흘려보내지 않고 직접 터뜨립니다. 검사가 620ms 를 기다릴 이유가 없습니다.
  setTimeout(fn) { const id = nextTimerId++; timers.set(id, fn); return id; },
  clearTimeout(id) { timers.delete(id); },
  fireTimers() { const queued = [...timers.values()]; timers.clear(); queued.forEach(fn => fn()); },
  pendingTimers: () => timers.size,
  storySession: null,
  preloadRequests: [],
  Image: function Image() {
    const requests = context.preloadRequests;
    let value = "";
    Object.defineProperty(this, "src", {
      get() { return value; },
      set(next) { value = next; requests.push(next); }
    });
  },
  document: {
    baseURI: "file:///C:/Midnight%20Diner/index.html",
    getElementById(id) { return id === "storyPropReveal" ? layer : null; }
  }
};

const tests = `
const assertRuntime=(condition,message)=>{if(!condition)throw new Error(message);};
const journalLine={kind:"direction",propReveal:{prop:"businessJournalClosed"}};
const plainLine={kind:"line",speaker:"protagonist"};

/* [소품이 없는 대사가 느려지면 안 됩니다]
   대부분의 대사가 이쪽으로 지나갑니다. 한 박자라도 미루면 게임 전체가 느려집니다. */
let typed=0;
assertRuntime(scheduleStoryPropReveal(plainLine,()=>{typed++;})===false&&typed===1,
  "소품이 없는 대사는 붙잡지 말고 바로 타이핑해야 합니다.");
assertRuntime(!layerClassNames().includes("show"),"소품이 없으면 레이어가 열리면 안 됩니다.");

/* [소품이 있는 대사는 그림이 먼저]  ★ 이 파일의 존재 이유 */
assertRuntime(scheduleStoryPropReveal(journalLine,()=>{typed++;})===true&&typed===1,
  "소품이 다 떠오르기 전에 자막을 올리면 안 됩니다.");
assertRuntime(layerClassNames().includes("show")&&layer.dataset.prop==="businessJournalClosed",
  "소품 레이어가 그 소품으로 열려야 합니다.");
/* 경로는 문서 기준 절대 URL 이어야 합니다. 상대경로면 스타일시트(css/) 기준으로
   풀려서 404 가 나고, 빛무리만 뜬 빈 자리가 보입니다. */
assertRuntime(layerStyles["--prop-art"].includes("file:///")
  &&layerStyles["--prop-art"].includes("prop_business_journal_closed_moonlight_table_v2.webp"),
  "소품 그림은 문서 기준 절대 URL 로 넘겨야 합니다: "+layerStyles["--prop-art"]);
assertRuntime(layerStyles["--prop-glow"]==="255,255,255",
  "영업일지 빛은 흰빛이어야 합니다(푸른빛은 달빛 조각).");
fireTimers();
assertRuntime(typed===2,"소품이 다 떠오르면 자막이 올라와야 합니다.");

/* 기다리기 싫어 누른 클릭도 시간이 다 됐을 때와 같은 길로 지나갑니다. */
clearStoryPropReveal();
typed=0;
assertRuntime(scheduleStoryPropReveal(journalLine,()=>{typed++;})===true&&typed===0,
  "소품이 떠오르는 동안에는 자막을 붙잡아야 합니다.");
assertRuntime(releaseStoryPropReveal()===true&&typed===1,
  "클릭하면 기다리지 않고 바로 자막이 올라와야 합니다.");
assertRuntime(releaseStoryPropReveal()===false&&typed===1,
  "이미 올라온 자막을 또 올리면 안 됩니다.");
assertRuntime(layerClassNames().includes("show"),
  "자막이 올라와도 소품은 그대로 떠 있어야 합니다(둘이 함께 있어야 할 그림입니다).");

/* 같은 소품이 걸린 줄을 다시 그려도(저장 복원 등) 등장 애니를 다시 돌리지
   않습니다. .show 를 뗐다 붙이면 그림이 깜빡입니다. */
typed=0;
assertRuntime(scheduleStoryPropReveal(journalLine,()=>{typed++;})===false&&typed===1,
  "이미 떠 있는 소품을 다시 띄우면 안 됩니다(깜빡임).");

/* 다음 줄로 넘어가면 소품은 사라지고, 그 줄은 붙잡히지 않습니다. */
typed=0;
assertRuntime(scheduleStoryPropReveal(plainLine,()=>{typed++;})===false&&typed===1,
  "소품이 없는 다음 줄은 바로 타이핑해야 합니다.");
assertRuntime(!layerClassNames().includes("show")&&layerStyles["--prop-art"]===undefined,
  "소품이 없는 줄에서는 레이어가 닫혀야 합니다.");

/* [장면이 갈아엎히면 붙잡아 둔 자막은 버립니다]
   여기서 올리면 사라진 대사를 다음 장면 위에 타이핑하게 됩니다. */
typed=0;
scheduleStoryPropReveal(journalLine,()=>{typed++;});
clearStoryPropReveal();
fireTimers();
assertRuntime(typed===0&&pendingTimers()===0&&!layerClassNames().includes("show"),
  "장면이 바뀌면 붙잡아 둔 자막이 뒤늦게 흘러넘치면 안 됩니다.");
assertRuntime(releaseStoryPropReveal()===false,"정리된 뒤에는 풀 것이 없어야 합니다.");

/* [미리 받기는 그 장면의 소품까지만]
   소품은 자막보다 먼저 화면 가운데를 차지합니다. 그때 그림을 요청하면
   빛무리만 뜬 빈 자리가 그대로 보입니다. */
preloadRequests.length=0;
const lines=[plainLine,journalLine];
storySession={lineIndex:0,lines};
applyStoryPropReveal(plainLine);
assertRuntime(preloadRequests.length===1
  &&preloadRequests[0]===STORY_PROPS.businessJournalClosed.art,
  "장면의 첫 대사에서 그 장면의 소품을 미리 받아야 합니다. 받은 것: "+preloadRequests.join(", "));
applyStoryPropReveal(journalLine);
assertRuntime(preloadRequests.length===1,
  "같은 장면 안에서 대사를 넘길 때마다 다시 받으면 안 됩니다.");
storySession=null;
clearStoryPropReveal();

/* 등록되지 않은 소품 이름은 "소품이 없는 줄"과 같이 취급합니다. 화면을 덮어
   버리는 것보다 낫고, 오타 자체는 위의 정적 검사(declaredProps)가 잡습니다. */
typed=0;
assertRuntime(scheduleStoryPropReveal({propReveal:{prop:"없는소품"}},()=>{typed++;})===false
  &&typed===1&&!layerClassNames().includes("show"),
  "등록되지 않은 소품 이름이 대사를 붙잡으면 안 됩니다.");
`;

vm.runInNewContext(`${propSource}\n${tests}`, context, {
  filename: "story-prop-reveal-contract-smoke.vm.js"
});

console.log("story prop reveal contract smoke passed");
