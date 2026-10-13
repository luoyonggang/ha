import {createServer} from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {resolve,relative,extname} from 'node:path';
const root=resolve('docs'),port=Number(process.env.APEX_MOBILE_PORT||8000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.jpg':'image/jpeg'};
createServer((req,res)=>{
 try{
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
   let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
   if(relative(root,path).startsWith('..')){res.writeHead(403).end();return;}
   if(statSync(path).isDirectory())path=resolve(path,'index.html');
   const bytes=readFileSync(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404).end('Not found');}
}).listen(port,'0.0.0.0',()=>console.log('Mobile static server listening on port',port));
