
import { logger } from './logger';

function logMermaidValidation(event, payload) {
  logger.info('[MERMAID_VALIDATION]', { event, ...payload });
}

let mermaidAnnotationSuccessLogged = false;

/**
 * Mermaid Theme Integration for Recursive Sensei
 * Handles rendering of Mermaid diagrams with theme support
 * 
 * Optimization: Lightbox rendering only re-renders diagrams when the theme has changed.
 * If the theme hasn't changed since thumbnail creation, it uses a fast path that simply
 * clones and scales the existing SVG, avoiding expensive mermaid.render() calls.
 */

/**
 * Render a Mermaid diagram thumbnail with theme support
 * @param {HTMLElement} preElement - The pre element to replace
 * @param {string} rawSvgContent - The SVG content from Mermaid
 * @param {string} themeName - Theme to apply
 * @param {string} rawMermaidCode - The original Mermaid code (optional)
 */
export function renderMermaidThumbnailWithTheme(preElement, rawSvgContent, themeName = null, rawMermaidCode = '') {
    // Use mermaidManager's current theme if no theme specified
    if (!themeName && window.mermaidManager) {
        themeName = window.mermaidManager.getCurrentTheme();
    }
    // Use DEFAULT_MERMAID_THEME as fallback, with final fallback to 'neon'
    themeName = themeName || window.DEFAULT_MERMAID_THEME || 'neon';
    const thumbnail = document.createElement('div');
    thumbnail.className = 'mermaid-thumbnail';
    
    // Apply theme class using utility function if available, otherwise fallback
    if (window.updateMermaidThemeClass) {
        window.updateMermaidThemeClass(thumbnail, themeName);
    } else {
        thumbnail.classList.add(`mermaid-theme-${themeName}`);
    }
    
    // Store the theme used during rendering
    thumbnail.dataset.theme = themeName;
    
    // Store the raw Mermaid code for lightbox re-rendering
    if (rawMermaidCode) {
        thumbnail.dataset.mermaidCode = rawMermaidCode;
    }
    
    // Aspect ratio detection logic
    try {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(rawSvgContent, "image/svg+xml");
        const svgElement = svgDoc.querySelector('svg');

        if (svgElement) {
            const viewBox = svgElement.getAttribute('viewBox');
            if (viewBox) {
                const parts = viewBox.split(' ').map(Number);
                if (parts.length === 4) {
                    const viewboxWidth = parts[2];
                    const viewboxHeight = parts[3];

                    if (viewboxWidth > viewboxHeight) {
                        thumbnail.classList.add('mermaid-thumbnail--horizontal');
                    } else {
                        thumbnail.classList.add('mermaid-thumbnail--vertical');
                    }
                }
            }
            thumbnail.innerHTML = svgElement.outerHTML;
        } else {
            thumbnail.innerHTML = rawSvgContent;
        }
    } catch (e) {
        logger.error("Error parsing SVG for aspect ratio detection:", e);
        thumbnail.innerHTML = rawSvgContent;
    }

    preElement.replaceWith(thumbnail);

    if (thumbnail.parentElement && !thumbnail.parentElement.classList.contains('mermaid-figure')) {
        const figure = document.createElement('div');
        figure.className = 'mermaid-figure';
        if (thumbnail.classList.contains('mermaid-thumbnail--horizontal')) {
            figure.classList.add('mermaid-thumbnail--horizontal');
        }
        if (thumbnail.classList.contains('mermaid-thumbnail--vertical')) {
            figure.classList.add('mermaid-thumbnail--vertical');
        }
        thumbnail.replaceWith(figure);
        figure.appendChild(thumbnail);

        const getNextElementSkippingArtifacts = (startNode) => {
            let node = startNode;
            while (node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const trimmed = node.textContent ? node.textContent.trim() : '';
                    if (!trimmed) {
                        node = node.nextSibling;
                        continue;
                    }
                    if (trimmed === '```') {
                        const next = node.nextSibling;
                        node.parentNode?.removeChild(node);
                        logMermaidValidation('stray-backticks-removed', { nodeType: 'text' });
                        node = next;
                        continue;
                    }
                    node = node.nextSibling;
                    continue;
                }

                if (node instanceof HTMLElement) {
                    const trimmed = node.textContent ? node.textContent.trim() : '';
                    if (trimmed === '```' && node.tagName.toLowerCase() !== 'code') {
                        const tag = node.tagName.toLowerCase();
                        const next = node.nextSibling;
                        node.remove();
                        logMermaidValidation('stray-backticks-removed', { nodeType: tag });
                        node = next;
                        continue;
                    }
                    if (!trimmed && node.childElementCount === 0) {
                        node = node.nextSibling;
                        continue;
                    }
                    return node;
                }

                node = node.nextSibling;
            }
            return null;
        };

        let sibling = getNextElementSkippingArtifacts(figure.nextSibling);
        let annotationElement = null;
        if (sibling instanceof HTMLElement) {
            const tagName = sibling.tagName.toLowerCase();
            if (tagName === 'p') {
                const firstChild = sibling.firstElementChild;
                const trimmed = sibling.textContent ? sibling.textContent.trim() : '';
                if (firstChild && firstChild.tagName.toLowerCase() === 'em' && sibling.childElementCount === 1 && trimmed.length > 0) {
                    annotationElement = sibling;
                }
            } else if (tagName === 'pre') {
                const codeChild = sibling.firstElementChild;
                const codeTag = codeChild && codeChild.tagName ? codeChild.tagName.toLowerCase() : '';
                const rawCaption = codeChild && codeChild.textContent ? codeChild.textContent.trim() : '';
                const newlineCount = rawCaption ? (rawCaption.match(/\n/g) || []).length : 0;
                if (codeTag === 'code' && rawCaption && rawCaption.length <= 500 && newlineCount <= 1) {
                    let cleaned = rawCaption.replace(/^```/, '').replace(/```$/, '').trim();
                    let emphasizeText = cleaned;
                    if (emphasizeText.startsWith('*') && emphasizeText.endsWith('*') && emphasizeText.length > 2) {
                        emphasizeText = emphasizeText.slice(1, -1).trim();
                    }
                    const hasCodeIndicators = /[{};=<>]/.test(emphasizeText) || /\b(function|class|return)\b/i.test(emphasizeText);
                    if (emphasizeText && !hasCodeIndicators) {
                        const paragraph = document.createElement('p');
                        const emphasis = document.createElement('em');
                        emphasis.textContent = emphasizeText;
                        paragraph.appendChild(emphasis);
                        paragraph.classList.add('mermaid-annotation');
                        sibling.remove();
                        figure.appendChild(paragraph);
                        annotationElement = paragraph;
                    }
                }
            }
        }
        if (annotationElement) {
            const sentenceCount = annotationElement.textContent
                ? annotationElement.textContent.split(/[.!?]+/).map((segment) => segment.trim()).filter((segment) => segment.length > 0).length
                : 0;
            annotationElement.classList.add('mermaid-annotation');
            if (!figure.contains(annotationElement)) {
                figure.appendChild(annotationElement);
            }
            if (!mermaidAnnotationSuccessLogged && sentenceCount > 0) {
                logMermaidValidation('caption-aligned', { sentenceCount });
                mermaidAnnotationSuccessLogged = true;
            }

            getNextElementSkippingArtifacts(annotationElement.nextSibling);
        }
    }

    // Lightbox functionality
    thumbnail.addEventListener('click', async (event) => {
        event.stopPropagation();
        const mermaidCode = thumbnail.dataset.mermaidCode;
        const storedTheme = thumbnail.dataset.theme || themeName;
        const currentTheme = window.mermaidManager ? window.mermaidManager.getCurrentTheme() : storedTheme;
        const lightbox = document.createElement('div');
        lightbox.className = 'mermaid-lightbox';
        if (window.updateMermaidThemeClass) {
            window.updateMermaidThemeClass(lightbox, currentTheme);
        } else {
            lightbox.classList.add(`mermaid-theme-${currentTheme}`);
        }
        const content = document.createElement('div');
        content.className = 'mermaid-lightbox__content';
        content.tabIndex = 0;
        lightbox.appendChild(content);
        const attachDiagram = (diagram) => {
            diagram.removeAttribute('width');
            diagram.removeAttribute('height');
            diagram.style.width = '';
            diagram.style.height = '';
            diagram.style.transform = '';
            diagram.classList.add('mermaid-lightbox__diagram');
            content.innerHTML = '';
            content.appendChild(diagram);
        };
        const needsRerender = mermaidCode && window.mermaidManager && storedTheme !== currentTheme;
        if (needsRerender) {
            try {
                logMermaidValidation('theme-rerender', {
                    fromTheme: storedTheme,
                    toTheme: currentTheme
                });
                const uniqueId = `lightbox-mermaid-${Date.now()}-${Math.random().toString(36).substring(2)}`;
                const { svg: freshSvg } = await window.mermaidManager.render(uniqueId, mermaidCode);
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(freshSvg, "image/svg+xml");
                const svgElement = svgDoc.querySelector('svg');
                if (svgElement) {
                    attachDiagram(svgElement);
                    thumbnail.dataset.theme = currentTheme;
                } else {
                    logger.warn('Re-render succeeded but no SVG element found, falling back to cloning');
                    const existingSvg = thumbnail.querySelector('svg');
                    if (existingSvg) {
                        const clonedSvg = existingSvg.cloneNode(true);
                        attachDiagram(clonedSvg);
                    } else {
                        content.innerHTML = thumbnail.innerHTML;
                    }
                }
            } catch (error) {
                logger.error('Failed to re-render Mermaid in lightbox:', error);
                const svgElement = thumbnail.querySelector('svg');
                if (svgElement) {
                    const clonedSvg = svgElement.cloneNode(true);
                    attachDiagram(clonedSvg);
                } else {
                    content.innerHTML = thumbnail.innerHTML;
                }
            }
        } else {
            const svgElement = thumbnail.querySelector('svg');
            if (svgElement) {
                const clonedSvg = svgElement.cloneNode(true);
                attachDiagram(clonedSvg);
            } else {
                content.innerHTML = thumbnail.innerHTML;
            }
        }
        const diagram = content.querySelector('.mermaid-lightbox__diagram');
        const scale = 1.75;
        const clamp = (value) => Math.min(Math.max(value, 0), 1);
        const updateZoomTransform = (sourceEvent) => {
            if (!diagram) {
                return;
            }
            if (content.dataset.zoomed !== 'true') {
                diagram.style.transform = '';
                return;
            }
            const rect = content.getBoundingClientRect();
            const width = rect.width || 1;
            const height = rect.height || 1;
            let xRatio = 0.5;
            let yRatio = 0.5;
            if (sourceEvent) {
                xRatio = (sourceEvent.clientX - rect.left) / width;
                yRatio = (sourceEvent.clientY - rect.top) / height;
            }
            xRatio = clamp(xRatio);
            yRatio = clamp(yRatio);
            const offsetX = (0.5 - xRatio) * (scale - 1) * width;
            const offsetY = (0.5 - yRatio) * (scale - 1) * height;
            diagram.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        };
        const setZoomState = (shouldZoom, sourceEvent) => {
            if (shouldZoom) {
                content.dataset.zoomed = 'true';
                content.classList.add('mermaid-lightbox__content--zoomed');
                updateZoomTransform(sourceEvent);
            } else {
                delete content.dataset.zoomed;
                content.classList.remove('mermaid-lightbox__content--zoomed');
                updateZoomTransform();
            }
        };
        if (diagram) {
            diagram.addEventListener('click', (diagramEvent) => {
                diagramEvent.stopPropagation();
                const nextZoom = content.dataset.zoomed === 'true' ? false : true;
                setZoomState(nextZoom, diagramEvent);
            });
        }
        content.addEventListener('click', (contentEvent) => {
            if (contentEvent.target === content) {
                document.body.removeChild(lightbox);
            }
        });
        const handlePointerMove = (moveEvent) => {
            if (content.dataset.zoomed === 'true') {
                updateZoomTransform(moveEvent);
            }
        };
        content.addEventListener('pointermove', handlePointerMove);
        document.body.appendChild(lightbox);
        lightbox.addEventListener('click', (closeEvent) => {
            if (closeEvent.target === lightbox) {
                document.body.removeChild(lightbox);
            }
        });
    });
}

export default {
    renderMermaidThumbnailWithTheme
};
