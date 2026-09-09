import { EvaluationWorkflowInput, EvaluationWorkflowResult } from './types.js';
import { WorkflowRunner } from './workflow.runner.js';

/**
 * Compatibility entry point for callers that previously imported the workflow function.
 * Durable dispatch is provided by the BullMQ evaluation queue.
 */
export async function projectEvaluationWorkflow(
  input: EvaluationWorkflowInput
): Promise<EvaluationWorkflowResult> {
  return WorkflowRunner.executeEvaluation(input);
}

export default projectEvaluationWorkflow;
