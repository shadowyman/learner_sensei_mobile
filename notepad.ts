/**
 * @license
 * SPDX-License-Identifier: Apache-2.1
 */

import { logger } from './logger';
import { marked } from 'marked';
import { Curriculum } from './curriculum';
import { NotepadExporter } from './notepadExporter';
import { NotepadImporter, ImportedConceptGroup } from './notepadImporter';
import { showImportFailureModal } from './ui';

declare var Quill: any;

export interface Note {
    id: string;
    conceptId: string;
    conceptTitle: string;
    text: string;
    htmlContent?: string;
    quillDelta?: any;
    timestamp: Date;
}

interface ConceptGroup {
    id: string;
    title: string;
    notes: Note[];
    createdAt: Date;
}

interface NotepadState {
    concepts: ConceptGroup[];
    isOpen: boolean;
}

interface CurriculumContext {
    conceptId: string | null;
    conceptTitle: string | null;
    moduleTitle: string | null;
}

interface NotepadSnapshotNote {
    id: string;
    conceptId: string;
    conceptTitle: string;
    text: string;
    htmlContent?: string;
    quillDelta?: any;
    timestamp: string;
}

interface NotepadSnapshotConcept {
    id: string;
    title: string;
    createdAt: string;
    notes: NotepadSnapshotNote[];
}

const IMPORTED_NOTES_TITLE = 'Imported Notes';
const UNTITLED_CONCEPT_LABEL = 'Untitled Concept';

function logNotepadActivity(event: string, payload?: Record<string, unknown>): void {
    if (payload && Object.keys(payload).length > 0) {
        logger.info('[NOTEPAD_ACTIVITY]', { event, ...payload });
    } else {
        logger.info('[NOTEPAD_ACTIVITY]', { event });
    }
}

function logCustomConcept(event: string, payload?: Record<string, unknown>): void {
    if (payload && Object.keys(payload).length > 0) {
        logger.info('[NOTEPAD_CUSTOM_CONCEPTS]', { event, ...payload });
    } else {
        logger.info('[NOTEPAD_CUSTOM_CONCEPTS]', { event });
    }
}

function parseTimestamp(value: any): Date {
    if (value instanceof Date) {
        return new Date(value.getTime());
    }
    if (typeof value === 'number') {
        const fromNumber = new Date(value);
        if (!Number.isNaN(fromNumber.getTime())) {
            return fromNumber;
        }
    }
    if (typeof value === 'string') {
        const fromString = new Date(value);
        if (!Number.isNaN(fromString.getTime())) {
            return fromString;
        }
    }
    return new Date();
}

export class Notepad {
    private state: NotepadState = {
        concepts: [],
        isOpen: false
    };

    private modalElement: HTMLDivElement | null = null;
    private notepadButton: HTMLButtonElement | null = null;
    private curriculum: Curriculum | null = null;
    private activeQuillEditor: any = null;
    private exporter: NotepadExporter;
    private importer: NotepadImporter;
    private importInput: HTMLInputElement | null = null;
    private handleNoteClick: ((e: Event) => void) | null = null;
    private currentContext: CurriculumContext = {
        conceptId: null,
        conceptTitle: null,
        moduleTitle: null
    };
    private editingConceptId: string | null = null;
    private pendingConceptFocusId: string | null = null;
    private pendingNoteEditId: string | null = null;

    constructor() {
        this.exporter = new NotepadExporter();
        this.importer = new NotepadImporter();
    }

    public initialize(curriculum: Curriculum): void {
        this.curriculum = curriculum;
        this.createModal();
        this.attachEventListeners();
    }

    public setActiveCurriculumContext(context: Partial<CurriculumContext>): void {
        const providedConceptId = context.conceptId ?? null;
        const providedConceptTitle = context.conceptTitle !== undefined ? context.conceptTitle : this.currentContext.conceptTitle;
        const providedModuleTitle = context.moduleTitle !== undefined ? context.moduleTitle : this.currentContext.moduleTitle;

        let resolvedConceptId = this.currentContext.conceptId;
        if (providedConceptId !== null) {
            resolvedConceptId = providedConceptId;
        } else {
            const conceptTitleChanged = context.conceptTitle !== undefined && context.conceptTitle !== this.currentContext.conceptTitle;
            const moduleTitleChanged = context.moduleTitle !== undefined && context.moduleTitle !== this.currentContext.moduleTitle;
            if (conceptTitleChanged || moduleTitleChanged) {
                resolvedConceptId = null;
            }
        }

        this.currentContext = {
            conceptId: resolvedConceptId,
            conceptTitle: providedConceptTitle,
            moduleTitle: providedModuleTitle
        };
    }

    public addNote(selectedText: string, markdownText: string, htmlContent?: string): void {
        const concept = this.ensureConceptForCurrentContext();
        if (!concept) {
            logger.warn('Cannot add note: no active concept context');
            return;
        }

        const note: Note = {
            id: crypto.randomUUID(),
            conceptId: concept.id,
            conceptTitle: concept.title,
            text: markdownText,
            timestamp: new Date()
        };

        if (htmlContent !== undefined) {
            note.htmlContent = htmlContent;
        }

        this.appendNote(concept, note);
        logNotepadActivity('note-added', {
            conceptTitle: concept.title,
            totalNotes: this.getTotalNoteCount()
        });
        logCustomConcept('note-added', {
            conceptId: concept.id,
            noteId: note.id
        });

        if (this.state.isOpen) {
            this.renderNotes();
        }
    }

    private ensureConceptForCurrentContext(): ConceptGroup | null {
        if (this.currentContext.conceptId) {
            const existing = this.findConceptById(this.currentContext.conceptId);
            if (existing) {
                return existing;
            }
        }

        const titleSource = this.currentContext.conceptTitle ?? this.currentContext.moduleTitle;
        const normalizedTitle = this.normalizeConceptTitle(titleSource);
        const matched = this.state.concepts.find(group => group.title.toLowerCase() === normalizedTitle.toLowerCase());
        if (matched) {
            this.currentContext.conceptId = matched.id;
            return matched;
        }

        const concept = this.createConceptGroup(normalizedTitle, { startEditing: false });
        this.currentContext.conceptId = concept.id;
        return concept;
    }

    private createConceptGroup(title: string, options?: { startEditing: boolean }): ConceptGroup {
        const concept: ConceptGroup = {
            id: crypto.randomUUID(),
            title: this.normalizeConceptTitle(title),
            notes: [],
            createdAt: new Date()
        };
        this.state.concepts.push(concept);
        logCustomConcept('concept-created', {
            conceptId: concept.id,
            title: concept.title,
            order: this.state.concepts.length - 1
        });
        if (options?.startEditing) {
            this.editingConceptId = concept.id;
            this.pendingConceptFocusId = concept.id;
        }
        return concept;
    }

    private appendNote(concept: ConceptGroup, note: Note): void {
        concept.notes.push(note);
    }

    private getTotalNoteCount(): number {
        return this.state.concepts.reduce((total, group) => total + group.notes.length, 0);
    }

    private createModal(): void {
        this.modalElement = document.createElement('div');
        this.modalElement.id = 'notepad-modal';
        this.modalElement.className = 'notepad-modal';
        this.modalElement.style.display = 'none';

        this.modalElement.innerHTML = `
            <div class="notepad-modal-content">
                <div class="notepad-modal-header">
                    <h2 class="notepad-modal-title">📓 My Notes</h2>
                    <div class="notepad-header-controls">
                        <button id="notepad-add-concept-button" class="notepad-export-btn" title="Add new concept">➕</button>
                        <button id="notepad-import-button" class="notepad-export-btn" title="Import notes from HTML">📥</button>
                        <button id="notepad-export-button" class="notepad-export-btn" title="Export notes as HTML">📤</button>
                        <button class="notepad-modal-close" aria-label="Close notepad">&times;</button>
                    </div>
                </div>
                <div class="notepad-modal-body">
                    <div id="notepad-notes-container"></div>
                </div>
            </div>
            <input type="file" id="notepad-import-input" accept=".html" style="display:none" />
        `;

        document.body.appendChild(this.modalElement);
    }

    private attachEventListeners(): void {
        this.notepadButton = document.getElementById('notepad-button') as HTMLButtonElement;
        if (this.notepadButton) {
            this.notepadButton.addEventListener('click', () => this.toggleModal());
        }

        const addConceptButton = document.getElementById('notepad-add-concept-button') as HTMLButtonElement | null;
        if (addConceptButton) {
            addConceptButton.addEventListener('click', () => {
                const concept = this.createConceptGroup('', { startEditing: true });
                this.pendingConceptFocusId = concept.id;
                if (this.state.isOpen) {
                    this.renderNotes();
                }
            });
        }

        const exportButton = document.getElementById('notepad-export-button');
        if (exportButton) {
            exportButton.addEventListener('click', () => this.exportToHTML());
        }

        const importButton = document.getElementById('notepad-import-button') as HTMLButtonElement | null;
        if (importButton) {
            importButton.addEventListener('click', () => this.openImportPicker());
        }

        this.importInput = document.getElementById('notepad-import-input') as HTMLInputElement | null;
        if (this.importInput) {
            this.importInput.addEventListener('change', async event => {
                const target = event.target as HTMLInputElement;
                if (!target.files || target.files.length === 0) {
                    return;
                }
                const file = target.files.item(0);
                target.value = '';
                if (file) {
                    await this.handleImport(file);
                }
            });
        }

        const closeButton = this.modalElement?.querySelector('.notepad-modal-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.closeModal());
        }

        this.modalElement?.addEventListener('click', e => {
            if (e.target === this.modalElement) {
                this.closeModal();
            }
        });
    }

    private toggleModal(): void {
        if (this.state.isOpen) {
            this.closeModal();
        } else {
            this.openModal();
        }
    }

    private openModal(): void {
        if (!this.modalElement) {
            return;
        }

        this.state.isOpen = true;
        this.modalElement.style.display = 'flex';
        this.renderNotes();
        logNotepadActivity('modal-opened', { totalNotes: this.getTotalNoteCount() });
    }

    private closeModal(): void {
        if (!this.modalElement) {
            return;
        }

        this.state.isOpen = false;
        this.modalElement.style.display = 'none';
        logNotepadActivity('modal-closed', { totalNotes: this.getTotalNoteCount() });
    }

    private renderNotes(): void {
        const container = document.getElementById('notepad-notes-container');
        if (!container) {
            return;
        }

        if (this.state.concepts.length === 0) {
            container.innerHTML = '<p class="notepad-empty-message">No notes yet. Select text and click "Add to Notepad" to save notes or create a concept to begin.</p>';
            this.attachNoteEventListeners();
            this.attachConceptInputListeners();
            return;
        }

        let html = '';
        for (const concept of this.state.concepts) {
            const isEditing = this.editingConceptId === concept.id;
            const escapedTitle = this.escapeHtml(concept.title);
            const conceptIdAttr = this.escapeHtml(concept.id);
            html += `<div class="notepad-concept-section" data-concept-id="${conceptIdAttr}">`;
            html += '<div class="notepad-concept-header">';
            if (isEditing) {
                html += `<input type="text" class="notepad-concept-title-input" value="${escapedTitle}" data-concept-id="${conceptIdAttr}" />`;
            } else {
                html += `<span class="notepad-concept-title-text">${escapedTitle}</span>`;
            }
            html += '<div class="notepad-concept-header-actions">';
            html += `<button class="notepad-concept-add-note" title="Add note" data-concept-id="${conceptIdAttr}">📝</button>`;
            html += `<button class="notepad-concept-rename" title="Rename concept" data-concept-id="${conceptIdAttr}">✏️</button>`;
            html += '</div>';
            html += '</div>';
            html += '<div class="notepad-notes-list">';
            if (concept.notes.length === 0) {
                html += '<div class="notepad-note-empty">No notes recorded for this concept.</div>';
            } else {
                concept.notes.forEach((note, index) => {
                    if (index > 0) {
                        html += '<hr class="notepad-note-separator">';
                    }
                    html += this.createNoteCard(note);
                });
            }
            html += '</div>';
            html += '</div>';
        }

        container.innerHTML = html;
        this.attachNoteEventListeners();
        this.attachConceptInputListeners();
        this.focusPendingConceptInput();
        this.focusPendingNoteEditor();
    }

    private createNoteCard(note: Note): string {
        const renderedContent = note.htmlContent || marked(note.text);
        const noteIdAttr = this.escapeHtml(note.id);
        return `
            <div class="notepad-note-card" data-note-id="${noteIdAttr}">
                <div class="notepad-note-content" contenteditable="false">
                    ${renderedContent}
                </div>
                <div class="notepad-note-actions">
                    <button class="notepad-note-edit" title="Edit note">✏️</button>
                    <button class="notepad-note-delete" title="Delete note">🗑️</button>
                </div>
            </div>
        `;
    }

    private attachNoteEventListeners(): void {
        const container = document.getElementById('notepad-notes-container');
        if (!container) {
            return;
        }

        if (this.handleNoteClick) {
            container.removeEventListener('click', this.handleNoteClick);
        }

        this.handleNoteClick = (event: Event) => {
            const target = event.target as HTMLElement;
            if (!target) {
                return;
            }

            const conceptSection = target.closest('.notepad-concept-section') as HTMLElement | null;
            const noteCard = target.closest('.notepad-note-card') as HTMLElement | null;

            if (target.classList.contains('notepad-note-edit') || target.closest('.notepad-note-edit')) {
                if (noteCard) {
                    this.toggleEditMode(noteCard as HTMLElement);
                }
                return;
            }

            if (target.classList.contains('notepad-note-delete') || target.closest('.notepad-note-delete')) {
                const noteId = noteCard?.getAttribute('data-note-id');
                if (noteId) {
                    this.deleteNote(noteId);
                }
                return;
            }

            if (target.classList.contains('notepad-concept-add-note') || target.closest('.notepad-concept-add-note')) {
                const conceptId = conceptSection?.getAttribute('data-concept-id');
                if (conceptId) {
                    this.handleConceptAddNote(conceptId);
                }
                return;
            }

            if (target.classList.contains('notepad-concept-rename') || target.closest('.notepad-concept-rename')) {
                const conceptId = conceptSection?.getAttribute('data-concept-id');
                if (conceptId) {
                    this.editingConceptId = conceptId;
                    this.pendingConceptFocusId = conceptId;
                    this.renderNotes();
                }
            }
        };

        container.addEventListener('click', this.handleNoteClick);
    }

    private attachConceptInputListeners(): void {
        const input = document.querySelector('.notepad-concept-title-input') as HTMLInputElement | null;
        if (!input) {
            return;
        }

        const conceptId = input.getAttribute('data-concept-id');
        if (!conceptId) {
            return;
        }

        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.commitConceptRename(conceptId, input.value);
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                this.cancelConceptRename();
            }
        });

        input.addEventListener('blur', () => {
            if (this.editingConceptId === conceptId) {
                this.commitConceptRename(conceptId, input.value);
            }
        });
    }

    private focusPendingConceptInput(): void {
        if (!this.pendingConceptFocusId) {
            return;
        }
        const input = document.querySelector('.notepad-concept-title-input') as HTMLInputElement | null;
        if (input) {
            requestAnimationFrame(() => {
                input.focus();
                input.select();
            });
        }
        this.pendingConceptFocusId = null;
    }

    private focusPendingNoteEditor(): void {
        if (!this.pendingNoteEditId) {
            return;
        }
        const noteCard = document.querySelector(`.notepad-note-card[data-note-id="${this.pendingNoteEditId}"]`) as HTMLElement | null;
        if (noteCard) {
            requestAnimationFrame(() => {
                this.toggleEditMode(noteCard);
            });
        }
        this.pendingNoteEditId = null;
    }

    private handleConceptAddNote(conceptId: string): void {
        const concept = this.findConceptById(conceptId);
        if (!concept) {
            return;
        }
        const note: Note = {
            id: crypto.randomUUID(),
            conceptId: concept.id,
            conceptTitle: concept.title,
            text: '',
            timestamp: new Date()
        };
        this.appendNote(concept, note);
        logCustomConcept('note-added', {
            conceptId: concept.id,
            noteId: note.id,
            source: 'concept-button'
        });
        this.pendingNoteEditId = note.id;
        if (this.state.isOpen) {
            this.renderNotes();
        }
    }

    private commitConceptRename(conceptId: string, value: string): void {
        const concept = this.findConceptById(conceptId);
        if (!concept) {
            return;
        }
        const normalized = this.normalizeConceptTitle(value);
        if (concept.title !== normalized) {
            concept.title = normalized;
            concept.notes.forEach(note => {
                note.conceptTitle = normalized;
            });
            if (this.currentContext.conceptId === concept.id) {
                this.currentContext.conceptTitle = normalized;
            }
            logCustomConcept('concept-renamed', {
                conceptId: concept.id,
                title: normalized
            });
        }
        this.editingConceptId = null;
        if (this.state.isOpen) {
            this.renderNotes();
        }
    }

    private cancelConceptRename(): void {
        this.editingConceptId = null;
        if (this.state.isOpen) {
            this.renderNotes();
        }
    }

    private findConceptById(conceptId: string): ConceptGroup | undefined {
        return this.state.concepts.find(group => group.id === conceptId);
    }

    private findNote(noteId: string): { note: Note; concept: ConceptGroup } | null {
        for (const concept of this.state.concepts) {
            const note = concept.notes.find(item => item.id === noteId);
            if (note) {
                return { note, concept };
            }
        }
        return null;
    }

    private toggleEditMode(card: HTMLElement): void {
        const content = card.querySelector('.notepad-note-content') as HTMLElement;
        const noteId = card.getAttribute('data-note-id');
        if (!content || !noteId) {
            return;
        }
        const isEditing = card.classList.contains('editing');
        if (isEditing) {
            this.saveQuillContent(card, noteId);
        } else {
            this.initializeQuillEditor(card, noteId);
        }
    }

    private initializeQuillEditor(card: HTMLElement, noteId: string): void {
        const found = this.findNote(noteId);
        if (!found) {
            return;
        }
        const note = found.note;
        const editButton = card.querySelector('.notepad-note-edit') as HTMLButtonElement | null;
        if (editButton) {
            editButton.style.display = 'none';
        }
        card.classList.add('editing');
        const quillContainer = document.createElement('div');
        quillContainer.className = 'notepad-quill-container';
        const editorDiv = document.createElement('div');
        quillContainer.appendChild(editorDiv);
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'notepad-save-cancel-buttons';
        const saveButton = document.createElement('button');
        saveButton.textContent = '💾 Save';
        saveButton.className = 'notepad-note-edit';
        saveButton.onclick = () => this.saveQuillContent(card, noteId);
        const cancelButton = document.createElement('button');
        cancelButton.textContent = '❌ Cancel';
        cancelButton.className = 'notepad-note-delete';
        cancelButton.onclick = () => this.cancelQuillEdit(card);
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);
        card.appendChild(quillContainer);
        card.appendChild(buttonContainer);
        this.activeQuillEditor = new Quill(editorDiv, {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ header: 1 }, { header: 2 }],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['link'],
                    ['clean']
                ]
            }
        });
        if (note.quillDelta) {
            this.activeQuillEditor.setContents(note.quillDelta);
        } else if (note.htmlContent) {
            this.activeQuillEditor.clipboard.dangerouslyPasteHTML(note.htmlContent);
        } else {
            const html = marked(note.text) as string;
            this.activeQuillEditor.clipboard.dangerouslyPasteHTML(html);
        }
        this.activeQuillEditor.focus();
    }

    private saveQuillContent(card: HTMLElement, noteId: string): void {
        if (!this.activeQuillEditor) {
            return;
        }
        const found = this.findNote(noteId);
        if (!found) {
            return;
        }
        const note = found.note;
        note.quillDelta = this.cloneDelta(this.activeQuillEditor.getContents());
        note.htmlContent = this.activeQuillEditor.root.innerHTML;
        note.text = this.activeQuillEditor.getText();
        logNotepadActivity('note-edited', { noteId });
        this.cancelQuillEdit(card);
        if (this.state.isOpen) {
            this.renderNotes();
        }
    }

    private cancelQuillEdit(card: HTMLElement): void {
        card.classList.remove('editing');
        const quillContainer = card.querySelector('.notepad-quill-container');
        const buttonContainer = card.querySelector('.notepad-save-cancel-buttons');
        if (quillContainer) {
            quillContainer.remove();
        }
        if (buttonContainer) {
            buttonContainer.remove();
        }
        const editButton = card.querySelector('.notepad-note-edit') as HTMLButtonElement;
        if (editButton) {
            editButton.style.display = '';
        }
        this.activeQuillEditor = null;
    }

    private deleteNote(noteId: string): void {
        const found = this.findNote(noteId);
        if (!found) {
            return;
        }
        const { concept, note } = found;
        concept.notes = concept.notes.filter(item => item.id !== noteId);
        logNotepadActivity('note-deleted', {
            noteId,
            conceptTitle: concept.title,
            totalNotes: this.getTotalNoteCount()
        });
        if (this.state.isOpen) {
            this.renderNotes();
        }
    }

    private escapeHtml(value: string): string {
        const htmlEntities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return value.replace(/[&<>"']/g, match => htmlEntities[match] ?? match);
    }

    private normalizeConceptTitle(title: string | null | undefined): string {
        const trimmed = (title ?? '').trim();
        if (trimmed.length === 0) {
            return UNTITLED_CONCEPT_LABEL;
        }
        return trimmed;
    }

    public getAllNotes(): NotepadSnapshotConcept[] {
        const snapshot = this.state.concepts.map(concept => {
            const notes = concept.notes.map(note => {
                const snapshotNote: NotepadSnapshotNote = {
                    id: note.id,
                    conceptId: concept.id,
                    conceptTitle: concept.title,
                    text: note.text,
                    timestamp: note.timestamp.toISOString()
                };
                if (note.htmlContent !== undefined) {
                    snapshotNote.htmlContent = note.htmlContent;
                }
                if (note.quillDelta !== undefined) {
                    snapshotNote.quillDelta = this.cloneDelta(note.quillDelta);
                }
                return snapshotNote;
            });
            return {
                id: concept.id,
                title: concept.title,
                createdAt: concept.createdAt.toISOString(),
                notes
            };
        });
        logCustomConcept('persistence-snapshot', {
            conceptCount: snapshot.length,
            noteCount: this.getTotalNoteCount()
        });
        return snapshot;
    }

    public restoreNotes(rawNotes: any[]): void {
        const result = this.deserializeSnapshot(rawNotes);
        this.state.concepts = result.concepts;
        this.activeQuillEditor = null;
        if (this.state.isOpen) {
            this.renderNotes();
        }
        logger.info('[NOTEPAD_SAVE_BUG] restoreNotes applied to notepad state', {
            restoredConcepts: this.state.concepts.length,
            restoredNotes: this.getTotalNoteCount()
        });
        if (result.migrated) {
            logCustomConcept('migration-complete', {
                upgradedConcepts: this.state.concepts.length,
                upgradedNotes: this.getTotalNoteCount()
            });
        }
    }

    private deserializeSnapshot(raw: any[]): { concepts: ConceptGroup[]; migrated: boolean } {
        if (!Array.isArray(raw)) {
            return { concepts: [], migrated: false };
        }
        const looksLikeConceptSnapshot = raw.every(item => item && typeof item === 'object' && Array.isArray(item.notes));
        if (looksLikeConceptSnapshot) {
            const concepts = raw.map(item => this.buildConceptFromSnapshot(item));
            return { concepts, migrated: false };
        }
        const legacyConcepts = this.migrateLegacyNotes(raw);
        return { concepts: legacyConcepts, migrated: true };
    }

    private buildConceptFromSnapshot(snapshot: NotepadSnapshotConcept): ConceptGroup {
        const concept: ConceptGroup = {
            id: snapshot.id || crypto.randomUUID(),
            title: this.normalizeConceptTitle(snapshot.title),
            createdAt: snapshot.createdAt ? parseTimestamp(snapshot.createdAt) : new Date(),
            notes: []
        };
        snapshot.notes.forEach(noteSnapshot => {
            concept.notes.push(this.buildNoteFromSnapshot(noteSnapshot, concept));
        });
        return concept;
    }

    private buildNoteFromSnapshot(snapshot: NotepadSnapshotNote, concept: ConceptGroup): Note {
        const note: Note = {
            id: snapshot.id || crypto.randomUUID(),
            conceptId: concept.id,
            conceptTitle: concept.title,
            text: snapshot.text ?? '',
            timestamp: snapshot.timestamp ? parseTimestamp(snapshot.timestamp) : new Date()
        };
        if (snapshot.htmlContent !== undefined) {
            note.htmlContent = snapshot.htmlContent;
        }
        if (snapshot.quillDelta !== undefined) {
            note.quillDelta = snapshot.quillDelta;
        }
        return note;
    }

    private migrateLegacyNotes(raw: any[]): ConceptGroup[] {
        const grouped = new Map<string, ConceptGroup>();
        raw.forEach(item => {
            if (!item || typeof item !== 'object') {
                return;
            }
            const conceptTitle = this.normalizeConceptTitle(item.conceptTitle ?? item.moduleTitle ?? IMPORTED_NOTES_TITLE);
            if (!grouped.has(conceptTitle)) {
                grouped.set(conceptTitle, {
                    id: crypto.randomUUID(),
                    title: conceptTitle,
                    createdAt: new Date(),
                    notes: []
                });
            }
            const concept = grouped.get(conceptTitle)!;
            const note: Note = {
                id: item.id ?? crypto.randomUUID(),
                conceptId: concept.id,
                conceptTitle: concept.title,
                text: item.text ?? '',
                timestamp: item.timestamp ? parseTimestamp(item.timestamp) : new Date()
            };
            if (typeof item.htmlContent === 'string') {
                note.htmlContent = item.htmlContent;
            }
            if (item.quillDelta !== undefined) {
                note.quillDelta = item.quillDelta;
            }
            concept.notes.push(note);
        });
        return Array.from(grouped.values());
    }

    public exportToHTML(): void {
        try {
            logNotepadActivity('export-started', { totalNotes: this.getTotalNoteCount() });
            const concepts = this.state.concepts.map(concept => this.cloneConcept(concept));
            this.exporter.exportToHTML(concepts);
            logNotepadActivity('export-completed', { totalNotes: this.getTotalNoteCount() });
        } catch (error) {
            logger.error('Failed to export HTML:', error);
            alert('Failed to export HTML. Please try again.');
        }
    }

    private openImportPicker(): void {
        if (!this.importInput) {
            return;
        }
        this.importInput.click();
    }

    private async handleImport(file: File): Promise<void> {
        const importButton = document.getElementById('notepad-import-button') as HTMLButtonElement | null;
        if (importButton) {
            importButton.disabled = true;
            importButton.textContent = '⏳';
        }
        try {
            logger.info('[NOTEPAD_IMPORT] import-started', { fileName: file.name, fileSize: file.size });
            const imported = await this.importer.importFromFile(file);
            if (imported.length > 0) {
                this.mergeImportedConcepts(imported);
                if (this.state.isOpen) {
                    this.renderNotes();
                }
                logCustomConcept('import-merged', {
                    conceptCount: imported.length,
                    noteCount: imported.reduce((sum, concept) => sum + concept.notes.length, 0)
                });
            }
            logger.info('[NOTEPAD_IMPORT] import-completed', {
                conceptCount: imported.length,
                noteCount: imported.reduce((sum, concept) => sum + concept.notes.length, 0)
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Import failed.';
            logger.error('[NOTEPAD_IMPORT] import-failed', { error: message });
            await showImportFailureModal('Import failed. The selected file is not a valid Sensei export or is malformed.');
            logger.warn('[NOTEPAD_IMPORT] user-notified', { message: 'Import failure modal displayed.' });
        } finally {
            if (importButton) {
                importButton.disabled = false;
                importButton.textContent = '📥';
            }
        }
    }

    private mergeImportedConcepts(groups: ImportedConceptGroup[]): void {
        groups.forEach(group => {
            const title = this.normalizeConceptTitle(group.title ?? IMPORTED_NOTES_TITLE);
            let concept = group.id ? this.findConceptById(group.id) : undefined;
            if (!concept) {
                concept = this.state.concepts.find(existing => existing.title.toLowerCase() === title.toLowerCase());
            }
            if (!concept) {
                concept = {
                    id: group.id && !this.findConceptById(group.id) ? group.id : crypto.randomUUID(),
                    title,
                    createdAt: group.createdAt ? parseTimestamp(group.createdAt) : new Date(),
                    notes: []
                };
                this.state.concepts.push(concept);
            }

            group.notes.forEach(noteData => {
                if (noteData.id) {
                    const duplicate = concept!.notes.find(existing => existing.id === noteData.id);
                    if (duplicate) {
                        return;
                    }
                }
                const resolvedId = noteData.id && !this.findNote(noteData.id) ? noteData.id : crypto.randomUUID();
                const note: Note = {
                    id: resolvedId,
                    conceptId: concept!.id,
                    conceptTitle: concept!.title,
                    text: noteData.textContent,
                    timestamp: noteData.timestamp ? parseTimestamp(noteData.timestamp) : new Date()
                };
                if (noteData.htmlContent !== undefined) {
                    note.htmlContent = noteData.htmlContent;
                }
                if (noteData.quillDelta !== undefined) {
                    note.quillDelta = noteData.quillDelta;
                }
                this.appendNote(concept!, note);
            });
        });
    }

    private cloneConcept(concept: ConceptGroup): ConceptGroup {
        return {
            id: concept.id,
            title: concept.title,
            createdAt: new Date(concept.createdAt.getTime()),
            notes: concept.notes.map(note => this.cloneNote(note))
        };
    }

    private cloneNote(note: Note): Note {
        const clone: Note = {
            id: note.id,
            conceptId: note.conceptId,
            conceptTitle: note.conceptTitle,
            text: note.text,
            timestamp: new Date(note.timestamp.getTime())
        };
        if (note.htmlContent !== undefined) {
            clone.htmlContent = note.htmlContent;
        }
        if (note.quillDelta !== undefined) {
            clone.quillDelta = this.cloneDelta(note.quillDelta);
        }
        return clone;
    }

    private cloneDelta(delta: any): any {
        if (delta === undefined || delta === null) {
            return delta;
        }
        if (typeof delta !== 'object') {
            return delta;
        }
        try {
            return JSON.parse(JSON.stringify(delta));
        } catch {
            return delta;
        }
    }
}

export const notepad = new Notepad();
