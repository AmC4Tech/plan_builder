
import path from 'path';
import fs from 'fs-extra';
import config from '../config/index.js';
import directoryScanner from './directory-scanner.js';
import templateReader from './template-reader.js';
import aiWriter from './ai_writer.js';
import docInjector from './doc-injector.js';
import excelGenerator from './excel-generator.js';
import { defaultDocxPrompt, defaultExcelPrompt, fileSpecificPrompts } from '../config/prompts/index.js';
import type { ProjectData } from '../types/index.js';

export class DocGenerator {
    /**
     * Generate all documents based on template backup with style preservation
     */
    async generateAll(projectData: ProjectData): Promise<string[]> {
        const templateRoot = path.join(config.paths.templates, 'template_backup');
        const outputRoot = path.join(config.paths.output, projectData.projectName || 'GeneratedProject');

        console.log(`🚀 开始生成文档 (样式保留模式)...`);
        console.log(`📂 模板目录: ${templateRoot}`);
        console.log(`📂 输出目录: ${outputRoot}`);

        // 1. Scan templates
        const fileNodes = await directoryScanner.scan(templateRoot);
        const files = directoryScanner.flatten(fileNodes);

        const generatedFiles: string[] = [];

        // 2. Process each file
        for (const file of files) {
            try {
                // Sanitized relative path with placeholders replaced
                let relativePath = file.relativePath;
                if (projectData.projectName) {
                    relativePath = relativePath.replace(/xx项目|XX项目|xxx项目|XX/gi, projectData.projectName).replace(/项目项目/g, '项目'); // Cleanup double "Project" if user included it
                }
                const targetPath = path.join(outputRoot, relativePath);

                console.log(`📄 处理文件: ${file.relativePath} -> ${relativePath}`);

                // 2a. Copy template
                await fs.ensureDir(path.dirname(targetPath));
                await fs.copy(file.path, targetPath);

                // 3. Read template
                const templateInfo = await templateReader.readTemplate(file.path);

                // --- PROMPT GENERATION LOGIC START ---
                // We use the original relative path for prompt lookup to match the keys in config
                const configPath = file.relativePath.replace(/\\/g, '/');
                // Find specific prompt or fallback to default
                const promptFn = fileSpecificPrompts[configPath] ||
                    (templateInfo.type === 'docx' ? defaultDocxPrompt : defaultExcelPrompt);

                const promptContext = {
                    projectData,
                    headers: templateInfo.headers || [], // DOCX
                    structure: templateInfo.structure,   // EXCEL
                    fileContentPreview: templateInfo.content // Preview
                };

                const prompt = promptFn(promptContext);
                // --- PROMPT GENERATION LOGIC END ---

                if (templateInfo.type === 'docx') {
                    const headers = templateInfo.headers || [];

                    if (headers.length === 0) {
                        console.warn(`⚠️ 未检测到标题，跳过注入。`);
                        continue;
                    }

                    // Content Generation
                    const contentMap = await aiWriter.generateJSON(prompt, projectData);

                    if (Object.keys(contentMap).length > 0) {
                        // Pass detected contentMap AND detected headers (keys) to injector
                        // Actually contentMap keys ARE the headers we want to match.
                        console.log('🤖 AI Content Keys:', Object.keys(contentMap));
                        await fs.writeJson(path.join(process.cwd(), 'debug-ai-output.json'), contentMap, { spaces: 2 });
                        await docInjector.injectContent(file.path, targetPath, contentMap);
                        generatedFiles.push(targetPath);
                    } else {
                        console.warn(`⚠️ AI 未生成有效内容: ${file.relativePath}`);
                    }

                } else if (templateInfo.type === 'xlsx') {
                    const headers = templateInfo.structure?.headers || [];
                    // Generate data
                    const data = await aiWriter.generateJSON(prompt, projectData);
                    console.log('🤖 AI Content Keys:', Object.keys(data)); // Debug AI response keys
                    if (Array.isArray(data)) {
                        await excelGenerator.createExcel(targetPath, data, headers, true);
                        generatedFiles.push(targetPath);
                    }
                }

            } catch (error) {
                console.error(`❌ 处理文件失败 ${file.relativePath}:`, error);
            }
        }

        console.log(`✅ 生成完成! 共生成 ${generatedFiles.length} 个文件。`);
        return generatedFiles;
    }
}

export const docGenerator = new DocGenerator();
export default docGenerator;
