import { components } from './api.types';

// Keep existing enum for backward compatibility
export enum ProjectTypes {
  evaluate = 'prompt_evaluation',
  observe = 'llm_monitor',
  genAI = 'gen_ai'
}

// Add full API type for new usage
export type ProjectType = components['schemas']['ProjectType'];

// Use API type for Project interface
export type Project = components['schemas']['ProjectDB'];

// Project creation response type (different from full Project)
export type ProjectCreateResponse =
  components['schemas']['ProjectCreateResponse'];
