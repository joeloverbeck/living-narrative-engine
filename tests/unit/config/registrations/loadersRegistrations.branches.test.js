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

  it('throws for invalid container instance', () => {
    const {
      registerLoaders,
    } = require('../../../../src/dependencyInjection/registrations/loadersRegistrations.js');
    expect(() => registerLoaders({})).toThrow(
      'Registrar requires a valid AppContainer instance.'
    );
  });

  it('throws when a loader token is undefined', () => {
    const realTokens = jest.requireActual(
      '../../../../src/dependencyInjection/tokens.js'
    ).tokens;

    jest.doMock('../../../../src/dependencyInjection/tokens.js', () => {
      const actual = jest.requireActual(
        '../../../../src/dependencyInjection/tokens.js'
      );
      return { tokens: { ...actual.tokens, RuleLoader: undefined } };
    });

    jest.resetModules();
    const {
      registerLoaders,
    } = require('../../../../src/dependencyInjection/registrations/loadersRegistrations.js');

    const container = new MockContainer();
    container.register(realTokens.ILogger, createLogger(), {
      lifecycle: 'singleton',
    });

    expect(() => registerLoaders(container)).toThrow(
      /registerLoader called with undefined token/
    );
  });
});
