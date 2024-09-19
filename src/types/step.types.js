"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowStep = exports.AgentStep = exports.StepWithChildren = exports.ToolStep = exports.RetrieverStep = exports.LlmStep = void 0;
const transaction_types_1 = require("./transaction.types");
class LlmStep {
    constructor() {
        this.type = transaction_types_1.TransactionRecordType.llm;
    }
}
exports.LlmStep = LlmStep;
class RetrieverStep {
    constructor() {
        this.type = transaction_types_1.TransactionRecordType.retriever;
    }
}
exports.RetrieverStep = RetrieverStep;
class ToolStep {
    constructor() {
        this.type = transaction_types_1.TransactionRecordType.tool;
    }
}
exports.ToolStep = ToolStep;
class StepWithChildren {
    constructor(step) {
        this.step = step;
        this.parent = null;
        this.steps = [];
        this.type = transaction_types_1.TransactionRecordType.workflow;
        this.createdAtNs = step.createdAtNs;
        this.durationNs = step.durationNs;
        this.groundTruth = step.groundTruth;
        this.input = step.input;
        this.metadata = step.metadata;
        this.name = step.name;
        this.output = step.output;
        this.statusCode = step.statusCode;
    }
    addStep(step) {
        this.steps.push(step);
        return step;
    }
    ;
    conclude(output, durationNs, statusCode) {
        this.output = output ?? this.output;
        this.durationNs = durationNs ?? this.durationNs;
        this.statusCode = statusCode;
        return this.parent;
    }
    ;
}
exports.StepWithChildren = StepWithChildren;
class AgentStep extends StepWithChildren {
    constructor() {
        super(...arguments);
        this.type = transaction_types_1.TransactionRecordType.agent;
    }
}
exports.AgentStep = AgentStep;
class WorkflowStep extends StepWithChildren {
    constructor() {
        super(...arguments);
        this.type = transaction_types_1.TransactionRecordType.workflow;
    }
}
exports.WorkflowStep = WorkflowStep;
//# sourceMappingURL=step.types.js.map