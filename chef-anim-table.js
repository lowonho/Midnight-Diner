"use strict";

/* ============================================================
   요리사 스프라이트시트 정의표
   ------------------------------------------------------------
   담당 범위: 시트 파일 · 격자 규격 · 프레임 구성 · 재생 속도

   담당 범위가 아님: 언제 어떤 모션을 재생할지 → player.js
                     들고 있는 물건의 위치 → chef-carry-temp.js

   [새 모션 추가하는 법]
   1) 1× WebP 를 assets/character/sprites/ 에 넣고
      node tools/build-chef-sprites.js 를 돌린다 (2× PNG 를 넣으면 자동 변환됨)
   2) 아래 CHEF_ANIM_TABLE 에 한 줄 추가한다
   그게 전부입니다. 프레임 인덱스는 dirs 순서 × cols 로 자동 계산되므로
   손으로 적지 마세요.
   ============================================================ */


/* ------------------------------------------------------------
   1. 공통 규격
   ------------------------------------------------------------ */

const CHEF_SHEET_DIR = "assets/character/sprites/";

// 게임이 읽는 건 tools/build-chef-sprites.js 가 만든 1× WebP 입니다.
// 같은 폴더의 2× PNG 가 원본(마스터)이며 지우면 안 됩니다.
// [주의] 확장자만 ".png" 로 바꾸면 안 됩니다. PNG 는 2× 라서 셀 크기가
//        384×640 이 되어 격자가 통째로 어긋납니다. 되돌리려면 변환을 다시 돌리세요.
const CHEF_SHEET_EXT = ".webp";

// Phaser 텍스처 키 = CHEF_TEXTURE_PREFIX + 표의 key
const CHEF_TEXTURE_PREFIX = "chef_";

// 1× 셀 크기. 4장 모두 동일합니다.
const CHEF_FRAME = { w:192, h:320 };

// (0.5, 1.0) = 가로 중앙 · 발바닥. 발끝이 state.player.y 에 정확히 놓입니다.
const CHEF_ORIGIN = { x:0.5, y:1.0 };

// 화면(1920×1080) 기준 배율. 1.0 이면 캐릭터 키가 약 268px 입니다.
// 크기를 조절할 일이 생기면 이 값 하나만 고치세요.
// setDisplaySize 로 가로세로를 따로 주면 비율이 깨지므로 쓰지 않습니다.
const CHEF_SCALE = 1.0;


/* ------------------------------------------------------------
   2. 시트 표
   ------------------------------------------------------------
   key    : 모션 이름. 애니메이션 키는 chef_{key}_{방향} 이 됩니다.
   file   : 확장자 뺀 파일명
   cols   : 한 방향당 프레임 수 (= 시트의 열 수)
   dirs   : 행 순서. 시트의 0행부터 차례로 대응합니다.
   fps    : 재생 속도
   repeat : -1 무한반복 / 0 한 번만

   [행 순서] 4장 모두 0행 down(정면) · 1행 up(뒷모습) · 2행 side(왼쪽 향함).
   side 는 왼쪽을 향해 그려져 있어서 오른쪽은 flipX 로 뒤집어 씁니다.
   ------------------------------------------------------------ */

const CHEF_ANIM_TABLE = [
  { key:"idle",       file:"char_chef_idle",       cols:6, dirs:["down","up","side"], fps:6,  repeat:-1 },
  { key:"walk",       file:"char_chef_walk",       cols:8, dirs:["down","up","side"], fps:12, repeat:-1 },
  { key:"idle_carry", file:"char_chef_idle_carry", cols:6, dirs:["down","up","side"], fps:6,  repeat:-1 },
  { key:"walk_carry", file:"char_chef_walk_carry", cols:8, dirs:["down","up","side"], fps:12, repeat:-1 }

  // 시트가 나오면 주석만 풀면 됩니다. (에셋 없이 풀면 로딩이 실패합니다)
  // { key:"dash",         file:"char_chef_dash",         cols:6, dirs:["down","up","side"], fps:16, repeat:-1 },
  // { key:"dash_carry",   file:"char_chef_dash_carry",   cols:6, dirs:["down","up","side"], fps:16, repeat:-1 },
  // { key:"pay",          file:"char_chef_pay",          cols:6, dirs:["down"],             fps:10, repeat:0  },
  // { key:"clean",        file:"char_chef_clean",        cols:8, dirs:["down"],             fps:10, repeat:-1 },
  // { key:"cook1",        file:"char_chef_cook1",        cols:8, dirs:["up"],               fps:10, repeat:-1 },
  // { key:"cook2",        file:"char_chef_cook2",        cols:8, dirs:["down"],             fps:10, repeat:-1 },
  // { key:"other1_wash",  file:"char_chef_other1_wash",  cols:6, dirs:["up"],               fps:10, repeat:-1 },
  // { key:"other1_fridge",file:"char_chef_other1_fridge",cols:6, dirs:["side"],             fps:10, repeat:0  },
  // { key:"other2",       file:"char_chef_other2",       cols:6, dirs:["side"],             fps:10, repeat:0  }
];


/* ------------------------------------------------------------
   3. 이동 방향 → 시트 방향
   ------------------------------------------------------------
   state.player.facing 은 down/left/right/up 4방향인데
   시트는 down/up/side 3방향이라 여기서 이어 붙입니다.
   좌우 반전 시 머리 리본이 반대편으로 가는 건 의도된 허용 범위입니다.
   ------------------------------------------------------------ */

const CHEF_FACING = {
  down:  { dir:"down", flipX:false },
  up:    { dir:"up",   flipX:false },
  left:  { dir:"side", flipX:false },
  right: { dir:"side", flipX:true  }
};
