"use strict";

/* ============================================================
   손님 원화 → 모션별 시트 (WebP)
   ------------------------------------------------------------
   사용법:
     npm install                                   (1회 · sharp 설치)
     npm run build:customer
     npm run verify:customer                        검증만

   [들어오는 것]  세트 2종 x 모션 2종. 세트마다 캐릭터 8명.
     일반 손님   assets/customer/Common/            *_idle.png   3프레임
                 assets/customer/Common/eat/        *_eat.png    6프레임
     특별 손님   assets/customer/Special/Ingame/idle/ *_idle.png 3프레임
                 assets/customer/Special/Ingame/eat/  *_eat.png  6프레임

   특별 손님 원화는 이 폴더(Ingame) 것만 씁니다. 대화씬 초상화와
   영업일지는 다른 에셋(css/story.css 의 시트)을 쓰며 여기와 무관합니다.

   [나가는 것]  세트 x 모션마다 시트 한 장.
   가로 = 프레임, 세로 = 캐릭터 8명.
     assets/customer/customer_common_idle.webp   / _eat.webp
     assets/customer/customer_special_idle.webp  / _eat.webp
   js/customers.js 의 CUSTOMER_ART 가 이 파일들을 읽습니다.

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   시트는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.

   ------------------------------------------------------------
   ★ 이 스크립트가 하는 일은 "규격 맞추기" 입니다
   ------------------------------------------------------------
   받은 원화는 규격이 제각각입니다. 실측하면 이렇습니다.

     캔버스   864~3072 x 759~908   (장마다 다름)
     프레임 간격  245~512           (한 장 안에서도 다름)
     캐릭터 키   559~753            (special_01 만 유별납니다)

   이걸 그대로 격자로 잘라 쓰면 프레임이 넘어갈 때마다 손님이 옆으로
   미끄러지고, 모션이 바뀌면 키가 확 달라집니다. 그래서 격자를 믿지 않고
   캐릭터를 한 명씩 떼어내 다시 배치합니다.

     1) 완전히 투명한 세로 줄을 경계로 캐릭터(섬)를 나눕니다
     2) 캐릭터 키를 TARGET_H 로 맞춥니다 (이미 맞으면 리샘플 안 함)
     3) 발바닥을 셀 아래변에, 몸의 세로축을 셀 한가운데에 놓습니다

   [가로 기준이 왜 신발인가]
   실루엣 전체의 중심을 쓰면 안 됩니다. 식사 모션은 젓가락 든 팔이 옆으로
   뻗어서 프레임마다 중심이 흔들리고, 그러면 몸이 팔 방향으로 끌려다닙니다.
   맨 아래 띠(사람은 신발, special_05 같은 동물은 몸 아랫부분)는 애니메이션
   내내 제자리라 두 모션을 같은 축에 맞출 수 있는 유일한 부분입니다.

   [셀 폭]
   세트마다 다릅니다. 아래 SETS 의 cellW 주석을 보세요.
   남는 자리는 투명이라
   그냥 둬도 됩니다. 화면에 그리는 크기는 js/customers.js 가 셀 비율에서
   계산하므로 여기를 바꿔도 캐릭터가 홀쭉해지거나 하지 않습니다.

   [매트 청소]
   일부 원화에 투명 처리가 덜 된 마젠타(#FF00FF) 픽셀이 남아 있습니다.
   완전히 불투명한 것도 있어서 그대로 두면 화면에 분홍 점으로 보입니다.
   여기서 지우고 몇 개를 지웠는지 보고합니다. 0 이 아니면 원화 쪽에서
   고쳐 주는 편이 좋습니다 — 이건 임시 방편입니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ASSET_DIR = path.join(__dirname, "..", "assets", "customer");

/* 세트마다 셀 폭이 다릅니다. 세트 안에서 제일 넓은 캐릭터에 맞춘 값이고,
   빌드가 매번 남은 여백을 찍어 주므로 0 에 가까워지면 키우면 됩니다.

     common  344   젓가락 든 팔이 한쪽으로 164 까지 뻗습니다
     special 472   셋째 날 '두 그림자'(special_03)가 둘이 붙어 있어 459 필요

   셀이 넓어도 남는 자리는 투명이라 화면에는 영향이 없습니다. 그리는 크기는
   js/customers.js 가 셀 비율에서 계산하므로 여기만 고치면 됩니다.

   key     js/customers.js 의 그림 세트 이름
   motion  모션 이름. 세트 안에서 같은 행 = 같은 캐릭터입니다
   src     assets/customer 아래 원화 폴더
   suffix  파일명 꼬리표. 그 폴더의 다른 PNG 와 구분합니다 */
const SETS = [
  { key:"common", cellW:344, motions:[
    { key:"idle", src:"Common",     suffix:"_idle.png", out:"customer_common_idle.webp" },
    { key:"eat",  src:"Common/eat", suffix:"_eat.png",  out:"customer_common_eat.webp"  }
  ]},
  { key:"special", cellW:472, motions:[
    { key:"idle", src:"Special/Ingame/idle", suffix:"_idle.png", out:"customer_special_idle.webp" },
    { key:"eat",  src:"Special/Ingame/eat",  suffix:"_eat.png",  out:"customer_special_eat.webp"  }
  ]}
];

const SHEETS = SETS.flatMap(set =>
  set.motions.map(motion => ({ set:set.key, cellW:set.cellW, motion:motion.key, ...motion })));

const TARGET_H    = 560;   // 기본 캐릭터 키 (원본 기준)
const HEIGHT_SNAP = 3;     // 이 안쪽 차이는 리샘플하지 않고 발바닥만 맞춥니다
const TOP_MARGIN  = 4;     // 머리 위 여유. 셀 높이 = TARGET_H + 이 값
const CELL_H      = TARGET_H + TOP_MARGIN;
const SHOE_BAND   = .08;   // 캐릭터 키의 아래 이 비율을 "신발"로 봅니다
const DIVISOR     = 2;     // 2x2 평균으로 절반 축소
const EFFORT      = 6;     // cwebp -m 6. 느리지만 파일이 더 작아집니다.

/* 캐릭터별 키 배율
   ------------------------------------------------------------
   원화는 전부 같은 키로 그려져 있습니다. 그래서 덩치 차이는 여기서 냅니다.
   키만 곱하고 발바닥은 그대로 셀 아래변에 두므로, 같은 의자에 앉은 채로
   작아집니다. 말풍선도 §1-2-1 이 머리를 다시 재서 따라 내려옵니다.

   파일명 앞부분으로 찾습니다. 모션(_idle/_eat)과 상관없이 같은 값이
   걸려야 앉아 있다가 먹기 시작할 때 크기가 튀지 않습니다.
   ------------------------------------------------------------ */
const CHARACTER_SCALE = {
  char_cust_special_01: .84,  // 비에 젖은 아이 — 어른 손님보다 작아야 합니다
  char_cust_special_05: .75   // 작은 짐승 — 이름대로 사람보다 작습니다
};

const targetHeightOf = name => {
  const key = Object.keys(CHARACTER_SCALE).find(prefix => name.startsWith(prefix));
  return Math.round(TARGET_H * (key ? CHARACTER_SCALE[key] : 1));
};

/* 좌우가 뒤집혀 들어온 프레임
   ------------------------------------------------------------
   한 프레임만 반대로 그려져 있으면 정지 애니메이션이 도는 동안 그
   프레임에서만 꼬리·팔이 반대편으로 튀어서 깜빡이는 것처럼 보입니다.

   키는 확장자 뺀 파일명, 값은 0부터 세는 프레임 번호입니다.
   원화가 고쳐져 들어오면 여기서 줄을 지우세요. 안 지우면 이번엔
   그 프레임만 반대로 뒤집힙니다.

   찾는 법: 프레임 실루엣을 0번과 겹쳐 보고, 그대로보다 뒤집었을 때
   더 잘 맞으면 뒤집힌 것입니다. 지금 32장 중 아래 한 장만 그렇습니다. */
const FLIP_FRAMES = {
  char_cust_special_05_idle: [1]   // 작은 짐승 — 2번째 프레임만 꼬리가 반대쪽
};

const flipsOf = name => FLIP_FRAMES[name.replace(/\.png$/, "")] || [];

/* 매트로 볼 색.
   "밝고, 빨강·파랑이 세고, 초록만 푹 꺼진" 픽셀 = 마젠타 계열입니다.
   순수 #FF00FF 만 잡으면 부족합니다. 매트 경계는 안티에일리어싱으로
   초록이 40~60 까지 올라오는데, 그걸 남겨 두면 축소할 때 이웃과 섞여
   다시 진한 마젠타로 뭉칩니다. 그래서 비율로 판정합니다.

   실제 그림에 쓰일 만한 색은 안 걸립니다.
     핫핑크 (255,105,180) → 105 > 180*0.45  통과
     고동색 (139, 90, 43) →  90 >  43*0.45  통과
     자주   (150, 40, 60) →  40 >  60*0.45  통과 */
const isMatte = (r, g, b) => r >= 190 && b >= 190 && g <= .45 * Math.min(r, b);

const srcDirOf  = sheet => path.join(ASSET_DIR, ...sheet.src.split("/"));
const outPathOf = sheet => path.join(ASSET_DIR, sheet.out);
const filesOf   = sheet => fs.readdirSync(srcDirOf(sheet))
  .filter(name => name.endsWith(sheet.suffix)).sort();

const kb = bytes => Math.round(bytes / 1024);


/* ------------------------------------------------------------
   1. 매트 청소 + 투명부 RGB 정리
   ------------------------------------------------------------
   투명한데 RGB 가 마젠타로 남아 있는 픽셀이 많습니다. 알파가 0 이면
   화면에는 안 보이지만, 크기를 줄이거나 늘릴 때 이웃 픽셀과 섞이면서
   윤곽에 분홍 테두리로 배어 나옵니다. 그래서 리샘플 전에 0 으로 지웁니다.
   ------------------------------------------------------------ */

function cleanMatte(data){
  let opaqueMatte = 0;
  for(let i = 0; i < data.length; i += 4){
    const matte = isMatte(data[i], data[i + 1], data[i + 2]);
    if(matte && data[i + 3] > 8) opaqueMatte++;
    if(matte || data[i + 3] < 9){ data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0; }
  }
  return opaqueMatte;
}


/* ------------------------------------------------------------
   2. 캐릭터 나누기 + 재배치
   ------------------------------------------------------------
   반환값의 cols 는 찾아낸 캐릭터 수입니다. 호출부가 같은 모션의 다른
   장과 대조해서, 하나라도 다르면 멈춥니다. 젓가락이 옆 프레임에 닿아
   두 명이 하나로 붙었다는 뜻이라 그대로 두면 프레임이 밀립니다.
   ------------------------------------------------------------ */

async function alignFrames(cellW, targetH, flips, data, width, height, label){
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
  if(!islands.length) throw new Error(`${label} 에 캐릭터가 없습니다.`);

  const cols = islands.length;
  const parts = [];
  let tightest = Infinity, resized = 0, flipped = 0;

  for(let index = 0; index < cols; index++){
    const [x0, x1] = islands[index];
    let y0 = Infinity, y1 = -1;
    for(let y = 0; y < height; y++)
      for(let x = x0; x <= x1; x++)
        if(data[(y * width + x) * 4 + 3] > 8){ if(y < y0) y0 = y; if(y > y1) y1 = y; }

    const charH = y1 - y0 + 1;
    const charW = x1 - x0 + 1;

    /* 키가 이미 목표에 가까우면 리샘플하지 않습니다. 원화는 프레임마다
       1~2px 씩 다른 게 정상(숨쉬는 움직임)이라, 그걸 억지로 맞추면
       거의 모든 프레임을 흐리게 다시 그리게 됩니다. 발바닥만 아래변에
       맞추고 남는 1~2px 은 머리 위 여백으로 흘려보냅니다.
       (CHARACTER_SCALE 이 걸린 캐릭터는 목표가 달라서 항상 리샘플됩니다) */
    const snap  = Math.abs(charH - targetH) <= HEIGHT_SNAP;
    const scale = snap ? 1 : targetH / charH;
    const outH  = snap ? charH : targetH;
    const outW  = snap ? charW : Math.max(1, Math.round(charW * scale));

    // 맨 아래 띠의 가로 중심 = 정렬 기준. 팔이 닿지 않는 유일한 부분입니다.
    const bandTop = Math.max(y0, Math.round(y1 - charH * SHOE_BAND));
    let s0 = Infinity, s1 = -1;
    for(let y = bandTop; y <= y1; y++)
      for(let x = x0; x <= x1; x++)
        if(data[(y * width + x) * 4 + 3] > 8){ if(x < s0) s0 = x; if(x > s1) s1 = x; }
    if(s1 < 0) throw new Error(`${label} ${index}번 프레임의 아래쪽 띠가 비었습니다.`);

    // 셀 안에서의 몸 세로축. 뒤집는 프레임은 축도 같이 반대편으로 옮깁니다.
    const flip = flips.includes(index);
    const measured = Math.round(((s0 + s1) / 2 - x0) * scale);
    const axis = flip ? outW - 1 - measured : measured;
    const half = cellW / 2;
    tightest = Math.min(tightest, half - axis, half - (outW - axis));
    if(axis > half || outW - axis > half)
      throw new Error(`${label} ${index}번 프레임이 셀 폭 ${cellW} 를 넘습니다 `
        + `(왼쪽 ${axis} / 오른쪽 ${outW - axis}). 이 세트의 cellW 를 `
        + `${2 * Math.max(axis, outW - axis)} 이상으로 키우세요.`);

    let piece = sharp(data, { raw:{ width, height, channels:4 } })
      .extract({ left:x0, top:y0, width:charW, height:charH });
    if(!snap){
      // 규격이 다른 원화만 여기 들어옵니다.
      piece = piece.resize({ width:outW, height:outH, fit:"fill", kernel:"lanczos3" });
      resized++;
    }
    if(flip){ piece = piece.flop(); flipped++; }

    parts.push({
      input: await piece.png().toBuffer(),
      left:  index * cellW + half - axis,
      top:   CELL_H - outH          // 발바닥을 셀 아래변에
    });
  }

  const rowBuffer = await sharp({
    create:{ width:cellW * cols, height:CELL_H, channels:4, background:{ r:0, g:0, b:0, alpha:0 } }
  }).composite(parts).raw().toBuffer();

  return { row:rowBuffer, rowW:cellW * cols, cols, margin:tightest, resized, flipped };
}


/* ------------------------------------------------------------
   3. 2x2 평균 축소
   ------------------------------------------------------------
   요리사 시트(build-chef-sprites.js)와 달리 이 원화는 2배 확대본이 아니라
   진짜 1배 그림입니다. 그래서 점 추출이 아니라 평균으로 줄입니다.
   알파를 곱해 두고 평균한 뒤 되돌립니다. 그냥 평균하면 투명한 부분이
   섞여 들어가 윤곽이 탁해집니다.
   ------------------------------------------------------------ */

function shrink(data, width, height){
  const outW = width / DIVISOR, outH = height / DIVISOR;
  const out = Buffer.allocUnsafe(outW * outH * 4);

  for(let y = 0; y < outH; y++){
    for(let x = 0; x < outW; x++){
      let r = 0, g = 0, b = 0, a = 0;
      for(let dy = 0; dy < DIVISOR; dy++){
        for(let dx = 0; dx < DIVISOR; dx++){
          const p = ((y * DIVISOR + dy) * width + (x * DIVISOR + dx)) * 4;
          const pa = data[p + 3];
          r += data[p] * pa; g += data[p + 1] * pa; b += data[p + 2] * pa; a += pa;
        }
      }
      const dst = (y * outW + x) * 4;
      out[dst    ] = a ? Math.round(r / a) : 0;
      out[dst + 1] = a ? Math.round(g / a) : 0;
      out[dst + 2] = a ? Math.round(b / a) : 0;
      out[dst + 3] = Math.round(a / (DIVISOR * DIVISOR));
    }
  }
  return { out, outW, outH };
}


/* ------------------------------------------------------------
   4. 변환
   ------------------------------------------------------------
   행 순서 = 파일명 정렬 순서입니다. 01 이 0행입니다.
   js/customers.js 의 행 번호가 곧 그 순서이고, 한 세트의 두 모션이 같은
   행을 씁니다. 한쪽 폴더에만 파일을 넣거나 빼면 손님이 뒤바뀝니다.
   번호를 건너뛰지 마세요. (아래 검증이 개수 불일치를 잡아 줍니다)
   ------------------------------------------------------------ */

async function convertSheet(sheet){
  const files = filesOf(sheet);
  if(!files.length) throw new Error(`${srcDirOf(sheet)} 에 ${sheet.suffix} 파일이 없습니다.`);

  console.log(`\n[${sheet.set} ${sheet.motion}] ${files.length}장 → ${sheet.out}`);
  console.log("파일".padEnd(32), "원본".padStart(11), "프레임".padStart(7),
              "키".padStart(5), "여백".padStart(6), "크기보정".padStart(9), "매트".padStart(7));

  let pngTotal = 0, cols = 0, tightest = Infinity, matteTotal = 0, resizedTotal = 0, flippedTotal = 0;
  const rows = [];

  for(const name of files){
    const src = path.join(srcDirOf(sheet), name);
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject:true });

    const matte = cleanMatte(data);
    matteTotal += matte;

    const targetH = targetHeightOf(name);
    const aligned = await alignFrames(sheet.cellW, targetH, flipsOf(name), data, info.width, info.height, name);
    if(cols && aligned.cols !== cols)
      throw new Error(`${name} 프레임 수가 다른 장과 다릅니다: ${aligned.cols} / ${cols}`);
    cols = aligned.cols;
    tightest = Math.min(tightest, aligned.margin);
    resizedTotal += aligned.resized;
    flippedTotal += aligned.flipped;

    rows.push(shrink(aligned.row, aligned.rowW, CELL_H).out);
    pngTotal += fs.statSync(src).size;

    console.log(name.padEnd(32), `${info.width}x${info.height}`.padStart(11),
                String(aligned.cols).padStart(7),
                (targetH === TARGET_H ? String(targetH) : `${targetH}*`).padStart(5),
                `${aligned.margin}px`.padStart(6),
                (aligned.resized ? `${aligned.resized}프레임` : "없음").padStart(9),
                (matte ? `${matte}px` : "없음").padStart(7));
  }

  const cellW = sheet.cellW / DIVISOR, cellH = CELL_H / DIVISOR;
  const sheetW = cellW * cols, sheetH = cellH * rows.length;
  await sharp(Buffer.concat(rows), { raw:{ width:sheetW, height:sheetH, channels:4 } })
    .webp({ lossless:true, effort:EFFORT, alphaQuality:100 })
    .toFile(outPathOf(sheet));

  const outSize = fs.statSync(outPathOf(sheet)).size;
  console.log("-".repeat(80));
  console.log(`시트  ${sheetW}x${sheetH}  (${cols}열 x ${rows.length}행 · 셀 ${cellW}x${cellH})`);
  console.log(`용량  원본 ${kb(pngTotal)}KB → 시트 ${kb(outSize)}KB  (${Math.round((1 - outSize / pngTotal) * 100)}% 절감)`);
  console.log(`정렬  셀 가장자리까지 가장 좁은 여백 ${tightest}px`
    + (tightest <= 4 ? "  ← 이 세트의 cellW 를 키우세요" : ""));
  if(flippedTotal) console.log(`좌우반전  ${flippedTotal}프레임을 뒤집었습니다 (FLIP_FRAMES)`);
  if(resizedTotal) console.log(`크기보정  ${resizedTotal}프레임 리샘플 `
    + `(원화 규격이 다르다는 뜻입니다)`);
  if(matteTotal) console.log(`매트  불투명 마젠타 ${matteTotal}px 를 지웠습니다 `
    + `← 원화에서 투명 처리가 덜 됐습니다. 다시 뽑아 주는 편이 좋습니다`);

  return { cellW, cellH, cols, rows:rows.length, bytes:outSize, pngBytes:pngTotal, px:sheetW * sheetH };
}

async function convert(){
  const built = {};
  for(const sheet of SHEETS) built[sheet.out] = await convertSheet(sheet);

  // 같은 세트의 두 모션은 셀 크기와 캐릭터 수가 같아야 합니다.
  // 어긋나면 정지 → 식사로 바뀌는 순간 손님이 튀거나 다른 사람이 됩니다.
  for(const set of [...new Set(SHEETS.map(s => s.set))]){
    const list = SHEETS.filter(s => s.set === set).map(s => ({ motion:s.motion, ...built[s.out] }));
    const base = list[0];
    for(const other of list.slice(1)){
      if(other.cellW !== base.cellW || other.cellH !== base.cellH)
        throw new Error(`${set} 의 ${base.motion} 와 ${other.motion} 셀 크기가 다릅니다.`);
      if(other.rows !== base.rows)
        throw new Error(`${set} 의 ${base.motion} 와 ${other.motion} 캐릭터 수가 다릅니다: ${base.rows} / ${other.rows}`);
    }
  }

  const png = SHEETS.reduce((s, x) => s + built[x.out].pngBytes, 0);
  const web = SHEETS.reduce((s, x) => s + built[x.out].bytes, 0);
  const mem = SHEETS.reduce((s, x) => s + built[x.out].px * 4, 0);

  console.log("\n" + "=".repeat(80));
  console.log(`합계  원본 ${kb(png)}KB → 시트 ${kb(web)}KB  (${Math.round((1 - web / png) * 100)}% 절감) · 텍스처 ${Math.round(mem / 1048576)}MB`);
  console.log("js/customers.js CUSTOMER_ART 에 적을 값: "
    + SHEETS.map(s => `${s.set}.${s.motion} cols ${built[s.out].cols}`).join(" · "));
}


/* ------------------------------------------------------------
   5. 검증
   ------------------------------------------------------------
   · 시트가 격자로 나눠떨어지는가 · 알파가 살아 있는가
   · 셀마다 캐릭터가 있고 발바닥이 아래변에 닿는가
     (앉는 높이를 셀 아래변 기준으로 잡기 때문에 어긋나면 손님이 떠 보입니다)
   · 캐릭터 키가 전부 같은가 — 모션이 바뀔 때 커지거나 작아지지 않게
   · ★ 아래 띠의 중심이 셀 한가운데인가
     어긋나면 프레임 전환 때 손님이 옆으로 미끄러집니다. 이게 핵심 항목입니다.
   · 마젠타가 남아 있지 않은가
   ------------------------------------------------------------ */

const ALIGN_TOLERANCE = 1;   // 셀 중앙에서 이만큼(px)까지는 봐 줍니다
const HEIGHT_TOLERANCE = 1;      // 캐릭터 키 편차 허용치(px)
const MATTE_VISIBLE_ALPHA = 128; // 이 알파 이상 남은 마젠타만 실패로 봅니다

async function verifySheet(sheet, expectedRows){
  const out = outPathOf(sheet);
  if(!fs.existsSync(out)){ console.log(`[${sheet.set} ${sheet.motion}] 시트가 없습니다. --verify 없이 한 번 돌리세요.`); return null; }

  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
  const meta = await sharp(out).metadata();

  const cellH = info.height / expectedRows;
  const cellW = sheet.cellW / DIVISOR;
  const cols  = info.width / cellW;
  const gridOk = Number.isInteger(cols) && Number.isInteger(cellH);

  console.log(`\n[${sheet.set} ${sheet.motion}] ${info.width}x${info.height} → ${cols}열 x ${expectedRows}행 · 셀 ${cellW}x${cellH}`,
    gridOk ? "격자 OK" : "격자 실패", meta.hasAlpha ? "· 알파 OK" : "· 알파 없음");
  if(!gridOk) return null;

  let ok = meta.hasAlpha, worstDrift = 0, matte = 0, matteAlpha = 0;
  const rowHeights = [];   // 행(캐릭터)마다 프레임별 키

  for(let row = 0; row < expectedRows; row++){
    rowHeights[row] = [];
    for(let col = 0; col < cols; col++){
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for(let y = 0; y < cellH; y++){
        for(let x = 0; x < cellW; x++){
          const p = ((row * cellH + y) * info.width + col * cellW + x) * 4;
          if(data[p + 3] > 8){
            if(x < x0) x0 = x; if(x > x1) x1 = x;
            if(y < y0) y0 = y; if(y > y1) y1 = y;
            if(isMatte(data[p], data[p + 1], data[p + 2])){ matte++; matteAlpha = Math.max(matteAlpha, data[p + 3]); }
          }
        }
      }
      if(x1 < 0){ ok = false; console.log(`  ${row}행 ${col}프레임 — 비어 있음`); continue; }

      // 아래 띠 중심
      const bandTop = Math.round(y1 - (y1 - y0 + 1) * SHOE_BAND);
      let s0 = 1e9, s1 = -1;
      for(let y = bandTop; y <= y1; y++)
        for(let x = 0; x < cellW; x++){
          const p = ((row * cellH + y) * info.width + col * cellW + x) * 4;
          if(data[p + 3] > 8){ if(x < s0) s0 = x; if(x > s1) s1 = x; }
        }

      const drift = Math.abs((s0 + s1) / 2 - (cellW - 1) / 2);
      worstDrift = Math.max(worstDrift, drift);
      rowHeights[row].push(y1 - y0 + 1);

      const footOk  = y1 >= cellH - 2;
      const headOk  = y0 > 0;
      const edgeOk  = x0 > 0 && x1 < cellW - 1;
      if(!footOk || !headOk || !edgeOk || drift > ALIGN_TOLERANCE){
        ok = false;
        console.log(`  ${row}행 ${col}프레임 —`,
          !footOk ? `발이 아래변에서 떴습니다 (y ${y0}..${y1})`
          : !headOk ? "머리끝이 잘렸습니다"
          : !edgeOk ? `좌우가 셀에 닿았습니다 (x ${x0}..${x1} / 폭 ${cellW}) — 이 세트의 cellW 를 키우세요`
          : `아래 띠 중심이 셀 중앙에서 ${drift.toFixed(1)}px 벗어났습니다 — 프레임 전환 때 옆으로 튑니다`);
      }
    }
  }

  /* 키는 "한 행 안에서" 같아야 합니다. 행끼리는 달라도 됩니다 —
     CHARACTER_SCALE 로 아이를 작게 만드는 것이 그 경우입니다.
     대신 행별 키를 돌려줘서, 같은 세트의 두 모션이 같은 행에서
     같은 키인지 호출부가 대조합니다. (앉았다 먹을 때 크기가 튀지 않게) */
  const heights = rowHeights.map(list => {
    if(!list.length) return 0;
    const spread = Math.max(...list) - Math.min(...list);
    if(spread > HEIGHT_TOLERANCE){
      ok = false;
      console.log(`  ${rowHeights.indexOf(list)}행 키가 ${Math.min(...list)}~${Math.max(...list)} 로 들쭉날쭉합니다 (허용 ${HEIGHT_TOLERANCE}px)`);
    }
    return Math.max(...list);
  });
  if(matte){
    // 원화가 마젠타 배경에 눌려 있으면 윤곽 픽셀에 마젠타가 섞여 있습니다.
    // 그건 원화에서만 고칠 수 있어서, 눈에 보일 만큼 진할 때만 실패로 봅니다.
    const visible = matteAlpha >= MATTE_VISIBLE_ALPHA;
    if(visible) ok = false;
    console.log(`  마젠타 잔여 ${matte}px (최대 알파 ${matteAlpha})`
      + (visible ? " — 눈에 보입니다. 원화를 투명 배경으로 다시 뽑아 주세요"
                 : " — 알파가 낮아 화면에는 안 보입니다. 원화를 다시 뽑으면 완전히 없어집니다"));
  }

  if(ok) console.log(`  ${expectedRows * cols}칸 전부 정상 · 행별 키 ${heights.join("/")} · 가로 정렬 최대 오차 ${worstDrift.toFixed(1)}px`);
  return { ok, cellW, cellH, cols, heights };
}

/* ------------------------------------------------------------
   5-1. 머리끝 표 뽑기
   ------------------------------------------------------------
   js/customers.js §1-2-1 이 읽는 CUSTOMER_HEAD_TOPS 를 찍어 줍니다.
   말풍선·주문 패널이 캐릭터마다 다른 머리 높이를 따라가려면 이 값이
   필요한데, 게임에서 직접 재면 file:// 로 열었을 때 캔버스 픽셀 읽기가
   막혀서(SecurityError) 보정이 통째로 꺼집니다. 그래서 여기서 재고,
   게임은 표만 읽습니다.

   판정 기준은 js/customers.js 와 같습니다 — "제일 위 픽셀"이 아니라
   실루엣 가로폭이 HEAD_WIDTH 에 처음 닿는 줄을 머리끝으로 봅니다.
   가늘게 솟은 머리끝(쪽머리·안테나)에 말풍선이 끌려 올라가지 않게요.

   아래 세 값은 js/customers.js CUSTOMER_ART_BASE 의 headWidth / headBand / h
   와 같아야 합니다. 한쪽만 고치면 표와 게임의 기준이 어긋납니다.
   ------------------------------------------------------------ */

const HEAD_WIDTH = .16;   // = CUSTOMER_ART_BASE.headWidth
const HEAD_BAND  = .35;   // = CUSTOMER_ART_BASE.headBand
const DRAW_H     = 170;   // = CUSTOMER_ART_BASE.h (화면에 그리는 캐릭터 높이)

async function headTopsOf(sheet, expectedRows){
  const { data, info } = await sharp(outPathOf(sheet)).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
  const cellW = sheet.cellW / DIVISOR;
  const cellH = Math.floor(info.height / expectedRows);
  const band    = Math.max(1, Math.round(cellH * HEAD_BAND));
  const minRun  = Math.max(1, Math.round(cellH * HEAD_WIDTH));
  const scale   = DRAW_H / cellH;   // 셀 px → 논리 px

  const tops = [];
  for(let row = 0; row < expectedRows; row++){
    let top = 0;
    for(let y = 0; y < band; y++){
      let solid = 0;
      for(let x = 0; x < cellW; x++)
        if(data[((row * cellH + y) * info.width + x) * 4 + 3] > 128) solid++;
      if(solid >= minRun){ top = y; break; }
    }
    // 0번 프레임 한 장만 봅니다. 프레임마다 재면 숨쉬는 동안 말풍선이 떱니다.
    tops.push(Math.round(top * scale * 10) / 10);
  }
  return tops;
}

async function printHeadTops(){
  const idle = SHEETS.filter(s => s.motion === "idle");
  const table = {};
  for(const sheet of idle){
    if(!fs.existsSync(outPathOf(sheet))) return;
    table[sheet.set] = await headTopsOf(sheet, filesOf(sheet).length);
  }
  const width = Math.max(...Object.keys(table).map(k => k.length));
  console.log("\ncustomers.js CUSTOMER_HEAD_TOPS 에 적을 값 (논리 px · 그림 위변 기준):");
  console.log("const CUSTOMER_HEAD_TOPS = {");
  Object.entries(table).forEach(([set, tops], i, all) => {
    const body = tops.map(v => String(v.toFixed(1)).padStart(4)).join(", ");
    console.log(`  ${(set + ":").padEnd(width + 1)} [${body}]${i < all.length - 1 ? "," : ""}`);
  });
  console.log("};");
}

async function verify(){
  console.log("\n검증");
  let allOk = true;
  const results = {};
  for(const sheet of SHEETS){
    const rows = filesOf(sheet).length;
    results[sheet.out] = await verifySheet(sheet, rows);
    if(!results[sheet.out]?.ok) allOk = false;
  }

  // 세트 안에서 모션끼리 셀 크기와 행별 캐릭터 키가 같아야 합니다.
  // 키가 어긋나면 앉아 있다가 먹기 시작할 때 그 손님만 커지거나 작아집니다.
  for(const set of [...new Set(SHEETS.map(s => s.set))]){
    const list = SHEETS.filter(s => s.set === set).map(s => results[s.out]).filter(Boolean);
    const sameCell = list.length > 1 && list.every(r => r.cellW === list[0].cellW && r.cellH === list[0].cellH);
    const sameHeights = list.length > 1 && list.every(r =>
      r.heights.length === list[0].heights.length
      && r.heights.every((h, i) => Math.abs(h - list[0].heights[i]) <= HEIGHT_TOLERANCE));
    console.log(`\n${set} 모션 간 셀 크기 ${sameCell ? "일치" : "불일치"} (${list.map(r => r.cellW + "x" + r.cellH).join(" / ")})`
      + ` · 행별 키 ${sameHeights ? "일치" : "불일치"} (${list.map(r => r.heights.join("/")).join("  vs  ")})`);
    if(!sameCell || !sameHeights) allOk = false;
  }

  await printHeadTops();

  console.log("-".repeat(80));
  console.log(allOk ? "전부 통과" : "실패 항목 있음 — 위 표를 확인하세요");
  if(!allOk) process.exitCode = 1;
}

(async () => {
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error => { console.error(String(error.message || error)); process.exit(1); });
