# Verbeterpunten Modelleertaal webapp

Analyse van v6.1-grafisch-dev (branch `grafisch-model`), 10 nov 2026. Een lijst met voorstellen,
elk zo beschreven dat het los te bouwen is. Gebouwde punten staan gemarkeerd met "(gebouwd)".

Afwijking bij P1-7: "Download grafiek als SVG" is niet vervangen maar naar "Meer opties"
verhuisd (naast PGFPlot, voor docenten); de PNG-knop staat bij de grafiek.

Afwijkingen bij P2-4/P2-5: de schakelaar staat in de kop van de modelkaart, naast de titel.
Een geselecteerde stroom markeert ook de regel van de toestandsvariabele waarin hij wordt
opgeteld. Bij een constante staan "+ Stroom erin/eruit" nog in het formulier (geen + knopjes).
Het formulier gaat naast het symbool als er onder en boven geen ruimte is.
"Herkende elementen" is op verzoek teruggezet: dichtgeklapt onder de legenda; een klik op een
rij kiest dat element in het diagram.

Afwijkingen bij P2-1: Stap loopt ook binnen `als ... dan` regel voor regel (de voorwaarde is één
stap, daarna de regels die worden uitgevoerd); daarom is één iteratie van `examenvwo2005` 9 stappen
(7 regels en 2 voorwaarden) en niet 13. Het stappen gebruikt een eigen module `stapper.js` in plaats
van de breakpoints van `evaluator.js` (die code blijft staan maar wordt niet meer gebruikt). Stap
stopt na N iteraties. De grafiek blijft tijdens het stappen die van de laatste Run.
Bij P2-2 staat ook een gewijzigd aantal iteraties in de notitie ("iteraties 500 → nu 1000").

## Uitgangspunten (gelden voor elk punt)

- **Geen knoppencursus.** Een leerling uit 5 vwo moet zonder uitleg kunnen werken. Liever een
  knop weghalen dan een knop toevoegen. Nieuwe functies zitten op de plek waar je kijkt
  (in de grafiek, in het diagram, in de editor) en niet in een menu.
- **Uitlegtekst op het scherm is een signaal dat de bediening niet klopt.** Vervang
  instructieregels door zichtbare aanwijzingen (cursor, hover, een knop bij het geselecteerde ding).
- **De tekst van het model blijft de bron.** Examens gebruiken tekstmodellen; het grafische
  model is een tweede kijk op dezelfde tekst.
- **Didactisch doel:** begrijpen hoe een numeriek model stap voor stap rekent (rekenlus, dt),
  modelregels kunnen lezen/aanvullen/aanpassen zoals in het centraal examen, en grafieken
  kunnen interpreteren (aflezen, helling, vergelijken van varianten).

### Voor de bouwer

- Code: ES5, jQuery, Flot, CodeMirror 5; jshint moet schoon blijven (`grunt test`).
- Bron is `modelleertaal-app.js` (+ `autoplot.js`, `grafisch.js`, `grafisch-edit.js`, `evaluator.js`);
  de browser laadt `scripts/modelleertaal-app.browser.js`: na elke wijziging `grunt build`.
- Teksten in de webapp in het Nederlands, commentaar in de code in het Engels.
- Logica zonder DOM in een eigen module met mocha-tests in `test/` (zoals `autoplot.js`).
- Elke wijziging in `CHANGELOG.md` onder `[Unreleased]`.
- Testen in de browser: `python -m http.server` en `index.html` openen; testmodellen:
  `#model=examenvwo2005` (als/dan), `#model=examenvwo2019-2` (puntjes), `#model=examenvwo2014-antwoord` (stop).

## Wat al goed is (niet stukmaken)

- Eén grote Run-knop, Ctrl+Enter, automatische grafieken met miniaturen in (y,x)-notatie.
- Nederlandse foutmeldingen met gemarkeerde regel en "Bedoel je ...?".
- Verouderde resultaten worden grijs en Run licht op na een wijziging.
- Vorige run als grijze lijn. Dit is didactisch het sterkste onderdeel: bouw hierop voort.
- Stap voor stap met de berekening in getallen, en de dt-controle na elke Run.

---

## Prioriteit 1: klein werk, groot effect

### P1-1 Werk niet kwijtraken (automatisch bewaren) (gebouwd)

**Probleem.** Tabblad dicht of Chromebook in slaap: model weg. Er is alleen een
"weet je het zeker"-melding (`beforeunload`).

**Voorstel.** Bewaar bij elke wijziging (debounce 1 s) `{titel, modelregels, startwaarden, N, tijdstip}`
in `localStorage` (één sleutel, alleen als `is_modified()`). Bij het openen zonder `#code=`
in de URL en met een bewaard model jonger dan 30 dagen: toon in `#message` (type info)
"Je was bezig met '<titel>'." met twee knoppen: **Ga verder** en **Weggooien**. Geen instellingen.

**Waar.** `on_model_edited`, `load_model`, `show_message` (uitbreiden met optionele knoppen).
`try/catch` om alle `localStorage`-aanroepen.

**Klaar als.** Model wijzigen, tab sluiten, opnieuw openen, "Ga verder": tekst, titel en N zijn terug.
Na "Sla model op" of "Weggooien" komt de melding niet meer.

### P1-2 Eindtijd tonen bij "Aantal iteraties" (gebouwd)

**Probleem.** Leerlingen denken in tijd ("ik wil 20 s zien"), niet in iteraties. Het verband
N x dt = eindtijd is juist een leerdoel, maar is nu pas na Run te zien in de statusregel.

**Voorstel.** Toon direct achter het invoerveld, live: `x dt = 50 s` (grijs, klein). Bereken uit de
startwaarden (`dt` en `t`; alleen de startwaarden evalueren, zonder het model te draaien).
Geen `dt` gevonden: niets tonen. Geen tweede invoerveld. De eenheid alleen tonen als P2-6 is gebouwd.

**Waar.** Runbalk in `index.html`; nieuwe methode `update_endtime_hint()` aangeroepen vanuit
`on_model_edited`, `init_app` en `input` op `#NBox`.

**Klaar als.** dt = 0,1 en N = 500 toont "x dt = 50"; N of dt veranderen past het direct aan;
syntaxfout in de startwaarden geeft geen foutmelding, alleen geen hint.

### P1-3 Hint als het model niet bij `stop` uitkomt of te vroeg klaar is (gebouwd)

**Probleem.** Staat er een stopconditie in het model en wordt die niet bereikt, dan lijkt de grafiek
"af" terwijl de beweging nog loopt. Leerlingen zien dat niet.

**Voorstel.** Na Run: bevat het model een `stop` en is `evaluator.stopped == false`, voeg toe aan de
statusregel: "Het model is niet gestopt door 'stop': verhoog het aantal iteraties." Maak het woord
"verhoog" een knop die N verdubbelt en opnieuw runt.

**Waar.** `print_run_status`; `stop` zoeken in `evaluator.modelregels_ast`.

**Klaar als.** `examenvwo2014-antwoord` met N = 100 toont de hint; één klik geeft N = 200 en een gestopt model.

### P1-4 Bug: doorrekenen na `stop` (gebouwd)

**Waargenomen.** `examenvwo2019-2-antwoord`: Run stopt na 1018 iteraties. Daarna voegt
"Volgende regel" en "Voeg toe" toch rijen toe (1019, 1020), elk met status "Model gestopt".

**Voorstel.** Is `evaluator.stopped` waar, dan doen `continue_run` en `trace` niets en tonen ze
"Het model is gestopt door 'stop'. Druk op Run om opnieuw te beginnen."

**Klaar als.** Na een gestopte run blijft het aantal rijen gelijk bij beide knoppen. Mocha-test erbij.

### P1-5 Bovenbalk opruimen: titel, bestanden, classic-link (gebouwd)

**Probleem.** Vijf bedieningselementen voor iets wat één naam en één menu is: "Kies model",
"Bestanden…" (klapt een rij open met een bestandsnaamveld), "Deel link", "Pas titel aan ▾"
(klapt elders een veld open). De regel over Modelleertaal classic staat blijvend naast de titel.

**Voorstel.**
1. De titel van het model staat als kop boven de editors en is daar direct te bewerken
   (klik = typen; ziet eruit als tekst, krijgt een rand bij hover/focus). "Pas titel aan" en
   `#titel_rij` verdwijnen.
2. Bestandsnaamvelden weg (`#xml_filename`, `#tsv_filename`, `#svg_filename`, `#pgf_filename`):
   de bestandsnaam wordt afgeleid van de titel (`titel.xml`, `titel.tsv`, ...; tekens die niet in
   een bestandsnaam mogen worden `_`).
3. "Bestanden…" wordt twee gewone knoppen die altijd zichtbaar zijn: **Open** en **Bewaar**.
   `#open_file_dialog` en het aan/uit-profiel daarvoor verdwijnen.
4. "Deel link" toont de bevestiging bij de knop zelf: de knoptekst wordt 2 s "Link gekopieerd ✓"
   (nu staat het ver weg in de statusregel).
5. De classic-link verhuist naar de footer.

**Klaar als.** De bovenbalk bevat: naam webapp, modelkeuze, Open, Bewaar, Deel link. Titel wijzigen
werkt zonder uitklappen en komt in de deellink en de bestandsnaam.

### P1-6 Modelkeuze: eerst eenvoudige voorbeelden, dan examens

**Probleem.** De lijst bevat alleen examenmodellen; "Leeg model" staat onderaan. Er is geen
opbouw voor een leerling die begint met modelleren.

**Voorstel.**
- Groepeer met `<optgroup>`: **Nieuw** (Leeg model), **Voorbeelden**, **Examens** (nieuwste boven).
- Voeg voorbeeldmodellen toe in `modellen/`, oplopend in moeilijkheid, elk met korte commentaarregels
  en SI-eenheden: eenparige beweging; vrije val; val met luchtweerstand; horizontale worp;
  massa-veersysteem (trilling); afkoeling; radioactief verval; ontladen condensator;
  planeetbaan (gravitatie in 2D).
- `model_index` krijgt een veld `group`; `update_models_js.py` vult dat op basis van de bestandsnaam.

**Klaar als.** Elk voorbeeld draait zonder waarschuwing en geeft als eerste automatische grafiek
de voor de hand liggende ((x,t), (u,t), (N,t), (y,x) bij de worp en de planeetbaan).

### P1-7 "Meer opties" opschonen (gebouwd)

**Probleem.** "Knop + invoerveld" waarbij de knop eigenlijk het label is (je moet op het label
klikken om de waarde toe te passen). "Meer/minder knoppen (profiel)" zegt niet wat het doet.
Downloads staan ver van waar ze over gaan.

**Voorstel.**
- Significante cijfers en max. aantal punten: gewoon label + veld, toepassen bij `change`.
- "Meer/minder knoppen (profiel)" wordt een vinkje: "Toon stap-voor-stap en iteraties toevoegen"
  (vervalt als P2-1 is gebouwd).
- **Download tabel** komt als kleine knop rechts in de kop van de tabel; **Download grafiek**
  rechtsonder bij de grafiek en levert een PNG (canvas van Flot) in plaats van een kale SVG-lijn.
  PGFPlot blijft in "Meer opties" (alleen voor docenten).
- Onthoud significante cijfers en "verticale as vanaf 0" in `localStorage`.

---

## Prioriteit 2: de grootste didactische winst

### P2-1 Stap voor stap: de rekenlus zichtbaar maken (vervangt de "Debugger") (gebouwd)

**Probleem.** Regel voor regel door het model lopen is het beste middel om de rekenlus te
begrijpen, maar het zit verstopt in het docentprofiel, heet "Debugger: Volgende regel", gaat na een
Run verder aan het *eind* van de run in plaats van bij het begin, en de status ("Debugger in
iteratie 1.") zegt niet wat er gebeurde.

**Voorstel.** Eén knop **Stap** naast Run, altijd zichtbaar.
- Eerste klik na laden, na een wijziging of na een voltooide run: begin opnieuw bij de startwaarden.
- Elke klik voert één modelregel uit en markeert die regel in de editor (bestaande `mt-trace-line`).
- Onder de runbalk verschijnt één regel met de berekening **met ingevulde getallen**, bijvoorbeeld:
  `iteratie 3, regel 6:  v = v + a*dt  →  v = 0,981 + 9,78 × 0,1 = 1,959`.
  Bij `als ... dan`: `t > 13 → 0,3 > 13 is onwaar: regels 9 overgeslagen`.
- In de tabel licht de cel op die net veranderde; de tabel toont tijdens het stappen de laatste rijen.
- **Run** tijdens het stappen rekent gewoon het hele model opnieuw door (geen aparte "ga door"-knop).
- `Voeg toe: N iteraties` (`#continue_dialog`) vervalt; het profielmechanisme voor deze knoppen ook.

**Waar.** `evaluator.js` heeft al tracing per regel (`set_state(N, new_run, tracing)`,
`breakpoint_at_line`). Nodig: (1) de waarden van vóór de regel bewaren zodat de ingevulde
berekening te maken is; (2) een functie `substitute(ast_node, values)` die een expressie met
ingevulde getallen als tekst teruggeeft, in een eigen module met tests, de opmaak van getallen via
`format_number`; (3) `trace()` in de app aanpassen: opnieuw beginnen als `!this.tracing`.

**Klaar als.** `examenvwo2005`: Run, dan Stap begint bij iteratie 1 regel 2 en toont de berekening
met getallen; 13 keer Stap doorloopt precies één iteratie inclusief de overgeslagen `als`;
typen in de editor beëindigt het stappen.

### P2-2 Vergelijken van runs: laat zien wát er veranderd is (gebouwd)

**Probleem.** De grijze lijn is "de vorige run", maar de leerling moet zelf onthouden wat er
anders was. Systematisch één grootheid variëren is een kernvaardigheid bij modelleren.

**Voorstel.**
- Bepaal bij elke Run het verschil in startwaarden met de vorige run en zet dat in de notitie onder
  de grafiek: "Grijs: vorige run (k = 0,37 → nu 0,50)". Meer dan drie verschillen of gewijzigde
  modelregels: "Grijs: vorige run (model gewijzigd)".
- Naast die notitie één knopje **Houd vast** (speldje): de grijze lijn blijft dan staan als
  referentie bij volgende runs, tot je het speldje weer uitzet. Niet meer dan één referentie.
- Toon de grijze lijn ook bij "meerdere grafieken in één figuur" (nu verdwijnt hij daar).

**Waar.** `run()` (bewaar ook de startwaardentekst in `this.previous`), `do_plot`. Het verschil
bepalen op de geparste startwaarden (naam → tekst van de waarde), los van witruimte en commentaar.

**Klaar als.** k wijzigen en Run toont het verschil in woorden; met "Houd vast" aan blijft dezelfde
grijze lijn staan na drie volgende runs.

### P2-3 Waarschuwing "dt is te groot" (gebouwd)

**Probleem.** De nauwkeurigheid van een numeriek model hangt af van dt (examenstof). Nu komt er
alleen een melding als waarden oneindig worden.

**Voorstel.** Reken na een geslaagde Run op de achtergrond dezelfde simulatie nog eens door met
dt/2 en 2N iteraties. Wijkt de eindwaarde van een toestandsvariabele (integrator volgens
`autoplot.analyse`) meer dan 5% van zijn bereik af, toon dan een melding (type info):
"De uitkomst hangt nog af van de tijdstap: met dt = 0,05 eindigt x op 812 in plaats van 838.
Probeer een kleinere dt." Geen instelling, geen knop. Overslaan als N > 100 000, als er geen `dt`
in de startwaarden staat of als de run langer dan 200 ms duurde.

**Waar.** Nieuwe module `dtcheck.js` (zonder DOM, met tests); aanroepen in `after_run` via `setTimeout`.
Vergelijk op gelijke eindtijd; stopt het model met `stop`, vergelijk dan de eindtijd zelf.

**Klaar als.** `examenvwo2005` met dt = 1 geeft de melding, met dt = 0,01 niet.

### P2-4 Tekst en grafisch model naast elkaar, met onderlinge verwijzing (gebouwd)

**Probleem.** Het grafische model zit dichtgeklapt helemaal onderaan ("Weergave als grafisch
model"). Is het open, dan zijn Run en de grafiek uit beeld: je bewerkt het diagram, scrolt omhoog,
drukt op Run en ziet het diagram niet meer. Het verband tussen symbool en modelregel, het
eigenlijke leerdoel, moet de leerling zelf leggen.

**Voorstel.**
1. Boven de modelkaart een schakelaar met twee standen: **Tekst** | **Tekst + grafisch**.
   In de tweede stand staat het diagram in de linkerkolom boven de editors (zelfde kaart); de
   grafiek blijft rechts staan. Het `<details id="grafisch_model">` onderaan verdwijnt.
   Onthoud de stand in `localStorage`. Op een smal scherm: diagram, editors, grafiek onder elkaar.
2. Selecteer je een symbool, dan worden de bijbehorende regels in de editors gemarkeerd
   (definitie en beginwaarde). Zet je de cursor op een regel, dan licht het bijbehorende symbool op.
3. Zweef je boven een symbool, dan staat de formule in een tooltip (bestaat al): toon na een Run
   ook de begin- en eindwaarde.

**Waar.** `index.html` (indeling `.workspace`), `draw_grafisch_model`, `grafisch_select`. Voor punt 2:
`grafisch.analyse` moet per element de regelnummers teruggeven (AST-knopen hebben `lineNo`);
markeren met `addLineClass` (nieuwe klasse `mt-link-line`); `cursorActivity` van CodeMirror voor de
omgekeerde richting.

**Klaar als.** Op 1400 px breed zijn diagram, tekst, Run en grafiek tegelijk in beeld voor
`examenvwo2005`; klik op kraan `a` markeert regel 5 en 6; cursor op regel 3 laat `Fw` oplichten.

### P2-5 Grafisch model: bediening zonder uitleg (gebouwd)

**Probleem.** Onder de knoppen staat een alinea uitleg ("Klik op een symbool om..., sleep...,
sleep de achtergrond...") en twee uitklappers (Legenda, Herkende elementen): een knoppencursus
in het klein. Het formulier kan onder de rand van de pagina vallen. Variabelenamen in formules
moet je foutloos typen.

**Voorstel.**
- Haal de uitlegalinea weg. In plaats daarvan: symbolen krijgen bij hover een rand; een leeg
  diagram toont de aanwijzing in het tekenvlak zelf (bestaat al).
- Een geselecteerde toestandsvariabele krijgt links en rechts een rond **+**-knopje op de plek
  waar de stroom komt (in plaats van "+ Stroom erin" / "+ Stroom eruit" in het formulier).
- In elk formuleveld staan onder het veld de bestaande variabelen als aanklikbare blokjes; een klik
  voegt de naam in op de cursorpositie. Zo ontstaan relatiepijlen zonder typefouten.
- Formulier: klap naar boven als er onder het symbool geen ruimte is; nooit buiten `#grafisch_view`.
- "Pas toe" vervalt: wijzigingen gaan in bij Enter of bij het verlaten van het veld; ongeldig =
  rode rand met de melding eronder, de tekst van het model blijft dan ongewijzigd.
- De legenda wordt een vaste, kleine strook met de vier symbolen en hun naam onder het diagram
  (rechthoek = toestand, kraan = stroom, cirkel = hulp, ruit = constante). "Herkende elementen"
  vervalt (dezelfde informatie staat in de tekst). "Herstel indeling" en "Download SVG" gaan naar
  de werkbalk rechts, als icoon met `title`.
- Telefoon: start op "Passend" en ondersteun knijpen om te zoomen (nu 50% en onleesbaar).

**Waar.** `grafisch_form`, `grafisch_select`, `grafisch_place_form`, `grafisch.toSVG` (de + knopjes
als SVG-elementen met `data-action`), `index.html`.

**Klaar als.** Een leeg model kan zonder leestekst worden opgebouwd tot val met luchtweerstand
(v, x, a, Fz, Fw, m, k) met alleen klikken en het typen van getallen en operatoren.

### P2-6 Eenheden op de assen en in de tabel

**Probleem.** Assen en tabelkoppen tonen alleen de naam van de variabele. Bij natuurkunde hoort
een grootheid een eenheid te hebben; in een verslag is een grafiek zonder eenheden fout.

**Voorstel.** Geen nieuwe bediening: een eenheid tussen rechte haken in het commentaar achter een
startwaarde wordt herkend, bijvoorbeeld `m = 91 '[kg]` of `v = 0 // [m/s] beginsnelheid`.
Die eenheid komt op de as (`v (m/s)`), in de tabelkop, in de tooltip en in de TSV-kop.
Voor variabelen zonder startwaarde mag hetzelfde in het commentaar achter de modelregel.
Gebruik de notatie in alle voorbeeldmodellen (P1-6) zodat leerlingen het vanzelf overnemen.

**Waar.** Nieuwe functie `units(startwaarden_tekst, modelregels_tekst)` (naam → eenheid) in een
eigen module met tests; gebruiken in `plot_graph`, `table_header`, `create_tsv`,
`create_pgfplot_header` (vervangt daar de vaste tabel, waarin `a` nu ten onrechte m/s is).

**Klaar als.** Een model met `'[m]` en `'[s]` toont "x (m)" en "t (s)"; modellen zonder haken
veranderen niet.

---

## Prioriteit 3: verfijning

### P3-1 Inzoomen in de grafiek

Sleep een rechthoek in de grafiek om in te zoomen (Flot selection-plugin); dubbelklik of de knop
**Hele grafiek**, die alleen zichtbaar is als er is ingezoomd, zet het terug. Op een aanraakscherm
niet inschakelen (botst met scrollen). De cursor is een kruisje boven de grafiek.

### P3-2 Aflezen: punt in de grafiek en rij in de tabel horen bij elkaar

Een klik op een punt toont nu een losse minitabel onder de grafiekinstellingen. Beter: het punt
krijgt een stip met hulplijnen naar beide assen (aflezen zoals op papier) en de tabel springt naar
die rij en markeert hem. Andersom: een klik op een rij in de tabel zet de stip in de grafiek.
`#clickdata` vervalt.

### P3-3 Helling aflezen (raaklijn)

Als P3-2 er is: toon bij het aangeklikte punt in de tooltip ook de helling
(`Δv/Δt = 9,81`), berekend uit de twee buurpunten, en teken een korte raaklijn. Sluit aan op de
examenvaardigheid "bepaal de versnelling uit het (v,t)-diagram". Alleen bij een enkele grafiek.

### P3-4 Assen kiezen op de assen zelf

De keuzelijsten "verticaal" en "horizontaal" staan onder de miniaturen. Zet ze op de plek van de
aslabels (links-midden en onder-midden van de grafiek, vormgegeven als label met een klein
pijltje). "Meerdere grafieken in één figuur" blijft een vinkje; hebben de gekozen grootheden
een bereik dat meer dan een factor 20 verschilt, gebruik dan automatisch een tweede as rechts.

### P3-5 Stille controle tijdens het typen

Controleer 1 s na de laatste toetsaanslag de syntax (alleen parsen). Bij een fout: alleen een rode
stip in de regelnummerkolom met de melding als `title`; geen meldingsbalk en geen cursorsprong.
De volledige melding komt zoals nu bij Run. Regels met `...` zijn geen fout.

### P3-6 Hints bij veelgemaakte modelfouten

Na Run, als informatie (nooit blokkerend), hoogstens één hint tegelijk:
- een startwaarde die nergens wordt gebruikt: "'k' wordt niet gebruikt in de modelregels";
- `dt` bestaat maar `t` wordt niet opgehoogd: "De tijd loopt niet: voeg t = t + dt toe";
- een variabele staat in de startwaarden én wordt in de modelregels overschreven voordat hij
  gebruikt wordt: "De startwaarde van 'a' wordt niet gebruikt".

Logica in een eigen module `hints.js` op de AST, met tests.

### P3-7 Opdracht bij een model (voor docenten)

Een optioneel blok `<opdracht>...</opdracht>` in de XML en een veld `o` in de deellink. Is het
gevuld, dan staat de tekst in een smalle kaart boven het model. Bewerken: in "Meer opties" een
tekstvak "Opdracht bij dit model (gaat mee in Deel link)". Zo kan een docent een model met puntjes
en een vraag in één link delen, zonder aparte handleiding.

### P3-8 Indeling van het diagram bewaren

Versleepte posities (`grafisch_moved`) gaan verloren bij herladen. Neem ze mee in de deellink
(veld `p`) en in de XML (`<indeling>` met JSON), en in het automatisch bewaren van P1-1.

### P3-9 Kleine punten

- `hashchange` met een gewijzigd model negeert de nieuwe link stilzwijgend: vraag net als bij de
  modelkeuze of de wijzigingen weg mogen.
- Tijdens het stappen toont de grafiek één punt met een automatische schaal; toon dan de laatste
  volledige grafiek in grijs met het huidige punt erop.
- `Ctrl+Enter` staat alleen in de `title` van Run: zet het klein en grijs naast de knop op brede
  schermen (de stijl `kbd` bestaat al).
- De melding "Vanaf iteratie 16 heeft 'x' geen geldige waarde meer" stelt drie vragen tegelijk:
  noem eerst de meest waarschijnlijke oorzaak (dt te groot als de waarden eerst snel groeien,
  delen door nul als een noemer in die iteratie 0 is).

---

## Bewust niet doen

- Geen schuifregelaars voor parameters en geen animaties: het wijzigen van een startwaarde in de
  tekst en opnieuw runnen is de handeling die op het examen gevraagd wordt.
- Geen automatisch opnieuw rekenen bij elke toetsaanslag: de Run-knop maakt het moment van
  doorrekenen zichtbaar, en half getypte regels geven anders steeds foutmeldingen.
- Geen instellingenvenster, geen accounts, geen opslag op een server.
- Geen relatiepijlen tekenen met de muis in het grafische model: pijlen volgen uit de formule,
  anders kunnen tekst en diagram elkaar tegenspreken.

## Voorgestelde volgorde

1. P1-4 (bug), P1-1, P1-2, P1-3: los van elkaar, elk klein.
2. P1-5 en P1-7 samen (zelfde HTML).
3. P2-4, daarna P2-5 (bouwt op de nieuwe indeling).
4. P2-1, dan P2-2 en P2-3.
5. P1-6 samen met P2-6 (voorbeelden meteen met eenheden).
6. Prioriteit 3 naar behoefte.
