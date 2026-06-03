export interface LayoutFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DOMRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportSnapshotLike {
  width: number;
  height: number;
  scrollY: number;
}

export interface ToolbarSize {
  width: number;
  height: number;
}

export type SelectionToolbarPlacement = 'above' | 'below';

export interface SelectionToolbarLayout {
  top: number;
  left: number;
  placement: SelectionToolbarPlacement;
  scale: number;
}

export function computeSelectionToolbarLayout(options: {
  selectionRect: DOMRectLike;
  viewport: ViewportSnapshotLike;
  webViewFrame: LayoutFrame;
  toolbarSize: ToolbarSize;
  margin?: number;
  offset?: number;
}): SelectionToolbarLayout {
  const margin = options.margin ?? 10;
  const offset = options.offset ?? 8;

  const selectionRectInViewport = {
    x: options.selectionRect.x,
    y: options.selectionRect.y - options.viewport.scrollY,
    width: options.selectionRect.width,
    height: options.selectionRect.height
  };

  const selectionCenterX =
    options.webViewFrame.x + selectionRectInViewport.x + selectionRectInViewport.width / 2;
  const selectionTopY = options.webViewFrame.y + selectionRectInViewport.y;
  const selectionBottomY = selectionTopY + selectionRectInViewport.height;

  const availableWidth = Math.max(0, options.webViewFrame.width - margin * 2);
  const rawToolbarWidth = Math.max(0, options.toolbarSize.width);
  const rawToolbarHeight = Math.max(0, options.toolbarSize.height);

  const scale =
    rawToolbarWidth > 0 && rawToolbarWidth > availableWidth ? availableWidth / rawToolbarWidth : 1;

  const toolbarWidth = rawToolbarWidth * scale;
  const toolbarHeight = rawToolbarHeight * scale;

  const minLeft = options.webViewFrame.x + margin;
  const maxLeft = options.webViewFrame.x + options.webViewFrame.width - margin - toolbarWidth;
  const unclampedLeft = selectionCenterX - toolbarWidth / 2;
  const left = Math.min(Math.max(unclampedLeft, minLeft), maxLeft);

  const minTop = options.webViewFrame.y + margin;
  const maxTop = options.webViewFrame.y + options.webViewFrame.height - margin - toolbarHeight;

  let placement: SelectionToolbarPlacement = 'above';
  let top = selectionTopY - toolbarHeight - offset;

  if (top < minTop) {
    placement = 'below';
    top = selectionBottomY + offset;
  }

  if (top + toolbarHeight > options.webViewFrame.y + options.webViewFrame.height - margin) {
    placement = 'above';
    top = selectionTopY - toolbarHeight - offset;
  }

  top = Math.min(Math.max(top, minTop), maxTop);

  return { top, left, placement, scale };
}
