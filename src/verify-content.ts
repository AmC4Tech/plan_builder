
import fs from 'fs-extra';
import PizZip from 'pizzip';
import path from 'path';

const filePath = path.join(process.cwd(), 'output/广州农业数字孪生管理系统/01立项/01项目建议书/广州农业数字孪生管理系统建议书.docx');

async function check() {
    if (!fs.existsSync(filePath)) {
        console.log('⏳ File not ready yet...');
        return;
    }

    const content = await fs.readFile(filePath);
    const zip = new PizZip(content);
    const text = zip.file('word/document.xml')?.asText() || '';

    console.log('--- Content Check ---');

    // Check for forbidden text
    if (text.includes('阳江市AA')) {
        console.log('❌ FAILED: Found forbidden text "阳江市AA"');
    } else {
        console.log('✅ CLEAN: No forbidden text.');
    }

    // Check for expected new structure
    const expected = [
        '本项目的名称：',
        '项目实施主体：',
        '项目性质：',
        '术语定义：' // Matches the prompt requests roughly
    ];

    let missing = [];
    for (const exp of expected) {
        // Simple check, might need fuzzy if AI varies slightly
        if (!text.includes(exp)) {
            // AI might generate "1. 本项目的名称" or "**本项目的名称**" (though we asked for no markdown)
            // or maybe "项目名称："
            missing.push(exp);
        }
    }

    if (missing.length === 0) {
        console.log('✅ SUCCESS: All expected structural elements found.');
    } else {
        console.log('⚠️ WARNING: Missing elements:', missing.join(', '));
        console.log('--- Snippet around "项目说明" ---');
        const idx = text.indexOf('项目说明');
        if (idx !== -1) {
            // Get a chunk, strip xml tags for readability
            const chunk = text.substring(idx, idx + 2000);
            const cleanChunk = chunk.replace(/<[^>]+>/g, '');
            console.log(cleanChunk);
        } else {
            console.log('Header "项目说明" NOT FOUND in output?');
        }
    }
}

check().catch(console.error);
