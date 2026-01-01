
import ExcelJS from 'exceljs';
import fs from 'fs-extra';
import path from 'path';

export class ExcelGenerator {
    /**
     * Create or Append to an Excel file
     * @param outputPath Path to save/update the file (if append, this file must exist or we copy from template)
     * @param data Array of objects or arrays
     * @param headers Optional headers
     * @param append If true, loads existing file instead of creating new
     */
    async createExcel(outputPath: string, data: any[], headers?: string[], append: boolean = false): Promise<void> {
        const workbook = new ExcelJS.Workbook();

        // Ensure directory exists
        await fs.ensureDir(path.dirname(outputPath));

        if (append && await fs.pathExists(outputPath)) {
            // Load existing file
            await workbook.xlsx.readFile(outputPath);
        } else {
            // New file
            workbook.addWorksheet('Sheet1');
        }

        const worksheet = workbook.worksheets[0];

        // If new file, set headers
        if (!append) {
            if (headers && headers.length > 0) {
                worksheet.columns = headers.map(header => ({ header, key: header, width: 20 }));
            }
        }

        // Add rows
        // Note: For append mode, we just add to the bottom
        if (Array.isArray(data)) {
            worksheet.addRows(data);
        }

        // Save
        await workbook.xlsx.writeFile(outputPath);
        console.log(`📊 Generated/Appended Excel: ${outputPath}`);
    }
}

export const excelGenerator = new ExcelGenerator();
export default excelGenerator;
