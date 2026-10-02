# Reprendre workout-generator

Ce fichier est la passation entre sessions Claude. **Il est mis à jour avant
chaque commit** : ligne dans le journal, et les sections État / Reste à faire /
Décisions / Pièges quand elles bougent. Le lire en premier.

## Le projet en trois lignes

Une **bibliothèque d'exercices** et un **générateur de séances** (au poids du
corps ou avec le matériel disponible ; forme du jour, séances passées, muscles
déjà travaillés ou à travailler), dans un paquet TypeScript sans dépendance.
Écrit pour remplacer un jour la génération de DidIt (`DailyPlan.php`,
`SessionGenerator.php`), mais il n'en sait rien : réutilisable tel quel par
d'autres projets. Dépôt : `github.com/jasonmgl/workout-generator` (dossier
local `workout-engine`).

## Comment on travaille

- Poste : `C:\Users\jason\OneDrive\Documents\Claude\workout-engine`. Node sous
  Windows, tout tourne depuis Git Bash ou PowerShell, sans WSL ni Python.
- **Push en HTTPS** (`origin` = `https://github.com/jasonmgl/workout-generator.git`) :
  le poste n'a pas de clé SSH GitHub, git passe par le gestionnaire
  d'identifiants de Windows. `gh` n'est pas connecté.
- `npm test` (vitest) et `npm run types` (`tsc --noEmit`) **au vert avant
  chaque commit**. **Chaque règle a son test.**
- `npm run catalog -- <fichier>` vérifie un fichier du catalogue seul
  (structure + texte français, repères attendus, chiffres d'équilibre).
- Tout est en français : commentaires, tests, README, textes. Identifiants du
  code en anglais. Commits en français, sans accents dans le corps, auteur
  `Camille <c.dumont@xefi.fr>` (config locale du dépôt), trailer
  `Co-Authored-By: Claude …`.
- **Pousser sur GitHub à la fin de chaque étape au vert**, et prévenir la
  session DidIt (« Développement continu », par `SendMessage`) quand une
  version utilisable est poussée, avec le numéro de commit.
- **S'arrêter à 80 % de la conso hebdo** (`get_usage`), proprement : tests,
  ce fichier, commit, push, annonce.
- Le moteur **ne doit jamais importer DidIt**, et ne lit jamais l'horloge ni
  `Math.random` : la date et la graine lui sont données.
- **Ne pas toucher au dépôt DidIt** (`C:\Users\jason\OneDrive\Documents\Claude\Didit`) :
  une autre session y travaille. On le lit, c'est tout.

## État au 2 octobre 2026

- Fondations posées : `src/random.ts` (mulberry32, tirage pondéré, graine
  tirée d'un texte), `src/dates.ts` (dates ISO, sans horloge ni fuseau),
  `src/i18n/format.ts` (phrases à trous avec pluriel, durées, recherche sans
  accents), `src/i18n/fr/labels.ts` (noms français de tout ce qui n'est pas
  un exercice).
- `src/library/anatomy.ts` : 30 muscles → 9 groupes → 3 régions, noms uniques
  d'un étage à l'autre, articulations à ménager, groupes opposés.
- `src/library/equipment.ts` : 38 pièces, `inventory` (ce qu'on a, ce qui en
  découle, les charges en kg), besoins « tous les groupes, une pièce dans
  chacun ».
- `src/library/types.ts` : le format d'une fiche (structure à part, texte à
  part par langue). `validate.ts` : les règles d'une fiche. `library.ts` :
  filtrer, chercher sans accents, relier un nom d'appli (`findByName`),
  familles de progression, plus facile / plus dur, remplaçants, fusion avec
  les fiches d'un projet.
- Le catalogue : 11 fichiers (`src/library/exercises/*.ts` + texte dans
  `src/i18n/fr/exercises/*.ts`), en cours de rédaction. `anchors.ts` liste
  les identifiants promis (dont tous les exercices de DidIt).
- 83 tests au vert.

## Reste à faire

1. **La bibliothèque** : ~420 fiches, relues (anatomie, difficulté, matériel,
   français), test d'intégrité de tout le catalogue, correspondance avec les
   noms de DidIt (`findByName`).
2. **La forme du jour** (`readiness`) : énergie, sommeil, stress, courbatures,
   douleurs articulaires, pouls du matin contre sa base (règle des +10 % et
   des deux matins), maladie, cycle, ressenti de la dernière séance.
3. **L'historique** : fatigue résiduelle par muscle (décroissance selon la
   taille du muscle), volume de la semaine par groupe, progression par
   exercice (plafond → plus dur, échec → plus facile), charge aiguë /
   chronique, jours sans repos, activités extérieures (course, vélo…).
4. **La séance du jour** (`generateSession`) : type et cible choisis selon les
   besoins et la fraîcheur, formats (séries, supersets, circuit, EMOM, AMRAP,
   Tabata, intervalles, échelles), échauffement et retour au calme, temps
   tenu, explications de chaque choix, remplacer un exercice.
5. **Le plan de la semaine** (`planWeek`) : répartition des groupes, vagues
   lourd / moyen / léger, repos, activités prévues.
6. **La commande JSON** pour Laravel (`bin/`), la conversion vers un arbre de
   blocs (boucles avec rôle échauffement / retour), le README, le contrat
   pour DidIt.

## Décisions à ne pas rediscuter

- **TypeScript + commande JSON** : DidIt peut générer dans le navigateur ou
  appeler la commande depuis PHP (choix de l'utilisateur, 02/10).
- **Séance du jour + plan de semaine** pour la première version ; les cycles
  de plusieurs semaines viendront après (02/10).
- **Français, prêt à traduire** : textes à part, rangés par langue ;
  identifiants en anglais (02/10).
- **La bibliothèque est un produit à part entière** : point d'entrée
  `workout-generator/library`, utilisable sans le générateur (02/10).
- **Jamais recopier Lafay** (ni programmes, ni codes d'exercices, ni chiffres,
  ni « 100 pompes », ni « 50 tractions ») ; Pavel et Pirie : principes
  seulement. US Navy et Sandow sont publics. Chiffres à nous.
- Textes des fiches **à l'infinitif** (« Poser les mains… ») : ni tu ni vous,
  pour convenir à toutes les applis.
- Une seule échelle de difficulté de 1 à 10 pour tout le catalogue (repères
  dans le cahier des charges des rédacteurs : pompe classique 3, traction 5,
  pompe sur un bras 8, traction sur un bras 10).

## Pièges connus

- `npm install` avertit que le script d'installation d'esbuild n'est pas
  autorisé (`allow-scripts`) : sans effet, le binaire vient du paquet
  `@esbuild/win32-x64`. vitest et vite-node marchent.
- `exactOptionalPropertyTypes` est actif : on ne passe pas `undefined` à un
  champ facultatif, on l'omet.
- Un paramètre par défaut JavaScript remplace `undefined` : pour tester
  « sans texte », passer `null`, pas `undefined` (c'est arrivé dans
  `validate.test.ts`).

## Journal

- **02/10** — Création. Lecture de DidIt (catalogue, générateurs, ADN
  d'entraînement, forme du jour, intégration de didit-engine) par cinq
  lecteurs. Questions posées : dépôt créé par l'utilisateur
  (`jasonmgl/workout-generator`), séance + semaine, français prêt à
  traduire, TypeScript + commande JSON, arrêt à 80 %. Fondations, format des
  fiches, bibliothèque et validation. 83 tests. Rédaction du catalogue lancée
  (onze rédacteurs, chacun relu).
