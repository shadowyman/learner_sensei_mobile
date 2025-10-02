import { logger } from './logger';
import type { Note } from './notepad';

export const CONCEPT_SECTION_SELECTOR = '.notepad-export-concept';
export const CONCEPT_TITLE_SELECTOR = '.notepad-export-concept-title';
export const NOTE_CARD_SELECTOR = '.notepad-export-note';
export const NOTE_CONTENT_SELECTOR = '.notepad-export-note-content';
export const NOTE_TIMESTAMP_SELECTOR = '.notepad-export-note-timestamp';

export interface ExportConceptGroup {
    id: string;
    title: string;
    createdAt: Date;
    notes: Note[];
}

export class NotepadExporter {
    exportToHTML(concepts: ExportConceptGroup[]): void {
        const html = this.generateStyledHTML(concepts);
        this.downloadHTML(html, `study-notes-${new Date().toISOString().split('T')[0]}.html`);
        logger.info('[NOTEPAD_EXPORT]', {
            event: 'html-exported',
            noteCount: concepts.reduce((total, concept) => total + concept.notes.length, 0),
            conceptCount: concepts.length
        });
    }

    private generateStyledHTML(concepts: ExportConceptGroup[]): string {
        const shortDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recursive Sensei - Study Notes</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #334155; line-height: 1.6; padding: 40px 20px; }
        .container { max-width: 900px; margin: 0 auto; }
        .header { background: white; padding: 40px; border-radius: 16px; margin-bottom: 40px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; text-align: center; position: relative; }
        .header h1 { font-size: 2.5em; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
        .header .subtitle { font-size: 1.1em; color: #64748b; }
        .export-date { position: absolute; top: 20px; right: 20px; font-size: 0.9em; color: #94a3b8; background: #f1f5f9; padding: 8px 12px; border-radius: 8px; }
        .notepad-export-concept { margin-bottom: 50px; }
        .notepad-export-concept-header { background: white; padding: 24px 32px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
        .notepad-export-concept-title { font-size: 1.6em; font-weight: 600; color: #1e293b; }
        .notepad-export-note-count { font-size: 0.95em; color: #64748b; }
        .notepad-export-note { background: white; border-radius: 12px; padding: 32px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
        .notepad-export-note-content { color: #475569; line-height: 1.7; font-size: 1em; }
        .notepad-export-note-content p { margin-bottom: 1em; }
        .notepad-export-note-content p:last-child { margin-bottom: 0; }
        .notepad-export-note-content code { background: #f1f5f9; padding: 4px 8px; border-radius: 6px; font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; font-size: 0.9em; color: #dc2626; border: 1px solid #e2e8f0; }
        .notepad-export-note-content pre { background: #f8fafc; padding: 24px; border-radius: 8px; overflow-x: auto; margin: 20px 0; border: 1px solid #e2e8f0; position: relative; }
        .notepad-export-note-meta { margin-top: 20px; display: flex; justify-content: flex-end; }
        .notepad-export-note-timestamp { font-size: 0.95em; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="export-date">${shortDate}</div>
            <h1>Recursive Sensei</h1>
            <p class="subtitle">Personal study notes</p>
        </header>
`;
        concepts.forEach(concept => {
            const escapedTitle = this.escapeHtml(concept.title);
            html += `        <section class="notepad-export-concept" data-concept-id="${concept.id}">
            <div class="notepad-export-concept-header">
                <h2 class="notepad-export-concept-title">${escapedTitle}</h2>
                <div class="notepad-export-note-count">${concept.notes.length} ${concept.notes.length === 1 ? 'note' : 'notes'}</div>
            </div>
`;
            concept.notes.forEach(note => {
                const timestamp = this.formatTimestamp(note.timestamp);
                const content = note.htmlContent ?? this.convertToHTML(note.text);
                html += `            <article class="notepad-export-note" data-note-id="${note.id}">
                <div class="notepad-export-note-content">${content}</div>
                <div class="notepad-export-note-meta">
                    <span class="notepad-export-note-timestamp">🕐 ${timestamp}</span>
                </div>
            </article>
`;
            });
            html += `        </section>\n`;
        });
        html += `    </div>\n`;
        html += `</body>\n`;
        html += `</html>`;
        return html;
    }

    private formatTimestamp(timestamp: Date): string {
        const value = timestamp instanceof Date ? timestamp : new Date(timestamp);
        return value.toLocaleString();
    }

    private escapeHtml(text: string): string {
        const htmlEntities: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, match => htmlEntities[match] ?? match);
    }

    private convertToHTML(text: string): string {
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    }

    private downloadHTML(content: string, filename: string): void {
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
