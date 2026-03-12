import dotenv from 'dotenv';
import { z } from 'zod';
import { Agent, run } from '@openai/agents';
import {
  init,
  flush,
  registerGalileoTraceProcessor
} from '../../dist/index.js';

dotenv.config();

await init({
  projectName: 'openai-agents-example'
});

await registerGalileoTraceProcessor();

const triageAgent = new Agent({
  name: 'Triage Agent',
  instructions:
    'You determine which agent should handle the user request. ' +
    'If the question is about weather, hand off to the Weather Agent. ' +
    'Otherwise, answer the question yourself.',
  handoffs: [] // populated below after declaring weatherAgent
});

const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions:
    'You provide weather information. ' +
    'Given a city name, respond with a short, friendly weather summary. ' +
    'Make up plausible weather data for demonstration purposes.',
  tools: [
    tool({
      name: 'get_weather',
      description: 'Get the current weather for a city',
      parameters: z.object({
        city: z.string().describe('The city to get weather for')
      }),
      execute: async (params) => {
        const { city } = params;
        const temps = { london: 14, tokyo: 22, 'new york': 18, paris: 16 };
        const temp =
          temps[city.toLowerCase()] ?? Math.floor(Math.random() * 30);
        return JSON.stringify({
          city,
          temperature_c: temp,
          condition: temp > 20 ? 'Sunny' : 'Partly cloudy'
        });
      }
    })
  ]
});

triageAgent.handoffs.push(weatherAgent);

async function main() {
  console.log('=== OpenAI Agents SDK + Galileo Tracing ===\n');

  console.log('--- Simple single-agent run ---');
  const simpleResult = await run(triageAgent, 'What is 2 + 2?');
  console.log('Response:', simpleResult.finalOutput, '\n');

  console.log('--- Handoff + tool call run ---');
  const weatherResult = await run(triageAgent, "What's the weather in Tokyo?");
  console.log('Response:', weatherResult.finalOutput, '\n');

  await flush();
  console.log('Done — traces flushed to Galileo.');
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
