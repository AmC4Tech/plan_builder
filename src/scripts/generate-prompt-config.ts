
import fs from 'fs-extra';
import path from 'path';
import directoryScanner from '../core/directory-scanner.js';
import config from '../config/index.js';

async function generate() {
    console.log('🚀 Generating split prompt configuration...');

    // 1. Scan templates
    const templateRoot = path.join(config.paths.templates, 'template_backup');
    const fileNodes = await directoryScanner.scan(templateRoot);
    const files = directoryScanner.flatten(fileNodes);

    const outputDir = path.join(process.cwd(), 'src/config/prompts');
    await fs.ensureDir(outputDir);

    // 2. Generate types.ts
    const typesContent = `
import { ProjectData } from '../../types/index.js';

export interface PromptContext {
    projectData: ProjectData;
    headers?: string[]; // For DOCX
    structure?: any;    // For Excel
    fileContentPreview?: string;
}
`;
    await fs.writeFile(path.join(outputDir, 'types.ts'), typesContent);

    // 3. Generate defaults.ts
    const defaultsContent = `
import { PromptContext } from './types.js';

export const defaultDocxPrompt = (ctx: PromptContext) => \`
你是一个专业的项目文档编写助手。
请根据以下章节标题列表，结合项目背景"\${ctx.projectData.projectDescription}"，为项目"\${ctx.projectData.projectName}"编写对应的内容。
请返回一个 JSON 对象，Key 是章节标题（必须完全匹配），Value 是对应的内容。

要求：
1. **不要** 在 Value 内容中重复包含 Key（标题）本身。
2. **不要** 生成章节目录（TOC）。
3. **不要** 使用 Markdown 列表格式（如 "- " 或 "* "）来分段。请使用常规的段落文本，段落之间用换行符分隔。
4. 内容应专业、详实，符合商业计划书或项目文档规范。

章节列表:
\${(ctx.headers || []).map(h => \`- \${h}\`).join('\\n')}

参考语境（原文档内容，仅供参考风格，请重新生成）：
\${(ctx.fileContentPreview || '').substring(0, 500)}...
\`;

export const defaultExcelPrompt = (ctx: PromptContext) => \`
你是一个测试用例或数据生成助手。
请根据以下Excel表头结构，结合项目背景"\${ctx.projectData.projectDescription}"，为项目"\${ctx.projectData.projectName}"生成数据。
请返回一个JSON数组，数组中每个对象对应一行数据，key必须与表头一致。

表头: \${(ctx.structure?.headers || []).join(', ')}
\`;
`;
    await fs.writeFile(path.join(outputDir, 'defaults.ts'), defaultsContent);

    // 4. Group files by top-level directory
    const groups: Record<string, typeof files> = {};

    // Mapping for English filenames
    const dirNameMapping: Record<string, string> = {
        '01立项': '01_project_initiation',
        '02项目管理': '02_project_management',
        '03需求分析': '03_requirements_analysis',
        '04研发制度管理': '04_rd_management',
        '05研发团队情况': '05_rd_team',
        '06概要设计': '06_high_level_design',
        '07详细设计': '07_detailed_design',
        '08开发与测试': '08_dev_and_test',
        '09实施': '09_implementation',
        '10验收': '10_acceptance',
        '11试运行': '11_trial_run',
        '12项目收尾': '12_project_closure'
    };

    for (const file of files) {
        const relativePath = file.relativePath.replace(/\\/g, '/');
        const parts = relativePath.split('/');
        const topDir = parts.length > 1 ? parts[0] : 'root';

        if (!groups[topDir]) groups[topDir] = [];
        groups[topDir].push(file);
    }

    // 5. Generate group files
    const groupNames = Object.keys(groups);
    const generatedModules: string[] = [];

    for (const groupName of groupNames) {
        // Use mapping or fallback to sanitize
        let safeName = dirNameMapping[groupName] || groupName.replace(/[^\w\d]/g, '_');
        // Ensure it doesn't start with number alone if possible, though JS filenames can. 
        // But imports usually fine.

        let content = `
import { PromptContext } from './types.js';

export const prompts: Record<string, (ctx: PromptContext) => string> = {
`;
        for (const file of groups[groupName]) {
            const relativePath = file.relativePath.replace(/\\/g, '/');
            const ext = (file.extension || '').toLowerCase();
            let promptBody = '';

            if (ext === '.docx' || ext === '.doc') {
                promptBody = `    // DOCX: ${relativePath}
    "${relativePath}": (ctx) => \`
你是一个专业的项目文档编写助手。
请根据以下章节标题列表，结合项目背景"\${ctx.projectData.projectDescription}"，为项目"\${ctx.projectData.projectName}"编写对应的内容。
请返回一个 JSON 对象，Key 是章节标题（必须完全匹配），Value 是对应的内容。

要求：
1. **不要** 在 Value 内容中重复包含 Key（标题）本身。
2. **不要** 生成章节目录（TOC）。
3. **不要** 使用 Markdown 列表格式（如 "- " 或 "* "）来分段。请使用常规的段落文本，段落之间用换行符分隔。
4. 内容应专业、详实，符合商业计划书或项目文档规范。

章节列表:
\${(ctx.headers || []).map(h => \`- \${h}\`).join('\\n')}

参考语境（原文档内容，仅供参考风格，请重新生成）：
\${(ctx.fileContentPreview || '').substring(0, 500)}...
\`,`;
            } else if (ext === '.xlsx') {
                promptBody = `    // EXCEL: ${relativePath}
    "${relativePath}": (ctx) => \`
你是一个测试用例或数据生成助手。
请根据以下Excel表头结构，结合项目背景"\${ctx.projectData.projectDescription}"，为项目"\${ctx.projectData.projectName}"生成数据。
请返回一个JSON数组，数组中每个对象对应一行数据，key必须与表头一致。

表头: \${(ctx.structure?.headers || []).join(', ')}
\`,`;
            }
            if (promptBody) content += '\n' + promptBody + '\n';
        }

        content += `
};
`;
        await fs.writeFile(path.join(outputDir, `${safeName}.ts`), content);
        console.log(`Created: ${safeName}.ts`);
        generatedModules.push(safeName);
    }

    // 6. Generate index.ts
    let indexContent = `
export * from './types.js';
export * from './defaults.js';
`;
    // Import all groups
    for (let i = 0; i < generatedModules.length; i++) {
        const modName = generatedModules[i];
        // Import name can be same as module name if valid identifier, else alias
        // modName e.g. "01_project_initiation". Valid import.
        // But "01..." is not valid identifier for variable? 
        // "import { prompts as 01_... }" -> Syntax Error.
        // We use alias g0, g1...

        indexContent += `import { prompts as g${i} } from './${modName}.js';\n`;
    }

    indexContent += `\nexport const fileSpecificPrompts: Record<string, any> = {\n`;
    for (let i = 0; i < generatedModules.length; i++) {
        indexContent += `    ...g${i},\n`;
    }
    indexContent += `};\n`;

    await fs.writeFile(path.join(outputDir, 'index.ts'), indexContent);
    console.log(`✅ Index generated at: ${path.join(outputDir, 'index.ts')}`);
}

generate().catch(console.error);
