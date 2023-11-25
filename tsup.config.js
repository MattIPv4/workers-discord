import { defineConfig } from 'tsup';
export default defineConfig({
    entry: ['src/*.ts'],
    dts: { entry: ['src/index.ts'] },
    format: ['esm'],
    splitting: true,
    sourcemap: true,
    clean: true,
    minify: true,
    outDir: 'dist',
    outExtension: () => ({ js: '.js' }),
});
