"use strict";

/* ============================================================
   주방 집기 에셋 PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     npm run build:utensils
     npm run verify:utensils  변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   [대상] assets/utensils 아래 모든 PNG (하위 폴더 포함)
   집기 프랍은 전부 축소해서만 쓰므로(쓰레기통 320x560 → 화면 123x175)
   손실 q90 으로 충분합니다. 축소되면서 압축 아티팩트도 같이 줄어듭니다.

   가로세로 비율은 건드리지 않습니다. 닫힘/열림처럼 상태가 여러 장인 프랍은
   같은 캔버스에 그려져 있어야 겹쳐 놓았을 때 밑동이 어긋나지 않습니다.
   긴 변 축소는 원본 캔버스가 같으면 결과 캔버스도 같으므로 정렬이 유지됩니다.
   (그 검사를 아래 verify 가 같이 합니다)

   [예외 하나 — 스프라이트 시트의 칸 밀림 보정]
   이름이 `_6f` 로 끝나는 시트는 **칸 위치를 옮깁니다.** 이 스크립트에서
   그림에 손대는 곳은 여기뿐이라 따로 적어 둡니다.

   받은 원본 시트 4종은 6칸이 가로로 조금씩 밀려 있습니다. 바닥선은 6칸
   모두 완벽히 같은데(0px) 가로로만 단조롭게 흘러갑니다 — 재보정 전 실측:
     냄비 0→-19px · 후라이팬 0→-19px · 직화구이 0→-18px · 튀김기 0→-22px
   그대로 재생하면 집기가 왼쪽으로 미끄러지다가 루프가 돌 때 튕겨 돌아옵니다.

   그래서 빌드가 칸마다 밀린 양을 재서 **정수 픽셀로 되돌립니다.** 정수
   이동이라 다시 샘플링하지 않고, 따라서 화질 손실이 없습니다. 원본을 다시
   뽑아 밀림이 사라지면 측정값이 0 이 되어 보정도 저절로 없어집니다.
   (재는 방법과 한계는 measureSheetDrift() 주석을 보세요)
   ============================================================ */

/* [긴 변 상한] 원본이 화면에서 쓰이는 크기보다 3~5배 큽니다.
   (예: 냉장고 982x1283 → 화면 293x383, 식기세척기 702x1129 → 136x226)
   그대로 두면 브라우저가 받아만 놓고 버리는 픽셀이 대부분입니다.

   640 = 이 씬에서 가장 큰 집기(냉장고)의 화면 높이 383 의 1.67배.
   나머지 집기는 2.5~3배가 남습니다. 창을 4K 로 키워도(Scale.FIT) 원본을
   확대할 일이 없는 여유값입니다.

   [주의] 집기를 지금보다 크게 그리도록 kitchen.js STATION_ART 의 w 를
   많이 올렸다면 이 값도 같이 올려야 합니다. 화면 크기보다 작아지면
   그때부터 흐려집니다. verify 가 각 파일의 최종 크기를 찍어 줍니다. */
const MAX_EDGE = 640;

/* [스프라이트 시트] 이름이 `_6f` 로 끝나면 가로로 6칸 이어 붙인 시트입니다.
   (fix_pot_cooking_6f = 1668x941, 한 칸 278x941)

   시트는 위 MAX_EDGE 를 쓰지 않습니다. 두 가지가 다르기 때문입니다.

   [1] 긴 변이 "한 칸"이 아니라 "시트 전체"입니다. 1668 을 640 으로 맞추면
       한 칸이 106.7 px 이 되어 정수로 떨어지지 않습니다. 칸을 잘라 쓸 때
       0.7 px 씩 밀리면서 프레임마다 그림이 떨립니다 — 이 시트에서 가장
       피해야 하는 증상입니다. 그래서 시트는 **가로를 칸 수의 배수로만**
       줄입니다. (아래 targetSize)

   [2] 화면에서 쓰는 크기가 낮 에셋보다 큽니다. 밤 조리 연출은 냄비 위
       김·뚜껑까지 한 칸에 들어 있어서, 같은 집기라도 세로로 더 깁니다.
       한 칸 941 px 이 화면 441 px(VIEW) 에 대응하므로 MAX_EDGE 와 같은
       기준(1.67배)이면 736 이 됩니다. 941 은 4K 창(Scale.FIT 2배)에서도
       확대가 걸리지 않는 값이라 그대로 둡니다. */
const SHEET_MAX_EDGE = 941;

// "…_6f.png" → 6. 시트가 아니면 0.
function sheetColumns(file){
  const m = /_(\d+)f\.png$/.exec(file);
  return m ? Number(m[1]) : 0;
}

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..", "assets", "utensils");

const QUALITY = 90;
const EFFORT = 6;   // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

function kb(bytes){ return Math.round(bytes/1024); }

// assets/utensils 아래 모든 PNG (하위 폴더 포함).
function allTargets(dir=ROOT){
  const list=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) list.push(...allTargets(full));
    else if(entry.name.endsWith(".png")) list.push(full);
  }
  return list.sort();
}

const label = src => path.relative(ROOT,src).replace(/\\/g,"/");

/* 긴 변을 상한에 맞춘 목표 크기. 이미 작으면 원본 그대로 둡니다.

   시트(cols>0)는 세로만 SHEET_MAX_EDGE 로 재고, 가로는 그 비율로 줄인 뒤
   **칸 수의 배수로 반올림**합니다. 한 칸이 정수 px 이라야 잘라 쓸 때
   프레임이 밀리지 않습니다. 가로를 칸 수에 맞추느라 세로 비율이 아주 조금
   틀어질 수 있어(≤0.3%), 세로도 같은 비율로 다시 계산해 원본 비율을
   지킵니다 — 안 그러면 6칸을 지나는 동안 그림이 미세하게 늘었다 줄었다 합니다. */
function targetSize(width,height,cols=0){
  if(cols>0){
    if(height<=SHEET_MAX_EDGE) return {width,height};
    const frame=width/cols;
    const frameOut=Math.max(1,Math.round(frame*SHEET_MAX_EDGE/height));
    return {width:frameOut*cols, height:Math.round(height*frameOut/frame)};
  }
  const longest=Math.max(width,height);
  if(longest<=MAX_EDGE) return {width,height};
  const ratio=MAX_EDGE/longest;
  return {width:Math.round(width*ratio), height:Math.round(height*ratio)};
}

/* ------------------------------------------------------------
   스프라이트 시트 칸 밀림 재기
   ------------------------------------------------------------
   [무엇을 재나] 칸 하나가 기준 칸(0번)보다 가로로 몇 px 밀렸는지입니다.
   세로는 재지 않습니다 — 받은 시트 4종 전부 바닥선이 6칸 똑같아서
   (실측 오차 0px) 세로는 이미 맞아 있고, 굳이 건드리면 오히려 흔들립니다.

   [어디를 보나] 하부장만 봅니다. 바닥선에서 위로 20% 올라간 띠입니다.
   불꽃·김·뚜껑·재료는 칸마다 달라야 정상이라 기준으로 쓸 수 없습니다.
   하부장은 연출이 닿지 않아 6칸 모두 같은 그림이어야 합니다.

   [어떻게 재나] 띠 안에서 세로로 다 더해 가로 한 줄짜리 밝기 곡선을 만든 뒤,
   기준 칸의 곡선과 가장 잘 겹치는 이동량을 찾습니다(정규화 상관).
   2차원으로 훑지 않아도 되는 이유는 위에 적은 대로 세로가 이미 맞기
   때문이고, 덕분에 한 칸당 비교가 픽셀 수가 아니라 폭에 비례해 끝납니다.

   [한계] 순수한 평행이동만 잡습니다. 칸마다 몸통 **모양**이 달라지는 것은
   (직화구이는 꼬치 개수까지 바뀝니다) 이동으로 되돌릴 수 없습니다.
   그건 원본을 다시 뽑아야 합니다. 아래 verifySheets() 가 보정 후에도 남은
   흔들림을 찍어 주므로 얼마나 남았는지는 거기서 확인하세요. */
const SHEET_DRIFT_LIMIT = 40;   // 이 이상 밀렸으면 밀림이 아니라 다른 문제로 봅니다

async function measureSheetDrift(src,cols){
  const {data,info}=await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const W=info.width,H=info.height,cellW=W/cols;

  // 기준 칸(0번)의 바닥선 → 하부장 띠
  let bottom=-1;
  for(let y=H-1;y>=0&&bottom<0;y--)
    for(let x=0;x<cellW;x++) if(data[(y*W+x)*4+3]>=128){bottom=y;break;}
  const top=Math.round(bottom*0.80), end=bottom-3;

  // 칸마다 가로 밝기 곡선 (불투명한 픽셀만)
  const curves=[];
  for(let c=0;c<cols;c++){
    const curve=new Float64Array(cellW);
    for(let x=0;x<cellW;x++){
      let sum=0;
      for(let y=top;y<end;y++){
        const i=((y*W)+(c*cellW+x))*4, alpha=data[i+3]/255;
        sum+=(data[i]*0.299+data[i+1]*0.587+data[i+2]*0.114)*alpha;
      }
      curve[x]=sum;
    }
    curves.push(curve);
  }

  /* 기준 곡선과 가장 잘 겹치는 이동량.
     같이 돌려주는 "맞은 정도"는 그 자리에서의 상관계수입니다. 1 에 가까울수록
     두 칸이 순수하게 평행이동 관계라는 뜻이고, 낮으면 칸마다 몸통 모양이
     달라서 애초에 이동으로 맞출 수 없는 시트라는 신호입니다. */
  const scores=[];
  const shifts=curves.map((curve,c)=>{
    if(c===0){scores.push(1);return 0;}
    let best=0,bestScore=-2;
    for(let s=-SHEET_DRIFT_LIMIT;s<=SHEET_DRIFT_LIMIT;s++){
      let n=0,sa=0,sb=0,saa=0,sbb=0,sab=0;
      for(let x=0;x<cellW;x++){
        const xs=x+s; if(xs<0||xs>=cellW)continue;
        const u=curves[0][x],v=curve[xs];
        if(u<=0&&v<=0)continue;
        n++;sa+=u;sb+=v;saa+=u*u;sbb+=v*v;sab+=u*v;
      }
      if(n<cellW*0.5)continue;
      const cov=sab/n-(sa/n)*(sb/n), va=saa/n-(sa/n)**2, vb=sbb/n-(sb/n)**2;
      if(va<=0||vb<=0)continue;
      const score=cov/Math.sqrt(va*vb);
      if(score>bestScore){bestScore=score;best=s;}
    }
    scores.push(bestScore);
    return best;
  });
  return {shifts,scores,cellW,height:H};
}

/* 밀림을 되돌린 시트를 만들어 돌려줍니다 (원본 해상도 PNG 버퍼).
   칸을 오른쪽으로 밀어야 하는 경우가 있어 칸 폭이 넓어집니다. 잘라내지
   않고 넓히는 이유는, 여러 칸이 이미 그림이 칸 경계에 닿아 있어서
   폭을 유지한 채 밀면 김·뚜껑이 잘려 나가기 때문입니다.

   기준 칸(0번)이 새 칸 안에서 어디에 놓였는지도 같이 돌려줍니다 —
   kitchen.js 가 배치 기준으로 쓰는 값이라 바뀌면 알아야 합니다. */
async function dedriftSheet(src,cols){
  const {shifts,scores,cellW,height}=await measureSheetDrift(src,cols);
  const fix=shifts.map(s=>-s);                       // 되돌릴 양
  const lo=Math.min(...fix), hi=Math.max(...fix);
  const outCellW=cellW+(hi-lo);
  const place=fix.map(f=>f-lo);                      // 새 칸 안에서의 x
  const cells=[];
  for(let c=0;c<cols;c++){
    cells.push({input:await sharp(src).extract({left:c*cellW,top:0,width:cellW,height}).png().toBuffer(),
                left:c*outCellW+place[c], top:0});
  }
  const buffer=await sharp({create:{width:outCellW*cols,height,channels:4,
                                    background:{r:0,g:0,b:0,alpha:0}}})
    .composite(cells).png().toBuffer();
  return {buffer, width:outCellW*cols, height, cellW:outCellW, shifts, scores, baseX:place[0]};
}

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(34), "원본".padStart(10), "WebP 크기".padStart(11), "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7));
  const notes=[];
  for(const src of allTargets()){
    const out=src.replace(/\.png$/,".webp");
    const cols=sheetColumns(src);
    // 시트는 칸 밀림을 되돌린 다음 굽습니다. 나머지는 원본 그대로 굽습니다.
    const origin=await sharp(src).metadata();
    const source=cols?(await dedriftSheet(src,cols)):null;
    const input=source?source.buffer:src;
    const meta=source?{width:source.width,height:source.height}:origin;
    const size=targetSize(meta.width,meta.height,cols);
    await sharp(input)
      .resize(size.width,size.height,{kernel:"lanczos3"})     // 원본 = 그대로 통과
      .webp({quality:QUALITY,effort:EFFORT,alphaQuality:100})
      .toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    console.log(label(src).padEnd(34), `${origin.width}x${origin.height}`.padStart(10),
      `${size.width}x${size.height}`.padStart(11),
      `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8), `${Math.round((1-b/a)*100)}%`.padStart(7));
    if(source&&source.shifts.some(s=>s!==0))
      notes.push(`${label(src).padEnd(38)} 되돌린 양 ${source.shifts.map(s=>-s).join(",")}px` +
                 `   칸 폭 ${origin.width/cols}→${source.cellW}` +
                 `   기준칸 x=${source.baseX}` +
                 `   맞은 정도 ${Math.min(...source.scores.slice(1)).toFixed(2)}~${Math.max(...source.scores.slice(1)).toFixed(2)}`);
  }
  if(notes.length){ console.log("\n칸 밀림 보정"); notes.forEach(n=>console.log("  "+n)); }
  console.log("-".repeat(85));
  console.log("합계".padEnd(34), "".padStart(10), "".padStart(11), `${kb(pngTotal)}KB`.padStart(8),
    `${kb(webpTotal)}KB`.padStart(8), `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

/* WebP 가 인코딩 때문에 망가지지 않았는지 확인하고, 불투명 영역 위치도 같이 찍습니다.
   (게임 쪽 배치값이 이 불투명 영역 기준이라 에셋을 다시 받을 때 확인용입니다)

   [비교 기준] 축소는 의도한 변환이므로 오차로 세지 않습니다. 원본 PNG 를
   WebP 와 같은 크기로 같은 커널로 줄인 뒤 비교해서, 순수하게 WebP 인코딩이
   더한 오차만 봅니다.
   [불투명 영역] 원본 PNG 좌표로 찍습니다. kitchen.js STATION_ART 의 body 가
   원본 좌표라서 그대로 옮겨 적을 수 있어야 합니다.

   [시트] 시트는 원본 PNG 가 아니라 **칸 밀림을 되돌린 것**과 비교합니다.
   되돌리기는 의도한 변환이라 오차로 세면 안 되고, 칸 폭도 그때 넓어져서
   원본과는 크기부터 다릅니다. */
async function verify(){
  console.log("\n품질 검증 (같은 크기로 줄인 PNG 대비)");
  console.log("파일".padEnd(34), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8), "  불투명 영역 (원본 좌표)");
  for(const src of allTargets()){
    const out=src.replace(/\.png$/,".webp");
    if(!fs.existsSync(out))continue;
    const meta=await sharp(out).metadata();
    const cols=sheetColumns(src);
    const master=cols?(await dedriftSheet(src,cols)).buffer:src;
    const [a,b,full]=await Promise.all([
      sharp(master).resize(meta.width,meta.height,{kernel:"lanczos3"}).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(out).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(master).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    ]);
    if(a.data.length!==b.data.length){ console.log(label(src),"크기 불일치!"); continue; }

    let alphaMax=0,rgbSum=0,rgbMax=0,rgbCount=0;
    for(let i=0;i<a.data.length;i+=4){
      alphaMax=Math.max(alphaMax,Math.abs(a.data[i+3]-b.data[i+3]));
      if(a.data[i+3]<8)continue;               // 완전 투명 영역의 RGB 는 의미 없음
      for(let c=0;c<3;c++){
        const d=Math.abs(a.data[i+c]-b.data[i+c]);
        rgbSum+=d; rgbMax=Math.max(rgbMax,d); rgbCount++;
      }
    }

    let x0=Infinity,y0=Infinity,x1=-1,y1=-1;
    const width=full.info.width;
    for(let i=0;i<full.data.length;i+=4){
      if(full.data[i+3]<8)continue;
      const p=i/4,x=p%width,y=(p-x)/width;
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
    }
    console.log(label(src).padEnd(34), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8),
      `  ${x0},${y0} ~ ${x1},${y1}  (${x1-x0+1}x${y1-y0+1})`);
  }
}

/* 스프라이트 시트 흔들림 검사.
   ------------------------------------------------------------
   시트는 한 칸씩 잘라서 같은 자리에 번갈아 그립니다. 그래서 칸마다
   집기 몸통이 같은 자리에 있어야 하고, 안 그러면 재생하는 동안 집기가
   덜덜 떨립니다.

   [무엇을 재나] 두 가지입니다.

     바닥선   칸마다 집기가 바닥에 닿는 y. 6칸이 같아야 제자리에 서 있습니다.
     남은 밀림 보정하고도 남은 가로 밀림. 굽기 전 PNG 가 아니라 **구워 낸
              WebP** 를 다시 재서, 실제로 게임이 읽을 파일 기준으로 봅니다.

   남은 밀림은 보정할 때 쓴 것과 같은 자로 잽니다 (measureSheetDrift).
   같은 자로 재야 "22px 이던 게 2px 남았다" 처럼 앞뒤를 견줄 수 있습니다.
   불투명 영역의 좌우 끝 같은 걸로 대신 재면 안 됩니다 — 그 값은 불꽃이
   한 칸에만 길게 뻗어도 수십 px 씩 튀어서, 붙박이인 집기가 흔들리는 것처럼
   나옵니다. 실제로 이 검사를 그렇게 짰다가 한 번 헛짚었습니다.

   [남은 밀림의 뜻] 0~3px 이면 평행이동은 다 잡힌 것입니다. 그보다 크게
   남으면 칸마다 몸통 **모양**이 다르다는 뜻이라 이동으로는 못 고칩니다.
   원본을 다시 뽑아야 합니다.

   [기준] 칸 폭이 정수로 안 떨어지면 그 자체가 실격입니다. 잘라 쓰는 쪽이
   반올림하면서 칸마다 다른 픽셀을 집어 오기 때문입니다. */
async function verifySheets(){
  const sheets=allTargets().filter(src=>sheetColumns(src)>0);
  if(!sheets.length)return;
  console.log("\n스프라이트 시트 흔들림 검사 (칸별 바닥선 · 보정 후 남은 밀림)");
  for(const src of sheets){
    const out=src.replace(/\.png$/,".webp");
    if(!fs.existsSync(out))continue;
    const cols=sheetColumns(src);
    const {data,info}=await sharp(out).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    if(info.width%cols!==0){
      console.log(`${label(src).padEnd(34)} 칸 폭이 정수가 아닙니다: ${info.width}/${cols}`);
      continue;
    }
    const fw=info.width/cols, bottoms=[];
    for(let c=0;c<cols;c++){
      let bottom=-1;
      for(let y=info.height-1;y>=0&&bottom<0;y--)
        for(let x=c*fw;x<(c+1)*fw;x++)
          if(data[(y*info.width+x)*4+3]>=128){bottom=y;break;}
      bottoms.push(bottom);
    }
    const {shifts}=await measureSheetDrift(out,cols);
    const spread=list=>Math.max(...list)-Math.min(...list);
    console.log(`${label(src).padEnd(34)} 칸 ${fw}x${info.height} x${cols}` +
      `  바닥선 ${bottoms.join(",")} (편차 ${spread(bottoms)}px)` +
      `  남은 밀림 ${shifts.join(",")} (최대 ${Math.max(...shifts.map(Math.abs))}px)`);
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
  await verifySheets();
})().catch(error=>{ console.error(error); process.exit(1); });
