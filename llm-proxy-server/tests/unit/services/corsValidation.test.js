import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { validateRouteMethodsAgainstCors } from '../../../src/utils/corsValidation.js';
import { EXPRESSION_ROUTE_DEFINITIONS } from '../../../src/routes/expressionRoutes.js';

describe('corsValidation', () => {
  let logger;

  beforeEach(() => {
    logger = {
      warn: jest.fn(),
    };
  });

  test('does not warn when allowed methods cover all expression routes', () => {
    const result = validateRouteMethodsAgainstCors(
      EXPRESSION_ROUTE_DEFINITIONS,
      ['GET', 'POST', 'OPTIONS'],
      { logger, throwOnMismatch: true, context: 'expression routes' }
    );

    expect(result.missingMethods).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('warns and throws when a route method is missing in dev/test mode', () => {
    expect(() =>
      validateRouteMethodsAgainstCors(
        EXPRESSION_ROUTE_DEFINITIONS,
        ['POST', 'OPTIONS'],
        { logger, throwOnMismatch: true, context: 'expression routes' }
      )
    ).toThrow('CORS allowed methods missing for expression routes');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('expression routes'),
      expect.objectContaining({
        missingMethods: ['GET'],
      })
    );
  });

  test('warns without throwing when throwOnMismatch is false', () => {
    const result = validateRouteMethodsAgainstCors(
      EXPRESSION_ROUTE_DEFINITIONS,
      ['POST', 'OPTIONS'],
      { logger, throwOnMismatch: false, context: 'expression routes' }
    );

    expect(result.missingMethods).toEqual(['GET']);
    expect(logger.warn).toHaveBeenCalled();
  });
});
