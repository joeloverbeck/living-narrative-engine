/**
 * @file Unit tests for the ConcreteTurnContextFactory class.
 * @description These tests ensure that the factory correctly validates its dependencies and
 * assembles the correct arguments to construct a TurnContext instance.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConcreteTurnContextFactory } from '../../../../src/turns/factories/concreteTurnContextFactory.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';

// Mock the TurnContext class, the factory's output, to spy on its constructor.
jest.mock('../../../../src/turns/context/turnContext.js');

// --- Mock Dependencies for the Factory ---
const mockLogger = { debug: jest.fn(), error: jest.fn() };
const mockGameWorldAccess = {};
const mockTurnEndPort = {};
const mockSafeEventDispatcher = {};
const mockEntityManager = {};

// --- Mock Arguments for the create() method ---
const mockActor = { id: 'test-actor' };
const mockStrategy = { decideAction: jest.fn() };
const mockOnEndTurnCallback = jest.fn();
const mockHandlerInstance = {};
const mockIsAwaitingProvider = jest.fn(() => true);
const mockOnSetAwaitingCallback = jest.fn();

describe('ConcreteTurnContextFactory', () => {
  let factoryDependencies;

  beforeEach(() => {
    jest.clearAllMocks();

    // Group all factory dependencies for easier use in tests.
    factoryDependencies = {
      logger: mockLogger,
      gameWorldAccess: mockGameWorldAccess,
      turnEndPort: mockTurnEndPort,
      safeEventDispatcher: mockSafeEventDispatcher,
      entityManager: mockEntityManager,
    };
  });

  describe('Constructor', () => {
    it('should throw an error if logger is not provided', () => {
      delete factoryDependencies.logger;
      expect(() => new ConcreteTurnContextFactory(factoryDependencies)).toThrow(
        'ConcreteTurnContextFactory: logger is required.'
      );
    });

    it('should throw an error if gameWorldAccess is not provided', () => {
      delete factoryDependencies.gameWorldAccess;
      expect(() => new ConcreteTurnContextFactory(factoryDependencies)).toThrow(
        'ConcreteTurnContextFactory: gameWorldAccess is required.'
      );
    });

    it('should throw an error if turnEndPort is not provided', () => {
      delete factoryDependencies.turnEndPort;
      expect(() => new ConcreteTurnContextFactory(factoryDependencies)).toThrow(
        'ConcreteTurnContextFactory: turnEndPort is required.'
      );
    });

    it('should throw an error if safeEventDispatcher is not provided', () => {
      delete factoryDependencies.safeEventDispatcher;
      expect(() => new ConcreteTurnContextFactory(factoryDependencies)).toThrow(
        'ConcreteTurnContextFactory: safeEventDispatcher is required.'
      );
    });

    it('should throw an error if entityManager is not provided', () => {
      delete factoryDependencies.entityManager;
      expect(() => new ConcreteTurnContextFactory(factoryDependencies)).toThrow(
        'ConcreteTurnContextFactory: entityManager is required.'
      );
    });

    it('should construct successfully when all dependencies are provided', () => {
      expect(
        () => new ConcreteTurnContextFactory(factoryDependencies)
      ).not.toThrow();
    });
  });

  describe('create', () => {
    it('should create a TurnContext with correctly assembled arguments', () => {
      // Arrange
      const factory = new ConcreteTurnContextFactory(factoryDependencies);
      const createdTurnContext = { kind: 'turn-context-instance' };
      TurnContext.mockImplementation(() => createdTurnContext);
      const createParams = {
        actor: mockActor,
        strategy: mockStrategy,
        onEndTurnCallback: mockOnEndTurnCallback,
        handlerInstance: mockHandlerInstance,
        isAwaitingExternalEventProvider: mockIsAwaitingProvider,
        onSetAwaitingExternalEventCallback: mockOnSetAwaitingCallback,
      };

      // Act
      const contextInstance = factory.create(createParams);

      // Assert
      // 1. The TurnContext constructor was called exactly once.
      expect(TurnContext).toHaveBeenCalledTimes(1);

      // 2. The constructor was called with arguments assembled from both the
      //    factory's cached dependencies and the create method's parameters.
      const expectedServicesForContext = {
        game: mockGameWorldAccess,
        turnEndPort: mockTurnEndPort,
        safeEventDispatcher: mockSafeEventDispatcher,
        entityManager: mockEntityManager,
      };

      expect(TurnContext).toHaveBeenCalledWith({
        actor: mockActor, // from create() params
        strategy: mockStrategy, // from create() params
        onEndTurnCallback: mockOnEndTurnCallback, // from create() params
        handlerInstance: mockHandlerInstance, // from create() params
        logger: mockLogger, // from factory's cache
        services: expectedServicesForContext, // assembled by the factory
        isAwaitingExternalEventProvider: mockIsAwaitingProvider,
        onSetAwaitingExternalEventCallback: mockOnSetAwaitingCallback,
      });

      // 3. The factory returned the instance created by the mock constructor.
      expect(contextInstance).toBe(createdTurnContext);
    });
  });
});
