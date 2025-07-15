import 'dotenv/config';
import {
  createDataset,
  runExperiment,
  GalileoScorers
} from '../../dist/index.js';

// Create a dataset
const dataset = await createDataset(
  {
    input: ['{"food": "cheese"}', '{"food": "beef"}', '{"food": "spinach"}'],
    output: [
      '{"category": "dairy"}',
      '{"category": "meat"}',
      '{"category": "vegetable"}'
    ]
  },
  'food_types'
);
console.log('Created dataset:', dataset);

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
