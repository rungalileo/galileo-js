import type { LLMResult } from '@langchain/core/outputs';
import { BaseMessage } from '@langchain/core/messages';
import { Document, type DocumentInterface } from '@langchain/core/documents';
import type { Serialized } from '@langchain/core/load/serializable';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { AgentAction, AgentFinish } from '@langchain/core/agents';
import type { ChainValues } from '@langchain/core/utils/types';
import { ApiClient } from './api-client.js';
import { ChatPromptValue } from '@langchain/core/prompt_values';
import {
  TransactionRecord,
  TransactionRecordBatch,
  TransactionRecordType
} from './types/transaction.types.js';
import { encoding_for_model } from 'tiktoken/init';
import { TiktokenModel } from '@langchain/openai';

export class GalileoObserveCallback extends BaseCallbackHandler {
  name = 'GalileoObserveCallback';
  api_client: ApiClient;

  timers: Record<string, Record<string, number>> = {};
  records: Record<string, TransactionRecord> = {};
  version: string | undefined;
  project_name: string;

  constructor(project_name: string, version: string | undefined) {
    super();
    this.version = version;
    this.project_name = project_name;
    this.api_client = new ApiClient();
  }

  async init(): Promise<void> {
    await this.api_client.init(this.project_name);
  }

  private async _start_new_node(
    run_id: string,
    parent_run_id: string | undefined
  ): Promise<[string, string | undefined, string | undefined]> {
    const node_id = run_id;
    const chain_id = parent_run_id ? parent_run_id : undefined;
    let chain_root_id: string | undefined;
    if (chain_id) {
      // This check ensures we're actually logging the parent chain
      if (this.records[chain_id]) {
        this.records[chain_id].has_children = true;
        chain_root_id = this.records[chain_id].chain_root_id;
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
      (this.timers[node_id]['stop'] - this.timers[node_id]['start'])
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
  ): Promise<void> {
    const [node_id, chain_root_id, chain_id] = await this._start_new_node(
      runId,
      parentRunId
    );
    const input_text = prompts[0];
    const constructor = llm['id'].pop();
    const invocation_params: any = extraParams?.invocation_params;
    const model = invocation_params?.model_name;
    const temperature = invocation_params?.temperature;
    this.records[node_id] = {
      node_id: node_id,
      chain_id: chain_id,
      chain_root_id: chain_root_id,
      input_text: input_text,
      model: model,
      created_at: new Date().toISOString(),
      temperature: temperature,
      tags: tags,
      user_metadata: metadata,
      constructor: constructor,
      node_type: TransactionRecordType.llm,
      version: this.version,
      has_children: false
    };
  }
  /**
   * Called if an LLM/ChatModel run encounters an error
   */
  async handleLLMError?(
    err: any,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<void> {
    const [node_id, latency_ms] = await this._end_node(runId);
    const record = this.records[node_id];
    record.status_code = err.response.status;
    record.output_text = `ERROR: ${err.message}`;
    record.latency_ms = latency_ms;
    await this._finalize_node(record);
  }
  /**
   * Called at the end of an LLM/ChatModel run, with the output and the run ID.
   */
  async handleLLMEnd?(
    output: LLMResult,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<void> {
    const [node_id, latency_ms] = await this._end_node(runId);

    const generation = output.generations[0][0];
    const output_text = generation.text;

    let num_input_tokens: number | undefined = undefined;
    let num_output_tokens: number | undefined = undefined;
    let num_total_tokens: number | undefined = undefined;

    if (output.llmOutput) {
      const usage = output.llmOutput.tokenUsage || {};
      num_input_tokens = usage.promptTokens || null;
      num_output_tokens = usage.completionTokens || null;
      num_total_tokens = usage.totalTokens || null;
    } else {
      try {
        const encoding = encoding_for_model(
          this.records[node_id].model as TiktokenModel
        );
        num_input_tokens = encoding.encode(
          this.records[node_id].input_text
        ).length;
        num_output_tokens = encoding.encode(output_text).length;
        num_total_tokens = num_input_tokens + num_output_tokens;
      } catch (error) {
        num_input_tokens = 0;
        num_output_tokens = 0;
        num_total_tokens = 0;
      }
    }

    let finish_reason: string | undefined;
    if (generation.generationInfo) {
      finish_reason = generation.generationInfo.finish_reason || '';
    }

    const record = this.records[node_id];
    record.output_text = output_text;
    record.num_input_tokens = num_input_tokens;
    record.num_output_tokens = num_output_tokens;
    record.num_total_tokens = num_total_tokens;
    record.finish_reason = finish_reason;
    record.latency_ms = latency_ms;
    record.status_code = 200;

    await this._finalize_node(record);
  }
  /**
   * Called at the start of a Chat Model run, with the prompt(s)
   * and the run ID.
   */
  async handleChatModelStart?(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string | undefined,
    extraParams?: Record<string, unknown> | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string | undefined
  ): Promise<void> {
    const [node_id, chain_root_id, chain_id] = await this._start_new_node(
      runId,
      parentRunId
    );
    const chat_messages = new ChatPromptValue(messages[0]);
    const constructor = llm['id'].pop();
    const invocation_params: any = extraParams?.invocation_params;
    const model = invocation_params?.model || invocation_params?._type;
    const temperature = invocation_params?.temperature;
    this.records[node_id] = {
      node_id: node_id,
      chain_id: chain_id,
      chain_root_id: chain_root_id,
      input_text: chat_messages.toString(),
      model: model,
      created_at: new Date().toISOString(),
      temperature: temperature,
      tags: tags,
      user_metadata: metadata,
      constructor: constructor,
      node_type: TransactionRecordType.chat,
      version: this.version,
      has_children: false
    };
  }
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
  ): Promise<void> {
    const [node_id, chain_root_id, chain_id] = await this._start_new_node(
      runId,
      parentRunId
    );
    const constructor = chain['id'].pop();

    let node_input: any = {};
    if (typeof inputs === 'string') {
      node_input = { input: inputs };
    } else if (inputs instanceof BaseMessage) {
      node_input = inputs;
    } else if (typeof inputs === 'object') {
      node_input = Object.fromEntries(
        Object.entries(inputs).filter(
          ([key, value]: [string, unknown]) =>
            value && typeof value === 'string'
        )
      );
    } else if (
      (Array.isArray(inputs) as boolean) &&
      (inputs as Document[]).every((v: unknown) => v instanceof Document)
    ) {
      node_input = Object.fromEntries(
        (inputs as Document[]).map((value: Document, index: number) => [
          String(index),
          value.pageContent
        ])
      );
    }

    this.records[node_id] = {
      node_id: node_id,
      chain_id: chain_id,
      chain_root_id: chain_root_id,
      input_text: JSON.stringify(node_input),
      created_at: new Date().toISOString(),
      tags: tags,
      user_metadata: metadata,
      node_type: TransactionRecordType.chain,
      constructor: constructor,
      version: this.version,
      has_children: false
    };
  }
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
  ): Promise<void> {
    const [node_id, latency_ms] = await this._end_node(runId);
    const record = this.records[node_id];
    record.output_text = `ERROR: ${err.message}`;
    record.finish_reason = 'chain_error';
    record.latency_ms = latency_ms;
    record.status_code = err.response.status;

    await this._finalize_node(record);
  }
  /**
   * Called at the end of a Chain run, with the outputs and the run ID.
   */
  async handleChainEnd?(
    outputs: ChainValues,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    kwargs?:
      | {
          inputs?: Record<string, unknown> | undefined;
        }
      | undefined
  ): Promise<void> {
    const [node_id, latency_ms] = await this._end_node(runId);
    const record = this.records[node_id];
    record.output_text = JSON.stringify(outputs);
    record.finish_reason = 'chain_end';
    record.latency_ms = latency_ms;
    record.status_code = 200;

    await this._finalize_node(record);
  }
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
  ): Promise<void> {
    const [node_id, chain_root_id, chain_id] = await this._start_new_node(
      runId,
      parentRunId
    );

    const constructor = tool['id'].pop();

    this.records[node_id] = {
      node_id: node_id,
      chain_id: chain_id,
      chain_root_id: chain_root_id,
      input_text: input,
      created_at: new Date().toISOString(),
      tags: tags,
      user_metadata: metadata,
      node_type: TransactionRecordType.tool,
      constructor: constructor,
      version: this.version,
      has_children: false
    };
  }
  /**
   * Called if a Tool run encounters an error
   */
  async handleToolError?(
    err: any,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<void> {
    const [node_id, latency_ms] = await this._end_node(runId);
    const record = this.records[node_id];
    record.output_text = `ERROR: ${err.message}`;
    record.latency_ms = latency_ms;
    record.status_code = err.response.status;

    await this._finalize_node(record);
  }
  /**
   * Called at the end of a Tool run, with the tool output and the run ID.
   */
  async handleToolEnd?(
    output: string,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<void> {
    const [node_id, latency_ms] = await this._end_node(runId);
    const record = this.records[node_id];
    record.output_text = output;
    record.latency_ms = latency_ms;
    record.status_code = 200;

    await this._finalize_node(record);
  }

  /**
   * Called when an agent finishes execution, before it exits.
   * with the final output and the run ID.
   */
  async handleAgentEnd?(
    action: AgentFinish,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<void> {
    const node_id = runId;
    const record = this.records[node_id];
    record.node_type = TransactionRecordType.agent;

    await this._finalize_node(record);
  }

  async handleRetrieverStart?(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string | undefined
  ): Promise<void> {
    const [node_id, chain_root_id, chain_id] = await this._start_new_node(
      runId,
      parentRunId
    );

    const constructor = retriever['id'].pop();

    this.records[node_id] = {
      node_id: node_id,
      chain_id: chain_id,
      chain_root_id: chain_root_id,
      input_text: query,
      created_at: new Date().toISOString(),
      tags: tags,
      user_metadata: metadata,
      node_type: TransactionRecordType.retriever,
      constructor: constructor,
      version: this.version,
      has_children: false
    };
  }

  async handleRetrieverEnd?(
    documents: DocumentInterface<Record<string, any>>[],
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<void> {
    const [node_id, latency_ms] = await this._end_node(runId);
    const record = this.records[node_id];
    record.output_text = JSON.stringify(documents);
    record.latency_ms = latency_ms;
    record.status_code = 200;

    await this._finalize_node(record);
  }

  async handleRetrieverError?(
    err: any,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined
  ): Promise<void> {
    const [node_id, latency_ms] = await this._end_node(runId);
    const record = this.records[node_id];
    record.output_text = `ERROR: ${err.message}`;
    record.latency_ms = latency_ms;
    record.status_code = err.response.status;

    await this._finalize_node(record);
  }
}
