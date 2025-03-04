export enum ProjectTypes {
  evaluate = 'prompt_evaluation',
  observe = 'llm_monitor',
  genAI = 'gen_ai'
}

export interface Project {
  id: string;
  name: string;
  type: ProjectTypes;
}
