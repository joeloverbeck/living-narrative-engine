/**
 * @file Unit tests for IAnatomySystemFacade interface
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import IAnatomySystemFacade from '../../../../src/anatomy/facades/IAnatomySystemFacade.js';

// Test implementation for abstract interface
class TestAnatomySystemFacade extends IAnatomySystemFacade {
  constructor(options = {}) {
    const mockDependencies = {
      // Core services from BaseFacade
      logger: { info: () => {}, debug: () => {}, error: () => {}, warn: () => {} },
      eventBus: { dispatch: () => {}, subscribe: () => {} },
      unifiedCache: {
        get: async () => undefined, // Return undefined to trigger cache miss
        set: async () => {},
        invalidate: async () => {},
        invalidateByPattern: async () => {}
      },
      circuitBreaker: null, // Optional dependency

      // Anatomy-specific services required by IAnatomySystemFacade
      bodyGraphService: {
        getBodyParts: async () => [],
        buildGraph: async () => ({ nodes: [], edges: [], properties: {} }),
        analyzeGraph: async () => ({}),
        getPartsByType: async () => [],
        getConnectedParts: async () => [],
        attachPart: async () => ({ success: true }),
        detachPart: async () => ({ success: true }),
        replacePart: async () => ({ success: true }),
        modifyPart: async () => ({ success: true }),
        getConstraints: async () => ({ rules: [], limits: {} })
      },
      anatomyDescriptionService: {
        generateEntityDescription: async () => ({ description: 'Test description' }),
        generatePartDescription: async () => ({ description: 'Part description' })
      },
      graphIntegrityValidator: {
        validateAttachment: async () => ({ valid: true, errors: [] }),
        validateEntityGraph: async () => ({ valid: true, errors: [] })
      },
      anatomyGenerationService: {
        buildFromBlueprint: async () => ({ success: true }),
        clearEntityAnatomy: async () => ({ success: true })
      },
      bodyBlueprintFactory: {
        validateBlueprint: async () => ({ valid: true, errors: [] })
      }
    };
    super({ ...mockDependencies, ...options });
  }
}

describe('IAnatomySystemFacade', () => {
  let testBed;
  let facade;

  beforeEach(() => {
    testBed = createTestBed();
    facade = new TestAnatomySystemFacade();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('constructor', () => {
    it('should create facade instance', () => {
      expect(facade).toBeInstanceOf(IAnatomySystemFacade);
      expect(facade).toBeInstanceOf(TestAnatomySystemFacade);
    });

    it('should throw error when instantiated directly', () => {
      expect(() => {
        new IAnatomySystemFacade({
          logger: { info: () => {}, debug: () => {}, error: () => {}, warn: () => {} },
          eventBus: { dispatch: () => {}, subscribe: () => {} },
          unifiedCache: { get: () => null, set: () => {}, invalidate: () => {} }
        });
      }).toThrow('Cannot instantiate abstract class IAnatomySystemFacade');
    });
  });

  describe('interface methods', () => {
    describe('query methods', () => {
      it('should have getBodyParts method', () => {
        expect(typeof facade.getBodyParts).toBe('function');
      });

      it('should have getBodyGraph method', () => {
        expect(typeof facade.getBodyGraph).toBe('function');
      });

      it('should have getPartByType method', () => {
        expect(typeof facade.getPartByType).toBe('function');
      });

      it('should have getConnectedParts method', () => {
        expect(typeof facade.getConnectedParts).toBe('function');
      });
    });

    describe('modification methods', () => {
      it('should have attachPart method', () => {
        expect(typeof facade.attachPart).toBe('function');
      });

      it('should have detachPart method', () => {
        expect(typeof facade.detachPart).toBe('function');
      });

      it('should have replacePart method', () => {
        expect(typeof facade.replacePart).toBe('function');
      });

      it('should have modifyPart method', () => {
        expect(typeof facade.modifyPart).toBe('function');
      });
    });

    describe('graph methods', () => {
      it('should have buildBodyGraph method', () => {
        expect(typeof facade.buildBodyGraph).toBe('function');
      });

      it('should have validateGraph method', () => {
        expect(typeof facade.validateGraph).toBe('function');
      });

      it('should have getGraphConstraints method', () => {
        expect(typeof facade.getGraphConstraints).toBe('function');
      });
    });

    describe('description methods', () => {
      it('should have generateDescription method', () => {
        expect(typeof facade.generateDescription).toBe('function');
      });

      it('should have getPartDescription method', () => {
        expect(typeof facade.getPartDescription).toBe('function');
      });
    });

    describe('bulk methods', () => {
      it('should have attachMultipleParts method', () => {
        expect(typeof facade.attachMultipleParts).toBe('function');
      });

      it('should have detachMultipleParts method', () => {
        expect(typeof facade.detachMultipleParts).toBe('function');
      });

      it('should have rebuildFromBlueprint method', () => {
        expect(typeof facade.rebuildFromBlueprint).toBe('function');
      });
    });
  });

  describe('method signatures and default implementations', () => {
    describe('getBodyParts', () => {
      it('should return a success response with data', async () => {
        const result = await facade.getBodyParts('actor1');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'getBodyParts');
      });

      it('should accept entityId and options parameters', async () => {
        const result = await facade.getBodyParts('actor1', { includeHidden: false });
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
      });
    });

    describe('getBodyGraph', () => {
      it('should return a success response with graph data', async () => {
        const result = await facade.getBodyGraph('actor1');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('nodes');
        expect(result.data).toHaveProperty('edges');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'getBodyGraph');
      });

      it('should accept entityId parameter', async () => {
        const result = await facade.getBodyGraph('actor1');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('nodes');
        expect(result.data).toHaveProperty('edges');
      });
    });

    describe('getPartByType', () => {
      it('should return a success response with parts data', async () => {
        const result = await facade.getPartByType('actor1', 'head');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'getPartByType');
      });

      it('should accept entityId and partType parameters', async () => {
        const result = await facade.getPartByType('actor1', 'head');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(Array.isArray(result.data)).toBe(true);
      });
    });

    describe('getConnectedParts', () => {
      it('should return a success response with connected parts data', async () => {
        const result = await facade.getConnectedParts('actor1', 'part1');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'getConnectedParts');
      });

      it('should accept entityId and partId parameters', async () => {
        const result = await facade.getConnectedParts('actor1', 'part1');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(Array.isArray(result.data)).toBe(true);
      });
    });

    describe('attachPart', () => {
      it('should return a success response with attachment data', async () => {
        const result = await facade.attachPart('actor1', 'part1', 'socket1');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'attachPart');
      });

      it('should accept entityId, partId, socketId, and options parameters', async () => {
        const result = await facade.attachPart('actor1', 'part1', 'socket1', { force: false });
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
      });
    });

    describe('detachPart', () => {
      it('should return a success response with detachment data', async () => {
        const result = await facade.detachPart('actor1', 'part1');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'detachPart');
      });

      it('should accept entityId, partId, and options parameters', async () => {
        const result = await facade.detachPart('actor1', 'part1', { cascadeDetach: false });
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
      });
    });

    describe('replacePart', () => {
      it('should return a success response with replacement data', async () => {
        const result = await facade.replacePart('actor1', 'oldPart', 'newPart');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'replacePart');
      });

      it('should accept entityId, oldPartId, newPartId, and options parameters', async () => {
        const result = await facade.replacePart('actor1', 'oldPart', 'newPart', { preserveConnections: true });
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
      });
    });

    describe('modifyPart', () => {
      it('should return a success response with modification data', async () => {
        const result = await facade.modifyPart('actor1', 'part1', { size: 'large' });
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'modifyPart');
      });

      it('should accept entityId, partId, modifications, and options parameters', async () => {
        const result = await facade.modifyPart('actor1', 'part1', { size: 'large' }, { validateGraph: true });
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
      });
    });

    describe('buildBodyGraph', () => {
      it('should return a success response with graph data', async () => {
        const blueprint = { type: 'test', parts: [] };
        const result = await facade.buildBodyGraph('actor1', blueprint);
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'buildBodyGraph');
      });

      it('should accept entityId, blueprint, and options parameters', async () => {
        const blueprint = { type: 'test', parts: [] };
        const result = await facade.buildBodyGraph('actor1', blueprint, { includeHidden: false });
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
      });
    });

    describe('validateGraph', () => {
      it('should return a validation response', async () => {
        const result = await facade.validateGraph('actor1');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('valid');
        expect(result.data).toHaveProperty('errors');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'validateGraph');
      });

      it('should accept entityId and options parameters', async () => {
        const result = await facade.validateGraph('actor1', { strictMode: true });
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('valid');
      });
    });

    describe('getGraphConstraints', () => {
      it('should return a success response with constraints data', async () => {
        const result = await facade.getGraphConstraints('actor1');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'getGraphConstraints');
      });

      it('should accept entityId parameter', async () => {
        const result = await facade.getGraphConstraints('actor1');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
      });
    });

    describe('generateDescription', () => {
      it('should return a success response with description data', async () => {
        const result = await facade.generateDescription('actor1');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('description');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'generateDescription');
      });

      it('should accept entityId and options parameters', async () => {
        const result = await facade.generateDescription('actor1', { verbosity: 'detailed' });
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('description');
      });
    });

    describe('getPartDescription', () => {
      it('should return a success response with part description data', async () => {
        const result = await facade.getPartDescription('actor1', 'part1');
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('description');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'getPartDescription');
      });

      it('should accept entityId, partId, and options parameters', async () => {
        const result = await facade.getPartDescription('actor1', 'part1', { includeDetails: true });
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('description');
      });
    });

    describe('attachMultipleParts', () => {
      it('should return a bulk response with attachment results', async () => {
        const parts = [{ partId: 'part1', parentPartId: 'socket1' }];
        const result = await facade.attachMultipleParts('actor1', parts);
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('processed');
        expect(result.data).toHaveProperty('successful');
        expect(result.data).toHaveProperty('failed');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'attachMultipleParts');
      });

      it('should accept entityId, attachments, and options parameters', async () => {
        const attachments = [
          { partId: 'part1', parentPartId: 'socket1' },
          { partId: 'part2', parentPartId: 'socket2' }
        ];
        const result = await facade.attachMultipleParts('actor1', attachments, { stopOnError: false });
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
      });
    });

    describe('detachMultipleParts', () => {
      it('should return a bulk response with detachment results', async () => {
        const partIds = ['part1', 'part2'];
        const result = await facade.detachMultipleParts('actor1', partIds);
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('processed');
        expect(result.data).toHaveProperty('successful');
        expect(result.data).toHaveProperty('failed');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'detachMultipleParts');
      });

      it('should accept entityId, partIds, and options parameters', async () => {
        const result = await facade.detachMultipleParts('actor1', ['part1', 'part2'], { cascadeDetach: false });
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
      });
    });

    describe('rebuildFromBlueprint', () => {
      it('should return a success response with rebuild data', async () => {
        const blueprint = { type: 'test', parts: [] };
        const result = await facade.rebuildFromBlueprint('actor1', blueprint);
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('operationType', 'rebuildFromBlueprint');
      });

      it('should accept entityId, blueprint, and options parameters', async () => {
        const blueprint = { type: 'test', parts: [] };
        const result = await facade.rebuildFromBlueprint('actor1', blueprint, { preserveCustomizations: true });
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
      });
    });
  });

  describe('inherited BaseFacade functionality', () => {
    it('should be an instance of BaseFacade', () => {
      // The facade inherits from BaseFacade
      const BaseFacade = require('../../../../src/shared/facades/BaseFacade.js').default;
      expect(facade).toBeInstanceOf(BaseFacade);
    });

    it('should have inherited functionality working through public methods', async () => {
      // Protected methods are used internally by public methods
      // Test that caching and event dispatching work through public methods
      const result = await facade.getBodyParts('actor1');
      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // The public methods use the protected inherited methods internally
      // We can't directly test protected methods, but we verify they work
      // by testing the public methods that use them
    });

    it('should handle cache operations through public methods', async () => {
      // First call should execute the operation
      const result1 = await facade.getBodyParts('actor1', { includeHidden: false });
      expect(result1).toHaveProperty('success', true);

      // Second call with same params would use cache (if implemented)
      const result2 = await facade.getBodyParts('actor1', { includeHidden: false });
      expect(result2).toHaveProperty('success', true);
    });

    it('should handle resilience patterns through public methods', async () => {
      // The executeWithResilience is used internally
      // Test that methods handle errors gracefully
      const result = await facade.attachPart('actor1', 'part1', 'socket1');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('metadata');
    });
  });

  describe('method parameter validation', () => {
    // The facade now has full implementations, no need to mock

    it('should handle default options parameter', async () => {
      await expect(facade.getBodyParts('actor1')).resolves.toBeDefined();
    });

    it('should handle undefined options gracefully', async () => {
      // undefined options should work fine (uses default)
      await expect(facade.getBodyParts('actor1', undefined)).resolves.toBeDefined();
      await expect(facade.getBodyParts('actor1')).resolves.toBeDefined();
      // Note: null is not the same as undefined and may cause issues
    });

    it('should work with complex options objects', async () => {
      const complexOptions = {
        includeHidden: false,
        maxDepth: 5,
        sortBy: 'name',
        pagination: { limit: 10, offset: 0 },
        filter: { type: 'limb', status: 'healthy' },
        metadata: { includeConnections: true }
      };

      await expect(facade.getBodyParts('actor1', complexOptions)).resolves.toBeDefined();
    });

    it('should handle array parameters correctly', async () => {
      const attachments = [
        { partId: 'part1', socketId: 'socket1' },
        { partId: 'part2', socketId: 'socket2' }
      ];
      await expect(facade.attachMultipleParts('actor1', attachments)).resolves.toBeDefined();
    });

    it('should handle object parameters for modifications', async () => {
      const modifications = {
        size: 'large',
        color: 'red',
        properties: { strength: 10, durability: 8 }
      };
      await expect(facade.modifyPart('actor1', 'part1', modifications)).resolves.toBeDefined();
    });

    it('should handle multiple required string parameters', async () => {
      await expect(facade.attachPart('actor1', 'part1', 'socket1')).resolves.toBeDefined();
    });
  });

  describe('response format consistency', () => {
    // The facade now has full implementations that return standardized responses

    it('should return standard query response format', async () => {
      const response = await facade.getBodyParts('actor1');

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('pagination');
      expect(response.pagination).toHaveProperty('total');
      expect(typeof response.success).toBe('boolean');
      expect(Array.isArray(response.data)).toBe(true);
      expect(typeof response.pagination.total).toBe('number');
    });

    it('should return standard graph response format', async () => {
      const response = await facade.getBodyGraph('actor1');
      
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('data');
      expect(response.data).toHaveProperty('nodes');
      expect(response.data).toHaveProperty('edges');
      expect(typeof response.success).toBe('boolean');
      expect(Array.isArray(response.data.nodes)).toBe(true);
      expect(Array.isArray(response.data.edges)).toBe(true);
    });

    it('should return standard modification response format', async () => {
      const response = await facade.attachPart('actor1', 'part1', 'socket1');
      
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('data');
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.data).toBe('object');
    });

    it('should return standard validation response format', async () => {
      const response = await facade.validateGraph('actor1');
      
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('data');
      expect(response.data).toHaveProperty('valid');
      expect(response.data).toHaveProperty('errors');
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.data.valid).toBe('boolean');
      expect(Array.isArray(response.data.errors)).toBe(true);
    });

    it('should return standard description response format', async () => {
      const response = await facade.generateDescription('actor1');
      
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('data');
      expect(response.data).toHaveProperty('description');
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.data.description).toBe('string');
    });
  });

  describe('graph-specific functionality', () => {
    // The facade has full implementations for graph operations

    it('should handle graph building with proper structure', async () => {
      const blueprint = { type: 'test', parts: [] };
      const response = await facade.buildBodyGraph('actor1', blueprint);

      expect(response.data.nodes).toBeDefined();
      expect(response.data.edges).toBeDefined();
      expect(Array.isArray(response.data.nodes)).toBe(true);
      expect(Array.isArray(response.data.edges)).toBe(true);
    });

    it('should handle graph validation with comprehensive results', async () => {
      const response = await facade.validateGraph('actor1');

      expect(response.data.valid).toBeDefined();
      expect(response.data.errors).toBeDefined();
      expect(typeof response.data.valid).toBe('boolean');
      expect(Array.isArray(response.data.errors)).toBe(true);
      // warnings may or may not be present depending on validation results
      if (response.data.warnings) {
        expect(Array.isArray(response.data.warnings)).toBe(true);
      }
    });
  });
});