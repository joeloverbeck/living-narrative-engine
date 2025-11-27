import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { MockContainer } from '../../../common/mockFactories/index.js';

// helper function to create a logger mock
/**
 *
 */
function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('registerLoaders uncovered branches', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('throws for invalid container instance', async () => {
    const {
      registerLoaders,
    } = require('../../../../src/dependencyInjection/registrations/loadersRegistrations.js');
    await expect(registerLoaders({})).rejects.toThrow(
      'Registrar requires a valid AppContainer instance.'
    );
  });

  it('throws when a loader token is undefined', async () => {
    const realTokens = jest.requireActual(
      '../../../../src/dependencyInjection/tokens.js'
    ).tokens;

    // Mock ComponentLoader token as undefined (uses registerLoader() which validates)
    // Note: RuleLoader uses custom registration that doesn't go through registerLoader()
    jest.doMock('../../../../src/dependencyInjection/tokens.js', () => {
      const actual = jest.requireActual(
        '../../../../src/dependencyInjection/tokens.js'
      );
      return { tokens: { ...actual.tokens, ComponentLoader: undefined } };
    });

    jest.resetModules();
    const {
      registerLoaders,
    } = require('../../../../src/dependencyInjection/registrations/loadersRegistrations.js');

    const container = new MockContainer();
    container.register(realTokens.ILogger, createLogger(), {
      lifecycle: 'singleton',
    });

    await expect(registerLoaders(container)).rejects.toThrow(
      /registerLoader called with undefined token/
    );
  });
});
