// Laboratorul de modele (2.0.0): aceeași întrebare către mai multe modele, rând pe rând; timp/memorie; registru; confidențialitate; export.
// Rulează din directorul aplicației: node tests/model-lab.test.mjs. Rețeaua e blocată: singurele „servere” sunt răspunsuri HTTP de test
// (Pollinations / Ollama, cu întârzieri diferite) și un înlocuitor pentru chatWebLLM (nu se descarcă niciun model).
import {createRequire} from "module"; import {fileURLToPath} from "url"; import path from "path"; import fs from "fs"; import os from "os";
const require = createRequire(process.env.PW_ROOT || import.meta.url); const {chromium} = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url)); const URL_ = "file://" + path.resolve(here, "../index.html");
const AXE_PATH = process.env.FFF_AXE || process.env.AXE_PATH; const AXE = AXE_PATH && fs.existsSync(AXE_PATH) ? fs.readFileSync(AXE_PATH, "utf8") : null;
const LT = ms => Math.round(ms * Math.min(6, Math.max(1, os.loadavg()[0] / os.cpus().length)));
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c){ pass++; console.log("  ok  " + m); } else { fail++; console.log("FAIL  " + m + (x !== undefined ? "  -> " + JSON.stringify(x) : "")); } };
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const sse = parts => parts.map(p => "data: " + JSON.stringify({choices: [{delta: {content: p}}]}) + "\n\n").join("") + "data: [DONE]\n\n";
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = (p, fn, arg, timeout = 30000) => p.waitForFunction(fn, arg, {timeout: LT(timeout)});
const ck = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error("lipsește " + s); e.click(); }, sel);

async function open(o = {}){
  const ctx = await browser.newContext({viewport: o.vp || {width: 1280, height: 900}, colorScheme: "light", locale: o.locale || "ro-RO", acceptDownloads: true});
  const log = [], errs = [];
  await ctx.route(/^https?:/, async r => {
    const req = r.request(), u = req.url();
    if (u.startsWith("https://text.pollinations.ai/openai") || u.startsWith("http://localhost:11434/v1/chat/completions")){
      let body = {}; try { body = JSON.parse(req.postData() || "{}"); } catch {}
      const rule = (o.rules || {})[body.model] || {delay: 40};
      const e = {url: u, model: body.model, start: Date.now(), user: (body.messages || []).filter(m => m.role === "user").map(m => m.content).pop(), sys: (body.messages || []).some(m => m.role === "system")};
      log.push(e);
      await wait(rule.delay || 0); e.end = Date.now();
      if (rule.status) return r.fulfill({status: rule.status, contentType: "application/json", body: JSON.stringify({error: {message: "boom " + rule.status}})});
      return r.fulfill({status: 200, contentType: "text/event-stream", body: sse(rule.parts || ["Răspuns ", "de la ", String(body.model)])});
    }
    log.push({url: u, other: true}); return r.abort();
  });
  const p = await ctx.newPage();
  p.on("pageerror", e => errs.push("pageerror " + e.message));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push("console " + m.text()); });
  if (AXE) await p.addInitScript({content: AXE});
  if (!o.noConsent) await p.addInitScript(() => { try { localStorage.setItem("ai-liber.ok_pollinations", "1"); } catch {} });
  if (o.seed) await p.addInitScript(s => { try { for (const k in s) localStorage.setItem(k, s[k]); } catch {} }, o.seed);
  if (o.wllm !== false) await p.addInitScript(() => { window.addEventListener("DOMContentLoaded", () => {
    window.chatWebLLM = async (id, msgs, onChunk) => { onChunk(t("loadingWLLM")); await new Promise(r => setTimeout(r, 120)); onChunk(t("generating")); await new Promise(r => setTimeout(r, 60)); onChunk("loc"); await new Promise(r => setTimeout(r, 60)); onChunk("local ok"); _wllmEngine = {runtimeStatsText: () => "prefill: 11.0 tokens/sec, decoding: 5.5 tokens/sec"}; return "local ok"; };
  }); });
  await p.goto(URL_);
  await until(p, () => typeof window.labOpen === "function" && Array.isArray(MODELS) && MODELS.length > 5);
  return {ctx, p, errs, log};
}
const openLab = async p => { await p.evaluate(() => labOpen()); await p.waitForSelector("dialog.c5-dlg[open] #lab-run"); };
const tick = (p, prov, id) => p.evaluate(([pv, i]) => { const cb = [...document.querySelectorAll("#lab-models input")].find(x => x.dataset.prov === pv && x.dataset.mid === i); if (!cb) throw new Error("model lipsă " + pv + " " + i); cb.checked = true; cb.dispatchEvent(new Event("change", {bubbles: true})); }, [prov, id]);
const pollIds = p => p.evaluate(() => MODELS.filter(m => m.p === "pollinations").slice(0, 3).map(m => m.id));
const runDone = async (p, n = 1) => { await until(p, n => AILab.load().length >= n, n, 40000); await until(p, () => document.getElementById("lab-run") && !document.getElementById("lab-run").disabled, null, 20000); };

console.log("1. pornire, butoane, dialog");
{
  const {ctx, p, errs, log} = await open();
  ok(errs.length === 0, "pornire fără erori", errs);
  ok(log.length === 0, "nicio cerere de rețea la pornire", log.slice(0, 3));
  ok(await p.locator("#lab-btn").count() === 1 && await p.locator("#lab-topbtn").count() === 1, "buton în bara laterală și în bara de sus");
  ok(/Laborator de modele/.test(await p.textContent("#lab-btn")), "etichetă în română", await p.textContent("#lab-btn"));
  await ck(p, "#lab-btn"); await p.waitForSelector("dialog.c5-dlg[open] #lab-run");
  ok(await p.locator("dialog.c5-dlg[open] [role=tab]").count() === 2, "două file: comparație și registru");
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  ok(await p.locator("dialog.c5-dlg[open]").count() === 0, "Escape închide dialogul");
  ok(errs.length === 0, "fără erori", errs);
  await ctx.close();
}

console.log("2. lista de modele și profilul de confidențialitate");
{
  const {ctx, p, errs} = await open();
  await openLab(p);
  const kinds = await p.evaluate(() => [...document.querySelectorAll("#lab-models input")].map(c => c.dataset.prov));
  ok(kinds.length > 0 && kinds.every(k => ["webllm", "ollama", "lmstudio"].includes(k)), "filtrul „doar locale” arată numai modele locale", kinds);
  await p.selectOption("#lab-f", "all");
  const all = await p.evaluate(() => [...document.querySelectorAll("#lab-models li")].map(li => ({prov: li.querySelector("input")?.dataset.prov, kind: li.querySelector("[data-kind]")?.dataset.kind, txt: li.querySelector("label")?.textContent})));
  ok(all.some(x => x.prov === "pollinations" && x.kind === "remote" && /text\.pollinations\.ai/.test(x.txt) && /acord|consent|fără cheie/i.test(x.txt)), "serviciu extern fără cheie: gazda și mențiunea acordului", all.find(x => x.prov === "pollinations"));
  ok(all.some(x => x.prov === "webllm" && x.kind === "browser" && /browser/i.test(x.txt)), "WebLLM: rămâne în browser");
  ok(all.some(x => x.prov === "ollama" && x.kind === "server" && /calculator/i.test(x.txt)), "Ollama: doar serverul de pe calculator");
  ok(!all.some(x => x.prov === "anthropic" || x.prov === "openai"), "modelele care cer cheie lipsesc cât timp nu există cheie");
  await p.evaluate(() => { document.getElementById("lab-q").value = ""; });
  await ck(p, "#lab-run"); await p.waitForTimeout(150);
  ok(/Scrie mai întâi/.test(await p.textContent("#lab-status")), "fără întrebare: mesaj");
  await p.fill("#lab-q", "x"); await ck(p, "#lab-run"); await p.waitForTimeout(150);
  ok(/Bifează cel puțin/.test(await p.textContent("#lab-status")), "fără model: mesaj");
  await ck(p, "#lab-f ~ button"); await p.waitForTimeout(100);
  ok(errs.length === 0, "fără erori", errs);
  await ctx.close();
}

console.log("3. comparație: ordine, metrici, erori, stare restaurată");
{
  const rules = {};
  const {ctx, p, errs, log} = await open({rules});
  const ids = await pollIds(p);
  rules[ids[0]] = {delay: 150, parts: ["Alfa ", "beta ", "gama"]}; rules[ids[1]] = {delay: 450}; rules[ids[2]] = {status: 429};
  const before = await p.evaluate(() => ({cur: cur.id, busy, hist: hist.length, send: document.getElementById("csend").disabled}));
  await openLab(p);
  await p.selectOption("#lab-f", "all");
  await tick(p, "pollinations", ids[0]); await tick(p, "pollinations", ids[1]); await tick(p, "pollinations", ids[2]);
  await tick(p, "ollama", "llama3.2"); await tick(p, "webllm", await p.evaluate(() => MODELS.find(m => m.p === "webllm").id));
  ok(/5/.test(await p.textContent("#lab-cnt")), "contor de modele bifate", await p.textContent("#lab-cnt"));
  await p.fill("#lab-q", "Ce este un heap?");
  await ck(p, "#lab-run");
  await until(p, () => document.getElementById("lab-cancel") && !document.getElementById("lab-cancel").disabled);
  ok(await p.evaluate(() => busy === true), "în timpul comparației chatul e blocat (busy)");
  await runDone(p, 1);
  const run = await p.evaluate(() => AILab.load()[0]);
  ok(run && run.rows.length === 5 && run.q === "Ce este un heap?", "rularea salvată cu 5 rânduri", run && run.rows.length);
  const reqs = log.filter(x => x.model).sort((a, b) => a.start - b.start);
  ok(reqs.length === 4 && reqs.every((r, i) => i === 0 || r.start >= reqs[i - 1].end - 5), "cererile pleacă una după alta, fără suprapunere", reqs.map(r => [r.model, r.start % 100000, r.end % 100000]));
  ok(reqs.every(r => r.user === "Ce este un heap?" && r.sys), "aceeași întrebare și același mesaj de sistem către fiecare", reqs.map(r => r.user));
  const byName = n => run.rows.find(r => r.mid === n);
  const a = byName(ids[0]), b = byName(ids[1]), er = byName(ids[2]), oll = byName("llama3.2"), wl = run.rows.find(r => r.prov === "webllm");
  ok(a.ok && a.text === "Alfa beta gama" && a.chars === 14 && a.tok === Math.round(14 / 4), "răspuns, caractere și ≈ tokeni", a);
  ok(a.total >= 140 && b.total >= 440 && b.total > a.total, "timpii urmează întârzierile injectate (150 ms < 450 ms)", [a.total, b.total]);
  ok(a.ttft != null && a.ttft <= a.total && (a.cps === null || a.cps > 0), "primul token ≤ total; caractere/s doar când există durată măsurabilă", [a.ttft, a.total, a.cps]);
  ok(a.heap === null || typeof a.heap === "number", "memoria heap: număr sau «—» când browserul nu o oferă", a.heap);
  ok(!er.ok && /limit|429|rate/i.test(er.err), "eroarea unui model nu oprește rularea (429)", er);
  ok(oll.ok && oll.kind === "server" && oll.text === "Răspuns de la llama3.2", "Ollama local măsurat", oll);
  ok(wl.ok && wl.kind === "browser" && wl.load >= 100 && wl.ttft != null && wl.cps > 50 && wl.cps < 400 && /decoding/.test(wl.engine) && wl.text === "local ok", "WebLLM: timp de încărcare separat și statisticile motorului", wl);
  const html = await p.textContent("#lab-out");
  ok(/Alfa beta gama/.test(html) && /Răspuns de la llama3\.2/.test(html) && /decoding/.test(html), "răspunsurile și statisticile se văd în rezultate");
  ok(await p.locator("#lab-out tbody tr").count() === 5, "tabel cu 5 rânduri");
  const after = await p.evaluate(() => ({cur: cur.id, busy, hist: hist.length, send: document.getElementById("csend").disabled}));
  ok(JSON.stringify(after) === JSON.stringify(before), "chatul rămâne neatins (model curent, busy, istoric, buton trimite)", [before, after]);
  // preferat → registru
  await p.evaluate(() => { document.querySelectorAll("#lab-out input[name=lab-pref]")[1].click(); });
  await p.waitForTimeout(150);
  ok(await p.evaluate(() => AILab.load()[0].pref) === 1, "modelul preferat e salvat");
  ok(errs.length === 0, "fără erori", errs);
  await ctx.close();
}

console.log("4. anulare, acord pentru servicii externe, date personale");
{
  const {ctx, p, errs, log} = await open({noConsent: true, rules: {}});
  const ids = await pollIds(p);
  await openLab(p); await p.selectOption("#lab-f", "all");
  await tick(p, "pollinations", ids[0]);
  await p.fill("#lab-q", "Salut"); await ck(p, "#lab-run");
  await p.waitForFunction(() => document.querySelectorAll("dialog.c5-dlg[open]").length === 2, null, {timeout: LT(8000)});
  const dlgs = await p.locator("dialog.c5-dlg[open]").count();
  ok(dlgs === 2 && log.filter(x => x.model).length === 0, "fără acord: apare confirmarea și nu pleacă nimic", [dlgs, log.length]);
  await p.evaluate(() => { const d = [...document.querySelectorAll("dialog.c5-dlg[open]")].pop(); d.querySelector(".c5-btn:not(.c5-pri):not(.c5-x)").click(); });
  await runDone(p, 1);
  const r1 = await p.evaluate(() => AILab.load()[0]);
  ok(log.filter(x => x.model).length === 0 && r1.rows[0].ok === false && /acord|consent/i.test(r1.rows[0].err), "refuz: modelul e omis, cu motiv, fără cerere", r1.rows[0]);
  ok(await p.evaluate(() => localStorage.getItem("ai-liber.ok_pollinations")) === null, "refuzul nu salvează acordul");
  await ck(p, "#lab-run");
  await p.waitForFunction(() => document.querySelectorAll("dialog.c5-dlg[open]").length === 2, null, {timeout: LT(8000)});
  await p.evaluate(() => { const d = [...document.querySelectorAll("dialog.c5-dlg[open]")].pop(); d.querySelector(".c5-pri").click(); });
  await runDone(p, 2);
  ok(log.filter(x => x.model).length === 1 && await p.evaluate(() => localStorage.getItem("ai-liber.ok_pollinations")) === "1", "acord: se trimite o dată și acordul se memorează");
  // PII
  const before = log.filter(x => x.model).length;
  await p.fill("#lab-q", "Scrie-i lui ion.popescu@example.com. IBAN RO49AAAA1B31007593840000 CNP 1800101221144");
  await ck(p, "#lab-run");
  await p.waitForSelector("dialog.fff-pii[open]", {timeout: LT(8000)});
  ok(log.filter(x => x.model).length === before, "date personale: dialogul apare înainte de orice trimitere");
  await p.click("dialog.fff-pii button:has-text('Anulează'), dialog.fff-pii button:has-text('Cancel')");
  await p.waitForTimeout(500);
  ok(log.filter(x => x.model).length === before && await p.evaluate(() => !document.getElementById("lab-run").disabled), "anulare: nu pleacă nimic, butonul revine");
  await ck(p, "#lab-run"); await p.waitForSelector("dialog.fff-pii[open]");
  await p.click("dialog.fff-pii button[data-primary]"); await runDone(p, 3);
  const sent = log.filter(x => x.model).pop();
  ok(!/ion\.popescu@example\.com/.test(sent.user) && /\[[^\]]+\]/.test(sent.user), "mascare: în cerere apar etichete, nu datele", sent.user);
  // doar local: fără PII
  await p.selectOption("#lab-f", "all");
  await p.evaluate(() => { document.querySelectorAll("#lab-models input").forEach(c => { c.checked = false; c.dispatchEvent(new Event("change", {bubbles: true})); }); });
  await tick(p, "webllm", await p.evaluate(() => MODELS.find(m => m.p === "webllm").id));
  await p.fill("#lab-q", "Scrie-i lui ion.popescu@example.com"); await ck(p, "#lab-run");
  await p.waitForTimeout(400);
  ok(await p.locator("dialog.fff-pii").count() === 0, "doar modele locale: fără verificare PII (nu pleacă nimic)");
  await runDone(p, 4);
  await ctx.close();
}
{
  const rules = {};
  const {ctx, p, errs, log} = await open({rules});
  const ids = await pollIds(p);
  rules[ids[0]] = {delay: 1500, parts: ["lent"]}; rules[ids[1]] = {delay: 1500, parts: ["lent"]};
  await openLab(p); await p.selectOption("#lab-f", "all");
  await tick(p, "pollinations", ids[0]); await tick(p, "pollinations", ids[1]);
  await p.fill("#lab-q", "Test anulare"); await ck(p, "#lab-run");
  await until(p, () => !document.getElementById("lab-cancel").disabled);
  await p.waitForFunction(() => document.querySelector("#lab-status").textContent.length > 3);
  await ck(p, "#lab-cancel");
  await runDone(p, 1);
  const r = await p.evaluate(() => AILab.load()[0]);
  ok(log.length === 1 && r.rows.length === 1 && !r.rows[0].ok, "anulare: al doilea model nu mai pornește; rezultatul parțial se păstrează", [log.length, r.rows.length]);
  ok(await p.evaluate(() => busy === false && !document.getElementById("csend").disabled), "după anulare chatul e liber");
  ok(errs.length === 0, "fără erori", errs);
  await ctx.close();
}

console.log("5. registru, medii, export, date ostile");
{
  const mk = (id, ts, rows, pref) => ({id, ts, q: "Întrebarea " + id, rows, pref});
  const row = (name, prov, ok, ttft, cps, heap, total) => ({mid: name, name, prov, kind: prov === "webllm" ? "browser" : "remote", host: prov === "webllm" ? "" : "text.pollinations.ai", ok, err: ok ? "" : "eroare", load: null, ttft, total, chars: 100, tok: 25, cps, heap, engine: "", text: "r"});
  const seed = {"ai-liber.lab": JSON.stringify({v: 1, runs: [
    mk("a1", 1760000000000, [row("Alfa", "pollinations", true, 100, 10, 1048576, 900), row("Beta", "webllm", true, 300, 30, 2097152, 1500)], 0),
    mk("a2", 1760000100000, [row("Alfa", "pollinations", true, 200, 20, 3145728, 1000), row("Beta", "webllm", false, null, null, null, 50)], 0),
    mk("a3", 1760000200000, [row("Alfa", "pollinations", true, 600, 60, 5242880, 1200), row("Beta", "webllm", true, 500, 50, 1048576, 1600)], 1),
    {id: "bad", ts: "x", q: 5, rows: "nu"}, null, 7,
    mk("a4", 1760000300000, [row("=cmd|' /C calc'!A0", "pollinations", true, 1, 1, 1, 1)], null),
  ]})};
  const {ctx, p, errs} = await open({seed});
  await openLab(p);
  ok(await p.evaluate(() => AILab.load().length) === 4, "intrările invalide din stocare sunt ignorate (4 rulări valide din 7)");
  await ck(p, "#lab-t2"); await p.waitForSelector("#lab-p2:not([hidden]) table");
  const regRows = await p.evaluate(() => [...document.querySelectorAll("#lab-p2 table")[0].querySelectorAll("tbody tr")].map(tr => [...tr.children].map(c => c.textContent)));
  const alfa = regRows.find(r => r[0] === "Alfa"), beta = regRows.find(r => r[0] === "Beta");
  ok(alfa && alfa[2] === "3" && alfa[3] === "3" && alfa[4] === "200 ms" && alfa[5] === "20" && alfa[6] === "3.0 MB" && alfa[7] === "2", "mediane corecte pentru Alfa (3 rulări; primul token 200 ms; 20 car./s; 3,0 MB; ales de 2 ori)", alfa);
  ok(beta && beta[2] === "3" && beta[3] === "2" && beta[4] === "400 ms" && beta[5] === "40" && beta[6] === "1.5 MB" && beta[7] === "1", "Beta: 2 reușite din 3, mediană peste cele reușite", beta);
  ok(regRows.some(r => r[0].startsWith("=cmd")) && await p.evaluate(() => !document.querySelector("#lab-p2 img, #lab-p2 script")), "nume ostil: afișat ca text");
  const [dc] = await Promise.all([p.waitForEvent("download"), ck(p, "#lab-reg-csv")]);
  const csv = fs.readFileSync(await dc.path(), "utf8");
  ok(csv.split("\r\n")[0].startsWith("timestamp,question,model") && /"'=cmd\|/.test(csv) && !/,"=cmd/.test(csv), "CSV: antet și celule care încep cu = neutralizate", csv.split("\r\n").slice(0, 2));
  ok(csv.trim().split("\r\n").length === 1 + 2 + 2 + 2 + 1, "CSV: câte un rând pe model și rulare", csv.trim().split("\r\n").length);
  const [dj] = await Promise.all([p.waitForEvent("download"), ck(p, "#lab-reg-json")]);
  const js = JSON.parse(fs.readFileSync(await dj.path(), "utf8"));
  ok(js.app === "ai-liber" && js.kind === "lab" && js.runs.length === 4, "JSON exportat", js.app);
  // ștergere rulare
  await p.evaluate(() => { document.querySelector("#lab-p2 li[data-id=a4] summary").click(); });
  await p.evaluate(() => { [...document.querySelectorAll("#lab-p2 li[data-id=a4] button")].pop().click(); });
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => AILab.load().length) === 3, "ștergerea unei rulări");
  await ck(p, "#lab-reg-clear"); await p.waitForSelector("dialog.c5-dlg[open]:has(.c5-pri)");
  await p.evaluate(() => { const d = [...document.querySelectorAll("dialog.c5-dlg[open]")].pop(); d.querySelector(".c5-pri").click(); });
  await p.waitForTimeout(250);
  ok(await p.evaluate(() => localStorage.getItem("ai-liber.lab")) === null && await p.locator("#lab-reg-empty").count() === 1, "golirea registrului după confirmare");
  ok(errs.length === 0, "fără erori", errs);
  await ctx.close();
}
{
  const {ctx, p, errs} = await open({seed: {"ai-liber.lab": "{{nu e json"}});
  await openLab(p); await ck(p, "#lab-t2");
  ok(await p.locator("#lab-reg-empty").count() === 1 && errs.length === 0, "stocare coruptă: registru gol, fără erori", errs);
  await p.evaluate(() => localStorage.setItem("ai-liber.lab", JSON.stringify({runs: [{id: "x<img>", ts: 1, q: "<b>q</b>", rows: [{name: "<img src=x onerror=window.__x=1>", prov: "po<llina>tions", host: "e\"vil", ok: true, ttft: -5, total: 1e99, cps: "abc", text: "<script>1</script>"}], pref: 9}]})));
  const c = await p.evaluate(() => AILab.load());
  ok(c.length === 1 && c[0].rows[0].ttft === null && c[0].rows[0].total === null && c[0].rows[0].cps === null && c[0].pref === null && !/[<>"]/.test(c[0].rows[0].prov + c[0].rows[0].host + c[0].id), "date ostile: numere în limite, câmpuri tehnice curățate", c[0]);
  await p.evaluate(() => { document.getElementById("lab-t1").click(); document.getElementById("lab-t2").click(); });
  ok(await p.evaluate(() => window.__x === undefined && !document.querySelector("#lab-p2 img, #lab-p2 script")), "nume cu HTML afișat ca text");
  await p.evaluate(() => eraseAllData());
  ok(await p.evaluate(() => localStorage.getItem("ai-liber.lab")) === null, "„Șterge toate datele” elimină și registrul");
  await ctx.close();
}

console.log("6. limbi, accesibilitate, ecran îngust");
{
  const {ctx, p, errs} = await open();
  const bad = [];
  for (const lg of ["ro", "en", "fr", "it", "es", "pt", "hu", "de"]){
    await p.evaluate(l => setLang(l), lg);
    const info = await p.evaluate(() => { labOpen(); const d = document.querySelector("dialog.c5-dlg[open]"); const txt = [...d.querySelectorAll("h2,button,label,th,p,option")].map(e => e.textContent.trim()); const raw = txt.filter(x => /^lab_[a-z_]+$/.test(x)); const r = { title: d.querySelector("h2").textContent, btn: document.getElementById("lab-btn").textContent, raw }; d.querySelector(".c5-x").click(); return r; });
    if (!info.title || /^lab_/.test(info.title) || info.raw.length || !info.btn || /^lab_/.test(info.btn)) bad.push([lg, info]);
  }
  ok(bad.length === 0, "toate cele 8 limbi: titlu, buton și etichete fără chei brute", bad);
  await p.evaluate(() => setLang("en"));
  await openLab(p);
  if (AXE){
    const r1 = await p.evaluate(async () => (await axe.run(document.querySelector("dialog.c5-dlg[open]"), {resultTypes: ["violations"]})).violations.map(v => v.id + ":" + v.nodes.length));
    ok(r1.length === 0, "axe: dialogul laboratorului (fila Comparație)", r1);
    await p.evaluate(() => document.getElementById("lab-t2").click());
    const r2 = await p.evaluate(async () => (await axe.run(document.querySelector("dialog.c5-dlg[open]"), {resultTypes: ["violations"]})).violations.map(v => v.id + ":" + v.nodes.length));
    ok(r2.length === 0, "axe: fila Registru", r2);
  } else ok(false, "axe indisponibil (setați FFF_AXE)");
  await p.setViewportSize({width: 375, height: 800}); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, "375 px: fără defilare orizontală a paginii");
  ok(await p.evaluate(() => { const d = document.querySelector("dialog.c5-dlg[open]"); const r = d.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1; }), "375 px: dialogul încape în ecran");
  ok(errs.length === 0, "fără erori", errs);
  await ctx.close();
}
await browser.close();
console.log(`\n${pass} reușite, ${fail} eșuate`);
process.exit(fail ? 1 : 0);
