
import fs from 'fs-extra';
import PizZip from 'pizzip';
import path from 'path';

const filePath = path.join(process.cwd(), 'output/广州农业数字孪生管理系统/01立项/01项目建议书/广州农业数字孪生管理系统建议书.docx');

async function verify() {
    if (!fs.existsSync(filePath)) {
        console.log('⏳ File not ready yet.');
        return;
    }

    const content = await fs.readFile(filePath);
    const zip = new PizZip(content);
    const text = zip.file('word/document.xml')?.asText() || '';

    console.log('--- Verification Report ---');

    // 1. Check for Forbidden Text (Old Content)
    const forbidden = ['阳江市AA', '阳江市AA企业'];
    let dirty = false;
    for (const f of forbidden) {
        if (text.includes(f)) {
            console.log(`❌ FAIL: Found forbidden text "${f}"`);
            dirty = true;
        }
    }
    if (!dirty) console.log('✅ CLEAN: No forbidden text found.');

    // 2. Check for "Project Description" Injection
    const expected = [
        '本项目的名称',
        '项目实施主体',
        '项目性质',
        '术语定义'
    ];
    let missing = [];
    for (const exp of expected) {
        if (!text.includes(exp)) {
            missing.push(exp);
        }
    }

    if (missing.length === 0) {
        console.log('✅ SUCCESS: "Project Description" structure valid.');
    } else {
        console.log('❌ FAIL: Missing "Project Description" elements:', missing.join(', '));
        // Print snippet if Project Description header exists
        const idx = text.lastIndexOf('项目说明');
        if (idx !== -1) {
            console.log('Snippet around 项目说明:');
            // Strip xml tags roughly
            const snippet = text.substring(idx, idx + 2000).replace(/<[^>]+>/g, '');
            console.log(snippet);
        } else {
            console.log('❌ FAIL: Header "项目说明" not found in output.');
        }
    }

    // 3. Check for TOC Explainer Text
    const tocExplainer = ['此处不生成章节目录', '本文件为项目文档片段'];
    let failedToc = false;
    for (const t of tocExplainer) {
        if (text.includes(t)) {
            console.log(`❌ FAIL: Found TOC explainer "${t}"`);
            failedToc = true;
        }
    }
    if (!failedToc) console.log('✅ CLEAN: No TOC explainer text.');

}

verify().catch(console.error);
