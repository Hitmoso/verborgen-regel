# Verborgen Regel

Een dagelijkse Nederlandse puzzel. Elke dag hoort er één verborgen regel bij (bijvoorbeeld "groter dan een mens"). Je test voorwerpen en dieren tegen die regel, krijgt voorbeelden te zien en probeert de regel daarna te raden in een korte overhoring. Het is een statische site (Vite + TypeScript) zonder server.

## Aan de slag

```
npm install
npm run dev      # lokale ontwikkelserver
npm test         # alle tests (Vitest)
npm run build    # typecheck + productiebuild naar dist/
```

## Het portaal

Het portaal is een lokaal hulpmiddel om items, eigenschappen en dagpuzzels te beheren. Het werkt alleen onder `npm run dev`:

`http://localhost:5173/portal/index.html`

- Wijzigingen worden opgeslagen via `POST /__portal/save` in `src/data/items.json`, `properties.json` en `overrides.json`.
- De gekozen datum staat in de URL-hash (bijvoorbeeld `#2026-12-01`).
  Het datumbereik loopt van `EPOCH` tot 10 jaar daarna; ongeldige datums worden genegeerd.
- Het portaal waarschuwt (zonder te blokkeren) als een opgeslagen override ongeldig is geworden, of als de regel in de bouwer al in de afgelopen `RECENT_DAYS` dagen de puzzel was.
- Pas je `tools/portalPlugin.ts` aan, herstart dan de dev-server.
- Het portaal zit niet in de productiebuild; dat wordt gecontroleerd door `tests/build.test.ts`.

## Vóór publicatie: EPOCH

`EPOCH` in `src/config.ts` (nu `'2026-11-07'`) is de datum van puzzel #1. Stel die in voordat je publiceert. Datums vóór `EPOCH` tonen puzzel #1. De dag wisselt om middernacht in Europe/Amsterdam.

## Let op: data aanpassen na publicatie

De generator kiest de puzzel uit de pool van eerlijke regels. Verander je daarna items of eigenschappen, dan verschuiven toekomstige puzzels en mogelijk ook die van vandaag. Wil je een dag vastzetten, maak dan in het portaal een override voor die datum.

## Dataconventies

- Labels kloppen alleen voor het typische voorbeeld.
- Elk item is `in_huis` en/of `buiten`.
- Bij dieren betekent `in_nederland`: wild, boerderij- of huisdier in Nederland (dieren die alleen in een dierentuin voorkomen: onwaar).
- `eetbaar` bij dieren betekent: gewoonlijk gegeten in Nederland.
- `tests/data.test.ts` bewaakt de regels: minstens 150 items, 30 eigenschappen, precies één categorie per item, enzovoort.

## Instellingen

- Scorewaarden staan alleen in `src/game/score.ts`.
- Overige constanten (`TEST_BUDGET`, `EXAM_SIZE`, `MIN_SIDE`, enz.) staan in `src/config.ts`.

## Een andere GuessMethod toevoegen

De overhoring loopt via de interface `GuessMethod` in `src/game/guess.ts` (`id`, `prepare`, `judge`). `examGuess` is nu de enige implementatie. Een nieuwe methode:

1. Schrijf een object dat `GuessMethod` implementeert, in de stijl van `examGuess`.
2. Geef het als optioneel laatste argument mee aan `startExam` / `submitExam` in `src/game/game.ts`.
3. Koppel het in `src/main.ts`.

## Publiceren

Draai `npm run build` en upload de map `dist/` naar een statische host, bijvoorbeeld Netlify of GitHub Pages. Staat de site op een subpad (zoals bij GitHub Pages), dan heb je mogelijk de `base`-optie van Vite nodig in `vite.config.ts`.
