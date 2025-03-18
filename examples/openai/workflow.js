import 'dotenv/config';
import { wrapOpenAI } from '@rungalileo/galileo';
import { OpenAI } from 'openai';

// Wrap the OpenAI client with your logging wrapper
const openai = wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

// Now test the wrapped client with debugging information
async function testWrappedStreaming() {
  console.log('\n=== Testing Wrapped OpenAI Client Streaming ===');

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say hello briefly.' }],
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

    if (Symbol.asyncIterator in stream) {
      // If it has the Symbol.asyncIterator property, try iterating
      let counter = 0;
      try {
        console.log('Attempting to iterate through wrapped stream:');
        for await (const chunk of stream) {
          console.log(
            `Chunk ${counter++}:`,
            JSON.stringify(chunk.choices[0]?.delta)
          );
          if (counter >= 3) break; // Just get a few chunks for debugging
        }
        console.log('Successfully iterated through wrapped stream');
      } catch (iterError) {
        console.error(
          'Error iterating wrapped stream:',
          iterError.name,
          iterError.message
        );
        console.error('Stack:', iterError.stack);
      }
    } else {
      console.log(
        'The wrapped stream is not async iterable, inspecting properties:'
      );
      // Print available methods and properties
      console.log('Object keys:', Object.keys(stream));
      console.log('Object prototype:', Object.getPrototypeOf(stream));

      // Check if we're dealing with a StreamWrapper instance
      console.log('Constructor name:', stream.constructor?.name || 'Unknown');

      // Try to manually access the iterator if it exists
      if (typeof stream[Symbol.asyncIterator] === 'function') {
        console.log(
          'AsyncIterator exists as a function but Symbol.asyncIterator is not recognized'
        );
      }
    }
  } catch (error) {
    console.error('Error in wrapped streaming test:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Stack:', error.stack);
  }
}

// Run the tests
async function runTests() {
  // Then test the wrapped client to identify issues
  await testWrappedStreaming();
}

runTests().catch((err) => {
  console.error('Unhandled error in test execution:', err);
});
