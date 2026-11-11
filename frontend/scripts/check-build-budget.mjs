import {readdirSync,readFileSync} from "node:fs";
import {gzipSync} from "node:zlib";
const dir=new URL("../dist/assets/",import.meta.url);
const js=readdirSync(dir).filter(n=>n.endsWith(".js"));
if(!js.length)throw Error("Run npm run build first");
const bytes=js.reduce((sum,n)=>sum+gzipSync(readFileSync(new URL(n,dir))).length,0);
console.log(`Total JS gzip: ${(bytes/1024).toFixed(1)} KiB (limit: 300 KiB)`);
if(bytes>300*1024)process.exit(1);
