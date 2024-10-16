import { Document } from "./document.types";
import { Message } from "./message.types";

export enum StepType {
    llm = 'llm',
    chat = 'chat',
    chain = 'chain',
    tool = 'tool',
    agent = 'agent',
    retriever = 'retriever',
    workflow = 'workflow'
}

interface BaseStepType {
    createdAtNs: number;
    durationNs: number;
    groundTruth?: string;
    metadata: { [key: string]: string };
    name: string;
    statusCode?: number;
}

export type StepIOType = string | Document | Message | { [key: string]: string } | (Document | Message | { [key: string]: any })[];

interface StepWithChildrenType extends BaseStepType {
    input: StepIOType | LlmStepIOType;
    output: StepIOType | LlmStepIOType;
    parent: AWorkflow | null;
    statusCode?: number | undefined;
    steps: AWorkflowStep[];
}

export class StepWithChildren implements StepWithChildrenType {
    createdAtNs: number;
    durationNs: number;
    groundTruth?: string;
    input: StepIOType | LlmStepIOType;
    metadata: { [key: string]: string; };
    name: string;
    output: StepIOType | LlmStepIOType;
    parent: AWorkflow | null;
    statusCode?: number | undefined;
    steps: AWorkflowStep[] = [];
    type?: StepType.agent | StepType.llm | StepType.workflow;
    constructor(step: StepWithChildrenType) {
        this.createdAtNs = step.createdAtNs ?? new Date().getMilliseconds() * 1000000;
        this.durationNs = step.durationNs ?? 0;
        this.groundTruth = step.groundTruth;
        this.input = step.input;
        this.metadata = step.metadata ?? {};
        this.name = step.name ?? this.type;
        this.output = step.output;
        this.parent = step.parent ?? null;
        this.statusCode = step.statusCode;
    };
    addStep(step: AWorkflowStep): AWorkflowStep {
        this.steps.push(step)
        return step
    };
    conclude(output?: StepIOType, durationNs?: number, statusCode?: number): AWorkflow | null {
        this.output = output ?? this.output;
        this.durationNs = durationNs ?? this.durationNs;
        this.statusCode = statusCode;
        return this.parent
    };
}

export type AgentStepType = StepWithChildrenType;

export class AgentStep extends StepWithChildren {
    type: StepType.agent = StepType.agent;
    constructor(step: AgentStepType) {
        super(step);
    };
}

type LlmStepIOType = string | Message | { [key: string]: string } | (string | Message | { [key: string]: string })[];

export interface LlmStepType extends StepWithChildrenType {
    input: LlmStepIOType;
    inputTokens?: number;
    model?: string;
    output: LlmStepIOType;
    outputTokens?: number;
    temperature?: number;
    totalTokens?: number;
}

export class LlmStep extends StepWithChildren {
    inputTokens?: number;
    model?: string;
    outputTokens?: number;
    temperature?: number;
    totalTokens?: number;
    type: StepType.llm = StepType.llm;
    constructor(step: LlmStepType) {
        super(step);
        this.inputTokens = step.inputTokens;
        this.model = step.model;
        this.outputTokens = step.outputTokens;
        this.temperature = step.temperature;
        this.totalTokens = step.totalTokens;
    };
}

export type WorkflowStepType = StepWithChildrenType;

export class WorkflowStep extends StepWithChildren {
    type: StepType.workflow = StepType.workflow;
    constructor(step: WorkflowStepType) {
        super(step);
    };
}

type RetrieverStepOutputType = (string | Document | { [key: string]: string })[];

interface StepWithoutChildrenType extends BaseStepType {
    input: StepIOType | string;
    output: StepIOType | RetrieverStepOutputType;
}

export class StepWithoutChildren implements StepWithoutChildrenType {
    createdAtNs: number;
    durationNs: number;
    groundTruth?: string;
    input: StepIOType | string;
    metadata: { [key: string]: string; };
    name: string;
    output: StepIOType | RetrieverStepOutputType;
    statusCode?: number | undefined;
    type?: StepType.retriever | StepType.tool;
    constructor(step: StepWithoutChildrenType) {
        this.createdAtNs = step.createdAtNs ?? new Date().getMilliseconds() * 1000000;
        this.durationNs = step.durationNs ?? 0;
        this.groundTruth = step.groundTruth;
        this.input = step.input;
        this.metadata = step.metadata ?? {};
        this.name = step.name ?? this.type;
        this.output = step.output;
        this.statusCode = step.statusCode;
    };
}

export interface RetrieverStepType extends StepWithoutChildrenType {
    input: string;
    output: RetrieverStepOutputType;
}

export class RetrieverStep extends StepWithoutChildren {
    type: StepType.retriever = StepType.retriever;
    constructor(step: RetrieverStepType) {
        super(step);
    };
}

export type ToolStepType = StepWithoutChildrenType;

export class ToolStep extends StepWithoutChildren {
    type: StepType.tool = StepType.tool;
    constructor(step: ToolStepType) {
        super(step);
    };
}

export type AWorkflow = AgentStep | LlmStep | WorkflowStep;

export type AWorkflowStep = AWorkflow | RetrieverStep | ToolStep;
