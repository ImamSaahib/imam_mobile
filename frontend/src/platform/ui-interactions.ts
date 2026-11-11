type KeyInput = { key?: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean };
type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Timer = ReturnType<typeof setTimeout>;
type LongPressOptions = { delay?: number; tolerance?: number; setTimer?: (callback: () => void, delay: number) => Timer; clearTimer?: (timer: Timer) => void };

/** UI input contracts. Rendering belongs to the shared shell. */
export function quickSearchKey(e: KeyInput){return String(e.key||"").toLowerCase()==="k"&&(!!e.metaKey||!!e.ctrlKey)&&!e.shiftKey&&!e.altKey;}
export function focusQuickSearch(e: KeyInput & { preventDefault(): void },focus?: () => void){if(!quickSearchKey(e)||typeof focus!=="function")return false;e.preventDefault();focus();return true;}
export function contextMenuKey(e: KeyInput){return e.key==="ContextMenu"||(e.key==="F10"&&!!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey);}
export function clampMenu(point: Point,viewport: Size,size: Size,inset=8){return {x:Math.min(Math.max(inset,viewport.width-size.width-inset),Math.max(inset,point.x)),y:Math.min(Math.max(inset,viewport.height-size.height-inset),Math.max(inset,point.y))};}
export function longPress(open: (point: Point & { source: "touch" }) => void,{delay=550,tolerance=12,setTimer=setTimeout,clearTimer=clearTimeout}: LongPressOptions={}){
 let origin: Point | null=null;
 let timer: Timer | null=null;
 const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;origin=null;};
 return {start(point: Point){cancel();if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return;origin={...point};timer=setTimer(()=>{const p=origin;timer=null;origin=null;if(p)open({...p,source:"touch"});},delay);},
 move(point: Point){if(origin&&(!Number.isFinite(point?.x)||!Number.isFinite(point?.y)||Math.hypot(point.x-origin.x,point.y-origin.y)>tolerance))cancel();},
 end:cancel,cancel,dispose:cancel};
}
