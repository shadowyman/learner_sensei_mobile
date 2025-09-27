/**
 * @license
 * SPDX-License-Identifier: Apache-2.1
 */

import { logger } from './logger';
import { marked } from 'marked';
import { Curriculum } from './curriculum';
import { NotepadExporter } from './notepadExporter';
import { NotepadImporter, ImportedNoteData } from './notepadImporter';
import { showImportFailureModal } from './ui';

// Declare Quill for TypeScript
declare var Quill: any;

export interface Note {
    id: string;
    moduleTitle: string;
    conceptTitle: string;
    conceptIndex: number;
    moduleIndex: number;
    text: string;
    htmlContent?: string; // Store HTML content when available
    quillDelta?: any; // Store Quill Delta format for rich text editing
    timestamp: Date;
}

interface NotepadState {
    notes: Note[];
    isOpen: boolean;
}

const IMPORTED_NOTES_TITLE = 'Imported Notes';

function logNotepadActivity(event: string, payload?: Record<string, unknown>): void {
    if (payload && Object.keys(payload).length > 0) {
        logger.info('[NOTEPAD_ACTIVITY]', { event, ...payload });
    } else {
        logger.info('[NOTEPAD_ACTIVITY]', { event });
    }
}

export class Notepad {
    private state: NotepadState = {
        notes: [],
        isOpen: false
    };
    
    private modalElement: HTMLDivElement | null = null;
    private notepadButton: HTMLButtonElement | null = null;
    private curriculum: Curriculum | null = null;
    private currentActiveConceptIndex: number | null = null;
    private currentModuleIndex: number | null = null;
    private activeQuillEditor: any = null; // Track active Quill instance
    private exporter: NotepadExporter;
    private importer: NotepadImporter;
    private importInput: HTMLInputElement | null = null;
    private handleNoteClick: ((e: Event) => void) | null = null; // Event handler reference

    constructor() {
        this.exporter = new NotepadExporter();
        this.importer = new NotepadImporter();
    }
    
    public initialize(curriculum: Curriculum): void {
        this.curriculum = curriculum;
        this.createModal();
        this.attachEventListeners();
    }
    
    public updateActiveConceptIndex(index: number | null): void {
        this.currentActiveConceptIndex = index;
    }
    
    public updateActiveModuleIndex(moduleIndex: number | null): void {
        this.currentModuleIndex = moduleIndex;
    }
    
    public addNote(selectedText: string, markdownText: string, htmlContent?: string): void {
        
        if (this.currentActiveConceptIndex === null || this.currentModuleIndex === null || !this.curriculum) {
            logger.warn('Cannot add note: no active concept or module');
            return;
        }
        
        const module = this.curriculum.modules[this.currentModuleIndex];
        
        if (!module || !module.concepts[this.currentActiveConceptIndex]) {
            logger.warn('Cannot add note: concept not found in current module');
            return;
        }
        
        const concept = module.concepts[this.currentActiveConceptIndex];
        if (!concept) {
            logger.warn('Cannot add note: target concept missing');
            return;
        }

        const note: Note = {
            id: crypto.randomUUID(),
            moduleTitle: module.title,
            conceptTitle: concept.title,
            conceptIndex: this.currentActiveConceptIndex,
            moduleIndex: this.currentModuleIndex,
            text: markdownText,
            timestamp: new Date()
        };
        if (htmlContent !== undefined) {
            note.htmlContent = htmlContent;
        }

        this.state.notes.push(note);
        logNotepadActivity('note-added', {
            moduleTitle: module.title,
            conceptTitle: concept.title,
            totalNotes: this.state.notes.length
        });

        if (this.state.isOpen) {
            this.renderNotes();
        }
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
                        <button id="notepad-import-button" class="notepad-export-btn" title="Import notes from HTML">📥 Import HTML</button>
                        <button id="notepad-export-button" class="notepad-export-btn" title="Export notes as HTML">📄 Export HTML</button>
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
        
        // Export button listener
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
            this.importInput.addEventListener('change', async (event) => {
                const target = event.target as HTMLInputElement;
                if (!target.files || target.files.length === 0) {
                    return;
                }
                const file = target.files.item(0);
                if (!file) {
                    target.value = '';
                    return;
                }
                target.value = '';
                await this.handleImport(file);
            });
        }

        const closeButton = this.modalElement?.querySelector('.notepad-modal-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.closeModal());
        }

        this.modalElement?.addEventListener('click', (e) => {
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
        if (!this.modalElement) return;
        
        this.state.isOpen = true;
        this.modalElement.style.display = 'flex';
        this.renderNotes();
        logNotepadActivity('modal-opened', { totalNotes: this.state.notes.length });
    }
    
    private closeModal(): void {
        if (!this.modalElement) return;
        
        this.state.isOpen = false;
        this.modalElement.style.display = 'none';
        logNotepadActivity('modal-closed', { totalNotes: this.state.notes.length });
    }
    
    private renderNotes(): void {
        const container = document.getElementById('notepad-notes-container');
        if (!container) return;

        if (this.state.notes.length === 0) {
            container.innerHTML = '<p class="notepad-empty-message">No notes yet. Select text and click "Add to Notepad" to save notes.</p>';
            return;
        }
        
        // Group notes by module index first
        const notesByModule = new Map<number, Map<number, Note[]>>();
        for (const note of this.state.notes) {
            const moduleNotes = notesByModule.get(note.moduleIndex) ?? new Map<number, Note[]>();
            if (!notesByModule.has(note.moduleIndex)) {
                notesByModule.set(note.moduleIndex, moduleNotes);
            }
            const conceptNotes = moduleNotes.get(note.conceptIndex) ?? [];
            if (!moduleNotes.has(note.conceptIndex)) {
                moduleNotes.set(note.conceptIndex, conceptNotes);
            }
            conceptNotes.push(note);
        }

        let html = '';
        for (const [moduleIndex, conceptsMap] of notesByModule.entries()) {
            const conceptIterator = conceptsMap.values().next();
            if (conceptIterator.done || conceptIterator.value.length === 0) {
                continue;
            }
            const moduleTitle = conceptIterator.value[0]?.moduleTitle ?? `Module ${moduleIndex + 1}`;

            html += `<div class="notepad-module-section">
                <h2 class="notepad-module-header">Module: ${moduleTitle}</h2>`;

            for (const notes of conceptsMap.values()) {
                if (notes.length === 0) {
                    continue;
                }
                const conceptTitle = notes[0]?.conceptTitle ?? 'Concept';
                html += `<div class="notepad-concept-section">
                    <h3 class="notepad-concept-header">${conceptTitle}</h3>
                    <div class="notepad-notes-list">`;

                notes.forEach((note, index) => {
                    if (index > 0) {
                        html += '<hr class="notepad-note-separator">';
                    }
                    html += this.createNoteCard(note);
                });

                html += '</div></div>';
            }

            html += '</div>';
        }
        
        container.innerHTML = html;
        this.attachNoteEventListeners();
    }
    
    private createNoteCard(note: Note): string {
        // Use HTML content if available, otherwise render markdown
        const renderedContent = note.htmlContent || marked(note.text);
        return `
            <div class="notepad-note-card" data-note-id="${note.id}">
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
        // Use event delegation to avoid memory leaks
        const container = document.getElementById('notepad-notes-container');
        if (!container) return;
        
        // Remove any existing listeners first
        if (this.handleNoteClick) {
            container.removeEventListener('click', this.handleNoteClick);
        }
        
        // Create bound handler if not exists
        if (!this.handleNoteClick) {
            this.handleNoteClick = (e: Event) => {
                const target = e.target as HTMLElement;
                
                // Handle edit button clicks
                if (target.classList.contains('notepad-note-edit') || target.closest('.notepad-note-edit')) {
                    const card = target.closest('.notepad-note-card');
                    if (card) {
                        this.toggleEditMode(card as HTMLElement);
                    }
                }
                
                // Handle delete button clicks
                if (target.classList.contains('notepad-note-delete') || target.closest('.notepad-note-delete')) {
                    const card = target.closest('.notepad-note-card');
                    const noteId = card?.getAttribute('data-note-id');
                    if (noteId) {
                        this.deleteNote(noteId);
                    }
                }
            };
        }
        
        // Attach single delegated event listener
        const handler = this.handleNoteClick;
        if (handler) {
            container.addEventListener('click', handler);
        }
    }
    
    private toggleEditMode(card: HTMLElement): void {
        const content = card.querySelector('.notepad-note-content') as HTMLElement;
        const noteId = card.getAttribute('data-note-id');
        
        if (!content || !noteId) return;
        
        const isEditing = card.classList.contains('editing');
        
        if (isEditing) {
            this.saveQuillContent(card, noteId);
        } else {
            this.initializeQuillEditor(card, noteId);
        }
    }
    
    private initializeQuillEditor(card: HTMLElement, noteId: string): void {
        const note = this.state.notes.find(n => n.id === noteId);
        if (!note) return;
        
        const editButton = card.querySelector('.notepad-note-edit') as HTMLButtonElement | null;
        if (!editButton) {
            logger.warn('Edit button not found for note card', { noteId });
            return;
        }
        editButton.style.display = 'none';
        
        // Add editing class
        card.classList.add('editing');
        
        // Create Quill container
        const quillContainer = document.createElement('div');
        quillContainer.className = 'notepad-quill-container';
        
        const editorDiv = document.createElement('div');
        quillContainer.appendChild(editorDiv);
        
        // Create save/cancel buttons
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
        
        // Initialize Quill
        this.activeQuillEditor = new Quill(editorDiv, {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'header': 1 }, { 'header': 2 }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link'],
                    ['clean']
                ]
            }
        });
        
        // Set content - use Delta if available, otherwise convert HTML
        if (note.quillDelta) {
            this.activeQuillEditor.setContents(note.quillDelta);
        } else if (note.htmlContent) {
            // Convert HTML to Quill format
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = note.htmlContent;
            this.activeQuillEditor.clipboard.dangerouslyPasteHTML(note.htmlContent);
        } else {
            // Convert markdown to HTML first
            const html = marked(note.text) as string;
            this.activeQuillEditor.clipboard.dangerouslyPasteHTML(html);
        }
        
        this.activeQuillEditor.focus();
    }
    
    private saveQuillContent(card: HTMLElement, noteId: string): void {
        if (!this.activeQuillEditor) return;
        
        const note = this.state.notes.find(n => n.id === noteId);
        if (!note) return;
        
        // Save Delta format for future edits
        note.quillDelta = this.activeQuillEditor.getContents();
        
        // Save HTML for display
        note.htmlContent = this.activeQuillEditor.root.innerHTML;
        
        // Update plain text for search/export
        note.text = this.activeQuillEditor.getText();
        
        logNotepadActivity('note-edited', { noteId });
        
        // Clean up
        this.cancelQuillEdit(card);
        
        // Re-render to show updated content
        this.renderNotes();
    }
    
    private cancelQuillEdit(card: HTMLElement): void {
        // Remove editing class
        card.classList.remove('editing');
        
        // Remove Quill container and buttons
        const quillContainer = card.querySelector('.notepad-quill-container');
        const buttonContainer = card.querySelector('.notepad-save-cancel-buttons');
        
        if (quillContainer) quillContainer.remove();
        if (buttonContainer) buttonContainer.remove();
        
        // Show edit button again
        const editButton = card.querySelector('.notepad-note-edit') as HTMLButtonElement;
        if (editButton) editButton.style.display = '';
        
        // Clean up Quill instance
        this.activeQuillEditor = null;
    }
    
    private deleteNote(noteId: string): void {
        const index = this.state.notes.findIndex(n => n.id === noteId);
        if (index !== -1) {
            this.state.notes.splice(index, 1);
            logNotepadActivity('note-deleted', {
                noteId,
                totalNotes: this.state.notes.length
            });
            this.renderNotes();
        }
    }

    public getAllNotes(): Note[] {
        return this.state.notes.map(note => this.cloneNote(note));
    }

    public restoreNotes(rawNotes: any[]): void {
        const normalized = this.normalizeRestoredNotes(rawNotes);
        this.state.notes = normalized;
        this.activeQuillEditor = null;
        if (this.state.isOpen) {
            this.renderNotes();
        }
        logger.info('[NOTEPAD_SAVE_BUG] restoreNotes applied to notepad state', { restoredCount: this.state.notes.length });
    }
    
    private exportToHTML(): void {
        try {
            logNotepadActivity('export-started', { totalNotes: this.state.notes.length });

            // Show loading state on button
            const exportButton = document.getElementById('notepad-export-button') as HTMLButtonElement;
            if (exportButton) {
                exportButton.disabled = true;
                exportButton.textContent = '⏳ Generating HTML...';
            }
            
            // Export to HTML
            this.exporter.exportToHTML(this.state.notes);
            
            logNotepadActivity('export-completed', { totalNotes: this.state.notes.length });
        } catch (error) {
            logger.error('Failed to export HTML:', error);
            alert('Failed to export HTML. Please try again.');
        } finally {
            // Restore button state
            const exportButton = document.getElementById('notepad-export-button') as HTMLButtonElement;
            if (exportButton) {
                exportButton.disabled = false;
                exportButton.textContent = '📄 Export HTML';
            }
        }
    }

    private openImportPicker(): void {
        const input = this.importInput;
        if (!input) {
            return;
        }
        input.click();
    }

    private async handleImport(file: File): Promise<void> {
        const importButton = document.getElementById('notepad-import-button') as HTMLButtonElement | null;
        if (importButton) {
            importButton.disabled = true;
            importButton.textContent = '⏳ Importing...';
        }
        try {
            logger.info('[NOTEPAD_IMPORT] import-started', { fileName: file.name, fileSize: file.size });
            const curriculum = this.curriculum ?? null;
            const batch = await this.importer.importFromFile(file, curriculum);
            const notes = this.transformImportedNotes(batch.notes);
            if (notes.length > 0) {
                this.state.notes.push(...notes);
                logger.info('[NOTEPAD_IMPORT] notes-merged', { totalNotes: this.state.notes.length, addedCount: notes.length });
                if (this.state.isOpen) {
                    this.renderNotes();
                }
            }
            logger.info('[NOTEPAD_IMPORT] import-completed', { importedCount: notes.length, syntheticModuleUsed: batch.syntheticModuleRequired });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Import failed.';
            logger.error('[NOTEPAD_IMPORT] import-failed', { error: message });
            await showImportFailureModal('Import failed. The selected file is not a valid Sensei export or is malformed.');
            logger.warn('[NOTEPAD_IMPORT] user-notified', { message: 'Import failure modal displayed.' });
        } finally {
            if (importButton) {
                importButton.disabled = false;
                importButton.textContent = '📥 Import HTML';
            }
        }
    }

    private transformImportedNotes(data: ImportedNoteData[]): Note[] {
        const notes: Note[] = [];
        const syntheticModuleIndex = this.resolveSyntheticModuleIndex();
        const modulePending = new Map<number, Map<string, number>>();
        const moduleNextIndex = new Map<number, number>();
        for (const item of data) {
            const moduleIndex = this.resolveModuleIndex(item.moduleMatchIndex, syntheticModuleIndex);
            const moduleTitle = this.resolveModuleTitle(moduleIndex, item.moduleMatchIndex, item.moduleTitle, syntheticModuleIndex);
            const conceptIndex = this.resolveConceptIndex(moduleIndex, item.conceptTitle, item.conceptMatchIndex, modulePending, moduleNextIndex);
            const note = this.buildNote(item, moduleIndex, moduleTitle, conceptIndex);
            notes.push(note);
        }
        return notes;
    }

    private resolveModuleIndex(matchIndex: number | null, syntheticModuleIndex: number): number {
        if (matchIndex !== null && matchIndex >= 0) {
            return matchIndex;
        }
        return syntheticModuleIndex;
    }

    private resolveModuleTitle(moduleIndex: number, matchIndex: number | null, fallbackTitle: string, syntheticModuleIndex: number): string {
        if (matchIndex !== null && this.curriculum && this.curriculum.modules[matchIndex]) {
            return this.curriculum.modules[matchIndex].title;
        }
        if (moduleIndex === syntheticModuleIndex) {
            return IMPORTED_NOTES_TITLE;
        }
        return fallbackTitle || IMPORTED_NOTES_TITLE;
    }

    private resolveConceptIndex(moduleIndex: number, conceptTitle: string, matchIndex: number | null, modulePending: Map<number, Map<string, number>>, moduleNextIndex: Map<number, number>): number {
        if (matchIndex !== null && matchIndex >= 0) {
            return matchIndex;
        }
        if (!modulePending.has(moduleIndex)) {
            modulePending.set(moduleIndex, new Map());
        }
        const pending = modulePending.get(moduleIndex)!;
        if (pending.has(conceptTitle)) {
            return pending.get(conceptTitle)!;
        }
        const existing = this.state.notes.find(note => note.moduleIndex === moduleIndex && note.conceptTitle === conceptTitle);
        if (existing) {
            const index = existing.conceptIndex;
            pending.set(conceptTitle, index);
            return index;
        }
        const index = this.nextConceptIndex(moduleIndex, moduleNextIndex);
        pending.set(conceptTitle, index);
        return index;
    }

    private nextConceptIndex(moduleIndex: number, moduleNextIndex: Map<number, number>): number {
        if (!moduleNextIndex.has(moduleIndex)) {
            const existing = this.state.notes.filter(note => note.moduleIndex === moduleIndex).map(note => note.conceptIndex);
            let next = existing.length > 0 ? Math.max(...existing) + 1 : 0;
            if (this.curriculum && moduleIndex < this.curriculum.modules.length) {
                const baseline = this.curriculum.modules[moduleIndex]?.concepts.length ?? 0;
                if (next < baseline) {
                    next = baseline;
                }
            }
            moduleNextIndex.set(moduleIndex, next);
        }
        const value = moduleNextIndex.get(moduleIndex)!;
        moduleNextIndex.set(moduleIndex, value + 1);
        return value;
    }

    private buildNote(item: ImportedNoteData, moduleIndex: number, moduleTitle: string, conceptIndex: number): Note {
        return {
            id: crypto.randomUUID(),
            moduleTitle,
            conceptTitle: item.conceptTitle,
            conceptIndex,
            moduleIndex,
            text: item.textContent,
            htmlContent: item.htmlContent,
            timestamp: item.timestamp
        };
    }

    private resolveSyntheticModuleIndex(): number {
        const existing = this.state.notes.find(note => note.moduleTitle === IMPORTED_NOTES_TITLE);
        if (existing) {
            return existing.moduleIndex;
        }
        if (this.curriculum) {
            return this.curriculum.modules.length;
        }
        if (this.state.notes.length === 0) {
            return 0;
        }
        const maxIndex = Math.max(...this.state.notes.map(note => note.moduleIndex));
        return maxIndex + 1;
    }
}

export const notepad = new Notepad();
