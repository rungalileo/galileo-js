import { wrapOpenAI, init, log, flush } from '../../dist/index.js';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

try {
  const openai = wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

  const callOpenAI = async () => {
    const result = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ content: 'Say hello world!', role: 'user' }]
    });
    return result;
  };

  await init({
    projectName: 'my-test-project-4',
    logStreamName: 'my-test-log-stream'
  });

  const testLlmFunc = log(
    { name: 'LLM', spanType: 'llm' },
    (param1, model = 'gpt-4o') => {
      return 'Hello world!';
    }
  );

  const testRetrieverFunc = log(
    { name: 'Retriever', spanType: 'retriever' },
    (param1, model = 'gpt-4o') => {
      return [{ content: 'Hello world!', metadata: { source: 'database' } }];
    }
  );

  const wrappedFunc = await log({ name: 'Chat Completion' }, async (input) => {
    testLlmFunc('one');
    return await callOpenAI();
  });

  const anotherWrappedFunc = await log(
    { name: 'Chat Completion' },
    async (input) => {
      testLlmFunc('two', 'gpt-3.5-turbo');
      testRetrieverFunc('two', 'gpt-3.5-turbo');
      return await wrappedFunc(input);
    }
  );

  const result = await anotherWrappedFunc('Input');

  console.log(result);

  await flush();
} catch (error) {
  console.error('Error during test:', error);
}
