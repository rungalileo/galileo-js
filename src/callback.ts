import type { LLMResult } from '@langchain/core/outputs';
import type { BaseMessage } from '@langchain/core/messages';
import type { DocumentInterface } from '@langchain/core/documents';
import type { Serialized } from '@langchain/core/load/serializable';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { AgentAction, AgentFinish } from '@langchain/core/agents';
import type { ChainValues } from '@langchain/core/utils/types';
import { ApiClient } from './api-client';

export class GalileoObserveCallback extends BaseCallbackHandler {
  name = 'GalileoObserveCallback';
  api_client: ApiClient;

  constructor(project_name: string) {
    super();
    this.api_client = new ApiClient();
    this.api_client.init(project_name);
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
