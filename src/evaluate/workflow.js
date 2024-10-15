"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const step_types_1 = require("../types/step.types");
const workflow_1 = __importDefault(require("../workflow"));
const api_client_1 = __importDefault(require("./api-client"));
class GalileoEvaluateWorkflow extends workflow_1.default {
    constructor() {
        super(...arguments);
        this.apiClient = new api_client_1.default();
    }
    async init() {
        await this.apiClient.init(this.projectName);
    }
    workflowToNode(step, rootId, chainId, stepNumber = 0) {
        let currentStepNumber = stepNumber;
        const nodes = [];
        const node_id = (0, crypto_1.randomUUID)();
        const chain_root_id = rootId ?? node_id;
        const has_children = step instanceof step_types_1.StepWithChildren && step.steps.length > 0;
        const node = {
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
        if (step instanceof step_types_1.LlmStep) {
            node.params.model = step.model;
            node.query_input_tokens = step.inputTokens ?? 0;
            node.query_output_tokens = step.outputTokens ?? 0;
            node.query_total_tokens = step.totalTokens ?? 0;
        }
        nodes.push(node);
        currentStepNumber++;
        if (step instanceof step_types_1.StepWithChildren) {
            step.steps.forEach(childStep => {
                const childeNodes = this.workflowToNode(childStep, chain_root_id, node_id, currentStepNumber);
                nodes.push(...childeNodes);
            });
        }
        return nodes;
    }
    async uploadWorkflows(scorers_config, run_name, run_tags, registered_scorers, customized_scorers) {
        if (!this.workflows.length)
            throw new Error("Chain run must have at least 1 workflow.");
        const nodes = [];
        this.workflows.forEach(workflow => {
            nodes.push(...this.workflowToNode(workflow));
        });
        this.apiClient.run_id = await this.apiClient.createRun(run_name, run_tags);
        console.log(this.apiClient.run_id);
        await this.apiClient.ingestChain(nodes, scorers_config, registered_scorers, customized_scorers);
        console.log(this.workflows);
        const loggedWorkflows = this.workflows;
        this.workflows = [];
        return loggedWorkflows;
    }
}
exports.default = GalileoEvaluateWorkflow;
//# sourceMappingURL=workflow.js.map