import { describe, it, expect, jest } from '@jest/globals';
import { GameStateValidationServiceForPrompting } from '../../../src/validation/gameStateValidationServiceForPrompting.js';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const makeDispatcher = () => ({ dispatch: jest.fn() });

describe('GameStateValidationServiceForPrompting constructor validation', () => {
  it('throws when safeEventDispatcher is missing', () => {
    expect(
      () => new GameStateValidationServiceForPrompting({ logger: mockLogger })
    ).toThrow(
      'GameStateValidationServiceForPrompting: safeEventDispatcher with dispatch method is required.'
    );
  });

  it('throws when safeEventDispatcher has no dispatch method', () => {
    expect(
      () =>
        new GameStateValidationServiceForPrompting({
          logger: mockLogger,
          safeEventDispatcher: {},
        })
    ).toThrow(
      'GameStateValidationServiceForPrompting: safeEventDispatcher with dispatch method is required.'
    );
  });

  it('does not throw when safeEventDispatcher has a dispatch function', () => {
    expect(
      () =>
        new GameStateValidationServiceForPrompting({
          logger: mockLogger,
          safeEventDispatcher: makeDispatcher(),
        })
    ).not.toThrow();
  });
});
