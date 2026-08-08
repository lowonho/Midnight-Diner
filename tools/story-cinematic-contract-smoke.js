"use strict";

/* 컷씬 배경(story-cinematic.js)의 계약 검사.
   지키려는 것은 셋입니다.
     · 프롤로그 세 컷의 원화 파일이 실제로 있는지
     · 컷이 안 적힌 대사에서 직전 컷이 유지되는지 (구간 개념의 핵심)
     · 장면이 바뀌면 정리되는지
   그림이 예쁘게 나오는지는 여기서 못 봅니다 — 그건 실제 화면 캡처로 봅니다. */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const cinematicSource = fs.readFileSync(path.join(root, "story-cinematic.js"), "utf8");
const storySource = fs.readFileSync(path.join(root, "story.js"), "utf8");
const storyDataSource = fs.readFileSync(path.join(root, "story-data.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const storyCssSource = fs.readFileSync(path.join(root, "css", "story.css"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/function resetStoryStage\(\)\s*\{\s*clearStoryCinematic\(\)/.test(storySource),
  "실제 스토리 장면 전환에서 컷씬을 정리해야 합니다.");
assert(indexSource.includes('id="storyCutscene"')
  && (indexSource.match(/story-cutscene-layer/g) || []).length >= 2,
  "대사 오버레이 안에 컷씬 판과 교차 페이드용 레이어 두 장이 있어야 합니다.");
assert(/\.story-overlay\.story-cinematic-active[\s\S]*?\.story-stage\s*\{[\s\S]*?visibility:\s*hidden/.test(storyCssSource),
  "컷씬 중에는 배우 무대를 감춰야 합니다(원화 안에 김다은이 이미 있습니다).");
/* 컷 안에 김다은이 그려져 있으면 대화용 원화를 겹쳐 세우면 안 됩니다.
   story.js 가 이 판단을 story-cinematic.js 에 물어보는지 확인합니다. */
assert(storySource.includes("storyCinematicDrawsProtagonist"),
  "컷씬 중 원화를 올릴지는 그 컷에 김다은이 그려져 있는지로 정해야 합니다.");

/* 컷씬 원화는 대사 오버레이 안 인라인 style 로 들어갑니다. 경로가 틀리면
   화면이 새까맣게 나올 뿐 에러가 안 나므로 여기서 파일 존재를 확인합니다. */
const artPaths = [...cinematicSource.matchAll(/"(assets\/Cutscene\/[^"]+\.webp)"/g)].map(m => m[1]);
assert(artPaths.length >= 3, `등록된 컷씬 원화가 너무 적습니다 (지금 ${artPaths.length}장).`);
for (const art of artPaths) {
  assert(fs.existsSync(path.join(root, art)),
    `컷씬 원화가 없습니다: ${art}\n  npm run build:cutscene 으로 PNG 에서 뽑으세요.`);
}

/* story-data.js 가 쓰는 컷 이름이 story-cinematic.js 에 실제로 있는지.
   오타가 나면 그 대사에서 컷이 그냥 안 바뀝니다(에러 없음). */
const declaredCuts = new Set([...cinematicSource.matchAll(/^\s{2}(\w+):Object\.freeze/gm)].map(m => m[1]));
const usedCuts = [...storyDataSource.matchAll(/cinematic:\s*\{\s*cut:\s*"([^"]+)"/g)].map(m => m[1]);
assert(usedCuts.length >= 3, `프롤로그 컷 지정이 너무 적습니다 (지금 ${usedCuts.length}군데).`);
for (const cut of usedCuts) {
  assert(declaredCuts.has(cut), `story-data.js 가 없는 컷을 부릅니다: ${cut}`);
}

/* ── 달빛 조각 전달 컷씬 ────────────────────────────────────
   손님 여덟은 createSpecialGuestArc() 하나로 찍혀서 컷 이름을 조각 id 로
   만듭니다(shard_<shardId>). 문자열이 아니라 템플릿 리터럴이라 위 usedCuts
   정규식에 안 걸리므로 여기서 따로 봅니다 — 조각 에셋이 여덟이면 컷도 여덟
   이어야 합니다. 하나 빠지면 그 손님만 컷 없이 지나갑니다(에러 없음). */
const shardIds = [...storyDataSource.matchAll(/^\s{2}(\w+):\s*"assets\/customer\/Special\/MoonPiece\//gm)]
  .map(m => m[1]);
assert(shardIds.length === 8, `달빛 조각이 여덟이어야 합니다 (지금 ${shardIds.length}개).`);
for (const shardId of shardIds) {
  assert(declaredCuts.has(`shard_${shardId}`),
    `조각 "${shardId}" 의 전달 컷씬이 story-cinematic.js 에 없습니다: shard_${shardId}`);
}
assert(/cinematic:\s*\{\s*cut:\s*`shard_\$\{config\.shardId\}`\s*,\s*hold:\s*true\s*\}/.test(storyDataSource),
  "완전한 조각을 건네는 대사에 조각 id 로 만든 컷과 hold 를 걸어야 합니다.");

/* ── 컷이 바뀌는 줄에는 빠짐없이 hold ────────────────────────
   컷씬은 그림을 먼저 한 번 보여 준 뒤 눌러야 대사창이 덮이는 것이 규칙입니다.
   hold 를 빠뜨리면 그 컷만 그림과 대사창이 동시에 떠서, 새 그림을 보기도 전에
   아래쪽이 가려집니다. 눈으로만 잡히는 종류라 여기서 셉니다. */
// `${config.shardId}` 안의 } 에서 끊기지 않도록 템플릿 자리를 통째로 건너뜁니다.
const cutLines = [...storyDataSource.matchAll(/cinematic:\s*\{(?:[^{}]|\$\{[^}]*\})*\}/g)].map(m => m[0]);
const holdless = cutLines.filter(text => !/hold:/.test(text));
assert(holdless.length === 0,
  `컷이 바뀌는 대사에 hold 가 없습니다:\n  ${holdless.join("\n  ")}`);
/* 컷은 완전한 조각(great)에서만 겁니다. 부분 조각 대사에도 걸리면 완전한
   조각을 건네는 그림이 "일부만 되찾았다"는 대사와 함께 뜹니다. */
assert(/fragmentState === "full"\s*\?\s*\{ cinematic:/.test(storyDataSource),
  "부분 조각(맛있다) 대사에는 전달 컷씬을 걸면 안 됩니다.");

/* ── 컷씬을 잠깐 혼자 보여 주는 대기 ────────────────────────
   대기 중에는 대사창이 감춰집니다. display 로 감추면 폭이 0 이 되어 자막
   쪽수 계산이 깨지므로 visibility 여야 합니다. */
assert(/\.story-overlay\.story-cinematic-hold \.story-dialogue-box/.test(storyCssSource)
  && !/\.story-cinematic-hold[^{]*\{[^}]*display:\s*none/.test(storyCssSource),
  "대기 중에는 대사창을 visibility 로 감춰야 합니다(display 는 자막 쪽수 계산을 깹니다).");
/* 대기 중 클릭은 대사를 건너뛰는 게 아니라 대기를 끝내는 것이어야 합니다.
   storyAdvance 가 typing 검사보다 먼저 봐야 합니다 — 대기 중에는 typing 이
   아직 없어서, 순서가 뒤바뀌면 클릭 한 번에 그 대사가 통째로 지나갑니다. */
const advanceBody = storySource.split("function storyAdvance()")[1] || "";
assert(advanceBody.indexOf("releaseStoryCinematicHold") > 0
  && advanceBody.indexOf("releaseStoryCinematicHold") < advanceBody.indexOf("storySession.typing"),
  "대기 중 클릭은 다음 대사보다 먼저 대기 해제로 가야 합니다.");
/* 대기를 풀 마우스 입력이 실제로 닿아야 합니다.
   대사를 넘기는 클릭은 #storyText 와 #storyNextButton 에만 걸려 있는데, 대기
   중에는 대사창이 visibility:hidden 이라 둘 다 클릭 대상에서 빠집니다. 그래서
   그동안은 #storyOverlay 가 클릭을 대신 받아야 합니다. 없으면 마우스로는 대기가
   풀리지 않아 화면이 멈춘 것처럼 보입니다. */
const uiBody = storySource.split("function initializeStoryUI()")[1] || "";
assert(/getElementById\("storyOverlay"\)\??\.addEventListener\("click"/.test(uiBody)
  && /storyCinematicHoldIsActive\(\)/.test(uiBody),
  "대사창이 감춰지는 동안에는 오버레이가 클릭을 대신 받아야 합니다(마우스로 대기를 풀 수 없습니다).");
assert(/function storyCinematicHoldIsActive\(\)/.test(cinematicSource),
  "대기 중인지 물어볼 수 있어야 합니다: storyCinematicHoldIsActive()");

/* 장면이 갈아엎히면 대기도 없어져야 합니다. 안 그러면 사라진 대사의 조각
   오버레이가 다음 장면 위에 뒤늦게 뜹니다. */
assert(/function clearStoryCinematic\(\)\s*\{\s*cancelStoryCinematicHold\(\)/.test(cinematicSource),
  "장면 전환에서 남은 대기를 취소해야 합니다.");
/* 조각 오버레이(z-index 3)는 컷씬(z-index 1) 위에 그대로 남아야 하고,
   기본 암전(rgba(5,4,10,.91))은 컷씬을 덮으므로 얇아져야 합니다. */
assert(/\.story-overlay\.story-cinematic-active\s+\.story-fragment-handoff\s*\{[^}]*rgba\(5,4,10,\.34\)/
  .test(storyCssSource),
  "컷씬 위에서는 조각 오버레이 암전을 얇게 해서 원화가 보여야 합니다.");

/* ── 미리 받기는 '지금 장면'까지만 ──────────────────────────
   등록된 컷 전부를 받으면 프롤로그를 보려고 조각 컷 여덟 장까지 끌어옵니다. */
assert(!/Object\.values\(STORY_CUTSCENES\)/.test(cinematicSource),
  "컷씬을 통째로 미리 받으면 안 됩니다. 진행 중인 장면의 컷만 받으세요.");
assert(/function preloadStoryCutscenesForScene\(\)/.test(cinematicSource)
  && /preloadStoryCutscenesForScene\(\);/.test(cinematicSource.split("function applyStoryCinematic")[1] || ""),
  "장면이 시작되면 그 장면의 컷을 미리 받아야 합니다.");

/* ── 런타임 동작 ────────────────────────────────────────────
   진짜 DOM 대신 필요한 만큼만 흉내 낸 판 위에서 돌립니다. */
const overlayClasses = new Set();
function fakeLayer() {
  const classes = new Set();
  return {
    style: { backgroundImage: "" },
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      has(name) { return classes.has(name); }
    }
  };
}
const layers = [fakeLayer(), fakeLayer()];
const cutsceneContainer = {
  hidden: true,
  querySelectorAll(selector) {
    return selector === ".story-cutscene-layer" ? layers : [];
  }
};
const context = {
  console,
  // 대기(hold)는 타이머로 돕니다. 검사에서는 시간을 기다리는 대신 클릭과
  // 같은 길인 releaseStoryCinematicHold() 로 직접 풉니다.
  setTimeout, clearTimeout,
  overlayClassNames: () => [...overlayClasses],
  // story.js 의 진행 상태. 장면 중간부터 여는 경우의 되감기가 이걸 읽습니다.
  storySession: null,
  // 미리 받기 범위를 재려면 실제로 요청한 그림 목록이 필요합니다.
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
    getElementById(id) {
      if (id === "storyOverlay") {
        return { classList: { add(n) { overlayClasses.add(n); }, remove(n) { overlayClasses.delete(n); } } };
      }
      if (id === "storyCutscene") return cutsceneContainer;
      return null;
    }
  }
};

const tests = `
const assertRuntime=(condition,message)=>{if(!condition)throw new Error(message);};

assertRuntime(applyStoryCinematic({cinematic:{cut:"prologueOffice"}})===true,
  "등록된 컷은 화면에 걸려야 합니다.");
assertRuntime(storyCinematicRuntime.cut==="prologueOffice","첫 컷이 현재 컷으로 남아야 합니다.");
const firstLayer=storyCinematicRuntime.layer;
assertRuntime(layers[firstLayer].classList.has("is-active")
  &&layers[firstLayer].style.backgroundImage.includes("cutscene_02_reprimand_variant.webp"),
  "지정한 컷의 원화가 보이는 레이어에 깔려야 합니다.");

assertRuntime(applyStoryCinematic({kind:"caption",speakerLabel:"김다은(속말)"})===true,
  "컷이 안 적힌 속말에서도 컷씬을 유지해야 합니다.");
assertRuntime(storyCinematicRuntime.cut==="prologueOffice"&&storyCinematicRuntime.layer===firstLayer,
  "컷이 안 적힌 대사가 컷을 바꾸면 안 됩니다.");

applyStoryCinematic({cinematic:{cut:"prologueCommute"}});
assertRuntime(storyCinematicRuntime.layer!==firstLayer,
  "컷이 바뀌면 다른 레이어로 넘어가야 교차 페이드가 됩니다.");
assertRuntime(layers[storyCinematicRuntime.layer].classList.has("is-active")
  &&!layers[firstLayer].classList.has("is-active"),
  "새 컷만 보이고 이전 컷은 사라져야 합니다.");

const beforeRepeat=storyCinematicRuntime.layer;
applyStoryCinematic({cinematic:{cut:"prologueCommute"}});
assertRuntime(storyCinematicRuntime.layer===beforeRepeat,
  "같은 컷을 다시 지정하면 레이어를 바꾸지 말아야 합니다(깜빡임 방지).");

/* 없는 컷 이름은 "컷 지정이 없는 대사"와 같이 취급합니다 — 지금 컷을 그대로
   둡니다. 화면을 까맣게 비우는 것보다 낫고, 오타 자체는 위의 정적 검사
   (declaredCuts)가 잡습니다. */
applyStoryCinematic({cinematic:{cut:"없는컷"}});
assertRuntime(storyCinematicRuntime.cut==="prologueCommute"&&storyCinematicRuntime.layer===beforeRepeat,
  "등록되지 않은 컷 이름이 지금 컷을 밀어내면 안 됩니다.");

/* 장면 중간부터 여는 경우(QA 대사 브라우저). 그 대사에는 컷이 안 적혀 있지만
   구간을 연 앞 대사의 컷을 찾아 와야 합니다. */
clearStoryCinematic();
storySession={
  lineIndex:2,
  lines:[{cinematic:{cut:"prologueOffice"}},{kind:"line"},{kind:"caption"}]
};
assertRuntime(applyStoryCinematic({kind:"caption"})===true,
  "장면 중간부터 열어도 그 구간의 컷이 걸려야 합니다.");
assertRuntime(storyCinematicRuntime.cut==="prologueOffice",
  "되감기는 앞쪽에서 가장 가까운 컷을 찾아야 합니다.");
storySession=null;

/* [미리 받기는 그 장면의 컷까지만]
   조각 컷은 장면 마지막 대사에 걸립니다. 첫 대사에서 이미 요청이 나가야
   대사를 읽는 동안 도착합니다. 그리고 그 장면에 없는 컷은 안 받아야 합니다. */
clearStoryCinematic();
preloadRequests.length=0;
const shardLines=[
  {kind:"line",speaker:"rainyChild"},
  {kind:"direction",cinematic:{cut:"shard_first_raindrop"}}
];
storySession={lineIndex:0,lines:shardLines};
applyStoryCinematic(shardLines[0]);
assertRuntime(preloadRequests.length===1
  &&preloadRequests[0]===STORY_CUTSCENES.shard_first_raindrop.art,
  "장면의 첫 대사에서 그 장면의 컷만 미리 받아야 합니다. 받은 것: "+preloadRequests.join(", "));
applyStoryCinematic(shardLines[1]);
assertRuntime(preloadRequests.length===1,
  "같은 장면 안에서 대사를 넘길 때마다 다시 받으면 안 됩니다.");
assertRuntime(storyCinematicRuntime.cut==="shard_first_raindrop"
  &&layers[storyCinematicRuntime.layer].style.backgroundImage
    .includes("cutscene_special_01_rain_child_variant_b.webp"),
  "조각을 건네는 마지막 대사에서 그 손님의 컷이 깔려야 합니다.");
storySession=null;

/* [컷씬을 잠깐 혼자 보여 주는 대기]
   대기가 걸린 줄에서는 대사·조각을 바로 올리지 않고, 시간이 지나거나
   클릭했을 때 한 번만 올려야 합니다. */
let revealed=0;
const holdLine={kind:"direction",cinematic:{cut:"shard_first_raindrop",hold:1000}};
assertRuntime(beginStoryCinematicHold(holdLine)===true,"hold 가 적힌 줄은 대기해야 합니다.");
assertRuntime(overlayClassNames().includes("story-cinematic-hold"),
  "대기 중에는 대사창을 감추는 클래스가 붙어야 합니다.");
assertRuntime(scheduleStoryCinematicReveal(()=>{revealed++;})===true&&revealed===0,
  "대기 중에는 대사와 조각을 아직 올리면 안 됩니다.");
assertRuntime(releaseStoryCinematicHold()===true&&revealed===1,
  "대기를 끝내면 대사와 조각이 올라와야 합니다(클릭 한 번으로도 같은 길).");
assertRuntime(!overlayClassNames().includes("story-cinematic-hold"),
  "대기가 끝나면 감추는 클래스를 떼야 합니다.");
assertRuntime(releaseStoryCinematicHold()===false&&revealed===1,
  "이미 끝난 대기를 또 풀어도 두 번 올리면 안 됩니다.");

// hold 가 없는 줄은 그 자리에서 바로 올립니다.
assertRuntime(beginStoryCinematicHold({cinematic:{cut:"shard_first_raindrop"}})===false,
  "hold 가 없으면 대기하지 않아야 합니다.");
assertRuntime(scheduleStoryCinematicReveal(()=>{revealed++;})===false&&revealed===2,
  "대기가 없으면 대사와 조각을 바로 올려야 합니다.");

/* 장면이 갈아엎히면 대기는 취소되고, 사라진 대사의 조각은 올라오면 안 됩니다. */
beginStoryCinematicHold(holdLine);
scheduleStoryCinematicReveal(()=>{revealed++;});
clearStoryCinematic();
assertRuntime(revealed===2&&releaseStoryCinematicHold()===false,
  "장면이 바뀌면 사라진 대사의 조각 오버레이가 뒤늦게 뜨면 안 됩니다.");
assertRuntime(!overlayClassNames().includes("story-cinematic-hold"),
  "장면이 바뀌면 감추는 클래스도 떼야 합니다.");

clearStoryCinematic();
assertRuntime(applyStoryCinematic({kind:"line"})===false,
  "컷씬이 없는 장면에서는 아무것도 걸지 말아야 합니다.");
assertRuntime(storyCinematicRuntime===null,"장면 전환에서 컷씬 상태를 비워야 합니다.");
assertRuntime(cutsceneContainer.hidden===true,"장면 전환 뒤에는 컷씬 판이 감춰져야 합니다.");
assertRuntime(layers.every(layer=>!layer.classList.has("is-active")&&layer.style.backgroundImage===""),
  "장면 전환 뒤에는 두 레이어 모두 비어 있어야 합니다.");
`;

context.layers = layers;
context.cutsceneContainer = cutsceneContainer;
vm.runInNewContext(`${cinematicSource}\n${tests}`, context, {
  filename: "story-cinematic-contract-smoke.vm.js"
});

assert(!overlayClasses.has("story-cinematic-active"),
  "장면 전환 뒤에는 컷씬 표시 클래스가 제거되어야 합니다.");

console.log("story cinematic contract smoke passed");
