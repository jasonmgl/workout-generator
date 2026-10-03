# Reprendre workout-generator

Ce fichier est la passation entre sessions Claude. **Il est mis à jour avant
chaque commit** : ligne dans le journal, et les sections État / Reste à faire /
Décisions / Pièges quand elles bougent. Le lire en premier.

## Le projet en trois lignes

Une **bibliothèque d'exercices** (478 fiches) et un **générateur de séances**
(au poids du corps ou avec le matériel disponible ; forme du jour, séances
passées, muscles déjà travaillés ou à travailler), dans un paquet TypeScript
sans dépendance. Écrit pour remplacer un jour la génération de DidIt
(`DailyPlan.php`, `SessionGenerator.php`), mais il n'en sait rien :
réutilisable tel quel. Dépôt : `github.com/jasonmgl/workout-generator`
(dossier local `workout-engine`).

## Comment on travaille

- Poste : `C:\Users\jason\OneDrive\Documents\Claude\workout-engine`. Node sous
  Windows, tout tourne depuis Git Bash ou PowerShell, sans WSL ni Python.
- **Push en HTTPS** (`origin` = `https://github.com/jasonmgl/workout-generator.git`) :
  le poste n'a pas de clé SSH GitHub, git passe par le gestionnaire
  d'identifiants de Windows. `gh` n'est pas connecté.
- `npm test` (vitest) et `npm run types` (`tsc --noEmit`, avec
  `noUnusedLocals`) **au vert avant chaque commit**. **Chaque règle a son
  test.** Après tout changement dans `src/`, `npm run build:cli` (un test
  vérifie que `bin/workout-generator.mjs` est à jour).
- `npm run catalog -- <fichier>` vérifie un fichier du catalogue seul
  (structure + texte français, repères attendus, chiffres d'équilibre).
- **Regarder les séances, pas seulement les tests** : un script dans le
  dossier de travail qui importe `src/session/generate` et `src/output/text`
  par chemin absolu, lancé par `npx vite-node script.ts`, affiche des
  séances en texte. C'est en les relisant comme un coach qu'on a trouvé les
  vrais défauts (trop d'exercices à deux séries, trois pompes dans une
  séance, des étirements à côté). `npx vite-node scripts/scenarios.ts` sort
  les 28 séances et 3 semaines des relectures.
- Tout est en français : commentaires, tests, README, textes. Identifiants du
  code en anglais. Textes des fiches à l'infinitif. Commits en français, sans
  accents dans le corps, auteur `Camille <c.dumont@xefi.fr>` (config locale
  du dépôt), trailer `Co-Authored-By: Claude …`.
- **Pousser sur GitHub à la fin de chaque étape au vert**, et prévenir la
  session DidIt (« Développement continu », par `SendMessage` ; son adresse
  se retrouve avec `ListAgents`) avec le numéro de commit.
- **S'arrêter à 80 % de la conso hebdo** (`get_usage`), proprement : tests,
  ce fichier, commit, push, annonce.
- Le moteur **ne doit jamais importer DidIt**, et ne lit jamais l'horloge ni
  `Math.random` : la date et la graine lui sont données.
- **Ne pas toucher au dépôt DidIt** (`C:\Users\jason\OneDrive\Documents\Claude\Didit`) :
  une autre session y travaille. On le lit, c'est tout.

## État au 3 octobre 2026 (soir)

- **Version utilisable sur `master`.** 278 tests au vert, types propres.
- **DidIt l’a déjà branché** (version 0.13.0 de DidIt, fusionnée sur son
  `main`, derrière l’interrupteur `DIDIT_GENERATEUR`) : `app/Support/WorkoutGenerator.php`
  appelle la commande JSON, dépend de `github:jasonmgl/workout-generator#master`
  (verrouillé sur `ec65175`). **Tout ce qui est poussé sur `master` arrive
  chez DidIt à sa prochaine mise à jour** : `tests/didit.test.ts` reproduit
  son entrée (`inputFor`) et vérifie chaque champ que `movementsOf` relit.
- `src/library/` : anatomie (30 muscles → 9 groupes → 3 régions,
  articulations), matériel (38 pièces, `inventory`, charges en kg), format des
  fiches (`types.ts`), règles (`validate.ts`), bibliothèque (`library.ts` :
  filtrer, chercher sans accents, `findByName`, familles, plus facile / plus
  dur, remplaçants, fusion avec les fiches d'un projet).
- **Le catalogue : 478 fiches** en 11 fichiers (`src/library/exercises/*.ts`,
  texte dans `src/i18n/fr/exercises/*.ts`), tous rédigés puis relus en
  entier par un relecteur exigeant. Une fiche peut avoir un nom par matériel
  (`nameWith` : « à la kettlebell » quand c'est elle qui sert).
  `anchors.ts` liste les identifiants promis ; tous les noms de DidIt sont
  retrouvés par `findByName` (test dans `tests/catalog.test.ts`).
- `src/readiness/assess.ts` : la forme du jour (repos déclaré, maladie, pouls
  à +10 % avec la règle des deux matins, sept jours sans repos, note de forme,
  sommeil court, ressenti, cycle, charge aiguë / chronique, reprise,
  articulations, courbatures).
- `src/history/` : charge (`load.ts`), fatigue par muscle avec décroissance
  selon la taille (`fatigue.ts`), activités hors séance (`activities.ts`),
  performances et capacité par famille (`progress.ts`), historique ramené
  aux fiches (`resolve.ts` : un exercice donné par son nom, comme DidIt le
  fait, est retrouvé ; des `reps` sur une fiche en durée sont des secondes).
- `src/session/` : contexte, objectifs (`goals.ts`), gabarits
  (`templates.ts`), choix du type (`choose.ts`), choix des exercices
  (`select.ts`), dosage et progression (`prescribe.ts`), temps et tempo
  (`timing.ts`), formats (`formats.ts`), échauffement, retour au calme,
  assemblage (`generate.ts`), remplacement d'un exercice (`swap.ts`).
- `src/week/plan.ts` : le plan de la semaine.
- `src/output/` : texte, étapes pour un lecteur (`toTimeline`), arbre de
  blocs (`toTree`).
- `src/cli.ts` + `bin/workout-generator.mjs` : la commande JSON pour Laravel.
- **Les photos** (`src/library/media.ts`, généré) : 266 fiches ont celles de
  free-exercise-db (github.com/yuhonas/free-exercise-db, domaine public,
  environ 870 exercices, le dépôt le plus étoilé du genre). Correspondances
  vérifiées une à une par six relecteurs (144 exactes, 122 proches) ; le
  reste n'a pas de photo plutôt qu'une fausse. Les photos restent sur GitHub
  (`MEDIA_BASE`), `library.media(id)` compose l'adresse, `mediaBase` la
  change. Les dépôts annonçant 10 000 exercices (wrkout.xyz, ExerciseDB) ne
  livrent ce volume que par une offre payante ou une API : écartés.

## Reste à faire

**Ordre décidé le 03/10 au soir** : corriger les constats de la deuxième
relecture des coachs, puis préparer le branchement DidIt (point 3), puis les
cycles de plusieurs semaines (point 5), jusqu'à 80 % de la consommation.

1. **Les constats de la deuxième relecture des coachs** (03/10, soir) :
   35 constats, avec cause et correctif, dans
   `docs/relectures/2026-10-03-coachs-2.md` (identifiants
   `programmation-N`, `securite-N`, `clarte-N`). Les séances relues
   sortent de `scripts/scenarios.ts`. Par lots, les plus graves d'abord :
   - [x] première fois et échec : cible + réserve dans la fiche, plafond de
     séries tenu en circuit, nordiques en descente freinée, variante sœur
     dosée sur la famille, plateau qui garde l'exercice, échec qui tient la
     cible, charge de reprise, charge la plus proche (programmation-1, -4 ;
     securite-3, -4, -5, -6, -10) ;
   - [ ] forme du jour : hasard tiré dans un ordre fixe, ni AMRAP ni EMOM un
     jour léger, travail plafonné ; récupération qui passe avant le type
     demandé (securite-1, -2) ;
   - [ ] poussée / tirage : pompes sphinx comptées en poussée, places de
     base par paires en commençant par le tirage ; focus servi d'abord ;
     développé chargé en salle ; pas d'extensions lombaires après une
     charnière ; doublons de mouvement (programmation-2, -6, -7, -11 ;
     clarte-12) ;
   - [ ] cardio en continu : retour au calme de 2 à 3 min, échauffement en
     un tour, durée tenue ; « très facile » écrit ; machine et corde
     utilisées (programmation-3, -9 ; securite-9 ; clarte-3, -4, -10) ;
   - [ ] notes : un message par secours (tirage, articulation), porte +
     serviette et table d'abord, majuscules (clarte-1, -2 ; programmation-10 ;
     securite-11) ;
   - [ ] tempo : négatives « descendre en 4 s, remonter sans forcer », pas
     de tempo lent au gainage, pas de réserve sur l'activation
     (programmation-12 ; securite-7 ; clarte-5) ;
   - [ ] le reste : résumé sans redites (clarte-6), mobilité « sans
     compter » (clarte-7), séances courtes remplies ou annoncées
     (programmation-8 ; clarte-8), charges lisibles (clarte-9), échauffements
     préparant les figures (securite-8), plan de la semaine région par
     région (programmation-5 ; clarte-11).
3. **Le contrat avec DidIt** : DidIt a branché lui-même, en PHP (voir
   État). Garder `tests/didit.test.ts` au vert ; ne rien renommer de ce que
   `movementsOf` lit (`title`, `summary`, `estimatedMinutes`, `type`,
   `blocks[].id/title/role/rounds/items`, `items[].name/exercise/sets/perSet/
   target.measure/value/perSide/restSeconds/reasons[0].text/progression`).
   Ce que DidIt pourrait envoyer en plus (niveau fait, endurance, cycle,
   séries une à une) est dans le README, « Le vocabulaire de DidIt ». Son
   `package-lock` passe par `git+ssh` : sur le VPS, une clé de déploiement
   si le dépôt est privé (à régler avec Jason).
4. **Les séries faites une à une** : DidIt ne garde qu'un `reps` par
   exercice (le maximum) ; le moteur sait lire des séries détaillées, avec
   réserve et charge. À proposer à DidIt quand elle branchera.
5. Plus tard : les cycles de plusieurs semaines (progression, semaine
   allégée, tests de niveau), une deuxième langue, des séances à deux.

## Décisions à ne pas rediscuter

- **TypeScript + commande JSON** : DidIt peut générer dans le navigateur ou
  appeler la commande depuis PHP (choix de l'utilisateur, 02/10).
- **Séance du jour + plan de semaine** pour la première version ; les cycles
  de plusieurs semaines viendront après (02/10).
- **Français, prêt à traduire** : textes à part, rangés par langue (fiches
  dans `src/i18n/fr/exercises`, phrases du moteur dans
  `src/i18n/fr/messages.ts`, `registerMessages` pour une autre langue) ;
  identifiants en anglais (02/10).
- **La bibliothèque est un produit à part entière** : point d'entrée
  `workout-generator/library`, utilisable sans le générateur (02/10).
- **Le tempo comme dans DidIt** (demande de l'utilisateur, 02/10) : 3, 2 et
  1 s par phase en lent, normal et rapide ; une répétition fait deux phases.
  Chaque exercice de renforcement en répétitions porte un tempo, et la durée
  prévue de ses séries se calcule dessus. Chaque exercice dit le temps d'une
  série (`setSeconds`) et de tout son bloc. Les durées proposées sont celles
  de DidIt (10, 20, 30, 45, 60).
- **Photos par lien, sur nos fiches seulement** (choix de l'utilisateur,
  03/10) : pas de bibliothèque étendue importée pour l'instant, pas de photo
  copiée dans le paquet. La source ne dit pas d'où viennent ses photos à
  l'origine : sans risque pour DidIt (privée), à vérifier pour un produit
  public.
- **Jamais recopier Lafay** (ni programmes, ni codes d'exercices, ni chiffres,
  ni « 100 pompes », ni « 50 tractions ») ; Pavel et Pirie : principes
  seulement. US Navy et Sandow sont publics. Chiffres à nous (un test
  vérifie que le catalogue ne cite pas Lafay).
- Textes des fiches **à l'infinitif** (« Poser les mains… ») : ni tu ni vous,
  pour convenir à toutes les applis. Les phrases du moteur sont neutres
  aussi.
- Une seule échelle de difficulté de 1 à 10 pour tout le catalogue (pompe
  classique 3, traction 5, pompe sur un bras 8, traction sur un bras 10).
- Remplir une séance **d'abord par les places de base, puis des séries en
  plus, ensuite seulement des exercices en plus** : mieux vaut cinq
  exercices bien dosés que neuf à deux séries.
- La fraîcheur d'une région est celle de **son gros muscle le plus
  fatigué** (pas une moyenne qui noie des quadriceps vidés dans des mollets
  frais).
- Les étirements du retour au calme se choisissent **muscle par muscle**,
  pour couvrir le travail réellement fait.
- AMRAP et EMOM limités à 20 minutes ; au-delà, un circuit. Un circuit a
  au moins deux tours, et chaque circuit a son propre nombre de tours.
- **La forme du jour réduit le travail** (03/10, relecture des coachs) : le
  temps de travail est multiplié par le volume du jour, avec moins
  d'exercices et un plafond de séries ; la séance est annoncée allégée et
  plus courte, le temps libéré n'est pas rempli.
- **Le plan de la semaine est une préférence** : si la région qu'il charge
  est fatiguée, la séance du jour change de type (« plan adapté ») ; une
  séance prévue dure ne l'est pas un jour de petite forme.
- **Une place principale prend un vrai mouvement** (bonus aux
  polyarticulaires, pénalité aux fiches d'activation) ; **rien de plus d'une
  marche et demie au-dessus** de ce que la personne sait faire (une place en
  plus reste vide, une place de base prend la variante la plus facile) ;
  **une poussée en plus n'entre qu'avec autant de vrais tirages**.
- **La progression part des vrais chiffres** : « a coincé » veut dire moins
  bien que d'habitude, une série à l'échec, ou sous la fourchette de la
  variante elle-même ; sous la fourchette de l'objectif, on garde ce que la
  personne réussit, en séries plus nombreuses ; au plateau, on garde
  l'exercice, plus lent, un peu moins de répétitions, une série de plus ;
  une variante plus dure repart d'une part de la dernière performance.
- **Une première fois tient dans la fiche** (03/10, deuxième relecture) :
  au poids du corps, cible + réserve ≤ bas de la fiche + 60 % de sa
  fourchette, le volume manquant venant d'une série de plus ; une descente
  freinée découverte (plafond de deux séries) sort d'un circuit ou d'un
  superset, en séries classiques en tête. Une variante sœur (même famille,
  même difficulté) se dose sur ce qui s'y fait. **Un échec ou une séance
  ressentie dure fait tenir la cible** ; on ne change de variante qu'après
  deux séances de suite qui ont coincé. Au plateau, l'exercice exact est
  gardé (×3 au tirage), jamais une variante plus dure.
- **Les charges** : estimée, celle du dessous ou du dessus selon que les
  répétitions recalculées (Epley) tombent dans l'objectif, le manque pesant
  trois fois plus que l'excès ; à la reprise, 0,9 / 0,8 / 0,7 de la charge
  d'avant après 8 / 21 / 43 jours. `load.estimated` dit « à ajuster ». Pas
  de réserve sur l'activation, la posture, la rééducation ni le gainage
  facile, et jamais plus que la fiche ne le permet.
- **Le dosage dépend du rôle** : seuls les gros mouvements suivent la
  fourchette de l'objectif ; un exercice d'appoint se fait à 8-12 au moins,
  le gainage à 8-15 ou en tenue, avec moins de repos.

## Pièges connus

- `npm install` avertit que le script d'installation d'esbuild n'est pas
  autorisé (`allow-scripts`) : sans effet, le binaire vient du paquet
  `@esbuild/win32-x64`. vitest, vite-node et esbuild marchent.
- `exactOptionalPropertyTypes` est actif : on ne passe pas `undefined` à un
  champ facultatif, on l'omet (`...(x ? { x } : {})`).
- Un paramètre par défaut JavaScript remplace `undefined` : pour tester
  « sans texte », passer `null`, pas `undefined`.
- Dans un `node -e "…"` lancé par Bash, des accents graves dans le code sont
  pris pour une substitution de commande : un commentaire est sorti vide.
  Préférer l'outil Edit pour toucher du texte.
- `vite-node script.ts` ne met pas le script dans `process.argv[1]` : un
  « si on est lancé directement » ne marche pas. La commande JSON se
  construit donc avec la ligne de commande d'esbuild (`npm run build:cli`).
- En JavaScript, `\b` ne connaît pas les lettres accentuées : « tête »
  contient un « te » entre deux bornes. Utiliser
  `(?<![\p{L}])…(?![\p{L}])` avec le drapeau `u`.
- Dans un circuit ou un superset, `item.sets` vaut 1 et `block.rounds` dit
  combien de fois : le total d'un exercice est `sets × rounds`.
- Pour modifier plusieurs passages d'un fichier, écrire un petit script
  `.mjs` de remplacements dans le dossier de travail (avec l'outil Write)
  plutôt qu'un `node -e` : les accents graves y sont interprétés par Bash et
  des morceaux de commentaires disparaissent.
- Comparer le travail de deux séances par le nombre de séries trompe (un
  circuit est plus dense qu'un superset) : comparer séries × répétitions.
- La session DidIt a fusionné son branchement (0.13.0, paquet verrouillé
  sur `ec65175`) puis s’est mise en pause : inutile de la prévenir à chaque
  push, elle prendra la dernière version à sa prochaine mise à jour. Mais
  un champ renommé dans la réponse casse son écran sans bruit (elle
  retombe sur son ancien générateur) : c’est `tests/didit.test.ts` qui
  prévient.

## Journal

- **02/10** — Création. Lecture de DidIt (catalogue, générateurs, ADN
  d'entraînement, forme du jour, intégration de didit-engine) par cinq
  lecteurs. Questions posées : dépôt créé par l'utilisateur
  (`jasonmgl/workout-generator`), séance + semaine, français prêt à
  traduire, TypeScript + commande JSON, arrêt à 80 %. Fondations, format des
  fiches, bibliothèque et validation. 83 tests. Poussé (`6cc9c0c`).
- **02/10, soir** — Le catalogue (472 fiches, onze rédacteurs, neuf relus
  en entier). La forme du jour, l'historique, la séance du jour, le plan de
  la semaine, les sorties, la commande JSON. Séances relues en texte : sept
  défauts corrigés (remplissage, doublons de pompes, tirage sans matériel,
  vélo de la veille, échauffement, étirements, durée des circuits). Le tempo
  et le temps de chaque série comme dans DidIt (demande de l'utilisateur).
  203 tests. Première version utilisable poussée ; session DidIt prévenue.
  Arrêt pour ce soir à la demande de l'utilisateur.
- **03/10** — Relecture de `conditioning` et `skills` finie (478 fiches).
  28 séances et 3 plans générés en texte, relus par trois coachs
  (programmation, sécurité, clarté) : 45 constats. Premiers correctifs :
  focus prioritaire, exercices chargés non pénalisés, finisher en plusieurs
  tours, plus d'exercice seul après des supersets (trio), tirage de secours
  par les omoplates, nom selon le matériel, choix selon l'objectif. 213 tests.
  Puis les constats des coachs, les plus graves d'abord (voir Décisions et
  Reste à faire) : forme du jour sur le volume, douleur forte, plan qui cède
  à la fatigue, séances courtes, choix des exercices, cardio d'un débutant,
  progression, dosage par rôle, séries d'approche, échauffement et retour au
  calme du cardio (format « en continu », même machine), mobilité rangée par
  position, fiches à quatre pattes qui déclarent épaules et poignets.
  `tests/coach.test.ts` vérifie chaque règle sur huit graines. 245 tests.
  Puis le texte de la séance : séries et cible collées, tempo normal tu,
  tempo lent expliqué, séries d'approche, charges « à ajuster », réserve
  expliquée une fois, tous les repos, durées à la demi-minute (transitions
  comprises), blocs « Renforcement » et « En alternance ». Puis le plan de
  la semaine (fractionné jamais léger, sortie dure qui allège la séance de
  jambes voisine ou la remplace le jour même, phrases écrites à partir des
  séances placées, sorties nommées avec leur date) et les exercices en
  alternance (21 fiches, nombre pair, « en alternant (6 de chaque côté) »),
  chiffres d'échauffement et de retour au calme arrondis comme un coach.
  250 tests. Puis les photos de free-exercise-db sur 266 fiches (voir État),
  par lien vers GitHub. 257 tests. Questions posées : deuxième relecture
  des coachs d'abord, pas d'autre source de photos pour l'instant. Noms
  français (Rotations russes, Boxe dans le vide, Ruades à quatre pattes,
  Étirement du quadriceps contre le mur ; l'ancien nom reste un alias) et
  typographie française (espace fine insécable avant « : » et « % »,
  insécable entre un nombre et son unité, un test la garde). 259 tests.
  Deuxième relecture des coachs lancée. En l’attendant, lecture du pont de
  DidIt (`WorkoutGenerator.php`, déjà fusionné) : il envoie le **nom** des
  exercices dans l’historique, que le moteur ne cherchait que par
  identifiant, donc toutes les séances passées de DidIt étaient ignorées
  (ni fatigue, ni progression). Corrigé (`resolveHistory`, appliqué au
  contexte, à `bodyState` et à `capacity`), et le contrat est testé
  (`tests/didit.test.ts` : 75 séances de DidIt, chaque champ relu). L’exemple
  de conversion en TypeScript commencé est abandonné : DidIt a son pont, et
  `toTree` donne déjà l’arbre de ses programmes. 266 tests.
  Circuits rangés par position (le meilleur ordre parmi tous : jamais deux
  exercices de la même région d’affilée quand on peut l’éviter, puis le
  moins de montées et descentes du sol ; 12 % de grands changements de
  position en moins). Deuxième relecture des coachs reçue : 35 constats,
  rangés dans `docs/relectures/`, et le script des séances relues versé
  dans `scripts/scenarios.ts`. 268 tests.
  Premier lot de la deuxième relecture (première fois et échec) : cible +
  réserve dans la fiche, curls nordiques en descente freinée (avec une
  règle de validation), descente freinée découverte sortie des circuits,
  variante sœur dosée sur la famille, plateau qui garde l'exercice, échec
  ou ressenti « dure » qui tient la cible (le ressenti de séance rejoint
  chaque performance), charge de reprise réduite, charge estimée la plus
  utile, réserve absente des exercices qui ne fatiguent pas, résumé qui
  annonce le format dominant. 278 tests.
