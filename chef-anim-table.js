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

// 화면(1920×1080) 기준 배율. 1.0 이면 캐릭터 키가 CHEF_TARGET_H(233px) 입니다.
// 크기를 조절할 일이 생기면 이 값 하나만 고치세요.
// setDisplaySize 로 가로세로를 따로 주면 비율이 깨지므로 쓰지 않습니다.
const CHEF_SCALE = 1.0;

// 모든 방향·모션을 맞출 캐릭터 키 (1× 화면 픽셀).
//
// [왜 필요한가]
// 받은 시트는 방향마다 캐릭터 크기가 다릅니다. 특히 char_chef_walk 은
// down 267 · up 233 · side 256 으로 뒷모습이 34px(약 13%) 작습니다.
// 나머지 3장은 268~269.5 로 균일하고요. 그대로 쓰면 방향을 바꿀 때마다,
// 또 걷다 멈출 때마다(walk up 233 → idle up 268) 캐릭터가 커졌다 작아집니다.
//
// 그래서 표의 heights 실측값으로 시트·방향마다 배율을 따로 계산해서
// 화면상 키를 항상 이 값으로 맞춥니다. 기준은 가장 작은 walk 뒷모습(233)이라
// 어떤 방향도 확대되지 않습니다. (확대하면 흐려지므로 축소만 씁니다)
//
// 시트 자체가 균일하게 다시 나오면 heights 를 지우거나 전부 같은 값으로
// 맞추면 됩니다. 그러면 배율 보정이 저절로 1.0 이 됩니다.
const CHEF_TARGET_H = 233;


/* ------------------------------------------------------------
   2. 시트 표
   ------------------------------------------------------------
   key    : 모션 이름. 애니메이션 키는 chef_{key}_{방향} 이 됩니다.
   file   : 확장자 뺀 파일명
   cols   : 한 방향당 프레임 수 (= 시트의 열 수)
   dirs   : 행 순서. 시트의 0행부터 차례로 대응합니다.
   fps    : 재생 속도
   repeat : -1 무한반복 / 0 한 번만
   heights: 방향별 캐릭터 실측 키 (1× 픽셀, 알파 기준). 크기를 CHEF_TARGET_H 로
            맞추는 데만 씁니다. 생략하면 그 시트는 배율 보정 없이 원본 크기입니다.
            값은 손으로 재지 말고 node tools/measure-chef-frames.js 로 뽑으세요.

   [행 순서] 4장 모두 0행 down(정면) · 1행 up(뒷모습) · 2행 side(왼쪽 향함).
   side 는 왼쪽을 향해 그려져 있어서 오른쪽은 flipX 로 뒤집어 씁니다.

   [fps 와 이동 속도] walk 계열 fps 는 PLAYER_START.speed 와 짝입니다.
   속도만 올리면 발이 미끄러져 보이므로 같이 손봐야 합니다. (player.js §1 참고)
   ------------------------------------------------------------ */

const CHEF_ANIM_TABLE = [
  { key:"idle",       file:"char_chef_idle",       cols:6, dirs:["down","up","side"], fps:6,  repeat:-1,
    heights:{ down:268,   up:268,   side:268   } },
  { key:"walk",       file:"char_chef_walk",       cols:8, dirs:["down","up","side"], fps:16, repeat:-1,
    heights:{ down:267,   up:233,   side:256   } },
  { key:"idle_carry", file:"char_chef_idle_carry", cols:6, dirs:["down","up","side"], fps:6,  repeat:-1,
    heights:{ down:268,   up:268,   side:268   } },
  { key:"walk_carry", file:"char_chef_walk_carry", cols:8, dirs:["down","up","side"], fps:16, repeat:-1,
    heights:{ down:269.5, up:269.5, side:269.5 } }

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
