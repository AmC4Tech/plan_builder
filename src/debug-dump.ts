
import fs from 'fs-extra';
import PizZip from 'pizzip';
import path from 'path';

const filePath = path.join(process.cwd(), 'output/广州农业数字孪生管理系统/01立项/01项目建议书/广州农业数字孪生管理系统建议书.docx');

async function dump() {
    if (!fs.existsSync(filePath)) {
        console.log('File not found');
        return;
    }
    const content = await fs.readFile(filePath);
    const zip = new PizZip(content);
    const xml = zip.file('word/document.xml')?.asText() || '';

    // Find Header
    const idx = xml.lastIndexOf('项目说明');
    if (idx === -1) {
        console.log('Header "项目说明" not found');
        return;
    }

    // Print 500 chars context
    console.log(xml.substring(idx - 100, idx + 500));
}

dump().catch(console.error);
