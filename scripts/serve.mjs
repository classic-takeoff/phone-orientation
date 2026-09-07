import http from 'node:http';
import {readFile} from 'node:fs/promises';
const file=new URL('../docs/index.html',import.meta.url);
http.createServer(async(req,res)=>{if(req.url==='/'||req.url==='/index.html'){try{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(await readFile(file));}catch{res.writeHead(500);res.end('Run npm run build first.');}}else{res.writeHead(404);res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
