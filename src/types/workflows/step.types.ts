import { Message } from "./message.types";
import { NodeType } from "./node.types";

export type StepIOType = string | Document | Message | { [key: string]: string } | (Document | Message | { [key: string]: any })[];

export interface BaseStep {
    type: NodeType;
    input: StepIOType;
    output: StepIOType;
    name: string;
    createdAtNs: number;
    durationNs: number;
    metadata: { [key: string]: string };
    statusCode?: number;
    groundTruth?: string;
}

export interface ToolStep extends BaseStep {
    type: NodeType.tool;
}

type LlmStepAllowedIOType = string | Message | { [key: string]: string } | (string | Message | { [key: string]: string })[];

export interface LlmStep extends Omit<BaseStep, 'input' | 'output'> {
    type: NodeType.llm;
    input: LlmStepAllowedIOType;
    output: LlmStepAllowedIOType;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    temperature?: number;
}

type RetrieverStepAllowedOutputType = (string | Document | { [key: string]: string })[];

export interface RetrieverStep extends Omit<BaseStep, 'input' | 'output'> {
    type: NodeType.retriever;
    input: string;
    output: RetrieverStepAllowedOutputType;
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
    type: NodeType = NodeType.workflow;
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
    type: NodeType.agent;
}

export interface ChainStep extends StepWithChildren {
    type: NodeType.chain;
}

export interface WorkflowStep extends StepWithChildren {
    type: NodeType.workflow;
}

export type AWorkflowStep = ToolStep | LlmStep | RetrieverStep | AgentStep | ChainStep | WorkflowStep;
