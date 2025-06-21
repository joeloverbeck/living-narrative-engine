import { describe, expect, it } from '@jest/globals';
import LoaderPhase from '../../../../src/loaders/phases/LoaderPhase.js';
import { createLoadContext } from '../../../../src/loaders/LoadContext.js';

describe('LoaderPhase', () => {
  const dummyRegistry = {};

  describe('constructor', () => {
    it('should create a LoaderPhase instance', () => {
      const phase = new LoaderPhase();
      expect(phase).toBeInstanceOf(LoaderPhase);
    });
  });

  describe('execute', () => {
    it('should throw an error indicating execute() is not implemented', async () => {
      // Arrange
      const phase = new LoaderPhase();
      const ctx = createLoadContext({
        worldName: 'test-world',
        requestedMods: ['core'],
        registry: dummyRegistry,
      });

      // Act & Assert
      await expect(phase.execute(ctx)).rejects.toThrow(
        'execute() not implemented'
      );
    });

    it('should throw the same error for different context types', async () => {
      // Arrange
      const phase = new LoaderPhase();
      const ctx1 = createLoadContext({
        worldName: 'world1',
        requestedMods: ['core', 'modA'],
        registry: dummyRegistry,
      });
      const ctx2 = createLoadContext({
        worldName: 'world2',
        requestedMods: [],
        registry: dummyRegistry,
      });

      // Act & Assert
      await expect(phase.execute(ctx1)).rejects.toThrow(
        'execute() not implemented'
      );
      await expect(phase.execute(ctx2)).rejects.toThrow(
        'execute() not implemented'
      );
    });

    it('should throw the same error when called multiple times', async () => {
      // Arrange
      const phase = new LoaderPhase();
      const ctx = createLoadContext({
        worldName: 'test-world',
        requestedMods: ['core'],
        registry: dummyRegistry,
      });

      // Act & Assert
      await expect(phase.execute(ctx)).rejects.toThrow(
        'execute() not implemented'
      );
      await expect(phase.execute(ctx)).rejects.toThrow(
        'execute() not implemented'
      );
      await expect(phase.execute(ctx)).rejects.toThrow(
        'execute() not implemented'
      );
    });

    it('should throw the same error with null context', async () => {
      // Arrange
      const phase = new LoaderPhase();

      // Act & Assert
      await expect(phase.execute(null)).rejects.toThrow(
        'execute() not implemented'
      );
    });

    it('should throw the same error with undefined context', async () => {
      // Arrange
      const phase = new LoaderPhase();

      // Act & Assert
      await expect(phase.execute(undefined)).rejects.toThrow(
        'execute() not implemented'
      );
    });

    it('should throw the same error with empty object context', async () => {
      // Arrange
      const phase = new LoaderPhase();

      // Act & Assert
      await expect(phase.execute({})).rejects.toThrow(
        'execute() not implemented'
      );
    });

    it('should throw the same error with a direct object context (not using createLoadContext)', async () => {
      // Arrange
      const phase = new LoaderPhase();
      const ctx = {
        worldName: 'direct',
        requestedMods: [],
        registry: dummyRegistry,
      };
      await expect(phase.execute(ctx)).rejects.toThrow(
        'execute() not implemented'
      );
    });
  });
});
