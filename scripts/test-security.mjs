import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { jsPDF } from 'jspdf';
import os from 'node:os';
import path from 'node:path';

const initialPassword=process.env.TEST_ACCOUNT_PASSWORD || 'Isolated-test-'+randomBytes(24).toString('base64url');
// The deployment regression also runs this suite with URL only, matching
// Netlify Functions where the NETLIFY build flag is not present.
const netlifyRuntime=process.env.TEST_NETLIFY_RUNTIME==='1';
const email='rabbikhan11002299@gmail.com';
const base='http://127.0.0.1:3100';
let trustedOrigin=base;
const testDir=await mkdtemp(path.join(os.tmpdir(),'dream-security-'));
const storeDir=path.join(testDir,'store');
const inbox=path.join(testDir,'inbox');
let server;
const fileFor=key=>path.join(storeDir,createHash('sha256').update(key).digest('hex')+'.json');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function start(origin=base,mail=true){
 trustedOrigin=origin;
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3100'],{cwd:process.cwd(),env:{...process.env,NETLIFY:'',SITE_ID:'',APP_URL:netlifyRuntime?'':origin,URL:netlifyRuntime?origin:'',AUTH_STORAGE:'local',AUTH_LOCAL_DIR:storeDir,AUTH_TEST_OUTBOX:mail?inbox:'',SMTP_HOST:'',SMTP_USER:'',SMTP_PASSWORD:'',SMTP_FROM:''},stdio:['ignore','pipe','pipe']});
 let exited=false;console.log('Starting isolated server');server.on('exit',()=>{exited=true});
 server.stdout.on('data',data=>process.stdout.write(data));server.stderr.on('data',data=>process.stderr.write(data));
 for(let i=0;i<100;i++){if(exited)throw new Error('Local security test server exited.');try{if((await fetch(base+'/login',{signal:AbortSignal.timeout(5000)})).status===200){console.log('Test server ready');return}}catch{}await pause(100)}
 throw new Error('Test server failed to start.');
}
async function stop(){if(!server)return;const processToStop=server;server=undefined;if(processToStop.exitCode!==null)return;const done=new Promise(resolve=>processToStop.once('exit',resolve));processToStop.kill('SIGTERM');const timer=setTimeout(()=>processToStop.kill('SIGKILL'),1500);await done;clearTimeout(timer);}
async function request(url,body,options={}){
 const headers={Origin:trustedOrigin,'Content-Type':'application/json','X-Requested-With':'DreamSourcing',...(options.cookie?{Cookie:options.cookie}:{}),...(options.csrf?{'X-CSRF-Token':options.csrf}:{}),...options.headers};
 if(options.noOrigin)delete headers.Origin;
 return fetch(base+url,{signal:AbortSignal.timeout(15000),method:options.method||(body===undefined?'GET':'POST'),headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
}
const cookieOf=response=>response.headers.getSetCookie()[0]?.split(';')[0];
async function login(password=initialPassword){const r=await request('/api/auth/login',{email,password});assert.equal(r.status,200);return cookieOf(r);}
async function inboxMessages(){try{return await readdir(inbox)}catch{return []}}
async function waitMail(previous){for(let i=0;i<100;i++){const files=await inboxMessages();const name=files.find(f=>!previous.includes(f));if(name)return JSON.parse(await readFile(path.join(inbox,name),'utf8'));await pause(50)}throw new Error('No reset message in private test inbox.');}
async function session(cookie){const r=await request('/api/auth/session',undefined,{cookie});assert.equal(r.status,200);return r.json();}

try{
 // Seed only the isolated fixture. Never read or change the owner's account.
 await mkdir(storeDir,{recursive:true});
 const salt=randomBytes(16).toString('base64url');
 const passwordHash=['scrypt','32768','8','3',salt,scryptSync(initialPassword,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024}).toString('base64url')].join('$');
 await writeFile(fileFor('account'),JSON.stringify({etag:randomUUID(),value:{email,passwordHash,version:randomUUID(),reset:null}}));
 await start();
 const protectedPage=await request('/');assert.equal(protectedPage.status,307);assert.ok(protectedPage.headers.get('location').includes('/login'));assert.ok(!(await protectedPage.text()).includes('SML Trims'));
 assert.equal((await request('/api/catalog')).status,401);
 assert.equal((await request('/history')).status,307);
 assert.equal((await request('/api/history')).status,401);
 assert.equal((await request('/api/history/00000000-0000-4000-8000-000000000000/pdf')).status,401);
 assert.equal((await request('/api/auth/session',undefined,{cookie:'dream-session-local=authenticated'})).status,401);
 const spoof=await request('/',undefined,{headers:{'x-middleware-subrequest':'proxy:proxy:proxy:proxy:proxy','oai-authenticated-user-id':'owner','oai-authenticated-user-email':email}});assert.equal(spoof.status,307);
 assert.equal((await request('/api/auth/register',{email,password:'not-a-real-account'})).status,404);
 assert.equal((await request('/api/auth/login',{email,password:'invalid'},{noOrigin:true})).status,403);
 assert.equal((await request('/api/auth/login',{email,password:'invalid'},{headers:{Origin:'https://attacker.invalid'}})).status,403);
 assert.equal((await request('/api/auth/login',{email,password:'x'.repeat(5000)})).status,413);
 assert.equal((await request('/api/auth/login',{email,password:'invalid'},{headers:{'Content-Type':'text/plain'}})).status,415);
 const wrong=await request('/api/auth/login',{email,password:'wrong-password'});assert.equal(wrong.status,401);
 const wrongEmail=await request('/api/auth/login',{email:'unknown@example.com',password:initialPassword});assert.equal(wrongEmail.status,401);assert.deepEqual(await wrong.json(),await wrongEmail.json());
 console.log('PASS private pages/APIs, forged identity, closed registration, origin checks and body limits');

 const loginResponse=await request('/api/auth/login',{email:email.toUpperCase(),password:initialPassword});assert.equal(loginResponse.status,200);
 const setCookie=loginResponse.headers.getSetCookie()[0];assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=strict/i);
 const firstCookie=cookieOf(loginResponse);const firstSession=await session(firstCookie);
 const privateResponse=await request('/',undefined,{cookie:firstCookie});assert.equal(privateResponse.status,200);assert.match(privateResponse.headers.get('cache-control'),/no-store/);assert.match(privateResponse.headers.get('content-security-policy'),/nonce-/);assert.equal(privateResponse.headers.get('x-frame-options'),'DENY');
 const catalogResponse=await request('/api/catalog',undefined,{cookie:firstCookie});assert.equal(catalogResponse.status,200);const catalog=await catalogResponse.json();
 assert.equal((await request('/api/catalog',catalog,{method:'PUT',cookie:firstCookie})).status,403);
 assert.equal((await request('/api/catalog',catalog,{method:'PUT',cookie:firstCookie,csrf:firstSession.csrfToken,headers:{Origin:'https://attacker.invalid'}})).status,403);
 assert.equal((await request('/api/catalog',{...catalog,administrator:true},{method:'PUT',cookie:firstCookie,csrf:firstSession.csrfToken})).status,400);
 const updated={...catalog,templates:catalog.templates.map((t,i)=>i? t:{...t,totalLabel:'TOTAL PAYABLE',totalRowHeight:55})};
 const saved=await request('/api/catalog',updated,{method:'PUT',cookie:firstCookie,csrf:firstSession.csrfToken});assert.equal(saved.status,200);
 assert.equal((await request('/api/catalog',updated,{method:'PUT',cookie:firstCookie,csrf:firstSession.csrfToken})).status,409);
 assert.equal((await (await request('/api/catalog',undefined,{cookie:firstCookie})).json()).templates[0].totalLabel,'TOTAL PAYABLE');
 const rawSession=firstCookie.split('=')[1];
 const sessionRecord=await readFile(fileFor('sessions/'+createHash('sha256').update(rawSession).digest('hex')),'utf8');assert.ok(!sessionRecord.includes(rawSession));
 assert.ok(!(await readFile(fileFor('account'),'utf8')).includes(initialPassword));
 console.log('PASS cookies, CSP/no-store headers, CSRF, validated saves, conflict detection and hashed storage');

 const pdf=new jsPDF();pdf.text('History test document',20,20);
 const pdfBase64=Buffer.from(pdf.output('arraybuffer')).toString('base64');
 const snapshot={billNo:'HISTORY/001',challanNo:'CHA/001',date:'2026-10-27',company:'History Test Customer',address:'Dhaka',contact:'Test',po:'PO/1',docType:'both',pageMode:'split',template:catalog.templates[0],lines:[{...catalog.products[0],rowId:randomUUID(),qty:0}]};
 const historyBody={snapshot,pdfBase64,pageCount:1};
 const saveOptions={cookie:firstCookie,csrf:firstSession.csrfToken};
 assert.equal((await request('/api/history',historyBody,{cookie:firstCookie})).status,403);
 assert.equal((await request('/api/history',{...historyBody,snapshot:{...snapshot,lines:[]} },saveOptions)).status,400);
 assert.equal((await request('/api/history',{...historyBody,snapshot:{...snapshot,date:'2026-02-30'}},saveOptions)).status,400);
 assert.equal((await request('/api/history',{...historyBody,snapshot:{...snapshot,lines:[{...snapshot.lines[0],qty:-1}]}},saveOptions)).status,400);
 assert.equal((await request('/api/history',{...historyBody,pdfBase64:Buffer.from('not a PDF').toString('base64')},saveOptions)).status,400);
 const originalResponse=await request('/api/history',historyBody,saveOptions);assert.equal(originalResponse.status,201);
 const original=await originalResponse.json();assert.equal(original.total,0);assert.ok(Number.isFinite(Date.parse(original.createdAt)));
 const download=await request(`/api/history/${original.id}/pdf`,undefined,{cookie:firstCookie});assert.equal(download.status,200);
 assert.equal(download.headers.get('content-type'),'application/pdf');assert.match(download.headers.get('content-disposition'),/attachment/);assert.match(download.headers.get('cache-control'),/no-store/);
 assert.equal(Buffer.from(await download.arrayBuffer()).toString('base64'),pdfBase64);
 const stored=JSON.parse(await readFile(fileFor(`history/documents/${original.id}`),'utf8')).value;
 assert.deepEqual(stored.snapshot,snapshot);
 const editedResponse=await request('/api/history',{...historyBody,sourceId:original.id,snapshot:{...snapshot,billNo:'HISTORY/EDITED'}},saveOptions);assert.equal(editedResponse.status,201);
 const edited=await editedResponse.json();assert.equal(edited.sourceId,original.id);assert.notEqual(edited.id,original.id);
 assert.equal(JSON.parse(await readFile(fileFor(`history/documents/${original.id}`),'utf8')).value.snapshot.billNo,'HISTORY/001');
 const concurrent=await Promise.all(Array.from({length:11},()=>request('/api/history',historyBody,saveOptions)));
 concurrent.forEach(response=>assert.equal(response.status,201));
 const page1=await (await request('/api/history?page=1',undefined,{cookie:firstCookie})).json();assert.equal(page1.total,13);assert.equal(page1.entries.length,10);assert.equal(page1.totalPages,2);assert.ok(page1.entries.every(entry=>!('pdfBase64' in entry)&&!('snapshot' in entry)));
 const page2=await (await request('/api/history?page=2',undefined,{cookie:firstCookie})).json();assert.equal(page2.entries.length,3);assert.equal(new Set([...page1.entries,...page2.entries].map(entry=>entry.id)).size,13);
 assert.equal((await request('/history?page=2',undefined,{cookie:firstCookie})).status,200);
 assert.equal((await request(`/?history=${original.id}`,undefined,{cookie:firstCookie})).status,200);
 assert.equal((await request('/api/history/not-an-id/pdf',undefined,{cookie:firstCookie})).status,404);
 assert.equal((await request('/?history=not-an-id',undefined,{cookie:firstCookie})).status,404);
 console.log('PASS history access control, validation, exact PDF downloads, editable snapshots, preserved originals, concurrent saves and pagination');

 const selection={ids:[original.id,edited.id]};
 assert.equal((await request('/api/history',selection,{method:'DELETE'})).status,401);
 assert.equal((await request('/api/history',selection,{method:'DELETE',cookie:firstCookie})).status,403);
 assert.equal((await request('/api/history',selection,{method:'DELETE',...saveOptions,headers:{Origin:'https://attacker.invalid'}})).status,403);
 assert.equal((await request('/api/history',{ids:[]},{method:'DELETE',...saveOptions})).status,400);
 assert.equal((await request('/api/history',{ids:[original.id,original.id]},{method:'DELETE',...saveOptions})).status,400);
 assert.equal((await request('/api/history',{ids:['not-an-id']},{method:'DELETE',...saveOptions})).status,400);
 const filtered=await (await request('/api/history?q=HISTORY%2FEDITED&sort=oldest&pageSize=25&docType=both',undefined,{cookie:firstCookie})).json();
 assert.equal(filtered.total,1);assert.equal(filtered.entries[0].id,edited.id);assert.equal(filtered.pageSize,25);
 const trashed=await request('/api/history',selection,{method:'DELETE',...saveOptions});assert.equal(trashed.status,200);assert.equal((await trashed.json()).count,2);
 const activeHistory=await (await request('/api/history',undefined,{cookie:firstCookie})).json();assert.equal(activeHistory.total,11);assert.equal(activeHistory.trashCount,2);
 const trashHistory=await (await request('/api/history?view=trash',undefined,{cookie:firstCookie})).json();assert.equal(trashHistory.total,2);assert.ok(trashHistory.entries.every(entry=>entry.deletedAt));
 assert.equal((await request(`/api/history/${original.id}/pdf`,undefined,{cookie:firstCookie})).status,404);
 assert.equal((await request(`/?history=${original.id}`,undefined,{cookie:firstCookie})).status,404);
 assert.equal((await request('/history?view=trash&q=HISTORY&sort=oldest',undefined,{cookie:firstCookie})).status,200);
 assert.equal((await request('/api/history',selection,{method:'PATCH',cookie:firstCookie})).status,403);
 const restored=await request('/api/history',selection,{method:'PATCH',...saveOptions});assert.equal(restored.status,200);
 const restoredDownload=await request(`/api/history/${original.id}/pdf`,undefined,{cookie:firstCookie});assert.equal(restoredDownload.status,200);assert.equal(Buffer.from(await restoredDownload.arrayBuffer()).toString('base64'),pdfBase64);
 assert.equal((await (await request('/api/history?view=trash',undefined,{cookie:firstCookie})).json()).total,0);
 assert.equal((await (await request('/api/history',undefined,{cookie:firstCookie})).json()).total,13);
 const historyIndexFile=fileFor('history/index');
 const datedIndex=JSON.parse(await readFile(historyIndexFile,'utf8'));
 const originalIndex=structuredClone(datedIndex);
 datedIndex.value=datedIndex.value.map(entry=>({...entry,createdAt:entry.id===original.id?'2026-10-26T18:00:00.000Z':entry.id===edited.id?'2026-10-27T17:59:59.999Z':'2026-10-27T18:00:00.000Z'}));
 await writeFile(historyIndexFile,JSON.stringify(datedIndex));
 const dateFiltered=await (await request('/api/history?from=2026-10-27&to=2026-10-27&sort=oldest',undefined,{cookie:firstCookie})).json();assert.equal(dateFiltered.total,2);assert.deepEqual(dateFiltered.entries.map(entry=>entry.id),[original.id,edited.id]);
 await writeFile(historyIndexFile,JSON.stringify(originalIndex));
 const trashAndSave=await Promise.all([request('/api/history',{ids:[original.id]},{method:'DELETE',...saveOptions}),request('/api/history',historyBody,saveOptions)]);assert.deepEqual(trashAndSave.map(response=>response.status),[200,201]);
 const concurrentIndex=await (await request('/api/history?pageSize=50',undefined,{cookie:firstCookie})).json();assert.equal(concurrentIndex.total,13);assert.equal(concurrentIndex.trashCount,1);
 assert.equal((await request('/api/history',{ids:[original.id]},{method:'PATCH',...saveOptions})).status,200);
 console.log('PASS search/type/date/sort filters, Bangladesh day boundaries, bulk trash/restore, CSRF, inaccessible trashed PDFs and concurrent index changes');

 const unknown=await request('/api/auth/forgot-password',{email:'unknown@example.com'});assert.equal(unknown.status,200);const before=await inboxMessages();
 const known=await request('/api/auth/forgot-password',{email});assert.equal(known.status,200);assert.deepEqual(await unknown.json(),await known.json());
 const mail=await waitMail(before);assert.equal(mail.to,email);
 const resetToken=new URL(mail.text.match(/https?:\/\/\S+/)[0]).hash.slice('#token='.length);
 assert.ok(!(await readFile(fileFor('account'),'utf8')).includes(resetToken));
 const newPassword='Test-new-'+randomBytes(18).toString('base64url');
 const resetResults=await Promise.all([request('/api/auth/reset-password',{token:resetToken,password:newPassword}),request('/api/auth/reset-password',{token:resetToken,password:newPassword})]);
 assert.deepEqual(resetResults.map(r=>r.status).sort(),[200,400]);
 assert.equal((await request('/api/auth/session',undefined,{cookie:firstCookie})).status,401);
 assert.equal((await request(`/api/history/${original.id}/pdf`,undefined,{cookie:firstCookie})).status,401);
 assert.equal((await request('/api/auth/login',{email,password:initialPassword})).status,401);
 assert.equal((await request('/api/auth/reset-password',{token:resetToken,password:newPassword})).status,400);
 const secondCookie=await login(newPassword);const secondSession=await session(secondCookie);
 console.log('PASS recovery message, hashed reset token, atomic single use, replay rejection and session invalidation');

 const oldMail=await inboxMessages();await request('/api/auth/forgot-password',{email});const expiring=await waitMail(oldMail);
 const expiredToken=new URL(expiring.text.match(/https?:\/\/\S+/)[0]).hash.slice('#token='.length);
 const accountData=JSON.parse(await readFile(fileFor('account'),'utf8'));accountData.value.reset.expiresAt=Date.now()-1;await writeFile(fileFor('account'),JSON.stringify(accountData));
 assert.equal((await request('/api/auth/reset-password',{token:expiredToken,password:newPassword})).status,400);
 const changedPassword='Test-change-'+randomBytes(18).toString('base64url');
 assert.equal((await request('/api/auth/change-password',{currentPassword:'wrong-password',password:changedPassword},{cookie:secondCookie,csrf:secondSession.csrfToken})).status,400);
 assert.equal((await request('/api/auth/change-password',{currentPassword:newPassword,password:changedPassword},{cookie:secondCookie,csrf:secondSession.csrfToken})).status,200);
 assert.equal((await request('/api/auth/session',undefined,{cookie:secondCookie})).status,401);
 const thirdCookie=await login(changedPassword);const thirdSession=await session(thirdCookie);
 assert.equal((await request('/api/auth/logout',{}, {cookie:thirdCookie,csrf:thirdSession.csrfToken})).status,200);
 assert.equal((await request('/api/auth/session',undefined,{cookie:thirdCookie})).status,401);
 console.log('PASS expiry, current-password verification, password changes and logout revocation');

 await stop();await start('https://localhost:3100',false);
 assert.equal((await request('/api/auth/login',{email,password:initialPassword})).status,401);
 const secureLogin=await request('/api/auth/login',{email,password:changedPassword});assert.equal(secureLogin.status,200);const secureSet=secureLogin.headers.getSetCookie()[0];assert.match(secureSet,/^__Host-dream-session=/);assert.match(secureSet,/; Secure/i);assert.match(secureSet,/Path=\//);
 const secureCookie=cookieOf(secureLogin);const secureSession=await session(secureCookie);
 const sessionKey='sessions/'+createHash('sha256').update(secureCookie.split('=')[1]).digest('hex');const expiredSession=JSON.parse(await readFile(fileFor(sessionKey),'utf8'));expiredSession.value.expiresAt=Date.now()-1;await writeFile(fileFor(sessionKey),JSON.stringify(expiredSession));
 assert.equal((await request('/api/auth/session',undefined,{cookie:secureCookie})).status,401);
 assert.equal((await request('/api/auth/forgot-password',{email})).status,503);
 assert.ok(secureSession.expiresAt>Date.now());
 console.log('PASS restart persistence, HTTPS cookie flags, session expiry and missing-mail failure');

 // Expire only the isolated test counter before verifying the limit boundary.
 await rm(fileFor('limits/login'),{force:true});
 for(let i=0;i<15;i++)assert.equal((await request('/api/auth/login',{email:`unknown${i}@example.com`,password:'invalid-password'})).status,401);
 assert.equal((await request('/api/auth/login',{email,password:changedPassword})).status,429);
 await stop();await start('https://localhost:3100',false);
 assert.equal((await request('/api/auth/login',{email,password:changedPassword})).status,429);
 console.log('PASS rate limits across changing email addresses and server restart');
 console.log('All isolated authentication and API security checks passed. No external email was sent.');
}finally{await stop();await rm(testDir,{recursive:true,force:true});}
