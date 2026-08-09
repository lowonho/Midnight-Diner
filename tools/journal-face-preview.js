"use strict";

/*
  영업일지 초상화의 '얼굴 자리' 확인용 도구입니다.

    node tools/journal-face-preview.js [나갈 파일]

  js/story.js 의 JOURNAL_GUEST_FACE 표를 그대로 읽어, 대화씬 원화 여덟 장에서
  그 자리를 잘라 한 줄로 붙여 줍니다. 게임이 원형틀에 넣는 그림과 같은 자리라
  이 장을 보고 표를 고치면 됩니다. (틀 비율 44/60 도 게임과 같습니다)

  원화를 새로 받았거나 표를 고쳤을 때만 돌리면 됩니다. 결과는 저장소에 남기지
  않습니다 — 기본 저장 위치는 tools/.out/journal-faces.png 입니다.
*/

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const storySource = fs.readFileSync(path.join(root, "js", "story.js"), "utf8");

// 표는 js/story.js 한 곳에만 적습니다. 여기서 베껴 두면 둘이 어긋납니다.
function readTable(name, pattern) {
  const block = storySource.match(new RegExp(`const ${name}\\s*=\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\);`));
  if (!block) throw new Error(`js/story.js 에서 ${name} 을 못 읽었습니다.`);
  const rows = [...block[1].matchAll(pattern)];
  if (!rows.length) throw new Error(`${name} 의 항목을 못 읽었습니다. 표 모양이 바뀌었나요?`);
  return rows;
}

const faces = readTable("JOURNAL_GUEST_FACE",
  /(\w+):\{cx:([\d.]+),cy:([\d.]+),fh:([\d.]+)\}/g)
  .map(([, id, cx, cy, fh]) => ({ id, cx: +cx, cy: +cy, fh: +fh }));
const arts = Object.fromEntries(readTable("STORY_PORTRAIT_ART",
  /(\w+):\{dir:"([^"]+)",stem:"([^"]+)"/g)
  .map(([, id, dir, stem]) => [id, { dir, stem }]));

const IMAGE = { width: 1250, height: 1800 };   // js/story.js 의 JOURNAL_GUEST_ART_SIZE
const BOX_RATIO = 44 / 60;                     // css/settings.css 의 초상화 상자
const TILE = { width: 220, height: 300 };
const MOTION = "02";                           // JOURNAL_GUEST_PORTRAIT_MOTION(soft)

const outFile = process.argv[2] || path.join(root, "tools", ".out", "journal-faces.png");

(async () => {
  const tiles = [];
  for (const [index, face] of faces.entries()) {
    const art = arts[face.id];
    if (!art) throw new Error(`STORY_PORTRAIT_ART 에 ${face.id} 원화가 없습니다.`);
    const file = path.join(root, "assets", "Conversation", art.dir, `${art.stem}_motion_${MOTION}.webp`);
    const height = Math.round(face.fh / 100 * IMAGE.height);
    const width = Math.round(height * BOX_RATIO);
    const left = Math.round(face.cx / 100 * IMAGE.width - width / 2);
    const top = Math.round(face.cy / 100 * IMAGE.height - height / 2);
    if (left < 0 || top < 0 || left + width > IMAGE.width || top + height > IMAGE.height) {
      console.warn(`⚠️ ${face.id}: 자를 자리가 원화 밖으로 나갑니다 (${left},${top} ${width}x${height})`);
    }
    const buffer = await sharp(file)
      .extract({
        left: Math.max(0, left), top: Math.max(0, top),
        width: Math.min(width, IMAGE.width - Math.max(0, left)),
        height: Math.min(height, IMAGE.height - Math.max(0, top))
      })
      .resize(TILE.width, TILE.height, { fit: "fill" })
      .flatten({ background: "#f0e6d2" })
      .png().toBuffer();
    tiles.push({ input: buffer, left: index * TILE.width, top: 0 });
    console.log(`${face.id.padEnd(14)} cx ${face.cx} · cy ${face.cy} · fh ${face.fh}`);
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await sharp({
    create: {
      width: TILE.width * faces.length, height: TILE.height,
      channels: 3, background: "#2a1c12"
    }
  }).composite(tiles).png().toFile(outFile);
  console.log(`\nJOURNAL_FACE_PREVIEW_OK ${faces.length}장 → ${path.relative(root, outFile)}`);
})();
