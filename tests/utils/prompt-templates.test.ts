import {
  createPrompt,
  deletePrompt,
  getPrompt,
  getPrompts
} from '../../src/utils/prompt-templates';
import {
  PromptTemplate,
  PromptTemplateVersion
} from '../../src/types/prompt-template.types';

const EXAMPLE_PROMPT_TEMPLATE_VERSION: PromptTemplateVersion = {
  id: '24d9f582-cd1c-4fe1-a1ca-c69fa4b5c2ce',
  template:
    '[{"role":"user","content":"Say something really funny about the letter a"}]',
  raw: false,
  version: 1,
  settings: {
    top_p: 1,
    max_tokens: 1024,
    model_alias: 'gpt-4.1',
    temperature: 1,
    presence_penalty: 0,
    frequency_penalty: 0
  },
  output_type: null,
  model_changed: false,
  settings_changed: false,
  lines_added: 0,
  lines_removed: 0,
  lines_edited: 0,
  content_changed: true,
  created_at: '2025-06-20T19:39:14.084318Z',
  updated_at: '2025-06-20T19:39:14.084320Z',
  created_by_user: null
};

const EXAMPLE_PROMPT_TEMPLATE: PromptTemplate = {
  id: 'cb759055-01f2-49de-b09d-f0bb82134ecf',
  permissions: [],
  name: 'Super Example NEW3',
  template: '[{"content":"Hello, {name}!","role":"user"}]',
  selected_version: {
    template: '[{"content":"Hello, {name}!","role":"user"}]',
    raw: false,
    version: 1,
    settings: {},
    output_type: null,
    id: '8b198c08-ea7f-42d2-9e8d-d2b8bcb008b0',
    model_changed: false,
    settings_changed: false,
    lines_added: 0,
    lines_removed: 0,
    lines_edited: 0,
    content_changed: true,
    created_at: '2025-06-20T20:01:46.135165Z',
    updated_at: '2025-06-20T20:01:46.135166Z',
    created_by_user: null
  },
  selected_version_id: '8b198c08-ea7f-42d2-9e8d-d2b8bcb008b0',
  all_versions: [
    {
      template: '[{"content":"Hello, {name}!","role":"user"}]',
      raw: false,
      version: 1,
      settings: {},
      output_type: null,
      id: '8b198c08-ea7f-42d2-9e8d-d2b8bcb008b0',
      model_changed: false,
      settings_changed: false,
      lines_added: 0,
      lines_removed: 0,
      lines_edited: 0,
      content_changed: true,
      created_at: '2025-06-20T20:01:46.135165Z',
      updated_at: '2025-06-20T20:01:46.135166Z',
      created_by_user: null
    }
  ],
  all_available_versions: [0],
  total_versions: 1,
  max_version: 0,
  created_at: '2025-06-20T20:01:46.094860Z',
  updated_at: '2025-06-20T20:01:46.094863Z',
  created_by_user: {
    id: 'e12b8715-19f1-4224-92cb-5554ee316e6c',
    email: 'juan@rungalileo.io',
    first_name: 'Juan',
    last_name: 'Ramil'
  }
};

// Create mock implementation functions
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockCreatePrompt = jest.fn();
const mockGetPrompts = jest.fn();
const mockGetPrompt = jest.fn();
const mockDeletePrompt = jest.fn();

jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => {
      return {
        init: mockInit,
        createGlobalPromptTemplate: mockCreatePrompt,
        listGlobalPromptTemplates: mockGetPrompts,
        getGlobalPromptTemplate: mockGetPrompt,
        getGlobalPromptTemplateVersion: mockGetPrompt,
        deleteGlobalPromptTemplate: mockDeletePrompt
      };
    })
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  // Set up default mock implementations
  mockCreatePrompt.mockResolvedValue(EXAMPLE_PROMPT_TEMPLATE);
  mockGetPrompts.mockResolvedValue([EXAMPLE_PROMPT_TEMPLATE]);
  mockGetPrompt.mockResolvedValue(EXAMPLE_PROMPT_TEMPLATE);
  mockDeletePrompt.mockResolvedValue({ success: true });

  // Set up specific mock for getGlobalPromptTemplateVersion
  mockGetPrompt.mockImplementation((id, version) => {
    if (version) {
      return Promise.resolve(EXAMPLE_PROMPT_TEMPLATE_VERSION);
    }
    return Promise.resolve(EXAMPLE_PROMPT_TEMPLATE);
  });
});

test('test create prompt template', async () => {
  const dataset = await createPrompt({
    template: 'Hello, {name}!',
    name: 'My Dataset'
  });
  expect(dataset).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(mockCreatePrompt).toHaveBeenCalled();
});

test('test get prompt templates', async () => {
  const templates = await getPrompts({
    name: 'My Dataset'
  });
  expect(templates).toEqual([EXAMPLE_PROMPT_TEMPLATE]);
  expect(mockGetPrompts).toHaveBeenCalled();
});

test('test get prompt template by id', async () => {
  const template = await getPrompt({
    id: EXAMPLE_PROMPT_TEMPLATE.id
  });
  expect(template).toEqual(EXAMPLE_PROMPT_TEMPLATE_VERSION);
  expect(mockGetPrompt).toHaveBeenCalled();
});

test('test get prompt template by name', async () => {
  const template = await getPrompt({
    name: 'My Dataset'
  });
  expect(template).toEqual(EXAMPLE_PROMPT_TEMPLATE_VERSION);
  expect(mockGetPrompts).toHaveBeenCalled();
  expect(mockGetPrompt).toHaveBeenCalled();
});

test('test delete prompt template by id', async () => {
  const response = await deletePrompt({
    id: EXAMPLE_PROMPT_TEMPLATE.id
  });
  expect(response).toEqual({ success: true });
  expect(mockDeletePrompt).toHaveBeenCalled();
});

test('test get prompt template by id and version', async () => {
  const templateVersion = await getPrompt({
    id: EXAMPLE_PROMPT_TEMPLATE.id,
    version: EXAMPLE_PROMPT_TEMPLATE_VERSION.version
  });
  expect(templateVersion).toEqual(EXAMPLE_PROMPT_TEMPLATE_VERSION);
  expect(mockGetPrompt).toHaveBeenCalled();
});

test('test delete prompt template by name', async () => {
  const response = await deletePrompt({
    name: 'My Dataset'
  });
  expect(response).toEqual({ success: true });
  expect(mockGetPrompts).toHaveBeenCalled();
  expect(mockDeletePrompt).toHaveBeenCalled();
});
