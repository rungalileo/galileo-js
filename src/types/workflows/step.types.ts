import { Message } from "./message.types";
import { NodeType } from "./node.types";

type StepIOType = string | Document | Message | { [key: string]: string } | (Document | Message | { [key: string]: any })[];

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

export interface StepWithChildren extends BaseStep {
    steps: BaseStep[];
    parent?: StepWithChildren;
    addLlm(step: LlmStep): LlmStep;
    addRetriever(step: RetrieverStep): RetrieverStep;
    addTool(step: ToolStep): ToolStep;
    addSubWorkflow(step: WorkflowStep): WorkflowStep;
    addSubAgent(step: AgentStep): AgentStep;
    conclude(
        output?: StepIOType,
        durationNs?: number,
        statusCode?: number
    ): StepWithChildren | undefined
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
