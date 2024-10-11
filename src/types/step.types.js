"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowStep = exports.AgentStep = exports.StepWithChildren = exports.ToolStep = exports.RetrieverStep = exports.LlmStep = exports.StepType = void 0;
var StepType;
(function (StepType) {
    StepType["llm"] = "llm";
    StepType["chat"] = "chat";
    StepType["chain"] = "chain";
    StepType["tool"] = "tool";
    StepType["agent"] = "agent";
    StepType["retriever"] = "retriever";
    StepType["workflow"] = "workflow";
})(StepType || (exports.StepType = StepType = {}));
class LlmStep {
    constructor() {
        this.type = StepType.llm;
    }
}
exports.LlmStep = LlmStep;
class RetrieverStep {
    constructor() {
        this.type = StepType.retriever;
    }
}
exports.RetrieverStep = RetrieverStep;
class ToolStep {
    constructor() {
        this.type = StepType.tool;
    }
}
exports.ToolStep = ToolStep;
class StepWithChildren {
    constructor(step) {
        this.step = step;
        this.parent = null;
        this.steps = [];
        this.type = StepType.workflow;
        this.createdAtNs = step.createdAtNs;
        this.durationNs = step.durationNs;
        this.groundTruth = step.groundTruth;
        this.input = step.input;
        this.metadata = step.metadata;
        this.name = step.name;
        this.output = step.output;
        this.statusCode = step.statusCode;
    }
    ;
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
        this.type = StepType.agent;
    }
}
exports.AgentStep = AgentStep;
class WorkflowStep extends StepWithChildren {
    constructor() {
        super(...arguments);
        this.type = StepType.workflow;
    }
}
exports.WorkflowStep = WorkflowStep;
//# sourceMappingURL=step.types.js.map