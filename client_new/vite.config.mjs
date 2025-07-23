// Plugins
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Fonts from 'unplugin-fonts/vite'
import Pages from 'vite-plugin-pages'
import Vue from '@vitejs/plugin-vue'
import VueRouter from 'unplugin-vue-router/vite'
import svgLoader from 'vite-svg-loader'

// Utilities
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    VueRouter({
      logs: true,
      routesFolder: 'src/pages',
    }),
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
    Fonts({
      google: {
        families: [{
          name: 'Roboto',
          styles: 'wght@100;300;400;500;700;900',
        }],
      },
    }),
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
    base: './'
  },
  server: {
    port: 8000,
    proxy: {
      '/api': {
        target: 'http://172.16.50.4:3001',
        changeOrigin: true,
        secure: false,
      },
      '/api-docs': {
        target: 'http://172.16.50.4:3001',
        changeOrigin: true,
        secure: false,
      }
    }    
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['mixed-decls', 'color-functions', 'global-builtin', 'import']
      },
    }
  },  
})
