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
  // story.js 의 진행 상태. 장면 중간부터 여는 경우의 되감기가 이걸 읽습니다.
  storySession: null,
  Image: function Image() { this.src = ""; },
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

assertRuntime(applyStoryCinematic({speaker:"protagonist"})===true,
  "컷이 안 적힌 김다은 대사에서도 컷씬을 유지해야 합니다.");
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
