# Prompt: Godišnji plan sječe — React/TypeScript dashboard

## Kontekst

Napravi React + TypeScript + Tailwind CSS stranicu **"Godišnji plan"** za praćenje realizacije godišnjeg plana sječe šume za **Pogon Bosanska Krupa**, godina **2026**. Podaci o realizaciji dolaze iz Google Sheets tabele (sječa primka).

---

## Tehnički stack

- React 18 + TypeScript + Vite
- Tailwind CSS (dark mode podrška na svim elementima)
- Recharts (BarChart, horizontalni layout, ReferenceLine)
- `createPortal` za modalni prikaz detalja odjela i modal za štampu

---

## Tipovi podataka

```typescript
type GJ = 'Risovac Krupa' | 'Grmeč Jasenica' | 'Vojskova'
type StatusOverride = 'auto' | 'posjeceno' | 'u-sjeci' | 'planirano'
type StatusValue    = 'posjeceno' | 'u-sjeci' | 'planirano'
type TabKey = 'grupe' | 'sortimenti' | 'pregled' | 'projekat'

interface PlanEntry {
  gj:       GJ
  odjel:    string
  bruto:    number      // bruto masa m³
  neto:     number      // neto masa m³ (plan)
  cTrupci:  number      // plan trupci četinari
  dzgo:     number      // plan cjepano četinari (= cel.duga + cel.cijepana + škart)
  lTrupci:  number      // plan trupci lišćari
  cijepano: number      // plan cjepano lišćari (= ogr.dugo + ogr.cijepano + gule)
}

// Ostvareno — 8 pojedinačnih sortimenata iz primke
interface ActualData {
  cTrupci:     number   // trupci_c (sheet kolona)
  celDuga:     number   // cel_duga
  celCijepana: number   // cel_cijepana
  skart:       number   // skart
  lTrupci:     number   // trupci_l
  ogrDugi:     number   // ogr_dugi
  ogrCijepani: number   // ogr_cijepani
  gule:        number   // gule
  ukupno:      number   // ukupno
}

interface OdjelRow extends PlanEntry {
  actual:   ActualData
  stepen:   number      // actual.ukupno / neto * 100
  koef:     number      // neto / bruto * 100
  status:   StatusValue
  override: StatusOverride
}
```

### Agregatne funkcije na ActualData:
```typescript
const dzgoAct  = (a: ActualData) => a.celDuga + a.celCijepana + a.skart
const cijAct   = (a: ActualData) => a.ogrDugi + a.ogrCijepani + a.gule
```

---

## Podaci plana (hardkodirani iz Excel datoteke BosanskaKrupa_Plan2026)

```typescript
const PLAN_ENTRIES: PlanEntry[] = [
  // Risovac Krupa
  { gj:'Risovac Krupa', odjel:'13',   bruto:3244,  neto:2768, cTrupci:3,    dzgo:2,   lTrupci:875,  cijepano:1888 },
  { gj:'Risovac Krupa', odjel:'35',   bruto:5417,  neto:4648, cTrupci:122,  dzgo:44,  lTrupci:1813, cijepano:2670 },
  { gj:'Risovac Krupa', odjel:'50',   bruto:5161,  neto:4329, cTrupci:1824, dzgo:227, lTrupci:971,  cijepano:1307 },
  { gj:'Risovac Krupa', odjel:'54P',  bruto:1511,  neto:1276, cTrupci:639,  dzgo:109, lTrupci:208,  cijepano:320  },
  { gj:'Risovac Krupa', odjel:'55',   bruto:5195,  neto:4258, cTrupci:2193, dzgo:328, lTrupci:789,  cijepano:948  },
  { gj:'Risovac Krupa', odjel:'56',   bruto:3877,  neto:3206, cTrupci:1779, dzgo:263, lTrupci:439,  cijepano:725  },
  { gj:'Risovac Krupa', odjel:'59/1', bruto:3724,  neto:3087, cTrupci:1545, dzgo:208, lTrupci:658,  cijepano:676  },
  { gj:'Risovac Krupa', odjel:'63',   bruto:4033,  neto:3339, cTrupci:1309, dzgo:236, lTrupci:796,  cijepano:998  },
  { gj:'Risovac Krupa', odjel:'66',   bruto:2645,  neto:2307, cTrupci:0,    dzgo:52,  lTrupci:949,  cijepano:1307 },
  { gj:'Risovac Krupa', odjel:'68/2', bruto:2605,  neto:2287, cTrupci:35,   dzgo:6,   lTrupci:1012, cijepano:1234 },
  { gj:'Risovac Krupa', odjel:'71P',  bruto:1957,  neto:1655, cTrupci:664,  dzgo:114, lTrupci:401,  cijepano:476  },
  { gj:'Risovac Krupa', odjel:'97',   bruto:4889,  neto:4058, cTrupci:1253, dzgo:236, lTrupci:901,  cijepano:1668 },
  { gj:'Risovac Krupa', odjel:'113P', bruto:5177,  neto:4300, cTrupci:225,  dzgo:74,  lTrupci:1278, cijepano:2723 },
  // Grmeč Jasenica
  { gj:'Grmeč Jasenica', odjel:'4/1',   bruto:2490, neto:2117, cTrupci:0,   dzgo:0,   lTrupci:303,  cijepano:1814 },
  { gj:'Grmeč Jasenica', odjel:'11P',   bruto:208,  neto:179,  cTrupci:0,   dzgo:0,   lTrupci:73,   cijepano:106  },
  { gj:'Grmeč Jasenica', odjel:'43P',   bruto:1099, neto:740,  cTrupci:40,  dzgo:100, lTrupci:160,  cijepano:440  },
  { gj:'Grmeč Jasenica', odjel:'60',    bruto:3551, neto:3061, cTrupci:295, dzgo:65,  lTrupci:1050, cijepano:1651 },
  { gj:'Grmeč Jasenica', odjel:'61',    bruto:4774, neto:4105, cTrupci:454, dzgo:102, lTrupci:1393, cijepano:2156 },
  { gj:'Grmeč Jasenica', odjel:'64/2P', bruto:996,  neto:608,  cTrupci:13,  dzgo:23,  lTrupci:211,  cijepano:361  },
  { gj:'Grmeč Jasenica', odjel:'66',    bruto:5339, neto:4493, cTrupci:0,   dzgo:0,   lTrupci:1025, cijepano:3468 },
  { gj:'Grmeč Jasenica', odjel:'67',    bruto:4853, neto:4199, cTrupci:0,   dzgo:0,   lTrupci:1530, cijepano:2669 },
  { gj:'Grmeč Jasenica', odjel:'69P',   bruto:1309, neto:1204, cTrupci:82,  dzgo:32,  lTrupci:390,  cijepano:700  },
  { gj:'Grmeč Jasenica', odjel:'85P',   bruto:678,  neto:418,  cTrupci:0,   dzgo:73,  lTrupci:25,   cijepano:320  },
  { gj:'Grmeč Jasenica', odjel:'88P',   bruto:1805, neto:1200, cTrupci:0,   dzgo:0,   lTrupci:20,   cijepano:1180 },
  // Vojskova
  { gj:'Vojskova', odjel:'15',  bruto:450, neto:383, cTrupci:0, dzgo:0, lTrupci:0,   cijepano:383 },
  { gj:'Vojskova', odjel:'21P', bruto:787, neto:624, cTrupci:0, dzgo:0, lTrupci:202, cijepano:422 },
  { gj:'Vojskova', odjel:'25',  bruto:750, neto:637, cTrupci:0, dzgo:0, lTrupci:0,   cijepano:637 },
]
```

---

## Konstante

```typescript
const GJ_LIST: GJ[] = ['Risovac Krupa', 'Grmeč Jasenica', 'Vojskova']

const GJ_COLOR: Record<GJ, string> = {
  'Risovac Krupa':  '#1d4ed8',  // plava
  'Grmeč Jasenica': '#15803d',  // zelena
  'Vojskova':       '#b45309',  // narandžasta
}

// Boje sortimenata
const C = {
  cTrupci:     '#1e40af',  // tamno plava
  celDuga:     '#5b21b6',  // ljubičasta
  celCijepana: '#7c3aed',  // ljubičasta
  skart:       '#9ca3af',  // siva
  lTrupci:     '#15803d',  // zelena
  ogrDugi:     '#92400e',  // tamno narandžasta
  ogrCijepani: '#b45309',  // narandžasta
  gule:        '#d97706',  // zlatna
}
```

---

## Status logika

Status odjela se automatski određuje na osnovu stepena realizacije (% posječeno od plana neto):
- **posjeceno**: stepen >= 95%
- **u-sjeci**: stepen > 5%
- **planirano**: stepen <= 5%

Korisnik može ručno pregaziti auto-status putem `<select>` elementa u svakom redu tabele. Vrijednost se čuva u `localStorage` (ključ: `gp|{gj}|{odjel}`). Opcija "Auto" vraća automatsko određivanje.

```typescript
function deriveStatus(pct: number): StatusValue {
  return pct >= 95 ? 'posjeceno' : pct > 5 ? 'u-sjeci' : 'planirano'
}
```

**Boje status badge-eva:**
- posjeceno: zelena (bg-green-100 text-green-700)
- u-sjeci: narandžasta (bg-amber-100 text-amber-700)
- planirano: siva (bg-gray-100 text-gray-500)

**Koef boja** (neto/bruto*100):
- >= 85%: zelena
- >= 75%: narandžasta
- < 75%: crvena

---

## Matching primke s planom

Primka redovi imaju kolonu `odjel` koja sadrži puno ime npr. `"RISOVAC KRUPA 50"`. Plan ima `gj="Risovac Krupa"` i `odjel="50"`. Matching se radi normalizacijom:

```typescript
function normKey(s: string): string {
  return s.trim().toUpperCase()
    .replace(/Č/g,'C').replace(/Ć/g,'C')
    .replace(/Š/g,'S').replace(/Ž/g,'Z').replace(/Đ/g,'DJ')
    .replace(/P\s*$/, '').trim()  // skini prelazni suffix "P"
}
// Match: normKey(r.odjel) === normKey(entry.gj + ' ' + entry.odjel)
```

---

## Filteri na vrhu stranice

- **Filter po GJ**: dugmad "Sve GJ" | "Risovac Krupa" | "Grmeč Jasenica" | "Vojskova"
- **Filter po statusu**: dugmad "Sve" | "Posječeno" | "U sječi" | "Planirano"
- **Pretraga**: tekst input po imenu odjela
- **Dugme Štampaj**: otvara `PrintModal` portal

---

## Zajednička funkcija za agregaciju

```typescript
function sumRows(rs: OdjelRow[]) {
  // vraća objekat sa:
  // planCT, actCT, pctCT    (Trupci Č plan/ostvr/%)
  // planDz, celDuga, celCij, skart, pctDz    (Cjepano Č)
  // planLT, actLT, pctLT    (Trupci L)
  // planCij, ogrDugi, ogrCij, gule, pctCij  (Cjepano L)
  // bruto, neto, ukupno, stepen
}
```

---

## Podtab 1: "Po grupama" — `PoGrupama`

Prikazuje sve odjele grupisane po GJ. Za svaki odjel prikazuje 8 pojedinačnih ostvarenih sortimenata nasuprot 4 planska agregata.

### Struktura tabele (19 kolona):
- **#** — redni broj (unutar GJ)
- **Odjel** — klikabilno (otvara OdjelDetailModal)
- **Status** — StatusBadge + StatusSelect (dropdown za override)
- **Koef.** — neto/bruto % (bojen zeleno/narandžasto/crveno)
- **Trupci Č** (2 kol): Plan | Ostvr. (u boji C.cTrupci)
- **Cjepano Č** (4 kol): Plan | Cel.d. | Cel.c. | Škart
- **Trupci L** (2 kol): Plan | Ostvr. (u boji C.lTrupci)
- **Cjepano L** (4 kol): Plan | Ogr.d. | Ogr.c. | Gule
- **Plan m³** — neto
- **Ostvr. m³** — actual.ukupno
- **Stepen** — RealizacijaBadge

### Dvostruki red zaglavlja:
- Red 1: grupni naslovi sa colspan (Trupci Č, Cjepano Č, Trupci L, Cjepano L)
- Red 2: podnaslov svake kolone (Plan, Ostvr., Cel.d., Cel.c., itd.)

### Po GJ:
- GJ header red (tintovana pozadina boje GJ)
- Redovi odjela
- **GJ subtotal** red (sveukupno za tu GJ, tintovana pozadina)

### Na dnu:
- **Grand total** red (tamna pozadina, bijeli tekst)

### Sortiranje: po odjelu | planu | ostvarenom | stepenu | koefu (klik na zaglavlje)

### Napomena ispod tabele:
> "Cjepano Č plan = Cel.duga + Cel.cijepana + Škart · Cjepano L plan = Ogr.dugo + Ogr.cijepano + Gule"

### CSV export dugme u zaglavlju kartice.

---

## Podtab 2: "Po sortimentima" — `PoSortimentima`

### A) 4 KPI kartice (grid 2×2 na mobilnom, 4×1 na desktopu):
Svaka kartica prikazuje jedan planski agregat:
- **Trupci Č** — plan vs ostvr., RealizacijaBadge, progres bar, "Ostalo X m³"
- **Cjepano Č** — isto
- **Trupci L** — isto
- **Cjepano L** — isto

### B) Ukupna realizacija kartica:
- Naslov: "Ukupna realizacija godišnjeg plana 2026"
- Plan neto m³ + Ostvareno m³ + RealizacijaBadge za ukupni stepen
- Progres bar (zeleni)
- Ispod: 4 mini progres bara za svaki agregat (sa % oznakom)

### C) Horizontalni bar chart (Recharts):
- Layout vertical, top 20 odjela po stepenu realizacije (sortirani rastuće)
- 4 serije: Trupci Č, Cjepano Č, Trupci L, Cjepano L
- X osa: %, crvena vertikalna linija na 100% (ReferenceLine)
- Tooltip: pokazuje % vrijednost
- Y osa: nazivi odjela

### D) Tabela po odjelima — % realizacije po sortimentima:
Sortabilna tabela sa kolonama:
- #, GJ (obojeno bojom GJ), Odjel (klikabilno), Status, Koef.,
- Plan m³, Ostvr. m³, Stepen (RealizacijaBadge)
- Trupci Č % (RealizacijaBadge ili — ako nema plana)
- Cjepano Č %, Trupci L %, Cjepano L %
- Progress (mini bar)

GJ subtotal redovi + Grand total red.

---

## Podtab 3: "Pregled plana" — `PregledPlana`

### Legenda boja statusa (ikona + tekst):
- Zelena kvadrat = Posječeno
- Narandžasta kvadrat = U sječi
- Bijela kvadrat = Planirano

### Tabela (redovi su obojeni prema statusu):
Kolone: Rb. | Odjel (klikabilno) | Bruto m³ | Neto m³ | Trupci Č | Cjepano Č | Trupci L | Cjepano L | Status

Grupisano po GJ (GJ header, odjel redovi, GJ subtotal).

Boja reda: posjeceno=zelena tinta, u-sjeci=narandžasta tinta, planirano=bez boje.

Nule prikazivati kao "—".

Grand total (tamna pozadina).

---

## Podtab 4: "Plan po projektu" — `PlanPoProjaktu`

Poredi **projektovanu masu** (iz Excel projekta, iste vrijednosti kao plan) s **posječenom masom** (iz Google Sheets lista "STANJE_ZALIHA").

### Format tabele — za svaki odjel DVA REDA:
- Red 1: "**1. Projekat**" (plavi tekst) — projektovana masa
- Red 2: "**2. Sječa**" (zeleni tekst) — posječena masa + RealizacijaBadge za stepen

Kolone: Rb. | Odjel | Stavka | Trupci Č | Cjepano Č | Trupci L | Cjepano L | Ukupno m³ | Stepen

### GJ subtotal — isto 2 reda (Projekat + Sječa)
### Grand total — 2 reda (tamna pozadina)

### Rekapitulacija po GJ (ispod glavne tabele):
Kompaktnija tabela: GJ | Projekat m³ | Sječa m³ | Stepen | Ostalo m³ | Realizacija (progres bar obojeno bojom GJ)

### Dijagnostika (sklopivi panel):
Prikazuje koliko STANJE_ZALIHA odjela je učitano i koji se match-uju s planom. Pomaže pri debug-ovanju.

### Matching STANJE_ZALIHA s planom:
Koristi istu `normKey()` funkciju. Ključ plana: `normKey(gj + ' ' + odjel)`. Ključ iz STANJE_ZALIHA: `normKey(z.odjel)`.

---

## OdjelDetailModal (klik na naziv odjela)

Prikazuje se kao fullscreen overlay portal (`createPortal` na `document.body`).

**Sadržaj:**
- Header: GJ badge (obojeno), naslov "Odjel {X}", broj primka zapisa, ukupno m³
- CSV export dugme
- Zatvori dugme (X) + Escape tipka

**Tabela primka zapisa** (svaki red je jedna primka):
- Datum (dd.mm.yyyy (dan u sedmici))
- Primac, Radilište
- Trupci Č, Cel.D, Cel.C, Škart, Trupci L, Ogr.D, Ogr.C, Gule
- Ukupno

Zaglavlje kolona su obojene bojama sortimenata (C.cTrupci, C.celDuga, itd.).

Footer red: Ukupno svih kolona (tamna pozadina).

Ako nema primka zapisa: poruka "Nema primka zapisa za ovaj odjel."

---

## PrintModal (dugme Štampaj)

Portal koji prikazuje tabelu formatiranu za štampu:

- **Toolbar** (sticky, tamna pozadina): naslov + "Štampaj" dugme + "Zatvori" dugme
- **Paper div** (A4 format, white background, max-width 210mm, padding 18mm):
  - Header sa logom/naslovom i datumom
  - Za svaku GJ: GJ naslov + tabela odjela s kolonama: Rb., Odjel, Bruto, Neto, Plan gr. (4 podkolone), Ostvr. (8 sortim.), Stepen, Status
  - GJ subtotal red
  - Grand total red
  - Potpis sekcija

Print CSS: skriva sve osim print portala, koristi A4 portrait format.

---

## Zajednički mali komponenti

### `RealizacijaBadge({ pct })`
Zaobljeni badge s postotkom:
- >= 90%: zelena
- >= 60%: narandžasta
- > 0%: crvena
- 0%: siva ("—")

### `Bar2({ pct, color })`
Mini horizontalni progres bar (h-1.5, zaobljeni). Crveni ako pct > 100%.

### `StatusBadge({ s })`
Badge za status (posjeceno/u-sjeci/planirano) s odgovarajućom bojom.

### `StatusSelect({ value, onChange })`
`<select>` dropdown za ručni override statusa. Opcije: Auto | Posječeno | U sječi | Planirano.

### `SortimentCard({ label, plan, actual, color })`
KPI kartica za jedan planski sortiment. Prikazuje: naziv, RealizacijaBadge, ostvareno m³ (obojeno), "od X m³", "Ostalo Y m³", Bar2.

### `ThSort({ children, col, sort, asc, onSort, left })`
Sortabilna zaglavlja tabele (↑/↓/↕).

### `GJHeader({ gj, colSpan })`
Red koji prikazuje naziv GJ kao separator s tintovanom pozadinom.

### `ExportBtn({ onClick })`
Standardno CSV export dugme (ikona download + tekst "Export CSV").

---

## Agregatni helper `sumRows(rows: OdjelRow[])`

Izračunava sve potrebne sume za subtotal/grand total redove:
```
{ planCT, actCT, pctCT, planDz, celDuga, celCij, skart, pctDz,
  planLT, actLT, pctLT, planCij, ogrDugi, ogrCij, gule, pctCij,
  bruto, neto, ukupno, stepen }
```

---

## Izvor podataka (actual)

Iz Google Sheets tabele (primka sječe) filtrirane po godini. Za svaki `PlanEntry` pronalazi sve primka redove gdje `normKey(r.odjel) === normKey(entry.gj + ' ' + entry.odjel)`, i sumira 8 sortiment polja.

Podaci STANJE_ZALIHA dolaze iz posebnog Google Sheets lista koji ima blokove po odjelima s redovima "PROJEKAT" i "SJEČA" za svaki sortiment.

---

## Napomene o UX-u

- **Sve nule** prikazivati kao "—" u tabeli (ne "0")
- **Sve mase** formatirati bez decimala (`.toFixed(0)`) s lokalnim separatorom hiljade (bosanski format: `1.234`)
- **Sortiranje** tabela: klik na zaglavlje mijenja kolonu i smjer (↑/↓), podrazumijevano silazno
- **Horizontalni scroll** na svim tabelama (overflow-x-auto)
- **Sticky GJ filtri** u kartici na vrhu
- **Status override** se odmah sprema u localStorage i prikazuje
- **RealizacijaBadge** koristi `.toFixed(1)` za postotak
