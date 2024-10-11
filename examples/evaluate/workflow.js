import "dotenv/config";
import { GalileoEvaluateWorkflow } from "@rungalileo/observe";

// Initialize and create project
const evaluateWorkflow = new GalileoEvaluateWorkflow("Evaluate Workflow Example");
await evaluateWorkflow.init();

// Add workflows
const myLlmApp = (input) => {
  context = "You're an AI assistant helping a user with hallucinations."
  template = "Given the following context answer the question. \n Context: {context} \n Question: {question}"

  // Add workflow
  evaluateWorkflow.addWorkflow({ input });

  // Get response from your LLM
  // Pseudo-code, replace with your LLM call
  const llmCall = () => ({
    context: context,
    question: input
  });

  const llmResponse = llmCall();

  // Log LLM step
  evaluateWorkflow.addLlmStep({
    input: prompt,
    output: llmResponse,
    model: "ChatGPT (4K context)"
  })

  // Conclude workflow
  evaluateWorkflow.concludeWorkflow(llmResponse);
}

// Evaluation dataset
const evaluateSet = [
  "What are hallucinations?",
  "What are intrinsic hallucinations?",
  "What are extrinsic hallucinations?"
]

evaluateSet.forEach((input) => myLlmApp(input));

// Configure run and upload workflows to Galileo
// Optional: Set run name, tags, registered scorers, and customized scorers
// Note: If no run name is provided a timestamp will be used
await evaluateWorkflow.uploadWorkflows({
  scorers_config: {
    adherence_nli: true,
    chunk_attribution_utilization_gpt: true,
    chunk_attribution_utilization_nli: true,
    completeness_gpt: true,
    completeness_nli: true,
    context_relevance: true,
    factuality: true,
    groundedness: true,
    instruction_adherence: true,
    ground_truth_adherence: true,
    pii: true,
    prompt_injection: true,
    prompt_perplexity: true,
    sexist: true,
    tone: true,
    toxicity: true,
  }
});