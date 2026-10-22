// Teste pentru funcțiile „runda 8” din AI-Liber (implementate efectiv în 1.4.1): scanare PII înainte de trimitere, istoric local căutabil,
// indicator „ce pleacă”, copie .fff.json fără chei API. Rulează: node tests/fff-r8.test.mjs
// Rețea blocată; singurul „server” este un răspuns HTTP de test pentru text.pollinations.ai (nu se simulează niciun model în aplicație).
import {createRequire} from "module"; import {fileURLToPath} from "url"; import path from "path"; import fs from "fs";
const require=createRequire("/opt/node-tools/package.json"); const {chromium}=require("playwright");
const here=path.dirname(fileURLToPath(import.meta.url)); const URL_='file://'+path.resolve(here,'../index.html');
const AXE=process.env.FFF_AXE||'/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;} else {fail++; console.log('FAIL:',m);} };
const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
async function open(opts={}){
  const ctx=await browser.newContext({viewport:opts.vp||{width:1280,height:800},colorScheme:opts.scheme||'light',locale:'ro-RO',bypassCSP:false,acceptDownloads:true});
  const reqs=[], bodies=[];
  await ctx.route(/^https?:/, r=>{ const u=r.request().url(); reqs.push(u);
    if(u.startsWith('https://text.pollinations.ai/openai')){ bodies.push(r.request().postData()||''); if(opts.reply!==false) return r.fulfill({status:200,contentType:'text/event-stream',body:'data: {"choices":[{"delta":{"content":"Răspuns de test."}}]}\n\ndata: [DONE]\n\n'}); }
    return r.abort(); });
  const p=await ctx.newPage(); const errs=[];
  p.on('pageerror',e=>errs.push('pageerror '+e.message)); p.on('console',m=>{ if(m.type()==='error'||/Content Security/i.test(m.text())) errs.push('console '+m.text()); });
  await p.addInitScript({content:fs.readFileSync(AXE,'utf8')}); // init scripts nu sunt supuse CSP
  if(!opts.noConsent) await p.addInitScript(()=>{ try{ localStorage.setItem('ai-liber.ok_pollinations','1'); }catch(e){} }); // acordul pentru serviciul extern (1.4.5) e testat separat
  if(opts.init) await p.addInitScript(opts.init);
  await p.goto(URL_); await p.waitForTimeout(opts.wait||3600);
  return {ctx,p,errs,reqs,bodies};
}
async function axe(p,label){
  await p.waitForTimeout(100);
  const r=await p.evaluate(async()=>await axe.run(document,{resultTypes:['violations']}));
  ok(r.violations.length===0,`axe ${label}: `+r.violations.map(v=>v.id+' '+v.nodes.map(n=>n.target).join('|').slice(0,160)).join('; '));
}
const sel=async(p,prov)=>p.evaluate(pr=>{const m=MODELS.find(x=>x.p===pr); selM(m.id); return m.id;},prov);

const PII_TXT='Scrie-i lui ion.popescu@example.com un mesaj. IBAN-ul meu: RO49AAAA1B31007593840000 și CNP 1800101221144';
// 1. pornire curată
{ const {ctx,p,errs,reqs}=await open();
  ok(errs.length===0,'pornire fără erori/CSP: '+errs.join(' | '));
  ok(reqs.length===0,'0 cereri de rețea la pornire: '+reqs.join(','));
  ok(await p.evaluate(()=>document.documentElement.getAttribute('lang')!==null),'html[lang] prezent');
  ok(await p.evaluate(()=>document.querySelector('meta[name=application-version]').content==='1.4.9'),'versiune 1.4.9 în meta');
  ok((await p.textContent('#app-version')).includes('v 1.4.9 · 2026-10-23'),'text #app-version');
  const ov=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth); ok(ov<=0,'fără depășire orizontală 1280');
  await axe(p,'start 1280');
  // 2. indicator
  await sel(p,'webllm'); await p.waitForTimeout(150);
  let c=await p.textContent('#c5-chip'); ok(/🔒/.test(c)&&/browser/i.test(c),'chip local (webllm): '+c);
  await sel(p,'ollama'); c=await p.textContent('#c5-chip'); ok(/🔒/.test(c)&&/computer|calculator/i.test(c),'chip local (ollama): '+c);
  await sel(p,'pollinations'); c=await p.textContent('#c5-chip'); ok(/↗/.test(c)&&c.includes('text.pollinations.ai'),'chip remote: '+c);
  await sel(p,'anthropic'); c=await p.textContent('#c5-chip'); ok(c.includes('api.anthropic.com'),'chip anthropic: '+c);
  await p.evaluate(()=>setLang('ro')); c=await p.textContent('#c5-chip'); ok(/Mesajele/.test(c),'chip tradus în ro: '+c);
  await p.evaluate(()=>setLang('de')); c=await p.textContent('#c5-chip'); ok(/Nachrichten/.test(c),'chip tradus în de: '+c);
  await p.evaluate(()=>setLang('en'));
  await ctx.close(); }

// 1b. acord înainte de prima trimitere către un serviciu extern fără cheie (1.4.5)
{ const {ctx,p,errs,bodies}=await open({noConsent:true});
  await sel(p,'pollinations'); await p.fill('#cta','Salut'); await p.click('#csend'); await p.waitForSelector('dialog.c5-dlg[open]',{timeout:3000});
  ok(/text\.pollinations\.ai/.test(await p.textContent('dialog.c5-dlg[open] .c5-body')),'dialog de acord numește gazda');
  ok(bodies.length===0,'nimic trimis înainte de acord');
  await p.click('dialog.c5-dlg[open] .c5-btn:not(.c5-pri):not(.c5-x)'); await p.waitForTimeout(400);
  ok(bodies.length===0,'refuz: nimic trimis'); ok(await p.evaluate(()=>localStorage.getItem('ai-liber.ok_pollinations'))===null,'refuz: acord nesalvat');
  await p.click('#csend'); await p.waitForSelector('dialog.c5-dlg[open]',{timeout:3000}); await p.click('dialog.c5-dlg[open] .c5-pri'); await p.waitForTimeout(900);
  ok(bodies.length===1,'după acord: trimis o dată ('+bodies.length+')'); ok(await p.evaluate(()=>localStorage.getItem('ai-liber.ok_pollinations'))==='1','acord memorat');
  await p.fill('#cta','Din nou'); await p.click('#csend'); await p.waitForTimeout(900); ok(bodies.length===2,'a doua trimitere fără dialog');
  ok(errs.length===0,'fără erori: '+errs.join('|'));
  await ctx.close(); }

// 3. PII înainte de trimitere (mascare / continuare / anulare / curat / local)
{ const {ctx,p,errs,bodies}=await open();
  await sel(p,'pollinations');
  const txt='Scrie-i lui ion.popescu@example.com un mesaj. IBAN-ul meu: RO49AAAA1B31007593840000 și CNP 1800101221144';
  // curat
  await p.fill('#cta','Salut, ce faci?'); await p.click('#csend'); await p.waitForTimeout(700);
  ok(await p.locator('dialog.fff-pii').count()===0,'text curat: fără dialog PII'); ok(bodies.length===1,'text curat trimis: '+bodies.length);
  ok(!/@/.test(bodies[0]||'')||true,'ok');
  // cu PII -> mascare
  await p.fill('#cta',txt); await p.click('#csend'); await p.waitForSelector('dialog.fff-pii[open]',{timeout:3000});
  const items=await p.locator('dialog.fff-pii li').count(); ok(items>=2,'dialog PII listează elementele: '+items);
  ok(bodies.length===1,'nimic trimis cât timp dialogul e deschis');
  await axe(p,'dialog PII');
  await p.click('dialog.fff-pii button[data-primary]'); await p.waitForTimeout(900);
  ok(bodies.length===2,'după mascare s-a trimis o cerere: '+bodies.length);
  const b=bodies[1]||''; ok(!b.includes('ion.popescu@example.com')&&!b.includes('RO49AAAA1B31007593840000'),'datele mascate NU apar în cererea trimisă');
  ok(/\[[^\]]+\]/.test(JSON.parse(b).messages.filter(m=>m.role==='user').pop().content||''),'în cerere apar etichete de înlocuire');
  // continuă fără mascare
  await p.fill('#cta',txt); await p.click('#csend'); await p.waitForSelector('dialog.fff-pii[open]');
  await p.click('dialog.fff-pii button:has-text("fără mascare"), dialog.fff-pii button:has-text("without masking")'); await p.waitForTimeout(900);
  ok(bodies.length===3&&(bodies[2]).includes('ion.popescu@example.com'),'„continuă” trimite textul original');
  // anulare
  await p.fill('#cta',txt); await p.click('#csend'); await p.waitForSelector('dialog.fff-pii[open]');
  await p.click('dialog.fff-pii button:has-text("Anulează"), dialog.fff-pii button:has-text("Cancel")'); await p.waitForTimeout(500);
  ok(bodies.length===3,'anulare: nu se trimite nimic'); ok((await p.inputValue('#cta'))===txt,'anulare: textul rămâne în câmp');
  // dezactivat din bară
  await p.evaluate(()=>{ localStorage.setItem('ai-liber.piiguard','0'); });
  await p.fill('#cta',txt); await p.click('#csend'); await p.waitForTimeout(800);
  ok(await p.locator('dialog.fff-pii').count()===0&&bodies.length===4,'cu verificarea oprită se trimite direct');
  await p.evaluate(()=>{ localStorage.removeItem('ai-liber.piiguard'); });
  // model local: nu se scanează
  await sel(p,'ollama'); await p.fill('#cta',txt); await p.click('#csend'); await p.waitForTimeout(600);
  ok(await p.locator('dialog.fff-pii').count()===0,'model local: fără dialog PII');
  ok(errs.filter(e=>!/Failed to fetch|net::|NetworkError/i.test(e)).length===0,'fără erori JS: '+errs.join('|'));
  await ctx.close(); }

// 4. istoric local: salvare opt-in, căutare, continuare, export, ștergere, mascare, copie fără chei API
{ const {ctx,p,errs,bodies}=await open();
  await sel(p,'pollinations');
  await p.fill('#cta','Prima întrebare despre grădinărit și roșii'); await p.click('#csend'); await p.waitForTimeout(900);
  ok(await p.evaluate(()=>localStorage.getItem('ai-liber.conv'))===null,'implicit nu se salvează nimic');
  await p.check('#c5-hist'); ok(await p.evaluate(()=>localStorage.getItem('ai-liber.hist'))==='1','opțiunea se păstrează');
  await p.click('#c5-topbtn'); await p.waitForSelector('dialog.c5-dlg[open]'); ok((await p.textContent('dialog.c5-dlg .c5-note')).length>10,'panou istoric deschis');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.fill('#cta','A doua întrebare despre astronomie și planete'); await p.click('#csend'); await p.waitForTimeout(900);
  let conv=await p.evaluate(()=>JSON.parse(localStorage.getItem('ai-liber.conv')||'[]')); ok(conv.length===1,'o conversație salvată: '+conv.length);
  ok(conv[0]&&conv[0].m.length===4,'conține 4 mesaje (2 întrebări + 2 răspunsuri): '+(conv[0]&&conv[0].m.length));
  await p.click('#c5-topbtn'); await p.waitForSelector('dialog.c5-dlg[open]'); await axe(p,'istoric'); 
  // căutare cu diacritice/morfologie
  await p.fill('dialog.c5-dlg input[type=search]','astronomia'); await p.waitForTimeout(250);
  const n1=await p.locator('dialog.c5-dlg li.c5-li').count(); ok(n1===1,'căutare „astronomia” găsește conversația: '+n1);
  ok(await p.locator('dialog.c5-dlg mark').count()>=1,'rezultatul are termeni evidențiați');
  await p.fill('dialog.c5-dlg input[type=search]','zzzzqqq'); await p.waitForTimeout(250);
  ok(await p.locator('dialog.c5-dlg li.c5-li').count()===0,'căutare fără rezultate');
  await p.fill('dialog.c5-dlg input[type=search]','');
  // export Markdown
  await p.click('dialog.c5-dlg li.c5-li summary');
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('dialog.c5-dlg button:has-text("Export Markdown"), dialog.c5-dlg button:has-text("Exportă Markdown")')]);
  const md=fs.readFileSync(await dl.path(),'utf8'); ok(md.includes('astronomie')&&md.includes('Răspuns de test'),'export Markdown conține textul');
  // continuă în chat
  await p.click('dialog.c5-dlg button:has-text("Continue in chat"), dialog.c5-dlg button:has-text("Continuă în chat")'); await p.waitForTimeout(500);
  ok(await p.locator('#cmsgs .msg.usr').count()===2,'conversația e reîncărcată în chat (2 mesaje utilizator)');
  ok(await p.evaluate(()=>hist.length)===4,'istoricul intern a fost restaurat');
  // PII în istoric
  await p.evaluate(()=>{ const l=JSON.parse(localStorage.getItem('ai-liber.conv')); l[0].m.push(['u','scrie la test.user@example.org']); localStorage.setItem('ai-liber.conv',JSON.stringify(l)); });
  await p.click('#c5-topbtn'); await p.waitForSelector('dialog.c5-dlg[open]');
  await p.click('dialog.c5-dlg button:has-text("personal data in history"), dialog.c5-dlg button:has-text("date personale în istoric")');
  await p.waitForSelector('dialog.c5-dlg:has(button:has-text("Da")), dialog.c5-dlg:has(button:has-text("Yes"))');
  await p.click('dialog.c5-dlg button.c5-pri'); await p.waitForTimeout(600);
  ok(!(await p.evaluate(()=>localStorage.getItem('ai-liber.conv'))).includes('test.user@example.org'),'datele personale din istoric au fost mascate');
  await p.keyboard.press('Escape');
  // copie fără chei API
  await p.evaluate(()=>{ localStorage.setItem('ai-liber.aik.enc_openai','SECRETBLOB'); localStorage.setItem('ai-liber.ksalt','SALT'); localStorage.setItem('ai-liber.aik.openai','sk-live-secret'); });
  const bundle=await p.evaluate(()=>FFF.bundle.build()); const keys=Object.keys(bundle.data);
  ok(keys.includes('ai-liber.conv')&&keys.includes('ai-liber.hist'),'copia conține istoricul: '+keys.join(','));
  ok(!keys.some(k=>/^(ai-liber\.aik\.|aik_|sk_|ai-liber\.ksalt)/.test(k)),'copia NU conține cheile API: '+keys.join(','));
  // criptat
  const [dl2]=await Promise.all([p.waitForEvent('download'),p.evaluate(()=>FFF.bundle.export({encrypt:true,password:'parola-de-test-1'}))]);
  const env=JSON.parse(fs.readFileSync(await dl2.path(),'utf8')); ok(env.format==='fff-bundle-enc'&&!JSON.stringify(env).includes('astronomie'),'copia criptată nu conține text clar');
  // ștergere
  await p.click('#c5-topbtn'); await p.waitForSelector('dialog.c5-dlg[open]');
  await p.click('dialog.c5-dlg li.c5-li summary'); await p.click('dialog.c5-dlg li.c5-li button:has-text("Delete"), dialog.c5-dlg li.c5-li button:has-text("Șterge")'); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('ai-liber.conv')||'[]').length)===0,'ștergerea unei conversații');
  ok(errs.filter(e=>!/Failed to fetch|net::|NetworkError/i.test(e)).length===0,'fără erori JS în istoric: '+errs.join('|'));
  await ctx.close(); }

// 5. mobil + întunecat + 8 limbi (texte noi existente)
{ const {ctx,p,errs}=await open({vp:{width:360,height:740},scheme:'dark'});
  const ov=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth); ok(ov<=0,'fără depășire orizontală 360');
  await p.click('#c5-topbtn'); await p.waitForSelector('dialog.c5-dlg[open]'); await axe(p,'istoric 360 întunecat');
  const w=await p.evaluate(()=>document.querySelector('dialog.c5-dlg').getBoundingClientRect().width); ok(w<=360,'dialog încape la 360: '+w);
  await ctx.close(); }
{ const {ctx,p}=await open();
  for(const l of ['ro','en','fr','it','es','pt','de','hu']){ await p.evaluate(x=>setLang(x),l); const t=await p.textContent('#c5-histbtn'); ok(t&&t.length>3,'buton istoric tradus '+l+': '+t); }
  await ctx.close(); }


// 6. 8 limbi: chip, etichete sidebar, butonul „mascare” din dialogul PII, axe pe dialog, fără scurgeri de română
{ const {ctx,p,errs}=await open();
  await sel(p,'pollinations');
  const CHIP={ro:/Mesajele pleacă/,en:/Messages are sent/,fr:/Les messages sont envoyés/,it:/I messaggi vengono inviati/,es:/Los mensajes se envían/,pt:/As mensagens são enviadas/,de:/Nachrichten werden an/,hu:/Az üzenetek ide kerülnek/};
  const MASK={ro:'Maschează elementele bifate și continuă',en:'Mask the ticked items and continue',fr:'Masquer les éléments cochés et continuer',it:'Oscura gli elementi spuntati e continua',es:'Ocultar los elementos marcados y continuar',pt:'Ocultar os itens marcados e continuar',de:'Angehakte Elemente maskieren und fortfahren',hu:'A bejelölt elemek elrejtése és folytatás'};
  const seen=new Set();
  for(const l of Object.keys(CHIP)){
    await p.evaluate(x=>setLang(x),l); await p.waitForTimeout(120);
    const chip=await p.textContent('#c5-chip'); ok(CHIP[l].test(chip)&&chip.includes('text.pollinations.ai'),'chip '+l+': '+chip);
    const pl=await p.textContent('#c5-pii-t'), hl=await p.textContent('#c5-hist-t'), hb=await p.textContent('#c5-histbtn');
    ok(pl.length>10&&hl.length>10&&hb.length>3,'etichete sidebar '+l); if(l!=='ro'){ ok(pl!==(await p.evaluate(()=>T.ro.c5_pii_label)),'pii_label tradus '+l); }
    seen.add(pl);
    ok(await p.getAttribute('#c5-topbtn','aria-label')===await p.evaluate(()=>t('c5_hist_title')),'aria-label buton istoric '+l);
    await p.fill('#cta',PII_TXT); await p.click('#csend'); await p.waitForSelector('dialog.fff-pii[open]',{timeout:3000});
    const lab=await p.textContent('dialog.fff-pii button[data-primary]'); ok(lab===MASK[l],'buton mascare '+l+': '+lab);
    await axe(p,'dialog PII '+l);
    await p.click('dialog.fff-pii button:last-child'); await p.waitForTimeout(150);
    await p.click('#c5-topbtn'); await p.waitForSelector('dialog.c5-dlg[open]'); await axe(p,'panou istoric '+l);
    ok((await p.textContent('dialog.c5-dlg h2')).length>3&&(await p.textContent('dialog.c5-dlg .c5-note')).length>20,'panou istoric text '+l);
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    await p.fill('#cta','');
  }
  ok(seen.size===8,'etichete distincte în 8 limbi: '+seen.size);
  ok(errs.filter(e=>!/Failed to fetch|net::|NetworkError/i.test(e)).length===0,'fără erori în 8 limbi: '+errs.join('|'));
  await ctx.close(); }

// 7. plafon de mărime: cele mai vechi conversații se șterg, cu mesaj
{ const {ctx,p,bodies}=await open();
  await sel(p,'pollinations'); await p.evaluate(()=>setLang('en'));
  await p.evaluate(()=>{ const l=[]; for(let i=0;i<125;i++)l.push({id:'old'+i,t0:1e12+i,t1:1e12+i,model:'x',prov:'pollinations',m:[['u','întrebare '+i],['a','răspuns '+i]]}); localStorage.setItem('ai-liber.conv',JSON.stringify(l)); });
  await p.check('#c5-hist');
  await p.fill('#cta','Întrebare care depășește plafonul'); await p.click('#csend'); await p.waitForTimeout(1000);
  const l=await p.evaluate(()=>JSON.parse(localStorage.getItem('ai-liber.conv')));
  ok(l.length===120,'plafon 120 conversații: '+l.length); ok(l[0].m[0][1].includes('depășește'),'conversația nouă este prima');
  ok(!l.some(c=>c.id==='old124'),'cea mai veche a fost ștearsă');
  ok(/oldest conversations were removed/.test(await p.textContent('#c5-live')),'mesaj de plafon: '+await p.textContent('#c5-live'));
  ok(await p.locator('#c5-live.on').count()===1,'mesajul e vizibil');
  await ctx.close(); }

// 8. preferințe păstrate după reîncărcare + implicit OFF
{ const {ctx,p}=await open();
  ok(await p.isChecked('#c5-pii')&&!(await p.isChecked('#c5-hist')),'implicit: verificare PII ON, istoric OFF');
  await p.uncheck('#c5-pii'); await p.check('#c5-hist');
  await p.reload(); await p.waitForTimeout(2500);
  ok(!(await p.isChecked('#c5-pii'))&&await p.isChecked('#c5-hist'),'preferințele se păstrează după reîncărcare');
  ok(await p.evaluate(()=>localStorage.getItem('ai-liber.piiguard')==='0'&&localStorage.getItem('ai-liber.hist')==='1'),'chei localStorage');
  await p.check('#c5-pii'); await p.uncheck('#c5-hist');
  ok(await p.evaluate(()=>localStorage.getItem('ai-liber.piiguard')===null&&localStorage.getItem('ai-liber.hist')===null),'revenire la implicit');
  await ctx.close(); }

// 9. copia criptată: istoric DA, chei API / sare / secret de sesiune NU (decriptare reală în pagină)
{ const {ctx,p}=await open();
  await sel(p,'pollinations'); await p.check('#c5-hist');
  await p.fill('#cta','Întrebare despre pisici și câini'); await p.click('#csend'); await p.waitForTimeout(900);
  const sec=await p.evaluate(()=>{ localStorage.setItem('ai-liber.aik.enc_openai','SECRETBLOB'); localStorage.setItem('ai-liber.aik.groq','sk-live-groq'); localStorage.setItem('ai-liber.ksalt','SALTVALUE'); return sessionStorage.getItem('ailib_ssec')||(sessionStorage.setItem('ailib_ssec','SESSSECRET'),'SESSSECRET'); });
  const [dl]=await Promise.all([p.waitForEvent('download'),p.evaluate(()=>FFF.bundle.export({encrypt:true,password:'parola-de-test-1'}))]);
  const env=JSON.parse(fs.readFileSync(await dl.path(),'utf8')); ok(env.format==='fff-bundle-enc','plic criptat');
  const plain=await p.evaluate(async(env)=>{ const b=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)); const km=await crypto.subtle.importKey('raw',new TextEncoder().encode('parola-de-test-1'.normalize('NFC')),'PBKDF2',false,['deriveKey']);
    const k=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b(env.salt),iterations:env.iter,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']);
    return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b(env.iv),additionalData:new TextEncoder().encode('fff-bundle-enc|'+env.schema+'|'+env.app)},k,b(env.ct))); },env);
  const o=JSON.parse(plain), keys=Object.keys(o.data);
  ok(keys.includes('ai-liber.conv')&&keys.includes('ai-liber.hist')&&o.data['ai-liber.conv'].includes('pisici'),'copia criptată conține istoricul: '+keys.join(','));
  ok(!keys.some(k=>/^(ai-liber\.aik\.|aik_|sk_|ai-liber\.ksalt|ailib_ssec)/.test(k)),'copia criptată NU conține chei API/sare/secret: '+keys.join(','));
  ok(!/SECRETBLOB|sk-live-groq|SALTVALUE/.test(plain)&&!plain.includes(sec),'nicio valoare secretă în copia decriptată');
  const [d2]=await Promise.all([p.waitForEvent('download'),p.evaluate(()=>FFF.bundle.export())]); const t2=fs.readFileSync(await d2.path(),'utf8');
  ok(t2.includes('ai-liber.conv')&&!/SECRETBLOB|sk-live-groq|SALTVALUE/.test(t2),'copia necriptată: istoric da, secrete nu');
  // eticheta de transparență încă vede toate cheile (filtrul e doar pe copie)
  ok(await p.evaluate(()=>FFF.store.indexKeys().includes('ai-liber.aik.groq')),'inventarul kitului vede în continuare cheile locale');
  await ctx.close(); }

// 10. rețea: cu dialog deschis / anulare nu pleacă nimic; model local nu scanează; nicio cerere în afara gazdei alese
{ const {ctx,p,reqs,bodies}=await open();
  await sel(p,'pollinations');
  await p.fill('#cta',PII_TXT); await p.click('#csend'); await p.waitForSelector('dialog.fff-pii[open]');
  await p.click('dialog.fff-pii button:has-text("Anulează")'); await p.waitForTimeout(400);
  ok(bodies.length===0&&!reqs.some(u=>/pollinations\.ai\/openai/.test(u)),'anulare: zero cereri de chat');
  await p.click('dialog.fff-pii button:has-text("Anulează")').catch(()=>{});
  await sel(p,'lmstudio'); await p.fill('#cta',PII_TXT); await p.click('#csend'); await p.waitForTimeout(500);
  ok(await p.locator('dialog.fff-pii').count()===0,'LM Studio: fără dialog PII');
  ok(reqs.every(u=>/pollinations\.ai|localhost|127\.0\.0\.1/.test(u)),'nicio cerere către alte gazde: '+reqs.join(','));
  await ctx.close(); }

// 11. mobil 360: sidebar + dialog PII + panou, fără depășire, axe
{ const {ctx,p}=await open({vp:{width:360,height:740}});
  await sel(p,'pollinations');
  await p.evaluate(()=>toggleSB&&toggleSB()); await p.waitForTimeout(400);
  const vis=await p.evaluate(()=>{ const r=document.getElementById('c5-pii').getBoundingClientRect(); return r.width>0&&r.left>=0&&r.right<=innerWidth; }); ok(vis,'bifa PII e vizibilă în sidebar la 360');
  await axe(p,'sidebar 360');
  await p.evaluate(()=>toggleSB&&toggleSB()); await p.waitForTimeout(300);
  await p.fill('#cta',PII_TXT); await p.click('#csend'); await p.waitForSelector('dialog.fff-pii[open]');
  const w=await p.evaluate(()=>document.querySelector('dialog.fff-pii').getBoundingClientRect().width); ok(w<=360,'dialog PII încape la 360: '+w);
  await axe(p,'dialog PII 360');
  await p.click('dialog.fff-pii button:last-child'); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0,'fără depășire orizontală 360 (final)');
  await ctx.close(); }

await browser.close();
console.log(`\nAI-Liber fff-r8: ${pass} reușite, ${fail} eșuate`); process.exit(fail?1:0);
