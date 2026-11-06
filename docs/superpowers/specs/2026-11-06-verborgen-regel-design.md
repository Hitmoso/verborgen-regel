# Verborgen Regel: ontwerp (werktitel)

Datum: 2026-11-06
Status: concept, wacht op review

## 1. Doel en uitgangspunten

Een dagelijkse puzzel in de richting van Wordle of Fermi. Elke dag geldt voor iedereen één geheime regel. De speler test items, leidt de regel af en bewijst dat in een eindtoets.

Dit is wat is afgesproken:

- **Doel**: een experiment dat online komt, voor een klein publiek (geen duizenden spelers).
- **Techniek**: statische site, zonder server en zonder accounts. De puzzel volgt uit de datum.
- **Taal**: alleen Nederlands. De structuur moet een tweede taal later mogelijk maken (teksten staan in data, niet vastgelegd in code).
- **Aanpasbaar**: de eigenaar wil dingen later veranderen. Daarom is het gokken een uitwisselbaar onderdeel (zie 4.5).
- **Niet in scope nu**: vrije-tekst-gokken, accounts, ranglijsten, server, tweede taal.

## 2. Spelregels

1. **Start**: de speler ziet "Puzzel #N" met de datum, 3 items die voldoen aan de regel (✅) en 3 die niet voldoen (❌).
2. **Testen**: de speler kiest uit een zoekbare lijst van alle items. Een test geeft direct ✅ of ❌. Er zijn **10 tests**. Eerdere tests staan in twee kolommen.
3. **Eindtoets**: op elk moment (of als de tests op zijn) start de speler de eindtoets. Die toont **8 nieuwe items** (4 die voldoen, 4 die niet voldoen, door elkaar) die nog niet eerder getoond zijn (niet bij de voorbeelden, niet bij de tests). De speler zegt per item "past" of "past niet". Eén inzending, geen herkansing.
4. **Resultaat**: de regel wordt onthuld, met score, streak en een aftelling naar de volgende puzzel. Een deelbaar emoji-resultaat kan worden gekopieerd.

**Score**: elke overgebleven test telt mee, plus de eindtoets. Elk fout beoordeeld item kost punten. Een perfecte eindtoets met weinig tests scoort het hoogst. De exacte puntenwaarden staan als constanten op één plek in de code, zodat ze makkelijk zijn bij te stellen.

**Dagwissel**: de dag wisselt om middernacht Nederlandse tijd (Europe/Amsterdam).

**Bewaren**: het spel gaat door als de pagina wordt gesloten. Een voltooide dag blijft afgesloten (localStorage). Een kapotte opgeslagen voortgang wordt genegeerd en het spel begint opnieuw.

## 3. Regels en inhoud

**Eigenschap**: een kenmerk met een Nederlandse tekst, bijvoorbeeld "kan zwemmen" of "is groter dan een koelkast". Het begin is ongeveer 30 eigenschappen.

**Item**: een voorwerp, dier of plaats met een waar/onwaar-waarde voor elke eigenschap. Het begin is ongeveer 150 items, door mij aangemaakt en volledig gelabeld. De eigenaar loopt ze na en past aan via het portaal.

**Regel**: een kleine boom van eigenschappen:
- één eigenschap (`prop`),
- ontkenning (`not`),
- combinatie met "en" (`and`).

Eén functie `evaluate(regel, item)` bepaalt of een item voldoet. Dit is de enige plek met die logica.

## 4. Architectuur (Vite + TypeScript, geen zwaar framework)

### 4.1 Data
Eigenschappen en items staan in gewone databestanden. Een tweede taal kan later in een apart tekstbestand.

### 4.2 Regels
Typen en `evaluate`, plus een functie om een regel als leesbare Nederlandse zin weer te geven.

### 4.3 Generator
Bepaalt uit de datum (vaste seed, dus iedereen krijgt dezelfde puzzel) de regel van die dag.
- **Willekeurig**: er is geen opbouw van makkelijk naar pittig. De generator kiest uit alle regels die aan de eerlijkheidsfilters voldoen.
- **Eerlijkheidsfilters** (een regel wordt geweigerd als):
  - minder dan 17 items voldoen, of minder dan 17 items niet voldoen (3 voorbeelden + 10 tests + 4 eindtoetsitems per kant, zodat de eindtoets altijd gevuld kan worden, ook als de speler alle tests aan één kant besteedt);
  - een ander, even simpel of simpeler regel (minder of evenveel eigenschappen) precies dezelfde uitkomst geeft over alle items (dubbelzinnig; zo wordt "is een dier en is levend" geweigerd ten gunste van "is een dier");
  - dezelfde regel is gebruikt in de laatste 14 dagen.
- **Handmatige overrides**: een bestand koppelt een datum aan een eigen regel. Die gaat voor op de generator. Een override moet ook door de eerlijkheidscontrole, anders waarschuwt het portaal.
- **Moeilijkheidsindicatie**: een schatting per regel (bijvoorbeeld op basis van het aandeel dat voldoet en het aantal onderdelen). Die wordt alleen in het portaal getoond, niet aan spelers.

### 4.4 Spel
Een kleine toestandsmachine: start, testen, eindtoets, resultaat. Pure logica, los van het scherm, zodat het goed te testen is. Zij kiest de 3+3 voorbeelden en de 8 toetsitems (eerlijke verdeling van voldoen en niet voldoen, nooit eerder getoond).

### 4.5 Gok-interface
Het gokken is een los onderdeel met een vaste interface: het krijgt de puzzel en levert een uitkomst (goed, fout, score). De eindtoets is de eerste en enige implementatie. Een latere variant (bijvoorbeeld tekstgok met hybride kiezen uit de dichtstbijzijnde regel) kan worden toegevoegd zonder de rest te wijzigen.

### 4.6 Scherm en delen
Eén pagina, geschikt voor mobiel. Een emoji-resultaat om te delen, bijvoorbeeld `Regel #42 🔍🔍🔍⬜⬜⬜⬜⬜⬜⬜ 8/8 ✅`.

### 4.7 Developerportaal (alleen lokaal)
- Draait alleen met de lokale ontwikkelserver (Vite dev) en zit **niet** in de gepubliceerde build.
- Kan een datum kiezen, een regel bouwen (keuzelijsten voor eigenschappen, "niet" en "en"), de puzzel van die dag bekijken en de moeilijkheidsindicatie zien.
- Kan items en eigenschappen toevoegen en wijzigen.
- Slaat direct op in de databestanden (via een kleine dev-plugin). Daarna publiceert de eigenaar de site opnieuw.
- Waarschuwt bij een regel die de eerlijkheidsfilters niet haalt, en slaat die niet op.

## 5. Tests

Automatische tests voor:
- `evaluate` met alle regeltypen (eigenschap, niet, en);
- generator: dezelfde datum geeft altijd dezelfde puzzel, en over 1000 dagen is elke puzzel eerlijk;
- spel: de 8 toetsitems zijn nooit eerder getoond, en de verdeling klopt;
- scoreberekening;
- dagwissel in tijdzone Europe/Amsterdam;
- omgaan met kapotte opgeslagen voortgang.

## 6. Open punten (later te kiezen)

- Naam van het spel.
- Visuele stijl.
- Waar de site online komt (bijvoorbeeld Netlify of GitHub Pages).
- Exacte puntenwaarden van de score.
