/* galileo 2.0 Traces */

import { StepWithChildSpans, StepWithChildSpansOptions } from './span.types';
import { StepType } from './step.types';

export interface TraceOptions extends StepWithChildSpansOptions {
  input: string;
  output?: string;
}

export class Trace extends StepWithChildSpans {
  type: StepType = StepType.trace;
  input: string;
  output?: string;

  constructor(data: TraceOptions) {
    super(StepType.trace, data);
    this.input = data.input;
    this.output = data.output;
  }
}
