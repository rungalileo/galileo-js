import 'dotenv/config';
import { wrapOpenAI } from '@rungalileo/galileo';
import { OpenAI } from 'openai';

// Wrap the OpenAI client with your logging wrapper
const openai = wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

// Now test the wrapped client with debugging information
async function testWrappedStreaming() {
  console.log('\n=== Testing Wrapped OpenAI Client Streaming ===');

  try {
    const stream = await openai.completions.create({
      model: 'gpt-4',
      prompt: 'Say hello briefly.',
      temperature: 0.7,
      stream: true
    });

    // Debug information about the returned stream
    console.log('Wrapped stream type:', typeof stream);
    console.log(
      'Wrapped stream is object:',
      stream !== null && typeof stream === 'object'
    );
    console.log(
      'Wrapped stream has asyncIterator:',
      Symbol.asyncIterator in stream
    );

    // Process the stream
    for await (const chunk of stream) {
      console.log('Received chunk:', chunk.choices[0].text);
    }
  } catch (error) {
    console.error('Error in streaming test:', error);
  }
}

// Test non-streaming completion
async function testWrappedCompletion() {
  console.log('\n=== Testing Wrapped OpenAI Client Completion ===');

  try {
    const completion = await openai.completions.create({
      model: 'gpt-4',
      prompt: 'Say hello briefly.',
      temperature: 0.7
    });

    console.log('Completion response:', completion.choices[0].text);
  } catch (error) {
    console.error('Error in completion test:', error);
  }
}

// Run the tests
async function runTests() {
  await testWrappedCompletion();
  await testWrappedStreaming();
}

runTests().catch(console.error);
