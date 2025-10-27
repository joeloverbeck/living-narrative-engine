import { describe, test, expect, jest } from '@jest/globals';
import { warnNoActiveTurn } from '../../../src/utils/warnUtils.js';

/**
 * Simple logger mock.
 *
 * @returns {{warn: jest.Mock}} Mock logger with a warn method.
 */
const makeLogger = () => ({ warn: jest.fn() });

describe('warnNoActiveTurn', () => {
  test('includes idle note for Command methods', () => {
    const logger = makeLogger();
    warnNoActiveTurn(
      logger,
      'TurnIdleState',
      "Command ('look') submitted by ",
      'actor-1'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "TurnIdleState: Command ('look') submitted by actor-1 but no turn is active (handler is Idle)."
    );
  });

  test('omits idle note for other methods', () => {
    const logger = makeLogger();
    warnNoActiveTurn(
      logger,
      'TurnIdleState',
      'processCommandResult called (for ',
      'actor-1)'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'TurnIdleState: processCommandResult called (for actor-1) but no turn is active.'
    );
  });

  test('adds separator when method name lacks trailing whitespace', () => {
    const logger = makeLogger();
    warnNoActiveTurn(logger, 'TurnIdleState', 'handleDirective', 'actor-1');
    expect(logger.warn).toHaveBeenCalledWith(
      'TurnIdleState: handleDirective actor-1 but no turn is active.'
    );
  });
});
