/**
 * @file Unit tests for the GenericTurnStrategyFactory.
 */
import { jest, describe, beforeEach, expect, it } from '@jest/globals';

import { GenericTurnStrategyFactory } from '../../../src/turns/factories/genericTurnStrategyFactory.js';
import { GenericTurnStrategy } from '../../../src/turns/strategies/genericTurnStrategy.js';
import { mock, mockDeep } from 'jest-mock-extended';

describe('GenericTurnStrategyFactory', () => {
  /** @type {import('jest-mock-extended').MockProxy<import('../../../src/turns/pipeline/turnActionChoicePipeline').TurnActionChoicePipeline>} */
  let mockChoicePipeline;
  /** @type {import('jest-mock-extended').MockProxy<import('../../../src/turns/interfaces/ITurnDecisionProvider').ITurnDecisionProvider>} */
  let mockHumanDecisionProvider;
  /** @type {import('jest-mock-extended').MockProxy<import('../../../src/turns/ports/ITurnActionFactory').ITurnActionFactory>} */
  let mockTurnActionFactory;
  /** @type {import('jest-mock-extended').MockProxy<import('../../../src/interfaces/coreServices').ILogger>} */
  let mockLogger;

  beforeEach(() => {
    mockChoicePipeline = mockDeep();
    mockHumanDecisionProvider = mock();
    mockTurnActionFactory = mock();
    mockLogger = mock();
    mockLogger.debug = jest.fn();
  });

  it('should be instantiable', () => {
    // Arrange & Act
    const factory = new GenericTurnStrategyFactory({
      choicePipeline: mockChoicePipeline,
      humanDecisionProvider: mockHumanDecisionProvider,
      turnActionFactory: mockTurnActionFactory,
      logger: mockLogger,
    });

    // Assert
    expect(factory).toBeInstanceOf(GenericTurnStrategyFactory);
  });

  it('should throw an error if a dependency is missing', () => {
    // Assert
    expect(
      () =>
        new GenericTurnStrategyFactory({
          humanDecisionProvider: mockHumanDecisionProvider,
          turnActionFactory: mockTurnActionFactory,
          logger: mockLogger,
        })
    ).toThrow('GenericTurnStrategyFactory: choicePipeline is required');
  });

  describe('createForHuman()', () => {
    it('should return an object that is an instanceof GenericTurnStrategy', () => {
      // Arrange
      const factory = new GenericTurnStrategyFactory({
        choicePipeline: mockChoicePipeline,
        humanDecisionProvider: mockHumanDecisionProvider,
        turnActionFactory: mockTurnActionFactory,
        logger: mockLogger,
      });
      const actorId = 'player-xyz';

      // Act
      const strategy = factory.createForHuman(actorId);

      // Assert
      expect(strategy).toBeInstanceOf(GenericTurnStrategy);
    });

    it('should log the creation of the strategy', () => {
      // Arrange
      const factory = new GenericTurnStrategyFactory({
        choicePipeline: mockChoicePipeline,
        humanDecisionProvider: mockHumanDecisionProvider,
        turnActionFactory: mockTurnActionFactory,
        logger: mockLogger,
      });
      const actorId = 'player-123';

      // Act
      factory.createForHuman(actorId);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `GenericTurnStrategyFactory: Creating new GenericTurnStrategy for human actor ${actorId}.`
      );
    });

    it('should inject its dependencies into the created GenericTurnStrategy instance', () => {
      // This is an indirect test to ensure correct wiring by checking the properties
      // of the created object, which is acceptable for a factory test.

      // Arrange
      const factory = new GenericTurnStrategyFactory({
        choicePipeline: mockChoicePipeline,
        humanDecisionProvider: mockHumanDecisionProvider,
        turnActionFactory: mockTurnActionFactory,
        logger: mockLogger,
      });

      // Act
      const strategy = factory.createForHuman('player-456');

      // Assert
      expect(strategy.choicePipeline).toBe(mockChoicePipeline);
      expect(strategy.decisionProvider).toBe(mockHumanDecisionProvider);
      expect(strategy.turnActionFactory).toBe(mockTurnActionFactory);
      expect(strategy.logger).toBe(mockLogger);
    });
  });
});
