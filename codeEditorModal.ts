import { EditorState } from '@codemirror/state';
import { EditorView, keymap, drawSelection, highlightActiveLine, highlightSpecialChars, lineNumbers } from '@codemirror/view';
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentOnInput, syntaxHighlighting, HighlightStyle, bracketMatching, indentUnit } from '@codemirror/language';
import { cpp } from '@codemirror/lang-cpp';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import { logger } from './logger';

type AppendHandler = (code: string) => void;

type InitOptions = {
    textarea: HTMLTextAreaElement;
    onAppend?: AppendHandler;
};

let overlay: HTMLDivElement | null = null;
let modal: HTMLDivElement | null = null;
let editorRoot: HTMLDivElement | null = null;
let clearButton: HTMLButtonElement | null = null;
let insertButton: HTMLButtonElement | null = null;
let closeButton: HTMLButtonElement | null = null;
let fullscreenButton: HTMLButtonElement | null = null;
let textareaRef: HTMLTextAreaElement | null = null;
let appendHandler: AppendHandler | null = null;
let editorView: EditorView | null = null;
let initialized = false;
let isFullscreen = false;
let codeCache = '';
let activeElementBeforeOpen: HTMLElement | null = null;
let focusableElements: HTMLElement[] = [];

type EditorPalette = {
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    gutterBackground: string;
    gutterText: string;
    selection: string;
    caret: string;
    activeLine: string;
    matchingBracket: string;
    keyword: string;
    string: string;
    number: string;
    comment: string;
    type: string;
    fn: string;
    variable: string;
    variableDefinition: string;
    variableLocal: string;
    property: string;
    operator: string;
    punctuation: string;
    constant: string;
    accent: string;
};

function buildPalette(): EditorPalette {
    const styles = getComputedStyle(document.documentElement);
    const resolve = (name: string, fallback: string) => {
        const value = styles.getPropertyValue(name).trim();
        return value || fallback;
    };
    return {
        background: resolve('--code-editor-background', 'rgba(8, 16, 28, 0.88)'),
        surface: resolve('--code-editor-surface', 'rgba(12, 22, 36, 0.94)'),
        textPrimary: resolve('--code-editor-text', '#f1f5f9'),
        textSecondary: resolve('--code-editor-muted', 'rgba(226, 232, 240, 0.7)'),
        border: resolve('--code-editor-border', 'rgba(148, 163, 184, 0.35)'),
        gutterBackground: resolve('--code-editor-gutter', 'rgba(8, 16, 28, 0.88)'),
        gutterText: resolve('--code-editor-gutter-text', '#5ec6ff'),
        selection: resolve('--code-editor-selection', 'rgba(74, 179, 255, 0.28)'),
        caret: resolve('--code-editor-caret', '#facc15'),
        activeLine: resolve('--code-editor-line-active', 'rgba(148, 163, 184, 0.14)'),
        matchingBracket: resolve('--code-editor-bracket', '#5eead4'),
        keyword: resolve('--code-editor-keyword', '#9f7be9'),
        string: resolve('--code-editor-string', '#ffa088'),
        number: resolve('--code-editor-number', '#ffa088'),
        comment: resolve('--code-editor-comment', 'rgba(168, 190, 220, 0.58)'),
        type: resolve('--code-editor-type', '#86f6c0'),
        fn: resolve('--code-editor-function', '#7aa0ff'),
        variable: resolve('--code-editor-variable', '#b96d58'),
        variableDefinition: resolve('--code-editor-variable-definition', '#74ddff'),
        variableLocal: resolve('--code-editor-variable-local', '#7ff5d3'),
        property: resolve('--code-editor-property', '#ffb366'),
        operator: resolve('--code-editor-operator', '#ff3b3b'),
        punctuation: resolve('--code-editor-punctuation', '#caa3ff'),
        constant: resolve('--code-editor-constant', '#ffe78f'),
        accent: resolve('--code-editor-accent', '#7aa0ff')
    };
}

function createHighlightStyle(palette: EditorPalette) {
    return HighlightStyle.define([
        { tag: [tags.keyword, tags.operatorKeyword], color: palette.keyword },
        { tag: [tags.string, tags.character], color: palette.number },
        { tag: [tags.number, tags.integer, tags.float], color: palette.number },
        { tag: [tags.comment, tags.lineComment, tags.blockComment], color: palette.comment, fontStyle: 'italic' },
        { tag: [tags.typeName, tags.className], color: palette.type },
        { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: palette.fn, fontWeight: '600' },
        { tag: tags.definition(tags.variableName), color: palette.fn, fontWeight: '600' },
        { tag: tags.local(tags.variableName), color: palette.variableLocal },
        { tag: tags.variableName, color: palette.variable },
        { tag: tags.propertyName, color: palette.property },
        { tag: [tags.bool, tags.null, tags.atom], color: palette.constant },
        { tag: [tags.operator, tags.arithmeticOperator, tags.logicOperator], color: palette.operator },
        { tag: [tags.punctuation, tags.bracket], color: palette.punctuation }
    ]);
}

function logCodeEditorValidator(event: string, payload?: Record<string, unknown>): void {
    if (payload && Object.keys(payload).length > 0) {
        logger.info('[CODE_EDITOR_VALIDATION]', { event, ...payload });
    } else {
        logger.info('[CODE_EDITOR_VALIDATION]', { event });
    }
}

const updateListener = EditorView.updateListener.of(update => {
    if (update.docChanged) {
        codeCache = update.state.doc.toString();
    }
});

function buildEditorExtensions(palette: EditorPalette) {
    const theme = EditorView.theme({
        '&': {
            backgroundColor: palette.surface,
            color: palette.textPrimary,
            height: '100%'
        },
        '.cm-scroller': {
            overflow: 'auto',
            backgroundColor: palette.background
        },
        '.cm-content': {
            fontFamily: 'var(--font-code)',
            fontSize: '0.94rem',
            caretColor: palette.caret
        },
        '.cm-gutters': {
            backgroundColor: palette.gutterBackground,
            color: palette.gutterText,
            border: 'none'
        },
        '.cm-activeLine': {
            backgroundColor: palette.activeLine
        },
        '.cm-activeLineGutter': {
            backgroundColor: palette.activeLine,
            color: palette.gutterText
        },
        '.cm-selectionLayer .cm-selectionBackground': {
            backgroundColor: palette.selection
        },
        '.cm-selectionBackground': {
            backgroundColor: palette.selection
        },
        '.cm-content ::selection': {
            backgroundColor: palette.selection,
            color: palette.textPrimary
        },
        '.cm-cursor': {
            borderLeftColor: palette.caret
        },
        '&.cm-focused .cm-selectionBackground': {
            backgroundColor: palette.selection
        },
        '&.cm-focused .cm-content ::selection': {
            backgroundColor: palette.selection,
            color: palette.textPrimary
        },
        '.cm-panels': {
            backgroundColor: palette.surface,
            color: palette.textPrimary
        },
        '.cm-matchingBracket': {
            color: palette.matchingBracket,
            borderBottom: `1px solid ${palette.matchingBracket}`,
            fontWeight: '600'
        }
    }, { dark: true });
    const paletteSummary = {
        surface: palette.surface,
        textPrimary: palette.textPrimary,
        accent: palette.accent
    };
    logCodeEditorValidator('theme-prepared', { palette: paletteSummary });
    return [
        indentUnit.of('  '),
        EditorState.tabSize.of(2),
        lineNumbers(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        closeBrackets(),
        autocompletion(),
        indentOnInput(),
        highlightActiveLine(),
        bracketMatching(),
        syntaxHighlighting(createHighlightStyle(palette), { fallback: true }),
        EditorView.lineWrapping,
        keymap.of([
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
            ...closeBracketsKeymap
        ]),
        theme,
        updateListener
    ];
}

function defaultAppend(code: string) {
    if (!textareaRef) return;
    const prefix = textareaRef.value && !textareaRef.value.endsWith('\n') ? '\n' : '';
    textareaRef.value = `${textareaRef.value}${prefix}${code}\n`;
    textareaRef.dispatchEvent(new Event('input', { bubbles: true }));
    textareaRef.focus();
}

export function setCodeEditorContentAndOpen(code: string) {
    const normalized = code.replace(/\r\n?/g, '\n');
    const seeded = normalized.endsWith('\n') || normalized.length === 0 ? normalized : `${normalized}\n`;
    codeCache = seeded;
    if (editorView) {
        const currentDoc = editorView.state.doc.toString();
        if (currentDoc !== codeCache) {
            editorView.dispatch({
                changes: { from: 0, to: currentDoc.length, insert: codeCache }
            });
        }
    }
    logCodeEditorValidator('content-seeded', { length: codeCache.length });
    openCodeEditorModal();
}

function ensureEditor() {
    if (!editorRoot) return;
    const palette = buildPalette();
    const paletteSnapshot = {
        surface: palette.surface,
        textPrimary: palette.textPrimary,
        accent: palette.accent
    };
    logCodeEditorValidator('palette-resolved', { palette: paletteSnapshot });

    if (editorView) {
        const currentDoc = editorView.state.doc.toString();
        if (currentDoc !== codeCache) {
            editorView.dispatch({
                changes: { from: 0, to: currentDoc.length, insert: codeCache }
            });
        }
        updateFocusableElements();
        editorView.focus();
        return;
    }

    const baseExtensions = buildEditorExtensions(palette);
    const state = EditorState.create({
        doc: codeCache,
        extensions: [
            ...baseExtensions,
            cpp()
        ]
    });

    editorView = new EditorView({
        state,
        parent: editorRoot
    });
    logCodeEditorValidator('editor-view-initialized', { docLength: codeCache.length });
    updateFocusableElements();
}

function updateFocusableElements() {
    focusableElements = [];
    if (editorView) focusableElements.push(editorView.contentDOM);
    if (fullscreenButton) focusableElements.push(fullscreenButton);
    if (clearButton) focusableElements.push(clearButton);
    if (insertButton) focusableElements.push(insertButton);
    if (closeButton) focusableElements.push(closeButton);
}

function handleKeydown(event: KeyboardEvent) {
    if (!modal || !overlay) return;

    if (event.key === 'Escape') {
        if (isFullscreen) {
            toggleFullscreen();
        } else {
            closeCodeEditorModal();
        }
        event.preventDefault();
        return;
    }

    if (event.key === 'Tab') {
        if (editorView && editorView.contentDOM.contains(event.target as Node)) {
            return;
        }

        if (focusableElements.length === 0) return;
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
            if (document.activeElement === first) {
                last.focus();
                event.preventDefault();
            }
        } else {
            if (document.activeElement === last) {
                first.focus();
                event.preventDefault();
            }
        }
    }
}

function handleOverlayClick(event: MouseEvent) {
    if (event.target === overlay) {
        closeCodeEditorModal();
    }
}

function handleClear() {
    if (!editorView) return;
    const currentDoc = editorView.state.doc.length;
    editorView.dispatch({
        changes: { from: 0, to: currentDoc, insert: '' }
    });
    codeCache = '';
    editorView.focus();
}

function handleInsert() {
    const text = editorView ? editorView.state.doc.toString() : codeCache;
    if (!text.trim()) {
        closeCodeEditorModal();
        return;
    }
    const fenced = '```cpp\n' + text + '\n```';
    const handler = appendHandler ?? defaultAppend;
    handler(fenced);
    logCodeEditorValidator('code-inserted', { insertedLength: fenced.length });
    closeCodeEditorModal();
}

function attachListeners() {
    if (!overlay || !modal || !clearButton || !insertButton || !closeButton || !fullscreenButton) return;
    overlay.addEventListener('click', handleOverlayClick);
    clearButton.addEventListener('click', handleClear);
    insertButton.addEventListener('click', handleInsert);
    closeButton.addEventListener('click', closeCodeEditorModal);
    fullscreenButton.addEventListener('click', toggleFullscreen);
}

function detachListeners() {
    if (!overlay || !modal || !clearButton || !insertButton || !closeButton || !fullscreenButton) return;
    overlay.removeEventListener('click', handleOverlayClick);
    clearButton.removeEventListener('click', handleClear);
    insertButton.removeEventListener('click', handleInsert);
    closeButton.removeEventListener('click', closeCodeEditorModal);
    fullscreenButton.removeEventListener('click', toggleFullscreen);
}

function setVisibility(visible: boolean) {
    if (!overlay || !modal) return;
    if (visible) {
        overlay.classList.add('code-editor-overlay--visible');
        overlay.style.display = 'flex';
        overlay.setAttribute('aria-hidden', 'false');
    } else {
        overlay.classList.remove('code-editor-overlay--visible');
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
    }
}

export function initializeCodeEditorModal(options: InitOptions) {
    if (initialized) return;

    overlay = document.getElementById('code-editor-overlay') as HTMLDivElement | null;
    modal = document.getElementById('code-editor-modal') as HTMLDivElement | null;
    editorRoot = document.getElementById('code-editor-root') as HTMLDivElement | null;
    clearButton = document.getElementById('code-editor-clear-button') as HTMLButtonElement | null;
    insertButton = document.getElementById('code-editor-insert-button') as HTMLButtonElement | null;
    closeButton = document.getElementById('code-editor-close-button') as HTMLButtonElement | null;
    fullscreenButton = document.getElementById('code-editor-fullscreen-button') as HTMLButtonElement | null;

    if (!overlay || !modal || !editorRoot || !clearButton || !insertButton || !closeButton || !fullscreenButton) {
        logger.warn('[CODE_EDITOR] Modal elements missing');
        return;
    }

    editorRoot.setAttribute('tabindex', '-1');
    textareaRef = options.textarea;
    appendHandler = options.onAppend ?? defaultAppend;
    logCodeEditorValidator('modal-prepared', {});
    attachListeners();
    initialized = true;
    logCodeEditorValidator('modal-initialized', {});
}

export function openCodeEditorModal() {
    if (!initialized || !overlay || !modal) return;
    activeElementBeforeOpen = document.activeElement as HTMLElement | null;
    setVisibility(true);
    requestAnimationFrame(() => {
        ensureEditor();
        updateFocusableElements();
        document.addEventListener('keydown', handleKeydown, true);
        editorView?.focus();
        logCodeEditorValidator('modal-opened', {});
    });
}

export function closeCodeEditorModal() {
    if (!initialized || !overlay || !modal) return;
    setVisibility(false);
    document.removeEventListener('keydown', handleKeydown, true);
    if (editorView) {
        codeCache = editorView.state.doc.toString();
    }
    if (isFullscreen) {
        toggleFullscreen();
    }
    focusableElements = [];
    if (activeElementBeforeOpen) {
        activeElementBeforeOpen.focus();
    }
    logCodeEditorValidator('modal-closed', {});
}

export function toggleFullscreen() {
    if (!modal) return;
    isFullscreen = !isFullscreen;
    if (isFullscreen) {
        modal.classList.add('code-editor-modal--fullscreen');
    } else {
        modal.classList.remove('code-editor-modal--fullscreen');
    }
    requestAnimationFrame(() => editorView?.focus());
}

export function isCodeEditorModalOpen() {
    return Boolean(initialized && overlay && overlay.classList.contains('code-editor-overlay--visible'));
}

export function disposeCodeEditorModal() {
    if (!initialized) return;
    document.removeEventListener('keydown', handleKeydown, true);
    detachListeners();
    if (editorView) {
        editorView.destroy();
        editorView = null;
    }
    overlay = null;
    modal = null;
    if (editorRoot) {
        editorRoot.innerHTML = '';
    }
    editorRoot = null;
    clearButton = null;
    insertButton = null;
    closeButton = null;
    fullscreenButton = null;
    textareaRef = null;
    appendHandler = null;
    focusableElements = [];
    initialized = false;
}
