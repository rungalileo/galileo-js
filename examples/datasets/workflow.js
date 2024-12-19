import 'dotenv/config';
import { getDatasets } from '@rungalileo/galileo';

// Get all datasets
console.log('Listing datasets...');
const datasets = await getDatasets();
datasets.forEach((dataset) => console.log(dataset));
