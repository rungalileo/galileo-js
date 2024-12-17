import 'dotenv/config';
import {
  getDatasets,
  createDataset,
  getDatasetContent
} from '@rungalileo/galileo';

const dataset = await createDataset({
  virtue: ['benevolence', 'trustworthiness'],
  voice: ['Oprah Winfrey', 'Barack Obama']
});

console.log(`Uploaded datset: ${JSON.stringify(dataset)}`);

// Get all datasets
console.log('All datasets:');
const datasets = await getDatasets();
datasets.forEach((dataset) => console.log(dataset));

const rows = await getDatasetContent(dataset.id);
rows.forEach((row) => console.log(row));
