
import { ProjectData } from '../../types/index.js';

export interface PromptContext {
    projectData: ProjectData;
    headers?: string[]; // For DOCX
    structure?: any;    // For Excel
    fileContentPreview?: string;
}
