Didactiek van de Modelleertaal webapp
=====================================

Waarom de webapp werkt zoals hij werkt. Dit document beschrijft de uitgangspunten, het didactische doel
en per onderdeel de overweging erachter. Het is bedoeld voor docenten die de webapp in hun les gebruiken
en voor iedereen die aan de webapp bouwt: past een nieuwe functie niet bij deze uitgangspunten, dan
hoort hij er niet in (of moet dit document eerst veranderen).

De bediening per knop staat in de [README](README.md#webapp); wat er per versie veranderd is in de
[CHANGELOG](CHANGELOG.md).

## Didactisch doel

Een leerling in de bovenbouw (havo/vwo) moet met *natuurkundig modelleren*:

1. **begrijpen hoe een numeriek model rekent:** stap voor stap, in een rekenlus met een tijdstap `dt`;
2. **modelregels kunnen lezen, aanvullen en aanpassen,** zoals in het centraal examen (vaak met puntjes
   `...` die ingevuld moeten worden);
3. **grafieken interpreteren:** aflezen, de helling bepalen en varianten van een model vergelijken.

De webapp is gereedschap voor die drie vaardigheden. Het is geen simulatie om naar te kijken, maar een
plek om modellen te maken, door te rekenen en te onderzoeken.

## Uitgangspunten

### Geen knoppencursus

Een leerling uit 5 vwo moet zonder uitleg kunnen werken. Liever een knop weghalen dan een knop toevoegen.
De aanleiding voor deze webapp was precies dit: in de software op school was het al moeilijk om een
grafiek te maken, laat staan voor leerlingen.

Daarom staan functies **op de plek waar je kijkt**, niet in een menu:

- een punt aflezen doe je door in de grafiek te klikken;
- de grootheid op een as kies je op het aslabel zelf;
- inzoomen doe je door een rechthoek in de grafiek te slepen;
- een stroom toevoegen doe je met een **+** naast de toestandsvariabele in het diagram.

### Uitlegtekst op het scherm is een signaal dat de bediening niet klopt

Staat er een zin als "klik hier om ...", dan is de bediening niet vanzelfsprekend. Vervang zo'n zin door
een zichtbare aanwijzing: een cursor (een kruisje boven de grafiek), een rand bij hover, een knop bij het
geselecteerde ding, een klein pijltje naast een aslabel.

### De tekst van het model is de bron

Examens gebruiken tekstmodellen. Het grafische model (stock-flow diagram) is een **tweede kijk op dezelfde
tekst**: het wordt getekend uit de tekst, en elke wijziging in het diagram is een kleine wijziging in de
tekst. Pijlen in het diagram volgen uit de formules en kunnen niet los getekend worden; zo kunnen tekst
en diagram elkaar nooit tegenspreken.

Ook informatie die bij het model hoort, staat in de tekst en niet in een apart formulier. Een eenheid
schrijf je als commentaar achter de startwaarde (`v = 0 '[m/s]`), zoals je dat op papier ook zou doen.

### Run is een bewust moment

De webapp rekent niet opnieuw bij elke toetsaanslag. De **Run**-knop maakt zichtbaar wanneer het model
wordt doorgerekend, en na een wijziging worden de oude resultaten grijs tot je opnieuw op Run drukt. Zo
blijft het verband tussen "ik verander het model" en "ik zie het effect" een handeling van de leerling.

### Hulp is informatie, geen blokkade

Meldingen helpen, maar houden de leerling niet tegen. Een fout in het model geeft één melding, met de
regel gemarkeerd en een suggestie (*Bedoel je 'Fres'?*). Tips na Run zijn informatie, er staat er
hoogstens één tegelijk, en ze verschijnen alleen als er geen belangrijkere melding is.

## Per onderdeel

### De rekenlus zichtbaar maken: Stap

Regel voor regel door het model lopen is het beste middel om de rekenlus te begrijpen. Bij **Stap** licht
de regel op in de editor en staat de berekening **met ingevulde getallen** onder de runbalk:

```
iteratie 3, regel 6:  v = v + a*dt  →  v = 0,981 + 9,78 × 0,1 = 1,959
```

Bij `als ... dan` zie je de voorwaarde en of hij waar is. In de tabel licht de cel op die net veranderde,
en in de grafiek groeien de punten mee over de grijze lijn van de laatste Run. Zo zie je dat de grafiek
niets anders is dan de tabel, en de tabel niets anders dan de rekenlus, iteratie na iteratie.

### De tijdstap dt

Dat de uitkomst van een numeriek model afhangt van `dt` is examenstof. De webapp maakt dat op drie
manieren zichtbaar, zonder instelling:

- naast het aantal iteraties staat hoe lang het model loopt: `× dt = 50 s`. Het verband
  *N × dt = eindtijd* is een leerdoel; leerlingen denken in tijd ("ik wil 20 s zien"), niet in iteraties;
- na Run rekent de webapp het model op de achtergrond nog eens door met de halve tijdstap. Hangt de
  uitkomst daarvan af, dan meldt hij dat `dt` te groot is, met de twee uitkomsten erbij;
- wordt een waarde ongeldig omdat de getallen steeds groter worden, dan noemt de melding `dt` als
  waarschijnlijke oorzaak.

### Varianten vergelijken: de grijze lijn

Systematisch één grootheid variëren is een kernvaardigheid bij modelleren. De vorige run blijft als
grijze lijn in de grafiek staan, en onder de grafiek staat **wat** er anders is (`k = 0,37 → nu 0,50`).
De leerling hoeft niet te onthouden wat hij veranderde. Met **Houd vast** blijft één run staan als
referentie, zodat je meerdere varianten met dezelfde basis kunt vergelijken.

Er zijn bewust geen schuifregelaars: een startwaarde in de tekst veranderen en opnieuw op Run drukken is
de handeling die het examen vraagt.

### Grafieken lezen: aflezen en helling

Een klik op de grafiek zet een stip met **hulplijnen naar beide assen**, zoals je op papier afleest, en de
tabel springt naar dezelfde rij. Andersom zet een klik op een rij van de tabel de stip in de grafiek.
Grafiek en tabel zijn zo twee kanten van dezelfde gegevens.

### De helling: een raaklijn tot aan de assen, dan Δy/Δx

"Bepaal de versnelling uit het (v,t)-diagram" is een examenvaardigheid met een vaste werkwijze op papier:
teken de raaklijn, maak hem zo lang mogelijk, lees twee punten ver uit elkaar af en reken
`helling = Δy/Δx` uit. De webapp doet het op dezelfde manier, in dezelfde volgorde, en geeft niet alleen
het antwoord:

1. **Klik op een punt** (bij één grafiek): de raaklijn wordt getekend **tot aan de assen**, door de hele
   grafiek. Komt de raaklijn binnen de grafiek een as niet tegen, dan loopt hij tot de rand. De helling
   staat er nog niet bij; het label zegt alleen *klik op de raaklijn voor de helling*. Zo kan de leerling
   eerst zelf aflezen en rekenen.

   ![Een punt aangeklikt: de raaklijn loopt tot aan de assen](images/raaklijn-punt.png)

2. **Klik op de raaklijn:** de twee snijpunten met de assen (of de rand) krijgen een open rondje met hun
   waarden, en het label rekent de helling uit zoals een leerling het opschrijft: als **echte breuk**
   Δy/Δt, met in de teller en de noemer de afgelezen waarden van de twee punten:

   $$\text{helling} = \frac{\Delta y}{\Delta t} = \frac{1{,}5 - 0{,}4127}{0{,}4525 - 0} = 2{,}403\ \text{m/s}$$

   ![Op de raaklijn geklikt: de snijpunten met de assen en de helling uit Δy/Δt](images/raaklijn-helling.png)

   Nog een klik op de raaklijn verbergt de berekening weer.

Waarom zo:

- **De werkwijze is het leerdoel, niet het getal.** Een helling die zomaar naast het punt staat, leert de
  leerling niets over hoe je hem bepaalt. Met de snijpunten en de deling Δy/Δx ziet hij dezelfde stappen
  als op zijn eigen blad, en kan hij zijn eigen raaklijn en aflezing ermee controleren.
- **Twee punten ver uit elkaar.** De snijpunten met de assen liggen zo ver mogelijk uit elkaar: dat geeft
  de nauwkeurigste helling, en het is de gewoonte die we leerlingen willen aanleren. Eén van beide is vaak
  een "mooie" waarde (`t = 0`, `y = 0`).
- **Eerst zelf, dan controleren.** De berekening komt pas na een tweede klik. Zonder die klik ziet de
  leerling alleen de raaklijn, net als in een examenopgave.
- **Een echte breuk, ingevuld.** Δy/Δx staat als breuk, met eronder dezelfde breuk met de afgelezen
  getallen in teller en noemer (`1,5 − 0,4127` boven de streep, `0,4525 − 0` eronder). Zo zie je welk
  punt waar in de formule komt, en de breuk ziet eruit als op papier, niet als een schuine streep van een
  rekenmachine.
- **De eenheid bij de helling.** Achter de uitkomst staat de samengestelde eenheid (`m/s`, `(m/s)/s`):
  de eenheid van de helling volgt uit de eenheden op de assen.

De raaklijn zelf is de lijn door het punt met de helling uit de punten ervoor en erna (centraal verschil).
De raaklijn verandert de assen niet: hij wordt getekend in de grafiek zoals die al was, ook als je
ingezoomd hebt (dan liggen de eindpunten op de rand van het ingezoomde stuk). Bij meerdere grafieken in één
figuur is er geen raaklijn: welke lijn zou het zijn?

### Eenheden

Een grootheid zonder eenheid is in een verslag fout. Een eenheid tussen rechte haken in het commentaar
(`m = 91 '[kg]`) komt op de assen, in de tabel en in de downloads. Er is geen apart veld voor: de
basismodellen gebruiken de notatie, zodat leerlingen hem vanzelf overnemen.

### Automatische grafieken

Na Run kiest de webapp zelf de grafieken die bij het model passen ((x,t), (v,t), de baan (y,x), ...) en
toont ze als miniaturen. Een leerling hoeft niet eerst te weten hoe je een grafiek instelt om te kunnen
kijken; het kiezen van een andere grootheid gebeurt op de as zelf.

### Tekst en grafisch model naast elkaar

Het verband tussen een symbool in het diagram en een regel in de tekst is het eigenlijke leerdoel van het
grafische model. Daarom zijn ze gekoppeld: kies een symbool en de regels ervan lichten op; zet de cursor in
een regel en het symbool licht op. De examenstijl volgt de figuren in de centrale examens, zodat een
leerling op het examen dezelfde symbolen ziet.

### Fouten en veelgemaakte modelfouten

- **Tijdens het typen** controleert de webapp de syntax stil: een rode stip naast de regel, met de
  melding als je erboven staat. Geen meldingsbalk en geen cursorsprong, want een half getypte regel is
  geen fout van de leerling. De volledige melding komt bij Run.
- **Na Run** wijst de webapp hoogstens één veelgemaakte fout aan: de tijd loopt niet (`t = t + dt`
  ontbreekt), een startwaarde wordt nergens gebruikt, of een startwaarde wordt overschreven voordat hij
  gebruikt wordt.
- **Een ongeldige waarde** (delen door nul, de wortel uit een negatief getal, getallen die te groot
  worden) krijgt de meest waarschijnlijke oorzaak, niet drie vragen tegelijk.
- Bevat het model een `stop` die niet bereikt wordt, dan zegt de webapp dat de grafiek nog niet af is en
  biedt hij aan het aantal iteraties te verdubbelen.

### Voor docenten: een opdracht bij het model

Een docent kan in **Meer opties** een opdracht bij het model schrijven ("Vul de puntjes in en bepaal de
eindsnelheid."). Die staat boven het model en gaat mee in **Deel link** en **Bewaar**. Zo deel je een
model met puntjes en een vraag in één link, zonder aparte handleiding, net zoals een examenopgave tekst en
model samen geeft.

### Werk raakt niet kwijt

Een Chromebook die in slaap valt of een tabblad dat dicht gaat mag geen les kosten. Werk dat niet bewaard
is, blijft in de browser staan; bij het volgende bezoek kun je verder. Er zijn geen accounts en er is geen
opslag op een server.

## Bewust niet

- **Geen schuifregelaars en geen animaties.** Een startwaarde in de tekst veranderen en opnieuw runnen is
  de handeling die op het examen gevraagd wordt.
- **Geen automatisch opnieuw rekenen bij elke toetsaanslag.** De Run-knop maakt het moment van doorrekenen
  zichtbaar, en half getypte regels zouden anders steeds foutmeldingen geven.
- **Geen instellingenvenster, geen accounts, geen opslag op een server.**
- **Geen relatiepijlen tekenen met de muis** in het grafische model: pijlen volgen uit de formule, anders
  kunnen tekst en diagram elkaar tegenspreken.
- **Geen eigen schrijfwijze.** *Modelleertaal* volgt de schrijfwijze van lesmethodes en examens
  (CoachTaal), zodat wat een leerling in de webapp leert direct bruikbaar is op het examen.
