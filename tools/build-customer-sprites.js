"use strict";

/* ============================================================
   일반 손님 원화 → 모션별 시트 (WebP)
   ------------------------------------------------------------
   사용법:
     npm install                                   (1회 · sharp 설치)
     npm run build:customer
     npm run verify:customer                        변환 없이 검증만

   [들어오는 것]  캐릭터 8명 x 모션 2종
     assets/customer/Common/char_cust_NN_idle.png       정지  (3프레임)
     assets/customer/Common/eat/char_cust_NN_eat.png    식사  (6프레임)

   원본 셀은 둘 다 288x800 이고 캐릭터는 뒷모습으로 앉아 있습니다.
   발바닥이 셀 아래변(y=799)에 붙어 있어서 두 모션의 세로가 정확히 맞습니다.
   프레임 수는 파일 폭에서 읽으므로(폭 / 288) 늘거나 줄어도 그대로 돕니다.

   [나가는 것]  모션마다 시트 한 장. 가로 = 프레임, 세로 = 캐릭터 8명.
     assets/customer/customer_common_idle.webp
     assets/customer/customer_common_eat.webp
   customers.js 의 CUSTOMER_COMMON.motions 가 이 파일들을 읽습니다.

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   시트는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.

   [왜 자르나]
   모든 프레임이 y 0~239 가 완전 투명입니다(가장 이른 머리끝이 240).
   세로의 30% 가 빈칸이라 그대로 두면 메모리만 먹습니다.
   CROP_TOP 위로는 아무것도 없다는 걸 매번 검사하고 자릅니다.
   두 모션에 같은 값을 쓰기 때문에 잘라도 세로 정렬이 유지됩니다.

   [왜 절반으로 줄이나]
   화면에 그려지는 크기는 셀 폭 기준 87px(논리 좌표)입니다.
   원본 288px 은 과잉이라 절반(144px)으로 줄여도 여전히 여유가 있습니다.

   요리사 시트(build-chef-sprites.js)와 달리 이 원화는 2배 확대본이 아니라
   진짜 1배 그림입니다. 그래서 점 추출이 아니라 2x2 평균으로 줄입니다.
   알파를 곱해 두고 평균한 뒤 되돌립니다. 그냥 평균하면 투명한 부분의
   검은 RGB 가 섞여 들어가 윤곽에 검은 테두리가 생깁니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ASSET_DIR = path.join(__dirname, "..", "assets", "customer");

// key      customers.js 의 모션 이름
// dir      Common 아래 하위 폴더 ("" 면 Common 바로 밑)
// suffix   파일명 꼬리표. 이걸로 그 폴더의 다른 PNG 와 구분합니다
const MOTIONS = [
  { key:"idle", dir:"",    suffix:"_idle.png", out:"customer_common_idle.webp" },
  { key:"eat",  dir:"eat", suffix:"_eat.png",  out:"customer_common_eat.webp"  }
];

const SRC_CELL_W = 288;   // 원본 셀 폭. 프레임 수 = 파일 폭 / 이 값
const CROP_TOP   = 236;   // 이 위쪽은 전부 투명이라 잘라냅니다 (실측 최소 머리끝 240)
const DIVISOR    = 2;     // 2x2 평균으로 절반 축소
const EFFORT     = 6;     // cwebp -m 6. 느리지만 파일이 더 작아집니다.

const srcDirOf  = motion => path.join(ASSET_DIR, "Common", motion.dir);
const outPathOf = motion => path.join(ASSET_DIR, motion.out);
const filesOf   = motion => fs.readdirSync(srcDirOf(motion))
  .filter(name => name.endsWith(motion.suffix)).sort();

const kb = bytes => Math.round(bytes / 1024);


/* ------------------------------------------------------------
   1. 자르기 + 2x2 평균 축소
   ------------------------------------------------------------
   반환값의 clipped 는 "CROP_TOP 위에 알파가 남아 있었는가" 입니다.
   0 이 아니면 새로 들어온 원화의 머리끝이 더 높다는 뜻이고,
   그때는 CROP_TOP 을 내려야 머리가 잘리지 않습니다.
   ------------------------------------------------------------ */

function cropAndShrink(data, width, height){
  const cropH = height - CROP_TOP;
  const outW  = width  / DIVISOR;
  const outH  = cropH  / DIVISOR;
  const out   = Buffer.allocUnsafe(outW * outH * 4);

  let clipped = 0;
  for(let y = 0; y < CROP_TOP; y++)
    for(let x = 0; x < width; x++)
      if(data[(y * width + x) * 4 + 3] > 0) clipped++;

  for(let y = 0; y < outH; y++){
    for(let x = 0; x < outW; x++){
      let r = 0, g = 0, b = 0, a = 0;
      for(let dy = 0; dy < DIVISOR; dy++){
        for(let dx = 0; dx < DIVISOR; dx++){
          const p = ((CROP_TOP + y * DIVISOR + dy) * width + (x * DIVISOR + dx)) * 4;
          const pa = data[p + 3];
          r += data[p    ] * pa;     // 알파를 곱해 두고 더합니다
          g += data[p + 1] * pa;
          b += data[p + 2] * pa;
          a += pa;
        }
      }
      const dst = (y * outW + x) * 4;
      // 완전 투명이면 나눌 수가 없습니다. 어차피 안 보이므로 0 으로 둡니다.
      out[dst    ] = a ? Math.round(r / a) : 0;
      out[dst + 1] = a ? Math.round(g / a) : 0;
      out[dst + 2] = a ? Math.round(b / a) : 0;
      out[dst + 3] = Math.round(a / (DIVISOR * DIVISOR));
    }
  }

  return { out, outW, outH, clipped };
}


/* ------------------------------------------------------------
   2. 변환
   ------------------------------------------------------------
   행 순서 = 파일명 정렬 순서입니다. char_cust_01 이 0행입니다.
   customers.js 의 variant 가 곧 행 번호이고 두 모션이 같은 행을 씁니다.
   그래서 한쪽 폴더에만 파일을 넣거나 빼면 손님 옷이 바뀝니다.
   번호를 건너뛰지 마세요. (아래 검증이 개수 불일치를 잡아 줍니다)
   ------------------------------------------------------------ */

async function convertMotion(motion){
  const files = filesOf(motion);
  if(!files.length) throw new Error(`${srcDirOf(motion)} 에 ${motion.suffix} 파일이 없습니다.`);

  console.log(`\n[${motion.key}] ${files.length}장 → ${motion.out}`);
  console.log("파일".padEnd(26), "원본".padStart(12), "프레임".padStart(7), "셀".padStart(11), "잘린 알파".padStart(10));

  let pngTotal = 0, cellW = 0, cellH = 0, cols = 0;
  const rows = [];

  for(const name of files){
    const src = path.join(srcDirOf(motion), name);
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject:true });

    const frames = info.width / SRC_CELL_W;
    if(!Number.isInteger(frames) || (info.height - CROP_TOP) % DIVISOR){
      throw new Error(`${name} 격자에 안 맞습니다: ${info.width}x${info.height} (셀 폭 ${SRC_CELL_W} 기준)`);
    }
    if(cols && frames !== cols) throw new Error(`${name} 프레임 수가 다른 장과 다릅니다: ${frames} / ${cols}`);
    cols = frames;

    const { out, outW, outH, clipped } = cropAndShrink(data, info.width, info.height);
    if(cellW && (outW / cols !== cellW || outH !== cellH))
      throw new Error(`${name} 셀 크기가 다른 장과 다릅니다: ${outW / cols}x${outH}`);
    cellW = outW / cols;
    cellH = outH;
    rows.push(out);
    pngTotal += fs.statSync(src).size;

    console.log(name.padEnd(26), `${info.width}x${info.height}`.padStart(12),
                String(frames).padStart(7), `${cellW}x${cellH}`.padStart(11),
                (clipped ? `${clipped}px 있음` : "없음").padStart(10));
  }

  // 8행을 세로로 이어 붙입니다. 행마다 raw 버퍼라 그냥 연결하면 됩니다.
  const sheetW = cellW * cols, sheetH = cellH * rows.length;
  await sharp(Buffer.concat(rows), { raw:{ width:sheetW, height:sheetH, channels:4 } })
    .webp({ lossless:true, effort:EFFORT, alphaQuality:100 })
    .toFile(outPathOf(motion));

  const outSize = fs.statSync(outPathOf(motion)).size;
  console.log("-".repeat(76));
  console.log(`시트  ${sheetW}x${sheetH}  (${cols}열 x ${rows.length}행 · 셀 ${cellW}x${cellH})`);
  console.log(`용량  원본 ${kb(pngTotal)}KB → 시트 ${kb(outSize)}KB  (${Math.round((1 - outSize / pngTotal) * 100)}% 절감)`);

  return { cellW, cellH, cols, rows:rows.length, sheetW, sheetH, bytes:outSize, pngBytes:pngTotal };
}

async function convert(){
  const built = {};
  for(const motion of MOTIONS) built[motion.key] = await convertMotion(motion);

  // 두 모션은 같은 격자여야 합니다. 셀 크기나 캐릭터 수가 어긋나면
  // 정지 → 식사로 바뀌는 순간 손님이 튀거나 다른 사람이 됩니다.
  const [base, ...others] = MOTIONS.map(m => ({ key:m.key, ...built[m.key] }));
  for(const other of others){
    if(other.cellW !== base.cellW || other.cellH !== base.cellH)
      throw new Error(`${base.key} 와 ${other.key} 의 셀 크기가 다릅니다: ${base.cellW}x${base.cellH} / ${other.cellW}x${other.cellH}`);
    if(other.rows !== base.rows)
      throw new Error(`${base.key} 와 ${other.key} 의 캐릭터 수가 다릅니다: ${base.rows} / ${other.rows}`);
  }

  const png = MOTIONS.reduce((sum, m) => sum + built[m.key].pngBytes, 0);
  const web = MOTIONS.reduce((sum, m) => sum + built[m.key].bytes, 0);
  const mem = MOTIONS.reduce((sum, m) => sum + built[m.key].sheetW * built[m.key].sheetH * 4, 0);
  const srcMem = MOTIONS.reduce((sum, m) =>
    sum + built[m.key].cols * SRC_CELL_W * 800 * 4 * built[m.key].rows, 0);

  console.log("\n" + "=".repeat(76));
  console.log(`합계  원본 ${kb(png)}KB → 시트 ${kb(web)}KB  (${Math.round((1 - web / png) * 100)}% 절감)`);
  console.log(`메모리 ${Math.round(srcMem / 1048576)}MB → ${Math.round(mem / 1048576)}MB`);
  console.log(`customers.js CUSTOMER_COMMON.motions 에 적을 값: `
    + MOTIONS.map(m => `${m.key} cols ${built[m.key].cols}`).join(" · "));
}


/* ------------------------------------------------------------
   3. 검증
   ------------------------------------------------------------
   · 시트가 격자로 나눠떨어지는가
   · 알파가 살아 있는가
   · 셀마다 캐릭터가 실제로 들어 있고 발바닥이 아래변에 닿는가
     (앉는 높이를 셀 아래변 기준으로 잡기 때문에 여기가 어긋나면
      손님이 의자 위에 떠 보입니다)
   · 두 모션의 셀 크기·캐릭터 수·발바닥 줄이 서로 맞는가
   ------------------------------------------------------------ */

async function verifyMotion(motion, expectedRows){
  const out = outPathOf(motion);
  if(!fs.existsSync(out)){ console.log(`[${motion.key}] 시트가 없습니다. --verify 없이 한 번 돌리세요.`); return null; }

  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
  const meta = await sharp(out).metadata();

  // 셀 가로세로 비는 원본과 같습니다(가로세로를 같은 배율로 줄이므로).
  // 그래서 행 수만 알면 셀 폭도, 프레임 수도 파일에서 그대로 나옵니다.
  const cellH = info.height / expectedRows;
  const cellW = Math.round(cellH * SRC_CELL_W / (800 - CROP_TOP));
  const cols  = info.width / cellW;
  const gridOk = Number.isInteger(cols) && Number.isInteger(cellH);

  console.log(`\n[${motion.key}] ${info.width}x${info.height} → ${cols}열 x ${expectedRows}행 · 셀 ${cellW}x${cellH}`,
    gridOk ? "격자 OK" : "격자 실패", meta.hasAlpha ? "· 알파 OK" : "· 알파 없음");
  if(!gridOk) return null;

  let ok = meta.hasAlpha;
  for(let row = 0; row < expectedRows; row++){
    for(let col = 0; col < cols; col++){
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for(let y = 0; y < cellH; y++){
        for(let x = 0; x < cellW; x++){
          const p = ((row * cellH + y) * info.width + col * cellW + x) * 4;
          if(data[p + 3] > 8){
            if(x < x0) x0 = x; if(x > x1) x1 = x;
            if(y < y0) y0 = y; if(y > y1) y1 = y;
          }
        }
      }
      const empty = x1 < 0;
      const footOk = !empty && y1 >= cellH - 2;       // 발바닥이 아래변에 닿는가
      const headOk = !empty && y0 > 0;                // 머리끝이 잘리지 않았는가
      if(empty || !footOk || !headOk){
        ok = false;
        console.log(`  ${row}행 ${col}프레임 —`,
          empty ? "비어 있음" : (!footOk ? `발이 아래변에서 떴습니다 (y ${y0}..${y1})` : "머리끝이 잘렸습니다"));
      }
    }
  }
  if(ok) console.log(`  ${expectedRows * cols}칸 전부 캐릭터 있음 · 발바닥 아래변 정렬 OK`);
  return { ok, cellW, cellH, cols };
}

async function verify(){
  console.log("\n검증");
  const rows = filesOf(MOTIONS[0]).length;
  const results = {};
  for(const motion of MOTIONS) results[motion.key] = await verifyMotion(motion, rows);

  let allOk = Object.values(results).every(r => r?.ok);

  // 모션 사이 정합
  const list = MOTIONS.map(m => results[m.key]).filter(Boolean);
  if(list.length === MOTIONS.length){
    const same = list.every(r => r.cellW === list[0].cellW && r.cellH === list[0].cellH);
    console.log(`\n모션 간 셀 크기 ${same ? "일치" : "불일치"} (${list.map(r => r.cellW + "x" + r.cellH).join(" / ")})`);
    if(!same) allOk = false;
  }else allOk = false;

  console.log("-".repeat(76));
  console.log(allOk ? "전부 통과" : "실패 항목 있음 — 위 표를 확인하세요");
  if(!allOk) process.exitCode = 1;
}

(async () => {
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error => { console.error(String(error.message || error)); process.exit(1); });
