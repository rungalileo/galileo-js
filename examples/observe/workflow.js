import "dotenv/config";
import { GalileoObserveApiClient } from "@rungalileo/observe";

// Initialize and create project
const observeWorkflow = new GalileoObserveApiClient("Observe Workflow Example");
await observeWorkflow.init();

// Evaluation dataset
const observeSet = [
  "What are hallucinations?",
  "What are intrinsic hallucinations?",
  "What are extrinsic hallucinations?"
]

// Add workflows
const myLlmApp = (input) => {
  context = "You're an AI assistant helping a user with hallucinations."
  template = "Given the following context answer the question. \n Context: {context} \n Question: {question}"

  // Add workflow
  observeWorkflow.addWorkflow({ input });

  // Get response from your LLM
  // Pseudo-code, replace with your LLM call
  const llmCall = () => ({
    context: context,
    question: input
  });

  const llmResponse = llmCall();

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