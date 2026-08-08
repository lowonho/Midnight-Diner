"use strict";

/* 주인공 대화 원화(모션) 계약 검사
   ------------------------------------------------------------
     node tools/story-motion-contract-smoke.js

   story-data.js 의 대사에 적힌 motion 과 실제 파일·CSS 를 맞춰 봅니다.
   여기서 막고 싶은 사고는 다섯입니다.

     1. motion 오타 — 없는 키를 적으면 조용히 기본 동작으로 서 버립니다.
     2. webp 누락 — 빌드를 안 돌린 채 키만 늘리면 빈 화면이 됩니다.
        복장 두 벌 모두 봅니다. PNG 마스터는 저장소 밖이라 여기서 안 봅니다.
     3. 새 대사에 motion 을 안 붙임 — 문맥과 무관한 기본 동작이 섭니다.
     4. --portrait-art 에 상대경로 — 커스텀 속성 안의 url() 은 그 값을 쓰는
        스타일시트(css/story.css)를 기준으로 풀려서 "css/assets/..." 를 찾다가
        404 가 납니다. story.js 는 반드시 문서 기준 절대 URL 로 넘겨야 합니다.
     5. 복장별 상자 크기 누락 — 회사원 원화는 캔버스에 더 크게 그려져 있어서
        css/story.css 의 .story-portrait.art.office 가 없으면 혼자 커집니다.
   ------------------------------------------------------------ */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dataSource = fs.readFileSync(path.join(root, "story-data.js"), "utf8");
const storySource = fs.readFileSync(path.join(root, "story.js"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "css", "story.css"), "utf8");

function fail(message){ throw new Error(message); }

/* ---- 1. story.js 가 쓰는 모션 표 읽기 ---- */
const tableBlock = storySource.match(/const STORY_PROTAGONIST_MOTIONS=Object\.freeze\(\{([\s\S]*?)\}\);/);
if(!tableBlock) fail("story.js 에서 STORY_PROTAGONIST_MOTIONS 표를 못 찾았습니다.");
const motions = new Map();
for(const [, key, index] of tableBlock[1].matchAll(/(\w+)\s*:\s*"(\d+)"/g)) motions.set(key, index);
if(!motions.size) fail("STORY_PROTAGONIST_MOTIONS 가 비어 있습니다.");

/* ---- 2. 인물마다, 모션마다 webp 가 실제로 있는지 ---- */
const artBlock = storySource.match(/const STORY_PORTRAIT_ART=Object\.freeze\(\{([\s\S]*?)\n\}\);/);
if(!artBlock) fail("story.js 에서 STORY_PORTRAIT_ART 표를 못 찾았습니다.");
const portraits = [...artBlock[1].matchAll(/(\w+):\{dir:"([^"]+)",stem:"([^"]+)",height:([\d.]+),drop:([-\d.]+)\}/g)]
  .map(([, name, dir, stem, height, drop]) => ({ name, dir, stem, height:+height, drop:+drop }));
if(!portraits.length) fail("STORY_PORTRAIT_ART 를 읽지 못했습니다.");

for(const portrait of portraits){
  for(const [key, index] of motions){
    const file = path.join(root, "assets", "Conversation", portrait.dir, `${portrait.stem}_motion_${index}.webp`);
    if(!fs.existsSync(file)){
      fail(`"${portrait.name}" 의 모션 "${key}" 그림이 없습니다: ${path.relative(root, file)}\n`
        + "  → npm run build:conversation 을 먼저 돌리세요.");
    }
  }
  // 실측으로 뽑는 값이라 0 이나 음수면 --css 를 안 돌리고 손으로 적은 것입니다.
  if(!(portrait.height > 0) || !(portrait.drop > 0)){
    fail(`"${portrait.name}" 의 height/drop 이 이상합니다(${portrait.height}/${portrait.drop}).\n`
      + "  → node tools/build-conversation-webp.js --css 로 다시 뽑으세요.");
  }
}

/* ---- 3. 대사에 적힌 motion 이 모두 표에 있는지 ---- */
const used = new Set();
for(const [, key] of dataSource.matchAll(/motion:\s*"(\w+)"/g)){
  if(!motions.has(key)) fail(`story-data.js 에 없는 모션 "${key}" 가 적혀 있습니다. 쓸 수 있는 값: ${[...motions.keys()].join(", ")}`);
  used.add(key);
}
if(!used.size) fail("story-data.js 에 motion 이 하나도 없습니다.");

/* ---- 4. 주인공 대사에 motion 이 빠지지 않았는지 ----
   복장과 무관하게 모든 주인공 대사가 대상입니다. 두 복장 다 같은 아홉 모션을
   가지고 있어서 회사원 장면도 예외가 아닙니다.                             */
const missing = [];
dataSource.split("\n").forEach((text, i) => {
  if(!text.includes('storyLine("protagonist"')) return;
  if(!text.includes("motion:")) missing.push(`${i + 1}행: motion 이 없습니다 — ${text.trim().slice(0, 60)}`);
});
if(missing.length) fail("주인공 대사 모션 누락:\n  " + missing.join("\n  "));

/* ---- 5. 프롤로그가 전부 회사원 복장으로 표시돼 있는지 ----
   김다은은 첫 영업을 시작하겠다고 마음먹는 SCN-P04 마지막 대사까지 회사원
   복장입니다. 그래서 프롤로그 장면(prologue / prologueInteraction)에는 빠짐없이
   protagonistCostume:"office" 가 붙어 있어야 합니다. 한 장면만 빠뜨리면 퇴근길
   도중에 갑자기 주방 복장으로 갈아입은 것처럼 보입니다.

   장면을 통째로 끊어 보고, 그 안에 프롤로그 표시가 있는데 복장 표시가 없으면
   잡습니다.                                                                */
const prologueMissing = dataSource
  .split(/\n(?=\s{2}"[A-Z0-9-]+":\s*\{)/)
  .filter(block => /sceneType:\s*"prologue(Interaction)?"/.test(block))
  .filter(block => !/protagonistCostume:\s*"office"/.test(block))
  .map(block => (block.match(/"([A-Z0-9-]+)":\s*\{/) || [])[1] || "(이름 모름)");
if(prologueMissing.length){
  fail(`프롤로그 장면에 protagonistCostume:"office" 가 없습니다: ${prologueMissing.join(", ")}\n`
    + "  첫 영업을 시작하기 전까지는 회사원 복장이어야 합니다.");
}

/* ---- 6. 상대경로 함정과 복장별 상자 크기 ---- */
if(!storySource.includes("new URL(source,document.baseURI)")){
  fail("story.js 가 --portrait-art 를 문서 기준 절대 URL 로 만들지 않습니다.\n"
    + "  상대경로를 넣으면 css/ 기준으로 풀려서 그림이 안 나옵니다(storyPortraitArtValue 참고).");
}
if(!/\.story-portrait\.art\s*\{[^}]*border:\s*0/.test(cssSource)){
  fail("css/story.css 의 .story-portrait.art 가 액자 테두리를 걷어내지 않습니다.");
}
// 상자 치수는 이제 story.js 가 인라인으로 넣습니다. CSS 에는 안전값만 남습니다.
if(!/--art-height/.test(storySource)){
  fail("story.js 가 --art-height 를 인물별로 넣지 않습니다.\n"
    + "  그러면 모든 인물이 김다은 기준 크기로 서서 발끝이 어긋납니다.");
}

/* ---- 7. 원화가 있는 화자는 모든 대사에 motion 이 있어야 합니다 ----
   화자 이름은 STORY_PORTRAIT_ART 의 열쇠에서 그대로 가져옵니다. 그래야 새
   손님 원화를 넣는 순간 그 손님 대사도 자동으로 검사 대상이 됩니다.        */
const speakerAliases = { twinShadows:["twinShadows","leftShadow","rightShadow"], facelessDaeun:["facelessDaeun","anotherDaeun"] };
const artSpeakers = new Set(portraits.flatMap(p => {
  if(p.name.startsWith("protagonist")) return ["protagonist"];
  return speakerAliases[p.name] || [p.name];
}));
const lineMissing = [];
dataSource.split("\n").forEach((text, i) => {
  const hit = text.match(/storyLine\("(\w+)"/);
  if(!hit || !artSpeakers.has(hit[1])) return;
  if(!text.includes("motion:")) lineMissing.push(`${i + 1}행 ${hit[1]} — ${text.trim().slice(0, 56)}`);
});
if(lineMissing.length){
  fail(`원화가 있는 화자인데 motion 이 없는 대사 ${lineMissing.length}줄:\n  ` + lineMissing.slice(0, 12).join("\n  ")
    + (lineMissing.length > 12 ? `\n  ... 외 ${lineMissing.length - 12}줄` : ""));
}

const unused = [...motions.keys()].filter(key => !used.has(key));
console.log(`STORY_MOTION_CONTRACT_OK 인물 ${portraits.length}종 · 모션 ${motions.size}종 · 사용 ${used.size}종`
  + (unused.length ? ` · 아직 안 쓰는 모션: ${unused.join(", ")}` : ""));
