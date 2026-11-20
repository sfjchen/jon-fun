export type MiniPuzzle={date:string;constructors:string[];copyright:string;width:number;height:number;cells:(string|null)[];clues:{number:string;direction:string;text:string;cells:number[];answer:string}[]}
export type MiniRun={entries:string[];elapsedMs:number;activeSince:number|null;started:boolean;complete:boolean;assisted:boolean;firstSolveSeconds:number|null;pencil:number[];confirmed:number[]}
export function emptyMini(puzzle:MiniPuzzle):MiniRun{return{entries:puzzle.cells.map(()=>''),elapsedMs:0,activeSince:null,started:false,complete:false,assisted:false,firstSolveSeconds:null,pencil:[],confirmed:[]}}
export function miniElapsed(run:MiniRun,now:number):number{return run.elapsedMs+(run.activeSince===null?0:Math.max(0,now-run.activeSince))}
export function pauseMini(run:MiniRun,now:number):MiniRun{return{...run,elapsedMs:miniElapsed(run,now),activeSince:null}}
export function resumeMini(run:MiniRun,now:number):MiniRun{return run.complete?run:{...run,started:true,activeSince:now}}
export function finishMini(run:MiniRun,puzzle:MiniPuzzle,now:number):MiniRun{
  if(!puzzle.cells.every((a,i)=>!a||run.entries[i]===a))return run
  const stopped=pauseMini(run,now)
  return{...stopped,complete:true,firstSolveSeconds:run.firstSolveSeconds??(!run.assisted?Math.round(stopped.elapsedMs/1000):null)}
}
export function restoreMini(value:unknown,puzzle:MiniPuzzle):MiniRun{
  const r=value as MiniRun
  if(!r||!Array.isArray(r.entries)||r.entries.length!==puzzle.cells.length||!r.entries.every(s=>typeof s==='string'&&/^[A-Z]*$/.test(s))||!Number.isFinite(r.elapsedMs)||r.elapsedMs<0||typeof r.assisted!=='boolean'||!Array.isArray(r.pencil)||!Array.isArray(r.confirmed))return emptyMini(puzzle)
  return{...r,activeSince:null,complete:puzzle.cells.every((a,i)=>!a||r.entries[i]===a)}
}
