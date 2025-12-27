/**
 * 模板变量扫描器
 * 扫描所有 Word 模板文件，提取其中的变量占位符
 * 
 * 运行方式: npx tsx src/scripts/scan-templates.ts
 */

import fs from 'fs-extra';
import path from 'path';
import PizZip from 'pizzip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TemplateVariable {
    filePath: string;
    fileName: string;
    variables: string[];
    format: 'docx' | 'doc';
}

/**
 * 从 DOCX 文件中提取文本内容
 */
async function extractDocxText(filePath: string): Promise<string> {
    try {
        const content = await fs.readFile(filePath);
        const zip = new PizZip(content);

        // 获取 document.xml 内容
        const documentXml = zip.file('word/document.xml');
        if (!documentXml) {
            return '';
        }

        const xmlContent = documentXml.asText();

        // 移除 XML 标签，只保留文本
        const textContent = xmlContent
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return textContent;
    } catch (error) {
        console.error(`无法读取 ${filePath}:`, (error as Error).message);
        return '';
    }
}

/**
 * 从文本中提取变量占位符
 * 支持多种格式：{variable}, {{variable}}, ${variable}, <<variable>>, 【variable】等
 */
function extractVariables(text: string): string[] {
    const patterns = [
        /\{([^{}]+)\}/g,           // {variable}
        /\{\{([^{}]+)\}\}/g,       // {{variable}}
        /\$\{([^{}]+)\}/g,         // ${variable}
        /<<([^<>]+)>>/g,           // <<variable>>
        /【([^【】]+)】/g,          // 【variable】
        /\[\[([^\[\]]+)\]\]/g,     // [[variable]]
        /__([\w\u4e00-\u9fa5]+)__/g, // __variable__
        /XX([^\s，。、；：""''（）【】]*)/g,  // XX前缀的占位符
        /xxx?([^\s，。、；：""''（）【】]*)/gi, // xxx前缀的占位符
    ];

    const variables = new Set<string>();

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const variable = match[1] || match[0];
            if (variable && variable.length > 0 && variable.length < 50) {
                variables.add(variable);
            }
        }
    }

    return Array.from(variables);
}

/**
 * 扫描目录中的所有模板文件
 */
async function scanTemplates(templatesDir: string): Promise<TemplateVariable[]> {
    const results: TemplateVariable[] = [];

    async function scanDir(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                await scanDir(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();

                if (ext === '.docx') {
                    const text = await extractDocxText(fullPath);
                    const variables = extractVariables(text);

                    results.push({
                        filePath: path.relative(templatesDir, fullPath),
                        fileName: entry.name,
                        variables,
                        format: 'docx',
                    });
                } else if (ext === '.doc') {
                    // .doc 文件是旧格式，无法直接解析
                    // 标记需要手动检查
                    results.push({
                        filePath: path.relative(templatesDir, fullPath),
                        fileName: entry.name,
                        variables: ['[需要手动检查 - .doc 格式]'],
                        format: 'doc',
                    });
                }
            }
        }
    }

    await scanDir(templatesDir);
    return results;
}

/**
 * 主函数
 */
async function main() {
    const templatesDir = path.resolve(__dirname, '../templates/template');

    console.log('📄 扫描模板文件...\n');
    console.log(`目录: ${templatesDir}\n`);

    const results = await scanTemplates(templatesDir);

    console.log('='.repeat(80));
    console.log('模板变量扫描结果');
    console.log('='.repeat(80));

    let docxCount = 0;
    let docCount = 0;

    for (const result of results) {
        console.log(`\n📁 ${result.filePath}`);
        console.log(`   格式: ${result.format.toUpperCase()}`);

        if (result.format === 'docx') {
            docxCount++;
            if (result.variables.length > 0) {
                console.log(`   变量 (${result.variables.length}):`);
                result.variables.forEach(v => console.log(`     - ${v}`));
            } else {
                console.log(`   变量: 未检测到变量占位符`);
            }
        } else {
            docCount++;
            console.log(`   ⚠️  .doc 格式需要转换为 .docx 后才能自动提取变量`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`总计: ${results.length} 个文件 (${docxCount} 个 .docx, ${docCount} 个 .doc)`);
    console.log('='.repeat(80));

    // 保存结果到 JSON 文件
    const outputPath = path.resolve(__dirname, '../templates/template-variables.json');
    await fs.writeJson(outputPath, results, { spaces: 2 });
    console.log(`\n📝 结果已保存到: ${outputPath}`);
}

main().catch(console.error);
