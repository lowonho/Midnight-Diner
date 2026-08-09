"use strict";

/*
  영업일지 초상화의 '얼굴 자리' 확인용 도구입니다.

    node tools/journal-face-preview.js [나갈 파일]

  js/story.js 의 JOURNAL_GUEST_FACE 표를 그대로 읽어, 손님 여덟 명 x 평가 네
  가지(평가 없음·맛있다·아쉽다·완벽)를 게임과 똑같이 원으로 잘라 붙여 줍니다.
  원은 네 귀퉁이를 잘라 먹어서, 네모로 보면 멀쩡한 자리도 정수리가 잘립니다 —
  그래서 여기서도 원으로 자릅니다. 이 장을 보고 표를 고치면 됩니다.

  원화를 새로 받았거나 표를 고쳤을 때만 돌리면 됩니다. 결과는 저장소에 남기지
  않습니다 — 기본 저장 위치는 tools/.out/journal-faces.png 입니다.
*/

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const storySource = fs.readFileSync(path.join(root, "js", "story.js"), "utf8");

/* 표는 js/story.js 한 곳에만 적습니다. 여기서 베껴 두면 둘이 어긋납니다.
   표정별 예외처럼 한 단계 더 들어간 값이 있어서, 정규식으로 훑지 않고
   그 객체만 떼어 그대로 읽습니다(우리가 쓴 파일이라 안전합니다). */
function readTable(name) {
  const block = storySource.match(
    new RegExp(`const ${name}\\s*=\\s*Object\\.freeze\\((\\{[\\s\\S]*?\\n\\})\\);`));
  if (!block) throw new Error(`js/story.js 에서 ${name} 을 못 읽었습니다.`);
  return vm.runInNewContext(`(${block[1]})`);
}

const faces = readTable("JOURNAL_GUEST_FACE");
const arts = readTable("STORY_PORTRAIT_ART");

const IMAGE = { width: 1250, height: 1800 };   // js/story.js 의 JOURNAL_GUEST_ART_SIZE
const BOX_RATIO = 1;                           // css/settings.css 의 초상화 상자(1/1)
const TILE = 200;
const GAP = 10;
// 평가마다 표정이 다릅니다(js/story.js 의 JOURNAL_GUEST_TIER_MOTION).
// 자를 자리도 표정을 같이 보므로 네 가지를 한 장에 나란히 뽑습니다.
const MOTIONS = [["calm", "01", "평가 없음"], ["soft", "02", "맛있다"],
  ["sad", "04", "아쉽다"], ["happy", "07", "완벽"]];

const outFile = process.argv[2] || path.join(root, "tools", ".out", "journal-faces.png");

// 게임과 같이 원으로 자르고 테두리를 둘러야 정수리가 잘리는지 보입니다.
function circleOverlay(label) {
  return Buffer.from(`<svg width="${TILE}" height="${TILE}">`
    + `<circle cx="${TILE / 2}" cy="${TILE / 2}" r="${TILE / 2 - 2}" fill="none" stroke="#92633b" stroke-width="4"/>`
    + `<text x="8" y="18" font-size="13" fill="#7a4a20">${label}</text></svg>`);
}
const circleMask = Buffer.from(
  `<svg width="${TILE}" height="${TILE}"><circle cx="${TILE / 2}" cy="${TILE / 2}" r="${TILE / 2}" fill="#fff"/></svg>`);

(async () => {
  const ids = Object.keys(faces);
  const tiles = [];
  for (const [row, id] of ids.entries()) {
    const art = arts[id];
    if (!art) throw new Error(`STORY_PORTRAIT_ART 에 ${id} 원화가 없습니다.`);
    const notes = [];
    for (const [column, [motion, index, label]] of MOTIONS.entries()) {
      const box = { ...faces[id], ...(faces[id].byMotion?.[motion] || {}) };
      const height = Math.round(box.fh / 100 * IMAGE.height);
      const width = Math.round(height * BOX_RATIO);
      const left = Math.round(box.cx / 100 * IMAGE.width - width / 2);
      const top = Math.round(box.cy / 100 * IMAGE.height - height / 2);
      if (left < 0 || top < 0 || left + width > IMAGE.width || top + height > IMAGE.height) {
        console.warn(`⚠️ ${id}/${motion}: 자를 자리가 원화 밖으로 나갑니다 (${left},${top} ${width}x${width})`);
      }
      const file = path.join(root, "assets", "Conversation", art.dir, `${art.stem}_motion_${index}.webp`);
      const face = await sharp(file)
        .extract({
          left: Math.max(0, left), top: Math.max(0, top),
          width: Math.min(width, IMAGE.width - Math.max(0, left)),
          height: Math.min(height, IMAGE.height - Math.max(0, top))
        })
        .resize(TILE, TILE, { fit: "fill" })
        .flatten({ background: "#f0e6d2" })
        .png().toBuffer();
      const round = await sharp(face).composite([{ input: circleMask, blend: "dest-in" }]).png().toBuffer();
      tiles.push({
        input: await sharp(round).composite([{ input: circleOverlay(column === 0 ? id : label) }]).png().toBuffer(),
        left: column * (TILE + GAP) + GAP,
        top: row * (TILE + GAP) + GAP
      });
      notes.push(`${motion} ${box.cx}/${box.cy}/${box.fh}`);
    }
    console.log(`${id.padEnd(14)} ${notes.join("  ")}`);
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await sharp({
    create: {
      width: (TILE + GAP) * MOTIONS.length + GAP,
      height: (TILE + GAP) * ids.length + GAP,
      channels: 3, background: "#e8dcc2"
    }
  }).composite(tiles).png().toFile(outFile);
  console.log(`\nJOURNAL_FACE_PREVIEW_OK ${ids.length}명 x ${MOTIONS.length}표정 → ${path.relative(root, outFile)}`);
})();
