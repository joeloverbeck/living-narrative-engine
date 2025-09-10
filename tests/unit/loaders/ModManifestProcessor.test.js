/**
 * @file Unit tests for ModManifestProcessor
 * @description Tests the optional dependency on IModValidationOrchestrator
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ModManifestProcessor from '../../../src/loaders/ModManifestProcessor.js';

describe('ModManifestProcessor - Optional Orchestrator Dependency', () => {
  let testBed;
  let mockDependencies;

  beforeEach(() => {
    testBed = createTestBed();

    // Create mock dependencies for ModManifestProcessor
    mockDependencies = {
      modManifestLoader: {
        loadRequestedManifests: jest.fn().mockResolvedValue(new Map()),
        getLoadedManifests: jest.fn().mockResolvedValue(new Map()),
      },
      logger: testBed.mockLogger,
      registry: {
        store: jest.fn(),
      },
      validatedEventDispatcher: testBed.mockValidatedEventDispatcher,
      modDependencyValidator: {
        validate: jest.fn(),
      },
      modVersionValidator: jest.fn(),
      modLoadOrderResolver: {
        resolve: jest.fn().mockReturnValue(['core']),
      },
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should create instance successfully with modValidationOrchestrator present', () => {
      // Arrange
      const mockOrchestrator = {
        validateForLoading: jest.fn(),
      };

      // Act & Assert
      expect(() => {
        const processor = new ModManifestProcessor({
          ...mockDependencies,
          modValidationOrchestrator: mockOrchestrator,
        });
        expect(processor).toBeDefined();
      }).not.toThrow();
    });

    it('should create instance successfully with modValidationOrchestrator as null', () => {
      // Act & Assert
      expect(() => {
        const processor = new ModManifestProcessor({
          ...mockDependencies,
          modValidationOrchestrator: null,
        });
        expect(processor).toBeDefined();
      }).not.toThrow();
    });

    it('should create instance successfully with modValidationOrchestrator as undefined', () => {
      // Act & Assert
      expect(() => {
        const processor = new ModManifestProcessor({
          ...mockDependencies,
          modValidationOrchestrator: undefined,
        });
        expect(processor).toBeDefined();
    }).not.toThrow();
    });
  });

  describe('processManifests - Without Orchestrator', () => {
    let processor;

    beforeEach(() => {
      processor = new ModManifestProcessor({
        ...mockDependencies,
        modValidationOrchestrator: null,
      });
    });

    it('should use traditional validation flow when orchestrator is null', async () => {
      // Arrange
      const requestedIds = ['core'];
      const worldName = 'test-world';
      
      mockDependencies.modManifestLoader.loadRequestedManifests.mockResolvedValue(
        new Map([['core', { id: 'core', version: '1.0.0' }]])
      );

      // Act
      const result = await processor.processManifests(requestedIds, worldName);

      // Assert
      expect(result).toBeDefined();
      expect(result.loadedManifestsMap).toBeDefined();
      expect(result.finalModOrder).toEqual(['core']);
      expect(result.incompatibilityCount).toBe(0);
      
      // Verify traditional validation flow was used
      expect(mockDependencies.modDependencyValidator.validate).toHaveBeenCalled();
      expect(mockDependencies.modVersionValidator).toHaveBeenCalled();
    });

    it('should not attempt orchestrator validation when orchestrator is null', async () => {
      // Arrange
      const requestedIds = ['core'];
      const worldName = 'test-world';
      const options = { validateCrossReferences: true };
      
      mockDependencies.modManifestLoader.loadRequestedManifests.mockResolvedValue(
        new Map([['core', { id: 'core', version: '1.0.0' }]])
      );

      // Act
      const result = await processor.processManifests(requestedIds, worldName, options);

      // Assert
      expect(result).toBeDefined();
      expect(result.validationWarnings).toEqual([]);
      
      // Verify orchestrator was not called (would throw if attempted)
      expect(mockDependencies.modDependencyValidator.validate).toHaveBeenCalled();
    });
  });

  describe('processManifests - With Orchestrator', () => {
    let processor;
    let mockOrchestrator;

    beforeEach(() => {
      mockOrchestrator = {
        validateForLoading: jest.fn(),
      };
      
      processor = new ModManifestProcessor({
        ...mockDependencies,
        modValidationOrchestrator: mockOrchestrator,
      });
    });

    it('should use orchestrator validation when available and cross-reference validation requested', async () => {
      // Arrange
      const requestedIds = ['core'];
      const worldName = 'test-world';
      const options = { validateCrossReferences: true };
      
      const validationResult = {
        canLoad: true,
        warnings: ['test warning'],
        loadOrder: ['core'],
        recommendations: [],
      };
      
      mockOrchestrator.validateForLoading.mockResolvedValue(validationResult);
      mockDependencies.modManifestLoader.getLoadedManifests.mockResolvedValue(
        new Map([['core', { id: 'core', version: '1.0.0' }]])
      );

      // Act
      const result = await processor.processManifests(requestedIds, worldName, options);

      // Assert
      expect(result).toBeDefined();
      expect(result.validationWarnings).toEqual(['test warning']);
      expect(result.finalModOrder).toEqual(['core']);
      
      // Verify orchestrator was used
      expect(mockOrchestrator.validateForLoading).toHaveBeenCalledWith(
        requestedIds,
        { strictMode: false, allowWarnings: true }
      );
      
      // Verify traditional validation was skipped
      expect(mockDependencies.modDependencyValidator.validate).not.toHaveBeenCalled();
    });

    it('should fall back to traditional validation when orchestrator fails', async () => {
      // Arrange
      const requestedIds = ['core'];
      const worldName = 'test-world';
      const options = { validateCrossReferences: true, strictMode: false };
      
      mockOrchestrator.validateForLoading.mockRejectedValue(new Error('Orchestrator failed'));
      mockDependencies.modManifestLoader.loadRequestedManifests.mockResolvedValue(
        new Map([['core', { id: 'core', version: '1.0.0' }]])
      );

      // Act
      const result = await processor.processManifests(requestedIds, worldName, options);

      // Assert
      expect(result).toBeDefined();
      expect(result.loadedManifestsMap).toBeDefined();
      
      // Verify fallback to traditional validation occurred
      expect(mockDependencies.modDependencyValidator.validate).toHaveBeenCalled();
      expect(mockDependencies.modVersionValidator).toHaveBeenCalled();
      
      // Verify warning was logged
      expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
        'Validation orchestrator failed, falling back to traditional validation',
        expect.any(Error)
      );
    });
  });
});