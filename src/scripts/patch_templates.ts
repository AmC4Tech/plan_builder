
import fs from 'fs-extra';
import path from 'path';
import PizZip from 'pizzip';
import { fileURLToPath } from 'url';
import orchestrator from '../core/orchestrator.js';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function patchTemplates() {
    console.log('🚀 开始批量修复模板...');

    try {
        // 1. 加载 Manifest
        const manifest = await orchestrator.loadManifest();
        const { phases, templateBasePath } = manifest;

        let patchedCount = 0;
        let skippedCount = 0;

        // 2. 遍历所有定义的文档
        for (const phase of phases) {
            for (const doc of phase.documents) {
                // 有 AI 字段的才需要检查
                if (!doc.aiFields || doc.aiFields.length === 0) continue;

                const templatePath = templateBasePath
                    ? path.join(config.paths.templates, templateBasePath, doc.template)
                    : path.join(config.paths.templates, doc.template);

                if (!fs.existsSync(templatePath)) {
                    console.warn(`⚠️ 模板未找到: ${doc.template}`);
                    continue;
                }

                // 仅支持 .docx
                if (path.extname(templatePath).toLowerCase() !== '.docx') {
                    continue;
                }

                // 3. 读取并分析模板
                try {
                    const content = fs.readFileSync(templatePath);
                    const zip = new PizZip(content);

                    // 读取主文档 XML
                    const docXmlFile = zip.file("word/document.xml");
                    if (!docXmlFile) {
                        console.error(`❌ 无效的 Word 文档: ${doc.template}`);
                        continue;
                    }

                    let docXml = docXmlFile.asText();
                    const missingFields: string[] = [];

                    // 4. 检查缺少的字段
                    for (const field of doc.aiFields) {
                        const tag = `{${field.field}}`;
                        if (!docXml.includes(tag)) {
                            missingFields.push(tag);
                        }
                    }

                    if (missingFields.length === 0) {
                        console.log(`✅ [无需修改] ${doc.template}`);
                        skippedCount++;
                        continue;
                    }

                    console.log(`🔧 [正在修复] ${doc.template}`);
                    console.log(`   + 添加字段: ${missingFields.join(', ')}`);

                    // 5. 构造 XML 片段 (追加到文档末尾)
                    // 使用简单的段落结构，包含醒目的提示文本
                    let xmlAppend = '';

                    // 添加一个分隔符 paragraph
                    xmlAppend += `<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FF0000"/></w:rPr><w:t>--- 自动添加的 AI 占位符 (请剪切到正确位置) ---</w:t></w:r></w:p>`;

                    for (const tag of missingFields) {
                        xmlAppend += `<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:color w:val="0000FF"/></w:rPr><w:t>${tag}</w:t></w:r><w:r><w:t xml:space="preserve"> : 此处将生成对应内容</w:t></w:r></w:p>`;
                    }

                    // 添加结束分隔符
                    xmlAppend += `<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FF0000"/></w:rPr><w:t>------------------------------------------------</w:t></w:r></w:p>`;

                    // 插入到 </w:body> 之前
                    const newDocXml = docXml.replace('</w:body>', `${xmlAppend}</w:body>`);

                    // 6. 写入修改
                    zip.file("word/document.xml", newDocXml);
                    const newContent = zip.generate({
                        type: "nodebuffer",
                        compression: "DEFLATE"
                    });

                    fs.writeFileSync(templatePath, newContent);
                    patchedCount++;

                } catch (err) {
                    console.error(`❌ 处理出错 ${doc.template}:`, err);
                }
            }
        }

        console.log('\n==========================================');
        console.log(`🎉 修复完成!`);
        console.log(`✅ 已修改文件: ${patchedCount}`);
        console.log(`⏩ 无需修改文件: ${skippedCount}`);
        console.log('==========================================');
        console.log('请注意：脚本已将缺失的占位符追加到文档末尾。');
        console.log('请您打开 Word 文档，将红色/蓝色标记的占位符剪切粘贴到合适的章节位置。');

    } catch (error) {
        console.error('运行失败:', error);
    }
}

patchTemplates();
