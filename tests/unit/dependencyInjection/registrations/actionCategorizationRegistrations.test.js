import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock(
  '../../../../src/entities/utils/ActionCategorizationService.js',
  () => {
    const serviceMock = jest.fn().mockImplementation((deps) => ({
      __mockService: true,
      deps,
    }));

    return {
      __esModule: true,
      default: serviceMock,
    };
  }
);

import { registerActionCategorization } from '../../../../src/dependencyInjection/registrations/actionCategorizationRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { UI_CATEGORIZATION_CONFIG } from '../../../../src/entities/utils/actionCategorizationConfig.js';
import ActionCategorizationService from '../../../../src/entities/utils/ActionCategorizationService.js';

/**
 * Create a minimal logger that satisfies the validation requirements.
 *
 * @returns {{info: jest.Mock, warn: jest.Mock, error: jest.Mock, debug: jest.Mock}}
 */
function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('registerActionCategorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers the action categorization service as a singleton factory', () => {
    const mockContainer = { register: jest.fn() };

    registerActionCategorization(mockContainer);

    expect(mockContainer.register).toHaveBeenCalledTimes(1);
    const [token, factory, options] = mockContainer.register.mock.calls[0];

    expect(token).toBe(tokens.IActionCategorizationService);
    expect(typeof factory).toBe('function');
    expect(options).toEqual({ lifecycle: 'singletonFactory' });
  });

  it('factory resolves the logger and constructs the service with UI configuration', () => {
    const mockContainer = { register: jest.fn() };

    registerActionCategorization(mockContainer);

    const [, factory] = mockContainer.register.mock.calls[0];

    const logger = createMockLogger();
    const resolver = { resolve: jest.fn().mockReturnValue(logger) };

    const instance = factory(resolver);

    expect(resolver.resolve).toHaveBeenCalledTimes(1);
    expect(resolver.resolve).toHaveBeenCalledWith(tokens.ILogger);
    expect(jest.isMockFunction(ActionCategorizationService)).toBe(true);
    expect(ActionCategorizationService).toHaveBeenCalledTimes(1);
    expect(ActionCategorizationService).toHaveBeenCalledWith({
      logger,
      config: UI_CATEGORIZATION_CONFIG,
    });
    expect(instance).toEqual({
      __mockService: true,
      deps: {
        logger,
        config: UI_CATEGORIZATION_CONFIG,
      },
    });
  });
});
