"use strict";

/* ============================================================
   인게임 HUD UI 에셋(assets/UI/HUD) PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     npm run build:ui-hud
     npm run verify:ui-hud                          변환 결과 품질만 재검사
     node tools/build-ui-hud-webp.js --compare      밝기 후보를 나란히 뽑아 보기

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   tools/build-ui-story-webp.js · tools/build-ui-record-webp.js 와 같은 규칙입니다.

   ------------------------------------------------------------
   [납품본이 이미 화면 자리와 1:1 입니다]  ★ 먼저 읽으세요
   ------------------------------------------------------------
   열한 장 모두 바탕화면 「달빛식탁_HUD_규격」의 실측값을 **정확히 4배** 한
   크기로 왔습니다. 그래서 늘리거나 자를 것이 없고, 크기만 줄여 구우면 됩니다.

     좌측 판 낮   1165x1571 = 291.2 x 392.7 x4      (규격표 15번)
     우측 판 밤   1380x1420 = 344.9 x 355.1 x4      (규격표 22번)
     메뉴 카드     912x525  = 228   x 131.2 x4      (규격표 6번)
     스탯 칸      270x319   = 67.6  x 79.8  x4      (규격표 10번)   … 나머지도 같은 식

   그림이 그 자리를 꽉 채웁니다 — 알파 경계를 재 보면 캔버스 가장자리에서
   1~2px(안티에일리어싱) 안쪽까지가 전부 불투명입니다. 즉 **바깥 그림자 여백이
   없습니다.** CSS 에서 background-size: 100% 100% 로 깔면 원화와 화면이 1:1 입니다.

   ⚠️ 낮 판과 밤 판은 **색이 같고 높이만 다릅니다**(위·아래 200줄 평균색이
      65.5,30.9,13.0 으로 소수점까지 같습니다). 낮/밤 두 장인 이유는 톤이 아니라
      css/hud.css 에 못박힌 판 높이가 서로 달라서입니다 —
        좌측  낮 36.5%(392.7) · 밤 32.7%(351.8)
        우측  낮 20.1%(216.3) · 밤 33%(355.1)
      그 높이를 고치면 아래 SIZE 표도 같이 고쳐야 원화가 눌립니다.

   ------------------------------------------------------------
   [크기 = CSS 크기의 2배]
   ------------------------------------------------------------
   프레임은 창 너비를 꽉 채우므로 4K(3840)에서 --upx 가 정확히 2 입니다.
   2배로 두면 4K 까지는 축소만 하게 됩니다. 4배는 8K 를 넘겨야 쓸모가 생기는데
   파일만 네 배가 되므로 다른 UI 에셋들과 같이 2배로 굽습니다.

   ------------------------------------------------------------
   [메뉴 카드 빼고 일부러 어둡게 굽습니다]  ★ 값을 만질 곳
   ------------------------------------------------------------
   납품본 나뭇결이 「짙은 갈색」 치고는 밝게 왔습니다. HUD 판은 불 켜진 식당
   화면 위에 그대로 얹히고 그 위에 크림색 글자(#ead8b8 · #efc77b)가 올라가므로,
   판이 밝으면 판만 붕 떠 보이고 글자 대비도 떨어집니다.

   그렇다고 전체를 똑같이 곱하면 안쪽 금선과 아이콘(일지 책 · 설정 톱니)까지
   같이 죽습니다. 그래서 **밝기에 따라 다른 배율**을 씁니다 — 어두운 나뭇결은
   WOOD 로 낮추고, 밝은 금선·아이콘은 GOLD 로 거의 그대로 둡니다.

   두 무리가 확실히 갈립니다(불투명 화소의 세 채널 최댓값 기준) —
     나뭇결  p50 = 64 · p90 = 75
     금선    p97 부터 95~230, 설정 톱니는 p90 이 벌써 185
   그래서 SOFT 구간을 나뭇결 위(85)에서 시작해 금선 한가운데(175)에서 끝냅니다.

   ⚠️ 메뉴 카드(ui_hud_menu_card)만 darken 대상이 아닙니다. 크림색 판이고
      (p50 = 253) 그 위에 어두운 글자(#2c1b11)가 올라가는, 성격이 반대인 칸입니다.
      아래 FILES 의 dark:false 가 그 표시입니다.

   후보를 눈으로 비교하려면 --compare 로 한 장에 쌓아 뽑으세요.

   CSS filter 로 어둡게 하지 않는 이유: 판이 배경이고 글자가 자식이라
   filter 를 걸면 판 위의 글자까지 같이 어두워집니다. 구울 때 해결하는 편이
   싸고, 이 저장소의 다른 에셋들과도 같은 방식입니다.

   ------------------------------------------------------------
   [q90 · smartSubsample 인 이유]
   ------------------------------------------------------------
   면적 대부분이 나뭇결이라 q90 에서 열화가 안 보입니다. 다만 판 안쪽 금선은
   채도가 높고 2배 기준 3~4px 로 얇아서 WebP 기본 4:2:0 색 서브샘플링에
   뭉갭니다 — 영업기록 창·대사창과 같은 판단으로 smartSubsample 을 켭니다.
   모서리가 둥글어 알파가 실제로 쓰이므로 alphaQuality 는 100 입니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UI_DIR = path.join(__dirname, "..", "assets", "UI", "HUD");
const OUT_DIR = UI_DIR;

// 위 [메뉴 카드 빼고 일부러 어둡게 굽습니다] 참고. 1 이면 손대지 않은 원본입니다.
const WOOD = 0.55;                  // 나뭇결 밝기 배율 (0.70 에서 한 단계 더 내렸습니다)
const GOLD = 0.92;                  // 금선·아이콘 밝기 배율
const SOFT = [85, 175];             // 이 밝기 구간에서 두 배율이 이어집니다

const QUALITY = 90;
const EFFORT = 6;                   // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

/* out 은 CSS 크기의 2배입니다. 셋째 칸(css)은 근거를 남겨 둔 것이고
   실제 인코딩에는 쓰지 않습니다 — 규격표 번호와 함께 읽으세요. */
const FILES = [
  { file:"ui_hud_logo_panel_4x.png",                        out:"ui_hud_logo_panel.webp",
    size:[582,363], css:"291.2 x 181.5",  dark:true,  why:"규격 2 · 「달빛식탁」 로고 판" },
  { file:"ui_hud_left_panel_day_4x.png",                    out:"ui_hud_left_panel_day.webp",
    size:[582,796], css:"291.2 x 398.1",  dark:true,  why:"규격 15 낮 · 준비 목록 (판 윗여백 5 내리며 36.5% → 37.0%)" },
  { file:"ui_hud_left_panel_night_4x.png",                  out:"ui_hud_left_panel_night.webp",
    size:[582,717], css:"291.2 x 358.3",  dark:true,  why:"규격 15 밤 · 현재 주문 (같은 이유로 32.7% → 33.3%)" },
  { file:"ui_hud_right_panel_day_4x.png",                   out:"ui_hud_right_panel_day.webp",
    size:[690,463], css:"344.9 x 231.3",  dark:true,  why:"규격 22 낮 · 현재 목표 (「다음 작업」 3줄이 구분선에 닿아 20.1% → 21.5%)" },
  { file:"ui_hud_right_panel_night_4x.png",                 out:"ui_hud_right_panel_night.webp",
    size:[690,732], css:"344.9 x 365.8",  dark:true,  why:"규격 22 밤 · 현재 목표 + 영업 기록 (윗여백·칩 여백 늘리며 33% → 34.0%)" },
  { file:"ui_hud_menu_card_4x.png",                         out:"ui_hud_menu_card.webp",
    size:[456,262], css:"228 x 131.2",    dark:false, why:"규격 6 · 메뉴 카드. 3장이 같은 그림 한 장을 씁니다" },
  { file:"ui_hud_day_stat_square_corners_4x.png",            out:"ui_hud_day_stat.webp",
    size:[135,160], css:"67.6 x 79.8",    dark:true,  why:"규격 10 · DAY 칸" },
  { file:"ui_hud_guest_count_stat_square_corners_4x.png",    out:"ui_hud_guest_count_stat.webp",
    size:[203,160], css:"101.4 x 79.8",   dark:true,  why:"규격 11 · 손님 수 칸" },
  { file:"ui_hud_special_guest_stat_square_corners_4x.png",  out:"ui_hud_special_guest_stat.webp",
    size:[223,160], css:"111.5 x 79.8",   dark:true,  why:"규격 12 · 특별 손님 칸" },
  { file:"ui_hud_journal_button_square_corners_4x.png",      out:"ui_hud_journal_button.webp",
    size:[128,160], css:"64.2 x 79.8",    dark:true,  why:"규격 13 · 일지 버튼. **책 아이콘이 그림에 들어 있습니다**" },
  { file:"ui_hud_settings_button_square_corners_4x.png",     out:"ui_hud_settings_button.webp",
    size:[128,160], css:"64.2 x 79.8",    dark:true,  why:"규격 14 · 설정 버튼. **톱니 아이콘이 그림에 들어 있습니다**" }
];

function kb(bytes){ return Math.round(bytes/1024); }

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/* 밝은 화소(금선·아이콘)는 덜, 어두운 화소(나뭇결)는 많이 낮춥니다.
   기준은 세 채널의 최댓값입니다 — 금색은 R·G 가 함께 높고 나뭇결은 R 만
   조금 높은데, 평균을 쓰면 붉은 나뭇결이 금선 쪽으로 끌려 올라갑니다. */
function darken(data, wood, gold){
  for(let i = 0; i < data.length; i += 4){
    if(data[i+3] === 0) continue;
    const level = Math.max(data[i], data[i+1], data[i+2]);
    const f = wood + (gold - wood) * smoothstep(SOFT[0], SOFT[1], level);
    for(let c = 0; c < 3; c++) data[i+c] = Math.min(255, Math.round(data[i+c] * f));
  }
  return data;
}

/* 축소·감광까지가 한 파이프라인입니다.
   검증(verify)도 이 함수를 써야 "인코딩 손실"만 측정됩니다. */
async function prepared(entry, wood = WOOD, gold = GOLD){
  const { data, info } = await sharp(path.join(UI_DIR, entry.file))
    .resize(entry.size[0], entry.size[1], { kernel:"lanczos3", fit:"fill" })
    .ensureAlpha()
    .raw().toBuffer({ resolveWithObject:true });
  return { data: entry.dark ? darken(data, wood, gold) : data, info };
}

function raw({ data, info }){
  return sharp(data, { raw:{ width:info.width, height:info.height, channels:info.channels } });
}

async function convert(){
  console.log(`출력 = CSS 크기 x2 · 밝기 나뭇결 x${WOOD} 금선 x${GOLD} (메뉴 카드는 원본 그대로)\n`);
  console.log("파일".padEnd(30), "원본크기".padStart(11), "출력크기".padStart(10),
    "감광".padStart(5), "PNG".padStart(9), "WebP".padStart(8), "절감".padStart(7));
  let png = 0, webp = 0;
  for(const f of FILES){
    const src = path.join(UI_DIR, f.file);
    const out = path.join(OUT_DIR, f.out);
    if(!fs.existsSync(src)) throw new Error(`원본이 없습니다: ${src}`);
    const meta = await sharp(src).metadata();
    await raw(await prepared(f))
      .webp({ quality:QUALITY, effort:EFFORT, alphaQuality:100, smartSubsample:true })
      .toFile(out);
    const a = fs.statSync(src).size, b = fs.statSync(out).size;
    png += a; webp += b;
    console.log(f.out.padEnd(30), `${meta.width}x${meta.height}`.padStart(11),
      `${f.size[0]}x${f.size[1]}`.padStart(10), (f.dark ? "O" : "-").padStart(5),
      `${kb(a)}KB`.padStart(9), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7));
  }
  console.log("".padEnd(30), "".padStart(11), "합계".padStart(10), "".padStart(5),
    `${kb(png)}KB`.padStart(9), `${kb(webp)}KB`.padStart(8),
    `${Math.round((1-webp/png)*100)}%`.padStart(7));
}

/* 같은 크기로 줄인 무손실 기준본과 WebP 를 픽셀 단위로 비교합니다.

   ⚠️ RGB 오차는 **완전히 불투명한 화소만** 셉니다(다른 빌드 스크립트는 알파 8
      이상을 다 셌습니다). 이 판들은 모서리가 둥글어서 가장자리에 반투명 화소가
      한 줄 있는데, WebP 는 그 자리 RGB 를 알파와 곱해 두는 형식이라 되읽으면
      원본과 크게 어긋납니다 — 화면에서는 그만큼 투명해 보이지 않는 값입니다.
      실제로 q90/q94/q96 어디서도 이 최댓값이 줄지 않았고(113 → 109 → 112),
      반투명 화소를 빼면 최대 25~39 로 정상 범위였습니다. 그래서 여기를 8 로
      두면 품질을 올려도 안 내려가는 숫자를 보며 애먼 quality 만 올리게 됩니다. */
async function verify(){
  console.log("\n품질 검증 (같은 크기로 축소·감광한 무손실 기준본 대비 · 불투명 화소만)");
  console.log("파일".padEnd(30), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const f of FILES){
    const src = path.join(UI_DIR, f.file);
    const out = path.join(OUT_DIR, f.out);
    if(!fs.existsSync(out) || !fs.existsSync(src)) continue;
    const a = await prepared(f);
    const b = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
    if(a.data.length !== b.data.length){ console.log(f.out, "크기 불일치!"); continue; }
    let alphaMax=0, rgbSum=0, rgbMax=0, rgbCount=0;
    for(let i = 0; i < a.data.length; i += 4){
      alphaMax = Math.max(alphaMax, Math.abs(a.data[i+3] - b.data[i+3]));
      if(a.data[i+3] < 255) continue;            // 위 ⚠️ 참고
      for(let c = 0; c < 3; c++){
        const d = Math.abs(a.data[i+c] - b.data[i+c]);
        rgbSum += d; rgbMax = Math.max(rgbMax, d); rgbCount++;
      }
    }
    console.log(f.out.padEnd(30), String(alphaMax).padStart(12),
      (rgbCount ? (rgbSum/rgbCount).toFixed(2) : "-").padStart(9), String(rgbMax).padStart(8));
  }
}

/* 밝기 후보를 한 장에 쌓아 tools/.out 에 내놓습니다(눈으로 보고 버리는 그림).
   판이 놓이는 자리가 불 켜진 식당이라 배경을 아주 검게 두면 실제보다 어두운
   값을 고르게 됩니다 — 어두운 갈색 바탕에서 고릅니다.
   좌측 판 · 우측 판 · 특별 손님 칸 · 설정 버튼 넷을 세로로 쌓습니다
   (금선만 있는 것과 아이콘이 든 것을 같이 봐야 GOLD 를 정할 수 있습니다). */
async function compare(){
  const CANDIDATES = [1, 0.85, 0.78, 0.70, 0.62, 0.54];
  const SHEET = ["ui_hud_left_panel_day.webp", "ui_hud_right_panel_day.webp",
                 "ui_hud_special_guest_stat.webp", "ui_hud_settings_button.webp"];
  const rows = SHEET.map(out => FILES.find(f => f.out === out));
  const SCALE = 0.25, GAP = 12;
  const cols = [];
  for(const wood of CANDIDATES){
    const col = [];
    for(const f of rows){
      const { data, info } = await prepared({ ...f, dark:true },
        wood, Math.max(wood, GOLD));
      col.push(await raw({ data, info })
        .resize(Math.round(f.size[0]*SCALE), Math.round(f.size[1]*SCALE)).png().toBuffer());
    }
    cols.push(col);
  }
  const colW = Math.round(Math.max(...rows.map(f => f.size[0])) * SCALE) + GAP;
  const tops = []; let y = GAP;
  for(const f of rows){ tops.push(y); y += Math.round(f.size[1]*SCALE) + GAP; }
  const items = [];
  cols.forEach((col, ci) => col.forEach((input, ri) =>
    items.push({ input, left: GAP + ci*colW, top: tops[ri] })));
  const dir = path.join(__dirname, ".out");
  fs.mkdirSync(dir, { recursive:true });
  const out = path.join(dir, "hud-panel-brightness.png");
  await sharp({ create:{ width: GAP + colW*CANDIDATES.length, height: y, channels:4,
      background:{ r:34, g:24, b:17, alpha:1 } } })
    .composite(items).png().toFile(out);
  console.log(`왼쪽부터 나뭇결 x${CANDIDATES.join(" / x")} (금선은 늘 x${GOLD})`);
  console.log(out);
}

(async()=>{
  if(process.argv.includes("--compare")){ await compare(); return; }
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
