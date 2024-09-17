import { TransactionRecordType } from "./transaction.types";
import { Message } from "./message.types";

export type StepIOType = string | Document | Message | { [key: string]: string } | (Document | Message | { [key: string]: any })[];

export interface BaseStep {
    createdAtNs: number;
    durationNs: number;
    groundTruth?: string;
    input: StepIOType;
    metadata: { [key: string]: string };
    name: string;
    output: StepIOType;
    statusCode?: number;
    type: TransactionRecordType;
}

type LlmStepAllowedIOType = string | Message | { [key: string]: string } | (string | Message | { [key: string]: string })[];

export class LlmStep implements Omit<BaseStep, 'input' | 'output'> {
    createdAtNs!: number;
    durationNs!: number;
    groundTruth?: string | undefined;
    input!: LlmStepAllowedIOType;
    inputTokens?: number;
    metadata!: { [key: string]: string; };
    model?: string;
    name!: string;
    output!: LlmStepAllowedIOType;
    outputTokens?: number;
    statusCode?: number | undefined;
    temperature?: number;
    totalTokens?: number;
    type = TransactionRecordType.llm;
}

type RetrieverStepAllowedOutputType = (string | Document | { [key: string]: string })[];

export class RetrieverStep implements Omit<BaseStep, 'input' | 'output'> {
    createdAtNs!: number;
    durationNs!: number;
    groundTruth?: string | undefined;
    input!: string;
    metadata!: { [key: string]: string; };
    name!: string;
    output!: RetrieverStepAllowedOutputType;
    statusCode?: number | undefined;
    type = TransactionRecordType.retriever;
}

export class ToolStep implements BaseStep {
    createdAtNs!: number;
    durationNs!: number;
    groundTruth?: string | undefined;
    input!: StepIOType;
    metadata!: { [key: string]: string; };
    name!: string;
    output!: StepIOType;
    statusCode?: number | undefined;
    type = TransactionRecordType.tool;
}

export class StepWithChildren implements BaseStep {
    createdAtNs: number;
    durationNs: number;
    groundTruth?: string | undefined;
    input: StepIOType;
    metadata: { [key: string]: string; };
    name: string;
    output: StepIOType;
    parent: StepWithChildren | null = null;
    statusCode?: number | undefined;
    steps: AWorkflowStep[] = [];
    type: TransactionRecordType = TransactionRecordType.workflow;

    constructor(public step: Omit<BaseStep, 'type'>) {
        this.createdAtNs = step.createdAtNs;
        this.durationNs = step.durationNs;
        this.groundTruth = step.groundTruth;
        this.input = step.input;
        this.metadata = step.metadata;
        this.name = step.name
        this.output = step.output;
        this.statusCode = step.statusCode;
    }

    addStep(step: AWorkflowStep): AWorkflowStep {
        this.steps.push(step)
        return step
    };
    conclude(output?: StepIOType, durationNs?: number, statusCode?: number): StepWithChildren | null {
        this.output = output ?? this.output;
        this.durationNs = durationNs ?? this.durationNs;
        this.statusCode = statusCode;
        return this.parent
    };
}

export class AgentStep extends StepWithChildren {
    type = TransactionRecordType.agent;
}

export class WorkflowStep extends StepWithChildren {
    type = TransactionRecordType.workflow;
}

export type AWorkflow = AgentStep | LlmStep | WorkflowStep;

export type AWorkflowStep = AgentStep | LlmStep | RetrieverStep | ToolStep | WorkflowStep;
