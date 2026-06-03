import fs from 'node:fs';
import path from 'node:path';

describe('MainScreen selection overlay ordering', () => {
  it('renders SelectionOverlay after WebView in the runtime iOS MainScreen', () => {
    const sourcePath = path.join(__dirname, '..', 'SenseiMobile', 'src', 'mobile', 'MainScreen.tsx');
    const src = fs.readFileSync(sourcePath, 'utf8');
    const webViewIdx = src.indexOf('<WebView');
    const overlayIdx = src.indexOf('<SelectionOverlay');
    expect(webViewIdx).toBeGreaterThanOrEqual(0);
    expect(overlayIdx).toBeGreaterThanOrEqual(0);
    expect(webViewIdx).toBeLessThan(overlayIdx);
  });
});
