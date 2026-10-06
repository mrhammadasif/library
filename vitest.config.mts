import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: ['default', 'junit'],
    outputFile: { junit: 'test-results/unit/junit-unit.xml' },
    coverage: {
      provider: 'v8',
      reportsDirectory: 'test-results/coverage',
      include: ['src/utils/**', 'src/api/ApiError.ts', 'src/constants/Permissions.ts', 'shared/**'],
      exclude: ['src/utils/Storage.ts', 'src/utils/ImagePrep.ts', 'src/utils/CoverPhoto.ts', 'src/utils/Invite.ts', 'src/utils/AuditNav.ts', 'shared/contracts/**'],
    },
  },
})
