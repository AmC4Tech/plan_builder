
import { PromptContext } from './types.js';

export const prompts: Record<string, (ctx: PromptContext) => string> = {

    // DOCX: 10验收/03项目中期报告/项目工作报告_基于4D-BIM技术的变电修理技改项目管理系统研究与应用.docx
    "10验收/03项目中期报告/项目工作报告_基于4D-BIM技术的变电修理技改项目管理系统研究与应用.docx": (ctx) => `
你是一个专业的项目文档编写助手。
请根据以下章节标题列表，结合项目背景"${ctx.projectData.projectDescription}"，为项目"${ctx.projectData.projectName}"编写对应的内容。
请返回一个 JSON 对象，Key 是章节标题（必须完全匹配），Value 是对应的内容。

要求：
1. **不要** 在 Value 内容中重复包含 Key（标题）本身。
2. **不要** 生成章节目录（TOC）。
3. **不要** 使用 Markdown 列表格式（如 "- " 或 "* "）来分段。请使用常规的段落文本，段落之间用换行符分隔。
4. 内容应专业、详实，符合商业计划书或项目文档规范。

章节列表:
${(ctx.headers || []).map(h => `- ${h}`).join('\n')}

参考语境（原文档内容，仅供参考风格，请重新生成）：
${(ctx.fileContentPreview || '').substring(0, 500)}...
`,

    // DOCX: 10验收/08验收意见（正式盖章版）/2、项目竣工验收证书-xx项目.docx
    "10验收/08验收意见（正式盖章版）/2、项目竣工验收证书-xx项目.docx": (ctx) => `
你是一个专业的项目文档编写助手。
请根据以下章节标题列表，结合项目背景"${ctx.projectData.projectDescription}"，为项目"${ctx.projectData.projectName}"编写对应的内容。
请返回一个 JSON 对象，Key 是章节标题（必须完全匹配），Value 是对应的内容。

要求：
1. **不要** 在 Value 内容中重复包含 Key（标题）本身。
2. **不要** 生成章节目录（TOC）。
3. **不要** 使用 Markdown 列表格式（如 "- " 或 "* "）来分段。请使用常规的段落文本，段落之间用换行符分隔。
4. 内容应专业、详实，符合商业计划书或项目文档规范。

章节列表:
${(ctx.headers || []).map(h => `- ${h}`).join('\n')}

参考语境（原文档内容，仅供参考风格，请重新生成）：
${(ctx.fileContentPreview || '').substring(0, 500)}...
`,

};
