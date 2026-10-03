# workout-generator

Une **bibliothèque de 472 exercices** et un **générateur de séances de sport**,
au poids du corps ou avec le matériel qu'on a. Il tient compte de la forme du
jour, des séances et des activités passées, et des muscles déjà travaillés ou
qu'on veut travailler.

Il ne sait rien de l'application qui l'utilise : pas de Vue, pas de Laravel,
aucune dépendance. On le réutilise tel quel, dans le navigateur, avec Node,
ou depuis un serveur par sa commande JSON.

## Installer

Le paquet est livré en source TypeScript, sans étape de construction :

```bash
npm install github:jasonmgl/workout-generator#master
```

## La séance du jour

```ts
import { generateSession, sessionToText } from 'workout-generator';

const session = generateSession({
    date: '2026-10-02T18:00',
    profile: { goal: 'health', level: 'intermediate', limitations: [{ joint: 'knees', severity: 1 }] },
    equipment: ['two-chairs', 'table', { id: 'dumbbells', loads: [4, 8, 12] }],
    readiness: { energy: 4, sleepHours: 7, restingHeartRate: 54, heartRateHistory: [/* … */] },
    history: [/* les séances passées : exercices, séries, ressenti, activités */],
    request: { minutes: 30, focus: ['back'], quiet: true },
});

console.log(sessionToText(session));
```

Tout est facultatif sauf la date. Le moteur fait avec ce qu'on lui donne :
- **sans historique**, il part prudemment ;
- **sans forme du jour**, il suppose une journée ordinaire ;
- **sans matériel**, il suppose le sol et un mur.

La même entrée donne toujours la même séance. Le hasard vient d'une graine,
par défaut tirée de la date.

Ce que le moteur décide, et pourquoi (chaque décision a une raison avec un
code stable, `session.reasons`, et une phrase en français) :

- **La forme du jour** (`assessReadiness`) :
  - repos si un repos est déclaré, en cas de maladie, avec un pouls du matin
    à +10 % de sa base (puis deux matins normaux avant de recharger), ou
    après sept jours d'affilée sans repos ;
  - sinon une note faite de l'énergie, du sommeil, du stress, des
    courbatures et de la motivation ;
  - puis des ajustements : ressenti de la dernière séance, cycle, semaine
    bien au-dessus de l'habitude, reprise après une coupure, articulations
    douloureuses.
- **Le type de séance**. Corps entier quand tout est frais, haut du corps
  quand les cuisses sont encore chargées (séances, vélo, course…), bas du
  corps dans le cas inverse, mobilité quand tout est fatigué. On peut aussi
  le demander, ou le prendre au plan de la semaine.
- **Les exercices**, place par place dans un gabarit. Le matériel, les
  articulations à ménager et les sauts permis ou non décident de ce qui est
  faisable. La note de chaque candidat tient compte de :
  - la variante juste, d'après ce qu'on a réussi dans chaque famille de
    progression ;
  - des muscles frais et en retard sur la semaine ;
  - de la variété, et des favoris.
- **Le dosage**. Séries, répétitions ou secondes, repos et réserve suivent
  l'objectif. Chaque exercice en répétitions a un **tempo** comme dans
  DidIt : 3, 2 ou 1 s par phase en lent, normal, rapide, une répétition
  faisant deux phases. La charge est prise parmi celles qu'on a. La
  progression monte en escalier : une répétition de plus, une série de
  plus, la charge au-dessus, la variante plus dure ; quatre séances sans
  progrès, c'est un plateau, on passe en tempo lent.
- **Le format**. Séries classiques, par deux, circuit, le plus de tours
  possible, une série par minute, échelle, intervalles ou Tabata, selon
  l'objectif et la durée.
- **L'échauffement et le retour au calme**. L'échauffement fait monter le
  pouls, mobilise ce que la séance va solliciter et finit par une version
  facile du premier exercice. Le retour au calme étire les muscles qui ont
  le plus travaillé et finit sur une respiration lente.
- **La durée**. Elle est tenue à quelques minutes près, de 5 à 120 minutes.
  `DURATIONS` propose 10, 20, 30, 45 et 60, comme DidIt. Chaque exercice dit
  le temps d'une série (`setSeconds`) et le temps de tout son bloc.

## Le plan de la semaine

```ts
import { planWeek, plannedDayFor, generateSession } from 'workout-generator';

const week = planWeek({ start: '2026-10-05', sessionsPerWeek: 4, days: [1, 2, 4, 6], profile: { goal: 'hypertrophy' } });
const today = generateSession({ date: '2026-10-06', plan: plannedDayFor(week, '2026-10-06') });
```

Le plan règle quatre choses :
- **Le découpage selon le nombre de séances** : corps entier jusqu'à trois,
  puis haut et bas, puis pousser, tirer, jambes.
- **Les jours** : les plus espacés possible parmi ceux qui sont disponibles.
- **L'intensité** : une séance dure, une moyenne, une légère, jamais deux
  dures d'affilée.
- **Les activités prévues** : pas de jambes autour d'une longue sortie.

Il ne fixe pas les exercices : la séance du jour les choisit le jour venu,
avec la forme du jour.

## La bibliothèque seule

```ts
import { defaultLibrary } from 'workout-generator/library';

const library = defaultLibrary();

library.findByName('Rowing australien')?.id; // 'inverted-row-bar'
library.filter({ equipment: ['two-chairs'], targets: ['chest'], maxImpact: 'low' });
library.harder('push-up'); // la marche suivante dans la famille des pompes
library.alternatives('pull-up', { equipment: ['resistance-band', 'door'] });
library.exercise('archer-push-up').text; // nom, consignes, erreurs, respiration…
```

Chaque fiche a deux parties :
- **ce que le moteur calcule** : muscles principaux, secondaires et
  stabilisateurs, matériel, difficulté de 1 à 10 sur une seule échelle,
  famille de progression, articulations sollicitées, impact, place, dépense,
  fourchette habituelle ;
- **un texte rangé à part, par langue** : nom, autres noms, résumé, mise en
  place, déroulé, repères, erreurs fréquentes, respiration, sécurité.

**Les photos** : 266 fiches ont la photo de départ et d'arrivée de l'exercice,
tirées de [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(domaine public). Chaque correspondance a été vérifiée : `exact` quand la
photo montre le même exercice, `close` pour la même forme avec une
différence mineure ; sans correspondance sûre, pas de photo. Les photos
restent hébergées sur GitHub : `library.media(id)` donne leurs adresses, et
chaque exercice d'une séance porte ses `images`. Une application qui les
copie chez elle passe `createLibrary({ mediaBase: 'https://…/photos/' })`.

Un projet ajoute ses propres fiches avec
`createLibrary({ exercises, texts })` et peut les vérifier avec
`validateCatalog`.

## Les sorties

- `sessionToText(session)` : la séance en texte, comme sur un carnet.
- `toTimeline(session)` : les étapes une à une pour un lecteur. Chaque étape
  dit ce qu'on fait (exercice ou repos), ce qu'on compte et combien de
  temps elle dure, et donne son contexte (« Circuit · Tour 2/3 »).
- `toTree(session)` : un arbre de boucles, d'exercices et de repos, avec le
  rôle de chaque boucle (échauffement, retour au calme…). C'est la forme
  des programmes qu'on enregistre.

## Depuis un serveur : la commande JSON

```bash
echo '{"command":"session","input":{"date":"2026-10-02","request":{"minutes":30}}}' | node node_modules/workout-generator/bin/workout-generator.mjs
```

La réponse est `{"ok":true,"result":…}`. En cas d'erreur, c'est
`{"ok":false,"error":"…"}` avec le code de retour 1.

Les commandes :
- `session` : la séance du jour ;
- `week` : le plan de la semaine ;
- `readiness` : la forme du jour ;
- `body` : l'état des muscles ;
- `alternatives` et `replace` : remplacer un exercice ;
- `exercise`, `search` et `library` : interroger la bibliothèque ;
- `text`, `timeline` et `tree` : les sorties d'une séance.

## Le vocabulaire de DidIt

| DidIt | workout-generator |
| --- | --- |
| Objectif `forme`, `force`, `volume`, `endurance`, `minceur` | `goal` : `health`, `strength`, `hypertrophy`, `endurance`, `fat-loss` |
| Matériel `sol` | rien (supposé) |
| `chaises` | `two-chairs` |
| `table` | `table` |
| `barre` | `pullup-bar` (ajouter `low-bar` si elle sert aux rowings) |
| `paralleles` | `dip-bars` |
| `elastique` | `resistance-band` |
| `halteres` | `{ id: 'dumbbells', loads: [...] }` |
| `corde` | `jump-rope` |
| `tapis` | `mat` |
| `velo` | `bike` |
| `dehors` | `outdoor` |
| Ressenti `facile`, `juste`, `dur` | `effort` : `easy`, `right`, `hard` |
| Zone `pectoraux`, `dos`, `epaules`, `bras` | `chest`, `back`, `shoulders`, `arms` |
| Zone `jambes` | `lower` (ou `legs`, `glutes`, `calves`) |
| Zone `abdominaux` | `core` |
| Zone `gainage` | `core` et `lower-back` |
| Zone `cardio` | `request.type: 'cardio'` ou `'hiit'` |
| Tempo `lent`, `normal`, `rapide` | `slow`, `normal`, `fast` (mêmes 3, 2, 1 s par phase) |
| Rôle de boucle `echauffement`, `retour` | rôle de bloc `warmup`, `cooldown` |
| Nom d'exercice de la bibliothèque | `library.findByName(nom)` : les noms de DidIt sont des noms ou des alias du catalogue |
| `session_entries` (nom, séries, meilleur nombre) | `history[].exercises` : le nom suffit, le moteur retrouve la fiche (`resolveHistory`) et ignore un nom inconnu |
| Endurance `course`, `marche`, `velo`, `natation` | `activities` : `run`, `walk`, `bike`, `swim`, avec les minutes |
| Phase du cycle (`Cycle::phaseFor`) | `readiness.cycle.phase` : `menstrual`, `follicular`, `ovulation`, `luteal` |

Ce que DidIt envoie déjà est vérifié par `tests/didit.test.ts` : l'entrée
de `WorkoutGenerator::inputFor`, et chaque champ que `movementsOf` relit.
Quelques détails pour en tirer davantage :

- **Le niveau fait plutôt que l'exercice.** Un nom de niveau qui se suffit
  (« Pompes inclinées », « Squat bulgare ») est retrouvé tel quel et dit
  mieux que « Pompes » quelle variante a été faite. Un niveau qui ne se
  comprend qu'avec son exercice (« Corps incliné ») gagne à être envoyé
  avec l’identifiant de la fiche.
- **Un exercice en durée.** Quand une entrée ne garde qu'un nombre dans
  `reps`, celui d'une planche est lu comme des secondes.
- **Les séances d'endurance et les activités libres** comptent dans la
  fatigue et la charge : `activities` pour une sortie, `worked` (les zones
  traduites comme plus haut) pour une activité sans détail.
- **Les séries une à une**, avec la réserve (`rir`) et la charge
  (`loadKg`), affineraient la progression : le moteur les lit déjà.

## Développer

```bash
npm install
npm test
npm run types
npm run catalog -- core
npm run build:cli
```

`bin/workout-generator.mjs` est construit par `npm run build:cli` et
versionné. Un test vérifie qu'il est à jour avec les sources. Le travail en
cours et les décisions sont dans `REPRISE.md`.
