"use strict";

/* ============================================================
   요리사 시트 방향별 캐릭터 크기 실측
   ------------------------------------------------------------
   사용법:
     node tools/measure-chef-frames.js

   무엇에 쓰나:
   받은 시트는 방향마다 캐릭터 키가 다릅니다. 그대로 쓰면 방향을 바꾸거나
   걷다 멈출 때 캐릭터가 커졌다 작아집니다. 그래서 js/chef-anim-table.js 가
   방향별 배율을 걸어 크기를 CHEF_TARGET_H 로 맞추는데, 그 표에 넣을
   heights 값을 여기서 뽑습니다. 눈대중으로 적지 마세요.

   재는 법: 한 행(= 한 방향)의 모든 프레임을 겹쳐서 알파 > 임계값인
   픽셀의 바운딩 박스를 구합니다. 걷기처럼 프레임마다 자세가 바뀌는
   모션은 가장 큰 순간이 기준이 돼야 하므로 행 전체를 봅니다.

   출력 맨 아래에 js/chef-anim-table.js 에 그대로 붙여 넣을 수 있는
   heights 줄이 나옵니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC_DIR = path.join(__dirname, "..", "assets", "character", "sprites");

// 1× 셀 크기. 원본 PNG 는 2× 라서 읽을 때 2배로 환산합니다.
const FRAME_W = 192;
const FRAME_H = 320;

// 행 순서. js/chef-anim-table.js 의 dirs 와 같아야 합니다.
const DIRS = ["down", "up", "side"];

// 이보다 옅은 픽셀은 안티에일리어싱 가장자리로 보고 무시합니다.
const ALPHA_THRESHOLD = 16;

const files = fs.readdirSync(SRC_DIR).filter(name => name.endsWith(".png")).sort();


// 한 행 전체를 겹쳐서 알파 바운딩 박스를 구합니다. 좌표는 1× 기준.
function measureRow(data, sheetW, cols, row, cellW, cellH, ratio){
  let top = Infinity, bottom = -1, left = Infinity, right = -1;

  for(let col = 0; col < cols; col++){
    for(let y = 0; y < cellH; y++){
      for(let x = 0; x < cellW; x++){
        const alpha = data[((row * cellH + y) * sheetW + (col * cellW + x)) * 4 + 3];
        if(alpha <= ALPHA_THRESHOLD) continue;
        if(y < top) top = y;
        if(y > bottom) bottom = y;
        if(x < left) left = x;
        if(x > right) right = x;
      }
    }
  }

  if(bottom < 0) return null;   // 빈 행
  return {
    h: (bottom - top + 1) / ratio,
    w: (right - left + 1) / ratio,
    top: top / ratio,
    bottom: (bottom + 1) / ratio
  };
}

(async () => {
  const rows = [];
  let minHeight = Infinity, minLabel = "";

  for(const name of files){
    const { data, info } = await sharp(path.join(SRC_DIR, name)).ensureAlpha().raw().toBuffer({ resolveWithObject:true });

    // 원본이 1× 인지 2× 인지 세로 길이로 판단합니다 (행 수는 DIRS 길이 고정).
    const ratio = info.height / (FRAME_H * DIRS.length);
    if(!Number.isInteger(ratio) || ratio < 1){
      console.log(`${name}: 셀 규격과 맞지 않습니다 (${info.width}×${info.height})`);
      continue;
    }

    const cellW = FRAME_W * ratio, cellH = FRAME_H * ratio;
    const cols = info.width / cellW;

    console.log(`\n== ${name}  (${cols}열 × ${DIRS.length}행 · 원본 ${ratio}×) ==`);
    console.log("방향".padEnd(6), "키".padStart(7), "폭".padStart(7), "머리끝".padStart(8), "발끝".padStart(7));

    const heights = {};
    for(let row = 0; row < DIRS.length; row++){
      const box = measureRow(data, info.width, cols, row, cellW, cellH, ratio);
      if(!box){ console.log(DIRS[row].padEnd(6), "빈 행"); continue; }

      heights[DIRS[row]] = box.h;
      if(box.h < minHeight){ minHeight = box.h; minLabel = `${name} ${DIRS[row]}`; }

      console.log(DIRS[row].padEnd(6),
        String(box.h).padStart(7), String(box.w).padStart(7),
        String(box.top).padStart(8), String(box.bottom).padStart(7));
    }

    rows.push({ file: name.replace(/\.png$/, ""), heights });
  }

  console.log("\n" + "-".repeat(60));
  console.log("js/chef-anim-table.js 의 각 줄에 붙여 넣으세요:\n");
  for(const row of rows){
    const body = DIRS.map(d => `${d}:${String(row.heights[d] ?? "-")}`).join(", ");
    console.log(`  // ${row.file}`);
    console.log(`  heights:{ ${body} }`);
  }
  console.log(`\n가장 작은 값 = ${minHeight} (${minLabel})`);
  console.log(`→ CHEF_TARGET_H 를 ${minHeight} 로 두면 어떤 방향도 확대되지 않습니다.`);
})().catch(error => { console.error(error); process.exit(1); });
