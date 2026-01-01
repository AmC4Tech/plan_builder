
import { docGenerator } from './core/doc-generator.js';
import type { ProjectData } from './types/index.js';

const projectData: ProjectData = {
    projectName: '广州农业数字孪生管理系统',
    projectDescription: '管理广州地区农业数据数字孪生',
    options: {}
};

async function testSingle() {
    // Only run for specific file to test
    const relativePath = '01立项/01项目建议书/xx项目建议书.docx';
    console.log(`Testing injection workflow for: ${relativePath}`);

    // We can just call generateAll but simpler to mock or just use generateAll and ignore others?
    // Let's use generateAll properly to test the integrated flow.
    try {
        await docGenerator.generateAll(projectData);
    } catch (e) {
        console.error(e);
    }
}

testSingle();
