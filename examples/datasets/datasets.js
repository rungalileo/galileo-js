import 'dotenv/config';
import {
  getDatasets,
  createDataset,
  getDatasetContent,
  addRowsToDataset
} from '../../dist/index.js';

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
