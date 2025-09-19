/**
 * @license
 * SPDX-License-Identifier: Apache-2.1
 */

import { logger } from './logger';
import { marked } from 'marked';
import { Curriculum } from './curriculum';
import { NotepadExporter } from './notepadExporter';

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
    private handleNoteClick: ((e: Event) => void) | null = null; // Event handler reference
    
    constructor() {
        this.exporter = new NotepadExporter();
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
        const note: Note = {
            id: crypto.randomUUID(),
            moduleTitle: module.title,
            conceptTitle: concept.title,
            conceptIndex: this.currentActiveConceptIndex,
            moduleIndex: this.currentModuleIndex,
            text: markdownText,
            htmlContent: htmlContent,
            timestamp: new Date()
        };
        
        this.state.notes.push(note);
        logger.info('Note added to concept:', concept.title);
        logger.info('Total notes in notepad:', this.state.notes.length);
        
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
                        <button id="notepad-export-button" class="notepad-export-btn" title="Export notes as HTML">📄 Export HTML</button>
                        <button class="notepad-modal-close" aria-label="Close notepad">&times;</button>
                    </div>
                </div>
                <div class="notepad-modal-body">
                    <div id="notepad-notes-container"></div>
                </div>
            </div>
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
        logger.info('Notepad opened');
    }
    
    private closeModal(): void {
        if (!this.modalElement) return;
        
        this.state.isOpen = false;
        this.modalElement.style.display = 'none';
        logger.info('Notepad closed');
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
        this.state.notes.forEach(note => {
            if (!notesByModule.has(note.moduleIndex)) {
                notesByModule.set(note.moduleIndex, new Map<number, Note[]>());
            }
            const moduleNotes = notesByModule.get(note.moduleIndex)!;
            
            if (!moduleNotes.has(note.conceptIndex)) {
                moduleNotes.set(note.conceptIndex, []);
            }
            moduleNotes.get(note.conceptIndex)!.push(note);
        });
        
        let html = '';
        notesByModule.forEach((conceptsMap, moduleIndex) => {
            // Get module title from the first note
            const firstNote = conceptsMap.values().next().value[0];
            const moduleTitle = firstNote.moduleTitle;
            
            html += `<div class="notepad-module-section">
                <h2 class="notepad-module-header">Module: ${moduleTitle}</h2>`;
            
            conceptsMap.forEach((notes, conceptIndex) => {
                const conceptTitle = notes[0].conceptTitle;
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
            });
            
            html += '</div>';
        });
        
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
        container.removeEventListener('click', this.handleNoteClick);
        
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
        container.addEventListener('click', this.handleNoteClick);
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
        
        const editButton = card.querySelector('.notepad-note-edit') as HTMLButtonElement;
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
        
        logger.info('Note edited with Quill, ID:', noteId);
        
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
            logger.info('Note deleted, ID:', noteId);
            this.renderNotes();
        }
    }
    
    private exportToHTML(): void {
        try {
            logger.info('Starting HTML export with', this.state.notes.length, 'notes');
            
            // Show loading state on button
            const exportButton = document.getElementById('notepad-export-button') as HTMLButtonElement;
            if (exportButton) {
                exportButton.disabled = true;
                exportButton.textContent = '⏳ Generating HTML...';
            }
            
            // Export to HTML
            this.exporter.exportToHTML(this.state.notes);
            
            logger.info('HTML export completed successfully');
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
}

export const notepad = new Notepad();