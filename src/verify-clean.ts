
import fs from 'fs-extra';
import PizZip from 'pizzip';
import path from 'path';

// Path to the generated file (adjusted for filename replacement)
// 01立项/01项目建议书/广州农业数字孪生管理系统建议书.docx
const filePath = path.join(process.cwd(), 'output/广州农业数字孪生管理系统/01立项/01项目建议书/广州农业数字孪生管理系统建议书.docx');

async function check() {
    if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath);
        process.exit(1);
    }

    const content = await fs.readFile(filePath);
    const zip = new PizZip(content);
    const text = zip.file('word/document.xml')?.asText() || '';

    const forbidden = '阳江市AA';
    if (text.includes(forbidden)) {
        console.log('❌ DIRTY: Found forbidden text "' + forbidden + '"');
        process.exit(1);
    } else {
        console.log('✅ CLEAN: Old content successfully removed.');
    }
}

check().catch(console.error);
