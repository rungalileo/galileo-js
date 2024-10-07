import { randomUUID } from "crypto";
import { AWorkflow, AWorkflowStep, LlmStep, StepWithChildren } from "../types/step.types";
import { TransactionLoggingMethod, TransactionRecord, TransactionRecordBatch } from "../types/transaction.types";
import GalileoWorkflows from "../workflow";
import { version } from '../../package.json';
import GalileoObserveApiClient from "./api-client";

export default class GalileoObserveWorkflows extends GalileoWorkflows {
  private apiClient: GalileoObserveApiClient = new GalileoObserveApiClient();

  public async init(): Promise<void> {
    await this.apiClient.init(this.projectName);
  }

  private workflowToRecords(
    step: AWorkflowStep,
    rootId?: string,
    chainId?: string,
  ): TransactionRecord[] {
    const rows: TransactionRecord[] = [];

    const node_id = randomUUID();
    const chain_root_id = rootId ?? node_id;
    const has_children = step instanceof StepWithChildren && step.steps.length > 0;

    const row: TransactionRecord = {
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

  public async uploadWorkflows(): Promise<AWorkflow[]> {
    if (!this.workflows.length) return []

    const records: TransactionRecord[] = [];

    this.workflows.forEach(workflow => {
      records.push(...this.workflowToRecords(workflow))
    });

    const transactionBatch: TransactionRecordBatch = {
      records,
      logging_method: TransactionLoggingMethod.js_logger,
      client_version: version
    }

    await this.apiClient.ingestBatch(transactionBatch);

    const loggedWorkflows = this.workflows;
    this.workflows = [];

    return loggedWorkflows
  }
}