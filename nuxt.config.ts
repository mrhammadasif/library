// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['nuxtjs-naive-ui'],
  buildModules: [
    '@nuxtjs/eslint-module'
  ],
  eslint: {
    fix: true
  }
})