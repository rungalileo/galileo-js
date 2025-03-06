import 'dotenv/config';
import { getPromptTemplates, createPromptTemplate } from '@rungalileo/galileo';

// Create a template
const template = await createPromptTemplate({
  template: 'Hello, {name}!',
  version: 1,
  name: 'Sample_2',
  projectName: 'SDK_test_project'
});
console.log('Created template:', template);

// Get all datasets
console.log('Listing templates...');
const templates = await getPromptTemplates('SDK_test_project');
templates.forEach((template) => console.log(template));
