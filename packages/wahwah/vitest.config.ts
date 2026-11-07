import { defineConfig } from 'vitest/config';

// Runs the package tests on their own, without the playground's test setup.
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.{ts,js}'] },
});
