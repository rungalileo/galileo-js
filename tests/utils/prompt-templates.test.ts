import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  createPrompt,
  deletePrompt,
  getPrompt,
  getPrompts,
  renderPrompt,
  updatePrompt
} from '../../src/utils/prompt-templates';
import {
  PromptTemplate,
  PromptTemplateVersion
} from '../../src/types/prompt-template.types';
import { Message, MessageRole } from '../../src/types/message.types';
import { commonHandlers, TEST_HOST, mockProject } from '../common';

const EXAMPLE_PROMPT_TEMPLATE_VERSION: PromptTemplateVersion = {
  id: '24d9f582-cd1c-4fe1-a1ca-c69fa4b5c2ce',
  template:
    '[{"role":"user","content":"Say something really funny about the letter a"}]',
  raw: false,
  version: 1,
  settings: {
    topP: 1,
    maxTokens: 1024,
    modelAlias: 'gpt-4.1',
    temperature: 1,
    presencePenalty: 0,
    frequencyPenalty: 0
  },
  outputType: null,
  modelChanged: false,
  settingsChanged: false,
  linesAdded: 0,
  linesRemoved: 0,
  linesEdited: 0,
  contentChanged: true,
  createdAt: '2025-06-20T19:39:14.084318Z',
  updatedAt: '2025-06-20T19:39:14.084320Z',
  createdByUser: null
};

const EXAMPLE_PROMPT_TEMPLATE: PromptTemplate = {
  id: 'cb759055-01f2-49de-b09d-f0bb82134ecf',
  permissions: [],
  name: 'Super Example NEW3',
  template: '[{"content":"Hello, {name}!","role":"user"}]',
  selectedVersion: {
    id: '8b198c08-ea7f-42d2-9e8d-d2b8bcb008b0',
    template: '[{"content":"Hello, {name}!","role":"user"}]',
    version: 1,
    settings: {},
    outputType: null,
    modelChanged: false,
    settingsChanged: false,
    linesAdded: 0,
    linesRemoved: 0,
    linesEdited: 0,
    contentChanged: true,
    createdAt: '2025-06-20T20:01:46.135165Z',
    updatedAt: '2025-06-20T20:01:46.135166Z',
    createdByUser: null
  },
  selectedVersionId: '8b198c08-ea7f-42d2-9e8d-d2b8bcb008b0',
  allVersions: [
    {
      template: '[{"content":"Hello, {name}!","role":"user"}]',
      raw: false,
      version: 1,
      settings: {},
      outputType: null,
      id: '8b198c08-ea7f-42d2-9e8d-d2b8bcb008b0',
      modelChanged: false,
      settingsChanged: false,
      linesAdded: 0,
      linesRemoved: 0,
      linesEdited: 0,
      contentChanged: true,
      createdAt: '2025-06-20T20:01:46.135165Z',
      updatedAt: '2025-06-20T20:01:46.135166Z',
      createdByUser: null
    }
  ],
  allAvailableVersions: [0],
  totalVersions: 1,
  maxVersion: 0,
  createdAt: '2025-06-20T20:01:46.094860Z',
  updatedAt: '2025-06-20T20:01:46.094863Z',
  createdByUser: {
    id: 'e12b8715-19f1-4224-92cb-5554ee316e6c',
    email: 'juan@rungalileo.io',
    firstName: 'Juan',
    lastName: 'Ramil'
  }
};

const TEMPLATE_NAME = EXAMPLE_PROMPT_TEMPLATE.name as string;

const createGlobalPromptTemplateHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_PROMPT_TEMPLATE);
});

const listGlobalPromptTemplatesHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json({
    templates: [EXAMPLE_PROMPT_TEMPLATE],
    nextStartingToken: null
  });
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

const updateGlobalPromptTemplateHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_PROMPT_TEMPLATE);
});

const renderPromptTemplateHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json({
    rendered_templates: [{ result: 'Hello!', warning: null }],
    paginated: false,
    next_starting_token: null
  });
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
  http.patch(
    `${TEST_HOST}/templates/${EXAMPLE_PROMPT_TEMPLATE.id}`,
    updateGlobalPromptTemplateHandler
  ),
  http.post(`${TEST_HOST}/render_template`, renderPromptTemplateHandler)
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
    name: TEMPLATE_NAME
  });
  expect(dataset).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(createGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test get prompt templates', async () => {
  const response = await getPrompts({
    name: TEMPLATE_NAME
  });
  expect(response).toEqual([EXAMPLE_PROMPT_TEMPLATE]);
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
    name: TEMPLATE_NAME
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
    name: TEMPLATE_NAME
  });
  expect(response).toEqual({ success: true });
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
  expect(deleteGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test update prompt template by id', async () => {
  const updated = await updatePrompt({
    id: EXAMPLE_PROMPT_TEMPLATE.id,
    newName: 'Updated Name'
  });
  expect(updated).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(updateGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test render prompt template', async () => {
  const response = await renderPrompt({
    template: 'Hello {{name}}',
    data: ['Ada']
  });
  expect(response.renderedTemplates?.[0]?.result).toEqual('Hello!');
  expect(renderPromptTemplateHandler).toHaveBeenCalled();
});

test('test create prompt template with Message[]', async () => {
  const messages: Message[] = [
    { role: MessageRole.system, content: 'You are a helpful assistant' },
    { role: MessageRole.user, content: 'Hello, {name}!' }
  ];
  const template = await createPrompt({
    template: messages,
    name: TEMPLATE_NAME
  });
  expect(template).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(createGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test create prompt template with projectId', async () => {
  const template = await createPrompt({
    template: 'Hello, {name}!',
    name: TEMPLATE_NAME,
    projectId: mockProject.id
  });
  expect(template).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(createGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test create prompt template with projectName', async () => {
  const template = await createPrompt({
    template: 'Hello, {name}!',
    name: TEMPLATE_NAME,
    projectName: mockProject.name as string
  });
  expect(template).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(createGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test create prompt template with ensureUniqueName: false', async () => {
  const template = await createPrompt({
    template: 'Hello, {name}!',
    name: TEMPLATE_NAME,
    ensureUniqueName: false
  });
  expect(template).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(createGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test create prompt template with ensureUniqueName: true', async () => {
  const template = await createPrompt({
    template: 'Hello, {name}!',
    name: TEMPLATE_NAME,
    ensureUniqueName: true
  });
  expect(template).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(createGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test get prompts with projectId', async () => {
  const response = await getPrompts({
    name: TEMPLATE_NAME,
    projectId: mockProject.id
  });
  expect(response).toEqual([EXAMPLE_PROMPT_TEMPLATE]);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
});

test('test get prompts with projectName', async () => {
  const response = await getPrompts({
    name: TEMPLATE_NAME,
    projectName: mockProject.name as string
  });
  expect(response).toEqual([EXAMPLE_PROMPT_TEMPLATE]);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
});

test('test get prompts with limit', async () => {
  const response = await getPrompts({
    name: TEMPLATE_NAME,
    limit: 50
  });
  expect(response).toEqual([EXAMPLE_PROMPT_TEMPLATE]);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
});

test('test get prompts without filters', async () => {
  const response = await getPrompts({});
  expect(response).toEqual([EXAMPLE_PROMPT_TEMPLATE]);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
});

test('test get prompts with name and project filters', async () => {
  const response = await getPrompts({
    name: TEMPLATE_NAME,
    projectId: mockProject.id
  });
  expect(response).toEqual([EXAMPLE_PROMPT_TEMPLATE]);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
});

test('test get prompt by name with projectId', async () => {
  const template = await getPrompt({
    name: TEMPLATE_NAME,
    projectId: mockProject.id
  });
  expect(template).toEqual(EXAMPLE_PROMPT_TEMPLATE_VERSION);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
  expect(getGlobalPromptTemplateVersionHandler).toHaveBeenCalled();
});

test('test get prompt by name with projectName', async () => {
  const template = await getPrompt({
    name: TEMPLATE_NAME,
    projectName: mockProject.name as string
  });
  expect(template).toEqual(EXAMPLE_PROMPT_TEMPLATE_VERSION);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
  expect(getGlobalPromptTemplateVersionHandler).toHaveBeenCalled();
});

test('test get prompt by name with version', async () => {
  const template = await getPrompt({
    name: TEMPLATE_NAME,
    version: EXAMPLE_PROMPT_TEMPLATE_VERSION.version
  });
  expect(template).toEqual(EXAMPLE_PROMPT_TEMPLATE_VERSION);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
  expect(getGlobalPromptTemplateVersionHandler).toHaveBeenCalled();
});

test('test get prompt error: neither id nor name provided', async () => {
  await expect(getPrompt({} as { id?: string; name?: string })).rejects.toThrow(
    'Either id or name must be provided'
  );
});

test('test get prompt error: both id and name provided', async () => {
  await expect(
    getPrompt({
      id: EXAMPLE_PROMPT_TEMPLATE.id,
      name: TEMPLATE_NAME
    })
  ).rejects.toThrow('Exactly one identifier must be provided');
});

test('test update prompt template by name', async () => {
  const updated = await updatePrompt({
    name: TEMPLATE_NAME,
    newName: 'Updated Name'
  });
  expect(updated).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
  expect(updateGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test update prompt template with projectId', async () => {
  const updated = await updatePrompt({
    name: TEMPLATE_NAME,
    newName: 'Updated Name',
    projectId: mockProject.id
  });
  expect(updated).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
  expect(updateGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test update prompt template with projectName', async () => {
  const updated = await updatePrompt({
    name: TEMPLATE_NAME,
    newName: 'Updated Name',
    projectName: mockProject.name as string
  });
  expect(updated).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
  expect(updateGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test update prompt error: neither id nor name provided', async () => {
  await expect(
    updatePrompt({
      newName: 'Updated Name'
    } as { id?: string; name?: string; newName: string })
  ).rejects.toThrow('Either id or name must be provided');
});

test('test update prompt error: both id and name provided', async () => {
  await expect(
    updatePrompt({
      id: EXAMPLE_PROMPT_TEMPLATE.id,
      name: TEMPLATE_NAME,
      newName: 'Updated Name'
    })
  ).rejects.toThrow('Exactly one identifier must be provided');
});

test('test delete prompt template with projectId', async () => {
  const response = await deletePrompt({
    name: TEMPLATE_NAME,
    projectId: mockProject.id
  });
  expect(response).toEqual({ success: true });
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
  expect(deleteGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test delete prompt template with projectName', async () => {
  const response = await deletePrompt({
    name: TEMPLATE_NAME,
    projectName: mockProject.name as string
  });
  expect(response).toEqual({ success: true });
  expect(listGlobalPromptTemplatesHandler).toHaveBeenCalled();
  expect(deleteGlobalPromptTemplateHandler).toHaveBeenCalled();
});

test('test delete prompt error: neither id nor name provided', async () => {
  await expect(
    deletePrompt({} as { id?: string; name?: string })
  ).rejects.toThrow('Either id or name must be provided');
});

test('test delete prompt error: both id and name provided', async () => {
  await expect(
    deletePrompt({
      id: EXAMPLE_PROMPT_TEMPLATE.id,
      name: TEMPLATE_NAME
    })
  ).rejects.toThrow('Exactly one identifier must be provided');
});

test('test render prompt template with datasetId', async () => {
  const response = await renderPrompt({
    template: 'Hello {{name}}',
    data: 'test-dataset-id'
  });
  expect(response.renderedTemplates?.[0]?.result).toEqual('Hello!');
  expect(renderPromptTemplateHandler).toHaveBeenCalled();
});

test('test render prompt template with StringData object', async () => {
  const response = await renderPrompt({
    template: 'Hello {{name}}',
    data: { inputStrings: ['Ada', 'Bob'] }
  });
  expect(response.renderedTemplates?.[0]?.result).toEqual('Hello!');
  expect(renderPromptTemplateHandler).toHaveBeenCalled();
});

test('test render prompt template with DatasetData object', async () => {
  const response = await renderPrompt({
    template: 'Hello {{name}}',
    data: { datasetId: 'test-dataset-id' }
  });
  expect(response.renderedTemplates?.[0]?.result).toEqual('Hello!');
  expect(renderPromptTemplateHandler).toHaveBeenCalled();
});

test('test render prompt template with custom startingToken', async () => {
  const response = await renderPrompt({
    template: 'Hello {{name}}',
    data: ['Ada'],
    startingToken: 10
  });
  expect(response.renderedTemplates?.[0]?.result).toEqual('Hello!');
  expect(renderPromptTemplateHandler).toHaveBeenCalled();
});

test('test render prompt template with custom limit', async () => {
  const response = await renderPrompt({
    template: 'Hello {{name}}',
    data: ['Ada'],
    limit: 50
  });
  expect(response.renderedTemplates?.[0]?.result).toEqual('Hello!');
  expect(renderPromptTemplateHandler).toHaveBeenCalled();
});
