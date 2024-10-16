import { randomUUID } from 'crypto';
import {
  AWorkflow,
  AWorkflowStep,
  LlmStep,
  StepWithChildren
} from '../types/step.types';
import GalileoWorkflow from '../workflow';
import GalileoEvaluateApiClient from './api-client';
import { Node } from '../types/node.types';
import { RunTag } from '../types/tag.types';
import {
  CustomizedScorer,
  RegisteredScorer,
  ScorersConfiguration
} from '../types/scorer.types';

export default class GalileoEvaluateWorkflow extends GalileoWorkflow {
  private apiClient: GalileoEvaluateApiClient = new GalileoEvaluateApiClient();

  public async init(): Promise<void> {
    await this.apiClient.init(this.projectName);
  }

  private workflowToNode(
    step: AWorkflowStep,
    rootId?: string,
    chainId?: string,
    stepNumber: number = 0
  ): Node[] {
    let currentStepNumber = stepNumber;

    const nodes: Node[] = [];

    const node_id = randomUUID();
    const chain_root_id = rootId ?? node_id;
    const has_children =
      step instanceof StepWithChildren && step.steps.length > 0;

    const node: Node = {
      node_id,
      node_type: step.type,
      node_name: step.name,
      node_input: JSON.stringify(step.input),
      node_output: JSON.stringify(step.output),
      chain_root_id,
      chain_id: chainId,
      step: currentStepNumber,
      has_children,
      creation_timestamp: step.createdAtNs,
      latency: step.durationNs,
      target: step.groundTruth,
      inputs: {},
      params: {},
      query_input_tokens: 0,
      query_output_tokens: 0,
      query_total_tokens: 0,
      finish_reason: ''
    };

    if (step instanceof LlmStep) {
      node.params.model = step.model;
      node.query_input_tokens = step.inputTokens ?? 0;
      node.query_output_tokens = step.outputTokens ?? 0;
      node.query_total_tokens = step.totalTokens ?? 0;
    }

    nodes.push(node);

    currentStepNumber++;

    if (step instanceof StepWithChildren) {
      step.steps.forEach((childStep) => {
        const childeNodes = this.workflowToNode(
          childStep,
          chain_root_id,
          node_id,
          currentStepNumber
        );
        nodes.push(...childeNodes);
      });
    }

    return nodes;
  }

  public async uploadWorkflows(
    scorersConfig: ScorersConfiguration,
    runName?: string,
    runTags?: RunTag[],
    registeredScorers?: RegisteredScorer[],
    customizedScorers?: CustomizedScorer[]
  ): Promise<AWorkflow[]> {
    if (!this.workflows.length)
      throw new Error('❗ Chain run must have at least 1 workflow.');

    const nodes: Node[] = [];

    this.workflows.forEach((workflow) => {
      nodes.push(...this.workflowToNode(workflow));
    });

    this.apiClient.runId = await this.apiClient.createRun(runName, runTags);

    await this.apiClient.ingestChain(
      nodes,
      scorersConfig,
      registeredScorers,
      customizedScorers
    );

    const loggedWorkflows = this.workflows;
    this.workflows = [];

    // eslint-disable-next-line no-console
    console.log('🚀 Workflows uploaded!')
    // eslint-disable-next-line no-console
    console.log(loggedWorkflows)

    return loggedWorkflows;
  }
}
