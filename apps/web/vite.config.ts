import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), 'VITE_');
  const apiUrl = env.VITE_API_URL ?? 'http://localhost:3000';
  const webPort = Number(env.VITE_WEB_PORT ?? env.WEB_PORT ?? 5173);

  return {
    plugins: [react()],
    envDir: path.resolve(__dirname, '../..'),
    envPrefix: 'VITE_',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: webPort,
      strictPort: false,
      host: true,
      proxy: {
        // Любой /api/* в dev уходит на backend (избегаем CORS-пляски при разработке).
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      target: 'es2022',
      commonjsOptions: {
        // shared — workspace-пакет, собранный в CJS (Node16). Принудительно
        // прогоняем через rollup-commonjs, иначе named exports не разрешаются.
        include: [/node_modules/, /packages\/shared/],
      },
    },
    optimizeDeps: {
      // То же для dev-сервера: esbuild pre-bundle.
      include: ['@proxels/shared'],
    },
  };
});
