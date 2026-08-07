"use strict";

// 날짜/메뉴 확장의 기준 데이터입니다. 새 메뉴와 날짜 규칙은 이 파일에 등록합니다.
const GAME_PHASES=Object.freeze({
  MENU_SELECT:"menuSelect",
  INGREDIENT_SELECT:"ingredientSelect",
  PREP:"day",
  OPEN:"night",
  RESULT:"result"
});

const SKEWER_BATCH_SIZE=3;

/* 닭꼬치 조각 2종. **낮 '꽂기'(engine-e8)와 밤 '굽기'(engine-e5)가 함께 씁니다** —
   밤에는 낮에 꽂은 배치 그대로 구우므로 조각 이름도 그림도 같은 것을 봐야 합니다.
   그래서 어느 한쪽 엔진이 아니라 두 엔진보다 먼저 읽히는 여기에 둡니다.
     SKEWER_ASSET_KEY  그림 키 → 실제 파일은 day-prep-minigames.js 의 DAY_PREP_ASSET_PATHS
   ⚠️ 한 칸에 들어갈 수 있는 재료가 늘면 두 표에 같이 추가해야 합니다. */
const SKEWER_LABEL=Object.freeze({chicken:"닭고기",greenOnion:"파"});
const SKEWER_ASSET_KEY=Object.freeze({chicken:"skewerChicken",greenOnion:"skewerGreenOnion"});

// E1 썰기 판정의 절단선 기준 좌우 허용 폭(%).
// 재료 그림의 실제 가로 폭과 절단선 간격이 달라 같은 숫자를 쓰면 화면상
// 히팅 박스 크기가 크게 달라집니다. 좁게 보이는 어묵·두부는 조금 넓게,
// 절단선이 촘촘한 양배추·닭·김치는 다음 박자와 붙지 않는 선에서 키웁니다.
const CUT_HIT_TOLERANCE=Object.freeze({
  radish:3.4,
  fishCake:3.4,
  cabbage:3.1,
  chicken:3.5,
  greenOnion:3.5,
  kimchi:3.3,
  tofu:4.2
});

// 기존 작업 설정과의 호환을 위한 어묵 가로 썰기 값입니다.
// 현재 엔진은 공통 hitTolerance를 사용하므로 세로 값과 동일하게 유지합니다.
const CUT_HORIZONTAL_HIT_TOLERANCE=Object.freeze({fishCake:3.4});

const PREP_TASKS=Object.freeze({
  cutRadish:{id:"cutRadish",menuId:"oden",label:"무 썰기",objectLabel:"무 바구니",objectKind:"radish",miniGame:"cut",prepOrder:1,isImplemented:true},
  cutFishCake:{id:"cutFishCake",menuId:"oden",label:"어묵 썰기",objectLabel:"어묵 바구니",objectKind:"fishCake",miniGame:"cut",prepOrder:2,isImplemented:true},
  cleanAnchovy:{id:"cleanAnchovy",menuId:"oden",label:"멸치 손질",objectLabel:"멸치 바구니",objectKind:"anchovy",miniGame:"anchovy",prepOrder:3,isImplemented:true},
  cutTofuBlock:{id:"cutTofuBlock",menuId:"tofu",label:"두부 썰기",objectLabel:"두부",objectKind:"tofu",miniGame:"cut",prepOrder:9,isImplemented:true},
  cutTofuKimchi:{id:"cutTofuKimchi",menuId:"tofu",label:"두부김치용 김치 썰기",objectLabel:"김치",objectKind:"kimchi",miniGame:"cut",prepOrder:10,isImplemented:true},
  cutPancakeKimchi:{id:"cutPancakeKimchi",menuId:"kimchi",label:"김치전용 김치 썰기",objectLabel:"김치전용 김치",objectKind:"kimchi",miniGame:"cut",prepOrder:20,isImplemented:true},
  cutSkewerChicken:{id:"cutSkewerChicken",menuId:"skewer",label:"닭 썰기",objectLabel:"닭고기",objectKind:"chicken",miniGame:"cut",prepOrder:30,isImplemented:true},
  cutSkewerGreenOnion:{id:"cutSkewerGreenOnion",menuId:"skewer",label:"대파 썰기",objectLabel:"대파",objectKind:"greenOnion",miniGame:"cut",dependsOn:["cutSkewerChicken"],prepOrder:40,isImplemented:true},
  fryTofuKimchi:{id:"fryTofuKimchi",menuId:"tofu",label:"두부김치용 김치 볶기",objectLabel:"김치 볶기 팬",objectKind:"pan",miniGame:"kimchiFry",dependsOn:["cutTofuKimchi"],prepOrder:50,isImplemented:true},
  mixKimchiBatter:{id:"mixKimchiBatter",menuId:"kimchi",label:"김치전 반죽 만들기",objectLabel:"김치전 믹스볼",objectKind:"batter",miniGame:"batter",dependsOn:["cutPancakeKimchi"],prepOrder:60,isImplemented:true},
  assembleChickenSkewer:{id:"assembleChickenSkewer",menuId:"skewer",label:"닭꼬치 꽂기",objectLabel:"꼬치 조립대",objectKind:"skewer",miniGame:"skewer",dependsOn:["cutSkewerChicken","cutSkewerGreenOnion"],prepOrder:70,isImplemented:true},
  sliceYakisobaCabbage:{id:"sliceYakisobaCabbage",menuId:"yakisoba",label:"양배추 채썰기",objectLabel:"양배추와 채칼",objectKind:"cabbage",miniGame:"mandoline",prepOrder:80,isImplemented:true},
  sliceYakisobaCarrot:{id:"sliceYakisobaCarrot",menuId:"yakisoba",label:"당근 채썰기",objectLabel:"당근과 채칼",objectKind:"carrot",miniGame:"mandoline",dependsOn:["sliceYakisobaCabbage"],prepOrder:90,isImplemented:true},
  coatShrimp:{id:"coatShrimp",menuId:"shrimpTempura",label:"새우 튀김옷 입히기",objectLabel:"새우 코팅 작업대",objectKind:"shrimpCoat",miniGame:"shrimpCoat",prepOrder:110,isImplemented:true},
  cutTteokbokkiCabbage:{id:"cutTteokbokkiCabbage",menuId:"tteokbokki",label:"양배추 썰기",objectLabel:"떡볶이용 양배추",objectKind:"cabbage",miniGame:"tteokbokkiCut",prepOrder:122,day4Order:1,isImplemented:true},
  cutTteokbokkiGreenOnion:{id:"cutTteokbokkiGreenOnion",menuId:"tteokbokki",label:"대파 썰기",objectLabel:"떡볶이용 대파",objectKind:"greenOnion",miniGame:"tteokbokkiCut",dependsOn:["cutTteokbokkiCabbage"],prepOrder:123,day4Order:2,isImplemented:true},
  cutTteokbokkiFishCake:{id:"cutTteokbokkiFishCake",menuId:"tteokbokki",label:"어묵 썰기",objectLabel:"떡볶이용 어묵",objectKind:"fishCake",miniGame:"tteokbokkiCut",dependsOn:["cutTteokbokkiGreenOnion"],prepOrder:124,day4Order:3,isImplemented:true},
  sliceFriesPotato:{id:"sliceFriesPotato",menuId:"fries",label:"채칼로 감자 썰기",objectLabel:"감자와 채칼",objectKind:"potato",miniGame:"potatoMandoline",prepOrder:126,day4Order:4,isImplemented:true},
  shakeFriesStarch:{id:"shakeFriesStarch",menuId:"fries",label:"감자 전분 털기",objectLabel:"감자 바구니",objectKind:"potatoBasket",miniGame:"potatoStarch",dependsOn:["sliceFriesPotato"],prepOrder:127,day4Order:5,isImplemented:true}
});

const MENU_DATA=Object.freeze([
  {id:"oden",displayName:"어묵탕",unlockDay:1,requiredPrepTasks:["cutRadish","cutFishCake","cleanAnchovy"],cookware:["pot"],isImplemented:true,icon:4,ingredients:["어묵","무","대파"],prep:["fridge","sink","board","pot"],openFlow:["fridge","pot","counter"],cook:[{station:"pot",game:"heat"}],price:7800},
  {id:"tofu",displayName:"두부김치",unlockDay:1,requiredPrepTasks:["cutTofuKimchi","fryTofuKimchi"],cookware:["pan","board"],isImplemented:true,icon:3,ingredients:["두부","김치"],prep:["fridge","sink","board"],openFlow:["board","counter"],cook:[{station:"board",game:"chop"}],price:8800},
  {id:"kimchi",displayName:"김치전",unlockDay:1,requiredPrepTasks:["cutPancakeKimchi","mixKimchiBatter"],cookware:["board","mixingBowl","pan"],isImplemented:true,icon:0,ingredients:["김치","밀가루","물"],prep:["board","mixingBowl"],cook:[{station:"pan",game:"twoSideCook"}],price:6200},
  {id:"skewer",displayName:"닭꼬치",unlockDay:1,requiredPrepTasks:["cutSkewerChicken","cutSkewerGreenOnion","assembleChickenSkewer"],cookware:["board","skewerTable","grill"],isImplemented:true,prepYield:SKEWER_BATCH_SIZE,icon:1,ingredients:["닭고기","대파"],prep:["board","skewerTable"],cook:[{station:"grill",game:"twoSideCook"}],price:7200},
  {id:"yakisoba",displayName:"볶음우동",unlockDay:1,requiredPrepTasks:["sliceYakisobaCabbage","sliceYakisobaCarrot"],cookware:["griddle"],isImplemented:true,icon:2,ingredients:["우동면","양배추","당근","볶음우동 소스"],prep:["board"],cook:[{station:"griddle",game:"stir"}],price:8200},
  {id:"shrimpTempura",displayName:"새우튀김",unlockDay:1,requiredPrepTasks:["coatShrimp"],cookware:["fryer"],isImplemented:true,icon:null,ingredients:["새우","밀가루","계란물","빵가루"],prep:["board"],cook:[{station:"fryer",game:"fry"}],price:8600},
  {id:"tteokbokki",displayName:"떡볶이",unlockDay:1,requiredPrepTasks:["cutTteokbokkiCabbage","cutTteokbokkiGreenOnion","cutTteokbokkiFishCake"],cookware:["pot"],isImplemented:true,prepYield:3,icon:null,ingredients:["떡","고추장","어묵"],prep:[],cook:[{station:"pot",game:"heat"}],price:7900},
  {id:"fries",displayName:"감자튀김",unlockDay:1,requiredPrepTasks:["sliceFriesPotato","shakeFriesStarch"],cookware:["fryer"],isImplemented:true,prepYield:3,icon:null,ingredients:["감자","식용유"],prep:[],cook:[{station:"fryer",game:"fry"}],price:6500}
]);

const ALL_MENU_IDS=Object.freeze(MENU_DATA.map(menu=>menu.id));

const DAY_DATA=Object.freeze({
  1:{day:1,requiredMenus:[],optionalMenus:[...ALL_MENU_IDS],minSelectedMenus:5,maxSelectedMenus:5,generalOrderTarget:3,specialMenu:null,isSpecialDay:false},
  2:{day:2,requiredMenus:[],optionalMenus:[...ALL_MENU_IDS],minSelectedMenus:5,maxSelectedMenus:5,generalOrderTarget:4,specialMenu:null,isSpecialDay:false},
  3:{day:3,requiredMenus:[],optionalMenus:[...ALL_MENU_IDS],minSelectedMenus:5,maxSelectedMenus:5,generalOrderTarget:5,specialMenu:null,isSpecialDay:false},
  4:{day:4,requiredMenus:[],optionalMenus:[...ALL_MENU_IDS],minSelectedMenus:5,maxSelectedMenus:5,generalOrderTarget:6,specialMenu:null,isSpecialDay:false},
  5:{day:5,requiredMenus:[],optionalMenus:[...ALL_MENU_IDS],minSelectedMenus:5,maxSelectedMenus:5,generalOrderTarget:4,specialMenu:null,isSpecialDay:false},
  6:{day:6,requiredMenus:[],optionalMenus:[...ALL_MENU_IDS],minSelectedMenus:5,maxSelectedMenus:5,generalOrderTarget:7,specialMenu:null,isSpecialDay:false},
  7:{day:7,requiredMenus:[],optionalMenus:[...ALL_MENU_IDS],minSelectedMenus:5,maxSelectedMenus:5,generalOrderTarget:5,specialMenu:null,isSpecialDay:false}
});

const DayManager={
  minDay:1,
  maxDay:7,
  currentDay:1,
  isSupported(day){return Number.isInteger(Number(day))&&Number(day)>=this.minDay&&Number(day)<=this.maxDay;},
  setDay(day){
    const parsed=Math.floor(Number(day));
    this.currentDay=this.isSupported(parsed)?parsed:Math.min(this.maxDay,Math.max(this.minDay,Number.isFinite(parsed)?parsed:this.minDay));
    return this.currentDay;
  },
  getDayData(day=this.currentDay){return DAY_DATA[this.isSupported(day)?Number(day):this.setDay(day)];},
  nextDay(){return this.setDay(this.currentDay+1);}
};

function menuDataById(id){return MENU_DATA.find(menu=>menu.id===id)||null;}
