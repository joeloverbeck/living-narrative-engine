/**
 * @file Handler for GET_TIMESTAMP operation
 *
 * Generates current ISO 8601 timestamp and stores it in a context variable for
 * time-sensitive rule logic and event tracking.
 *
 * Operation flow:
 * 1. Validate parameters (result_variable)
 * 2. Ensure evaluation context exists
 * 3. Generate current timestamp using Date().toISOString()
 * 4. Store timestamp string in specified context variable
 * 5. Log successful timestamp generation for debugging
 *
 * Related files:
 * @see data/schemas/operations/getTimestamp.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - GetTimestampHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';
import { validateStringParam } from '../../utils/handlerUtils/paramsUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';

/**
 * @implements {OperationHandler}
 */
class GetTimestampHandler extends BaseOperationHandler {
  /**
   * @param {BaseHandlerDeps} deps - Dependencies object
   */
  constructor({ logger }) {
    super('GetTimestampHandler', {
      logger: { value: logger },
    });
  }

  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);
    if (!assertParamsObject(params, logger, 'GET_TIMESTAMP')) return;

    const resultVariable = validateStringParam(
      params.result_variable,
      'result_variable',
      logger,
      undefined
    );
    if (resultVariable === null) return;
    if (!ensureEvaluationContext(executionContext, undefined, logger)) {
      return;
    }
    const timestamp = new Date().toISOString();
    const result = tryWriteContextVariable(
      resultVariable,
      timestamp,
      executionContext,
      undefined,
      logger
    );
    if (result.success) {
      logger.debug(`GET_TIMESTAMP → ${resultVariable} = ${timestamp}`);
    }
  }
}

export default GetTimestampHandler;
