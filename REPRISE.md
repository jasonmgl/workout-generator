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
  séance, des étirements à côté).
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

## État au 2 octobre 2026 (soir)

- **Version utilisable sur `master`.** 257 tests au vert, types propres.
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
  performances et capacité par famille (`progress.ts`).
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

1. **Finir les constats des coachs du 03/10** (relecture de 28 séances ; la
   liste complète et ses causes sont dans le journal de cette date). Faits :
   forme du jour sur le volume, plan qui cède à la fatigue, séances courtes,
   choix des exercices (activation, plafond, muscles des places, équilibre
   poussée / tirage, genou douloureux, région évitée), cardio d'un débutant,
   progression sur les vrais chiffres, dosage selon le rôle, séries
   d'approche, échauffement et retour au calme du cardio, mobilité.
   Reste :
   - les noms anglais qui ont un équivalent français courant (Russian
     twists…), « Étirement du canapé » ; la typographie (espaces insécables
     avant « : » et « % », entre nombre et unité) ;
   - ranger aussi les circuits par position, à rôle égal.
3. **Le contrat avec DidIt** : c'est la session DidIt qui branche, sur une
   branche à part. Lui donner ce qu'elle demande (API stable, exemples
   d'entrée tirés de ses tables : `session_entries`, `body_logs`,
   `user_days`, `cycle_periods`, ressenti). Le VPS fait `npm ci` : si le
   dépôt est privé, il faudra une clé de déploiement (à régler avec Jason).
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
- La session DidIt a mis le branchement en pause (03/10, branche
  `generateur-seances` figée sur `2bf6f55`) : inutile de la prévenir à
  chaque push, elle prendra la dernière version à la reprise.

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
  par lien vers GitHub. 257 tests.
