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

  ): TransactionRecord[] {
    return []
  }

  public uploadWorkflows(

  ): AWorkflowStep[] {
    return []
  }
}
