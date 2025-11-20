import type { components } from './api.types';
import type { ObjectToCamel } from 'ts-case-convert';

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

// OpenAPI types (snake_case from API)
export type ProjectOpenAPI = components['schemas']['ProjectDB'];
export type ProjectCreateOpenAPI = components['schemas']['ProjectCreate'];
export type ProjectCreateResponseOpenAPI =
  components['schemas']['ProjectCreateResponse'];
export type ProjectCollectionParamsOpenAPI =
  components['schemas']['ProjectCollectionParams'];
export type ProjectPaginatedResponseOpenAPI =
  components['schemas']['api__schemas__project__GetProjectsPaginatedResponse'];
export type ProjectActionOpenAPI = components['schemas']['ProjectAction'];
export type ProjectUpdateOpenAPI = components['schemas']['ProjectUpdate'];
export type ProjectUpdateResponseOpenAPI =
  components['schemas']['ProjectUpdateResponse'];
export type ProjectDeleteResponseOpenAPI =
  components['schemas']['ProjectDeleteResponse'];
export type UserCollaboratorOpenAPI = components['schemas']['UserCollaborator'];
export type UserCollaboratorCreateOpenAPI =
  components['schemas']['UserCollaboratorCreate'];
export type GroupCollaboratorOpenAPI =
  components['schemas']['GroupCollaborator'];
export type GroupCollaboratorCreateOpenAPI =
  components['schemas']['GroupCollaboratorCreate'];
export type CollaboratorUpdateOpenAPI =
  components['schemas']['CollaboratorUpdate'];
export type CollaboratorRoleOpenAPI = components['schemas']['CollaboratorRole'];
export type CollaboratorRoleInfoOpenAPI =
  components['schemas']['CollaboratorRoleInfo'];
export type ListUserCollaboratorsResponseOpenAPI =
  components['schemas']['ListUserCollaboratorsResponse'];
export type ListGroupCollaboratorsResponseOpenAPI =
  components['schemas']['ListGroupCollaboratorsResponse'];

// CamelCase types (converted from OpenAPI types)
export type Project = ObjectToCamel<ProjectOpenAPI>;
export type ProjectCreate = ObjectToCamel<ProjectCreateOpenAPI>;
export type ProjectCreateResponse = ObjectToCamel<ProjectCreateResponseOpenAPI>;
export type ProjectCollectionParams =
  ObjectToCamel<ProjectCollectionParamsOpenAPI>;
export type ProjectPaginatedResponse =
  ObjectToCamel<ProjectPaginatedResponseOpenAPI>;
// ProjectAction is a string literal union, so no conversion needed
export type ProjectAction = ProjectActionOpenAPI;
export type ProjectUpdate = ObjectToCamel<ProjectUpdateOpenAPI>;
export type ProjectUpdateResponse = ObjectToCamel<ProjectUpdateResponseOpenAPI>;
export type ProjectDeleteResponse = ObjectToCamel<ProjectDeleteResponseOpenAPI>;
export type UserCollaborator = ObjectToCamel<UserCollaboratorOpenAPI>;
export type UserCollaboratorCreate =
  ObjectToCamel<UserCollaboratorCreateOpenAPI>;
export type GroupCollaborator = ObjectToCamel<GroupCollaboratorOpenAPI>;
export type GroupCollaboratorCreate =
  ObjectToCamel<GroupCollaboratorCreateOpenAPI>;
export type CollaboratorUpdate = ObjectToCamel<CollaboratorUpdateOpenAPI>;
// CollaboratorRole is a string literal union, so no conversion needed
export type CollaboratorRole = CollaboratorRoleOpenAPI;
export type CollaboratorRoleInfo = ObjectToCamel<CollaboratorRoleInfoOpenAPI>;
export type ListUserCollaboratorsResponse =
  ObjectToCamel<ListUserCollaboratorsResponseOpenAPI>;
export type ListGroupCollaboratorsResponse =
  ObjectToCamel<ListGroupCollaboratorsResponseOpenAPI>;

export type ProjectCreateOptions = {
  type?: ProjectTypes;
  createdBy?: string;
  createExampleTemplates?: boolean;
};

export type CollaboratorListOptions = {
  startingToken?: number;
  limit?: number;
};

export type GetProjectOptions = {
  projectId?: string;
  name?: string;
  projectType?: ProjectTypes;
};
