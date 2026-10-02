# workout-generator

Une **bibliothèque d'exercices** et un **générateur de séances de sport**, au
poids du corps ou avec le matériel qu'on a, qui tient compte de la forme du
jour, des séances passées et des muscles déjà travaillés ou à travailler.

Il ne sait rien de l'application qui l'utilise : pas de Vue, pas de Laravel,
aucune dépendance. On le réutilise tel quel.

## Installer

Le paquet est livré en source TypeScript, sans étape de construction :

```bash
npm install github:jasonmgl/workout-generator#master
```

```ts
import { defaultLibrary } from 'workout-generator/library';

const library = defaultLibrary();

library.findByName('Pompes inclinées')?.id; // 'incline-push-up'
library.filter({ equipment: ['two-chairs'], targets: ['chest'] });
library.harder('push-up'); // la marche suivante
```

## Développer

```bash
npm install
npm test
npm run types
npm run catalog -- core
```

Le travail en cours et les décisions sont dans `REPRISE.md`.
