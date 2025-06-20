import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  createGlobalPromptTemplate,
  deleteGlobalPromptTemplate,
  getGlobalPromptTemplate,
  getGlobalPromptTemplateVersion,
  listGlobalPromptTemplates
} from '../../src/utils/prompt-templates';
import {
  PromptTemplate,
  PromptTemplateVersion
  // ListPromptTemplateResponse
} from '../../src/types/prompt-template.types';
import { commonHandlers, TEST_HOST } from '../common';
// import { MessageRole } from '../../src/types/message.types';

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
  lines_edited: 1,
  created_at: '2025-06-20T19:39:14.084318Z',
  updated_at: '2025-06-20T19:39:14.084320Z'
};

const EXAMPLE_PROMPT_TEMPLATE: PromptTemplate = {
  id: 'cb759055-01f2-49de-b09d-f0bb82134ecf',
  permissions: [],
  name: 'Super Example NEW3',
  template: '[{"content":"Hello, {name}!","role":"user"}]',
  selected_version: {
    template: '[{"content":"Hello, {name}!","role":"user"}]',
    raw: false,
    version: 0,
    settings: {},
    output_type: null,
    id: '8b198c08-ea7f-42d2-9e8d-d2b8bcb008b0',
    model_changed: false,
    settings_changed: false,
    lines_added: 1,
    lines_removed: 0,
    lines_edited: 0,
    created_at: '2025-06-20T20:01:46.135165Z',
    updated_at: '2025-06-20T20:01:46.135166Z'
  },
  selected_version_id: '8b198c08-ea7f-42d2-9e8d-d2b8bcb008b0',
  all_versions: [
    {
      template: '[{"content":"Hello, {name}!","role":"user"}]',
      raw: false,
      version: 0,
      settings: {},
      output_type: null,
      id: '8b198c08-ea7f-42d2-9e8d-d2b8bcb008b0',
      model_changed: false,
      settings_changed: false,
      lines_added: 1,
      lines_removed: 0,
      lines_edited: 0,
      created_at: '2025-06-20T20:01:46.135165Z',
      updated_at: '2025-06-20T20:01:46.135166Z'
    }
  ],
  all_available_versions: [0],
  total_versions: 1,
  max_version: 0,
  created_at: '2025-06-20T20:01:46.094860Z',
  updated_at: '2025-06-20T20:01:46.094863Z',
  creator: {
    id: 'e12b8715-19f1-4224-92cb-5554ee316e6c',
    email: 'juan@rungalileo.io',
    first_name: 'Juan',
    last_name: 'Ramil'
  }
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
  )
];

const server = setupServer(...handlers);

beforeAll(() => {
  process.env.GALILEO_CONSOLE_URL = TEST_HOST;
  process.env.GALILEO_API_KEY = 'placeholder';
  server.listen();
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

test('test create global prompt template', async () => {
  const dataset = await createGlobalPromptTemplate({
    template: 'Hello, {name}!',
    name: 'My Dataset'
  });
  expect(dataset).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(createGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test list global prompt templates', async () => {
  const templates = await listGlobalPromptTemplates({
    name_filter: 'My Dataset'
  });
  expect(templates).toEqual([EXAMPLE_PROMPT_TEMPLATE]);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
});

test('test get global prompt template by id', async () => {
  const template = await getGlobalPromptTemplate({
    id: EXAMPLE_PROMPT_TEMPLATE.id
  });
  expect(template).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(getGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test get global prompt template by name', async () => {
  const template = await getGlobalPromptTemplate({
    name: 'My Dataset'
  });
  expect(template).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
});

test('test delete global prompt template by id', async () => {
  const response = await deleteGlobalPromptTemplate({
    id: EXAMPLE_PROMPT_TEMPLATE.id
  });
  expect(response).toEqual({ success: true });
  expect(deleteGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test delete global prompt template by name', async () => {
  const response = await deleteGlobalPromptTemplate({
    name: 'My Dataset'
  });
  expect(response).toEqual({ success: true });
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
  expect(deleteGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test get global prompt template version', async () => {
  const templateVersion = await getGlobalPromptTemplateVersion({
    template_id: EXAMPLE_PROMPT_TEMPLATE.id,
    version: EXAMPLE_PROMPT_TEMPLATE_VERSION.version
  });
  expect(templateVersion).toEqual(EXAMPLE_PROMPT_TEMPLATE_VERSION);
  expect(getGlobalPromptTemplateVersionHandler).toHaveBeenCalled();
});
