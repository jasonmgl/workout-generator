// Le point d'entrée de la commande JSON (voir `cli.ts`), construit dans
// `bin/workout-generator.mjs` par `npm run build:cli`.
import { main } from './cli';

main().then((code) => {
    process.exitCode = code;
});
