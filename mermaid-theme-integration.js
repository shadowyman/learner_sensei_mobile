
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
        let sibling = figure.nextSibling;
        while (sibling && sibling.nodeType !== Node.ELEMENT_NODE) {
            sibling = sibling.nextSibling;
        }
        let annotationElement = null;
        if (sibling instanceof HTMLElement && sibling.tagName.toLowerCase() === 'p') {
            const firstChild = sibling.firstElementChild;
            const trimmed = sibling.textContent ? sibling.textContent.trim() : '';
            if (firstChild && firstChild.tagName.toLowerCase() === 'em' && sibling.childElementCount === 1 && trimmed.length > 0) {
                annotationElement = sibling;
            }
        }
        if (annotationElement) {
            const sentenceCount = annotationElement.textContent
                ? annotationElement.textContent.split(/[.!?]+/).map((segment) => segment.trim()).filter((segment) => segment.length > 0).length
                : 0;
            annotationElement.classList.add('mermaid-annotation');
            figure.appendChild(annotationElement);
            if (!mermaidAnnotationSuccessLogged && sentenceCount > 0) {
                logMermaidValidation('caption-aligned', { sentenceCount });
                mermaidAnnotationSuccessLogged = true;
            }
        }
    }

    // Lightbox functionality
    thumbnail.addEventListener('click', async (e) => {
        e.stopPropagation();
        const lightbox = document.createElement('div');
        lightbox.className = 'mermaid-lightbox';
        
        // Check if we have the raw Mermaid code to potentially re-render
        const mermaidCode = thumbnail.dataset.mermaidCode;
        const storedTheme = thumbnail.dataset.theme || themeName;
        const currentTheme = window.mermaidManager ? window.mermaidManager.getCurrentTheme() : storedTheme;
        
        // Apply current theme to lightbox using utility function if available
        if (window.updateMermaidThemeClass) {
            window.updateMermaidThemeClass(lightbox, currentTheme);
        } else {
            lightbox.classList.add(`mermaid-theme-${currentTheme}`);
        }
        
        // Determine if re-rendering is needed
        const needsRerender = mermaidCode && window.mermaidManager && storedTheme !== currentTheme;
        
        if (needsRerender) {
            try {
                logMermaidValidation('theme-rerender', {
                    fromTheme: storedTheme,
                    toTheme: currentTheme
                });
                
                // Re-render the diagram with the current theme
                const uniqueId = `lightbox-mermaid-${Date.now()}-${Math.random().toString(36).substring(2)}`;
                const { svg: freshSvg } = await window.mermaidManager.render(uniqueId, mermaidCode);
                
                // Parse and display the fresh SVG
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(freshSvg, "image/svg+xml");
                const svgElement = svgDoc.querySelector('svg');
                
                if (svgElement) {
                    // Remove size constraints for better scaling in lightbox
                    svgElement.removeAttribute('width');
                    svgElement.removeAttribute('height');
                    svgElement.style.width = '';
                    svgElement.style.height = '';
                    lightbox.appendChild(svgElement);
                    
                    // Update the stored theme to reflect the re-render
                    thumbnail.dataset.theme = currentTheme;
                } else {
                    // Fallback to cloning existing SVG
                    logger.warn('Re-render succeeded but no SVG element found, falling back to cloning');
                    const existingSvg = thumbnail.querySelector('svg');
                    if (existingSvg) {
                        const clonedSvg = existingSvg.cloneNode(true);
                        clonedSvg.removeAttribute('width');
                        clonedSvg.removeAttribute('height');
                        clonedSvg.style.width = '';
                        clonedSvg.style.height = '';
                        lightbox.appendChild(clonedSvg);
                    } else {
                        lightbox.innerHTML = thumbnail.innerHTML;
                    }
                }
            } catch (error) {
                logger.error('Failed to re-render Mermaid in lightbox:', error);
                // Fallback: Clone the SVG from thumbnail
                const svgElement = thumbnail.querySelector('svg');
                if (svgElement) {
                    const clonedSvg = svgElement.cloneNode(true);
                    clonedSvg.removeAttribute('width');
                    clonedSvg.removeAttribute('height');
                    clonedSvg.style.width = '';
                    clonedSvg.style.height = '';
                    lightbox.appendChild(clonedSvg);
                } else {
                    lightbox.innerHTML = thumbnail.innerHTML;
                }
            }
        } else {
            // Fast path: Clone existing SVG without re-rendering
            const svgElement = thumbnail.querySelector('svg');
            if (svgElement) {
                const clonedSvg = svgElement.cloneNode(true);
                clonedSvg.removeAttribute('width');
                clonedSvg.removeAttribute('height');
                clonedSvg.style.width = '';
                clonedSvg.style.height = '';
                lightbox.appendChild(clonedSvg);
            } else {
                lightbox.innerHTML = thumbnail.innerHTML;
            }
        }
        
        document.body.appendChild(lightbox);
        lightbox.addEventListener('click', () => {
            document.body.removeChild(lightbox);
        }, { once: true });
    });
}

export default {
    renderMermaidThumbnailWithTheme
};
