"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const step_types_1 = require("./types/step.types");
class GalileoWorkflow {
    constructor(projectName) {
        this.workflows = [];
        this.currentWorkflow = null;
        this.stepErrorMessage = 'A workflow needs to be created in order to add a step.';
        this.projectName = projectName;
    }
    pushStep(step) {
        const hasSteps = step instanceof step_types_1.WorkflowStep || step instanceof step_types_1.AgentStep;
        this.workflows.push(step);
        this.currentWorkflow = hasSteps ? step : null;
        return step;
    }
    addWorkflow(step) {
        return this.pushStep(new step_types_1.WorkflowStep(step));
    }
    addAgentWorkflow(step) {
        return this.pushStep(new step_types_1.AgentStep(step));
    }
    addSingleStepWorkflow(step) {
        return this.pushStep(new step_types_1.LlmStep(step));
    }
    validWorkflow(errorMessage) {
        if (this.currentWorkflow === null) {
            throw new Error(errorMessage);
        }
        return this.currentWorkflow;
    }
    addLlmStep(step) {
        return this.validWorkflow(this.stepErrorMessage)?.addStep(new step_types_1.LlmStep(step));
    }
    addRetrieverStep(step) {
        return this.validWorkflow(this.stepErrorMessage)?.addStep(new step_types_1.RetrieverStep(step));
    }
    addToolStep(step) {
        return this.validWorkflow(this.stepErrorMessage)?.addStep(new step_types_1.ToolStep(step));
    }
    addWorkflowStep(step) {
        step.parent = this.currentWorkflow;
        return this.validWorkflow(this.stepErrorMessage)?.addStep(new step_types_1.WorkflowStep(step));
    }
    addAgentStep(step) {
        step.parent = this.currentWorkflow;
        return this.validWorkflow(this.stepErrorMessage)?.addStep(new step_types_1.AgentStep(step));
    }
    concludeWorkflow(output, durationNs, statusCode) {
        const errorMessage = 'No existing workflow to conclude.';
        this.currentWorkflow = this.validWorkflow(errorMessage)?.conclude(output, durationNs, statusCode) ?? null;
        return this.currentWorkflow;
    }
}
exports.default = GalileoWorkflow;
//# sourceMappingURL=workflow.js.map