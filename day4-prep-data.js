"use strict";

// Day 4 준비 밸런스 데이터. 미니게임 코드는 이 값을 읽기만 합니다.
// 떡볶이 재료 칼질. 예전에는 셋을 한 화면에서 이어서 썰었지만
// 지금은 재료마다 별도의 준비 작업이라 taskId 로 찾아 씁니다.
const TTEOKBOKKI_CUT_SEQUENCE=Object.freeze([
  Object.freeze({taskId:"cutTteokbokkiCabbage",ingredientId:"cabbage",assetPrefix:"tteokCabbage",displayName:"양배추",requiredPieces:4,progressSprites:Object.freeze(Array.from({length:5},(_,index)=>`assets/prep/day4/tteokbokki/cabbage-${index}.png`))}),
  Object.freeze({taskId:"cutTteokbokkiGreenOnion",ingredientId:"greenOnion",assetPrefix:"tteokGreenOnion",displayName:"대파",requiredPieces:4,progressSprites:Object.freeze(Array.from({length:5},(_,index)=>`assets/prep/cutting/green-onion/green-onion-${index}.png`))}),
  Object.freeze({taskId:"cutTteokbokkiFishCake",ingredientId:"fishCake",assetPrefix:"tteokFishCake",displayName:"어묵",requiredPieces:4,horizontalLastCut:true,progressSprites:Object.freeze(Array.from({length:5},(_,index)=>`assets/prep/cutting/fish-cake/fish-cake-${index}.png`))})
]);

// 새우 튀김옷은 하나의 준비 작업 안에서 세 단계가 연속으로 이어집니다.
// 단계가 바뀔 때마다 조작할 랜덤 알파벳 두 개도 새로 뽑습니다.
const SHRIMP_COAT_TASK_ID="coatShrimp";
const SHRIMP_COAT_STEPS=Object.freeze([
  Object.freeze({step:0,id:"flour",label:"밀가루",presses:10}),
  Object.freeze({step:1,id:"egg",label:"계란물",presses:8}),
  Object.freeze({step:2,id:"breadcrumbs",label:"빵가루",presses:12})
]);

const SAUCE_RECIPES=Object.freeze({
  yakisoba:Object.freeze({
    title:"볶음우동 소스 레시피",
    taskId:"mixYakisobaSauce",
    completionMessage:"볶음우동 소스 제조 완료",
    bowlColor:"#6b341b",bowlDark:"#32160d",
    ingredients:Object.freeze([
      Object.freeze({id:"soy",label:"간장",target:200,flow:"thin",color:"#633019"}),
      Object.freeze({id:"oyster",label:"굴소스",target:100,flow:"thick",color:"#482014"}),
      Object.freeze({id:"chili",label:"고추기름",target:30,flow:"thin",color:"#c44d22"})
    ])
  }),
  tteokbokki:Object.freeze({
    title:"떡볶이 양념장 레시피",
    taskId:"mixTteokbokkiSauce",
    completionMessage:"떡볶이 양념장 계량 완료",
    bowlColor:"#a93222",bowlDark:"#4d160e",
    ingredients:Object.freeze([
      Object.freeze({id:"gochujang",label:"고추장",target:120,flow:"thick",color:"#b83a25"}),
      Object.freeze({id:"oligosaccharide",label:"올리고당",target:60,flow:"syrup",color:"#d59a47"}),
      Object.freeze({id:"soy",label:"간장",target:30,flow:"thin",color:"#633019"})
    ])
  })
});

const DAY4_PREP_CONFIG=Object.freeze({
  soak:{taskId:"soakTteok",required:["tteok","water"]},
  potatoMandoline:{taskId:"sliceFriesPotato",ingredient:"potato",label:"감자",directions:["left","right"],totalInputs:20},
  potatoStarch:{taskId:"shakeFriesStarch",requiredPresses:14,stages:[0,35,70,100]}
});
