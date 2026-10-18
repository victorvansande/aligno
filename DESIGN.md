# Aligno rulebook

De vaste regels voor hoe Aligno eruitziet, aanvoelt en in elkaar zit. Elke nieuwe wijziging volgt dit document, en oude code die ervan afwijkt wordt rechtgezet zodra je ze aanraakt. Wil je iets doen dat hier niet in past, pas dan eerst dit document aan (met een reden), en pas daarna de app.

Alle waarden bestaan als CSS-variabelen (tokens) bovenaan `index.html`. In de CSS gebruik je **altijd de token**, nooit het getal zelf.

---

## 1. Karakter

- **Rustig en precies.** Aligno gaat over exact uitlijnen. De interface is strak, voorspelbaar en zonder versiering.
- **Monochroom met één accentkleur.** Grijswaarden doen het werk. Indigo is alleen voor wat je moet zien of aantikken.
- **De foto's zijn de kleur.** De interface mag nooit concurreren met de foto's van de gebruiker.
- **Een app, geen website.** Geen zoom, geen tekstselectie, geen sprongen bij het scrollen. Alles reageert onder je vinger.

## 2. Kleur

| Token | Licht | Donker | Gebruik |
|---|---|---|---|
| `--accent` | #5B5FEF | #6C70F6 | Primaire knop, actieve staat, schakelaar aan |
| `--accent-strong` | #4145C7 | #AEB0FF | Accent als tekst of icoon op een lichte achtergrond |
| `--accent-soft` | #EEEEFD | #25264A | Achtergrond van geselecteerde rijen, icoontegels, tips |
| `--bg` | #FAFAFB | #0D0D12 | Achtergrond van elk scherm |
| `--surface` | #FFFFFF | #17171E | Kaarten, rijen, knoppen (ghost), invoervelden |
| `--surface-2` | #F3F3F6 | #1C1C24 | Ingebedde panelen (hero, uitleg, statistieken) |
| `--line` | #EAEAEF | #25252E | Randen van kaarten, scheidingslijnen |
| `--line-strong` | #DDDDE4 | #33333E | Randen van invoervelden en knoppen, sliders |
| `--text` | #131318 | #F1F1F5 | Hoofdtekst en titels |
| `--text-2` | #65656F | #A3A3AF | Secundaire tekst, uitleg, metadata |
| `--text-3` | #9A9AA4 | #6E6E7A | Labels, voetnoten, pijltjes (chevrons) |
| `--danger` | #D93B30 | #D93B30 | Vlak van een verwijderknop |
| `--danger-text` | #C6392F | #FF7A70 | Rode tekst en iconen |
| `--warn-bg` / `--warn-text` / `--warn-strong` | geel | geel | Alleen "Due"-meldingen |

**Altijd donkere vlakken** (camera, uitlijner, fotoviewer, vergelijken) gebruiken `--ink` (#0B0B10) als basis, wit (`--on-dark`) en `--on-dark-2` (#EDEDF2) als tekst, en `--glass-dark` voor knoppen. Daar wisselt het thema niet mee: foto's beoordeel je altijd op zwart.

Regels:
- Eén primaire (indigo) knop per scherm. Andere acties zijn ghost-knoppen of rijen.
- Indigo nooit voor lopende tekst. Wel voor één woord of icoon dat een actie aanduidt.
- Rood alleen voor verwijderen. Geel alleen voor "Due".
- Illustraties (de plant, het huis, het kind in voorbeelden) hebben hun eigen kleuren. Dat zijn "foto's", geen interface.
- Een nieuwe kleur? Eerst als token toevoegen, in licht én donker, en in deze tabel.

## 3. Typografie

Lettertype: het **systeemlettertype** van het toestel (SF Pro op iPhone, Roboto op Android). Zo voelt Aligno als een echte app op elk toestel en laadt er niets extra.

| Token | Grootte | Gewicht | Regelhoogte | Spatiëring | Gebruik |
|---|---|---|---|---|---|
| `--fs-display` | 30px | 600 | 1.15 | -0.03em | Alleen de naam "Aligno" op de startpagina |
| `--fs-title` | 20px | 600 | 1.2 | -0.02em | Schermtitels, titels van sheets, merknaam, grote cijfers |
| `--fs-headline` | 17px | 600 | 1.25 | -0.02em | Projectnamen, titels van lege staten, cijfers in de hero |
| `--fs-control` | 16px | 600 | 1.2 | -0.01em | Knoppen en invoervelden (16px voorkomt inzoomen op iPhone) |
| `--fs-body` | 15px | 400 / 600 | 1.5 | 0 | Gewone tekst, rijen, schakelaars, vetgedrukte rijtitels |
| `--fs-sub` | 13px | 400 | 1.5 | 0 | Uitleg onder titels, metadata, notities, tips |
| `--fs-label` | 12px | 500 / 600 | 1.3 | 0.02em | Sectielabels, chips, badges, knoplabels onder iconen |
| `--fs-micro` | 11px | 500 / 700 | 1.2 | 0.01em | Labels onder cijfers, A/B-badges, timerbadge |

Regels:
- **Gewichten**: 400 voor tekst, 500 voor bedieningslabels (segmenten, camera), 600 voor titels, namen en knoppen. 700 alleen voor cijfers in badges en de aftelling.
- **Geen andere groottes.** Enige uitzondering: het aftelcijfer van de zelfontspanner (120px).
- Titels en labels in zinsvorm ("New project", niet "New Project" en niet "NEW PROJECT").
- Tekst die kan afgekapt worden (namen) krijgt `text-overflow: ellipsis`, nooit een tweede regel in een topbalk.

## 4. Ruimte

Alles op een raster van 4px.

| Token | Waarde | Gebruik |
|---|---|---|
| `--s-1` | 4px | Binnen samengestelde elementen (icoon naast label) |
| `--s-2` | 8px | Tussen kleine elementen, strips met miniaturen, tegelraster |
| `--s-3` | 12px | Tussen kaarten en rijen in een lijst, binnenmarge van compacte rijen |
| `--s-4` | 16px | **Schermrand (gutter)**, binnenmarge van kaarten en panelen |
| `--s-5` | 20px | Binnenmarge van sheets |
| `--s-6` | 24px | Tussen secties (blok, dan volgend sectielabel) |
| `--s-8` | 32px | Grote witruimte (bv. boven lege staten) |

Regels:
- Elk scherm heeft 16px marge links en rechts. Zonder uitzondering.
- Een sectielabel staat 12px boven zijn inhoud en 24px onder het vorige blok.
- Lijsten van kaarten en rijen: 12px ertussen. Tegels en miniaturen: 8px.
- Knoppen naast elkaar: 12px ertussen. Knoppen onder elkaar: 12px.

## 5. Vormen en hoeken

| Token | Waarde | Gebruik |
|---|---|---|
| `--r-xs` | 8px | Badges, kleine miniaturen (tot 40px) |
| `--r-sm` | 12px | Miniaturen, foto's in een paneel, binnenste segmentknop |
| `--r-md` | 16px | Knoppen, invoervelden, rijen, fototegels, notities, segmenten |
| `--r-lg` | 22px | Kaarten en panelen (projectkaart, hero, exportkaart) |
| `--r-xl` | 28px | Bovenhoeken van sheets |
| `--r-pill` | 999px | Chips, toasts, badges met tekst |
| 50% | | Ronde knoppen (camera), sluiter, aftelpunten |

Regels:
- **Geneste hoeken**: binnenste hoek = buitenste hoek min de binnenmarge. Een segment met hoek 16 en 4px marge heeft knoppen met hoek 12.
- Geen andere hoekwaarden.

## 6. Diepte

- `--sh-1`: rustende kaart (kaarten, ghost-knoppen, tegels).
- `--sh-2`: zwevend (sheets, toasts, update-melding).
- `--sh-accent`: alleen de primaire knop.
- **Kaart** = `--surface` + 1px `--line` + `--sh-1`. **Paneel** = `--surface-2`, geen rand, geen schaduw. Meng die twee niet.
- **Glas** (`backdrop-filter`) alleen op dingen die over andere inhoud zweven: sheets, de achtergrond achter sheets, cameraknoppen. Nooit op gewone kaarten.

## 7. Afmetingen en aanraken

| Token | Waarde | Gebruik |
|---|---|---|
| `--h-control` | 52px | Knoppen en invoervelden |
| `--h-row` | 56px | Minimale hoogte van een rij (instellingen, opties) |
| `--h-seg` | 44px | Gesegmenteerde keuzes |
| `--tap` | 44px | Minimale aanraakzone van alles wat tikbaar is |

- Iconen: 16px in tekst en chips, 20px in knoppen en rijen, 22px in de topbalk en camera. Lijndikte 2 (1.8 vanaf 20px mag), ronde uiteinden.
- Projectminiatuur 56px, cameraminiatuur 54px, sluiter 80px.

## 8. Beweging

| Token | Waarde | Gebruik |
|---|---|---|
| `--t-fast` | 120ms | Indrukken (schaal) |
| `--t-base` | 200ms | Vervagen, schakelaars, kleuren |
| `--t-slow` | 320ms | Schermen, sheets |
| `--ease` | cubic-bezier(.22,.61,.36,1) | Alles wat binnenkomt |

- Indrukken: knoppen, kaarten en rijen schalen naar 0.97, ronde iconknoppen naar 0.92.
- Een scherm komt binnen met 8px omhoog en vervagen. Een sheet schuift van onder.
- Wie "minder beweging" aanzet op het toestel, krijgt geen animaties (`prefers-reduced-motion`).

## 9. Opbouw van een scherm

Elk scherm heeft drie delen, altijd in deze volgorde:
1. **Topbalk**: terugknop links (behalve op Home), titel, maximaal twee iconknoppen rechts.
2. **Inhoud**: scrollt. Begint met de belangrijkste informatie.
3. **Voet**: de acties, onderaan waar je duim zit. De primaire knop staat bovenaan in de voet.

Camera, uitlijner, viewer en vergelijken zijn volledig donker: sluiten linksboven, de belangrijkste handeling onderaan in het midden.

Een keuze tussen 2 of 3 opties = segment. Aan/uit = schakelaar. Een lijst acties = rijen in een sheet. Iets definitief verwijderen = altijd een bevestigingssheet met een rode knop die zegt wat er gebeurt ("Delete project", niet "OK").

## 10. Componenten

| Component | Klasse | Specificatie |
|---|---|---|
| Primaire knop | `.btn.primary` | 52px hoog, `--r-md`, `--accent`, wit, `--fs-control` |
| Ghost-knop | `.btn.ghost` | Zelfde maat, `--surface`, rand `--line-strong`, `--sh-1` |
| Verwijderknop | `.btn.danger` | Zelfde maat, `--danger`, wit |
| Iconknop | `.tbtn`, `.backbtn` | 44×44 aanraakzone, icoon 22px, geen achtergrond |
| Kaart | `.pcard` | `--r-lg`, 12px binnenmarge, kaartstijl uit §6 |
| Rij | `.set-row` | min. 56px, `--r-md`, icoon 20px in `--accent-strong`, chevron in `--text-3` |
| Optie | `.optrow` | Als rij; geselecteerd = rand `--accent` + `--accent-soft` |
| Segment | `.seg` / `.cam-seg` | 44px, `--r-md`, 4px binnenmarge, knoppen `--r-sm` |
| Schakelaar | `.tgl` | 46×28, aan = `--accent` |
| Invoerveld | `.field` | 52px, `--r-md`, rand `--line-strong`, focus = rand `--accent` + zachte ring |
| Sheet | `.modal-bg > .sheet` | Glas, `--r-xl` bovenaan, 20px marge, grijplijntje, titel `--fs-title` |
| Paneel | `.panel` | `--surface-2`, `--r-lg`, 16px marge |
| Sectielabel | `.sectlbl` | `--fs-label`, 600, `--text-3` |
| Lege staat | `.empty` | Icoon of illustratie, titel `--fs-headline`, uitleg `--fs-sub`, eventueel één ghost-knop |
| Toast | `.toast` | Pil, `--pill-bg`, onderaan, verdwijnt na 2,6 s |
| Badge "Due" | `.duechip` | Pil, `--fs-micro`, gele tokens |

Een nieuw onderdeel bouw je eerst uit deze componenten. Lukt dat niet, voeg dan een component toe aan deze tabel.

## 11. Tekst (copy)

- Engels, kort en direct, in je-vorm ("your photos").
- **Geen em dashes** en geen typische AI-taal ("seamless", "elevate", "unlock", "dive in", ...). Gebruik een punt, komma of dubbelpunt.
- Knoppen beginnen met een werkwoord: "Take photo", "Make video", "Delete project".
- Bevestigingen: titel is een vraag ("Delete this photo?"), de uitleg zegt wat er gebeurt, de rode knop herhaalt de actie.
- Foutmeldingen zeggen wat er misging én wat je kan doen.
- Getallen met eenheid: "6 photos", "1 photo", "3 fps", "2.4 MB". Datums: "Aug 17" (dit jaar), "Aug 17 '25" (ander jaar), voluit in de viewer.

## 12. App-gevoel (op het startscherm)

- Niet inzoomen: viewport vergrendeld, `touch-action: manipulation`, iOS-knijpgebaren geblokkeerd, invoervelden minstens 16px.
- Geen "rubber band" of trek-om-te-verversen: `overscroll-behavior: none`.
- Geen tekstselectie of "Bewaar afbeelding"-menu bij lang drukken, behalve in invoervelden.
- Geen witte flits van de startpagina bij het openen: het juiste scherm verschijnt meteen.
- Scherm blijft aan terwijl de camera open is.
- Respecteer de veilige zones (notch, home-balk) met `env(safe-area-inset-*)`.
- Terugknop van Android en Escape sluiten altijd het bovenste ding (sheet, viewer, scherm).
- Op iPhone in de browser toont Aligno hoe je hem aan je beginscherm toevoegt.

## 13. Code

**Bestanden**
- `index.html`: markup en alle CSS. De CSS staat in genummerde secties: 1 tokens, 2 basis, 3 opbouw, 4 componenten, 5 schermen, 6 donkere vlakken, 7 animatie, 8 donker thema.
- `app.js`: alle logica, in secties met een kop `/* --- Naam --- */`.
- `sw.js`: service worker. `gifenc.js`: vendored, nooit aanpassen.

**CSS**
- Alleen tokens voor kleur, lettergrootte, hoek, schaduw en tijd. Een los getal mag alleen voor afmetingen die nergens anders voorkomen (bv. de sluiter).
- Geen `style="..."` in de HTML. Een hulpklasse uit sectie 3 (`.row`, `.stack`, `.mt-*`) of een eigen klasse.
- Eén plek per regel: een selector wordt niet verderop in het bestand nog eens overschreven.
- Nieuwe kleur of maat = nieuwe token, in licht en donker.

**JavaScript**
- Zichtbaarheid wissel je met `el.hidden = true/false`, niet met `style.display`. JS zet alleen inline stijlen die echt dynamisch zijn (positie, grootte, transform, opacity tijdens slepen).
- Gegenereerde markup gebruikt dezelfde klassen als de HTML. Tekst van de gebruiker altijd door `escapeHtml()`.
- Elementen via `$('id')`, events gekoppeld in `wire()` of een `wireX()`-functie per onderdeel.
- Eén state-object per onderdeel (`exp`, `cmp`, `alState`, ...), geen losse globals.
- IndexedDB via de `db*`-helpers met async/await. Schemawijziging = DB-versie omhoog + migratie die niets weggooit.
- Een nieuw scherm: toevoegen aan `screens` en aan `goBack()`. Een nieuwe overlay: klasse `.modal-bg`, of opnemen in de history-observer.
- Fouten die de gebruiker raken: `toast()` met een duidelijke zin. Geen `alert()`, geen `confirm()`, wel `confirmSheet()`.
- Geen frameworks, geen build-stap, geen externe scripts (alles werkt offline).

**Elke wijziging**
1. Volg dit document.
2. `python3 tools/check.py` (en `node tools/smoke.cjs` als Playwright er is).
3. Bekijk het op 375px breed, in licht én donker thema.
4. Versie verhogen in `app.js` en `sw.js` (zie CLAUDE.md), committen, pushen.
