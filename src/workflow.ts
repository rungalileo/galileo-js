import { AgentStep, AWorkflow, LlmStep, RetrieverStep, StepIOType, StepWithChildren, ToolStep, WorkflowStep } from './types/step.types';

export default class GalileoWorkflow {
  public projectName: string;

  constructor(projectName: string) {
    this.projectName = projectName;
  }

  public workflows: AWorkflow[] = [];
  private currentWorkflow: StepWithChildren | null = null;

  private pushStep(step: StepWithChildren | AgentStep | LlmStep) {
    const hasSteps = step instanceof WorkflowStep || step instanceof AgentStep;

    this.workflows.push(step);
    this.currentWorkflow = hasSteps ? step : null;

    return step
  }

  public addWorkflow(step: WorkflowStep) {
    return this.pushStep(step);
  }

  public addAgentWorkflow(step: AgentStep) {
    return this.pushStep(step);
  }

  public addSingleStepWorkflow(step: LlmStep) {
    return this.pushStep(step);
  }

  private stepErrorMessage = 'A workflow needs to be created in order to add a step.';

  private validWorkflow(errorMessage: string): StepWithChildren | null {
    if (this.currentWorkflow === null) {
      throw new Error(errorMessage);
    }

    return this.currentWorkflow
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
    step.parent = this.currentWorkflow;
    return this.validWorkflow(this.stepErrorMessage)?.addStep(step);
  }

  public addAgentStep(step: AgentStep) {
    step.parent = this.currentWorkflow;
    return this.validWorkflow(this.stepErrorMessage)?.addStep(step);
  }

  public concludeWorkflow(
    output?: StepIOType,
    durationNs?: number,
    statusCode?: number
  ): StepWithChildren | null {
    const errorMessage = 'No existing workflow to conclude.';
    this.currentWorkflow = this.validWorkflow(errorMessage)?.conclude(output, durationNs, statusCode) ?? null;
    return this.currentWorkflow;
  }
}