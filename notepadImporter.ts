import { Curriculum } from './curriculum';
import {
    MODULE_SECTION_SELECTOR,
    MODULE_HEADER_SELECTOR,
    NOTE_CARD_SELECTOR,
    CONCEPT_TITLE_SELECTOR,
    CONCEPT_ICON_SELECTOR,
    NOTE_CONTENT_SELECTOR,
    NOTE_METADATA_SELECTOR
} from './notepadExporter';

export interface ImportedNoteData {
    moduleTitle: string;
    conceptTitle: string;
    timestamp: Date;
    htmlContent: string;
    textContent: string;
    moduleMatchIndex: number | null;
    conceptMatchIndex: number | null;
}

export interface ImportedBatch {
    notes: ImportedNoteData[];
    syntheticModuleRequired: boolean;
}

export class NotepadImportError extends Error {}

export class NotepadImporter {
    async importFromFile(file: File, curriculum: Curriculum | null): Promise<ImportedBatch> {
        const content = await file.text();
        return this.parseHtml(content, curriculum);
    }

    private parseHtml(content: string, curriculum: Curriculum | null): ImportedBatch {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const moduleSections = Array.from(doc.querySelectorAll(MODULE_SECTION_SELECTOR));
        if (moduleSections.length === 0) {
            throw new NotepadImportError('No module sections detected.');
        }
        const notes: ImportedNoteData[] = [];
        let syntheticModuleRequired = false;
        for (const section of moduleSections) {
            const header = section.querySelector(MODULE_HEADER_SELECTOR);
            const moduleTitle = header?.textContent?.trim() ?? '';
            const moduleMatchIndex = this.findModuleIndex(moduleTitle, curriculum);
            if (moduleMatchIndex === null) {
                syntheticModuleRequired = true;
            }
            const noteCards = Array.from(section.querySelectorAll(NOTE_CARD_SELECTOR));
            if (noteCards.length === 0) {
                continue;
            }
            for (const card of noteCards) {
                const conceptElement = card.querySelector(CONCEPT_TITLE_SELECTOR) as HTMLElement | null;
                if (!conceptElement) {
                    throw new NotepadImportError('Missing concept title in note card.');
                }
                const conceptTitle = this.extractConceptTitle(conceptElement);
                const conceptMatchIndex = this.findConceptIndex(moduleMatchIndex, conceptTitle, curriculum);
                const contentElement = card.querySelector(NOTE_CONTENT_SELECTOR) as HTMLElement | null;
                if (!contentElement) {
                    throw new NotepadImportError('Missing note content.');
                }
                const htmlContent = contentElement.innerHTML.trim();
                const textContent = contentElement.textContent?.trim() ?? '';
                const timestampElement = card.querySelector(NOTE_METADATA_SELECTOR);
                const timestamp = this.parseTimestamp(timestampElement?.textContent ?? '');
                notes.push({
                    moduleTitle,
                    conceptTitle,
                    timestamp,
                    htmlContent,
                    textContent,
                    moduleMatchIndex,
                    conceptMatchIndex
                });
            }
        }
        if (notes.length === 0) {
            throw new NotepadImportError('No notes found to import.');
        }
        return { notes, syntheticModuleRequired };
    }

    private extractConceptTitle(element: HTMLElement): string {
        const clone = element.cloneNode(true) as HTMLElement;
        const icon = clone.querySelector(CONCEPT_ICON_SELECTOR);
        if (icon) {
            icon.remove();
        }
        return clone.textContent?.trim() ?? '';
    }

    private parseTimestamp(raw: string): Date {
        const normalized = raw.replace('🕐', '').trim();
        if (!normalized) {
            return new Date();
        }
        const parsed = new Date(normalized);
        if (isNaN(parsed.getTime())) {
            return new Date();
        }
        return parsed;
    }

    private findModuleIndex(title: string, curriculum: Curriculum | null): number | null {
        if (!curriculum) {
            return null;
        }
        const target = title.toLowerCase();
        const index = curriculum.modules.findIndex(module => module.title.toLowerCase() === target);
        return index === -1 ? null : index;
    }

    private findConceptIndex(moduleIndex: number | null, title: string, curriculum: Curriculum | null): number | null {
        if (moduleIndex === null || !curriculum) {
            return null;
        }
        const module = curriculum.modules[moduleIndex];
        if (!module) {
            return null;
        }
        const target = title.toLowerCase();
        const index = module.concepts.findIndex(concept => concept.title.toLowerCase() === target);
        return index === -1 ? null : index;
    }
}
