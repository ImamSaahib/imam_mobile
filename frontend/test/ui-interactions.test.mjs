import test from "node:test";
import assert from "node:assert/strict";
import {quickSearchKey,focusQuickSearch,contextMenuKey,clampMenu,longPress} from "../src/platform/ui-interactions.js";
test("Ctrl and Command K accepted",()=>{assert.equal(quickSearchKey({key:"k",ctrlKey:true}),true);assert.equal(quickSearchKey({key:"K",metaKey:true}),true)});
test("bare K ignored",()=>assert.equal(quickSearchKey({key:"k"}),false));
test("other modifiers ignored",()=>{assert.equal(quickSearchKey({key:"k",ctrlKey:true,shiftKey:true}),false);assert.equal(quickSearchKey({key:"k",metaKey:true,altKey:true}),false)});
test("quick search focuses and prevents browser shortcut",()=>{let f=0,p=0;assert.equal(focusQuickSearch({key:"k",ctrlKey:true,preventDefault:()=>p++},()=>f++),true);assert.equal(f,1);assert.equal(p,1)});
test("irrelevant chords do not focus",()=>assert.equal(focusQuickSearch({key:"p",ctrlKey:true},()=>assert.fail()),false));
test("context menu keys supported",()=>{assert.equal(contextMenuKey({key:"ContextMenu"}),true);assert.equal(contextMenuKey({key:"F10",shiftKey:true}),true);assert.equal(contextMenuKey({key:"F10"}),false);assert.equal(contextMenuKey({key:"F10",shiftKey:true,ctrlKey:true}),false)});
test("menu clamped to viewport",()=>{assert.deepEqual(clampMenu({x:900,y:900},{width:600,height:400},{width:180,height:120}),{x:412,y:272});assert.deepEqual(clampMenu({x:-20,y:-20},{width:600,height:400},{width:180,height:120}),{x:8,y:8})});
test("oversized menu remains nonnegative",()=>assert.deepEqual(clampMenu({x:40,y:50},{width:100,height:100},{width:200,height:200}),{x:8,y:8}));
function clock(){let i=0;const jobs=new Map();return {setTimer(fn){jobs.set(++i,fn);return i},clearTimer(id){jobs.delete(id)},fire(){const f=[...jobs.values()];jobs.clear();f.forEach(fn=>fn())},size(){return jobs.size}}}
test("stationary touch opens once",()=>{const c=clock(),a=[],h=longPress(p=>a.push(p),c);h.start({x:20,y:30});c.fire();c.fire();assert.deepEqual(a,[{x:20,y:30,source:"touch"}])});
test("moving cancels long press",()=>{const c=clock(),a=[],h=longPress(p=>a.push(p),c);h.start({x:20,y:30});h.move({x:35,y:30});c.fire();assert.deepEqual(a,[])});
test("touch ending cancels long press",()=>{const c=clock(),a=[],h=longPress(p=>a.push(p),c);h.start({x:20,y:30});h.end();c.fire();assert.deepEqual(a,[])});
test("invalid points are ignored",()=>{const c=clock(),h=longPress(()=>assert.fail(),c);h.start({x:NaN,y:1});assert.equal(c.size(),0)});
