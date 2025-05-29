/* galileo 2.0 Traces */

import { StepWithChildSpans } from './span.types';
import { BaseStepOptions, StepType } from './step.types';

export interface TraceOptions extends BaseStepOptions {
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

