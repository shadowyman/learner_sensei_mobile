import {
    CONCEPT_SECTION_SELECTOR,
    CONCEPT_TITLE_SELECTOR,
    NOTE_CARD_SELECTOR,
    NOTE_CONTENT_SELECTOR,
    NOTE_TIMESTAMP_SELECTOR
} from './notepadExporter';

const LEGACY_MODULE_SECTION_SELECTOR = '.module-section';
const LEGACY_MODULE_HEADER_SELECTOR = '.module-header h2';
const LEGACY_NOTE_CARD_SELECTOR = '.note-card';
const LEGACY_CONCEPT_TITLE_SELECTOR = '.concept-title';
const LEGACY_NOTE_CONTENT_SELECTOR = '.note-content';
const LEGACY_NOTE_TIMESTAMP_SELECTOR = '.note-metadata .timestamp';

export interface ImportedNoteData {
    id: string | null;
    htmlContent: string;
    textContent: string;
    timestamp: string | null;
    quillDelta?: any;
}

export interface ImportedConceptGroup {
    id: string | null;
    title: string;
    createdAt?: string | null;
    notes: ImportedNoteData[];
}

export class NotepadImportError extends Error {}

export class NotepadImporter {
    async importFromFile(file: File): Promise<ImportedConceptGroup[]> {
        const content = await file.text();
        return this.parseHtml(content);
    }

    private parseHtml(content: string): ImportedConceptGroup[] {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');

        const modern = this.parseModernExport(doc);
        if (modern.length > 0) {
            return modern;
        }

        const legacy = this.parseLegacyExport(doc);
        if (legacy.length > 0) {
            return legacy;
        }

        throw new NotepadImportError('No notes found to import.');
    }

    private parseModernExport(doc: Document): ImportedConceptGroup[] {
        const conceptSections = Array.from(doc.querySelectorAll(CONCEPT_SECTION_SELECTOR));
        const concepts: ImportedConceptGroup[] = [];
        conceptSections.forEach(section => {
            const titleElement = section.querySelector(CONCEPT_TITLE_SELECTOR);
            const title = titleElement?.textContent?.trim() ?? '';
            const notes = Array.from(section.querySelectorAll(NOTE_CARD_SELECTOR));
            if (notes.length === 0) {
                return;
            }
            const noteData: ImportedNoteData[] = notes.map(note => {
                const contentElement = note.querySelector(NOTE_CONTENT_SELECTOR) as HTMLElement | null;
                if (!contentElement) {
                    throw new NotepadImportError('Missing note content.');
                }
                const timestampElement = note.querySelector(NOTE_TIMESTAMP_SELECTOR);
                const rawTimestamp = timestampElement?.textContent ?? '';
                return {
                    id: note.getAttribute('data-note-id'),
                    htmlContent: contentElement.innerHTML.trim(),
                    textContent: contentElement.textContent?.trim() ?? '',
                    timestamp: this.normalizeTimestamp(rawTimestamp)
                };
            });
            concepts.push({
                id: section.getAttribute('data-concept-id'),
                title,
                createdAt: section.getAttribute('data-created-at'),
                notes: noteData
            });
        });
        return concepts;
    }

    private parseLegacyExport(doc: Document): ImportedConceptGroup[] {
        const moduleSections = Array.from(doc.querySelectorAll(LEGACY_MODULE_SECTION_SELECTOR));
        const grouped = new Map<string, ImportedConceptGroup>();
        moduleSections.forEach(section => {
            const moduleTitle = section.querySelector(LEGACY_MODULE_HEADER_SELECTOR)?.textContent?.trim() ?? '';
            const noteCards = Array.from(section.querySelectorAll(LEGACY_NOTE_CARD_SELECTOR));
            noteCards.forEach(card => {
                const conceptElement = card.querySelector(LEGACY_CONCEPT_TITLE_SELECTOR) as HTMLElement | null;
                if (!conceptElement) {
                    throw new NotepadImportError('Missing concept title in note card.');
                }
                const conceptTitle = this.extractLegacyConceptTitle(conceptElement);
                const contentElement = card.querySelector(LEGACY_NOTE_CONTENT_SELECTOR) as HTMLElement | null;
                if (!contentElement) {
                    throw new NotepadImportError('Missing note content.');
                }
                const timestampElement = card.querySelector(LEGACY_NOTE_TIMESTAMP_SELECTOR);
                const note: ImportedNoteData = {
                    id: card.getAttribute('data-note-id'),
                    htmlContent: contentElement.innerHTML.trim(),
                    textContent: contentElement.textContent?.trim() ?? '',
                    timestamp: this.normalizeTimestamp(timestampElement?.textContent ?? '')
                };
                const key = `${moduleTitle}::${conceptTitle}`;
                if (!grouped.has(key)) {
                    grouped.set(key, {
                        id: null,
                        title: conceptTitle || moduleTitle || 'Imported Notes',
                        createdAt: null,
                        notes: []
                    });
                }
                grouped.get(key)!.notes.push(note);
            });
        });
        return Array.from(grouped.values());
    }

    private extractLegacyConceptTitle(element: HTMLElement): string {
        const clone = element.cloneNode(true) as HTMLElement;
        const icon = clone.querySelector('.concept-icon');
        if (icon) {
            icon.remove();
        }
        return clone.textContent?.trim() ?? '';
    }

    private normalizeTimestamp(value: string): string | null {
        const cleaned = value.replace('🕐', '').trim();
        if (!cleaned) {
            return null;
        }
        const parsed = new Date(cleaned);
        if (Number.isNaN(parsed.getTime())) {
            return cleaned;
        }
        return parsed.toISOString();
    }
}
