
import path from 'path';
import config from './config/index.js';
import mammoth from 'mammoth';
import fs from 'fs-extra';

const filePath = path.join(config.paths.templates, 'template_backup/01立项/01项目建议书/xx项目建议书.docx');

async function debug() {
    console.log(`Reading: ${filePath}`);
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    const lines = text.split('\n');

    console.log(`Total lines: ${lines.length}`);
    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.includes('项目说明')) {
            console.log(`Line ${i}: [${JSON.stringify(trimmed)}]`);
        }
    });

    console.log('--- First 20 lines ---');
    lines.slice(0, 20).forEach((l, i) => console.log(`${i}: ${JSON.stringify(l)}`));
}

debug().catch(console.error);
