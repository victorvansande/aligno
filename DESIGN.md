# Aligno rulebook

De vaste regels voor hoe Aligno eruitziet, aanvoelt en in elkaar zit. Elke nieuwe wijziging volgt dit document, en oude code die ervan afwijkt wordt rechtgezet zodra je ze aanraakt. Wil je iets doen dat hier niet in past, pas dan eerst dit document aan (met een reden), en pas daarna de app.

Alle waarden bestaan als CSS-variabelen (tokens) bovenaan `index.html`. In de CSS gebruik je **altijd de token**, nooit het getal zelf.

---

## 1. Karakter

- **Rustig en precies.** Aligno gaat over exact uitlijnen. De interface is strak, voorspelbaar en zonder versiering.
- **Neutraal, zonder merkkleur.** Grijswaarden doen het werk; het "accent" is grafiet in licht en gebroken wit in donker, zoals de eigen apps van Apple. Een opvallende merkkleur (paars, blauw) oogt al snel als een sjabloon en concurreert met de foto's. Kleur alleen waar ze iets betekent: rood = verwijderen, geel = "Due", groen = uitgelijnd.
- **De foto's zijn de kleur.** De interface mag nooit concurreren met de foto's van de gebruiker.
- **Een app, geen website.** Geen zoom, geen tekstselectie, geen sprongen bij het scrollen. Alles reageert onder je vinger.

## 2. Kleur

| Token | Licht | Donker | Gebruik |
|---|---|---|---|
| `--accent` | #1C1C1E | #F2F2F5 | Primaire knop, actieve staat, schakelaar aan (neutraal: grafiet of gebroken wit) |
| `--accent-strong` | #1C1C1E | #F2F2F5 | Accent als tekst of icoon |
| `--on-accent` | #FFFFFF | #0D0D12 | Tekst en iconen óp een accentvlak (wit in licht, donker in donker) |
| `--accent-soft` | #EFEFF2 | #232329 | Achtergrond van geselecteerde rijen, icoontegels, tips |
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

**Altijd donkere vlakken** (camera, uitlijner, fotoviewer, vergelijken) gebruiken `--ink` (#0B0B10) als basis, wit (`--on-dark`) en `--on-dark-2` (#EDEDF2) als tekst, en `--glass-dark` voor knoppen. Actief op zwart (de actieve modus, de actieve zoomstap, ingeschakelde tools) is een witte pil met donkere tekst of een donker icoon (`--on-dark` met `--ink`), geen kleur. `--accent-on-dark` is wit, voor het scherpstelvierkant en de sluiterring. Daar wisselt het thema niet mee: foto's beoordeel je altijd op zwart.

Regels:
- Eén primaire (grafiet, in donker wit) knop per scherm. Andere acties zijn ghost-knoppen of rijen.
- **Licht is de standaard.** Donker en Auto (volgt de gsm) kies je in Instellingen; die keuze wordt onthouden.
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
- **Kleinere tekst onder een titel staat in een eigen blok** (`display:block`) met zijn eigen regelafstand. Nooit een kleine losse tekst binnen een grotere regel: dan krijgt elke afgebroken regel de afstand van de grotere tekst en ontstaan er gaten in één doorlopende zin. Controle: de afstand tussen twee regels is nooit meer dan 1,7 keer de eigen lettergrootte.
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
- **Twee blokken zonder sectielabel ertussen** (bv. een segment en een kaart) krijgen ook 24px. Blokken raken elkaar nooit. Dit regelt één CSS-regel in sectie 3; een nieuw bloktype voeg je daar toe.
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

- **De bovenbalk zweeft over de inhoud** (materiaal, zoals iOS): bovenaan een pagina is hij onzichtbaar; zodra de inhoud eronder schuift, wordt hij matglas (`backdrop-filter`) dat aan de onderrand zacht wegvloeit. Geen harde scheidingslijn.
- `--sh-1`: rustende kaart (kaarten, ghost-knoppen, tegels).
- `--sh-2`: zwevend (sheets, toasts, update-melding).
- `--sh-accent`: alleen de primaire knop.
- **Kaart** = `--surface` + 1px `--line` + `--sh-1`. **Paneel** = `--surface-2`, geen rand, geen schaduw. Meng die twee niet.
- **Geen gloed**: geen lichtvlekken, gloed of decoratieve verlopen achter logo's, titels of schermen. Schermen hebben een effen `--bg`. Effecten moeten een functie hebben (glas over inhoud, schaduw voor diepte).
- **Glas** (`backdrop-filter`) alleen op dingen die over andere inhoud zweven: sheets, de achtergrond achter sheets, cameraknoppen. Nooit op gewone kaarten.

## 7. Afmetingen en aanraken

| Token | Waarde | Gebruik |
|---|---|---|
| `--h-control` | 52px | Knoppen en invoervelden |
| `--h-row` | 56px | Minimale hoogte van een rij (instellingen, opties) |
| `--h-seg` | 44px | Gesegmenteerde keuzes |
| `--tap` | 44px | Minimale aanraakzone van alles wat tikbaar is |

- **Iconen zonder tekst alleen voor algemeen bekende symbolen** (terug, sluiten, instellingen, delen, meer ⋯, camera wisselen). Al het andere krijgt een woord, bv. de knop "Install" in plaats van een pijltje.
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
- **Navigatie heeft een richting**: dieper gaan (project, export) schuift van rechts in, terug schuift van links in, schermen op hetzelfde niveau vervagen (`DEPTH` in `show()`).
- **Alles wat je sleept, volgt je vinger 1:1 en is een veer bij het loslaten** (`spring()` in app.js, naar Apple's *Designing Fluid Interfaces*): de beweging start waar het ding nu staat, met de snelheid van je vinger (`velocityTracker()`, gemeten over de laatste 80 ms), en gaat naar waar de worp naartoe gaat (`projectThrow()`), niet naar waar je losliet. Standaard zonder doorschieten (damping 1); een klein beetje veren (0.92) alleen na een snelle worp. Nooit vaste CSS-duur of `@keyframes` voor iets dat je met de vinger bedient.
- **Altijd onderbreekbaar**: je kan alles midden in een beweging weer vastpakken en het gaat verder vanaf waar het is. Nooit invoer blokkeren tijdens een animatie.
- **Zachte randen**: voorbij een grens volgt iets steeds minder (`rubberband()`), nooit een harde stop. Sheets omhoog trekken, vegen voorbij de rode knop, de eerste of laatste foto in de viewer.
- **Sheets** schuiven omhoog bij openen en zijn met de vinger naar beneden weg te trekken; de verduistering licht mee op. Een worp die ver genoeg gaat sluit hem (dat telt als Annuleren), anders veert hij terug.
- **Vegen om te verwijderen** werkt zoals iOS Mail: de rode laag ligt achter de hele kaart, de kaart schuift erover weg, het icoon groeit mee met de beweging, een snelle veeg is genoeg, verder trekken voelt weerstand. Na bevestigen schuift de kaart weg en sluit de lijst zich vloeiend.
- **De fotoviewer werkt zoals Foto's**: een foto groeit open uit zijn miniatuur en krimpt er bij sluiten weer in (ruimtelijk consistent: hij gaat weg langs de weg waarlangs hij kwam). Opzij vegen volgt de vinger en de volgende foto neemt de snelheid over; omlaag vegen laat de foto krimpen terwijl het zwart vervaagt, en ver genoeg vliegt hij terug in het raster.
- **Navigatie zoals iOS** (`navSlide()`): een diepere pagina schuift over de volle breedte van rechts in, terwijl de pagina eronder een derde naar links schuift en iets donkerder wordt; terug is exact dezelfde weg omgekeerd. Op een iPhone met Aligno op het beginscherm veeg je vanaf de linkerrand terug, met de vinger mee (in de browser heeft de browser dat gebaar al zelf, en op Android het systeem). Camera en uitlijner blijven vervagen: dat zijn volle-scherm-modi, geen pagina's.- **Een sheet duwt de pagina naar achter**: zolang een sheet open is, krimpt de pagina erachter licht (94%) met afgeronde hoeken op zwart; trek je de sheet omlaag, dan komt de pagina met je vinger mee terug.- **Grote titels**: elke pagina met een titel begint met die naam groot (`--fs-display`, 700) bovenaan de inhoud. Scrolt die weg, dan verschijnt de naam klein en gecentreerd in de glazen balk.
- **Indrukken reageert meteen** (bij aanraken, niet bij loslaten): elke knop, tab, tegel en pil schaalt licht (0.96 tot 0.97).
- **Haptiek** (`haptic()`) alleen op betekenisvolle momenten: foto genomen, een veeg die gaat verwijderen, aftellen, uitgelijnd. Android via de Vibration API; iPhone (iOS 18+) via een verborgen schakelaar, wat alleen werkt tijdens een tik.
- **Een animatie houdt nooit een actie tegen**: als een animatie niet afspeelt (pagina op de achtergrond), gaat de actie na korte tijd toch door. Elke veer heeft daarvoor een vangnet-timer.
- **Minder beweging** (`prefers-reduced-motion`): niets schuift, schaalt of veert meer, maar dingen vervagen nog kort in en uit, zodat je blijft zien wat er veranderde. Veren springen meteen naar het einde.
- **Minder transparantie** (`prefers-reduced-transparency`): glas wordt effen. **Meer contrast** (`prefers-contrast: more`): stevigere lijnen en grijze tekst dichter bij de hoofdtekst.

## 9. Opbouw van een scherm

Elk scherm heeft drie delen, altijd in deze volgorde:
1. **Topbalk**: terugknop links (behalve op Home), titel, maximaal twee iconknoppen rechts.
2. **Inhoud**: scrollt. Begint met de belangrijkste informatie.
3. **Voet**: de acties, onderaan waar je duim zit. **Maximaal één rij knoppen**: de primaire knop breed, hooguit één tweede knop ernaast. Instellingen die je zelden wijzigt (zoals de herinnering) horen in het ⋯-menu.

Camera, uitlijner, viewer en vergelijken zijn volledig donker: sluiten linksboven, de belangrijkste handeling onderaan in het midden.

**Niets over een foto.** Waar een foto groot getoond wordt (fotoviewer, vergelijken, exportvoorbeeld, camera, uitlijner), staan tekst en knoppen op het zwart ernaast: bovenaan een balk, in het midden de foto, onderaan bijschrift en knoppen. De foto krijgt de ruimte die overblijft en wordt nooit bedekt. Pijlen naar vorige/volgende alleen met een muis, naast de foto; op een aanraakscherm veeg je. Vaste uitzonderingen, en alleen deze: in de camera de zoomstappen, de overlay-schuifregelaar, korte meldingen en de live aanwijzing (glas), in de uitlijner het kader en het kruisje, en in kleine miniaturen in een raster een datum op een verloop. Een nieuwe uitzondering moet eerst hier bijgeschreven worden.

Een keuze tussen 2 of 3 opties = segment. Aan/uit = schakelaar. Een lijst acties = rijen in een sheet. Iets definitief verwijderen = altijd een bevestigingssheet met een rode knop die zegt wat er gebeurt ("Delete project", niet "OK").

## 10. Componenten

| Component | Klasse | Specificatie |
|---|---|---|
| Primaire knop | `.btn.primary` | 52px hoog, `--r-md`, `--accent`, tekst `--on-accent`, `--fs-control` |
| Ghost-knop | `.btn.ghost` | Zelfde maat, `--surface`, rand `--line-strong`, `--sh-1` |
| Verwijderknop | `.btn.danger` | Zelfde maat, `--danger`, wit |
| Iconknop | `.tbtn`, `.backbtn` | 44×44 aanraakzone, icoon 22px, geen achtergrond |
| Kaart | `.pcard` | `--r-lg`, 12px binnenmarge, kaartstijl uit §6 |
| Rij | `.set-row` | min. 56px, `--r-md`, icoon 20px in `--accent-strong`, chevron in `--text-3` |
| Optie | `.optrow` | Als rij; geselecteerd = rand `--accent` + `--accent-soft` |
| Segment | `.seg` / `.cam-seg` | 44px, `--r-md`, 4px binnenmarge, knoppen `--r-sm` |
| Schakelaar | `.tgl` | 46×28, aan = `--accent` |
| Invoerveld | `.field` | 52px, `--r-md`, rand `--line-strong`, focus = rand `--accent` + zachte ring |
| Veldlabel | `.field-lbl` | `--fs-label` 600 in `--text-2`, 8px boven het veld. **Elk invoerveld heeft een zichtbaar label**; de placeholder toont alleen een voorbeeld ("e.g. ..."). Uitzondering: een sheet waarvan de titel het veld al benoemt (Rename project, Photo date). |
| Sheet | `.modal-bg > .sheet` | Glas, `--r-xl` bovenaan, 20px marge, grijplijntje, titel `--fs-title` |
| Paneel | `.panel` | `--surface-2`, `--r-lg`, 16px marge |
| Sectielabel | `.sectlbl` | `--fs-label`, 600, `--text-3` |
| Lege staat | `.empty` | Icoon of illustratie, titel `--fs-headline`, uitleg `--fs-sub`, eventueel één ghost-knop |
| Toast | `.toast` | Pil, `--pill-bg`, onderaan, verdwijnt na 2,6 s |
| Badge "Due" | `.duechip` | Pil, `--fs-micro`, gele tokens |
| Melding | `.notice` | Paneel in `--accent-soft`, `--r-lg`, icoon, vette titel + uitleg, en een knop die het oplost (bv. "Take photo") |
| Zoomstappen | `.zoom-stops` | Glazen pil onderaan in de zoeker, knoppen 36px, actieve stap = witte pil met donkere tekst (zie §14) |
| Modustabs | `.mode-tabs` | Tekstknoppen `--fs-body` 600, actief = witte pil met donkere tekst |
| Tip | `.hint` | Glazen vlak met tekst `--fs-sub` en een ×, een tik sluit hem voorgoed (zie §16) |
| Feedback | `.cbadge` | Donkere glazen pil bovenaan de zoeker, verdwijnt na 2,4 s |

**Uitgeschakeld** ziet er altijd zo uit: grijs (`.is-disabled`: 40% dekking, niet aanraakbaar), en er staat **bovenaan** een `.notice` die zegt waarom en hoe je het oplost. Nooit alleen een grijze knop zonder uitleg, en nooit uitleg in kleine grijze tekst onder iets anders.

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
- **Installeren**: biedt de browser een eigen installatievenster (Chrome en Edge op Android en computer), dan gebruiken we dat. Anders toont de installknop stappen voor die specifieke browser en dat systeem (Safari, Chrome, Firefox, Edge op iPhone; Chrome, Samsung Internet, Firefox, Edge op Android; Chrome, Edge, Safari op computer; apps zoals Instagram: eerst openen in de browser). Kan een browser niet installeren, dan geen installknop. Nieuwe browser of gewijzigde menu's: `installGuide()` in `app.js` aanpassen.

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
- **Updates**: de service worker haalt de eigen code (pagina, `app.js`, manifest) altijd eerst van het netwerk en valt pas offline terug op de cache. Een nieuwe versie neemt het vanzelf over: herladen als je gewoon aan het rondkijken bent, anders de pil "Update ready".

**Elke wijziging**
1. Volg dit document.
2. `python3 tools/check.py` (en `node tools/smoke.cjs` als Playwright er is).
3. Bekijk het op 375px breed, in licht én donker thema.
4. Versie verhogen in `app.js` en `sw.js` (zie CLAUDE.md), committen, pushen.

## 14. Camera en zoeker

- **Opbouw, van boven naar onder**: zwarte balk met sluiten (links), projectnaam (midden, klein en in `--on-dark-2`: het is context, geen titel) en maximaal vier tools als losse iconen, altijd in deze volgorde: flits, raster, zelfontspanner, galerij. Dan de **zoeker in 3:4, altijd over de volle breedte** (nooit zwarte randen links en rechts). Op de onderrand van het beeld: de zoomstappen en de schuifregelaar voor de overlay (glazen pillen). Onder het beeld: de modustabs (Fade, Edges, Blend) en de bedieningsrij (laatste foto links, sluiter in het midden, camera wisselen rechts). Uitleg over een modus is een kort bericht bovenaan het beeld, geen extra rij.
- **De standaard van elke camera-app** (`layoutCamera()`): toolbalk bovenaan, direct daaronder het 3:4-beeld, onderaan op zwart de modustabs en de sluiterrij. **De sluiter, de modes en de toolbalk liggen nooit op het beeld**; alleen de zoomstappen en de overlay-schuifregelaar liggen op de onderrand ervan. Het beeld is over de volle breedte zodra het scherm hoog genoeg is; is het dat niet (browser met werkbalken), dan wordt het beeld smaller (met afgeronde hoeken) en de sluiterrij iets compacter, nooit bedekt. Meet de zichtbare hoogte (`100dvh`), niet de hoogte achter de werkbalken.
- **Op Android in de browser** gaat de camera vanzelf schermvullend (werkbalken weg). iPhone-browsers laten dat niet toe; daar geeft "Add to Home Screen" de schermvullende camera.
- **Het live beeld**: de camera wordt in 4:3 gevraagd, dezelfde vorm als de zoeker. Heeft de stream die vorm, dan toont de app de `<video>` zelf (volle beeldsnelheid; past exact, wat iOS ook doet met `object-fit`). Levert een camera een andere vorm, dan tekent een canvas elk beeld met exact de foto-uitsnede (`viewCrop()`), zodat niets ooit uitgerekt of met randen verschijnt. Het canvas houdt ook het laatste beeld vast (wazig) tijdens het wisselen. Teken nooit standaard elk beeld via canvas: dat is te zwaar op iPhone en geeft een schokkerig beeld.
- **De camera wordt in 4:3 gevraagd** (de vorm van de sensor, rond 1920×1440: groot genoeg en vloeiend; de allerhoogste resoluties geven op sommige toestellen een lage beeldsnelheid), zodat 1× het volledige beeldveld toont zoals de toestelcamera. 16:9 zou de sensor bijsnijden.
- **Elke wijziging aan de camera wordt getest** met nepcamera's in 9:16, 3:4, 16:9 en 4:3: cirkel blijft rond en in het midden, zoeker volledig gevuld, zoeker = bewaarde foto, frontcamera gespiegeld in de zoeker maar niet in de foto.
- **Wat je ziet is wat je bewaart.** De foto wordt exact zo bijgesneden als de zoeker hem toont (3:4, plus eventuele digitale zoom). Raster, waterpas en overlay liggen in de zoeker, niet over de knoppen.
- **Zoom gaat met vaste stappen**: 0.5×, 1×, 2×, 3×, 5×, 10×, voor zover het toestel ze kan. Geen schuifregelaar. Knijpen in de zoeker mag voor tussenwaarden; dicht bij een stap klikt de zoom erop vast (binnen 4%). De actieve stap toont de exacte waarde (bv. 2.4×).
- **Herhaalbaarheid gaat voor alles**: elke foto bewaart zijn zoom, de camera opent op de zoom van de vorige foto, en zodra je daarvan afwijkt verschijnt een knop met die waarde om met één tik terug te keren.
- **0.5× (ultragroothoek)**: als het toestel tot 0.5 kan zoomen, gewoon als stap. Heeft het een aparte ultragroothoeklens (iPhone: "Back Ultra Wide Camera"), dan wisselt de app van lens onder 0.75×. Geen van beide: geen 0.5-stap, nooit een nep-0.5.
- Geen optische zoom beschikbaar: dezelfde stappen als digitale uitsnede, in de zoeker én de bewaarde foto.
- **Opstarten en wisselen zoals een echte camera**: de zoeker blijft zwart tot het eerste beeld klaar is en het beeld vervaagt dan in; bij wisselen van camera of lens vervaagt (blur) het laatste beeld tot het nieuwe er is. Nooit een flits van een verkeerd geschaald beeld.
- **Echte lenzen, geen uitsnede**: heeft een toestel een gecombineerde camera (iPhone: "Back Triple Camera", "Back Dual Wide Camera", "Back Dual Camera"), dan gebruikt de app die. Zoomen daarop laat het toestel zelf wisselen naar de echte ultragroothoek-, hoofd- of telelens, net als de eigen camera-app. Safari en Chrome geven de zoom al in de vertrouwde getallen (1 = hoofdlens, ultragroothoek = 0.5): die worden zo gebruikt. Alleen als een gecombineerde camera bij 1 begint terwijl hij een ultragroothoek heeft, rekent `zoom.scale` om (1 = 0.5×). Test dit altijd met beide varianten van nepcamera. De camera opent altijd op 1×. Werkt die camera niet (geen zoom, weigert te starten), dan valt de app stil terug op de gewone hoofdcamera. Een digitale uitsnede alleen als er geen echte lens voor die stap is.
- **Tik om scherp te stellen en te belichten** waar de browser dat toelaat (Chrome op Android): een wit vierkantje op de plek van de tik; scherpte en belichting gaan naar dat punt. Kan de camera ook belichting bijstellen, dan staat er een zonnetje met de waarde naast het vierkantje en maak je het beeld lichter of donkerder door op het beeld omhoog of omlaag te slepen (zoals op iPhone). Een nieuwe tik zet de belichting terug op 0.
- **Flits**: achteraan de lamp van het toestel (waar de browser die laat schakelen: Chrome op Android, Safari vanaf iOS 18), met Uit, Auto, Aan en Lamp (blijft branden, om in het donker uit te lijnen). Vooraan licht het scherm warm wit op tijdens de foto. Auto flitst als het beeld donker is. De keuze wordt per camera onthouden.
- **Volle resolutie waar het kan**: in Chrome op Android neemt de app een echte foto op volle sensorgrootte (tot 4096 px, `ImageCapture.takePhoto()`), met de echte flits als het toestel er een heeft. Safari kan dat niet; daar wordt een beeld uit de live video bewaard. Is de foto traag, anders gedraaid of niet groter dan de video, dan valt de app stil terug op het videobeeld. Dezelfde uitsnede als de zoeker blijft gelden.
- **Uitlijnscore in de sluiterring**: zolang er een vorige foto is, vullen twee metingen de ring: een snelle vergelijking van het hele beeld (helderheid en randen op 36×48, genormaliseerd, geen AI; alleen hoog als je al heel dicht zit) en de meting van de live aanwijzing (§18), die zegt hoe ver je ernaast staat en dus geleidelijk oploopt terwijl je dichterbij komt, ook bij ander licht. De hoogste telt, en elk van beide kan hem groen maken. De ring vult zich naarmate het beter past; zonder (geladen) vorige foto toont hij niets in plaats van een oud getal en wordt `--level-ok` groen zodra het past, met een korte tril. De melding "Lined up with your last photo" komt maximaal één keer per cameragebruik. In de sluiter zelf staat het percentage (bv. 72%) en een vinkje in `--level-ok-ink` zodra het past, zodat de ring zichzelf uitlegt; de eerste twee keer zegt een korte melding ook wat de ring betekent. Geen extra balken of cijfers op het beeld.
- **Live aanwijzing ("Step back", "Move left", "Tilt right", "Tilt up")**: één glazen pil bovenaan het beeld, met pijl, één ding tegelijk (de grootste afwijking eerst). Twee bronnen: de **bewegingssensor** (hoe de gsm gekanteld stond bij de vorige foto, bewaard als `tilt` bij elke foto) voor "Tilt left/right" en "Tilt up/down", en het **beeld** (zie §18) voor afstand, opzij en omhoog/omlaag. De sensor is een feit en werkt op elke scène; het beeld spreekt alleen als de meting zeker is. Klopt de kanteling volgens de sensor, dan betekent omhoog/omlaag echt de gsm verplaatsen ("Move up"); klopt ze niet, dan zegt de app "Tilt up/down". Een advies verschijnt pas als het twee keer na elkaar hetzelfde is, en verdwijnt zodra de sluiterring groen is of zolang een andere melding staat. Bij twijfel zegt ze niets: liever stil dan fout. Links en rechts gelden zoals je het scherm ziet, ook bij de gespiegelde frontcamera. Tikken verbergt ze tot de camera opnieuw opent. Op iPhone vraagt de app de bewegingssensor bij het openen van de camera; een weigering wordt onthouden en nooit opnieuw gevraagd.
- **Alleen tonen wat werkt**: elke camerafunctie (flits, tik om scherp te stellen, belichting, 0.5×) wordt per camera en lens getest via `getCapabilities()`. Kan het niet, dan is de knop of het vierkantje er niet: nooit iets tonen dat niets doet.
- Toolstatus (raster aan, flits aan, timer 3 s) zie je aan een witte cirkel achter het icoon en een korte feedbackpil, niet aan extra tekstlabels.

## 15. Illustraties

- Alle voorbeeldtekeningen komen uit dezelfde set functies in `app.js` (`plantIll`, `buildIll`, `personIll`, `moonIll`) en volgen één stijl.
- **Raster 40×40**, platte vormen, geen omlijningen behalve dunne details (≤ 1px), geen verlopen met id's (die botsen als dezelfde tekening twee keer op een pagina staat).
- **Elk onderwerp heeft één pastelachtergrond** (plant groen #EAF3EC, gebouw lucht #E4EEF9, kind roze #FBF0F3, maan nacht #1D2447) en een grond- of tafelstrook onderaan met een zachte schaduw onder het onderwerp.
- **Licht van linksboven**: de linkerkant van een vorm is iets lichter, de rechterkant iets donkerder.
- **Het onderwerp staat in elk frame op exact dezelfde plek.** Alleen de verandering beweegt (de plant groeit, het huis wordt gebouwd, de maan neemt toe). Zo leggen de tekeningen meteen uit wat Aligno doet.
- Een reeks is altijd drie frames met een `›` ertussen.
- Een nieuw voorbeeld: nieuwe functie in dezelfde stijl, toevoegen aan `EXAMPLES`, en dit lijstje kleuren aanvullen.

## 16. Tips, meldingen en pop-ups

- **Nooit vanzelf een sheet of venster openen**, behalve een bevestiging die de gebruiker zelf uitlokte (verwijderen, herstellen). Uitleg staat in Instellingen ("How aligning works") en op de startpagina.
- **Maximaal één tip tegelijk**, en nooit over knoppen of over het midden van de zoeker. Tips staan bovenaan: in de uitlijner onder de topbalk, in de camera bovenaan de zoeker.
- **Een tip verdwijnt met één tik en komt daarna nooit meer terug** (onthouden in `localStorage`, sleutel `aligno_hint_*`).
- De uitlegregel onder de modustabs verschijnt bij de eerste drie bezoeken en bij elke moduswissel, en vervaagt na 4 seconden.
- **Feedback na een actie** (foto bewaard, zoom hersteld, raster aan) is een korte pil die na 2,4 s verdwijnt. Geen knop, geen tekst van meer dan één zin.
- **Een melding wordt nooit afgekapt** (geen "..."). Mik op één regel (ongeveer 40 tekens op een gsm van 375 px breed); past het niet, dan loopt ze netjes over op een tweede regel (`text-wrap: balance`, afgeronde rechthoek `--r-lg`). Meer dan twee regels: korter schrijven.
- **Toasts** onderaan voor resultaten buiten de camera (back-up klaar, datum aangepast). Fouten zeggen wat er misging en wat je kan doen.
- Twijfel je of iets een melding verdient? Dan niet. Liever één scherm minder dan één onderbreking meer.

## 17. App-icoon

- **Eén ontwerp**: het Aligno-teken. Twee kaders: de vorige foto als spookkader (lijn, licht gevuld) linksboven, de nieuwe foto als effen wit kader erover, met een **pijl die naar het spookkader wijst**: schuif je nieuwe foto op de vorige. Geen plus (die leest als "toevoegen"). Wit op vlak grafiet met hooguit een nauwelijks zichtbaar verloop (#2A2A2D → #1C1C1E). **Geen gloed, lichtvlek of schaduw**: het systeem (Liquid Glass op iOS, Material op Android) legt zelf zijn effecten erover. Het in-app-logo (startpagina en kop van Home) is hetzelfde teken.
- **Bronbestanden** staan in `icons/src/` (`icon-full.svg`, `icon-rounded.svg`, `icon-mono.svg`, `icon-small.svg`). Een wijziging aan het icoon gebeurt daar, daarna `powershell -ExecutionPolicy Bypass -File icons/src/export.ps1` (Windows). Nooit losse PNG's met de hand aanpassen.
- **Varianten en waarvoor**:
  - `apple-touch-icon.png` 180 px, ondoorzichtig, volle vlak: iPhone/iPad-beginscherm. iOS rondt zelf af en legt zelf het glaseffect erover (Liquid Glass), en maakt er in de modi **Getint** en **Helder** zelf een grijswaardenversie van. Daarom: één eenvoudig teken met veel contrast (wit op bijna zwart), geen fijne details of kleurverschillen die dan wegvallen.
  - `icon-192/512-maskable.png`, volle vlak: Android, dat er zelf een vorm uit snijdt (cirkel, squircle, afgeronde rechthoek, druppel). Het teken blijft binnen de veilige zone (cirkel met straal 40% van het midden).
  - `icon-monochrome.png`, wit op transparant: Android-thema-iconen (de launcher kleurt het in met de kleuren van de achtergrond) en het meldingsicoontje. De pijl is er uitgesneden, zodat hij in elke themakleur leesbaar blijft.
  - `icon-192/512.png`: in de vorm van een app-icoon, een **squircle** (superellips met exponent 5,2), op 94% van het vlak met wat transparante ruimte rond. Voor computers, Chrome en splash screens.
  - `icon.svg`, `favicon-32.png` en `favicon-16.png` komen uit `icon-small.svg`: hetzelfde teken, groter in het vlak en met zwaardere lijnen en pijl, zodat het op 16 tot 32 px in een browsertabblad scherp en leesbaar blijft.
- **Een nieuw icoon testen**: `tools/icon-preview.html` (op localhost) toont elke variant zoals het platform hem toont: iOS standaard, donker, getint en helder; Android in alle vormen en als thema-icoon in lichte en donkere kleuren; en het tabblad op 16 en 32 px, op licht en donker.

## 18. Uitlijnen meten (Stabilize en live aanwijzing)

- **Eén rekenkern** (`align-worker.js`, een Web Worker zodat de camera vloeiend blijft) meet hoeveel een beeld verschoven, gedraaid en geschaald is ten opzichte van een ander. Hij werkt op de sterkte van randen in grijswaarden (32, 64 en 128 px breed), zodat licht en kleur weinig uitmaken. Geen AI.
- **Zeker of niets** (`certain()` in app.js): genoeg detail in beide beelden, de beste oplossing duidelijk beter dan elke echt andere (gemeten aan waar de hoeken van het beeld uitkomen, zodat herhalende patronen wegvallen), niet tegen de rand van het zoekgebied, een goede pasvorm, en beter dan niets doen. Voldoet een meting niet, dan doet de app niets met die meting.
- **Stabilize in Export** (schakelaar, standaard uit): elke foto wordt gemeten tegen de eerste; lukt dat niet zeker, tegen de laatst uitgelijnde. Bij het meten tellen de 20% pixels die het slechtst passen niet mee (wat echt veranderde, zoals het onderwerp of een verschoven kast, trekt de uitlijning zo niet mee), en een iets andere kanteling van de gsm (perspectief) wordt rechtgezet, alleen als dat duidelijk beter past. Twijfelgevallen en foto's die meer dan 20% bijsnijden zouden vragen, blijven zoals genomen, en de uitleg onder de schakelaar zegt hoeveel. De uitvoer wordt gecentreerd op de typische positie van de reeks en net zoveel bijgesneden dat geen foto een lege rand toont. De foto's zelf veranderen nooit.
- **Testen**: `tools/align-test.js` (laden in de app op localhost) bouwt een testscène met bekende verschuiving, draaiing en schaal, ruis, ander licht en een groeiende plant, plus een blanco muur, tegels en een andere plek. Elke wijziging aan de rekenkern of de drempels wordt daarmee nagemeten: echte gevallen zeker en juist (afwijking onder 0.3%), de drie twijfelgevallen onzeker.
