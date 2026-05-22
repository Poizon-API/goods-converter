import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    // configDefaults.exclude уже содержит node_modules/dist/etc., но не покрывает
    // .claude/worktrees — git-worktree-копии с устаревшими test-файлами цепляются
    // дефолтным include и падают с templateId=undefined.
    exclude: [...configDefaults.exclude, '.claude/**', '**/.claude/**'],
    coverage: {
      reporter: ['json-summary', 'html'],
      provider: 'v8',
    }
  }
})
