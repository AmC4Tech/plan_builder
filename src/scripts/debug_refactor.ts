
import fs from 'fs-extra';
import path from 'path';
import PizZip from 'pizzip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target file to debug
const TARGET_FILE = path.resolve(__dirname, '../templates/template/01立项/01项目建议书/xx项目建议书.docx');

const KEYWORDS = ['项目说明', '项目背景', '项目名称'];

function extractTextFromPara(pNodeXml: string): string {
    const matches = pNodeXml.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
    if (!matches) return '';
    return matches.map(m => m.replace(/<[^>]+>/g, '')).join('');
}

function isHeader(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 50) return false;
    const patterns = [
        /^(\d+(\.\d+)*)/,
        /^([一二三四五六七八九十]+、)/,
        /^(\（[一二三四五六七八九十]+\）)/,
        /^[A-Za-z0-9]+\./,
    ];
    return patterns.some(p => p.test(trimmed));
}

function debugRefactor() {
    const logBuffer: string[] = [];
    const log = (msg: string) => logBuffer.push(msg);

    log(`🔍 Debugging: ${TARGET_FILE}`);

    if (!fs.existsSync(TARGET_FILE)) {
        log('❌ File not found!');
        fs.writeFileSync('debug_log.txt', logBuffer.join('\n'));
        return;
    }

    const content = fs.readFileSync(TARGET_FILE);
    const zip = new PizZip(content);
    const docXmlFile = zip.file("word/document.xml");

    if (!docXmlFile) {
        log('❌ invalid docx');
        fs.writeFileSync('debug_log.txt', logBuffer.join('\n'));
        return;
    }

    const docXml = docXmlFile.asText();
    const paragraphs = docXml.split(/(?=<w:p[ >])/);

    let skipMode = false;

    log(`Total paragraphs: ${paragraphs.length}`);

    for (let i = 0; i < paragraphs.length; i++) {
        const part = paragraphs[i];
        if (!part.startsWith('<w:p')) continue;

        const text = extractTextFromPara(part).trim();
        const headerCheck = isHeader(text);

        // Debug Log
        // Print first 50 chars of text
        const preview = text.substring(0, 50).replace(/\n/g, ' ');

        let status = 'KEEP';
        let action = '';

        // Simulate Match Logic
        let matched = false;
        for (const kw of KEYWORDS) {
            if (text.includes(kw)) {
                if (text.length < kw.length + 30 || headerCheck) {
                    matched = true;
                    break;
                }
            }
        }

        if (matched) {
            status = 'MATCH_HEADER';
            skipMode = true;
            action = '--> START SKIP';
        } else if (skipMode) {
            if (headerCheck) {
                status = 'NEW_HEADER';
                skipMode = false;
                action = '--> STOP SKIP';
            } else {
                status = 'SKIP_CONTENT';
                action = '(Removed)';
            }
        }

        log(`[${i}] [${status}] Text: "${preview}" ... ${action} (isHeader=${headerCheck})`);

        // Specifically look for the problematic text
        if (text.includes('阳江市')) {
            log('!!!!!!! FOUND THE TARGET TEXT !!!!!!!');
        }
    }

    fs.writeFileSync('debug_log.txt', logBuffer.join('\n'));
    console.log('✅ Log written to debug_log.txt');
}

debugRefactor();
