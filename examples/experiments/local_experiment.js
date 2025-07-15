import 'dotenv/config';
import {
  createDataset,
  getDataset,
  runExperiment,
  GalileoScorers
} from '../../dist/index.js';

const datasetName = 'food_types';
let dataset;
try {
  dataset = await getDataset({ name: datasetName });
  console.log('Dataset found: ', datasetName);
} catch (error) {
  if (error.message.includes('not found')) {
    console.log('Dataset ', datasetName, ' not found, creating...');
    dataset = await createDataset(
      {
        input: [
          '{"food": "cheese"}',
          '{"food": "beef"}',
          '{"food": "spinach"}'
        ],
        output: [
          '{"category": "dairy"}',
          '{"category": "meat"}',
          '{"category": "vegetable"}'
        ]
      },
      datasetName
    );
    console.log('Created dataset: ', datasetName);
  } else {
    throw error;
  }
}

const runner = function (input) {
  switch (input['food']) {
    case 'cheese':
      return '{"category": "dairy"}';
    case 'beef':
      return '{"category": "meat"}';
    case 'spinach':
      return '{"category": "meat"}';
    default:
      return '{"category": "unknown"}';
  }
};

await runExperiment({
  name: 'food-experiment',
  dataset: dataset,
  function: runner,
  metrics: [
    GalileoScorers.GroundTruthAdherence,
    GalileoScorers.ContextAdherence
  ],
  // Set the project name here
  projectName: 'e2e-working-demo'
});
