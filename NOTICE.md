# Componente terțe și licențe

`index.html` conține codul propriu al AI-Liber (vezi `LICENSE`). Bibliotecile terțe își păstrează licențele proprii.
Nicio bibliotecă nu se mai încarcă de pe un CDN: ce poate sta pe disc este în `vendor/` (aceeași origine; scripturile încărcate dinamic poartă `integrity`/SRI sha384), iar bibliotecile de model WebLLM vin de la un commit fixat și sunt verificate de WebLLM prin SRI SHA-256.

## În depozit (`vendor/`)

| Componentă | Fișier | Licență | SHA-256 |
|---|---|---|---|
| [WebLLM](https://github.com/mlc-ai/web-llm) 0.2.84 (`@mlc-ai/web-llm`), împachetat cu esbuild 0.28.2 (`--minify --format=esm --target=es2020`) din pachetul npm; include ~5,6 MB de WebAssembly (TVM runtime/tokenizator) codificat base64 | `vendor/web-llm@0.2.84/web-llm.min.js` | Apache-2.0 (`vendor/web-llm@0.2.84/LICENSE`) | `04ed20073fb2aecdedd3eb1d7d636dbde1e4839f13b7f85b852f3b76b260eb47` |
| [KaTeX](https://katex.org/) 0.16.9 (JS) | `vendor/katex@0.16.9/katex.min.js` | MIT | `dc84b296ec3e884de093158f760fd9d45b6c7abe58b5381557f4e138f46a58ae` |
| KaTeX 0.16.9 (CSS; fonturile `fonts/*.woff2` sunt cele din pachetul npm) | `vendor/katex@0.16.9/katex.min.css` | MIT | `505d5f829022bb7b4f24dfee0aa1141cd7bba67afe411d1240335f820960b5c3` |
| [pdf.js](https://mozilla.github.io/pdf.js/) | `vendor/pdfjs/pdf.min.js` | Apache-2.0 | `978fd1b2d134a98e98966186a97777bebf87d8e770dadab1ece3687e21a5aa6c` |
| pdf.js (worker) | `vendor/pdfjs/pdf.worker.min.js` | Apache-2.0 | `38cde5311957b86bc3669f93e7d2566de333a90055ed6635bef60d9bf00e96f2` |
| [mammoth.js](https://github.com/mwilliamson/mammoth.js) | `vendor/mammoth.browser.min.js` | BSD-2-Clause | `596ef52239e52d8ee3cee10b2ee4a72596abf900d0e4f468593f956e9f1809b0` |

Fonturile KaTeX (`vendor/katex@0.16.9/fonts/*.woff2`) sunt doar în format woff2; licență SIL OFL 1.1 (vezi `vendor/katex@0.16.9/LICENSE`).

## Descărcate la cerere, cu integritate verificată

| Componentă | URL (fixat) | Verificare |
|---|---|---|
| Biblioteci de model WebLLM (`*-webgpu.wasm`, 14 modele; ~5 MB fiecare), Apache-2.0 | `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0/web-llm-models/v0_2_84/base/<fișier>.wasm` | WebLLM compară SHA-256 (tabela `WLLM_LIBS` din `index.html`, câte un hash per fișier); la nepotrivire aruncă `IntegrityError` și modelul nu pornește. Modelele care nu au intrare în tabel (inclusiv cele necunoscute lui WebLLM 0.2.84) sunt excluse din configurație. CSP permite doar acest prefix de cale. |

Descărcarea a fost verificată în mediul de pregătire cu un server local care servește fișierele reale (hash corect => trece; un bit schimbat => `IntegrityError`). Hash-urile au fost calculate din fișierele de la commit-ul indicat.

## Descărcate la cerere, fără hash fixat

| Componentă | Când | Notă |
|---|---|---|
| Greutăți și configurație model (`huggingface.co/mlc-ai/<model>/resolve/main/...`, redirecționate către `*.huggingface.co` / `*.hf.co`) | doar când activezi un model în browser | Sunt date (nu cod executabil), de sute de MB până la GB; nu sunt incluse în depozit. Fără revizie/hash fixat: depozitul Hugging Face nu era accesibil la pregătirea versiunii. CSP restrânge `huggingface.co` la `/mlc-ai/`; gazdele CDN `*.huggingface.co`/`*.hf.co` rămân necesare pentru redirecturi (CSP nu verifică calea după redirect). Decizie a autorului dacă dorește să fixeze revizii (`resolve/<commit>/`) și hash-uri pe fișier. |
