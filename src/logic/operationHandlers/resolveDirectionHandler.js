/**
 * @file A handler that resolves a direction into a target location's instance id.
 * @see src/logic/operationHandlers/resolveDirectionHandler.js
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';

class ResolveDirectionHandler extends BaseOperationHandler {
  #worldContext;

  constructor({ worldContext, logger }) {
    super('ResolveDirectionHandler', {
      logger: { value: logger },
      worldContext: {
        value: worldContext,
        requiredMethods: ['getTargetLocationForDirection'],
      },
    });
    this.#worldContext = worldContext;
  }

  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);
    if (!assertParamsObject(params, logger, 'RESOLVE_DIRECTION')) return;

    // Safely destructure params, providing a default empty object to avoid errors if params is null/undefined.
    const { current_location_id, direction, result_variable } = params || {};

    // Validate that result_variable is a non-empty string.
    if (
      !result_variable ||
      typeof result_variable !== 'string' ||
      !result_variable.trim()
    ) {
      logger.warn(
        `RESOLVE_DIRECTION: Invalid or missing "result_variable" parameter. Operation aborted.`
      );
      return;
    }

    const target = this.#worldContext.getTargetLocationForDirection({
      current_location_id,
      direction_taken: direction,
    });

    const trimmedVar = result_variable.trim();
    const res = tryWriteContextVariable(
      trimmedVar,
      target,
      executionContext,
      undefined,
      logger
    );
    if (res.success) {
      logger.debug(`RESOLVE_DIRECTION → ${trimmedVar} = ${target}`);
    }
  }
}

export default ResolveDirectionHandler;
