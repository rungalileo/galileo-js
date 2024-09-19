"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalileoObserveCallback = void 0;
const api_client_js_1 = require("./api-client.js");
const base_1 = require("@langchain/core/callbacks/base");
const messages_1 = require("@langchain/core/messages");
const prompt_values_1 = require("@langchain/core/prompt_values");
const documents_1 = require("@langchain/core/documents");
const init_1 = require("tiktoken/init");
const transaction_types_js_1 = require("./types/transaction.types.js");
const package_json_1 = require("../package.json");
class GalileoObserveCallback extends base_1.BaseCallbackHandler {
    constructor(project_name, version) {
        super();
        this.name = 'GalileoObserveCallback';
        this.timers = {};
        this.records = {};
        this.version = version;
        this.project_name = project_name;
        this.api_client = new api_client_js_1.ApiClient();
    }
    async init() {
        await this.api_client.init(this.project_name);
    }
    _start_new_node(run_id, parent_run_id) {
        const node_id = run_id;
        const chain_id = parent_run_id ? parent_run_id : undefined;
        let chain_root_id;
        if (chain_id) {
            // This check ensures we're actually logging the parent chain
            if (this.records[chain_id]) {
                this.records[chain_id].has_children = true;
                chain_root_id = this.records[chain_id].chain_root_id;
            }
            else {
                // We're not logging the parent chain, so this is the root
                chain_root_id = node_id;
            }
        }
        else {
            // This node is the root if it doesn't have a parent
            chain_root_id = node_id;
        }
        this.timers[node_id] = {};
        this.timers[node_id]['start'] = performance.now();
        return [node_id, chain_root_id, chain_id];
    }
    _end_node(run_id) {
        const node_id = run_id;
        this.timers[node_id]['stop'] = performance.now();
        const latency_ms = Math.round(this.timers[node_id]['stop'] - this.timers[node_id]['start']);
        delete this.timers[node_id];
        return [node_id, latency_ms];
    }
    async _finalize_node(record) {
        const batch_records = [];
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
            const transaction_batch = {
                records: batch_records,
                logging_method: transaction_types_js_1.TransactionLoggingMethod.js_langchain,
                client_version: package_json_1.version
            };
            await this.api_client.ingestBatch(transaction_batch);
        }
    }
    handleLLMStart(llm, prompts, runId, parentRunId, extraParams, tags, metadata) {
        const [node_id, chain_root_id, chain_id] = this._start_new_node(runId, parentRunId);
        const input_text = prompts[0];
        const invocation_params = extraParams?.invocation_params;
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
            node_type: transaction_types_js_1.TransactionRecordType.llm,
            version: this.version,
            has_children: false
        };
    }
    /**
     * Called if an LLM/ChatModel run encounters an error
     */
    async handleLLMError(err, runId) {
        const [node_id, latency_ms] = this._end_node(runId);
        const record = this.records[node_id];
        record.status_code = err.response?.status;
        record.output_text = `ERROR: ${err.message}`;
        record.latency_ms = latency_ms;
        await this._finalize_node(record);
    }
    /**
     * Called at the end of an LLM/ChatModel run, with the output and the run ID.
     */
    async handleLLMEnd(output, runId) {
        const [node_id, latency_ms] = this._end_node(runId);
        const generation = output.generations[0][0];
        const output_text = generation.text;
        let num_input_tokens;
        let num_output_tokens;
        let num_total_tokens;
        if (output.llmOutput) {
            const usage = output.llmOutput.tokenUsage ?? {};
            num_input_tokens = usage.promptTokens;
            num_output_tokens = usage.completionTokens;
            num_total_tokens = usage.totalTokens;
        }
        else {
            try {
                const encoding = (0, init_1.encoding_for_model)(this.records[node_id].model);
                num_input_tokens = encoding.encode(this.records[node_id].input_text).length;
                num_output_tokens = encoding.encode(output_text).length;
                num_total_tokens = num_input_tokens + num_output_tokens;
            }
            catch (error) {
                num_input_tokens = 0;
                num_output_tokens = 0;
                num_total_tokens = 0;
            }
        }
        let finish_reason;
        if (generation.generationInfo) {
            finish_reason = generation.generationInfo.finish_reason;
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
    handleChatModelStart(llm, messages, runId, parentRunId, extraParams, tags, metadata) {
        const [node_id, chain_root_id, chain_id] = this._start_new_node(runId, parentRunId);
        const chat_messages = new prompt_values_1.ChatPromptValue(messages[0]);
        const invocation_params = extraParams?.invocation_params;
        const model = (invocation_params?.model ?? invocation_params?._type);
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
            node_type: transaction_types_js_1.TransactionRecordType.chat,
            version: this.version,
            has_children: false
        };
    }
    /**
     * Called at the start of a Chain run, with the chain name and inputs
     * and the run ID.
     */
    handleChainStart(chain, inputs, runId, parentRunId, tags, metadata) {
        const [node_id, chain_root_id, chain_id] = this._start_new_node(runId, parentRunId);
        let node_input = {};
        if (typeof inputs === 'string') {
            node_input = { input: inputs };
        }
        else if (inputs instanceof messages_1.BaseMessage) {
            node_input = inputs;
        }
        else if (typeof inputs === 'object') {
            node_input = Object.fromEntries(Object.entries(inputs).filter((value) => value && typeof value === 'string'));
        }
        else if (Array.isArray(inputs) &&
            inputs.every((v) => v instanceof documents_1.Document)) {
            node_input = Object.fromEntries(inputs.map((value, index) => [
                String(index),
                value.pageContent
            ]));
        }
        this.records[node_id] = {
            node_id: node_id,
            chain_id: chain_id,
            chain_root_id: chain_root_id,
            input_text: JSON.stringify(node_input),
            created_at: new Date().toISOString(),
            tags: tags,
            user_metadata: metadata,
            node_type: transaction_types_js_1.TransactionRecordType.chain,
            version: this.version,
            has_children: false
        };
    }
    /**
     * Called if a Chain run encounters an error
     */
    async handleChainError(err, runId) {
        const [node_id, latency_ms] = this._end_node(runId);
        const record = this.records[node_id];
        record.output_text = `ERROR: ${err.message}`;
        record.finish_reason = 'chain_error';
        record.latency_ms = latency_ms;
        record.status_code = err.response?.status;
        await this._finalize_node(record);
    }
    /**
     * Called at the end of a Chain run, with the outputs and the run ID.
     */
    async handleChainEnd(outputs, runId) {
        const [node_id, latency_ms] = this._end_node(runId);
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
    handleToolStart(tool, input, runId, parentRunId, tags, metadata) {
        const [node_id, chain_root_id, chain_id] = this._start_new_node(runId, parentRunId);
        this.records[node_id] = {
            node_id: node_id,
            chain_id: chain_id,
            chain_root_id: chain_root_id,
            input_text: input,
            created_at: new Date().toISOString(),
            tags: tags,
            user_metadata: metadata,
            node_type: transaction_types_js_1.TransactionRecordType.tool,
            version: this.version,
            has_children: false
        };
    }
    /**
     * Called if a Tool run encounters an error
     */
    async handleToolError(err, runId) {
        const [node_id, latency_ms] = this._end_node(runId);
        const record = this.records[node_id];
        record.output_text = `ERROR: ${err.message}`;
        record.latency_ms = latency_ms;
        record.status_code = err.response?.status;
        await this._finalize_node(record);
    }
    /**
     * Called at the end of a Tool run, with the tool output and the run ID.
     */
    async handleToolEnd(output, runId) {
        const [node_id, latency_ms] = this._end_node(runId);
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
    async handleAgentEnd(action, runId) {
        const [node_id, latency_ms] = this._end_node(runId);
        const record = this.records[node_id];
        record.latency_ms = latency_ms;
        record.node_type = transaction_types_js_1.TransactionRecordType.agent;
        record.status_code = 200;
        await this._finalize_node(record);
    }
    handleRetrieverStart(retriever, query, runId, parentRunId, tags, metadata) {
        const [node_id, chain_root_id, chain_id] = this._start_new_node(runId, parentRunId);
        this.records[node_id] = {
            node_id: node_id,
            chain_id: chain_id,
            chain_root_id: chain_root_id,
            input_text: query,
            created_at: new Date().toISOString(),
            tags: tags,
            user_metadata: metadata,
            node_type: transaction_types_js_1.TransactionRecordType.retriever,
            version: this.version,
            has_children: false
        };
    }
    async handleRetrieverEnd(documents, runId) {
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
        await this._finalize_node(record);
    }
    async handleRetrieverError(err, runId) {
        const [node_id, latency_ms] = this._end_node(runId);
        const record = this.records[node_id];
        record.output_text = `ERROR: ${err.message}`;
        record.latency_ms = latency_ms;
        record.status_code = err.response?.status;
        await this._finalize_node(record);
    }
}
exports.GalileoObserveCallback = GalileoObserveCallback;
//# sourceMappingURL=callback.js.map