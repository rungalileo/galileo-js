import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  createPrompt,
  deletePrompt,
  getPrompt,
  getPrompts,
  renderPromptTemplate
} from '../../src/utils/prompt-templates';
import {
  PromptTemplate,
  PromptTemplateVersion,
  RenderTemplateRequest,
  RenderTemplateResponse,
  RenderedTemplate
} from '../../src/types/prompt-template.types';
import { commonHandlers, TEST_HOST } from '../common';

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

const EXAMPLE_RENDERED_TEMPLATE: RenderedTemplate = {
  result: 'Hello, John! How are you today?',
  warning: undefined
};

const EXAMPLE_RENDER_TEMPLATE_RESPONSE: RenderTemplateResponse = {
  rendered_templates: [EXAMPLE_RENDERED_TEMPLATE],
  limit: 100,
  next_starting_token: undefined,
  paginated: false,
  starting_token: 0
};

const createGlobalPromptTemplateHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_PROMPT_TEMPLATE);
});

const listGlobalPromptTemplatesHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json({ templates: [EXAMPLE_PROMPT_TEMPLATE] });
});

const getGlobalPromptTemplateHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_PROMPT_TEMPLATE);
});

const getGlobalPromptTemplateVersionHandler = jest
  .fn()
  .mockImplementation(() => {
    return HttpResponse.json(EXAMPLE_PROMPT_TEMPLATE_VERSION);
  });

const deleteGlobalPromptTemplateHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json({ success: true });
});

let lastRequestBody: RenderTemplateRequest | null = null;

const renderTemplateHandler = jest
  .fn()
  .mockImplementation(async ({ request }) => {
    // Store the request body for inspection
    lastRequestBody = await request.json();
    return HttpResponse.json(EXAMPLE_RENDER_TEMPLATE_RESPONSE);
  });

export const handlers = [
  ...commonHandlers,
  http.post(`${TEST_HOST}/templates`, createGlobalPromptTemplateHandler),
  http.post(`${TEST_HOST}/templates/query`, listGlobalPromptTemplatesHandler),
  http.get(
    `${TEST_HOST}/templates/${EXAMPLE_PROMPT_TEMPLATE.id}`,
    getGlobalPromptTemplateHandler
  ),
  http.get(
    `${TEST_HOST}/templates/${EXAMPLE_PROMPT_TEMPLATE.id}/versions/${EXAMPLE_PROMPT_TEMPLATE_VERSION.version}`,
    getGlobalPromptTemplateVersionHandler
  ),
  http.delete(
    `${TEST_HOST}/templates/${EXAMPLE_PROMPT_TEMPLATE.id}`,
    deleteGlobalPromptTemplateHandler
  ),
  http.post(`${TEST_HOST}/render_template`, renderTemplateHandler)
];

const server = setupServer(...handlers);

beforeAll(() => {
  process.env.GALILEO_CONSOLE_URL = TEST_HOST;
  process.env.GALILEO_API_KEY = 'placeholder';
  server.listen();
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

test('test create prompt template', async () => {
  const dataset = await createPrompt({
    template: 'Hello, {name}!',
    name: 'My Dataset'
  });
  expect(dataset).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(createGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test get prompt templates', async () => {
  const templates = await getPrompts({
    name: 'My Dataset'
  });
  expect(templates).toEqual([EXAMPLE_PROMPT_TEMPLATE]);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
});

test('test get prompt template by id', async () => {
  const template = await getPrompt({
    id: EXAMPLE_PROMPT_TEMPLATE.id
  });
  expect(template).toEqual(EXAMPLE_PROMPT_TEMPLATE_VERSION);
  expect(getGlobalPromptTemplateVersionHandler).toHaveBeenCalled();
});

test('test get prompt template by name', async () => {
  const template = await getPrompt({
    name: 'My Dataset'
  });
  expect(template).toEqual(EXAMPLE_PROMPT_TEMPLATE_VERSION);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
  expect(getGlobalPromptTemplateVersionHandler).toHaveBeenCalled();
});

test('test delete prompt template by id', async () => {
  const response = await deletePrompt({
    id: EXAMPLE_PROMPT_TEMPLATE.id
  });
  expect(response).toEqual({ success: true });
  expect(deleteGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test get prompt template by id and version', async () => {
  const templateVersion = await getPrompt({
    id: EXAMPLE_PROMPT_TEMPLATE.id,
    version: EXAMPLE_PROMPT_TEMPLATE_VERSION.version
  });
  expect(templateVersion).toEqual(EXAMPLE_PROMPT_TEMPLATE_VERSION);
  expect(getGlobalPromptTemplateVersionHandler).toHaveBeenCalled();
});

test('test delete prompt template by name', async () => {
  const response = await deletePrompt({
    name: 'My Dataset'
  });
  expect(response).toEqual({ success: true });
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
  expect(deleteGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test render prompt template with string array data', async () => {
  renderTemplateHandler.mockClear();

  const response = await renderPromptTemplate({
    template: 'Hello, {input}! How are you today?',
    data: ['John', 'Jane', 'Bob']
  });

  // Test response structure (mock behavior)
  expect(response).toEqual(EXAMPLE_RENDER_TEMPLATE_RESPONSE);

  // Test data transformation (our logic)
  expect(lastRequestBody).toEqual({
    template: 'Hello, {input}! How are you today?',
    data: {
      input_strings: ['John', 'Jane', 'Bob']
    }
  });
});

test('test render prompt template with dataset ID', async () => {
  renderTemplateHandler.mockClear();

  const response = await renderPromptTemplate({
    template: 'Hello, {name}! How are you today?',
    data: 'dataset-123'
  });

  // Test response structure (mock behavior)
  expect(response).toEqual(EXAMPLE_RENDER_TEMPLATE_RESPONSE);

  // Test data transformation (our logic)
  expect(lastRequestBody).toEqual({
    template: 'Hello, {name}! How are you today?',
    data: {
      dataset_id: 'dataset-123'
    }
  });
});

test('test render prompt template with StringData object', async () => {
  renderTemplateHandler.mockClear();

  const response = await renderPromptTemplate({
    template: 'Hello, {input}! How are you today?',
    data: { input_strings: ['John', 'Jane'] }
  });

  // Test response structure (mock behavior)
  expect(response).toEqual(EXAMPLE_RENDER_TEMPLATE_RESPONSE);

  // Test data transformation (our logic)
  expect(lastRequestBody).toEqual({
    template: 'Hello, {input}! How are you today?',
    data: {
      input_strings: ['John', 'Jane']
    }
  });
});

test('test render prompt template with DatasetData object', async () => {
  renderTemplateHandler.mockClear();

  const response = await renderPromptTemplate({
    template: 'Hello, {name}! How are you today?',
    data: { dataset_id: 'dataset-456' }
  });

  // Test response structure (mock behavior)
  expect(response).toEqual(EXAMPLE_RENDER_TEMPLATE_RESPONSE);

  // Test data transformation (our logic)
  expect(lastRequestBody).toEqual({
    template: 'Hello, {name}! How are you today?',
    data: {
      dataset_id: 'dataset-456'
    }
  });
});
