# Plan de creștere — cum ajungem la mai mulți oameni

*2026-09-29. Punct de plecare: @la.butoane are 400 de urmăritori, 19 postări,
un newsletter săptămânal (la-butoane.ro) și o primă citare majoră (Edupedu,
22 aug 2026, apoi analiza inițiativelor pe educație din sept 2026).
Lista de ținte, cu status, e în `docs/outreach_targets.csv`.*

## Ce ne spun cifrele noastre

- Postările care aduc **urmăritori** sunt cele pe subiecte deja în presă
  (anti-SLAPP: 1 231 reach, 12 urmăritori) și explainerele (932 reach, 7).
- Postările care aduc **distribuiri** sunt cele cu «cine a votat cum»
  (AUR în bloc: 27 distribuiri).
- Rezumatele simple de lege nu circulă (sub 250 reach). Nu mai sunt slotul principal.

Deci creșterea vine din două surse: (1) să fim **utili altora** care au deja
public (presă, ONG-uri, organizații de elevi/studenți), (2) să intrăm în
**ciclul de știri** cu date, în 24 h.

## 1. Presă și ONG-uri: fim sursa lor de date, nu concurența

Ce avem și ei nu: voturile nominale, prezența, traseismul, termenele tacite,
toate cu API public (`/api/v1`) și exporturi CSV.

**Ținte** (detalii în CSV): Edupedu (deja citează), Snoop (102k IG),
Funky Citizens (34k IG), Recorder, Context.ro, PressOne, G4Media, HotNews,
Europa Liberă România, Dela0, Republica; Expert Forum, APADOR-CH, CeRe,
Code for Romania, Declic, Corupția Ucide.

**Oferta**, aceeași pentru toți, într-un email de 8 rânduri:
1. un «data pack» săptămânal luni dimineața: voturile finale ale săptămânii
   trecute, cu breakdown pe partide și devieri, ca CSV + link pe site;
2. carduri gata de publicat (1080×1350) cu sursa pe ele, libere de reutilizat
   cu credit «date: la-butoane.ro»;
3. răspuns în aceeași zi la orice «cine a votat pentru X» (avem link direct
   pe fiecare vot).

**Ce cerem**: creditul cu link când folosesc datele, și, la ONG-uri, un post
Collab pe Instagram o dată pe lună (postarea apare în ambele feed-uri; se face
din aplicație, invitația de colaborator nu e în API).

**Cârligul de deschidere** pentru fiecare: un card făcut pe subiectul lor
(Edupedu: uniforma școlară cu votul pe partide; Snoop/Recorder: absenții și
traseiștii lunii; Funky Citizens: adoptările tacite). Nu «vă prezentăm
proiectul», ci «uite datele pe subiectul vostru de săptămâna asta».

## 2. Organizații cu public tânăr, pe subiectele lor

- **Consiliul Național al Elevilor**: protestul în negru din 28 sept împotriva
  uniformei obligatorii. Avem votul din Senat (84–18, cu partidele) și pasul
  următor (Camera decide). Un card pe care îl pot distribui *azi*.
- **ANOSR / consilii studențești**: bursele tehnologice (L566/2026),
  admiterea amânată (L470), taxele.
- **Sindicate din educație (FSLI, FSE Spiru Haret)**: legile pe salarizare din
  analiza Edupedu.

Regula: cardul lor, nu al nostru. Datele plus întrebarea «unde e proiectul acum».

## 3. Presa locală: unghiul de județ

Site-urile locale (Monitorul de Vaslui, PHonline, Ziarul Delta etc.) republică
declarațiile parlamentarilor lor. Noi avem harta pe județe și prezența fiecărui
ales. Un email lunar «parlamentarii din județul X: prezență, devieri, inițiative»
către 10 redacții locale costă o oră și aduce citări cu link. Începem cu
județele unde avem ceva de spus (Vaslui: Gherasim; Prahova: Gușă, Roșca;
Tulcea: Carp; Harghita: Antal).

## 4. Ciclul de știri, în 24 h

Când un subiect parlamentar explodează în presă, avem 24 h să publicăm
**cardul cu votul**. Exemple ratate luna asta: uniforma școlară (Senat 21 sept,
proteste 28 sept), CCR/reexaminare la legea urșilor. Regulă nouă în grilă:
slotul de joi («explainer sau vot contestat») se mută în ziua în care apare
subiectul, dacă apare.

Semnal de alarmă automat: `interest_scorer` marchează deja legile cu scor ≥ 90;
enrich-ul rulează din oră în oră, deci un vot de la 11:00 are scor la 12:20.

## 5. Instagram, mecanic

- **Colaborări (Collab)**: 1/lună cu un ONG, postarea apare la ambii.
- **Tag-uri**: inițiatorii legii și grupurile parlamentare în caption; deputații
  își redistribuie propriile voturi «pentru».
- **Reels**: formatul cu cel mai mare reach sub 50k. Un reel de 15 s din
  slide-urile deck-ului (ffmpeg pe VPS, `media_type=REELS`, 9:16, 5–90 s) e
  singura piesă tehnică lipsă. Prioritate după ce grila merge două săptămâni.
- **Threads**: cross-post automat al cardului + primele două rânduri
  (Threads API: container → publish; cere verificarea aplicației Meta).
- **Story-uri zilnice în zilele de plen** țin contul «viu» în algoritm între
  postări; nu costă nimic, sunt deja în admin.
- Răspuns la fiecare comentariu în prima oră (semnal de ranking); comentariile
  lipsesc complet acum (0 pe toate postările).

## 6. Reddit, Facebook, newsletter

- **r/Romania**: nu link-uri la contul de IG, ci analize ca text + link pe
  site (recapul săptămânal, «0 voturi împotrivă»). Un post pe săptămână, luni.
- **Grupuri Facebook** de părinți/profesori pentru legile pe educație — cardul
  cu «unde e proiectul acum», fără brand în față.
- **Newsletterul** e canalul pe care îl deținem: fiecare postare din feed
  are un buton «abonează-te» în bio și în ultimul slide (CTA existent).

## Primele 30 de zile

| Săpt. | Acțiune | Măsură |
|---|---|---|
| 1 | Email + card către Edupedu (uniforma) și CNE; grila pornită; răspuns la comentarii | 2 citări cu link |
| 2 | Data pack luni către 6 redacții; primul post Collab propus (Funky Citizens sau Declic) | 1 Collab acceptat |
| 3 | Email lunar presă locală (5 județe); r/Romania cu recapul | 3 republicări |
| 4 | Reel-test din deck-ul cel mai bun al lunii; bilanț: reach mediu, urmăritori/postare | +150 urmăritori/lună |

Țintă realistă: 400 → 1 500 urmăritori până la 31 dec 2026, cu 1 explainer +
1 subiect din presă pe săptămână și 1 Collab pe lună. Peste asta vine doar
din Reels sau dintr-o citare mare (Recorder/Snoop).
