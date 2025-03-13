import 'dotenv/config';
import { createOpenAI } from '@rungalileo/galileo';

// Create an OpenAI client
const client = new createOpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Example usage with streaming
async function streamExample() {
  // This will create a single span trace with the OpenAI call
  const stream = await client.chat.completions.create({
    messages: [{ role: 'user', content: 'Say this is a test' }],
    model: 'gpt-4o',
    stream: true
  });

  // Process the stream
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    process.stdout.write(content);
  }
}

// // Example with galileo_context
// async function contextExample() {
//   // Use with a specific Galileo context
//   await galileo_context.with_context({
//     project: "my-project",
//     log_stream: "my-log-stream"
//   }, async () => {
//     const response = await client.chat.completions.create({
//       messages: [{ role: "user", content: "Tell me about the solar system" }],
//       model: "gpt-4o",
//     });

//     console.log(response.choices[0].message.content);
//   });
// }

streamExample();
