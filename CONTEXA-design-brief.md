# CONTEXA — design brief (2026-08-27 · šešir: MASKOTA / teal)

**Za design chat.** Sve ostalo o proizvodu je u `claude/CONTEXA-build-notes.md`;
ovde je samo ono što treba nekome koji crta. Odluke o dizajnu su **Miline** —
predlaži kad te pita, ne pitchuj listu.

---

## 0. Šešir — stanje (2026-08-27, posle noćne pivot runde)

- **Dva odvojena šešira i dalje važe.** *Brend* glasan (Duolingo/Headspace-topao);
  *kartica sa pitanjima* tiha, prati claude.ai (Karpathy test) — nju ništa od
  ovoga ne dira (v. §2a).

- **PIVOT: brend nosi MASKOTA.** Mili je odbacila i prsten i oblak („Lose the C.
  Lose the cloud.") i iz runde od 4 sveže ideje izabrala **#4: malo teal
  stvorenje koje proviri posle Claude-ovog odgovora** — trepće, gleda okolo, na
  hover se javi „What now? ✦", na klik otvara intervju.
  **Ako maskota nosi trigger, nosi i ikonicu i ceo brend** (Duolingo model:
  jedan lik svuda). Skica lika: `contexa-trigger-fresh-ideas.html` §4 — to je
  SKICA, ne finalan lik; karakter se tek dizajnira.

- **Karakter-koncept POTVRĐEN (jutro 2026-08-27): „ŠAPTAČ".**
  Pozorišni šaptač — mali u kutiji na ivici scene koji ti šapne repliku kad
  zaboraviš tekst. Bukvalno proizvod: zaboravio si šta se kaže → šapne ti.
  Engleska reč *prompt* dolazi iz pozorišta (prompter = šaptač); proizvod piše
  prompts → maskota JE prompter. Objašnjava ponašanja: proviruje sa ivice (iz
  šaptačeve kutije), prati „predstavu" (trepće, gleda), na hover se nagne i
  šapne. Potvrđeno — ovo je duša lika.

- **Forma POTVRĐENA (2026-08-27): BLOB** — izabran iz runde od 4 forme
  (`contexa-mascot-forms.html`; kutija/miš/ptičica odbijeni). Oblik se NE menja
  bez Miline reči — njeno oko je izabralo tačno taj (lekcija: uparuj po obliku).
  **Namiguje, ne trepće** — jedno oko, retko u miru; na hover namigne i šapne.
  Namig je zaverenički gest = šaptač („ja i ti znamo"). Radna referenca:
  `contexa-mascot-blob.html`.

- **Lik FINALIZOVAN (2026-08-27, Milini izbori sa tuning lista):** oči = 1c
  (baby schema + catchlight: veće, niže, bliže, iskra u zenici); ulazak = 4c
  (iskoči sa squash&stretch); namig ubrzan (škljocne brzo, ciklus ~6s); usta i
  gest šaputanja = originalni (bez naginjanja); idle = samo namig, bez disanja.
  Odbijeno na tuningu: 2b/2c usta, 3b/3c naginjanje, 4a/4b ulazak, 5b disanje.
  Referentni fajl je jedini izvor parametara — ikonica se seče iz njega.
- **Spec za content.js NAPISAN (2026-08-27):** `CONTEXA-content-spec.md` (ide u
  `claude/` u repo). Samodovoljan — SVG, keyframes i copy ugrađeni doslovno.
  Visual-only, store clock, bez prompt/wire sprege; trigger labela se menja u
  „What now? ✦" (Defekt F proveren, verbatim asertacije će pući i ažuriraju se,
  komparaciona ostaje).

- **Penzionisano (istorijat, ne brisati znanje):**
  - *Prsten/potkovica ikonica* (`contexa-icon.svg` + PNG-ovi) — bila zaključana
    2026-08-26, penzionisana pivotom. Fajlovi postoje; NE šalju se u manifest.
  - *Oblak trigger* (`contexa-cloud-final.html`, `contexa-cloud.svg`) — sedam
    verzija, tehnički rešen (precrtan iz Miline reference, glatke bezier ivice,
    dark mint `#2E8B77`, 9s float) — pao na testu „oduševljen, prva stvar koju
    vide". Lekcija: polirali smo izvedbu, a falila je ideja.
  - *C-blenda / „C-otvor u krugu" / nosač+C* — istraženo i odbačeno ranije.

- **Ostaje na snazi:**
  - **Teal `#15a594` je brend boja** (maskota je teal; tamniji `#2E8B77` je
    upotrebljiv kao dark akcenat — proveren na oblaku).
  - **Trigger copy: `What now? ✦`** — sad ga maskota izgovara (njen balončić).
  - **✦ pada iz brenda, ostaje u stranici** (mimikrija claude.ai zvezdice).
  - Coral `#D97757` zabranjen. Bez Anthropic logotipa. Non-affiliation obavezna.

**Otvoreno:**
1. **Doterivanje blob lika** — proporcije, oči, gest šaputanja, entrance
   koreografija. Ikonica se exportuje TEK posle ovoga (16px test na finalu).
2. **Sajt boja** (krem/žuta nasleđe vs teal) — i dalje neodlučeno.
3. **Žuto-na-klik-reči** store kadar — i dalje neodlučeno.

## 1. Paleta

| | hex | uloga |
|---|---|---|
| **teal** | `#15a594` | **brend / maskota (zaključana)** |
| dark mint | `#2E8B77` | tamniji akcenat u familiji (proveren) |
| krem | `#FFFDF4` | podloga na sajtu (nasleđe) |
| ink | `#141414` | tekst / tamna podloga |
| highlighter | `#FFD84D` | akcent na sajtu (nasleđe, ne brend) |

**Izmereno, zašto je stara ikonica pala:** telo `#D97757` = piksel isto kao
claude.ai send dugme, plus zvezdica = Claude sub-brend bez svog identiteta.

## 2. Tvrde granice

- **Teal `#15a594` je brend boja.** Sajt — v. §0 otvoreno.
- **Coral `#D97757` nije naša boja.** Nikad, nigde.
- **✦ pada iz brenda, ostaje u stranici.**
- **Bez Anthropic wordmark-a i logotipa.** Ime sa „Claude" je u redu i
  provereno; logotip nije. **Non-affiliation linija obavezna.**
- **Crvena i roze su Squiggle-ova zabrana, ne naša.**
- **16px je ispit za znak — sada za maskotu.** Nacrtaj na 16, skaliraj gore.
- **Maskota ne sme da dosađuje:** proizvod ništa ne radi sam; lik proviri i
  MIRUJE (namig/pogled su mikro, retki). Bez stalnog mahanja/skakanja u idle.

## 2a. Kartica sa pitanjima (intervju) — forma zaključana (2026-08-26)

Tiha kartica; prati claude.ai, **bez teala** u kartici.
- Odgovori = **pill / kratka labela**, horizontalno-wrap.
- Napredak = **tačkice ••∘**.
- **Labela ≠ komponovano** — klik komponuje celu rečenicu u box; vidi je pre
  slanja. **Ne šalje sama.**
- Prava pitanja/grananje = sloj 3 (`pattern-file.md`). Mockup:
  `contexa-interview-form.html`.
- **Glas pitanja (2026-08-27): Registar C — „ogledalo"** (unutrašnji monolog,
  prvo lice = uvek korisnik; „What do I want back?"). Trigger „What now? ✦"
  već govori tim glasom — ceo sistem je jedan glas. Spec sa exemplar parovima
  i placement pravilima: `CONTEXA-voice-spec.md` (ide u `claude/` u repo).
  B (topli saveznik) odbijen — dupli šećer uz maskotu; A (prost-direktan) je
  fallback ako se „ko je I" zabuna pojavi u polju. Jedan-glas se ZAUSTAVLJA
  na paru trigger/peti čip — moraju ostati različiti (Defekt F).

## 3. Šta se crta, i u kojim dimenzijama

| asset | veličina | stanje |
|---|---|---|
| maskota (lik) | vektor + 128/48/32/16 | **BLOB izabran, namiguje** — doterivanje pre exporta |
| ikonica | 128/48/32/16 (+512 store) | **EXPORTOVANA 2026-08-27**: `contexa-mascot-icon-{16,32,48,128,512}.png` + master `contexa-mascot-icon.svg`. Po veličinama: 128/48/512 pun izraz; 32 bez catchlighta; **16 ima namernu korekciju** (oči razmaknute cx 20/38, rx 6.8, zenice r3.6 — bez nje se oči stapaju u traku na piksel mreži). Manifest: 16/32/48/128; 512 za store. |
| trigger u stranici | — | = maskota koja proviri; skica u fresh-ideas §4 |
| screenshot-ovi | 1280×800, do 5 | zastareli — prikazuju karticu koja se sama pojavljuje |
| mala pločica | 440×280 | postoji, krem/coral, stari proizvod — prerada (teal + maskota) |
| marquee | 1400×560 | postoji — prerada (teal + maskota) |
| video | YouTube URL | ne postoji |

Pločica se vidi na ~220px — jedna ideja. Screenshot checklist protiv curenja:
`claude/CONTEXA-store-listing.md` §2 (sidebar, DevTools, bookmarks, usage
banner, **Grammarly ugašen**, sadržaj ne-programerski).

## 4. Copy koji dizajn ne sme da protivreči

Proizvod od 0.9.54 ne radi sam: jedno dugme, ništa do pritiska.
- **Trigger: `What now? ✦`** (maskota ga govori).
- `It asks. You click.` je pogrešno. Radna zamena marquee:
  `One button. A few clicks. The prompt writes itself.`
- Ime: `CONTEXA - Claude prompts, without the writing`
- Tagline: **`Create magic in Claude`**
- Ukinuti: *„Prompt like a PRO"*, *„make bad prompts good"*, *„Rough ask"*.
- Glas intervjua = Registar C (vidi `CONTEXA-voice-spec.md`).

## 5. Store pokušaji — nalazi koji ostaju

Krem pločica se utapa u belu Store mrežu (odbijena). Kontrastna/tamna iskače;
proizvod živi u dark. Sa tealom: teal-na-tamnom spaja kontrast + brend.
Akcent na **reči koje su klikovi dodali** — samo jedan kadar (žuta vs teal
otvoreno). Providna marker poteza radi na kremu, muti se na `#30302E`.

## 6. Već ispravljeno, ne dirati

Store opis objavljen 2026-08-26; privacy policy prepisana; SUBMISSION.md
presečen. Ostaje kratki opis u `manifest.json` (opisuje auto-fire, javan u
pretrazi) — zamena od 125 znakova čeka u `store-listing.md` §0.

## 7. Dizajn ne rešava saobraćaj

Sajt nije deploy-ovan (fajl nepoznat gde), Reddit/TinyLaunch čekaju.
Screenshot-ovi su netačni, ne dosadni — moraju prerada. Uz sajt: teal-vs-krem.

## 8. Redosled izvođenja (dogovoren 2026-08-27, kraj design faze)

Sve dizajn odluke su donete; ovo je red kojim se izvodi, i zašto baš taj:

1. **Build chat — content.js po `claude/CONTEXA-content-spec.md`.** U ISTI store
   release ide i zamena manifest ikonica (`contexa-mascot-icon-{16,32,48,128}.png`)
   — jedan release okreće ceo identitet odjednom, umesto da ikonica i maskota
   stižu u različitim verzijama. Field test po §3 speca PRE store submita.
2. **Build chat — glas po `claude/CONTEXA-voice-spec.md`** (prompt-only,
   wrangler clock). Nezavisno od 1 po dizajnu, ali NE testirati obe promene
   istovremeno na istoj mašini — jedna promena, jedan field test, čista
   atribucija. Praktično: dok store review za 1 traje, radi se 2.
   Napomena: voice-spec §4 citira trigger labelu kakva je bila shipovana u
   trenutku pisanja („✦ What do I say next?"); posle 1 labela je „What now? ✦".
   Zakon je RAZLIKA para trigger/pencil, ne konkretan string — ček ostaje isti.
3. **Store paket sa maskotom** — TEK posle 1 (screenshot-ovi moraju pokazivati
   istinu). Pločica 440×280 i marquee su brend-art i mogu se crtati u design
   chatu bilo kad; screenshot-ovi čekaju. Checklist protiv curenja:
   `claude/CONTEXA-store-listing.md` §2; 512 ikonica je spremna.
4. Sitno neodlučeno, ne blokira ništa: sajt boja (krem/žuta vs teal),
   žuto-na-klik-reči kadar.
