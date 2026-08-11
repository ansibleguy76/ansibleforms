// Plugins
import basicSsl from '@vitejs/plugin-basic-ssl'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Pages from 'vite-plugin-pages'
import Vue from '@vitejs/plugin-vue'
// import VueRouter from 'unplugin-vue-router/vite'
import svgLoader from 'vite-svg-loader'

// Utilities
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
// read .env / .env.local etc, so VITE_DEV_HOST can be set once per machine instead of
// exported in the shell every time
const env = loadEnv(mode, process.cwd(), '')
return {
  // relative base, so a single build works under any subpath (issue #106)
  // the server rewrites the <base href="/"> tag in index.html at runtime (BASE_URL)
  base: './',
  plugins: [
    basicSsl(),
    svgLoader(
      {defaultImport: 'url'}
    ),
    Pages(),
    Vue({
      template: { 
        compilerOptions: {
          isCustomElement: tag => ['badge'].includes(tag),
        }
      }
    }),
    Components(),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        { 'vue-i18n': ['useI18n'] },
      ],
      eslintrc: {
        enabled: true,
      },
      vueTemplate: true,
    }),
  ],
  define: { 'process.env': {} },
  resolve: {
    dedupe: ['vue'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '~@': fileURLToPath(new URL('./src', import.meta.url))
    },
    extensions: [
      '.js',
      '.json',
      '.jsx',
      '.mjs',
      '.ts',
      '.tsx',
      '.vue',
    ],
  },
  build:{
    minify: 'terser',
    terserOptions: {
      mangle: {
        reserved: ["fnToTable", "fnArray", "fnGetNumberedName", "evalSandbox"]
      }
    },
  },
  optimizeDeps: {
    include: ['vue3-ace-editor', 'ace-builds']
  },
  server: {
    // localhost-only by default (security fix #465) ; set VITE_DEV_HOST in client/.env.local
    // (e.g. to true or an IP) to expose it, for a remote/SSH dev setup, without changing
    // the default for everyone. env vars are always strings, so "true" needs parsing -
    // passed through as-is it makes Vite resolve a literal hostname called "true"
    host: env.VITE_DEV_HOST === 'true' ? true : (env.VITE_DEV_HOST || '127.0.0.1'),
    port: 8443,
    proxy: {
      '/api/': {
        target: env.API_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }    
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['color-functions', 'global-builtin', 'import', 'if-function']
      },
    }
  },  
}
})
