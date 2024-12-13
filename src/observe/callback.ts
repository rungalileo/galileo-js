import { AxiosError } from 'axios';
import { ChainValues } from '@langchain/core/utils/types';
import { LLMResult } from '@langchain/core/outputs';

import {
  BaseCallbackHandler,
  NewTokenIndices
} from '@langchain/core/callbacks/base';
import { BaseMessage } from '@langchain/core/messages';
import { ChatPromptValue } from '@langchain/core/prompt_values';
import { Document, DocumentInterface } from '@langchain/core/documents';
import { encoding_for_model, TiktokenModel } from 'tiktoken/init';
import { Serialized } from '@langchain/core/dist/load/serializable.js';
import {
  TransactionLoggingMethod,
  TransactionRecord,
  TransactionRecordBatch
} from '../types/transaction.types.js';
import { version } from '../../package.json';
import { AgentFinish } from '@langchain/core/dist/agents.js';
import GalileoObserveApiClient from './api-client.js';
import { StepType } from '../types/step.types.js';

export default class GalileoObserveCallback extends BaseCallbackHandler {
  public name = 'GalileoObserveCallback';
  private api_client: GalileoObserveApiClient;

  private timers: Record<string, Record<string, number>> = {};
  private records: Record<string, TransactionRecord> = {};
  public version?: string;
  public project_name: string;

  constructor(project_name: string, version?: string) {
    super();
    this.version = version;
    this.project_name = project_name;
    this.api_client = new GalileoObserveApiClient();
  }

  async init(): Promise<void> {
    await this.api_client.init(this.project_name);
  }

  private _start_new_node(
    run_id: string,
    parent_run_id?: string
  ): [string, string | undefined, string | undefined] {
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

  private _end_node(run_id: string): [string, number] {
    const node_id = run_id;

    this.timers[node_id]['stop'] = performance.now();

    const latency_ms = Math.round(
      this.timers[node_id]['stop'] - this.timers[node_id]['start']
    );

    delete this.timers[node_id];

    return [node_id, latency_ms];
  }

  private _finalize_node(record: TransactionRecord): void {
    const batch_records: TransactionRecord[] = [];

    this.records[record.node_id] = record;

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
        records: batch_records,
        logging_method: TransactionLoggingMethod.js_langchain,
        client_version: version
      };

      // fire and forget
      this.api_client.ingestBatch(transaction_batch);
    }
  }

  public handleLLMStart(
    llm: Serialized | undefined,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>
  ): void {
    const [node_id, chain_root_id, chain_id] = this._start_new_node(
      runId,
      parentRunId
    );

    const input_text = prompts[0];
    const invocation_params = extraParams?.invocation_params as Record<
      string,
      unknown
    >;
    const model = invocation_params?.model_name as string | undefined;
    const temperature = invocation_params?.temperature as number | undefined;

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
      node_type: StepType.llm,
      version: this.version,
      has_children: false
    };
  }

  /**
   * Called if an LLM/ChatModel run encounters an error
   */
  public handleLLMError(err: AxiosError, runId: string): void {
    const [node_id, latency_ms] = this._end_node(runId);

    const record = this.records[node_id];

    record.status_code = err.response?.status;
    record.output_text = `ERROR: ${err.message}`;
    record.latency_ms = latency_ms;

    this._finalize_node(record);
  }

  /**
   * Called at the end of an LLM/ChatModel run, with the output and the run ID.
   */
  public async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    const [node_id, latency_ms] = this._end_node(runId);

    const generation = output.generations[0][0];
    /**
     * We have to convert this to a JSON object because LLMResult uses Generation
     * which is a base class that doesn't contain the props we need to access. Depending on
     * the context, it could be a ChatGeneration, a ChatGenerationChunk, or something else.
     */
    const gen_json = JSON.parse(JSON.stringify(generation));
    const message = gen_json?.message;
    const message_kwargs = message?.kwargs;
    const tool_calls = message_kwargs?.tool_calls;
    const output_text = generation.text ?? tool_calls;

    let num_input_tokens: number | undefined;
    let num_output_tokens: number | undefined;
    let num_total_tokens: number | undefined;

    if (output.llmOutput) {
      const usage =
        (output.llmOutput.tokenUsage as Record<string, unknown>) ?? {};

      num_input_tokens = usage.promptTokens as number | undefined;
      num_output_tokens = usage.completionTokens as number | undefined;
      num_total_tokens = usage.totalTokens as number | undefined;
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
      finish_reason = generation.generationInfo.finish_reason as
        | string
        | undefined;
    }

    const record = this.records[node_id];

    record.output_text = output_text;
    record.num_input_tokens = num_input_tokens;
    record.num_output_tokens = num_output_tokens;
    record.num_total_tokens = num_total_tokens;
    record.finish_reason = finish_reason;
    record.latency_ms = latency_ms;
    record.status_code = 200;

    this._finalize_node(record);
  }

  /**
   * Called at the start of a Chat Model run, with the prompt(s)
   * and the run ID.
   */
  public handleChatModelStart(
    llm: Serialized | undefined,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>
  ): void {
    const [node_id, chain_root_id, chain_id] = this._start_new_node(
      runId,
      parentRunId
    );

    const chat_messages = new ChatPromptValue(messages[0]);
    const invocation_params = extraParams?.invocation_params as Record<
      string,
      unknown
    >;
    const model = (invocation_params?.model ?? invocation_params?._type) as
      | string
      | undefined;
    const temperature = invocation_params?.temperature as number | undefined;
    const tools = invocation_params?.tools as
      | Record<string, unknown>[]
      | undefined;

    this.records[node_id] = {
      node_id: node_id,
      chain_id: chain_id,
      chain_root_id: chain_root_id,
      input_text: chat_messages.toString(),
      tools: JSON.stringify(tools),
      model: model,
      created_at: new Date().toISOString(),
      temperature: temperature,
      tags: tags,
      user_metadata: metadata,
      node_type: StepType.chat,
      version: this.version,
      has_children: false
    };
  }

  /**
   * Called when LLM generates a new token.
   */
  public handleLLMNewToken(
    token: string,
    idx: NewTokenIndices,
    runId: string
  ): void {
    const node_id = runId;
    if (!this.records[node_id].time_to_first_token_ms) {
      const chain_root_id = this.records[node_id].chain_root_id;
      if (chain_root_id !== undefined) {
        const start_time = this.timers[chain_root_id]['start'];
        const now = performance.now();
        // Time to first token in milliseconds
        this.records[node_id].time_to_first_token_ms = Math.round(
          now - start_time
        );
      }
    }
  }

  /**
   * Called at the start of a Chain run, with the chain name and inputs
   * and the run ID.
   */
  public handleChainStart(
    chain: Serialized | undefined,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>
  ): void {
    const [node_id, chain_root_id, chain_id] = this._start_new_node(
      runId,
      parentRunId
    );

    let node_input: unknown = {};

    if (typeof inputs === 'string') {
      node_input = { input: inputs };
    } else if (inputs instanceof BaseMessage) {
      node_input = inputs;
    } else if (typeof inputs === 'object') {
      node_input = Object.fromEntries(
        Object.entries(inputs).filter(
          ([key, value]: [string, unknown]) =>
            key && value && typeof value === 'string'
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
      node_type: StepType.chain,
      version: this.version,
      has_children: false
    };
  }

  /**
   * Called if a Chain run encounters an error
   */
  public handleChainError(err: AxiosError, runId: string): void {
    const [node_id, latency_ms] = this._end_node(runId);
    const record = this.records[node_id];

    record.output_text = `ERROR: ${err.message}`;
    record.finish_reason = 'chain_error';
    record.latency_ms = latency_ms;
    record.status_code = err.response?.status;

    this._finalize_node(record);
  }

  /**
   * Called at the end of a Chain run, with the outputs and the run ID.
   */
  public handleChainEnd(outputs: ChainValues, runId: string): void {
    const [node_id, latency_ms] = this._end_node(runId);
    const record = this.records[node_id];

    record.output_text = JSON.stringify(outputs);
    record.finish_reason = 'chain_end';
    record.latency_ms = latency_ms;
    record.status_code = 200;

    this._finalize_node(record);
  }

  /**
   * Called at the start of a Tool run, with the tool name and input
   * and the run ID.
   */
  public handleToolStart(
    tool: Serialized | undefined,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>
  ): void {
    const [node_id, chain_root_id, chain_id] = this._start_new_node(
      runId,
      parentRunId
    );

    this.records[node_id] = {
      node_id: node_id,
      chain_id: chain_id,
      chain_root_id: chain_root_id,
      input_text: input,
      created_at: new Date().toISOString(),
      tags: tags,
      user_metadata: metadata,
      node_type: StepType.tool,
      version: this.version,
      has_children: false
    };
  }
  /**
   * Called if a Tool run encounters an error
   */
  public handleToolError(err: AxiosError, runId: string): void {
    const [node_id, latency_ms] = this._end_node(runId);
    const record = this.records[node_id];

    record.output_text = `ERROR: ${err.message}`;
    record.latency_ms = latency_ms;
    record.status_code = err.response?.status;

    this._finalize_node(record);
  }

  /**
   * Called at the end of a Tool run, with the tool output and the run ID.
   */
  public async handleToolEnd(output: string, runId: string): Promise<void> {
    const [node_id, latency_ms] = this._end_node(runId);
    const record = this.records[node_id];

    record.output_text = output;
    record.latency_ms = latency_ms;
    record.status_code = 200;

    this._finalize_node(record);
  }

  /**
   * Called when an agent finishes execution, before it exits.
   * with the final output and the run ID.
   */
  public handleAgentEnd(action: AgentFinish | undefined, runId: string): void {
    const [node_id, latency_ms] = this._end_node(runId);
    const record = this.records[node_id];
    record.latency_ms = latency_ms;
    record.node_type = StepType.agent;
    record.status_code = 200;

    this._finalize_node(record);
  }

  public handleRetrieverStart(
    retriever: Serialized | undefined,
    query: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>
  ): void {
    const [node_id, chain_root_id, chain_id] = this._start_new_node(
      runId,
      parentRunId
    );

    this.records[node_id] = {
      node_id: node_id,
      chain_id: chain_id,
      chain_root_id: chain_root_id,
      input_text: query,
      created_at: new Date().toISOString(),
      tags: tags,
      user_metadata: metadata,
      node_type: StepType.retriever,
      version: this.version,
      has_children: false
    };
  }

  public handleRetrieverEnd(
    documents: DocumentInterface<Record<string, unknown>>[],
    runId: string
  ): void {
    const [node_id, latency_ms] = this._end_node(runId);
    const record = this.records[node_id];
    const formatted_docs = documents.map((doc) => {
      return {
        page_content: doc.pageContent,
        metadata: doc.metadata
      };
    });

    record.output_text = JSON.stringify(formatted_docs);
    record.latency_ms = latency_ms;
    record.status_code = 200;

    this._finalize_node(record);
  }

  public handleRetrieverError(err: AxiosError, runId: string): void {
    const [node_id, latency_ms] = this._end_node(runId);
    const record = this.records[node_id];
    record.output_text = `ERROR: ${err.message}`;
    record.latency_ms = latency_ms;
    record.status_code = err.response?.status;

    this._finalize_node(record);
  }
}
