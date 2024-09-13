import { TransactionRecordType } from "../transaction.types";
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

export class ToolStep implements BaseStep {
    createdAtNs!: number;
    durationNs!: number;
    groundTruth?: string | undefined;
    input!: StepIOType;
    metadata!: { [key: string]: string; };
    name!: string;
    output!: StepIOType;
    statusCode?: number | undefined;
    type!: TransactionRecordType.tool;
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
    type!: TransactionRecordType.llm;
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
    type!: TransactionRecordType.retriever;
}

export class StepWithChildren implements BaseStep {
    steps: AWorkflowStep[] = [];
    parent?: StepWithChildren | undefined;
    addStep(step: AWorkflowStep): AWorkflowStep {
        this.steps.push(step)
        return step
    };
    conclude(output?: StepIOType, durationNs?: number, statusCode?: number): StepWithChildren | undefined {
        this.output = output ?? this.output;
        this.durationNs = durationNs ?? this.durationNs;
        this.statusCode = statusCode;
        return this.parent
    };
    type: TransactionRecordType = TransactionRecordType.workflow;
    input: StepIOType = [];
    output: StepIOType = [];
    name: string = '';
    createdAtNs: number = 0;
    durationNs: number = 0;
    metadata: { [key: string]: string; } = {};
    statusCode?: number | undefined;
    groundTruth?: string | undefined;
}

export interface AgentStep extends StepWithChildren {
    type: TransactionRecordType.agent;
}

export interface ChainStep extends StepWithChildren {
    type: TransactionRecordType.chain;
}

export interface WorkflowStep extends StepWithChildren {
    type: TransactionRecordType.workflow;
}TransactionRecordType

export type AWorkflowStep = ToolStep | LlmStep | RetrieverStep | AgentStep | ChainStep | WorkflowStep;
