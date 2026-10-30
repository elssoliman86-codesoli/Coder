import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      
      manifest: {
        name: '2OneByte-Coder',
        short_name: '2OneByte',
        description: 'منشئ تطبيقات بالذكاء الاصطناعي — عربي أولًا، يعمل كـ APK و PWA',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        lang: 'ar',
        dir: 'rtl',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          },

        ],
        categories: ['developer', 'productivity', 'utilities'],
        screenshots: [],
        shortcuts: [
          {
            name: 'مشروع جديد',
            short_name: 'جديد',
            description: 'إنشاء مشروع جديد',
            url: '/new-project',
            icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.github\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'github-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /^https:\/\/.*\.namethatui\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'namethatui-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@skills': path.resolve(__dirname, './src/skills'),
      '@app': path.resolve(__dirname, './src/app'),
      '@features': path.resolve(__dirname, './src/features'),
      '@agents': path.resolve(__dirname, './src/agents'),
      '@llm': path.resolve(__dirname, './src/llm'),
      '@vfs': path.resolve(__dirname, './src/vfs'),
      '@github': path.resolve(__dirname, './src/github'),
      '@ui-reference': path.resolve(__dirname, './src/ui-reference'),
      '@design': path.resolve(__dirname, './src/design'),
      '@i18n': path.resolve(__dirname, './src/i18n')
    }
  },
  server: {
    port: 5173,
    host: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost'
    }
  },
  build: {
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-toast',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
            '@radix-ui/react-tooltip'
          ],
          'vendor-codemirror': [
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/language',
            '@codemirror/autocomplete',
            '@codemirror/lint',
            '@codemirror/search'
          ],
          'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
          'vendor-tanstack': ['@tanstack/react-query', '@tanstack/react-table'],
          'vendor-framer': ['framer-motion'],
          'vendor-utils': ['zustand', 'clsx', 'tailwind-merge', 'class-variance-authority', 'zod', 'nanoid']
        }
      }
    }
  },
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(process.env.npm_package_version)
  }
});