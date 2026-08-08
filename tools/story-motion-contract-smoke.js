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

/* ---- 2. 복장마다, 모션마다 webp 가 실제로 있는지 ---- */
const costumeBlock = storySource.match(/const STORY_PROTAGONIST_COSTUMES=Object\.freeze\(\{([\s\S]*?)\}\);/);
if(!costumeBlock) fail("story.js 에서 STORY_PROTAGONIST_COSTUMES 표를 못 찾았습니다.");
const costumes = [...costumeBlock[1].matchAll(/(\w+):\{dir:"([^"]+)",stem:"([^"]+)",cssClass:"([^"]*)"\}/g)]
  .map(([, name, dir, stem, cssClass]) => ({ name, dir, stem, cssClass }));
if(!costumes.length) fail("STORY_PROTAGONIST_COSTUMES 를 읽지 못했습니다.");

for(const costume of costumes){
  for(const [key, index] of motions){
    const file = path.join(root, "assets", "Conversation", costume.dir, `${costume.stem}_motion_${index}.webp`);
    if(!fs.existsSync(file)){
      fail(`복장 "${costume.name}" 의 모션 "${key}" 그림이 없습니다: ${path.relative(root, file)}\n`
        + "  → npm run build:conversation 을 먼저 돌리세요.");
    }
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

/* ---- 5. 회사원 복장 장면이 실제로 표시돼 있는지 ----
   이 표시가 사라지면 퇴근길에서 주방 복장을 입고 나옵니다.                 */
if(!/protagonistCostume:\s*"office"/.test(dataSource)){
  fail("story-data.js 에 protagonistCostume:\"office\" 장면이 없습니다. 프롤로그 퇴근길이 주방 복장으로 나옵니다.");
}

/* ---- 6. 상대경로 함정과 복장별 상자 크기 ---- */
if(!storySource.includes("new URL(source,document.baseURI)")){
  fail("story.js 가 --portrait-art 를 문서 기준 절대 URL 로 만들지 않습니다.\n"
    + "  상대경로를 넣으면 css/ 기준으로 풀려서 그림이 안 나옵니다(storyPortraitArtValue 참고).");
}
if(!/\.story-portrait\.art\s*\{[^}]*border:\s*0/.test(cssSource)){
  fail("css/story.css 의 .story-portrait.art 가 액자 테두리를 걷어내지 않습니다.");
}
for(const costume of costumes.filter(entry => entry.cssClass)){
  const rule = new RegExp(`\\.story-portrait\\.art\\.${costume.cssClass}\\s*\\{[^}]*--art-height`);
  if(!rule.test(cssSource)){
    fail(`css/story.css 에 .story-portrait.art.${costume.cssClass} 의 상자 크기가 없습니다.\n`
      + `  복장 "${costume.name}" 만 혼자 크거나 작게 섭니다.\n`
      + "  → node tools/build-conversation-webp.js --css 로 값을 뽑아 넣으세요.");
  }
}

const unused = [...motions.keys()].filter(key => !used.has(key));
console.log(`STORY_MOTION_CONTRACT_OK 복장 ${costumes.length}벌 · 모션 ${motions.size}종 · 사용 ${used.size}종`
  + (unused.length ? ` · 아직 안 쓰는 모션: ${unused.join(", ")}` : ""));
