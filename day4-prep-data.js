"use strict";

// Day 4 준비 밸런스 데이터. 미니게임 코드는 이 값을 읽기만 합니다.
// 떡볶이 재료 칼질. 예전에는 셋을 한 화면에서 이어서 썰었지만
// 지금은 재료마다 별도의 준비 작업이라 taskId 로 찾아 씁니다.
// flowIndex 는 Day4 떡볶이 진행 표시줄에서 몇 번째 칸인지입니다.
const TTEOKBOKKI_CUT_SEQUENCE=Object.freeze([
  Object.freeze({taskId:"cutTteokbokkiCabbage",flowIndex:1,ingredientId:"cabbage",assetPrefix:"tteokCabbage",displayName:"양배추",requiredPieces:8,progressSprites:Object.freeze(Array.from({length:9},(_,index)=>`assets/prep/day4/tteokbokki/cabbage-${index}.png`))}),
  Object.freeze({taskId:"cutTteokbokkiGreenOnion",flowIndex:2,ingredientId:"greenOnion",assetPrefix:"tteokGreenOnion",displayName:"대파",requiredPieces:7,progressSprites:Object.freeze(Array.from({length:8},(_,index)=>`assets/prep/day4/tteokbokki/green-onion-${index}.png`))}),
  Object.freeze({taskId:"cutTteokbokkiFishCake",flowIndex:3,ingredientId:"fishCake",assetPrefix:"tteokFishCake",displayName:"어묵",requiredPieces:6,progressSprites:Object.freeze(Array.from({length:7},(_,index)=>`assets/prep/day4/tteokbokki/fish-cake-${index}.png`))})
]);

// 새우 튀김옷은 하나의 준비 작업 안에서 세 단계가 연속으로 이어집니다.
// 단계가 바뀔 때마다 조작할 랜덤 알파벳 두 개도 새로 뽑습니다.
const SHRIMP_COAT_TASK_ID="coatShrimp";
const SHRIMP_COAT_STEPS=Object.freeze([
  Object.freeze({step:0,id:"flour",label:"밀가루",presses:12}),
  Object.freeze({step:1,id:"egg",label:"계란물",presses:12}),
  Object.freeze({step:2,id:"breadcrumbs",label:"빵가루",presses:12})
]);

const SAUCE_RECIPES=Object.freeze({
  yakisoba:Object.freeze({
    title:"볶음우동 소스 레시피",
    taskId:"mixYakisobaSauce",
    completionMessage:"볶음우동 소스 제조 완료",
    ingredients:Object.freeze([
      Object.freeze({id:"soy",label:"간장",target:200,step:50}),
      Object.freeze({id:"oyster",label:"굴소스",target:100,step:25}),
      Object.freeze({id:"chili",label:"고추기름",target:30,step:10})
    ])
  }),
  tteokbokki:Object.freeze({
    title:"떡볶이 양념장 레시피",
    taskId:"mixTteokbokkiSauce",
    completionMessage:"떡볶이 양념장 계량 완료",
    ingredients:Object.freeze([
      Object.freeze({id:"gochujang",label:"고추장",target:120,step:30}),
      Object.freeze({id:"oligosaccharide",label:"올리고당",target:60,step:20}),
      Object.freeze({id:"soy",label:"간장",target:30,step:10})
    ])
  })
});

const DAY4_PREP_CONFIG=Object.freeze({
  soak:{taskId:"soakTteok",required:["tteok","water"]},
  potatoMandoline:{taskId:"sliceFriesPotato",ingredient:"potato",label:"감자",directions:["left","right"],totalInputs:10},
  potatoStarch:{taskId:"shakeFriesStarch",requiredPresses:12,stages:[0,35,70,100]}
});
