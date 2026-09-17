import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 最后一个浏览器页面关闭后，自动停止开发服务器（关掉页面即停止项目）
function autoShutdownPlugin(): Plugin {
  let openTabs = 0;
  let shutdownTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelShutdown = () => {
    if (shutdownTimer !== null) {
      clearTimeout(shutdownTimer);
      shutdownTimer = null;
    }
  };

  const armShutdown = () => {
    openTabs = Math.max(0, openTabs - 1);
    if (openTabs > 0) return;
    cancelShutdown();
    shutdownTimer = setTimeout(() => {
      console.log('[auto-shutdown] 所有页面已关闭，停止开发服务器。');
      process.exit(0);
    }, 5000);
  };

  return {
    name: 'auto-shutdown-on-page-close',
    configureServer(server) {
      server.middlewares.use('/__hello', (_req, res) => {
        openTabs += 1;
        cancelShutdown();
        res.statusCode = 200;
        res.end('ok');
      });
      server.middlewares.use('/__bye', (_req, res) => {
        res.statusCode = 200;
        res.end('ok');
        setTimeout(armShutdown, 10);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), autoShutdownPlugin()],
  server: {
    port: 5173,
    open: false,
  },
});