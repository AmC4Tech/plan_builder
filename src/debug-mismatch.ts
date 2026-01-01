
import path from 'path';
import config from './config/index.js';
import templateReader from './core/template-reader.js';
import fs from 'fs-extra';
import PizZip from 'pizzip';

const filePath = path.join(config.paths.templates, 'template_backup/01立项/01项目建议书/xx项目建议书.docx');

async function debug() {
    console.log(`🔍 Analyzing: ${filePath}`);

    // 1. TemplateReader (What AI sees)
    console.log('\n--- TemplateReader Headers (Mammoth) ---');
    const info = await templateReader.readTemplate(filePath);
    const headers = info.headers || [];
    headers.forEach(h => console.log(`[T] "${h}"`));

    return; // Stop here for now
    // 2. DocInjector Logic (What XML sees)
    console.log('\n--- DocInjector Paragraphs (Raw XML) ---');
    const content = await fs.readFile(filePath);
    const zip = new PizZip(content);
    let docXml = zip.file('word/document.xml')?.asText();

    // Quick regex to find paragraphs
    const paragraphRegex = /<w:p[\s>].*?<\/w:p>/g;
    const items = docXml?.match(paragraphRegex) || [];

    console.log(`\n--- Hunting for "项目说明" ---`);
    for (const item of items) {
        const text = item.replace(/<[^>]+>/g, '').trim();
        // Check if it contains "项目说明"
        if (text.includes('项目说明')) {
            console.log(`FOUND PARAGRAPH: [${text}]`);
            console.log(`CHAR CODES: ${text.split('').map(c => c.charCodeAt(0)).join(',')}`);
            console.log(`RAW XML SNIPPET: ${item.substring(0, 100)}...`);
            // Check match
            const match = headers.find(h => {
                const normHeader = h.replace(/[\s\.]/g, '');
                const normPText = text.replace(/[\s\.]/g, '');
                return text === h ||
                    (text.includes(h) && text.length < h.length + 10) ||
                    (normHeader.endsWith(normPText) && normPText.length > 2) ||
                    (normHeader === normPText);
            });
            console.log(`MATCH STATUS: ${match ? '✅ ' + match : '❌ FAIL'}`);
            console.log('------------------------------------------------');
        }
    }
}

debug().catch(console.error);
