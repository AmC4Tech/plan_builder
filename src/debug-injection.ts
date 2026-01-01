
import { docInjector } from './core/doc-injector.js';
import { templateReader } from './core/template-reader.js';
import aiWriter from './core/ai_writer.js';
import path from 'path';
import config from './config/index.js';
import fs from 'fs-extra';
import PizZip from 'pizzip';

async function debug() {
    const relativePath = '01立项/01项目建议书/xx项目建议书.docx';
    const filePath = path.join(config.paths.templates, 'template_backup', relativePath);
    const outputPath = path.join(config.paths.output, 'DebugProject', relativePath);

    console.log(`🔍 Debugging file: ${filePath}`);

    try {
        const info = await templateReader.readTemplate(filePath);
        console.log(`📑 Extracted Headers (${info.headers?.length || 0}):`);
        console.log(info.headers);

        if (!info.headers || info.headers.length === 0) {
            console.error("❌ No headers found! This is why injection fails/skips.");
            return;
        }

        // 3. Simulating Injection
        console.log("\n💉 Attempting Injection with Mock Data...");
        const mockContent: Record<string, string> = {};
        // Use the first found header
        const testHeader = info.headers[0];
        mockContent[testHeader] = `这是注入的测试内容 for ${testHeader}\n第二行内容\n### 子标题测试`;

        console.log(`Injecting under header: "${testHeader}"`);

        await fs.ensureDir(path.dirname(outputPath));
        await fs.copy(filePath, outputPath);

        await docInjector.injectContent(filePath, outputPath, mockContent);

        // 4. Verify output XML
        const outContent = await fs.readFile(outputPath);
        const outZip = new PizZip(outContent);
        const outXml = outZip.file('word/document.xml')?.asText() || '';

        if (outXml.includes("这是注入的测试内容")) {
            console.log("✅ Injection Successful (Content found in output XML)");
        } else {
            console.log("❌ Injection Failed (Content NOT found in output XML)");
            console.log("Output XML snippet (start):", outXml.substring(0, 500));
        }

    } catch (e) {
        console.error(e);
    }
}

debug();
