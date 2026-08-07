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

   원본은 프레임을 가로로 이어 붙인 한 장이고 캐릭터는 뒷모습으로 앉아
   있습니다. 발바닥이 아래변(y=799)에 붙어 있어서 두 모션의 세로가 맞습니다.
   프레임 수는 파일 폭 / 288 로 읽으므로 늘거나 줄어도 그대로 돕니다.

   [나가는 것]  모션마다 시트 한 장. 가로 = 프레임, 세로 = 캐릭터 8명.
     assets/customer/customer_common_idle.webp
     assets/customer/customer_common_eat.webp
   customers.js 의 CUSTOMER_COMMON.motions 가 이 파일들을 읽습니다.

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   시트는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.

   [왜 가로를 다시 맞추나]  ★ 여기가 이 스크립트의 핵심입니다
   원본의 캐릭터는 288 간격 격자에 놓여 있지 않습니다. 실측한 간격은
   장마다 245~292 로 제각각이고, 한 장 안에서도 프레임마다 다릅니다.
   그대로 288 로 잘라 쓰면 프레임이 넘어갈 때마다 캐릭터가 좌우로
   최대 85px(화면 76px) 씩 튑니다. 앉아 있는 손님이 옆으로 미끄러집니다.

   그래서 288 로 자르지 않고, 완전히 투명한 세로 줄을 경계로 캐릭터를
   한 명씩 떼어낸 다음 셀 한가운데에 다시 놓습니다.

   기준점은 신발(y 755 아래)의 가로 중심입니다. 실루엣 전체의 중심을
   쓰면 안 됩니다. 식사 모션은 젓가락 든 팔이 옆으로 뻗어서 프레임마다
   중심이 흔들리고, 그러면 몸이 팔 방향으로 끌려다닙니다. 발은 애니메이션
   내내 제자리라 두 모션을 같은 축에 맞출 수 있는 유일한 부분입니다.

   [셀 폭을 288 → 344 로 넓힌 이유]
   신발 중심을 축으로 놓고 보면 젓가락이 오른쪽으로 최대 164 까지 뻗습니다.
   288 이면 젓가락 끝이 잘립니다. 좌우 172씩 = 344 면 8px 여유를 두고 들어갑니다.
   여유가 모자라면 아래 ALIGN_CELL_W 를 키우세요. 부족하면 빌드가 멈춥니다.
   (화면에 그리는 크기는 customers.js 가 셀 비율에서 계산하므로 여기만
    고치면 됩니다. 캐릭터가 갑자기 홀쭉해지거나 하지 않습니다)

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

const SRC_CELL_W    = 288;   // 원본이 전제한 프레임 간격. 프레임 수 = 파일 폭 / 이 값
const ALIGN_CELL_W  = 344;   // 정렬 후 셀 폭(원본 기준). 짝수여야 합니다
const SHOE_BAND_TOP = 755;   // 이 아래를 신발로 봅니다. 정렬 기준선
const CROP_TOP      = 236;   // 이 위쪽은 전부 투명이라 잘라냅니다 (실측 최소 머리끝 240)
const DIVISOR       = 2;     // 2x2 평균으로 절반 축소
const EFFORT        = 6;     // cwebp -m 6. 느리지만 파일이 더 작아집니다.

const srcDirOf  = motion => path.join(ASSET_DIR, "Common", motion.dir);
const outPathOf = motion => path.join(ASSET_DIR, motion.out);
const filesOf   = motion => fs.readdirSync(srcDirOf(motion))
  .filter(name => name.endsWith(motion.suffix)).sort();

const kb = bytes => Math.round(bytes / 1024);


/* ------------------------------------------------------------
   1. 가로 정렬 — 캐릭터를 한 명씩 떼어 셀 한가운데로
   ------------------------------------------------------------
   1) 완전히 투명한 세로 줄을 경계로 덩어리(캐릭터)를 나눕니다.
   2) 덩어리마다 신발 띠의 가로 중심을 잽니다.
   3) 그 중심이 셀 한가운데(ALIGN_CELL_W/2)에 오도록 옮겨 그립니다.

   덩어리 수가 기대한 프레임 수와 다르면 멈춥니다. 젓가락이 옆 프레임에
   닿아서 두 명이 하나로 붙었거나, 원본 규격이 바뀌었다는 뜻입니다.
   그대로 진행하면 프레임이 밀려서 엉뚱한 그림이 나옵니다.
   ------------------------------------------------------------ */

function alignFrames(data, width, height, expectedFrames, label){
  // 세로 한 줄이라도 불투명하면 그 x 는 "차 있음"
  const filled = new Array(width).fill(false);
  for(let y = 0; y < height; y++)
    for(let x = 0; x < width; x++)
      if(data[(y * width + x) * 4 + 3] > 8) filled[x] = true;

  const islands = [];
  for(let x = 0, start = -1; x <= width; x++){
    const on = x < width && filled[x];
    if(on && start < 0) start = x;
    if(!on && start >= 0){ islands.push([start, x - 1]); start = -1; }
  }
  if(islands.length !== expectedFrames)
    throw new Error(`${label} 캐릭터 덩어리가 ${islands.length}개입니다. 프레임 ${expectedFrames}개와 다릅니다.`);

  const outW = ALIGN_CELL_W * expectedFrames;
  const out = Buffer.alloc(outW * height * 4);      // 0 = 완전 투명
  let tightest = Infinity;

  islands.forEach(([x0, x1], index) => {
    // 신발 띠의 가로 중심 = 정렬 기준. 팔이 닿지 않는 유일한 부분입니다.
    let s0 = Infinity, s1 = -1;
    for(let y = SHOE_BAND_TOP; y < height; y++)
      for(let x = x0; x <= x1; x++)
        if(data[(y * width + x) * 4 + 3] > 8){ if(x < s0) s0 = x; if(x > s1) s1 = x; }
    if(s1 < 0) throw new Error(`${label} ${index}번 프레임에 신발이 없습니다 (y ${SHOE_BAND_TOP} 아래가 비었습니다).`);

    const center = Math.round((s0 + s1) / 2);
    const half   = ALIGN_CELL_W / 2;
    tightest = Math.min(tightest, half - (center - x0), half - (x1 - center));
    if(center - x0 > half || x1 - center > half)
      throw new Error(`${label} ${index}번 프레임이 셀 폭 ${ALIGN_CELL_W} 를 넘습니다 `
        + `(왼쪽 ${center - x0} / 오른쪽 ${x1 - center}). ALIGN_CELL_W 를 `
        + `${2 * Math.max(center - x0, x1 - center)} 이상으로 키우세요.`);

    // 셀 왼쪽 끝이 원본의 어느 x 에 해당하는가
    const shift = index * ALIGN_CELL_W + half - center;
    for(let y = 0; y < height; y++){
      const src = (y * width + x0) * 4;
      const dst = (y * outW + x0 + shift) * 4;
      data.copy(out, dst, src, src + (x1 - x0 + 1) * 4);
    }
  });

  return { out, outW, margin:tightest };
}


/* ------------------------------------------------------------
   2. 자르기 + 2x2 평균 축소
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
   3. 변환
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
  console.log("파일".padEnd(26), "원본".padStart(12), "프레임".padStart(7), "셀".padStart(11),
              "여백".padStart(6), "잘린 알파".padStart(10));

  let pngTotal = 0, cellW = 0, cellH = 0, cols = 0, tightest = Infinity;
  const rows = [];

  for(const name of files){
    const src = path.join(srcDirOf(motion), name);
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject:true });

    const frames = info.width / SRC_CELL_W;
    if(!Number.isInteger(frames) || (info.height - CROP_TOP) % DIVISOR){
      throw new Error(`${name} 격자에 안 맞습니다: ${info.width}x${info.height} (프레임 간격 ${SRC_CELL_W} 기준)`);
    }
    if(cols && frames !== cols) throw new Error(`${name} 프레임 수가 다른 장과 다릅니다: ${frames} / ${cols}`);
    cols = frames;

    // 288 격자를 믿지 않고 캐릭터를 떼어 셀 한가운데로 다시 놓습니다. (§1)
    const aligned = alignFrames(data, info.width, info.height, frames, name);
    tightest = Math.min(tightest, aligned.margin);

    const { out, outW, outH, clipped } = cropAndShrink(aligned.out, aligned.outW, info.height);
    if(cellW && (outW / cols !== cellW || outH !== cellH))
      throw new Error(`${name} 셀 크기가 다른 장과 다릅니다: ${outW / cols}x${outH}`);
    cellW = outW / cols;
    cellH = outH;
    rows.push(out);
    pngTotal += fs.statSync(src).size;

    console.log(name.padEnd(26), `${info.width}x${info.height}`.padStart(12),
                String(frames).padStart(7), `${cellW}x${cellH}`.padStart(11),
                `${aligned.margin}px`.padStart(6),
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
  console.log(`정렬  셀 가장자리까지 가장 좁은 여백 ${tightest}px `
    + `(0 이 되면 ALIGN_CELL_W ${ALIGN_CELL_W} 를 키우세요)`);

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
   4. 검증
   ------------------------------------------------------------
   · 시트가 격자로 나눠떨어지는가
   · 알파가 살아 있는가
   · 셀마다 캐릭터가 실제로 들어 있고 발바닥이 아래변에 닿는가
     (앉는 높이를 셀 아래변 기준으로 잡기 때문에 여기가 어긋나면
      손님이 의자 위에 떠 보입니다)
   · ★ 신발 중심이 셀 한가운데에 있는가
     한 행 안에서 이게 어긋나면 프레임이 넘어갈 때 손님이 옆으로 미끄러집니다.
     정렬(§1)이 실제로 먹었는지 확인하는 항목이라 제일 중요합니다.
   · 두 모션의 셀 크기·캐릭터 수가 서로 맞는가
   ------------------------------------------------------------ */

const ALIGN_TOLERANCE = 1;   // 신발 중심이 셀 중앙에서 이만큼(px)까지는 봐 줍니다

async function verifyMotion(motion, expectedRows){
  const out = outPathOf(motion);
  if(!fs.existsSync(out)){ console.log(`[${motion.key}] 시트가 없습니다. --verify 없이 한 번 돌리세요.`); return null; }

  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
  const meta = await sharp(out).metadata();

  // 셀 가로세로 비는 정렬 후 원본과 같습니다(가로세로를 같은 배율로 줄이므로).
  // 그래서 행 수만 알면 셀 폭도, 프레임 수도 파일에서 그대로 나옵니다.
  const cellH = info.height / expectedRows;
  const cellW = Math.round(cellH * ALIGN_CELL_W / (800 - CROP_TOP));
  const cols  = info.width / cellW;
  const gridOk = Number.isInteger(cols) && Number.isInteger(cellH);

  console.log(`\n[${motion.key}] ${info.width}x${info.height} → ${cols}열 x ${expectedRows}행 · 셀 ${cellW}x${cellH}`,
    gridOk ? "격자 OK" : "격자 실패", meta.hasAlpha ? "· 알파 OK" : "· 알파 없음");
  if(!gridOk) return null;

  // 셀 아래쪽 이 비율만 신발로 봅니다. 원본 SHOE_BAND_TOP 을 셀 좌표로 옮긴 값.
  const shoeTop = Math.round((SHOE_BAND_TOP - CROP_TOP) * cellH / (800 - CROP_TOP));

  let ok = meta.hasAlpha, worstDrift = 0;
  for(let row = 0; row < expectedRows; row++){
    for(let col = 0; col < cols; col++){
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, s0 = 1e9, s1 = -1;
      for(let y = 0; y < cellH; y++){
        for(let x = 0; x < cellW; x++){
          const p = ((row * cellH + y) * info.width + col * cellW + x) * 4;
          if(data[p + 3] > 8){
            if(x < x0) x0 = x; if(x > x1) x1 = x;
            if(y < y0) y0 = y; if(y > y1) y1 = y;
            if(y >= shoeTop){ if(x < s0) s0 = x; if(x > s1) s1 = x; }
          }
        }
      }
      const empty = x1 < 0;
      const footOk = !empty && y1 >= cellH - 2;       // 발바닥이 아래변에 닿는가
      const headOk = !empty && y0 > 0;                // 머리끝이 잘리지 않았는가
      const edgeOk = !empty && x0 > 0 && x1 < cellW - 1;   // 좌우가 잘리지 않았는가
      const drift  = empty || s1 < 0 ? Infinity : Math.abs((s0 + s1) / 2 - (cellW - 1) / 2);
      const alignOk = drift <= ALIGN_TOLERANCE;
      if(Number.isFinite(drift)) worstDrift = Math.max(worstDrift, drift);

      if(empty || !footOk || !headOk || !edgeOk || !alignOk){
        ok = false;
        console.log(`  ${row}행 ${col}프레임 —`,
          empty     ? "비어 있음"
          : !footOk ? `발이 아래변에서 떴습니다 (y ${y0}..${y1})`
          : !headOk ? "머리끝이 잘렸습니다"
          : !edgeOk ? `좌우가 셀에 닿았습니다 (x ${x0}..${x1} / 폭 ${cellW}) — ALIGN_CELL_W 를 키우세요`
          : `신발 중심이 셀 중앙에서 ${drift.toFixed(1)}px 벗어났습니다 — 프레임 전환 때 옆으로 튑니다`);
      }
    }
  }
  if(ok) console.log(`  ${expectedRows * cols}칸 전부 캐릭터 있음 · 발바닥 아래변 정렬 OK`
    + ` · 가로 정렬 최대 오차 ${worstDrift.toFixed(1)}px`);
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
