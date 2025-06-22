// tests/engine/gameEngine.test.js

import { describe, expect, it } from '@jest/globals';
import GameEngine from '../../../src/engine/gameEngine.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { describeEngineSuite } from '../../common/engine/gameEngineTestBed.js';

describeEngineSuite('GameEngine', (ctx) => {
  describe('Constructor', () => {
    it('should instantiate and resolve all core services successfully', () => {
      const testBed = ctx.bed;
      new GameEngine({
        container: testBed.env.mockContainer,
      }); // Instantiation for this test
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ILogger
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IEntityManager
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ITurnManager
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.GamePersistenceService
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.PlaytimeTracker
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('should throw an error if ILogger cannot be resolved', () => {
      const testBed = ctx.bed;
      testBed.withTokenOverride(tokens.ILogger, () => {
        throw new Error('Logger failed to resolve');
      });

      expect(
        () => new GameEngine({ container: testBed.env.mockContainer })
      ).toThrow('GameEngine requires a logger.');
      expect(console.error).toHaveBeenCalledWith(
        'GameEngine: CRITICAL - Logger not resolved.',
        expect.any(Error)
      );
    });

    it.each([
      ['IEntityManager', tokens.IEntityManager],
      ['ITurnManager', tokens.ITurnManager],
      ['GamePersistenceService', tokens.GamePersistenceService],
      ['PlaytimeTracker', tokens.PlaytimeTracker],
      ['ISafeEventDispatcher', tokens.ISafeEventDispatcher],
    ])('should throw an error if %s cannot be resolved', (_, failingToken) => {
      const testBed = ctx.bed;
      const resolutionError = new Error(`${String(failingToken)} failed`);
      testBed.withTokenOverride(failingToken, () => {
        throw resolutionError;
      });

      expect(() => testBed.env.createInstance()).toThrow(
        `GameEngine: Failed to resolve core services. ${resolutionError.message}`
      );

      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        `GameEngine: CRITICAL - Failed to resolve one or more core services. Error: ${resolutionError.message}`,
        resolutionError
      );
    });
  });
});
