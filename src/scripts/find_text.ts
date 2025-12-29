
import fs from 'fs-extra';
import path from 'path';
import PizZip from 'pizzip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEARCH_STRINGS = ['阳江市', '项目实施主体', 'AA企业管理'];
const TEMPLATE_DIR = path.resolve(__dirname, '../templates/template');

function extractText(xmlObj: any): string {
    let text = '';
    if (xmlObj.value) {
        text += xmlObj.value;
    }
    if (xmlObj.children) {
        xmlObj.children.forEach((child: any) => {
            text += extractText(child);
        });
    }
    return text;
}

// 简单粗暴的正则提取，不做 XML 解析，只做字符串匹配

const logBuffer: string[] = [];
function log(msg: string) {
    logBuffer.push(msg);
    console.log(msg);
}

function searchInDocx(filePath: string) {
    try {
        const content = fs.readFileSync(filePath);
        const zip = new PizZip(content);
        const docXmlFile = zip.file("word/document.xml");

        if (!docXmlFile) return;

        const docXml = docXmlFile.asText();
        const textContent = docXml.replace(/<[^>]+>/g, '');

        for (const searchStr of SEARCH_STRINGS) {
            if (textContent.includes(searchStr)) {
                log(`❌ 发现残留文件: ${filePath}`);
                log(`   匹配关键词: ${searchStr}`);

                const idx = textContent.indexOf(searchStr);
                const start = Math.max(0, idx - 50);
                const end = Math.min(textContent.length, idx + 100);
                log(`   上下文: ...${textContent.substring(start, end).replace(/\s+/g, ' ')}...`);
                log('-----------------------------------');
            }
        }

    } catch (err) {
        // ignore
    }
}

function walkDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else if (path.extname(file).toLowerCase() === '.docx') {
            searchInDocx(fullPath);
        }
    });
}

log('🔍 开始搜索残留内容...');
walkDir(TEMPLATE_DIR);
log('🏁 搜索结束');
fs.writeFileSync('find_log.txt', logBuffer.join('\n'));
