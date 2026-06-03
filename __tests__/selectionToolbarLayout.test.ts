import { computeSelectionToolbarLayout } from '../src/mobile/selectionToolbarLayout';

describe('computeSelectionToolbarLayout', () => {
  const webViewFrame = { x: 0, y: 100, width: 390, height: 600 };
  const viewport = { width: 390, height: 600, scrollY: 1000 };

  it('centers above selection when there is space', () => {
    const selectionRect = { x: 140, y: 1200, width: 60, height: 20 };
    const toolbarSize = { width: 300, height: 40 };

    const layout = computeSelectionToolbarLayout({ selectionRect, viewport, webViewFrame, toolbarSize });

    expect(layout.placement).toBe('above');
    expect(layout.scale).toBe(1);
    expect(layout.top).toBeLessThan(webViewFrame.y + (selectionRect.y - viewport.scrollY));
    expect(layout.left).toBeCloseTo(0 + (selectionRect.x + selectionRect.width / 2) - toolbarSize.width / 2, 3);
  });

  it('clamps to left boundary', () => {
    const selectionRect = { x: 0, y: 1200, width: 10, height: 20 };
    const toolbarSize = { width: 300, height: 40 };

    const layout = computeSelectionToolbarLayout({ selectionRect, viewport, webViewFrame, toolbarSize });

    expect(layout.left).toBe(webViewFrame.x + 10);
  });

  it('clamps to right boundary', () => {
    const selectionRect = { x: 380, y: 1200, width: 10, height: 20 };
    const toolbarSize = { width: 300, height: 40 };

    const layout = computeSelectionToolbarLayout({ selectionRect, viewport, webViewFrame, toolbarSize });

    expect(layout.left).toBe(webViewFrame.x + webViewFrame.width - 10 - toolbarSize.width);
  });

  it('flips below selection when above would go out of bounds', () => {
    const selectionRect = { x: 120, y: 1005, width: 60, height: 20 };
    const toolbarSize = { width: 300, height: 80 };

    const layout = computeSelectionToolbarLayout({ selectionRect, viewport, webViewFrame, toolbarSize });

    expect(layout.placement).toBe('below');
    expect(layout.top).toBeGreaterThan(
      webViewFrame.y + (selectionRect.y - viewport.scrollY) + selectionRect.height
    );
  });

  it('scales down when toolbar is wider than available width', () => {
    const selectionRect = { x: 120, y: 1200, width: 60, height: 20 };
    const toolbarSize = { width: 600, height: 40 };

    const layout = computeSelectionToolbarLayout({ selectionRect, viewport, webViewFrame, toolbarSize });

    expect(layout.scale).toBeLessThan(1);
    expect(layout.scale).toBeCloseTo((webViewFrame.width - 20) / toolbarSize.width, 3);
  });

  it('remains deterministic when toolbar dimensions are zero', () => {
    const selectionRect = { x: 120, y: 1200, width: 60, height: 20 };
    const toolbarSize = { width: 0, height: 0 };

    const layout = computeSelectionToolbarLayout({ selectionRect, viewport, webViewFrame, toolbarSize });

    expect(layout.scale).toBe(1);
    expect(Number.isFinite(layout.left)).toBe(true);
    expect(Number.isFinite(layout.top)).toBe(true);
  });
});
