import fs from 'fs'
import path from 'path'

const repoRoot = path.resolve(__dirname, '..')

const readRepoFile = (relativePath: string): string => {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

describe('mobile WebView credential safety', () => {
  test('source and generated mobile bundle do not embed Gemini API keys', () => {
    const source = readRepoFile('src/index.tsx')
    const bundle = readRepoFile('SenseiMobile/app_web/webview_dist/index.js')

    expect(source).not.toMatch(/AIza[0-9A-Za-z_-]+/)
    expect(bundle).not.toMatch(/AIza[0-9A-Za-z_-]+/)
    expect(source).not.toMatch(/__senseiCurrentApiKey\s*=/)
    expect(bundle).not.toMatch(/__senseiCurrentApiKey\s*=/)
  })

  test('API key diagnostics report configuration state without logging key values', () => {
    const source = readRepoFile('src/index.tsx')
    const moduleSelection = readRepoFile('src/moduleSelectionHandler.ts')

    expect(source).toContain("configured: Boolean(API_KEY)")
    expect(moduleSelection).toContain('configured: apiKeyConfigured')
    expect(source).not.toMatch(/key:\s*API_KEY/)
    expect(moduleSelection).not.toMatch(/key:\s*currentApiKey/)
  })
})
