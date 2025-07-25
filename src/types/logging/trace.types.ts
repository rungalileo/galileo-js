/* galileo 2.0 Traces */

import { StepWithChildSpans, StepWithChildSpansOptions } from './span.types';
import { StepType } from './step.types';

export interface TraceOptions extends StepWithChildSpansOptions {
  input: string;
  redactedInput?: string;
  output?: string;
  redactedOutput?: string;
}

export class Trace extends StepWithChildSpans {
  type: StepType = StepType.trace;
  input: string;
  redactedInput?: string;
  output?: string;
  redactedOutput?: string;

  constructor(data: TraceOptions) {
    super(StepType.trace, data);
    this.input = data.input;
    this.redactedInput = data.redactedInput;
    this.output = data.output;
    this.redactedOutput = data.redactedOutput;
  }
}
