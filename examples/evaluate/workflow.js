import "dotenv/config";
import { GalileoEvaluateWorkflow } from "@rungalileo/observe";

// Initialize and create project
const evaluateWorkflow = new GalileoEvaluateWorkflow("Evaluate Workflow Example");
await evaluateWorkflow.init();

// Evaluation dataset
const evaluateSet = [
  "What are hallucinations?",
  "What are intrinsic hallucinations?",
  "What are extrinsic hallucinations?"
]

// Add workflows
const myLlmApp = (input) => {
  const context = "You're an AI assistant helping a user with hallucinations."
  const template = "Given the following context answer the question. \n Context: {context} \n Question: {question}"

  // Add workflow
  evaluateWorkflow.addWorkflow({ input });

  const prompt = template.replace('{context}', context).replace('{question}', input)

  // Get response from your LLM
  // Pseudo-code, replace with your LLM call
  const llmCall = (_prompt) => 'An LLM response…';
  const llmResponse = llmCall(prompt);

  // Log LLM step
  evaluateWorkflow.addLlmStep({
    input: prompt,
    output: llmResponse,
  })

  // Conclude workflow
  evaluateWorkflow.concludeWorkflow(llmResponse);
}

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