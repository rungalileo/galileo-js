import { GalileoLogger } from '../../utils/galileo-logger';
import { toStringValue, toStringRecord } from '../../utils/serialization';
import { getSdkLogger } from 'galileo-generated';
import { Node } from './node';

const sdkLogger = getSdkLogger();

/**
 * Log a node and its children recursively as Galileo spans.
 */
export function logNodeTree(
  node: Node,
  nodes: Record<string, Node>,
  logger: GalileoLogger
): void {
  let isWorkflowSpan = false;
  const input = node.spanParams.input ?? '';
  const inputAsString =
    typeof input === 'string' ? input : toStringValue(input);
  const output = node.spanParams.output ?? '';
  const outputAsString =
    typeof output === 'string' ? output : toStringValue(output);
  const name = node.spanParams.name;
  const tags = node.spanParams.tags;
  const durationNs = node.spanParams.durationNs as number | undefined;
  const createdAt = node.spanParams.createdAt as Date | undefined;
  const statusCode = node.spanParams.statusCode as number | undefined;

  let metadata: Record<string, string> | undefined = undefined;
  if (node.spanParams.metadata) {
    try {
      metadata = toStringRecord(
        node.spanParams.metadata as Record<string, unknown>
      );
    } catch (e) {
      sdkLogger.warn('Unable to convert metadata to a string dictionary', e);
    }
  }

  // Extract step number from metadata
  let stepNumber: number | undefined = undefined;
  if (metadata) {
    const langgraphStep = metadata['langgraph_step'];
    if (langgraphStep !== undefined) {
      try {
        stepNumber = parseInt(langgraphStep, 10);
        if (isNaN(stepNumber)) {
          sdkLogger.warn(
            `Invalid step number: ${langgraphStep}, not a valid integer`
          );
          stepNumber = undefined;
        }
      } catch (e) {
        sdkLogger.warn(
          `Invalid step number: ${langgraphStep}, exception raised ${e}`
        );
        stepNumber = undefined;
      }
    }
  }

  // Log the current node based on its type
  if (node.nodeType === 'agent') {
    logger.addAgentSpan({
      input: inputAsString,
      output: outputAsString,
      name,
      metadata,
      tags,
      durationNs,
      createdAt,
      statusCode,
      stepNumber
    });
    isWorkflowSpan = true;
  } else if (node.nodeType === 'chain') {
    logger.addWorkflowSpan({
      input: inputAsString,
      output: outputAsString,
      name,
      metadata,
      tags,
      durationNs,
      createdAt,
      statusCode,
      stepNumber
    });
    isWorkflowSpan = true;
  } else if (node.nodeType === 'llm' || node.nodeType === 'chat') {
    logger.addLlmSpan({
      input,
      output,
      model: node.spanParams.model,
      temperature: node.spanParams.temperature,
      tools: 'tools' in node.spanParams ? node.spanParams.tools : undefined,
      name,
      metadata,
      tags,
      numInputTokens: node.spanParams.numInputTokens,
      numOutputTokens: node.spanParams.numOutputTokens,
      totalTokens: node.spanParams.totalTokens,
      timeToFirstTokenNs: node.spanParams.timeToFirstTokenNs,
      durationNs,
      createdAt,
      statusCode,
      stepNumber
    });
  } else if (node.nodeType === 'retriever') {
    logger.addRetrieverSpan({
      input: inputAsString,
      output,
      name,
      metadata,
      tags,
      durationNs,
      createdAt,
      statusCode,
      stepNumber
    });
  } else if (node.nodeType === 'tool') {
    const toolSpan = logger.addToolSpan({
      input: inputAsString,
      output: outputAsString,
      name,
      metadata,
      tags,
      toolCallId: node.spanParams.toolCallId as string | undefined,
      durationNs,
      createdAt,
      statusCode,
      stepNumber
    });
    if (node.children.length > 0) {
      // Push tool span as parent so agent-as-tool child spans nest correctly
      logger.pushParent(toolSpan);
      isWorkflowSpan = true;
    }
  } else {
    sdkLogger.warn(`Unknown node type: ${node.nodeType}`);
  }

  // Process all child nodes
  let lastChild: Node | null = null;
  for (const childId of node.children) {
    const childNode = nodes[childId];
    if (childNode) {
      logNodeTree(childNode, nodes, logger);
      lastChild = childNode;
    } else {
      sdkLogger.debug(`Child node ${childId} not found`);
    }
  }

  // Conclude workflow/agent span. Use the last child's output if necessary
  if (isWorkflowSpan) {
    const finalOutput =
      output ?? (lastChild ? (lastChild.spanParams.output ?? '') : '');
    logger.conclude({
      output: toStringValue(finalOutput),
      statusCode
    });
  }
}
