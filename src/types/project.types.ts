import { components } from './api.types';

// Use API type as source of truth
export type ProjectTypes = components['schemas']['ProjectType'];

// Keep existing enum as const object with compile-time validation
// Add missing values from API to ensure satisfies validation passes
export const ProjectTypes = {
  evaluate: 'prompt_evaluation',
  observe: 'llm_monitor',
  genAI: 'gen_ai',
  training: 'training_inference', // New from API
  protect: 'protect' // New from API
} as const satisfies Record<string, ProjectTypes>;

// Use API type for Project interface
export type Project = components['schemas']['ProjectDB'];

// Project creation response type (different from full Project)
export type ProjectCreateResponse =
  components['schemas']['ProjectCreateResponse'];
