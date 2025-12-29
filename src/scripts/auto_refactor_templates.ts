
import fs from 'fs-extra';
import path from 'path';
import PizZip from 'pizzip';
import { fileURLToPath } from 'url';
import orchestrator from '../core/orchestrator.js';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// 关键词映射配置 (增强版)
const KEYWORD_MAPPING: Record<string, string[]> = {
    // 01 立项
    'projectBackground': ['项目背景', '立项依据', '现状分析', '建设背景', '项目说明', '项目概况', '项目介绍', '项目实施主体', '项目性质'],
    'projectObjective': ['项目目标', '建设目标', '业务目标', '技术目标', '预期成果'],
    'projectNecessity': ['建设必要性', '必要性分析'],
    'marketAnalysis': ['市场需求', '行业现状', '市场分析', '竞品分析'],
    'feasibilityAnalysis': ['可行性分析', '技术可行性', '经济可行性', '运营可行性'],
    'riskAnalysis': ['风险分析', '风险识别', '应对措施', '项目风险', '潜在风险'],
    'technicalSolution': ['技术方案', '技术路线', '系统架构', '技术架构', '总体设计', '设计原则'],
    'implementationPlan': ['实施计划', '进度安排', '里程碑', '项目阶段', '时间表'],
    'costBenefitAnalysis': ['投资估算', '效益分析', '经济效益', '成本预算'],
    'socialBenefits': ['社会效益', '管理效益'],

    // 02 项目管理
    'projectScope': ['工作范围', '项目范围', '服务范围', '服务内容'],
    'schedulePlan': ['进度计划', '时间安排', '项目周期'],

    // 03 需求分析
    'userRequirements': ['用户需求', '用户角色', '包含角色', '目标用户'],
    'functionalRequirements': ['功能需求', '功能列表', '功能模块', '系统功能', '业务功能'],
    'nonFunctionalRequirements': ['非功能需求', '性能需求', '安全需求', '可靠性', '系统性能'],

    // 06 概要设计 & 07 详细设计
    'systemArchitecture': ['系统架构', '总体架构', '逻辑架构', '体系结构'],
    'functionalArchitecture': ['功能架构', '模块设计', '功能结构'],
    'networkTopology': ['网络拓扑', '部署架构', '网络结构'],
    'hardwareRequirements': ['硬件配置', '服务器配置', '设备要求', '硬件环境'],
    'databaseDesign': ['数据库设计', '数据表结构', '数据字典', 'E-R图'],
    'interfaceDesign': ['接口设计', '接口定义', 'API', '外部接口'],
    'securityDesign': ['安全设计', '安全方案', '安全体系'],
    'moduleDesign': ['模块详细设计', '功能实现', '模块说明'],

    // 08 开发与测试
    'workPlan': ['工作方案', '工作计划', '实施方案'],
    'weeklySummary': ['本周工作', '周报总结', '工作进展', '完成情况'],
    'testPlan': ['测试方案', '测试策略', '测试方法'],
    'testScope': ['测试范围', '测试内容'],
    'testEnvironment': ['测试环境', '软硬件环境'],
    'acceptanceCriteria': ['通过标准', '准出条件', '验收标准'],
    'testConclusion': ['测试结论', '测试总结'],
    'deploymentSteps': ['部署步骤', '安装流程', '部署流程'],
    'environmentPrep': ['环境准备', '安装准备'],
    'maintenanceProcedures': ['维护流程', '日常维护', '运维流程'],
    'troubleshooting': ['故障排查', '常见问题', '异常处理'],

    // 其他
    'trainingPlan': ['培训方案', '培训计划', '培训内容'],
    'projectSummary': ['项目总结', '工作总结', '项目回顾']
};


/**
 * 简单的 XML 文本提取（处理 split tags）
 */
function extractTextFromPara(pNodeXml: string): string {
    const matches = pNodeXml.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
    if (!matches) return '';

    return matches.map(m => {
        return m.replace(/<[^>]+>/g, '');
    }).join('');
}

/**
 * 判断是否为新的章节标题
 * 简单启发式：
 * 1. 以数字开头 (1., 1.1, 1、, 一、)
 * 2. 长度较短 (< 50 chars)
 */
function isHeader(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 50) return false;

    // 匹配常见的标题序号
    const patterns = [
        /^(\d+(\.\d+)*)/, // 1, 1.1, 1.1.1
        /^([一二三四五六七八九十]+、)/, // 一、
        /^(\（[一二三四五六七八九十]+\）)/, // （一）
        /^[A-Za-z0-9]+\./, // A. or 1.
    ];

    return patterns.some(p => p.test(trimmed));
}

async function refactorTemplates() {
    console.log('🚀 开始智能重构模板 (增强版)...');
    console.log('⚠️ 注意：此操作会将匹配章节下的**所有内容**替换为占位符，直到遇到下一个疑似标题。');

    try {
        const manifest = await orchestrator.loadManifest();
        const { phases, templateBasePath } = manifest;

        let processedFiles = 0;

        for (const phase of phases) {
            for (const doc of phase.documents) {
                if (!doc.aiFields || doc.aiFields.length === 0) continue;

                const templatePath = templateBasePath
                    ? path.join(config.paths.templates, templateBasePath, doc.template)
                    : path.join(config.paths.templates, doc.template);

                if (!fs.existsSync(templatePath)) continue;
                if (path.extname(templatePath).toLowerCase() !== '.docx') continue;

                console.log(`\n📄 分析文件: ${doc.template}`);

                try {
                    const content = fs.readFileSync(templatePath);
                    const zip = new PizZip(content);
                    const docXmlFile = zip.file("word/document.xml");

                    if (!docXmlFile) continue;

                    let docXml = docXmlFile.asText();
                    const paragraphs = docXml.split(/(?=<w:p[ >])/);

                    let newXmlParts: string[] = [];
                    let hasChanges = false;
                    let skipMode = false;


                    for (let i = 0; i < paragraphs.length; i++) {
                        const part = paragraphs[i];

                        if (!part.startsWith('<w:p')) {
                            newXmlParts.push(part);
                            continue;
                        }

                        const text = extractTextFromPara(part).trim();

                        // 1. 优先处理跳过逻辑 (Skip Logic FIRST)
                        // 如果处于跳过模式，只有遇到显式的“结构化标题”才停止跳过，
                        // 从而避免正文中的关键词（如“项目实施主体”）误触发新章节。
                        if (skipMode) {
                            if (isHeader(text)) {
                                // 发现新标题，停止跳过
                                skipMode = false;
                                // ⚠️ 重要：停止跳过后的这一行（新标题），需要继续向下执行
                                // 以便检查它是否匹配了新的 AI 字段关键词！
                            } else {
                                // 否则，视为正文内容，删除（不添加到 newXmlParts）
                                continue;
                            }
                        }

                        // 2. 然后才是关键词匹配逻辑
                        let matchedField: string | null = null;

                        for (const field of doc.aiFields) {
                            const keywords = KEYWORD_MAPPING[field.field];
                            if (!keywords) continue;

                            for (const kw of keywords) {
                                if (text.includes(kw)) {
                                    if (text.length < kw.length + 30 || isHeader(text)) {
                                        matchedField = field.field;
                                        break;
                                    }
                                }
                            }
                            if (matchedField) break;
                        }

                        if (matchedField) {
                            console.log(`   🎯 匹配章节: "${text}" -> {${matchedField}}`);
                            newXmlParts.push(part); // 保留标题

                            // 插入占位符
                            const tag = `{${matchedField}}`;
                            const placeholderXml = `<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:color w:val="0000FF"/></w:rPr><w:t>${tag}</w:t></w:r></w:p>`;
                            newXmlParts.push(placeholderXml);

                            hasChanges = true;
                            skipMode = true; // 开始强力跳过
                            continue;
                        }

                        // 普通段落，保留
                        newXmlParts.push(part);
                    }

                    if (hasChanges) {
                        const newDocXml = newXmlParts.join('');
                        zip.file("word/document.xml", newDocXml);
                        const newBuffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
                        fs.writeFileSync(templatePath, newBuffer);
                        console.log(`✅ 已保存修改: ${doc.template}`);
                        processedFiles++;
                    } else {
                        console.log(`   (无匹配章节)`);
                    }

                } catch (err) {
                    console.error(`❌ 处理失败: ${doc.template}`, err);
                }
            }
        }

        console.log(`\n🎉 全部完成! 共修改 ${processedFiles} 个文件。`);

    } catch (error) {
        console.error('运行失败:', error);
    }
}

refactorTemplates();
