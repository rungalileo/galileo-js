import { AgentStep, AWorkflow, AWorkflowStep, LlmStep, RetrieverStep, StepIOType, StepWithChildren, ToolStep, WorkflowStep } from "./types/step.types";
import { ApiClient } from "./api-client";
import { randomUUID } from "crypto";
import { TransactionLoggingMethod, TransactionRecord, TransactionRecordBatch } from "./types/transaction.types";
import { version } from '../package.json';
import GalileoObserveWorkflows from "./workflow";

jest.mock("./types/step.types");
jest.mock("./api-client");
jest.mock("crypto");
jest.mock("./types/transaction.types");
jest.mock('../package.json');

describe('GalileoObserveWorkflows', () => {
  let instance;

  beforeEach(() => {
    instance = new GalileoObserveWorkflows();
  });

  it('instance should be an instanceof GalileoObserveWorkflows', () => {
    expect(instance instanceof GalileoObserveWorkflows).toBeTruthy();
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