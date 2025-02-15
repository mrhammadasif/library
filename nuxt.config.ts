// https://nuxt.com/docs/api/configuration/nuxt-config
import naiveui from './naive.config'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  ssr: false,
  sourcemap: true,
  debug: true,
  naiveui: naiveui(),
  nitro: {
    experimental: {
      openAPI: true,
      envExpansion: true,
    },
  },
  modules: [
    '@scalar/nuxt',
    '@vueuse/nuxt',
    '@prisma/nuxt',
    '@bg-dev/nuxt-naiveui',
    '@unocss/nuxt',
  ],
})
