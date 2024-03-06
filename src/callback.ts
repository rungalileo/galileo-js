import type { LLMResult } from '@langchain/core/outputs';
import type { BaseMessage } from '@langchain/core/messages';
import type { DocumentInterface } from '@langchain/core/documents';
import type { Serialized } from '@langchain/core/load/serializable';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { AgentAction, AgentFinish } from '@langchain/core/agents';
import type { ChainValues } from '@langchain/core/utils/types';
import { ApiClient } from './api-client.js';
import {
  TransactionRecord,
  TransactionRecordBatch,
  TransactionRecordType
} from './types/transaction.types.js';

export class GalileoObserveCallback extends BaseCallbackHandler {
  name = 'GalileoObserveCallback';
  api_client: ApiClient;

  timers: Record<string, Record<string, number>> = {};
  records: Record<string, TransactionRecord> = {};
  version: string | null;

  constructor(project_name: string, version: string | null = null) {
    super();
    this.version = version;
    this.api_client = new ApiClient();
    this.api_client.init(project_name);
  }

  private async _start_new_node(
    run_id: string,
    parent_run_id: string | null
  ): Promise<[string, string | null, string | null]> {
    const node_id = run_id;
    const chain_id = parent_run_id ? parent_run_id : null;
    let chain_root_id: string | null;
    if (chain_id) {
      // This check ensures we're actually logging the parent chain
      if (this.records[chain_id]) {
        this.records[chain_id].has_children = true;
        chain_root_id = this.records[chain_id].chain_root_id || null;
      } else {
        // We're not logging the parent chain, so this is the root
        chain_root_id = node_id;
      }
    } else {
      // This node is the root if it doesn't have a parent
      chain_root_id = node_id;
    }

    this.timers[node_id] = {};
    this.timers[node_id]['start'] = performance.now();

    return [node_id, chain_root_id, chain_id];
  }

  private async _end_node(run_id: string): Promise<[string, number]> {
    const node_id = run_id;

    this.timers[node_id]['stop'] = performance.now();
    const latency_ms = Math.round(
      (this.timers[node_id]['stop'] - this.timers[node_id]['start']) * 1000
    );
    delete this.timers[node_id];

    return [node_id, latency_ms];
  }

  private async _finalize_node(record: TransactionRecord): Promise<void> {
    this.records[record.node_id] = record;
    const batch_records: TransactionRecord[] = [];
    // If this record is closing out a root chain, then add all
    // records with that chain_root_id to the batch
    if (record.node_id === record.chain_root_id) {
      for (const [k, v] of Object.entries(this.records)) {
        if (v.chain_root_id === record.chain_root_id) {
          batch_records.push(v);
          delete this.records[k];
        }
      }

      const transaction_batch: TransactionRecordBatch = {
        records: batch_records
      };
      await this.api_client.ingestBatch(transaction_batch);
    }
  }

  async handleLLMStart?(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string | undefined,
    extraParams?: Record<string, unknown> | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string | undefined
  ): Promise<any>;
  /**
   * Called if an LLM/ChatModel run encounters an error
   */
  async handleLLMError?(
    err: any,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<any>;
  /**
   * Called at the end of an LLM/ChatModel run, with the output and the run ID.
   */
  async handleLLMEnd?(
    output: LLMResult,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<any>;
  /**
   * Called at the start of a Chat Model run, with the prompt(s)
   * and the run ID.
   */
  handleChatModelStart?(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string | undefined,
    extraParams?: Record<string, unknown> | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string | undefined
  ): Promise<any>;
  /**
   * Called at the start of a Chain run, with the chain name and inputs
   * and the run ID.
   */
  async handleChainStart?(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    runType?: string | undefined,
    name?: string | undefined
  ): Promise<any>;
  /**
   * Called if a Chain run encounters an error
   */
  async handleChainError?(
    err: any,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    kwargs?:
      | {
          inputs?: Record<string, unknown> | undefined;
        }
      | undefined
  ): Promise<any>;
  /**
   * Called at the end of a Chain run, with the outputs and the run ID.
   */
  handleChainEnd?(
    outputs: ChainValues,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    kwargs?:
      | {
          inputs?: Record<string, unknown> | undefined;
        }
      | undefined
  ): Promise<any>;
  /**
   * Called at the start of a Tool run, with the tool name and input
   * and the run ID.
   */
  async handleToolStart?(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string | undefined
  ): Promise<any>;
  /**
   * Called if a Tool run encounters an error
   */
  async handleToolError?(
    err: any,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<any>;
  /**
   * Called at the end of a Tool run, with the tool output and the run ID.
   */
  async handleToolEnd?(
    output: string,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<any>;
  async handleText?(
    text: string,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<void>;
  /**
   * Called when an agent is about to execute an action,
   * with the action and the run ID.
   */
  async handleAgentAction?(
    action: AgentAction,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<void>;
  /**
   * Called when an agent finishes execution, before it exits.
   * with the final output and the run ID.
   */
  async handleAgentEnd?(
    action: AgentFinish,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<void>;

  async handleRetrieverStart?(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string | undefined
  ): Promise<any>;

  async handleRetrieverEnd?(
    documents: DocumentInterface<Record<string, any>>[],
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<any>;

  async handleRetrieverError?(
    err: any,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<any>;
}
