import {
  AgentStep,
  AgentStepType,
  AWorkflow,
  LlmStep,
  LlmStepType,
  RetrieverStep,
  RetrieverStepType,
  StepIOType,
  ToolStep,
  ToolStepType,
  WorkflowStep,
  WorkflowStepType
} from './types/step.types';

export default class GalileoWorkflow {
  public projectName: string;

  constructor(projectName: string) {
    this.projectName = projectName;
  }

  public workflows: AWorkflow[] = [];
  private currentWorkflow: AWorkflow | null = null;

  private pushStep(step: AWorkflow) {
    const hasSteps = step instanceof WorkflowStep || step instanceof AgentStep;

    this.workflows.push(step);
    this.currentWorkflow = hasSteps ? step : null;

    return step;
  }

  public addWorkflow(step: WorkflowStepType) {
    return this.pushStep(new WorkflowStep(step));
  }

  public addAgentWorkflow(step: AgentStepType) {
    return this.pushStep(new AgentStep(step));
  }

  public addSingleStepWorkflow(step: LlmStepType) {
    return this.pushStep(new LlmStep(step));
  }

  private stepErrorMessage =
    'A workflow needs to be created in order to add a step.';

  private validWorkflow(errorMessage: string): AWorkflow | null {
    if (this.currentWorkflow === null) {
      throw new Error(errorMessage);
    }
    return this.currentWorkflow;
  }

  public addLlmStep(step: LlmStepType) {
    return this.validWorkflow(this.stepErrorMessage)?.addStep(
      new LlmStep(step)
    );
  }

  public addRetrieverStep(step: RetrieverStepType) {
    return this.validWorkflow(this.stepErrorMessage)?.addStep(
      new RetrieverStep(step)
    );
  }

  public addToolStep(step: ToolStepType) {
    return this.validWorkflow(this.stepErrorMessage)?.addStep(
      new ToolStep(step)
    );
  }

  public addWorkflowStep(step: WorkflowStepType) {
    step.parent = this.currentWorkflow;
    return this.validWorkflow(this.stepErrorMessage)?.addStep(
      new WorkflowStep(step)
    );
  }

  public addAgentStep(step: AgentStepType) {
    step.parent = this.currentWorkflow;
    return this.validWorkflow(this.stepErrorMessage)?.addStep(
      new AgentStep(step)
    );
  }

  public concludeWorkflow(
    output?: StepIOType,
    durationNs?: number,
    statusCode?: number
  ): AWorkflow | null {
    const errorMessage = 'No existing workflow to conclude.';
    this.currentWorkflow =
      this.validWorkflow(errorMessage)?.conclude(
        output,
        durationNs,
        statusCode
      ) ?? null;
    return this.currentWorkflow;
  }
}
