"use strict";

/* ============================================================
   음식 에셋 PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     npm run build:food
     node tools/build-food-webp.js --verify   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   [대상]
     assets/food/prop/*.png        메뉴 그림 (그림에 딱 맞게 잘린 낱장)
     assets/food/prop_ready/*.png  낮 준비물 그림 (메뉴별 재료 바구니 한 장)
     assets/food/*.png             연출 스프라이트시트 (김·반짝임)

   리사이즈는 하지 않습니다. 배율이 들어가면 food-props.js 의 규격 계산과
   어긋납니다. 투명 여백 잘라내기(trim)만 job 별로 켤 수 있습니다 — 잘라내도
   화면 크기가 안 변하는 이유는 아래 ⚠️ 를 보세요.

   ⚠️ 2026-08-06 메뉴 그림 24장의 **투명 여백을 잘라냈습니다**(원래 전부 264x152).
      이제 장마다 크기가 다릅니다(129x136 ~ 244x136). 화면에 그리는 크기는
      food-props.js 가 **옛 캔버스 264x152 를 자(尺)로 삼아** 계산하므로 그대로입니다
      — 그쪽 FOOD_PROP_SIZE 주석을 함께 보세요.

   ⚠️ 2026-08-08 낮 준비물 그림 8장이 **4배로 업스케일**되어 다시 들어왔습니다
      (전부 1056x608 = 264x152 x4). 자도 4배(food-props.js FOOD_PREP_SIZE)라
      화면에 그리는 크기는 그대로입니다. 이번 원화는 여백까지 꽉 찬 캔버스로
      와서 trim 을 빌드에서 겁니다 — 메뉴 그림처럼 PNG 가 이미 잘려 온 것과
      다른 점입니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const FOOD_DIR = path.join(__dirname, "..", "assets", "food");
const PROP_DIR = path.join(FOOD_DIR, "prop");
const READY_DIR = path.join(FOOD_DIR, "prop_ready");

const EFFORT = 6;   // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

/* 메뉴 그림은 항상 축소해서만 쓰므로(최대 폭 76px) 손실 q90 으로 충분합니다.
   반짝임 시트는 투명 배경 위 고대비 별이라 손실 압축이 별 주변에 링잉을 남깁니다.
   원본이 24KB뿐이라 무손실로 뽑아도 부담이 없어 그렇게 합니다.
   김 시트는 부드러운 그라데이션이라 손실이 잘 먹습니다. */
const JOBS = [
  // 메뉴 그림은 여백을 잘라내 장마다 크기가 다릅니다. 대신 옛 캔버스(264x152)를
  // 넘지는 않아야 합니다 — 넘으면 화면에서 다른 그림보다 커집니다.
  { dir:PROP_DIR, expectMax:{width:264,height:152},           quality:90                 },
  /* 낮 준비물 그림은 4배 원화라 자도 4배입니다(food-props.js FOOD_PREP_SIZE).
     trim 을 켜는 이유: 원화가 여백까지 꽉 찬 1056x608 로 와서, 그대로 두면
     그림자·완료 도장·진행 숫자가 바구니가 아니라 **빈 캔버스 가장자리**를
     기준으로 붙습니다(prep.js drawPrepArt 는 그려진 크기를 받아서 씁니다).
     화면에서는 폭 96px 안으로 줄여 쓰므로 q90 이면 충분합니다. */
  { dir:READY_DIR, expectMax:{width:1056,height:608}, trim:true, quality:90               },
  { dir:FOOD_DIR, file:"fx_steam_loop.png",      frames:8,    quality:90                 },
  { dir:FOOD_DIR, file:"fx_perfect_sparkle.png", frames:6,    lossless:true              }
];

function kb(bytes){ return Math.round(bytes/1024); }

// job 하나가 처리할 파일 목록. file 이 지정되면 그 한 장, 아니면 폴더 전체(하위 폴더 제외).
function filesOf(job){
  if(job.file) return [job.file];
  return fs.readdirSync(job.dir)
    .filter(name => name.endsWith(".png") && fs.statSync(path.join(job.dir,name)).isFile())
    .sort();
}

function allTargets(){
  const list=[];
  JOBS.forEach(job => filesOf(job).forEach(name => list.push({job,name,src:path.join(job.dir,name)})));
  return list;
}

/* 완전히 투명한 바깥 여백을 뺀 알맹이 범위.
   sharp 의 .trim() 을 안 쓰는 이유는 임계값 방식이라 그림 가장자리의
   흐릿한 안티에일리어싱 픽셀까지 같이 깎을 수 있어서입니다. 알파가
   0 인 픽셀만 버리면 그림은 한 픽셀도 안 잘립니다. */
async function alphaBounds(src){
  const {data,info}=await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    if(data[(y*info.width+x)*4+3]===0)continue;
    if(x<left)left=x; if(x>right)right=x;
    if(y<top)top=y;   if(y>bottom)bottom=y;
  }
  if(right<0)return null;   // 전부 투명한 그림. 자르지 않고 그대로 둡니다.
  return { left, top, width:right-left+1, height:bottom-top+1 };
}

// job 설정을 반영한 읽기 파이프라인. convert 와 verify 가 같은 것을 봐야
// 품질 수치가 "자르기 때문에 생긴 차이"로 오염되지 않습니다.
async function sourceOf(job,src){
  const bounds=job.trim?await alphaBounds(src):null;
  const pipeline=sharp(src);
  return bounds?pipeline.extract(bounds):pipeline;
}

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(30), "크기".padStart(10), "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7), "  모드");
  for(const {job,name,src} of allTargets()){
    const out=src.replace(/\.png$/,".webp");
    await (await sourceOf(job,src))
      .webp(job.lossless?{lossless:true,effort:EFFORT}:{quality:job.quality,effort:EFFORT,alphaQuality:100})
      .toFile(out);
    // 규격은 잘라낸 뒤(= 실제로 저장된) 크기로 봅니다.
    const meta=await sharp(out).metadata();
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;

    // 규격 확인. 낱장은 캔버스 크기, 시트는 프레임 나누어떨어짐을 봅니다.
    let warn="";
    if(job.expect&&(meta.width!==job.expect.width||meta.height!==job.expect.height))warn="  ← 규격 다름";
    if(job.expectMax&&(meta.width>job.expectMax.width||meta.height>job.expectMax.height))warn=`  ← 기준 캔버스(${job.expectMax.width}x${job.expectMax.height})보다 큽니다`;
    if(job.frames&&meta.width%job.frames!==0)warn=`  ← ${job.frames}프레임으로 나누어떨어지지 않음`;

    console.log(name.padEnd(30), `${meta.width}x${meta.height}`.padStart(10),
      `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8), `${Math.round((1-b/a)*100)}%`.padStart(7),
      "  "+(job.lossless?"무손실":`q${job.quality}`)+(job.trim?" · 여백 잘라냄":"")+(job.frames?` · ${job.frames}프레임 ${meta.width/job.frames}x${meta.height}`:"")+warn);
  }
  console.log("-".repeat(84));
  console.log("합계".padEnd(30), "".padStart(10), `${kb(pngTotal)}KB`.padStart(8), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 원본 PNG 와 변환된 WebP 를 픽셀 단위로 비교합니다.
async function verify(){
  console.log("\n품질 검증 (원본 PNG 대비)");
  console.log("파일".padEnd(30), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const {job,src} of allTargets()){
    const out=src.replace(/\.png$/,".webp");
    if(!fs.existsSync(out))continue;
    const [a,b]=await Promise.all([
      (await sourceOf(job,src)).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(out).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    ]);
    const name=path.basename(src);
    if(a.data.length!==b.data.length){ console.log(name,"크기 불일치!"); continue; }
    let alphaMax=0,rgbSum=0,rgbMax=0,rgbCount=0;
    for(let i=0;i<a.data.length;i+=4){
      alphaMax=Math.max(alphaMax,Math.abs(a.data[i+3]-b.data[i+3]));
      if(a.data[i+3]<8)continue;               // 완전 투명 영역의 RGB 는 의미 없음
      for(let c=0;c<3;c++){
        const d=Math.abs(a.data[i+c]-b.data[i+c]);
        rgbSum+=d; rgbMax=Math.max(rgbMax,d); rgbCount++;
      }
    }
    console.log(name.padEnd(30), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
