"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const step_types_1 = require("../types/step.types");
const transaction_types_1 = require("../types/transaction.types");
const workflow_1 = __importDefault(require("../workflow"));
const package_json_1 = require("../../package.json");
const api_client_1 = __importDefault(require("./api-client"));
class GalileoObserveWorkflow extends workflow_1.default {
    constructor() {
        super(...arguments);
        this.apiClient = new api_client_1.default();
    }
    async init() {
        await this.apiClient.init(this.projectName);
    }
    workflowToRecords(step, rootId, chainId) {
        const rows = [];
        const node_id = (0, crypto_1.randomUUID)();
        const chain_root_id = rootId ?? node_id;
        const has_children = step instanceof step_types_1.StepWithChildren && step.steps.length > 0;
        const row = {
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
            user_metadata: step.metadata
        };
        if (step instanceof step_types_1.LlmStep) {
            row.model = step.model;
            row.temperature = step.temperature;
            row.num_input_tokens = step.inputTokens ?? 0;
            row.num_output_tokens = step.outputTokens ?? 0;
            row.num_total_tokens = step.totalTokens ?? 0;
        }
        rows.push(row);
        if (step instanceof step_types_1.StepWithChildren) {
            step.steps.forEach((childStep) => {
                const childRows = this.workflowToRecords(childStep, chain_root_id, node_id);
                rows.push(...childRows);
            });
        }
        return rows;
    }
    async uploadWorkflows() {
        if (!this.workflows.length)
            throw new Error('Batch must have at least 1 workflow.');
        const records = [];
        this.workflows.forEach((workflow) => {
            records.push(...this.workflowToRecords(workflow));
        });
        const transactionBatch = {
            records,
            logging_method: transaction_types_1.TransactionLoggingMethod.js_logger,
            client_version: package_json_1.version
        };
        await this.apiClient.ingestBatch(transactionBatch);
        const loggedWorkflows = this.workflows;
        this.workflows = [];
        return loggedWorkflows;
    }
}
exports.default = GalileoObserveWorkflow;
//# sourceMappingURL=workflow.js.map