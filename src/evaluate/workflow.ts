import { randomUUID } from "crypto";
import { AWorkflow, AWorkflowStep, LlmStep, StepWithChildren } from "../types/step.types";
import GalileoWorkflows from "../workflow";
import GalileoEvaluateApiClient from "./api-client";
import { Node } from "../types/evaluate/node.types";

export default class GalileoEvaluateWorkflows extends GalileoWorkflows {
  private apiClient: GalileoEvaluateApiClient = new GalileoEvaluateApiClient();

  public async init(): Promise<void> {
    await this.apiClient.init(this.projectName);
  }

  private workflowToNodeRows(
    step: AWorkflowStep,
    rootId?: string,
    chainId?: string,
    stepNumber: number = 0
  ): Node[] {
    let currentStepNumber = stepNumber;

    const rows: Node[] = [];

    const node_id = randomUUID();
    const chain_root_id = rootId ?? node_id;
    const has_children = step instanceof StepWithChildren && step.steps.length > 0;

    const row: Node = {
      node_id,
      node_type: step.type,
      node_name: step.name,
      node_input: JSON.stringify(step.input),
      node_output: JSON.stringify(step.output),
      chain_root_id,
      chain_id: chainId,
      step: currentStepNumber,
      has_children,
      creation_timestamp: new Date(step.createdAtNs).toISOString(),
      latency: step.durationNs,
      target: step.groundTruth,
      inputs: {},
      params: {},
      query_input_tokens: 0,
      query_output_tokens: 0,
      query_total_tokens: 0
    }

    if (step instanceof LlmStep) {
      row.params.model = step.model
      row.query_input_tokens = step.inputTokens ?? 0
      row.query_output_tokens = step.outputTokens ?? 0
      row.query_total_tokens = step.totalTokens ?? 0
    }

    rows.push(row)

    currentStepNumber++

    if (step instanceof StepWithChildren) {
      step.steps.forEach(childStep => {
        const childRows = this.workflowToNodeRows(childStep, rootId, node_id, currentStepNumber)
        rows.push(...childRows)
      });
    }

    return rows
  }

  public uploadWorkflows(): AWorkflow[] {
    if (!this.workflows.length) return []

    const nodeRows: Node[] = [];

    this.workflows.forEach(workflow => {
      nodeRows.push(...this.workflowToNodeRows(workflow))
    });

    // TODO: Create chain run goes here…

    const loggedWorkflows = this.workflows;
    this.workflows = [];

    return loggedWorkflows
  }
}