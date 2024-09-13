import { randomUUID } from "crypto";
import { ApiClient } from "./api-client";
import { TransactionRecord } from "./types/transaction.types";
import { AgentStep, AWorkflowStep, LlmStep, RetrieverStep, StepIOType, StepWithChildren, ToolStep, WorkflowStep } from "./types/workflows/step.types";

export class Workflows {
  public projectName: string;
  private apiClient: ApiClient = new ApiClient();

  constructor(projectName: string) {
    this.projectName = projectName;
  }

  async init(): Promise<void> {
    await this.apiClient.init(this.projectName);
  }

  private workflows: AWorkflowStep[] = [];
  private current_workflow: StepWithChildren | null = null;

  private pushStep(step: AWorkflowStep, setCurrentWorkflow: boolean) {
    this.workflows.push(step);
    this.current_workflow = setCurrentWorkflow ? new StepWithChildren() : null;
  }

  public addWorkflow(step: WorkflowStep) {
    this.pushStep(step, true);
    return step;
  }

  public addAgentWorkflow(step: AgentStep) {
    this.pushStep(step, true);
    return step;
  }

  public addSingleStepWorkflow(step: LlmStep) {
    this.pushStep(step, false);
    return step;
  }

  private stepErrorMessage = 'A workflow needs to be created in order to add a step.';

  private validWorkflow(errorMessage: string): StepWithChildren | null {
    if (this.current_workflow === null) {
      throw new Error(errorMessage);
    }

    return this.current_workflow
  }

  public addLlmStep(step: LlmStep) {
    return this.validWorkflow(this.stepErrorMessage)?.addStep(step);
  }

  public addRetrieverStep(step: RetrieverStep) {
    return this.validWorkflow(this.stepErrorMessage)?.addStep(step);
  }

  public addToolStep(step: ToolStep) {
    return this.validWorkflow(this.stepErrorMessage)?.addStep(step);
  }

  public addWorkflowStep(step: WorkflowStep) {
    return this.validWorkflow(this.stepErrorMessage)?.addStep(step);
  }

  public addAgentStep(step: AgentStep) {
    return this.validWorkflow(this.stepErrorMessage)?.addStep(step);
  }

  public concludeWorkflow(
    output?: StepIOType,
    durationNs?: number,
    statusCode?: number
  ): StepWithChildren | null {
    const errorMessage = 'No existing workflow to conclude.';
    this.validWorkflow(errorMessage)?.conclude(output, durationNs, statusCode);
    return this.current_workflow;
  }

  public workflowToRecords(
    step: AWorkflowStep | StepWithChildren,
    rootId?: string,
    chainId?: string,
  ): TransactionRecord[] {
    const rows: TransactionRecord[] = [];

    const node_id = randomUUID();
    const chain_root_id = rootId ?? node_id;
    const has_children = step instanceof StepWithChildren && step.steps.length > 0;

    const row: TransactionRecord = {
      // TODO: Remove or change name of constructor property on TransactionRecord interface
      constructor: undefined,
      node_id,
      node_type: step.type,
      input_text: JSON.stringify(step.input),
      output_text: JSON.stringify(step.output),
      chain_root_id,
      chain_id: chainId,
      has_children,
      created_at: new Date(step.createdAtNs).toISOString(),
      latency_ms: step.durationNs / 1000000,
      status_code: step.statusCode,
      user_metadata: step.metadata,
    }

    if (step instanceof LlmStep) {
      row.model = step.model
      row.temperature = step.temperature
      row.num_input_tokens = step.inputTokens ?? 0
      row.num_output_tokens = step.outputTokens ?? 0
      row.num_total_tokens = step.totalTokens ?? 0
    }

    if (step instanceof StepWithChildren) {
      step.steps.forEach(childStep => {
        const childRows = this.workflowToRecords(childStep, rootId, node_id)
        rows.push(...childRows)
      });
    }

    rows.push(row)

    return rows
  }

  public uploadWorkflows(

  ): AWorkflowStep[] {
    return []
  }
}