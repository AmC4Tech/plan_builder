
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs-extra';

export interface TemplateContent {
    type: 'docx' | 'xlsx' | 'other';
    content: string; // Text content for AI prompt
    structure?: any; // Optional structure info (e.g. headers for Excel)
    headers?: string[]; // Docx headers candidates
}

export class TemplateReader {
    /**
     * Read a template file and extract content for AI prompt
     */
    async readTemplate(filePath: string): Promise<TemplateContent> {
        const ext = path.extname(filePath).toLowerCase();

        if (ext === '.docx') {
            return this.readDocx(filePath);
        } else if (ext === '.xlsx' || ext === '.xls') {
            return this.readExcel(filePath);
        }

        return { type: 'other', content: '' };
    }

    private async readDocx(filePath: string): Promise<TemplateContent> {
        try {
            const buffer = await fs.readFile(filePath);
            const result = await mammoth.extractRawText({ buffer });
            const content = result.value.trim();

            // Extract headers candidates using simple heuristics 
            // (e.g. lines that look like "1. Title" or "一、Title")
            // This is used to guide the AI what keys to generate
            // Use Set to avoid duplicates
            const headersSet = new Set<string>();
            const lines = content.split('\n');
            for (const line of lines) {
                let trimmed = line.trim();
                if (!trimmed) continue;

                // Filter TOC lines: end with single digit or tab+digit
                // e.g. "1 Project Desc 2" or "1 Project Desc\t2"
                if (/\t\d+$/.test(trimmed) || /\s+\d+$/.test(trimmed)) {
                    // Likely a TOC line (Mammoth often preserves tabs or spaces before page num)
                    // Skip it to avoid polluting headers with "Title 2"
                    continue;
                }

                // Heuristic 1: Standard numbering (1. 1.1 一、 (一))
                // Added support for space without dot, e.g. "1 项目说明" or "1项目说明"
                const numberedMatch = trimmed.match(/^(\d+(\.\d+)*\.?)\s*(.*)/);
                if (numberedMatch) {
                    const title = numberedMatch[3].trim();
                    // Filter out empty or very short after stripping number
                    if (title.length > 0 && title.length < 50) {
                        headersSet.add(title);
                        continue;
                    }
                }
                // Original Heuristic 1 for Chinese numbering and parenthesized numbers
                if (/^([一二三四五六七八九十]+、|\([一二三四五六七八九十]+\))\s/.test(trimmed)) {
                    if (trimmed.length < 50) headersSet.add(trimmed);
                }
                // Heuristic 2: Short lines that look like titles
                else if (trimmed.length >= 2 && trimmed.length <= 20 && !/[。，、；：.!?,;:]$/.test(trimmed)) {
                    if (/^[\u4e00-\u9fa5]/.test(trimmed)) {
                        headersSet.add(trimmed);
                    }
                }
            }

            const headers = Array.from(headersSet);

            return {
                type: 'docx',
                content: content,
                headers: headers
            };
        } catch (error) {
            console.error(`Error reading docx template ${filePath}:`, error);
            throw error;
        }
    }

    private async readExcel(filePath: string): Promise<TemplateContent> {
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);

            const worksheet = workbook.worksheets[0]; // Assume content is in first sheet
            let content = `Excel Context (${path.basename(filePath)}):\n`;

            // Read headers (assume first row)
            const headers: string[] = [];

            // Use just the first row for now
            const row1 = worksheet.getRow(1);
            row1.eachCell((cell, colNumber) => {
                headers.push(cell.toString());
            });

            content += `Headers: ${headers.join(', ')}\n`;

            // Read some sample data (next 3 rows)
            content += "Sample Data:\n";
            for (let i = 2; i <= 4; i++) {
                const row = worksheet.getRow(i);
                if (row.hasValues) {
                    const rowData: string[] = [];
                    row.eachCell((cell) => rowData.push(cell.toString()));
                    content += `- ${rowData.join(', ')}\n`;
                }
            }

            return {
                type: 'xlsx',
                content: content,
                structure: { headers }
            };
        } catch (error) {
            console.error(`Error reading excel template ${filePath}:`, error);
            throw error;
        }
    }
}

export const templateReader = new TemplateReader();
export default templateReader;
