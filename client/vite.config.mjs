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
      ],
      eslintrc: {
        enabled: true,
      },
      vueTemplate: true,
    }),
  ],
  define: { 'process.env': {} },
  resolve: {
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
    base: './',
    minify: 'terser',
    terserOptions: {
      mangle: {
        reserved: ["fnToTable", "fnArray", "fnGetNumberedName", "evalSandbox"]
      }
    },
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
