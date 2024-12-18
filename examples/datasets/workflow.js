import 'dotenv/config';
import { getDatasets, createDataset } from '@rungalileo/galileo';

// Upload a dataset
const dataset = await createDataset({
  col1: ['val1', 'val2'],
  col2: ['val3', 'val4']
});
console.log(`Uploaded datset: ${dataset.name}`);

// Get all datasets
console.log('All datasets:');
const datasets = await getDatasets();
datasets.forEach((dataset) => console.log(dataset));
