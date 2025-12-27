/**
 * 模板转换器
 * 将模板中的 XX/xxx 占位符转换为 docxtemplater 格式 {variable}
 * 同时分析需要 AI 生成的内容段落
 * 
 * 运行方式: npx tsx src/scripts/convert-templates.ts
 */

import fs from 'fs-extra';
import path from 'path';
import PizZip from 'pizzip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 变量映射规则
const VARIABLE_MAPPINGS: Record<string, string> = {
    // 项目基本信息
    'XX项目': '{projectName}项目',
    'xx项目': '{projectName}项目',
    'XXX项目': '{projectName}项目',
    'xxx项目': '{projectName}项目',

    'XX平台': '{projectName}平台',
    'xx平台': '{projectName}平台',

    'XX系统': '{projectName}系统',
    'xx系统': '{projectName}系统',

    'XX建设项目': '{projectName}建设项目',

    // 公司信息
    'XX公司': '{companyName}',
    'xxx公司': '{companyName}',
    'XXX公司': '{companyName}',

    // 日期相关
    'XXXX年': '{year}年',
    'XX年': '{year}年',
    'XX月': '{month}月',
    'XX日': '{day}日',
    'XXXX年XX月XX日': '{year}年{month}月{day}日',
    'XX年XX月': '{startYear}年{startMonth}月',
    'XX年XX月到XX年XX月': '{startYear}年{startMonth}月到{endYear}年{endMonth}月',

    // 版本信息
    'V0.1': '{version}',
    'V1.0': '{version}',
    'v0.1': '{version}',
    'v1.0': '{version}',

    // 人员相关
    'XXX（项目经理）': '{projectManager}（项目经理）',
    'XXX': '{personName}',

    // 编号相关
    'XX-XXX-XXX': '{documentCode}',
};

// 需要 AI 生成的内容模式（描述性段落）
const AI_CONTENT_PATTERNS = [
    /项目背景.*?[。；]/gs,
    /项目目标.*?[。；]/gs,
    /可行性分析.*?[。；]/gs,
    /风险分析.*?[。；]/gs,
    /技术方案.*?[。；]/gs,
    /实施计划.*?[。；]/gs,
    /预期成果.*?[。；]/gs,
    /项目总结.*?[。；]/gs,
    /经验教训.*?[。；]/gs,
    /改进建议.*?[。；]/gs,
];

// 识别占位符内容的模式
const PLACEHOLDER_PATTERNS = [
    { pattern: /说明[^。]+[。]/g, type: 'instruction', description: '填写说明' },
    { pattern: /阐明[^。]+[。]/g, type: 'instruction', description: '填写说明' },
    { pattern: /描述[^。]+[。]/g, type: 'instruction', description: '填写说明' },
    { pattern: /列出[^。]+[。]/g, type: 'instruction', description: '填写说明' },
    { pattern: /简述[^。]+[。]/g, type: 'instruction', description: '填写说明' },
];

interface ConversionResult {
    filePath: string;
    fileName: string;
    format: 'docx' | 'doc';
    converted: boolean;
    variablesFound: string[];
    variablesReplaced: Array<{ original: string; replacement: string }>;
    aiContentSuggestions: Array<{
        location: string;
        content: string;
        suggestedPrompt: string;
    }>;
    errors: string[];
}

interface AnalysisReport {
    totalFiles: number;
    docxFiles: number;
    docFiles: number;
    convertedFiles: number;
    allVariables: string[];
    allAiSuggestions: ConversionResult['aiContentSuggestions'];
    manifestUpdate: {
        variables: Record<string, { type: string; description: string }>;
        aiFields: Array<{ template: string; field: string; prompt: string }>;
    };
}

/**
 * 从 DOCX 文件中提取 XML 内容
 */
async function extractDocxXml(filePath: string): Promise<{ zip: PizZip; xml: string } | null> {
    try {
        const content = await fs.readFile(filePath);
        const zip = new PizZip(content);

        const documentXml = zip.file('word/document.xml');
        if (!documentXml) {
            return null;
        }

        return {
            zip,
            xml: documentXml.asText(),
        };
    } catch (error) {
        console.error(`无法读取 ${filePath}:`, (error as Error).message);
        return null;
    }
}

/**
 * 分析文本内容，识别需要 AI 生成的部分
 */
function analyzeForAiContent(text: string, filePath: string): ConversionResult['aiContentSuggestions'] {
    const suggestions: ConversionResult['aiContentSuggestions'] = [];

    // 检查填写说明性内容
    for (const { pattern, description } of PLACEHOLDER_PATTERNS) {
        let match;
        const regex = new RegExp(pattern);
        while ((match = regex.exec(text)) !== null) {
            const content = match[0].trim();
            if (content.length > 10 && content.length < 200) {
                suggestions.push({
                    location: filePath,
                    content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
                    suggestedPrompt: `根据项目 {projectName} 的实际情况，${content}`,
                });
            }
        }
    }

    // 检查明显的描述性段落
    const descriptivePatterns = [
        { keyword: '可行性', field: 'feasibilityAnalysis', prompt: '撰写可行性分析报告' },
        { keyword: '风险', field: 'riskAnalysis', prompt: '撰写风险分析和应对措施' },
        { keyword: '总结', field: 'projectSummary', prompt: '撰写项目总结报告' },
        { keyword: '背景', field: 'projectBackground', prompt: '描述项目背景和立项依据' },
        { keyword: '目标', field: 'projectObjective', prompt: '描述项目目标和预期成果' },
        { keyword: '技术方案', field: 'technicalSolution', prompt: '描述技术实现方案' },
        { keyword: '实施计划', field: 'implementationPlan', prompt: '制定项目实施计划' },
        { keyword: '测试方案', field: 'testPlan', prompt: '制定测试方案和测试用例' },
        { keyword: '培训方案', field: 'trainingPlan', prompt: '制定培训方案和培训内容' },
    ];

    for (const { keyword, field, prompt } of descriptivePatterns) {
        if (text.includes(keyword)) {
            // 检查是否有占位符内容
            const hasPlaceholder = text.includes('说明') || text.includes('描述') || text.includes('阐明');
            if (hasPlaceholder) {
                suggestions.push({
                    location: filePath,
                    content: `包含"${keyword}"相关内容`,
                    suggestedPrompt: `为项目 {projectName} ${prompt}`,
                });
            }
        }
    }

    return suggestions;
}

/**
 * 转换单个 DOCX 文件中的变量
 */
async function convertDocxVariables(
    filePath: string,
    outputDir: string
): Promise<ConversionResult> {
    const result: ConversionResult = {
        filePath: path.relative(path.dirname(outputDir), filePath),
        fileName: path.basename(filePath),
        format: 'docx',
        converted: false,
        variablesFound: [],
        variablesReplaced: [],
        aiContentSuggestions: [],
        errors: [],
    };

    const docData = await extractDocxXml(filePath);
    if (!docData) {
        result.errors.push('无法读取文件');
        return result;
    }

    let { xml } = docData;
    const { zip } = docData;
    const originalXml = xml;

    // 提取纯文本用于分析
    const plainText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    // 分析 AI 内容建议
    result.aiContentSuggestions = analyzeForAiContent(plainText, result.filePath);

    // 查找所有 XX/xxx 形式的占位符
    const xxPatterns = [
        /XX+/g,
        /xx+/g,
        /Xx+/g,
    ];

    for (const pattern of xxPatterns) {
        let match;
        while ((match = pattern.exec(plainText)) !== null) {
            const found = match[0];
            if (found.length >= 2 && !result.variablesFound.includes(found)) {
                result.variablesFound.push(found);
            }
        }
    }

    // 按长度排序，优先替换较长的模式
    const sortedMappings = Object.entries(VARIABLE_MAPPINGS)
        .sort((a, b) => b[0].length - a[0].length);

    // 执行替换
    for (const [original, replacement] of sortedMappings) {
        if (xml.includes(original)) {
            // 在 XML 中替换（需要注意 XML 标签分割的情况）
            xml = xml.split(original).join(replacement);
            result.variablesReplaced.push({ original, replacement });
        }
    }

    // 替换独立的 XX/xxx（未被匹配到的）
    // 这些通常是项目名称占位符
    xml = xml.replace(/(?<![a-zA-Z\u4e00-\u9fa5])XX(?![a-zA-Z\u4e00-\u9fa5X])/g, '{projectName}');
    xml = xml.replace(/(?<![a-zA-Z\u4e00-\u9fa5])xx(?![a-zA-Z\u4e00-\u9fa5x])/g, '{projectName}');

    if (xml !== originalXml) {
        result.converted = true;

        // 保存转换后的文件
        zip.file('word/document.xml', xml);
        const outputPath = path.join(outputDir, result.filePath);
        await fs.ensureDir(path.dirname(outputPath));

        const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
        await fs.writeFile(outputPath, buffer);
    }

    return result;
}

/**
 * 处理目录中的所有模板
 */
async function processTemplates(
    inputDir: string,
    outputDir: string
): Promise<ConversionResult[]> {
    const results: ConversionResult[] = [];

    async function processDir(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            // 跳过临时文件
            if (entry.name.startsWith('~$')) continue;

            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                await processDir(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();

                if (ext === '.docx') {
                    console.log(`处理: ${entry.name}`);
                    const result = await convertDocxVariables(fullPath, outputDir);
                    results.push(result);
                } else if (ext === '.doc') {
                    results.push({
                        filePath: path.relative(inputDir, fullPath),
                        fileName: entry.name,
                        format: 'doc',
                        converted: false,
                        variablesFound: [],
                        variablesReplaced: [],
                        aiContentSuggestions: [],
                        errors: ['.doc 格式需要先转换为 .docx'],
                    });
                }
            }
        }
    }

    await processDir(inputDir);
    return results;
}

/**
 * 生成分析报告
 */
function generateReport(results: ConversionResult[]): AnalysisReport {
    const allVariables = new Set<string>();
    const allAiSuggestions: ConversionResult['aiContentSuggestions'] = [];

    for (const result of results) {
        result.variablesReplaced.forEach(v => allVariables.add(v.replacement));
        allAiSuggestions.push(...result.aiContentSuggestions);
    }

    // 从变量生成 manifest 配置
    const variables: Record<string, { type: string; description: string }> = {};
    const variableList = Array.from(allVariables);

    const variablePatterns: Record<string, { type: string; description: string }> = {
        'projectName': { type: 'string', description: '项目名称' },
        'projectCode': { type: 'string', description: '项目编号' },
        'companyName': { type: 'string', description: '公司名称' },
        'projectManager': { type: 'string', description: '项目经理' },
        'personName': { type: 'string', description: '人员姓名' },
        'year': { type: 'string', description: '年份' },
        'month': { type: 'string', description: '月份' },
        'day': { type: 'string', description: '日期' },
        'startYear': { type: 'string', description: '开始年份' },
        'startMonth': { type: 'string', description: '开始月份' },
        'endYear': { type: 'string', description: '结束年份' },
        'endMonth': { type: 'string', description: '结束月份' },
        'version': { type: 'string', description: '版本号' },
        'documentCode': { type: 'string', description: '文档编号' },
    };

    for (const v of variableList) {
        const match = v.match(/\{(\w+)\}/);
        if (match && variablePatterns[match[1]]) {
            variables[match[1]] = variablePatterns[match[1]];
        }
    }

    // 生成 AI 字段配置
    const aiFields: Array<{ template: string; field: string; prompt: string }> = [];
    const seenTemplates = new Set<string>();

    for (const suggestion of allAiSuggestions) {
        if (!seenTemplates.has(suggestion.location)) {
            seenTemplates.add(suggestion.location);

            // 从建议中提取字段名
            let field = 'content';
            if (suggestion.suggestedPrompt.includes('可行性')) field = 'feasibilityAnalysis';
            else if (suggestion.suggestedPrompt.includes('风险')) field = 'riskAnalysis';
            else if (suggestion.suggestedPrompt.includes('总结')) field = 'projectSummary';
            else if (suggestion.suggestedPrompt.includes('背景')) field = 'projectBackground';
            else if (suggestion.suggestedPrompt.includes('目标')) field = 'projectObjective';
            else if (suggestion.suggestedPrompt.includes('技术')) field = 'technicalSolution';
            else if (suggestion.suggestedPrompt.includes('测试')) field = 'testPlan';
            else if (suggestion.suggestedPrompt.includes('培训')) field = 'trainingPlan';

            aiFields.push({
                template: suggestion.location,
                field,
                prompt: suggestion.suggestedPrompt,
            });
        }
    }

    return {
        totalFiles: results.length,
        docxFiles: results.filter(r => r.format === 'docx').length,
        docFiles: results.filter(r => r.format === 'doc').length,
        convertedFiles: results.filter(r => r.converted).length,
        allVariables: variableList,
        allAiSuggestions,
        manifestUpdate: {
            variables,
            aiFields,
        },
    };
}

/**
 * 主函数
 */
async function main() {
    const inputDir = path.resolve(__dirname, '../templates/template');
    const outputDir = path.resolve(__dirname, '../templates/template_converted');

    console.log('🔄 开始模板转换...\n');
    console.log(`输入目录: ${inputDir}`);
    console.log(`输出目录: ${outputDir}\n`);

    // 清理输出目录
    await fs.emptyDir(outputDir);

    // 处理模板
    const results = await processTemplates(inputDir, outputDir);

    // 生成报告
    const report = generateReport(results);

    console.log('\n' + '='.repeat(80));
    console.log('📊 转换报告');
    console.log('='.repeat(80));

    console.log(`\n总文件数: ${report.totalFiles}`);
    console.log(`  - DOCX: ${report.docxFiles}`);
    console.log(`  - DOC: ${report.docFiles}`);
    console.log(`已转换: ${report.convertedFiles}`);

    console.log('\n📝 识别的变量:');
    Object.entries(report.manifestUpdate.variables).forEach(([name, info]) => {
        console.log(`  - {${name}}: ${info.description}`);
    });

    console.log('\n🤖 建议的 AI 生成字段:');
    report.manifestUpdate.aiFields.forEach((field, index) => {
        console.log(`  ${index + 1}. ${field.template}`);
        console.log(`     字段: ${field.field}`);
        console.log(`     Prompt: ${field.prompt}`);
    });

    // 保存报告
    const reportPath = path.resolve(__dirname, '../templates/conversion-report.json');
    await fs.writeJson(reportPath, {
        results,
        report,
    }, { spaces: 2 });

    console.log(`\n📄 详细报告已保存到: ${reportPath}`);
    console.log(`📁 转换后的模板已保存到: ${outputDir}`);

    // 如果有 .doc 文件，给出提示
    const docFiles = results.filter(r => r.format === 'doc');
    if (docFiles.length > 0) {
        console.log('\n⚠️  以下 .doc 文件需要手动转换为 .docx 格式:');
        docFiles.forEach(f => console.log(`   - ${f.filePath}`));
    }
}

main().catch(console.error);
