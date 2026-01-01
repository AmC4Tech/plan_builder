
import { docGenerator } from './core/doc-generator.js';
import type { ProjectData } from './types/index.js';

const projectData: ProjectData = {
    projectName: '广州物联网ai管理平台',
    projectDescription: '一个基于物联网和AI的智慧城市管理平台，包含交通监控、环境监测和公共安全模块。',
    options: {}
};

async function run() {
    try {
        console.log('Testing DocGenerator V2...');
        await docGenerator.generateAll(projectData);
        console.log('Test complete.');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

run();
