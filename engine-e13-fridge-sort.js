"use strict";

/* ============================================================
   E13 냉장고 선반 정리 — 같은 재료 3개를 한 칸에 모으는 퍼즐

   메뉴 선택 뒤, 낮 준비에 들어가기 전에 실행되는 독립 미니게임입니다.
   화면과 메뉴 데이터는 ingredient-select.js가 맡고 이 파일은
   선반 생성·이동·매칭·되돌리기·섞기·힌트 규칙만 관리합니다.
   ============================================================ */

const E13_FRIDGE_SORT=Object.freeze({
  id:"E13",
  matchSize:3,
  emptyShelves:2,
  historyLimit:30
});

function e13CopyShelves(shelves){
  return shelves.map(shelf=>[...shelf]);
}

function e13BuildShelves(ingredientIds=[]){
  const ids=[...new Set(ingredientIds)];
  if(!ids.length)return [];
  if(ids.length===1)return [[ids[0],ids[0]],[ids[0]],[]];
  const tokens=ids.flatMap(id=>Array(E13_FRIDGE_SORT.matchSize).fill(id));
  let filled=[];
  let mixedEnough=false;
  for(let attempt=0;attempt<120;attempt+=1){
    const mixed=shuffle(tokens);
    filled=ids.map((_,index)=>mixed.slice(index*E13_FRIDGE_SORT.matchSize,(index+1)*E13_FRIDGE_SORT.matchSize));
    if(filled.every(shelf=>!shelf.every(id=>id===shelf[0]))){mixedEnough=true;break;}
  }
  if(!mixedEnough){
    const interleaved=Array.from({length:tokens.length},(_,index)=>ids[index%ids.length]);
    filled=ids.map((_,index)=>interleaved.slice(index*E13_FRIDGE_SORT.matchSize,(index+1)*E13_FRIDGE_SORT.matchSize));
  }
  return [...filled,...Array.from({length:E13_FRIDGE_SORT.emptyShelves},()=>[])];
}

function e13ValidShelves(shelves,remainingIds){
  if(!Array.isArray(shelves)||shelves.length<remainingIds.length+E13_FRIDGE_SORT.emptyShelves)return false;
  if(shelves.some(shelf=>!Array.isArray(shelf)||shelf.length>E13_FRIDGE_SORT.matchSize))return false;
  const counts=Object.fromEntries(remainingIds.map(id=>[id,0]));
  for(const id of shelves.flat()){
    if(!(id in counts))return false;
    counts[id]+=1;
  }
  return remainingIds.every(id=>counts[id]===E13_FRIDGE_SORT.matchSize);
}

function e13CreateProgress(requiredIds=[],pickedIds=[]){
  const required=[...new Set(requiredIds)];
  const picked=[...new Set(pickedIds)].filter(id=>required.includes(id));
  const remaining=required.filter(id=>!picked.includes(id));
  return {
    engine:E13_FRIDGE_SORT.id,
    picked,
    shelves:e13BuildShelves(remaining),
    selectedShelf:null,
    hintedMove:null,
    history:[]
  };
}

function e13NormalizeProgress(saved,requiredIds=[]){
  const required=[...new Set(requiredIds)];
  const source=saved&&typeof saved==="object"?saved:{};
  const picked=[...new Set(Array.isArray(source.picked)?source.picked:[])].filter(id=>required.includes(id));
  const remaining=required.filter(id=>!picked.includes(id));
  const shelves=e13ValidShelves(source.shelves,remaining)?e13CopyShelves(source.shelves):e13BuildShelves(remaining);
  const selectedShelf=Number.isInteger(source.selectedShelf)&&source.selectedShelf>=0&&source.selectedShelf<shelves.length&&shelves[source.selectedShelf].length
    ?source.selectedShelf
    :null;
  const hinted=source.hintedMove;
  const hintedMove=hinted&&Number.isInteger(hinted.from)&&Number.isInteger(hinted.to)&&hinted.from>=0&&hinted.to>=0&&hinted.from<shelves.length&&hinted.to<shelves.length
    ?{from:hinted.from,to:hinted.to}
    :null;
  const history=Array.isArray(source.history)?source.history.slice(-E13_FRIDGE_SORT.historyLimit).filter(entry=>entry&&Array.isArray(entry.shelves)&&entry.shelves.every(Array.isArray)&&Array.isArray(entry.picked)).map(entry=>({
    shelves:e13CopyShelves(entry.shelves),
    picked:[...entry.picked]
  })):[];
  return {engine:E13_FRIDGE_SORT.id,picked,shelves,selectedShelf,hintedMove,history};
}

function e13ShelfTop(shelf){
  return shelf?.length?shelf[shelf.length-1]:null;
}

function e13CanMove(progress,from,to){
  if(!progress||from===to||!Number.isInteger(from)||!Number.isInteger(to))return false;
  const source=progress.shelves[from],target=progress.shelves[to];
  if(!source?.length||!target||target.length>=E13_FRIDGE_SORT.matchSize)return false;
  return !target.length||e13ShelfTop(source)===e13ShelfTop(target);
}

function e13PushHistory(progress){
  progress.history.push({shelves:e13CopyShelves(progress.shelves),picked:[...progress.picked]});
  if(progress.history.length>E13_FRIDGE_SORT.historyLimit)progress.history.shift();
}

function e13Move(progress,from,to){
  if(!e13CanMove(progress,from,to))return {moved:false,matchedId:null};
  e13PushHistory(progress);
  const id=progress.shelves[from].pop();
  const target=progress.shelves[to];
  target.push(id);
  let matchedId=null;
  if(target.length===E13_FRIDGE_SORT.matchSize&&target.every(itemId=>itemId===id)){
    target.length=0;
    if(!progress.picked.includes(id))progress.picked.push(id);
    matchedId=id;
  }
  progress.selectedShelf=null;
  progress.hintedMove=null;
  return {moved:true,matchedId};
}

function e13Undo(progress){
  const previous=progress?.history?.pop();
  if(!previous)return false;
  progress.shelves=e13CopyShelves(previous.shelves);
  progress.picked=[...previous.picked];
  progress.selectedShelf=null;
  progress.hintedMove=null;
  return true;
}

function e13Shuffle(progress,requiredIds=[]){
  if(!progress)return false;
  const remaining=[...new Set(requiredIds)].filter(id=>!progress.picked.includes(id));
  if(!remaining.length)return false;
  e13PushHistory(progress);
  progress.shelves=e13BuildShelves(remaining);
  progress.selectedShelf=null;
  progress.hintedMove=null;
  return true;
}

function e13FindHint(progress){
  if(!progress)return null;
  if(Number.isInteger(progress.selectedShelf)){
    const from=progress.selectedShelf;
    const targets=progress.shelves.map((shelf,to)=>({shelf,to})).filter(({to})=>e13CanMove(progress,from,to));
    const same=targets.filter(({shelf})=>shelf.length).sort((a,b)=>b.shelf.length-a.shelf.length)[0];
    const target=same||targets.find(({shelf})=>!shelf.length);
    if(target)return {from,to:target.to};
  }
  const matching=[];
  for(let from=0;from<progress.shelves.length;from+=1){
    const id=e13ShelfTop(progress.shelves[from]);
    if(!id)continue;
    for(let to=0;to<progress.shelves.length;to+=1){
      if(from===to)continue;
      const target=progress.shelves[to];
      if(target.length&&target.length<E13_FRIDGE_SORT.matchSize&&e13ShelfTop(target)===id){
        matching.push({from,to,score:target.length*10-progress.shelves[from].length});
      }
    }
  }
  if(matching.length)return matching.sort((a,b)=>b.score-a.score)[0];
  const empty=progress.shelves.findIndex(shelf=>!shelf.length);
  const from=progress.shelves.findIndex((shelf,index)=>index!==empty&&shelf.length);
  return from>=0&&empty>=0?{from,to:empty}:null;
}
