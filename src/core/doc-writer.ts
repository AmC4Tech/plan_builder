
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import fs from 'fs-extra';
import path from 'path';

export class DocWriter {
    /**
     * Create a new DOCX file from text content
     */
    async createDocx(outputPath: string, content: string): Promise<void> {
        const lines = content.split('\n');
        const children = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                children.push(new Paragraph({})); // Empty line
                continue;
            }

            if (trimmed.startsWith('# ')) {
                children.push(new Paragraph({
                    text: trimmed.replace('# ', ''),
                    heading: HeadingLevel.HEADING_1,
                }));
            } else if (trimmed.startsWith('## ')) {
                children.push(new Paragraph({
                    text: trimmed.replace('## ', ''),
                    heading: HeadingLevel.HEADING_2,
                }));
            } else if (trimmed.startsWith('### ')) {
                children.push(new Paragraph({
                    text: trimmed.replace('### ', ''),
                    heading: HeadingLevel.HEADING_3,
                }));
            } else {
                children.push(new Paragraph({
                    children: [
                        new TextRun(trimmed),
                    ],
                }));
            }
        }

        const doc = new Document({
            sections: [{
                properties: {},
                children: children,
            }],
        });

        // Ensure directory exists
        await fs.ensureDir(path.dirname(outputPath));

        // Generate and save
        const buffer = await Packer.toBuffer(doc);
        await fs.writeFile(outputPath, buffer);
        console.log(`📝 Generated DOCX: ${outputPath}`);
    }
}

export const docWriter = new DocWriter();
export default docWriter;
