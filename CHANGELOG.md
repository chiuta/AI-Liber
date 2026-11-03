# Jurnal de modificări

## 2.3.4 — 2026-11-03

Accesibilitate: meniul „Trimite către…” / „Primește…” stă într-un reper ARIA (regula axe «region»); secțiunea seifului folosește h2. Cod comun din hub.

## 2.3.3 — 2026-11-03

Seif comun de chei API (plic keys/vault): cheile se pot importa din VaultCrypt prin fișier, clipboard, cod QR sau altă filă (nu prin link); parola se cere la import, cheile nu se scriu în clar în localStorage. Cod comun din hub: tools/fff-envelope.js și tools/fff-seif.js (injectat).

## 2.3.1 — 2026-11-02 (reîmprospătare kit)

- Nou (kit): **Sincronizare între dispozitive** (`FFF.sync`) — în dialogul «Transparență» (clic pe versiune → Copie de siguranță): conectezi două dispozitive direct (WebRTC, cod/QR, fără server și fără cont) și își schimbă datele aplicației; cea mai recentă valoare câștigă, secretele (chei API, parole) nu se trimit, ștergerile nu se propagă. Aplicarea trece prin importul kitului (confirmare, chei permise, rollback).
- Nou (kit): **Istoric local — «mașina timpului»** (`FFF.history`) — instantanee automate ale datelor (IndexedDB, fără secrete), diferență față de starea curentă și restaurare reversibilă; «Șterge datele aplicației» șterge și istoricul.
- Module adăugate: `qr`, `p2p`, `sync`, `history` (+~140 KB). Versiunea aplicației nu se schimbă.

## 2.3.1 — 2026-11-02

Actualizare surse (2 noiembrie 2026), doar date; logica nu s-a modificat.

- Modele cu cheie API: `claude-sonnet-4-20250514` (retras 15 iun. 2026) -> `claude-sonnet-5-5`; `claude-opus-4-6` -> `claude-opus-5-5`; `o1-mini` (retras) -> `gpt-5.6-sol`; `gemini-2.0-flash` (închis 1 iun. 2026) -> `gemini-3.6-flash`; `gemini-1.5-pro` -> `gemini-3.8-flash`; Groq: `llama-3.3-70b-versatile` (închis 16 aug. 2026) -> `openai/gpt-oss-120b`, `mixtral-8x7b-32768` (închis din 2025) -> `qwen/qwen3.8-27b`; Perplexity: `llama-3.1-sonar-large-128k-online` -> `sonar-pro`.
- Ghidul DuckDuckGo: lista modelelor gratuite verificată la 2.11.2026 în pagina de ajutor DuckDuckGo (ID-urile API hardcodate pentru DuckDuckGo nu au putut fi verificate și nu s-au schimbat).
- Director de instrumente: Tome eliminat (produs închis la 30 apr. 2025); Ollama -> ollama.com; ChatGPT gratuit = modelul GPT Luna; Meta AI = Muse Spark; Playground = 10 imagini la 3 ore (domeniul playground.com). Texte actualizate în toate cele 8 limbi.
- Nota «verificat parțial» din director și secțiunea «Surse verificate» din README-uri (8 limbi) au primit data 2.11.2026.

## 2.3.0 — 2026-11-01

- Corectat: adaptorul «Trimite la…» nu mai aruncă eroare când kitul FFF lipsește (gardian pe fiecare bloc; găsit de testul «fără kit» din CI).

Nou: «Trimite la…» (fff-kit, modulul FFF.bridge) — după orice export de fișier (GPX, ICS, CSV, Markdown) apare butonul «Trimite la…» către aplicațiile compatibile, iar importul de fișiere al aplicației primește plicuri .fff.json trimise de ele, cu confirmare înainte de import. Fără rețea, fără telemetrie.

## 2.2.1 — 2026-10-31

Doar interfață (accesibilitate pe telefon, 360×740): casetele de bifare mai mici de 24 px → 24 px (WCAG 2.5.8). Fără alte schimbări de comportament.

## 2.2.0 — 2026-10-27

### Adăugat
- **Traduceri pentru componenta de protecție cu parolă** (cardul și dialogurile de creare/deblocare/confirmare, inclusiv avertismentul „neauditat”) în **fr, it, es, pt, de, hu** — traduceri automate, neverificate de vorbitori nativi. Până acum aceste limbi cădeau pe engleză. Doar textele din `KeyVault UI`; **logica criptografică nu s-a modificat** (nucleul `KeyVault 1.0.0` este identic octet cu octet).
- Test nou: `tests/keyvault-i18n.test.mjs` (fără chei netraduse, avertismentul numește AES-256-GCM și iterațiile, textul diferă de engleză, 0 cereri de rețea).
- `sizeBytes`/`sha256` din `app.json` și `fff-info` regenerate cu uneltele fff-kit (`fixcsp`, `info`, `check --lax`).

### Neimplementat
- README-urile în fr/it/es/pt/de/hu au doar versiunea actualizată.
- Fără audit extern al componentei: rămâne marcată „neauditată”.

## 2.1.0 — 2026-10-27

Recenzie 2026-10-27.

### Adăugat
- Criptare opțională cu parolă a cheilor API (WebCrypto AES-256-GCM + PBKDF2-SHA256, 600 000 de iterații, sare aleatoare), în fereastra „Chei API”. Implicit oprită; migrare opțională în ambele sensuri, fără pierderea cheilor existente. Componentă neauditată de un terț (avertisment în aplicație și în README).
- Notă „Vezi și Nexus fără frontiere” în fereastra „Chei API” și secțiune în README despre diferența dintre AI Liber și Nexus.
- Teste noi: `tests/keyvault-core.test.mjs`, `tests/keyvault-ui.test.mjs`.
- Linii „Stare” și „Offline” în README și metadate (`app-status`, `app-offline`).

### Modificat
- Textul de avertizare despre chei menționează noua opțiune. Hash-urile CSP ale scripturilor inline au fost recalculate.

### Neschimbat
- Nimic șters; fără dependențe noi, fără gazde noi în CSP.

Istoricul anterior (până la 2.0.0, 2026-10-26) este în secțiunea „Istoric / Changelog” din README.md.
