/** UI input contracts. Rendering belongs to the shared shell. */
export function quickSearchKey(e){return String(e.key||"").toLowerCase()==="k"&&(!!e.metaKey||!!e.ctrlKey)&&!e.shiftKey&&!e.altKey;}
export function focusQuickSearch(e,focus){if(!quickSearchKey(e)||typeof focus!=="function")return false;e.preventDefault();focus();return true;}
export function contextMenuKey(e){return e.key==="ContextMenu"||(e.key==="F10"&&!!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey);}
export function clampMenu(point,viewport,size,inset=8){return {x:Math.min(Math.max(inset,viewport.width-size.width-inset),Math.max(inset,point.x)),y:Math.min(Math.max(inset,viewport.height-size.height-inset),Math.max(inset,point.y))};}
export function longPress(open,{delay=550,tolerance=12,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let origin=null,timer=null;
 const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;origin=null;};
 return {start(point){cancel();if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return;origin={...point};timer=setTimer(()=>{const p=origin;timer=null;origin=null;if(p)open({...p,source:"touch"});},delay);},
 move(point){if(origin&&(!Number.isFinite(point?.x)||!Number.isFinite(point?.y)||Math.hypot(point.x-origin.x,point.y-origin.y)>tolerance))cancel();},
 end:cancel,cancel,dispose:cancel};
}
