'use strict';
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const VERSION='2026-10-31-local-v2';
const STATEMENT='我同意合法合规使用 AI 陪伴功能，不违反法律法规，不侵犯他人合法权益。';
function payload(v){return JSON.stringify({purpose:'gloamere-companion-consent',uid:v.uid,version:VERSION,nonce:v.nonce,device:v.device,clientVersion:v.clientVersion,statement:STATEMENT,privacy:true,lawful:true});}
function createServer({file,authenticate,now=()=>Date.now()}){
 fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const db=new DatabaseSync(file);fs.chmodSync(file,0o600);db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS consent_receipts(uid INTEGER NOT NULL,version TEXT NOT NULL,accepted TEXT NOT NULL,ip TEXT NOT NULL,device TEXT NOT NULL,client_version TEXT NOT NULL,public_key TEXT NOT NULL,signature TEXT NOT NULL,nonce TEXT NOT NULL,statement TEXT NOT NULL,PRIMARY KEY(uid,version));');
 const challenges=new Map(),limits=new Map();
 const server=http.createServer(async(req,res)=>{const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};try{
 const route=new URL(req.url,'http://localhost').pathname.replace(/^\/desktop-companion/,'');
 if(route==='/health'&&req.method==='GET'){send(200,{ok:true});return;}
 const ip=req.headers['x-companion-client-ip']||req.socket.remoteAddress;
 if(req.headers.origin&&req.headers.origin!=='https://api.gloamere.cn'){send(403,{error:'Origin rejected'});return;}
 const auth=req.headers.authorization||'';if(!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(auth)){send(401,{error:'请登录 New API 账号'});return;}
 const identity=await authenticate(auth);if(!identity||!Number.isSafeInteger(identity.id)||identity.id<1){send(401,{error:'登录已失效，请重新登录'});return;}
 const uid=identity.id;const receipt=()=>{const r=db.prepare('SELECT version,accepted,device,client_version FROM consent_receipts WHERE uid=? AND version=?').get(uid,VERSION);return r||null;};
 if(route==='/whoami'&&req.method==='GET'){send(200,{uid,username:identity.username,displayName:identity.display_name||identity.username,consent:receipt(),consentVersion:VERSION,statement:STATEMENT});return;}
 if(req.method!=='POST'||req.headers['x-companion-request']!=='1'||!String(req.headers['content-type']).startsWith('application/json')){send(405,{error:'Invalid request'});return;}
 const limit=limits.get(uid);if(limit&&limit.until>now()&&limit.count>=30){send(429,{error:'请求过于频繁'});return;}if(!limit||limit.until<=now())limits.set(uid,{until:now()+60000,count:1});else limit.count++;
 let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>8192){send(413,{error:'Request too large'});return;}}let body;try{body=JSON.parse(raw||'{}');}catch{send(400,{error:'Invalid JSON'});return;}
 if(route==='/challenge'){for(const [n,c]of challenges)if(c.expires<now())challenges.delete(n);for(const [u,l]of limits)if(l.until<now())limits.delete(u);if(challenges.size>=10000||limits.size>=10000){send(429,{error:'Please retry later'});return;}const nonce=crypto.randomBytes(32).toString('base64url');challenges.set(nonce,{uid,expires:now()+120000});send(200,{nonce,version:VERSION,statement:STATEMENT});return;}
 if(route==='/consent'){
 if(body.version!==VERSION||body.statement!==STATEMENT||body.privacy!==true||body.lawful!==true||typeof body.device!=='string'||!/^[a-f0-9]{64}$/.test(body.device)||typeof body.clientVersion!=='string'||!/^[a-zA-Z0-9._-]{1,64}$/.test(body.clientVersion)){send(400,{error:'请完整确认声明'});return;}
 const challenge=challenges.get(body.nonce);if(!challenge||challenge.uid!==uid||challenge.expires<now()){send(409,{error:'确认已过期，请重试'});return;}challenges.delete(body.nonce);
 let valid=false;try{const der=Buffer.from(body.publicKey,'base64');const publicKey=crypto.createPublicKey({key:der,format:'der',type:'spki'});valid=publicKey.asymmetricKeyType==='ed25519'&&crypto.createHash('sha256').update(der).digest('hex')===body.device&&crypto.verify(null,Buffer.from(payload({...body,uid})),publicKey,Buffer.from(body.signature,'base64'));}catch{}
 if(!valid){send(400,{error:'客户端签名无效'});return;}
 db.prepare('INSERT OR IGNORE INTO consent_receipts VALUES(?,?,?,?,?,?,?,?,?,?)').run(uid,VERSION,new Date(now()).toISOString(),String(ip).slice(0,128),body.device,body.clientVersion,body.publicKey,body.signature,body.nonce,STATEMENT);send(200,{consent:receipt()});return;}
 send(404,{error:'Not found'});
 }catch{send(503,{error:'账号服务暂时不可用，请稍后重试'});}});
 server.db=db;return server;
}
if(require.main===module){const base=process.env.NEW_API_ORIGIN||'http://127.0.0.1:13000';if(!['http://127.0.0.1:13000','https://api.gloamere.cn'].includes(base))throw Error('Invalid auth origin');const server=createServer({file:process.env.COMPANION_CLOUD_DB||'/data/consent.sqlite',authenticate:async authorization=>{const r=await fetch(base+'/api/user/self',{headers:{Authorization:authorization},redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)return null;const b=await r.json();return b.success?b.data:null;}});server.listen(13301,'127.0.0.1',()=>console.log('Companion consent service listening on loopback'));}
module.exports={createServer,payload,VERSION,STATEMENT};
