"use strict";

/* ============================================================
   캐릭터 스프라이트시트 2× PNG → 1× 무손실 WebP 변환
   ------------------------------------------------------------
   사용법:
     npm install                          (1회 · sharp 설치)
     node tools/build-chef-sprites.js
     node tools/build-chef-sprites.js --verify   변환 없이 검증만

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지)

   [왜 1× 로 줄이나]
   받은 2× PNG 는 1× 원본을 NEAREST 로 2배 확대한 것입니다.
   즉 2×2 블록 안의 네 픽셀이 전부 같은 값이라 정보량이 1× 와 동일합니다.
   그대로 쓰면 텍스처 메모리만 4배(약 79MB) 먹으므로 1× 로 되돌립니다.
   이 스크립트는 그 전제(2×2 블록 균일성)를 매번 검사해서 로그로 알려줍니다.

   [왜 sharp 의 resize 를 안 쓰나]
   libvips 는 축소할 때 블록 평균(shrink)을 먼저 걸 수 있어서
   kernel:nearest 를 줘도 NEAREST 가 보장되지 않습니다.
   그래서 raw 픽셀에서 직접 2칸씩 건너뛰어 뽑습니다. 위상(0,0) 고정.

   파일명을 하드코딩하지 않습니다. SRC_DIR 안의 PNG 를 전부 순회하므로
   시트가 늘어나면 파일만 넣고 다시 실행하면 됩니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC_DIR = path.join(__dirname, "..", "assets", "character", "sprites");

const DIVISOR = 2;      // 2× → 1×
const EFFORT  = 6;      // cwebp -m 6. 느리지만 파일이 더 작아집니다.

// 변환 결과가 프레임 격자에 딱 떨어지는지 확인할 1× 셀 크기입니다.
// 규격이 다른 시트가 들어오면 이 값만 고치면 됩니다.
const FRAME_W = 192;
const FRAME_H = 320;

const files = fs.readdirSync(SRC_DIR).filter(name => name.endsWith(".png")).sort();

const kb = bytes => Math.round(bytes / 1024);
const outPathOf = src => src.replace(/\.png$/, ".webp");


/* ------------------------------------------------------------
   1. 2× → 1× NEAREST 다운샘플
   ------------------------------------------------------------
   반환값의 blocks 는 "2×2 블록이 균일했는가" 통계입니다.
   nonUniform 이 0 이 아니면 원본이 NEAREST 확대본이 아니라는 뜻이고,
   그때는 1× 로 줄이면서 실제로 정보가 사라집니다.
   ------------------------------------------------------------ */

function downsample(data, width, height){
  const outW = width / DIVISOR;
  const outH = height / DIVISOR;
  const out = Buffer.allocUnsafe(outW * outH * 4);

  let nonUniform = 0;
  let maxDeviation = 0;

  for(let y = 0; y < outH; y++){
    for(let x = 0; x < outW; x++){
      const src = ((y * DIVISOR) * width + (x * DIVISOR)) * 4;
      const dst = (y * outW + x) * 4;
      for(let c = 0; c < 4; c++) out[dst + c] = data[src + c];

      // 같은 2×2 블록의 나머지 세 픽셀이 대표 픽셀과 같은지 확인
      let blockDiff = 0;
      for(let dy = 0; dy < DIVISOR; dy++){
        for(let dx = 0; dx < DIVISOR; dx++){
          const p = ((y * DIVISOR + dy) * width + (x * DIVISOR + dx)) * 4;
          for(let c = 0; c < 4; c++) blockDiff = Math.max(blockDiff, Math.abs(data[p + c] - out[dst + c]));
        }
      }
      if(blockDiff > 0){ nonUniform++; maxDeviation = Math.max(maxDeviation, blockDiff); }
    }
  }

  return { out, outW, outH, blocks:{ total:outW * outH, nonUniform, maxDeviation } };
}


/* ------------------------------------------------------------
   2. 변환
   ------------------------------------------------------------ */

async function convert(){
  let pngTotal = 0, webpTotal = 0;
  console.log("\n변환 (2× PNG → 1× 무손실 WebP)");
  console.log("파일".padEnd(26), "2× PNG".padStart(12), "1× WebP".padStart(12), "절감".padStart(7),
              "블록 균일".padStart(10));

  for(const name of files){
    const src = path.join(SRC_DIR, name);
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject:true });

    if(info.width % DIVISOR || info.height % DIVISOR){
      console.log(name.padEnd(26), `크기가 ${DIVISOR} 로 나눠떨어지지 않습니다: ${info.width}×${info.height}`);
      continue;
    }

    const { out, outW, outH, blocks } = downsample(data, info.width, info.height);

    await sharp(out, { raw:{ width:outW, height:outH, channels:4 } })
      .webp({ lossless:true, effort:EFFORT, alphaQuality:100 })
      .toFile(outPathOf(src));

    const a = fs.statSync(src).size, b = fs.statSync(outPathOf(src)).size;
    pngTotal += a; webpTotal += b;

    const uniform = blocks.nonUniform === 0
      ? "100%"
      : `${(100 - blocks.nonUniform / blocks.total * 100).toFixed(2)}%(최대차 ${blocks.maxDeviation})`;

    console.log(name.padEnd(26), `${kb(a)}KB`.padStart(12), `${kb(b)}KB`.padStart(12),
                `${Math.round((1 - b / a) * 100)}%`.padStart(7), uniform.padStart(10));
  }

  console.log("-".repeat(72));
  console.log("합계".padEnd(26), `${kb(pngTotal)}KB`.padStart(12), `${kb(webpTotal)}KB`.padStart(12),
              `${Math.round((1 - webpTotal / pngTotal)*100)}%`.padStart(7));
}


/* ------------------------------------------------------------
   3. 검증
   ------------------------------------------------------------
   · 출력이 입력의 정확히 1/2 인가
   · 프레임 격자(192×320)로 나눠떨어지는가
   · 알파 채널이 살아 있는가
   · 무손실인가 — 기대한 다운샘플 결과와 바이트 단위로 같은가
     (투명 픽셀 RGB 까지 비교합니다. libwebp 가 투명부 RGB 를 지우면
      캔버스 보간 때 흰/검은 헤일로가 생기므로 여기서 반드시 잡아야 합니다)
   ------------------------------------------------------------ */

async function verify(){
  console.log("\n검증");
  console.log("파일".padEnd(26), "1× 크기".padStart(11), "격자".padStart(6),
              "알파".padStart(5), "프레임".padStart(7), "무손실".padStart(18));

  let allOk = true;

  for(const name of files){
    const src = path.join(SRC_DIR, name);
    const out = outPathOf(src);
    if(!fs.existsSync(out)){ console.log(name.padEnd(26), "WebP 없음"); allOk = false; continue; }

    const [pngRaw, webpRaw, webpMeta] = await Promise.all([
      sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject:true }),
      sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject:true }),
      sharp(out).metadata()
    ]);

    const expected = downsample(pngRaw.data, pngRaw.info.width, pngRaw.info.height);

    const halfOk  = webpRaw.info.width === expected.outW && webpRaw.info.height === expected.outH;
    const gridOk  = webpRaw.info.width % FRAME_W === 0 && webpRaw.info.height % FRAME_H === 0;
    const alphaOk = webpMeta.hasAlpha === true;

    // 무손실 여부 — 알파 / 불투명부 RGB / 투명부 RGB 를 나눠서 봅니다
    let alphaMax = 0, rgbMax = 0, clearRgbMax = 0;
    if(halfOk){
      for(let i = 0; i < expected.out.length; i += 4){
        alphaMax = Math.max(alphaMax, Math.abs(expected.out[i+3] - webpRaw.data[i+3]));
        for(let c = 0; c < 3; c++){
          const d = Math.abs(expected.out[i+c] - webpRaw.data[i+c]);
          if(expected.out[i+3] === 0) clearRgbMax = Math.max(clearRgbMax, d);
          else rgbMax = Math.max(rgbMax, d);
        }
      }
    }

    const cols = webpRaw.info.width / FRAME_W, rows = webpRaw.info.height / FRAME_H;
    const lossless = alphaMax === 0 && rgbMax === 0
      ? (clearRgbMax === 0 ? "완전일치" : `투명부RGB차 ${clearRgbMax}`)
      : `알파 ${alphaMax} / RGB ${rgbMax}`;

    const ok = halfOk && gridOk && alphaOk && alphaMax === 0 && rgbMax === 0;
    if(!ok) allOk = false;

    console.log(name.padEnd(26),
      `${webpRaw.info.width}×${webpRaw.info.height}`.padStart(11),
      (gridOk ? "OK" : "실패").padStart(6),
      (alphaOk ? "OK" : "없음").padStart(5),
      `${cols}×${rows}`.padStart(7),
      lossless.padStart(18));
  }

  console.log("-".repeat(72));
  console.log(allOk ? "전부 통과" : "실패 항목 있음 — 위 표를 확인하세요");
  if(!allOk) process.exitCode = 1;
}

(async () => {
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error => { console.error(error); process.exit(1); });
