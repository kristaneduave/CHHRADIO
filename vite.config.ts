import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import sharedCaseHandler from './api/shared-case';
import sharedCaseImageHandler from './api/shared-case-image';
import { getPublicCaseTokenFromPath } from './utils/publicCaseLinks';

const sharedCaseDevPreviewPlugin = () => ({
  name: 'shared-case-dev-preview',
  apply: 'serve' as const,
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const requestUrl = typeof req.url === 'string' ? req.url : '/';
      const parsedUrl = new URL(requestUrl, 'http://localhost');
      const pathname = parsedUrl.pathname;

      if (pathname === '/api/shared-case-image') {
        req.query = { ...(req.query || {}), token: String(parsedUrl.searchParams.get('token') || '').trim() };
        try {
          await sharedCaseImageHandler(req, res);
        } catch (error) {
          next(error);
        }
        return;
      }

      const token = getPublicCaseTokenFromPath(pathname);
      if (!token) {
        next();
        return;
      }
      req.query = { ...(req.query || {}), token };

      try {
        await sharedCaseHandler(req, res);
      } catch (error) {
        next(error);
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  Object.assign(process.env, env);
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [sharedCaseDevPreviewPlugin(), react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 1000,
    }
  };
});
