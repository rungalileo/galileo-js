"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const workflow_1 = __importDefault(require("./workflow"));
jest.mock("./types/step.types");
jest.mock("./api-client");
jest.mock("crypto");
jest.mock("./types/transaction.types");
jest.mock('../package.json');
describe('GalileoObserveWorkflows', () => {
    let instance;
    beforeEach(() => {
        instance = new workflow_1.default();
    });
    it('instance should be an instanceof GalileoObserveWorkflows', () => {
        expect(instance instanceof workflow_1.default).toBeTruthy();
    });
    it('should have a method init()', async () => {
        // await instance.init();
        expect(false).toBeTruthy();
    });
    it('should have a method pushStep()', () => {
        // instance.pushStep(step);
        expect(false).toBeTruthy();
    });
    it('should have a method addWorkflow()', () => {
        // instance.addWorkflow(step);
        expect(false).toBeTruthy();
    });
    it('should have a method addAgentWorkflow()', () => {
        // instance.addAgentWorkflow(step);
        expect(false).toBeTruthy();
    });
    it('should have a method addSingleStepWorkflow()', () => {
        // instance.addSingleStepWorkflow(step);
        expect(false).toBeTruthy();
    });
    it('should have a method validWorkflow()', () => {
        // instance.validWorkflow(errorMessage);
        expect(false).toBeTruthy();
    });
    it('should have a method addLlmStep()', () => {
        // instance.addLlmStep(step);
        expect(false).toBeTruthy();
    });
    it('should have a method addRetrieverStep()', () => {
        // instance.addRetrieverStep(step);
        expect(false).toBeTruthy();
    });
    it('should have a method addToolStep()', () => {
        // instance.addToolStep(step);
        expect(false).toBeTruthy();
    });
    it('should have a method addWorkflowStep()', () => {
        // instance.addWorkflowStep(step);
        expect(false).toBeTruthy();
    });
    it('should have a method addAgentStep()', () => {
        // instance.addAgentStep(step);
        expect(false).toBeTruthy();
    });
    it('should have a method concludeWorkflow()', () => {
        // instance.concludeWorkflow(output,durationNs,statusCode);
        expect(false).toBeTruthy();
    });
    it('should have a method workflowToRecords()', () => {
        // instance.workflowToRecords(step,rootId,chainId);
        expect(false).toBeTruthy();
    });
    it('should have a method uploadWorkflows()', async () => {
        // await instance.uploadWorkflows();
        expect(false).toBeTruthy();
    });
});
//# sourceMappingURL=workflow.generated.test.js.map