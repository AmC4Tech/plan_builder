
export * from './types.js';
export * from './defaults.js';
import { prompts as g0 } from './01_project_initiation.js';
import { prompts as g1 } from './02_project_management.js';
import { prompts as g2 } from './03_requirements_analysis.js';
import { prompts as g3 } from './04_rd_management.js';
import { prompts as g4 } from './05_rd_team.js';
import { prompts as g5 } from './06_high_level_design.js';
import { prompts as g6 } from './07_detailed_design.js';
import { prompts as g7 } from './08_dev_and_test.js';
import { prompts as g8 } from './09_implementation.js';
import { prompts as g9 } from './10_acceptance.js';
import { prompts as g10 } from './11_trial_run.js';
import { prompts as g11 } from './12_project_closure.js';

export const fileSpecificPrompts: Record<string, any> = {
    ...g0,
    ...g1,
    ...g2,
    ...g3,
    ...g4,
    ...g5,
    ...g6,
    ...g7,
    ...g8,
    ...g9,
    ...g10,
    ...g11,
};
