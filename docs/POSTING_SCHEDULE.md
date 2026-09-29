# Grila de postare Instagram — @la.butoane

*Propusă și implementată 2026-09-29. Sursa de adevăr pentru calendar:
`frontend/public/posting-schedule.json` (citit de `/admin` și de
`scraper/post_schedule.py`). Nimic din grilă nu publică singur.*

## Ce spun datele contului (19 postări, iul–sep 2026, 400 urmăritori)

| Tip de postare | Exemple | Reach | Salvări / distribuiri / urmăritori |
|---|---|---|---|
| Explainer cu aritmetică | «0 voturi împotrivă. Și tot a picat.» | 932 | 13 / 2 / **7** |
| Vot contestat, cu explicație | «AUR a votat în bloc împotrivă» (L294) | 387 | 4 / **27** / 0 |
| Lege cu miză publică largă | L276 anti-SLAPP | **1 231** | 9 / 2 / **12** |
| Recap săptămânal (listă) | «Trecute de Parlament» 19 sept | 910 | 2 / 2 / 5 |
| Lansare / educație | intro, structura, cum devine lege | 650–970 | 9 / 1 / 2 |
| Carusel de lege, rezumat simplu | urși, L122, L573, L470, benzină | 138–214 | ≈ 1 / 1 / 0 |

Concluzii:
1. **Explicația bate rezumatul.** Aceeași structură de carusel face 5× reach
   când slide-ul 1 pune o întrebare și slide-ul 2 arată socoteala.
2. **Distribuirile vin din «cine a votat cum»** (blocuri de partid, devieri),
   urmăritorii vin din subiecte care circulă deja în presă (SLAPP, admitere).
3. **Sâmbătă/duminică** nu au adus nimic; joi seara e fereastra cu cea mai
   mare interacțiune (și în studiile Buffer/Sprout pentru 2026: 18–21, mijlocul săptămânii).
4. Ritm: 4 postări în feed pe săptămână + story-uri în zilele de plen. Sub
   50k urmăritori, consistența contează mai mult decât volumul.

## Grila săptămânală (sesiune parlamentară)

| Zi | Ora | Format | Slot | Sursa în /admin |
|---|---|---|---|---|
| Luni | 18:00 | feed | Ce a votat Parlamentul săptămâna trecută | «Ce a votat Parlamentul săptămâna trecută» (weekcover `kind=votate`) |
| Luni–Mie | după ședință | story | Voturile finale de azi | «Astăzi» |
| Marți | 18:00 | feed | Carusel: o lege terminată (vot decizional / promulgare), după scor de interes | «Promulgate» / «Trecute de ambele camere» |
| Miercuri | 18:00 | feed | Pe cale să treacă tacit — **doar** dacă există un proiect cu scor ≥ 60 în 7 zile | «Pe cale să treacă tacit» |
| Joi | 20:00 | feed | **Explainer sau vot contestat** — slotul de creștere | recap + deck-urile cu slide «devieri» |
| Vineri | 18:00 | feed | Trecute de Parlament / promulgate săptămâna asta | «Trecute de ambele camere» (weekcover `kind=parlament`) |
| Sâmbătă | 12:00 | story | Absenții săptămânii (≥ 30 voturi/cameră, cele trei garduri) | datele newsletterului |
| Duminică | — | — | pauză | — |
| oricând | ziua anunțului | story | Schimbare de partid | «Astăzi» (evenimențial, nu pe calendar) |

Lunar: **1** — top absențe luna trecută (emailul de aprobare vine la 09:00);
**2** — traseiști luna trecută (se sare la zero); **5 ian/apr/iul/oct** — matricea partidelor.

Vacanță parlamentară (iulie, august, ianuarie): rămân doar marți «Știai că?»
(o lege din arhivă), joi explainer și cardurile lunare.

## Reguli editoriale care rămân

- Feed = legi **terminate** (vot decizional sau decizie prezidențială). Legile
  în dezbatere merg pe story.
- Respingerile dramatice se postează doar când **de ce**-ul e cunoscut și
  poate fi explicat pe slide (raport negativ, majoritatea celor prezenți).
- Orice clasament cu nume: mandat pe toată fereastra, fără `context_note`,
  minim de voturi. Membrii guvernului sunt excluși.
- Titlul AI se verifică pe fiecare deck (cohorte/ani școlari, «pedepse pentru
  X» vs «obligarea la X»).

## Cum funcționează

- `python scraper/post_schedule.py --print [data]` — ce e programat, cu candidații pentru fiecare slot.
- `python scraper/post_schedule.py --week [data]` — săptămâna întreagă.
- `python scraper/post_schedule.py --email` — digestul «Azi pe IG» către `$IG_PREVIEW_EMAIL`
  (rulează automat din `run_daily.sh` la 09:00 RO; lunea include reach/salvări/urmăritori
  pentru postările săptămânii trecute).
- `/admin` are un calendar sus, cu ziua de azi și săptămâna, fiecare slot legat
  de secțiunea cu cardul gata de publicat.

## Ce ar mai crește reach-ul (neimplementat)

- **Reels**: sub 50k urmăritori, reels-urile sunt formatul cu cel mai mare reach în 2026.
  Pipeline-ul nostru e PNG (Satori). Un reel de 15–20 s din 4 slide-uri (ken-burns +
  text) se poate genera cu ffmpeg pe VPS; API-ul acceptă REELS de 5–90 s, 9:16.
- **Threads**: același card + primele două rânduri din caption, prin Threads API
  (container → publish, ca la IG; necesită verificare «Tech Provider» a aplicației Meta).
