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
  shelfCount:9,
  waveSize:7,
  emptyShelves:2,
  historyLimit:30
});

function e13CopyShelves(shelves){
  return shelves.map(shelf=>[...shelf]);
}

function e13PadShelves(shelves=[]){
  return [...shelves,...Array.from({length:Math.max(0,E13_FRIDGE_SORT.shelfCount-shelves.length)},()=>[])].slice(0,E13_FRIDGE_SORT.shelfCount);
}

function e13BuildShelves(ingredientIds=[]){
  const ids=[...new Set(ingredientIds)];
  if(!ids.length)return e13PadShelves();
  if(ids.length===1)return e13PadShelves([[ids[0],ids[0]],[ids[0]]]);
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
  return e13PadShelves([...filled,...Array.from({length:E13_FRIDGE_SORT.emptyShelves},()=>[])]);
}

function e13ValidShelves(shelves,remainingIds){
  if(!Array.isArray(shelves)||shelves.length!==E13_FRIDGE_SORT.shelfCount)return false;
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
  const waveIds=remaining.slice(0,E13_FRIDGE_SORT.waveSize);
  return {
    engine:E13_FRIDGE_SORT.id,
    picked,
    waveIds,
    queue:remaining.slice(E13_FRIDGE_SORT.waveSize),
    shelves:e13BuildShelves(waveIds),
    selectedAsset:null,
    hintedMove:null,
    history:[]
  };
}

function e13NormalizeProgress(saved,requiredIds=[]){
  const required=[...new Set(requiredIds)];
  const source=saved&&typeof saved==="object"?saved:{};
  const picked=[...new Set(Array.isArray(source.picked)?source.picked:[])].filter(id=>required.includes(id));
  const remaining=required.filter(id=>!picked.includes(id));
  let waveIds=[...new Set(Array.isArray(source.waveIds)?source.waveIds:[])].filter(id=>required.includes(id)).slice(0,E13_FRIDGE_SORT.waveSize);
  let queue=[...new Set(Array.isArray(source.queue)?source.queue:[])].filter(id=>remaining.includes(id)&&!waveIds.includes(id));
  const partitioned=remaining.every(id=>waveIds.includes(id)||queue.includes(id))&&remaining.length===waveIds.filter(id=>remaining.includes(id)).length+queue.length;
  let activeRemaining=waveIds.filter(id=>!picked.includes(id));
  if(!partitioned||!e13ValidShelves(source.shelves,activeRemaining)){
    waveIds=remaining.slice(0,E13_FRIDGE_SORT.waveSize);
    queue=remaining.slice(E13_FRIDGE_SORT.waveSize);
    activeRemaining=[...waveIds];
  }
  const shelves=e13ValidShelves(source.shelves,activeRemaining)?e13CopyShelves(source.shelves):e13BuildShelves(activeRemaining);
  const legacyShelf=Number.isInteger(source.selectedShelf)?source.selectedShelf:null;
  const rawSelected=source.selectedAsset&&typeof source.selectedAsset==="object"
    ?source.selectedAsset
    :legacyShelf!==null?{shelf:legacyShelf,slot:(shelves[legacyShelf]?.length||1)-1}:null;
  const selectedAsset=rawSelected&&Number.isInteger(rawSelected.shelf)&&Number.isInteger(rawSelected.slot)&&rawSelected.shelf>=0&&rawSelected.shelf<shelves.length&&rawSelected.slot>=0&&rawSelected.slot<shelves[rawSelected.shelf].length
    ?{shelf:rawSelected.shelf,slot:rawSelected.slot}
    :null;
  const hinted=source.hintedMove;
  const hintedFromShelf=hinted?.fromShelf??hinted?.from;
  const hintedToShelf=hinted?.toShelf??hinted?.to;
  const hintedFromSlot=hinted?.fromSlot??((shelves[hintedFromShelf]?.length||1)-1);
  const hintedMove=hinted&&Number.isInteger(hintedFromShelf)&&Number.isInteger(hintedFromSlot)&&Number.isInteger(hintedToShelf)&&hintedFromShelf>=0&&hintedToShelf>=0&&hintedFromShelf<shelves.length&&hintedToShelf<shelves.length&&hintedFromSlot>=0&&hintedFromSlot<shelves[hintedFromShelf].length
    ?{fromShelf:hintedFromShelf,fromSlot:hintedFromSlot,toShelf:hintedToShelf}
    :null;
  const history=Array.isArray(source.history)?source.history.slice(-E13_FRIDGE_SORT.historyLimit).filter(entry=>entry&&Array.isArray(entry.shelves)&&entry.shelves.every(Array.isArray)&&Array.isArray(entry.picked)&&Array.isArray(entry.waveIds)&&Array.isArray(entry.queue)).map(entry=>({
    shelves:e13CopyShelves(entry.shelves),
    picked:[...entry.picked],
    waveIds:[...entry.waveIds],
    queue:[...entry.queue]
  })):[];
  return {engine:E13_FRIDGE_SORT.id,picked,waveIds,queue,shelves,selectedAsset,hintedMove,history};
}

function e13CanMove(progress,fromShelf,fromSlot,toShelf){
  if(!progress||fromShelf===toShelf||![fromShelf,fromSlot,toShelf].every(Number.isInteger))return false;
  const source=progress.shelves[fromShelf],target=progress.shelves[toShelf];
  return !!source&&fromSlot>=0&&fromSlot<source.length&&!!target&&target.length<E13_FRIDGE_SORT.matchSize;
}

function e13PushHistory(progress){
  progress.history.push({shelves:e13CopyShelves(progress.shelves),picked:[...progress.picked],waveIds:[...progress.waveIds],queue:[...progress.queue]});
  if(progress.history.length>E13_FRIDGE_SORT.historyLimit)progress.history.shift();
}

function e13Move(progress,fromShelf,fromSlot,toShelf){
  if(!e13CanMove(progress,fromShelf,fromSlot,toShelf))return {moved:false,matchedId:null,nextWave:false};
  e13PushHistory(progress);
  const [id]=progress.shelves[fromShelf].splice(fromSlot,1);
  const target=progress.shelves[toShelf];
  target.push(id);
  let matchedId=null;
  let nextWave=false;
  if(target.length===E13_FRIDGE_SORT.matchSize&&target.every(itemId=>itemId===id)){
    target.length=0;
    if(!progress.picked.includes(id))progress.picked.push(id);
    matchedId=id;
    if(progress.waveIds.every(waveId=>progress.picked.includes(waveId))&&progress.queue.length){
      progress.waveIds=progress.queue.splice(0,E13_FRIDGE_SORT.waveSize);
      progress.shelves=e13BuildShelves(progress.waveIds);
      nextWave=true;
    }
  }
  progress.selectedAsset=null;
  progress.hintedMove=null;
  return {moved:true,matchedId,nextWave};
}

function e13Undo(progress){
  const previous=progress?.history?.pop();
  if(!previous)return false;
  progress.shelves=e13CopyShelves(previous.shelves);
  progress.picked=[...previous.picked];
  progress.waveIds=[...previous.waveIds];
  progress.queue=[...previous.queue];
  progress.selectedAsset=null;
  progress.hintedMove=null;
  return true;
}

function e13Shuffle(progress,requiredIds=[]){
  if(!progress)return false;
  const required=[...new Set(requiredIds)];
  const remaining=progress.waveIds.filter(id=>required.includes(id)&&!progress.picked.includes(id));
  if(!remaining.length)return false;
  e13PushHistory(progress);
  progress.shelves=e13BuildShelves(remaining);
  progress.selectedAsset=null;
  progress.hintedMove=null;
  return true;
}

function e13FindHint(progress){
  if(!progress)return null;
  if(progress.selectedAsset){
    const {shelf:fromShelf,slot:fromSlot}=progress.selectedAsset;
    const id=progress.shelves[fromShelf]?.[fromSlot];
    const targets=progress.shelves.map((shelf,toShelf)=>({shelf,toShelf})).filter(({toShelf})=>e13CanMove(progress,fromShelf,fromSlot,toShelf));
    const target=targets.sort((a,b)=>b.shelf.filter(item=>item===id).length-a.shelf.filter(item=>item===id).length||a.shelf.length-b.shelf.length)[0];
    if(target)return {fromShelf,fromSlot,toShelf:target.toShelf};
  }
  const moves=[];
  for(let fromShelf=0;fromShelf<progress.shelves.length;fromShelf+=1){
    for(let fromSlot=0;fromSlot<progress.shelves[fromShelf].length;fromSlot+=1){
      const id=progress.shelves[fromShelf][fromSlot];
      for(let toShelf=0;toShelf<progress.shelves.length;toShelf+=1){
        if(!e13CanMove(progress,fromShelf,fromSlot,toShelf))continue;
        const target=progress.shelves[toShelf],same=target.filter(item=>item===id).length;
        moves.push({fromShelf,fromSlot,toShelf,score:same*100-target.length});
      }
    }
  }
  return moves.length?moves.sort((a,b)=>b.score-a.score)[0]:null;
}
