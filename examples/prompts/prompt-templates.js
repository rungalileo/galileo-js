import 'dotenv/config';
import {
  getPromptTemplates,
  createPromptTemplate,
  getPromptTemplate
} from '../../dist/index.js';
import { MessageRole } from '../../dist/types/index.js';

// Create a template
const template = await createPromptTemplate({
  template: [{ content: 'Hello, {name}!', role: MessageRole.user }],
  name: 'Sample_2',
  projectName: 'SDK_test_project'
});
console.log('Created template:', template);

// Get the template by name
console.log('Getting the template by name');
const templateByName = await getPromptTemplate({
  name: 'Sample_2',
  projectName: 'SDK_test_project'
});
console.log(templateByName);

// Get the template by id
console.log('Getting the template by id');
const templateById = await getPromptTemplate({
  id: template.id,
  projectName: 'SDK_test_project'
});
console.log(templateById);

// Get all templates
console.log('Listing all templates...');
const allTemplates = await getPromptTemplates('SDK_test_project');
allTemplates.forEach((template) => console.log(template));
