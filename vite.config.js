import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs also work when the finished build is hosted beneath a path.
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
