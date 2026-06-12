// Plugins
import basicSsl from '@vitejs/plugin-basic-ssl'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Pages from 'vite-plugin-pages'
import Vue from '@vitejs/plugin-vue'
// import VueRouter from 'unplugin-vue-router/vite'
import svgLoader from 'vite-svg-loader'

// Utilities
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
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
    port: 8443,
    proxy: {
      '/api/': {
        target: 'http://172.16.50.4:3001',
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
})
