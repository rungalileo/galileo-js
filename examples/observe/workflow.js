import "dotenv/config";
import { GalileoObserveWorkflow } from "@rungalileo/observe";

// Initialize and create project
const observeWorkflow = new GalileoObserveWorkflow("Observe Workflow Example");
await observeWorkflow.init();

// Evaluation dataset
const observeSet = [
  "What are hallucinations?",
  "What are intrinsic hallucinations?",
  "What are extrinsic hallucinations?"
]

// Add workflows
const myLlmApp = (input) => {
  const context = "You're an AI assistant helping a user with hallucinations."
  const template = "Given the following context answer the question. \n Context: {context} \n Question: {question}"

  // Add workflow
  observeWorkflow.addWorkflow({ input });

  const prompt = template.replace('{context}', context).replace('{question}', input)

  // Get response from your LLM
  // Pseudo-code, replace with your LLM call
  const llmCall = (_prompt) => 'An LLM response…';
  const llmResponse = llmCall(prompt);

  // Log LLM step
  observeWorkflow.addLlmStep({
    input: prompt,
    output: llmResponse,
    model: "ChatGPT (4K context)"
  })

  // Conclude workflow
  observeWorkflow.concludeWorkflow(llmResponse);
}

observeSet.forEach((input) => myLlmApp(input));

// Upload workflows to Galileo
await observeWorkflow.uploadWorkflows();