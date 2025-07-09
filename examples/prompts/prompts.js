const dotenv = await import('dotenv/config');
const {
  createPrompt,
  getPrompts,
  getPrompt,
  deletePrompt,
  //--- DEPRECATED ---
  createPromptTemplate,
  getPromptTemplates,
  getPromptTemplate
} = await import('galileo');

// ---------------  Create a template  -----------------

// Create template
const template = await createPrompt({
  name: 'template name',
  template: 'Say something interesting about {{topic}}'
});
console.log('Created template:', template);

// ---------------  Query multiple templates  -----------------

// List templates
const templateList = await getPrompts({ name: 'template name' });
templateList.forEach((template) => console.log(template));

// ---------------  Query a single template  -----------------

// Get template by id
const templateById = await getPrompt({ id: template.id });
console.log('Template by id:', templateById);

// Get template by id and version
const templateByVersion = await getPrompt({
  id: template.id,
  version: template.selected_version.version
});
console.log('Template by id and version:', templateByVersion);

// Get template by name
const templateByName = await getPrompt({ name: 'template name' });
console.log('Template by name:', templateByName);

// ---------------  Delete a template  -----------------

// Delete template by id
const responseDeleteById = await deletePrompt({ id: template.id });
console.log('Response delete by id:', responseDeleteById);

// Delete template by name
const responseDeleteByName = await deletePrompt({ name: 'template name' });
console.log('Response delete by name:', responseDeleteByName);

// ---------------  DEPRECATED  -----------------

// Create a template using project.
const templateLegacy = await createPromptTemplate({
  name: 'Legacy template (100)',
  template: 'Say something interesting about {{topic}}',
  projectName: 'SDK_test_project'
});
console.log('Created template:', templateLegacy);

// Get template by id for a project.
const templateByIdLegacy = await getPromptTemplate({
  id: templateLegacy.id,
  projectName: 'SDK_test_project'
});
console.log('Template by id:', templateByIdLegacy);

// Get template by id and version for a project.
const templateByVersionLegacy = await getPromptTemplate({
  id: templateLegacy.id,
  version: templateLegacy.selected_version.version,
  projectName: 'SDK_test_project'
});
console.log('Template by id and version:', templateByVersionLegacy);

// Get template by name for a project.
const templateByNameLegacy = await getPromptTemplate({
  name: templateLegacy.name,
  projectName: 'SDK_test_project'
});
console.log('Template by name:', templateByNameLegacy);

// List all templates for a project.
const legacyTemplates = await getPromptTemplates({
  projectName: 'SDK_test_project'
});
legacyTemplates.forEach((template) => console.log(template));
