import type { components } from './api.types';

export type PromptTemplate =
  components['schemas']['BasePromptTemplateResponse'];
export type PromptTemplateVersion =
  components['schemas']['BasePromptTemplateVersionResponse'];
export type ListPromptTemplateResponse =
  components['schemas']['ListPromptTemplateResponse'];
export type DatasetData = components['schemas']['DatasetData'];
export type StringData = components['schemas']['StringData'];
export type RenderTemplateRequest =
  components['schemas']['RenderTemplateRequest'];
export type RenderedTemplate = components['schemas']['RenderedTemplate'];
export type RenderTemplateResponse =
  components['schemas']['RenderTemplateResponse'];
