import { GalileoObserveCallback } from '@rungalileo/galileo';

const observe_callback = new GalileoObserveCallback('pegasus');
await observe_callback.init();

import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import * as fs from 'fs';
import { formatDocumentsAsString } from 'langchain/util/document';
import {
  RunnablePassthrough,
  RunnableSequence
} from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate
} from '@langchain/core/prompts';

// Initialize the LLM to use to answer the question.
const model = new ChatOpenAI({ streaming: true });
const text = fs.readFileSync('state_of_the_union.txt', 'utf8');
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);

// Create a vector store from the documents.
const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());

// Initialize a retriever wrapper around the vector store
const vectorStoreRetriever = vectorStore.asRetriever();

// Create a system & human prompt for the chat model
const SYSTEM_TEMPLATE = `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
----------------
{context}`;
const messages = [
  SystemMessagePromptTemplate.fromTemplate(SYSTEM_TEMPLATE),
  HumanMessagePromptTemplate.fromTemplate('{question}')
];
const prompt = ChatPromptTemplate.fromMessages(messages);

const chain = RunnableSequence.from([
  {
    context: vectorStoreRetriever.pipe(formatDocumentsAsString),
    question: new RunnablePassthrough()
  },
  prompt,
  model,
  new StringOutputParser()
]);

const answer = await chain.invoke(
  'What did the president say about Justice Breyer?',
  { callbacks: [observe_callback] }
);

console.log({ answer });
