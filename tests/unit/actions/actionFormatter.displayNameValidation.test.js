import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { formatActionCommand } from '../../../src/actions/actionFormatter.js';
import { createMockLogger } from '../../common/mockFactories.js';
import { dispatchValidationError } from '../../../src/utils/safeDispatchErrorUtils.js';
import { validateDependencies } from '../../../src/utils/dependencyUtils.js';

jest.mock('../../../src/utils/dependencyUtils.js', () => {
  const actual = jest.requireActual('../../../src/utils/dependencyUtils.js');
  return {
    ...actual,
    validateDependencies: jest.fn((deps, logger) =>
      actual.validateDependencies(deps, logger)
    ),
  };
});

jest.mock('../../../src/utils/entityUtils.js', () => ({
  getEntityDisplayName: jest.fn(() => 'Mock Entity'),
}));

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
  dispatchValidationError: jest.fn((dispatcher, message, details) => ({
    ok: false,
    error: message,
    ...(details !== undefined ? { details } : {}),
  })),
}));

describe('formatActionCommand dependency validation coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps displayName dependency failures to a descriptive validation error', () => {
    const logger = createMockLogger();
    const dispatcher = { dispatch: jest.fn() };
    const entityManager = { getEntityInstance: jest.fn() };

    validateDependencies.mockImplementationOnce(() => {
      throw new Error('displayNameFn dependency missing');
    });

    const result = formatActionCommand(
      { id: 'display-check', template: 'inspect {target}' },
      ActionTargetContext.noTarget(),
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(validateDependencies).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'displayNameFn' }),
      ]),
      logger
    );
    expect(dispatchValidationError).toHaveBeenCalledWith(
      dispatcher,
      'formatActionCommand: getEntityDisplayName utility function is not available.',
      undefined,
      logger
    );
    expect(result).toEqual({
      ok: false,
      error:
        'formatActionCommand: getEntityDisplayName utility function is not available.',
    });
  });
});
