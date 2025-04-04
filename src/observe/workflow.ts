import { randomUUID } from 'crypto';
import {
  AWorkflow,
  AWorkflowStep,
  LlmStep,
  StepWithChildren
} from '../types/legacy-step.types';
import {
  TransactionLoggingMethod,
  TransactionRecord,
  TransactionRecordBatch
} from '../types/transaction.types';
import GalileoWorkflow from '../workflow';
import { version } from '../../package.json';
import GalileoObserveApiClient from './api-client';

/**
 * @deprecated This class is no longer actively maintained. Please use `GalileoLogger` instead.
 */
export default class GalileoObserveWorkflow extends GalileoWorkflow {
  private apiClient: GalileoObserveApiClient = new GalileoObserveApiClient();

  public async init(): Promise<void> {
    await this.apiClient.init(this.projectName);
  }

  private workflowToRecords(
    step: AWorkflowStep,
    rootId?: string,
    chainId?: string
  ): TransactionRecord[] {
    const rows: TransactionRecord[] = [];

    const node_id = randomUUID();
    const chain_root_id = rootId ?? node_id;
    const has_children =
      step instanceof StepWithChildren && step.steps.length > 0;

    const row: TransactionRecord = {
      node_id,
      node_type: step.type,
      input_text: JSON.stringify(step.input),
      output_text: JSON.stringify(step.output),
      chain_root_id,
      chain_id: chainId,
      has_children,
      created_at: new Date(step.createdAtNs / 1000000).toISOString(),
      latency_ms: step.durationNs / 1000000,
      status_code: step.statusCode,
      user_metadata: step.metadata
    };

    if (step instanceof LlmStep) {
      row.model = step.model;
      row.temperature = step.temperature;
      row.num_input_tokens = step.inputTokens ?? 0;
      row.num_output_tokens = step.outputTokens ?? 0;
      row.num_total_tokens = step.totalTokens ?? 0;
      row.tools = JSON.stringify(step.tools);
    }

    rows.push(row);

    if (step instanceof StepWithChildren) {
      step.steps.forEach((childStep) => {
        const childRows = this.workflowToRecords(
          childStep,
          chain_root_id,
          node_id
        );
        rows.push(...childRows);
      });
    }

    return rows;
  }

  public async uploadWorkflows(): Promise<AWorkflow[]> {
    if (!this.workflows.length)
      throw new Error('❗ Batch must have at least 1 workflow.');

    const records: TransactionRecord[] = [];

    this.workflows.forEach((workflow) => {
      records.push(...this.workflowToRecords(workflow));
    });

    const transactionBatch: TransactionRecordBatch = {
      records,
      logging_method: TransactionLoggingMethod.js_logger,
      client_version: version
    };

    await this.apiClient.ingestBatch(transactionBatch);

    const loggedWorkflows = this.workflows;
    this.workflows = [];

    // eslint-disable-next-line no-console
    console.log('🚀 Workflows uploaded!');
    // eslint-disable-next-line no-console
    console.log(loggedWorkflows);

    return loggedWorkflows;
  }
}
