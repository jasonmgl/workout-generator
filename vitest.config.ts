// Le moteur est du calcul pur : pas de navigateur, pas de DOM, pas d'horloge.
// La date du jour et le hasard lui sont toujours donnés : même entrée, même
// séance.
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
    },
});
