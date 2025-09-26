import { logger } from './logger';
import { Note } from './notepad';

export const MODULE_SECTION_SELECTOR = '.module-section';
export const MODULE_HEADER_SELECTOR = '.module-header h2';
export const NOTE_CARD_SELECTOR = '.note-card';
export const CONCEPT_TITLE_SELECTOR = '.concept-title';
export const CONCEPT_ICON_SELECTOR = '.concept-icon';
export const NOTE_CONTENT_SELECTOR = '.note-content';
export const NOTE_METADATA_SELECTOR = '.note-metadata .timestamp';

interface ExportOptions {
    includeTimestamps?: boolean;
    groupByModule?: boolean;
}

export class NotepadExporter {
    private defaultOptions: ExportOptions = {
        includeTimestamps: true,
        groupByModule: true
    };
    
    exportToHTML(notes: Note[], options?: ExportOptions): void {
        const mergedOptions = { ...this.defaultOptions, ...options };
        const html = this.generateStyledHTML(notes, mergedOptions);
        this.downloadHTML(html, `study-notes-${new Date().toISOString().split('T')[0]}.html`);
        logger.info('[NOTEPAD_EXPORT]', {
            event: 'html-exported',
            noteCount: notes.length
        });
    }
    
    private generateStyledHTML(notes: Note[], options: ExportOptions): string {
        const groupedNotes = options.groupByModule ? this.groupNotesByModule(notes) : new Map([['All Notes', notes]]);
        const shortDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recursive Sensei - Study Notes</title>
    <style>
        /* Base Styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            color: #334155;
            line-height: 1.6;
            padding: 40px 20px;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        
        /* Header */
        .header {
            background: white;
            padding: 40px;
            border-radius: 16px;
            margin-bottom: 40px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
            text-align: center;
            position: relative;
        }
        
        .header h1 {
            font-size: 2.5em;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 8px;
        }
        
        .header .subtitle {
            font-size: 1.1em;
            color: #64748b;
        }
        
        .export-date {
            position: absolute;
            top: 20px;
            right: 20px;
            font-size: 0.9em;
            color: #94a3b8;
            background: #f1f5f9;
            padding: 8px 12px;
            border-radius: 8px;
        }
        
        /* Module Section */
        .module-section {
            margin-bottom: 50px;
        }
        
        .module-header {
            background: white;
            padding: 24px 32px;
            border-radius: 12px;
            margin-bottom: 24px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
            border-left: 4px solid #3b82f6;
        }
        
        .module-header h2 {
            font-size: 1.8em;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 4px;
        }
        
        .note-count {
            font-size: 0.9em;
            color: #64748b;
        }
        
        /* Note Card */
        .note-card {
            background: white;
            border-radius: 12px;
            padding: 32px;
            margin-bottom: 24px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
            transition: all 0.2s ease;
        }
        
        .note-card:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transform: translateY(-2px);
        }
        
        .concept-title {
            font-size: 1.4em;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .concept-icon {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            color: white;
        }
        
        .note-content {
            color: #475569;
            line-height: 1.7;
            font-size: 1em;
        }
        
        .note-content p {
            margin-bottom: 1em;
        }
        
        .note-content p:last-child {
            margin-bottom: 0;
        }
        
        .note-content code {
            background: #f1f5f9;
            padding: 4px 8px;
            border-radius: 6px;
            font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
            font-size: 0.9em;
            color: #dc2626;
            border: 1px solid #e2e8f0;
        }
        
        .note-content pre {
            background: #f8fafc;
            padding: 24px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 20px 0;
            border: 1px solid #e2e8f0;
            position: relative;
        }
        
        .note-content pre::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #3b82f6, #1d4ed8);
            border-radius: 8px 8px 0 0;
        }
        
        .note-content pre code {
            background: transparent;
            padding: 0;
            color: #334155;
            border: none;
        }
        
        .note-content strong {
            color: #1e293b;
            font-weight: 600;
        }
        
        .note-content em {
            font-style: italic;
            color: #64748b;
        }
        
        .note-content ul, .note-content ol {
            padding-left: 1.5em;
            margin: 1em 0;
        }
        
        .note-content blockquote {
            border-left: 4px solid #3b82f6;
            padding-left: 16px;
            margin: 1em 0;
            color: #64748b;
        }
        
        .note-metadata {
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.85em;
            color: #64748b;
        }
        
        .timestamp {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #f1f5f9;
            padding: 6px 12px;
            border-radius: 6px;
        }
        
        /* Footer */
        .footer {
            margin-top: 60px;
            text-align: center;
            padding: 32px;
            background: white;
            border-radius: 12px;
            color: #64748b;
            font-size: 0.9em;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
        }
        
        /* Print Styles */
        @media print {
            body {
                background: white;
                padding: 20px;
            }
            
            .note-card,
            .module-header,
            .header,
            .footer {
                box-shadow: none;
                border: 1px solid #e2e8f0;
            }
            
            .note-card:hover {
                transform: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="export-date">📅 ${shortDate}</div>
            <h1>Study Notes</h1>
            <p class="subtitle">Personal Learning Collection</p>
        </header>`;
        
        // Add module sections
        groupedNotes.forEach((moduleNotes, moduleTitle) => {
            html += `
        <section class="module-section">
            <div class="module-header">
                <h2>${this.escapeHtml(moduleTitle)}</h2>
                <div class="note-count">${moduleNotes.length} notes collected</div>
            </div>`;
            
            // Add notes for this module
            moduleNotes.forEach((note) => {
                // Use actual HTML content if available, otherwise use text
                const content = note.htmlContent || this.convertToHTML(note.text);
                
                // Select an appropriate emoji for the concept
                const conceptEmoji = this.getConceptEmoji(note.conceptTitle);
                
                html += `
            <div class="note-card">
                <h3 class="concept-title">
                    <div class="concept-icon">${conceptEmoji}</div>
                    ${this.escapeHtml(note.conceptTitle)}
                </h3>
                <div class="note-content">
                    ${content}
                </div>`;
                
                if (options.includeTimestamps) {
                    const formattedDate = new Date(note.timestamp).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });
                    
                    html += `
                <div class="note-metadata">
                    <div class="timestamp">
                        🕐 ${formattedDate}
                    </div>
                </div>`;
                }
                
                html += `
            </div>`;
            });
            
            html += `
        </section>`;
        });
        
        // Add footer
        html += `
        <footer class="footer">
            <p><strong>Generated by Recursive Sensei</strong></p>
            <p>Keep learning, keep growing 🚀</p>
        </footer>
    </div>
</body>
</html>`;
        
        return html;
    }
    
    private getConceptEmoji(conceptTitle: string): string {
        const title = conceptTitle.toLowerCase();
        if (title.includes('function') || title.includes('method')) return '📦';
        if (title.includes('data') || title.includes('flow')) return '📊';
        if (title.includes('recursion') || title.includes('recursive')) return '🔄';
        if (title.includes('pattern')) return '🎨';
        if (title.includes('algorithm')) return '⚙️';
        if (title.includes('structure')) return '🏗️';
        if (title.includes('tree') || title.includes('graph')) return '🌳';
        if (title.includes('array') || title.includes('list')) return '📝';
        if (title.includes('stack') || title.includes('queue')) return '📚';
        if (title.includes('search') || title.includes('find')) return '🔍';
        if (title.includes('sort')) return '📊';
        if (title.includes('optimize') || title.includes('performance')) return '⚡';
        return '📝'; // Default emoji
    }
    
    private groupNotesByModule(notes: Note[]): Map<string, Note[]> {
        const grouped = new Map<string, Note[]>();
        
        notes.forEach(note => {
            const moduleTitle = note.moduleTitle;
            if (!grouped.has(moduleTitle)) {
                grouped.set(moduleTitle, []);
            }
            grouped.get(moduleTitle)!.push(note);
        });
        
        // Sort notes within each module by concept index
        grouped.forEach(moduleNotes => {
            moduleNotes.sort((a, b) => a.conceptIndex - b.conceptIndex);
        });
        
        return grouped;
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
        // Basic conversion - just escape and add line breaks
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
