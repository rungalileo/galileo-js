"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const step_types_1 = require("./types/step.types");
const api_client_1 = require("./api-client");
const crypto_1 = require("crypto");
const transaction_types_1 = require("./types/transaction.types");
const package_json_1 = require("../package.json");
class GalileoObserveWorkflows {
    constructor(projectName) {
        this.apiClient = new api_client_1.ApiClient();
        this.workflows = [];
        this.currentWorkflow = null;
        this.stepErrorMessage = 'A workflow needs to be created in order to add a step.';
        this.projectName = projectName;
    }
    async init() {
        await this.apiClient.init(this.projectName);
    }
    pushStep(step) {
        const hasSteps = step instanceof step_types_1.WorkflowStep || step instanceof step_types_1.AgentStep;
        this.workflows.push(step);
        this.currentWorkflow = hasSteps ? step : null;
        return step;
    }
    addWorkflow(step) {
        return this.pushStep(step);
    }
    addAgentWorkflow(step) {
        return this.pushStep(step);
    }
    addSingleStepWorkflow(step) {
        return this.pushStep(step);
    }
    validWorkflow(errorMessage) {
        if (this.currentWorkflow === null) {
            throw new Error(errorMessage);
        }
        return this.currentWorkflow;
    }
    addLlmStep(step) {
        return this.validWorkflow(this.stepErrorMessage)?.addStep(step);
    }
    addRetrieverStep(step) {
        return this.validWorkflow(this.stepErrorMessage)?.addStep(step);
    }
    addToolStep(step) {
        return this.validWorkflow(this.stepErrorMessage)?.addStep(step);
    }
    addWorkflowStep(step) {
        step.parent = this.currentWorkflow;
        return this.validWorkflow(this.stepErrorMessage)?.addStep(step);
    }
    addAgentStep(step) {
        step.parent = this.currentWorkflow;
        return this.validWorkflow(this.stepErrorMessage)?.addStep(step);
    }
    concludeWorkflow(output, durationNs, statusCode) {
        const errorMessage = 'No existing workflow to conclude.';
        this.currentWorkflow = this.validWorkflow(errorMessage)?.conclude(output, durationNs, statusCode) ?? null;
        return this.currentWorkflow;
    }
    workflowToRecords(step, rootId, chainId) {
        const rows = [];
        const node_id = (0, crypto_1.randomUUID)();
        const chain_root_id = rootId ?? node_id;
        const has_children = step instanceof step_types_1.StepWithChildren && step.steps.length > 0;
        const row = {
            constructor: undefined,
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
        };
        if (step instanceof step_types_1.LlmStep) {
            row.model = step.model;
            row.temperature = step.temperature;
            row.num_input_tokens = step.inputTokens ?? 0;
            row.num_output_tokens = step.outputTokens ?? 0;
            row.num_total_tokens = step.totalTokens ?? 0;
        }
        if (step instanceof step_types_1.StepWithChildren) {
            step.steps.forEach(childStep => {
                const childRows = this.workflowToRecords(childStep, rootId, node_id);
                rows.push(...childRows);
            });
        }
        rows.push(row);
        return rows;
    }
    async uploadWorkflows() {
        if (!this.workflows.length)
            return [];
        const records = [];
        this.workflows.forEach(workflow => {
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
exports.default = GalileoObserveWorkflows;
//# sourceMappingURL=workflow.js.map