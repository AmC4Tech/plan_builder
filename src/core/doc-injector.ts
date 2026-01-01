
import fs from 'fs-extra';
import path from 'path';
import PizZip from 'pizzip';

export class DocInjector {
    /**
     * Inject content into an existing DOCX file, replacing body content under headers
     */
    /**
     * Inject content into an existing DOCX file, replacing body content under headers
     */
    async injectContent(originalPath: string, outputPath: string, contentMap: Record<string, string>): Promise<void> {
        // 1. Read the original file
        const content = await fs.readFile(originalPath);
        const zip = new PizZip(content);

        let docXml = zip.file('word/document.xml')?.asText();
        if (!docXml) {
            throw new Error('Invalid DOCX: missing word/document.xml');
        }

        // 2. Split into paragraphs
        const paragraphRegex = /(<w:p[\s>].*?<\/w:p>)/g;
        const parts = docXml.split(paragraphRegex);

        let newXml = '';
        let currentHeader: string | null = null;
        let isSkippingBody = false;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;

            // Check if it's a paragraph
            if (part.startsWith('<w:p') && part.endsWith('</w:p>')) {
                const pText = this.extractTextFromXml(part).trim();

                // 3. Logic: Identify Header using Robust Chinese Matching
                let matchedHeader: string | null = null;

                // Strategy: Strip everything except Chinese characters and ASCII letters/numbers (for English titles)
                // But prioritize Chinese for this project.
                // Helper to get 'essence' of text
                const getEssence = (s: string) => s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
                const pEssence = getEssence(pText);

                if (pEssence.length > 1) { // Ignore single chars/empty matches
                    for (const header of Object.keys(contentMap)) {
                        const hEssence = getEssence(header);

                        // Check exact match of essence
                        if (pEssence === hEssence) {
                            matchedHeader = header;
                            break;
                        }
                        // Check if paragraph ENDS with header (e.g. "1.1项目说明" ends with "项目说明")
                        if (pEssence.endsWith(hEssence) && hEssence.length > 1) {
                            matchedHeader = header;
                            break;
                        }
                        // Check if header ENDS with paragraph (unlikely but "项目说明" vs "说明"?) - Skip to be safe
                    }
                }

                if (matchedHeader) {
                    console.log(`✅ EXACT MATCH found: [${matchedHeader}] matches XML [${pText.substring(0, 20)}...]`);
                    // Found a header!
                    newXml += part; // Write header

                    // Inject content
                    const newContent = contentMap[matchedHeader];
                    if (newContent) {
                        newXml += this.createInjectionXml(newContent);
                    }

                    // Start skipping subsequent body paragraphs
                    currentHeader = matchedHeader;
                    isSkippingBody = true;
                    console.log(`✅ Kept Header: "${pText}" & Injected Content`);
                } else {
                    // Check if we should stop skipping
                    if (isSkippingBody) {
                        // Stop skipping if:
                        // 1. It looks like another header (e.g. "1.2 XXX")
                        // 2. It IS a TOC/Directory paragraph
                        if (this.looksLikeHeader(pText, contentMap) || this.isTocParagraph(part)) {
                            isSkippingBody = false;
                            currentHeader = null;
                            newXml += part;
                            console.log(`⏹️ Stop skipping at preserved element: "${pText.substring(0, 30)}..."`);
                        } else {
                            // Skip this body paragraph
                            // console.log(`🗑️ Dropping body: "${pText.substring(0, 20)}..."`);
                        }
                    } else {
                        // Not skipping, just keep the paragraph
                        newXml += part;
                    }
                }

            } else {
                // Not a paragraph (xml tags, whitespace, etc.), keep it
                newXml += part;
            }
        }

        // 4. Update zip
        zip.file('word/document.xml', newXml);

        // 5. Save
        const buffer = zip.generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        });

        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, buffer);
        console.log(`💉 Injected & Replaced content into: ${outputPath}`);
    }

    // Check if paragraph is part of a TOC
    private isTocParagraph(xml: string): boolean {
        // Check for field instructions related to TOC
        if (xml.includes('instrText') && xml.includes('TOC')) return true;

        // Check for TOC styles (w:pStyle w:val="TOC1", "TOC2" etc.)
        // Note: Word sometimes uses lowercase or 'TOC 1' depending on locale/version, 
        // strictly speaking val attribute is often "TOC1", "TOC2"
        if (/w:pStyle w:val="TOC\d+"/.test(xml)) return true;
        if (/w:pStyle w:val="toc\d+"/.test(xml)) return true; // Case insensitive safe

        // Check for "hyperlink" wrapping a TOC entry (sometimes TOC items are hyperlinks)
        // This might be too broad, but if it has TOC text it's usually safe.

        return false;
    }

    // Check if text looks like a header (to safely stop deletion)
    private looksLikeHeader(text: string, contentMap: Record<string, string>): boolean {
        // REFACTOR: Do not use heuristics. Only stop if it matches a KNOWN header.
        // If we use heuristics, we risk stopping on body text like "本项目的名称：".

        const getEssence = (s: string) => s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
        const pEssence = getEssence(text);
        if (pEssence.length < 2) return false;

        // Check against ANY known header in the map
        // This is expensive O(N) but N is small (headers < 100)
        for (const header of Object.keys(contentMap)) {
            const hEssence = getEssence(header);
            if (pEssence === hEssence || (pEssence.endsWith(hEssence) && hEssence.length > 1)) {
                return true;
            }
        }
        return false;
    }

    private extractTextFromXml(xml: string): string {
        return xml.replace(/<[^>]+>/g, '');
    }

    private createInjectionXml(content: string): string {
        const lines = content.split('\n').filter(line => line.trim());
        let xml = '';

        for (const line of lines) {
            let text = line;
            text = text.replace(/^-\s+/, '').replace(/^\*\s+/, '');

            let pPr = '<w:pPr><w:pStyle w:val="Normal"/></w:pPr>';

            if (line.startsWith('### ')) {
                text = line.replace('### ', '');
                pPr = '<w:pPr><w:pStyle w:val="Heading3"/></w:pPr>';
            } else if (line.startsWith('## ')) {
                text = line.replace('## ', '');
                pPr = '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>';
            }

            xml += `<w:p>${pPr}<w:r><w:t>${this.escapeXml(text)}</w:t></w:r></w:p>`;
        }
        return xml;
    }

    private escapeXml(unsafe: string): string {
        return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
            return c;
        });
    }
}

export const docInjector = new DocInjector();
export default docInjector;
