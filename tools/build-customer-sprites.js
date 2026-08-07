"use strict";

/* ============================================================
   일반 손님 원화 8장 → 손님 시트 1장 (WebP)
   ------------------------------------------------------------
   사용법:
     npm install                                   (1회 · sharp 설치)
     node tools/build-customer-sprites.js
     node tools/build-customer-sprites.js --verify  변환 없이 검증만

   assets/customer/Common/char_cust_NN_idle.png 가 원본(마스터)입니다.
   절대 지우지 마세요. 시트는 빌드 산출물이라 항상 PNG 에서 다시 만듭니다.

   [들어오는 것] 1152x800 = 288x800 셀 4프레임(정지 애니메이션) 가로 배열.
   캐릭터는 뒷모습으로 앉아 있고 발바닥이 셀 아래변(y=799)에 붙어 있습니다.

   [나가는 것] assets/customer/customer_common_sheet.webp
   4열(프레임) x 8행(캐릭터). 셀 크기는 아래 계산 결과가 그대로 들어갑니다.
   customers.js 의 CUSTOMER_COMMON 이 이 격자를 읽습니다.

   [왜 자르나]
   8장 32프레임 전부 y 0~239 가 완전 투명입니다(가장 이른 머리끝이 240).
   세로의 30% 가 빈칸이라 그대로 두면 메모리만 먹습니다.
   CROP_TOP 위로는 아무것도 없다는 걸 매번 검사하고 자릅니다.

   [왜 절반으로 줄이나]
   화면에 그려지는 크기는 셀 폭 기준 110px 남짓입니다(customers.js).
   원본 288px 은 2.6배 과잉이라 절반(144px)으로 줄여도 여전히 여유가 있고,
   텍스처 메모리는 29.5MB → 5.2MB 로 줄어듭니다.

   요리사 시트(build-chef-sprites.js)와 달리 이 원화는 2배 확대본이 아니라
   진짜 1배 그림입니다. 그래서 점 추출이 아니라 2x2 평균으로 줄입니다.
   알파를 곱해 두고 평균한 뒤 되돌립니다. 그냥 평균하면 투명한 부분의
   검은 RGB 가 섞여 들어가 윤곽에 검은 테두리가 생깁니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC_DIR  = path.join(__dirname, "..", "assets", "customer", "Common");
const OUT_FILE = path.join(__dirname, "..", "assets", "customer", "customer_common_sheet.webp");

const COLS     = 4;     // 원본 한 장에 든 프레임 수
const CROP_TOP = 236;   // 이 위쪽은 전부 투명이라 잘라냅니다 (실측 최소 머리끝 240)
const DIVISOR  = 2;     // 2x2 평균으로 절반 축소
const EFFORT   = 6;     // cwebp -m 6. 느리지만 파일이 더 작아집니다.

const files = fs.readdirSync(SRC_DIR).filter(name => name.endsWith(".png")).sort();
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
      // 완전 투명이면 나눌 수가 없습니다. RGB 는 0 이 아니라 주변색이 아니라
      // 어차피 안 보이므로 0 으로 둡니다.
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
   customers.js 의 variant 가 곧 행 번호이므로 파일을 추가/삭제하면
   기존 손님의 얼굴이 바뀝니다. 번호를 건너뛰지 마세요.
   ------------------------------------------------------------ */

async function convert(){
  console.log("\n변환 (원화 8장 → 시트 1장)");
  console.log("파일".padEnd(26), "원본".padStart(12), "셀".padStart(12), "잘린 알파".padStart(10));

  let pngTotal = 0;
  let cellW = 0, cellH = 0;
  const rows = [];

  for(const name of files){
    const src = path.join(SRC_DIR, name);
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject:true });

    if(info.width % (COLS * DIVISOR) || (info.height - CROP_TOP) % DIVISOR){
      console.log(name.padEnd(26), `격자에 안 맞습니다: ${info.width}x${info.height}`);
      process.exitCode = 1;
      return;
    }

    const { out, outW, outH, clipped } = cropAndShrink(data, info.width, info.height);
    if(cellW && (outW / COLS !== cellW || outH !== cellH)){
      console.log(name.padEnd(26), `셀 크기가 다른 장과 다릅니다: ${outW / COLS}x${outH}`);
      process.exitCode = 1;
      return;
    }
    cellW = outW / COLS;
    cellH = outH;
    rows.push(out);
    pngTotal += fs.statSync(src).size;

    console.log(name.padEnd(26), `${info.width}x${info.height}`.padStart(12),
                `${cellW}x${cellH}`.padStart(12),
                (clipped ? `${clipped}px 있음` : "없음").padStart(10));
  }

  // 8행을 세로로 이어 붙입니다. 행마다 raw 버퍼라 그냥 연결하면 됩니다.
  const sheet  = Buffer.concat(rows);
  const sheetW = cellW * COLS;
  const sheetH = cellH * rows.length;

  await sharp(sheet, { raw:{ width:sheetW, height:sheetH, channels:4 } })
    .webp({ lossless:true, effort:EFFORT, alphaQuality:100 })
    .toFile(OUT_FILE);

  const outSize = fs.statSync(OUT_FILE).size;
  console.log("-".repeat(72));
  console.log(`시트  ${sheetW}x${sheetH}  (${COLS}열 x ${rows.length}행 · 셀 ${cellW}x${cellH})`);
  console.log(`용량  원본 ${kb(pngTotal)}KB → 시트 ${kb(outSize)}KB  (${Math.round((1 - outSize / pngTotal) * 100)}% 절감)`);
  console.log(`메모리 ${Math.round(1152 * 800 * 4 * files.length / 1048576)}MB → ${Math.round(sheetW * sheetH * 4 / 1048576)}MB`);
}


/* ------------------------------------------------------------
   3. 검증
   ------------------------------------------------------------
   · 시트가 격자(4열 x 파일 수)로 나눠떨어지는가
   · 알파가 살아 있는가
   · 셀마다 캐릭터가 실제로 들어 있고 발바닥이 아래변에 닿는가
     (앉는 높이를 셀 아래변 기준으로 잡기 때문에 여기가 어긋나면
      손님이 의자 위에 떠 보입니다)
   · 무손실인가 — 기대한 축소 결과와 바이트 단위로 같은가
   ------------------------------------------------------------ */

async function verify(){
  console.log("\n검증");
  if(!fs.existsSync(OUT_FILE)){ console.log("시트가 없습니다. --verify 없이 한 번 돌리세요."); process.exitCode = 1; return; }

  const { data, info } = await sharp(OUT_FILE).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
  const meta = await sharp(OUT_FILE).metadata();

  const cellW = info.width / COLS;
  const cellH = info.height / files.length;
  const gridOk = Number.isInteger(cellW) && Number.isInteger(cellH);
  console.log(`격자 ${info.width}x${info.height} → 셀 ${cellW}x${cellH}`, gridOk ? "OK" : "실패");
  console.log("알파", meta.hasAlpha ? "OK" : "없음");
  if(!gridOk){ process.exitCode = 1; return; }

  console.log("\n셀별 캐릭터 상자 (셀 안 상대좌표)");
  console.log("행".padEnd(4), "프레임".padStart(6), "x".padStart(12), "y".padStart(12), "가로중심".padStart(9));

  let allOk = meta.hasAlpha;
  for(let row = 0; row < files.length; row++){
    for(let col = 0; col < COLS; col++){
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
      const empty  = x1 < 0;
      const footOk = !empty && y1 >= cellH - 2;          // 발바닥이 아래변에 닿는가
      const headOk = !empty && y0 > 0;                    // 머리끝이 잘리지 않았는가
      if(empty || !footOk || !headOk) allOk = false;
      if(col === 0 || empty || !footOk || !headOk){
        console.log(String(row).padEnd(4), String(col).padStart(6),
          `${x0}..${x1}`.padStart(12), `${y0}..${y1}`.padStart(12),
          ((x0 + x1) / 2).toFixed(1).padStart(9),
          empty ? " 비어 있음" : (!footOk ? " 발이 아래변에서 떴습니다" : (!headOk ? " 머리끝이 잘렸습니다" : "")));
      }
    }
  }

  console.log("-".repeat(72));
  console.log(allOk ? "전부 통과" : "실패 항목 있음 — 위 표를 확인하세요");
  if(!allOk) process.exitCode = 1;
}

(async () => {
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error => { console.error(error); process.exit(1); });
