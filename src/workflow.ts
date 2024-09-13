import { AgentStep, AWorkflowStep, LlmStep, StepWithChildren, WorkflowStep } from "./types/workflows/step.types";

export class Workflows {
  private workflows: AWorkflowStep[] = [];
  private current_workflow: StepWithChildren | null = null;

  private pushStep(step: AWorkflowStep, setCurrentWorkflow: boolean) {
    this.workflows.push(step);
    this.current_workflow = setCurrentWorkflow ? step as StepWithChildren : null;
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

  private validWorkflow(): StepWithChildren | null {
    if (this.current_workflow === null) {
      throw new Error("A workflow needs to be created in order to add a step.");
    }

    return this.current_workflow
  }

  public addLlmStep(step: LlmStep) {
    this.validWorkflow()?.addLlm(step);
    return step;
  }

  public addRetrieverStep(
    input: StepIOType,
    documents: RetrieverStepAllowedOutputType,
    name?: string,
    duration_ns?: number,
    created_at_ns?: number,
    metadata?: Metadata,
    status_code?: number
  ): RetrieverStep {
    if (this.current_workflow === null) {
      throw new Error("A workflow needs to be created in order to add a step.");
    }
    const step = this.current_workflow.add_retriever({
      input,
      documents,
      name,
      duration_ns,
      created_at_ns,
      metadata,
      status_code,
    });
    return step;
  }

  public addToolStep(
    input: StepIOType,
    output: StepIOType,
    name?: string,
    duration_ns?: number,
    created_at_ns?: number,
    metadata?: Metadata,
    status_code?: number
  ): ToolStep {
    if (this.current_workflow === null) {
      throw new Error("A workflow needs to be created in order to add a step.");
    }
    const step = this.current_workflow.add_tool({
      input,
      output,
      name,
      duration_ns,
      created_at_ns,
      metadata,
      status_code,
    });
    return step;
  }

  public addWorkflowStep(
    input: StepIOType,
    output?: StepIOType,
    name?: string,
    duration_ns?: number,
    created_at_ns?: number,
    metadata?: Metadata
  ): WorkflowStep {
    if (this.current_workflow === null) {
      throw new Error("A workflow needs to be created in order to add a step.");
    }
    const step = this.current_workflow.add_sub_workflow({
      input,
      output,
      name,
      duration_ns,
      created_at_ns,
      metadata,
    });
    this.current_workflow = step as StepWithChildren;
    return step;
  }

  public addAgentStep(
    input: StepIOType,
    output?: StepIOType,
    name?: string,
    duration_ns?: number,
    created_at_ns?: number,
    metadata?: Metadata
  ): AgentStep {
    if (this.current_workflow === null) {
      throw new Error("A workflow needs to be created in order to add a step.");
    }
    const step = this.current_workflow.add_sub_agent({
      input,
      output,
      name,
      duration_ns,
      created_at_ns,
      metadata,
    });
    this.current_workflow = step as StepWithChildren;
    return step;
  }

  public concludeWorkflow(
    output?: StepIOType,
    duration_ns?: number,
    status_code?: number
  ): StepWithChildren | null {
    if (this.current_workflow === null) {
      throw new Error("No existing workflow to conclude.");
    }
    this.current_workflow = this.current_workflow.conclude({
      output,
      duration_ns,
      status_code,
    });
    return this.current_workflow;
  }
}
