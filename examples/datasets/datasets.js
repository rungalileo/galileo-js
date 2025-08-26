const dotenv = await import('dotenv/config');

const {
  getDatasets,
  createDataset,
  getDatasetContent,
  addRowsToDataset,
  extendDataset
} = await import('../../dist/index.js');

// Create a dataset
const dataset = await createDataset(
  {
    input: [1, 2, 3],
    output: ['a', 'b', 'c']
  },
  'My dataset'
);
console.log('Created dataset:', dataset);

// Get all datasets
console.log('Listing datasets...');
const datasets = await getDatasets();
datasets.forEach((dataset) => console.log(dataset));

// Get dataset content
const content = await getDatasetContent({ datasetId: dataset.id });
console.log('Dataset content:', content);

// Add a new row to the dataset
await addRowsToDataset({
  datasetId: dataset.id,
  rows: [{ input: 4, output: 'd' }]
});

// Extend dataset
const extended_dataset = await extendDataset({
  prompt_settings: {
    model_alias: 'GPT-4o mini'
  },
  prompt:
    'Financial planning assistant that helps clients design an investment strategy.',
  instructions:
    'You are a financial planning assistant that helps clients design an investment strategy.',
  examples: ['I want to invest $1000 per month.'],
  data_types: ['Prompt Injection'],
  count: 3
});
console.log('Extended dataset:', extended_dataset);
