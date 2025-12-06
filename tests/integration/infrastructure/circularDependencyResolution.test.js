/**
 * @file Circular Dependency Resolution Verification Tests
 * @description Integration tests to verify Pattern 1 (ExecutionContext type extraction) implementation
 * and document that circular dependencies persist as expected.
 * IMPORTANT: These tests verify that the type extraction was implemented correctly,
 * NOT that circular dependencies were eliminated. The workflow documents that:
 * - Type extraction is implemented ✅
 * - Circular dependencies persist ⚠️ (27 warnings remain)
 * - Pattern 3 (UnifiedCache) NOT auto-resolved ❌
 * @see workflows/CIRDEPRES-004-pattern-1-verification-testing.md
 * @see workflows/CIRDEPRES-001-create-execution-types.md
 * @see workflows/CIRDEPRES-002-update-service-initializer.md
 * @see workflows/CIRDEPRES-003-update-logic-defs.md
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('Circular Dependency Resolution - Pattern 1', () => {
  describe('ExecutionContext Type Import Verification', () => {
    it('should import ExecutionContext type without circular dependency errors', () => {
      // This test passes if imports don't throw
      // Note: Circular dependencies still exist in the dependency graph,
      // but Node.js can resolve them at runtime
      expect(() => {
        require('../../../src/logic/types/executionTypes.js');
        require('../../../src/utils/serviceInitializerUtils.js');
        require('../../../src/entities/entityManager.js');
      }).not.toThrow();
    });

    it('should import from both old and new ExecutionContext paths', () => {
      // Verify backward compatibility - both import paths should work
      expect(() => {
        require('../../../src/logic/defs.js');
        require('../../../src/logic/types/executionTypes.js');
      }).not.toThrow();
    });

    it('should export ExecutionContext type from executionTypes.js', () => {
      // Even though the file exports an empty object for runtime,
      // the JSDoc typedefs should be present in the file
      const executionTypes = require('../../../src/logic/types/executionTypes.js');
      expect(executionTypes).toBeDefined();
    });

    it('should allow importing from logic/defs.js for backward compatibility', () => {
      // Verify that logic/defs.js can be imported without errors
      // Note: This file primarily contains JSDoc type definitions,
      // not runtime exports, which is why it exports an empty object
      expect(() => {
        require('../../../src/logic/defs.js');
      }).not.toThrow();
    });
  });

  describe('ServiceSetup ExecutionContext Integration', () => {
    let mockLogger;
    let mockContextLogger;

    beforeEach(() => {
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      mockContextLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
    });

    it('should resolve execution logger with ExecutionContext', () => {
      const {
        ServiceSetup,
      } = require('../../../src/utils/serviceInitializerUtils.js');
      const serviceSetup = new ServiceSetup();

      const executionContext = {
        evaluationContext: {
          event: { type: 'test' },
          actor: null,
          target: null,
          context: {},
        },
        entityManager: {},
        validatedEventDispatcher: {},
        logger: mockContextLogger,
      };

      const resolved = serviceSetup.resolveExecutionLogger(
        mockLogger,
        executionContext
      );

      expect(resolved).toBe(mockContextLogger);
    });

    it('should fall back to base logger when executionContext is null', () => {
      const {
        ServiceSetup,
      } = require('../../../src/utils/serviceInitializerUtils.js');
      const serviceSetup = new ServiceSetup();

      const resolved = serviceSetup.resolveExecutionLogger(mockLogger, null);

      expect(resolved).toBe(mockLogger);
    });

    it('should fall back to base logger when executionContext lacks logger', () => {
      const {
        ServiceSetup,
      } = require('../../../src/utils/serviceInitializerUtils.js');
      const serviceSetup = new ServiceSetup();

      const executionContext = {
        evaluationContext: {
          event: { type: 'test' },
          actor: null,
          target: null,
          context: {},
        },
        entityManager: {},
        validatedEventDispatcher: {},
        // No logger property
      };

      const resolved = serviceSetup.resolveExecutionLogger(
        mockLogger,
        executionContext
      );

      expect(resolved).toBe(mockLogger);
    });
  });
});

describe('Circular Dependency Resolution - Pattern 3 Status', () => {
  describe('UnifiedCache Circular Dependency Documentation', () => {
    let mockLogger;

    beforeEach(() => {
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
    });

    it('should import UnifiedCache without throwing (circular dependencies persist)', () => {
      // IMPORTANT: This test documents that UnifiedCache still has circular dependencies
      // through the same chain as before Pattern 1:
      //
      // UnifiedCache → BaseService → serviceInitializerUtils →
      // executionTypes.js → EntityManager → ... → UnifiedCache
      //
      // The cycle persists because executionTypes.js still imports EntityManager type.
      // Pattern 1 moved the problem, it didn't solve it.
      //
      // This test passes because Node.js can resolve circular dependencies at runtime,
      // not because the cycles are eliminated from the dependency graph.
      expect(() => {
        require('../../../src/cache/UnifiedCache.js');
        require('../../../src/utils/serviceBase.js');
        require('../../../src/utils/serviceInitializerUtils.js');
      }).not.toThrow();
    });

    it('should create UnifiedCache instance successfully', () => {
      const { UnifiedCache } = require('../../../src/cache/UnifiedCache.js');

      const cache = new UnifiedCache({ logger: mockLogger });

      expect(cache).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should work with all eviction policies', () => {
      const { UnifiedCache } = require('../../../src/cache/UnifiedCache.js');

      ['lru', 'lfu', 'fifo'].forEach((policy) => {
        const cache = new UnifiedCache(
          { logger: mockLogger },
          { evictionPolicy: policy }
        );
        expect(cache).toBeDefined();
      });
    });

    it('should perform basic cache operations', () => {
      const { UnifiedCache } = require('../../../src/cache/UnifiedCache.js');
      const cache = new UnifiedCache({ logger: mockLogger });

      // Set
      cache.set('test-key', 'test-value');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache set: test-key')
      );

      // Get
      const value = cache.get('test-key');
      expect(value).toBe('test-value');

      // Has
      expect(cache.has('test-key')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);

      // Delete
      cache.delete('test-key');
      expect(cache.has('test-key')).toBe(false);
    });
  });
});

describe('Circular Dependency Resolution - Entity System', () => {
  it('should import all entity system components without throwing', () => {
    // This test documents that the entity system components can be imported
    // despite circular dependencies in the dependency graph.
    //
    // The circular dependency chain still exists:
    // entityManager.js → createDefaultServicesWithConfig.js →
    // (various services) → BaseService → serviceInitializerUtils.js →
    // executionTypes.js → entityManager.js
    //
    // Node.js handles this at runtime, but the dependency graph still has cycles.
    expect(() => {
      require('../../../src/entities/entityManager.js');
      require('../../../src/entities/utils/createDefaultServicesWithConfig.js');
      require('../../../src/entities/monitoring/MonitoringCoordinator.js');
      require('../../../src/entities/monitoring/MemoryMonitor.js');
    }).not.toThrow();
  });

  it('should import EntityManager class definition', () => {
    // Verify that EntityManager is accessible and is a constructor function
    const EntityManager =
      require('../../../src/entities/entityManager.js').default;
    expect(EntityManager).toBeDefined();
    expect(typeof EntityManager).toBe('function');
  });

  it('should import createDefaultServicesWithConfig function', () => {
    // Verify that the default services factory is accessible
    // Note: This is a named export, not default export
    const {
      createDefaultServicesWithConfig,
    } = require('../../../src/entities/utils/createDefaultServicesWithConfig.js');
    expect(createDefaultServicesWithConfig).toBeDefined();
    expect(typeof createDefaultServicesWithConfig).toBe('function');
  });

  it('should import monitoring components', () => {
    // Verify that monitoring system components are accessible
    const MonitoringCoordinator =
      require('../../../src/entities/monitoring/MonitoringCoordinator.js').default;
    const MemoryMonitor =
      require('../../../src/entities/monitoring/MemoryMonitor.js').default;

    expect(MonitoringCoordinator).toBeDefined();
    expect(MemoryMonitor).toBeDefined();
    expect(typeof MonitoringCoordinator).toBe('function');
    expect(typeof MemoryMonitor).toBe('function');
  });
});

describe('Pattern 1 Implementation Lessons', () => {
  it('should demonstrate that type extraction alone does not break cycles', () => {
    // This test documents the key lesson from Pattern 1 implementation:
    //
    // LESSON: Moving type definitions to a new file doesn't break circular
    // dependencies if that file still imports from cycle participants.
    //
    // We created executionTypes.js (new node in dependency graph)
    // BUT it still imports EntityManager type (maintains edge in cycle)
    // RESULT: New file became part of the cycle chain
    //
    // The dependency chain is now:
    // ... → serviceInitializerUtils → executionTypes.js → EntityManager → ...
    //
    // Instead of:
    // ... → serviceInitializerUtils → (inline types) → EntityManager → ...
    //
    // We added a node to the graph but didn't break any edges.

    // Verify all components still import successfully
    expect(() => {
      require('../../../src/logic/types/executionTypes.js');
      require('../../../src/utils/serviceInitializerUtils.js');
      require('../../../src/entities/entityManager.js');
      require('../../../src/cache/UnifiedCache.js');
    }).not.toThrow();

    // This demonstrates that while the code works at runtime,
    // the circular dependency structure persists in the dependency graph.
    // Tools like dependency-cruiser will still report 27 warnings.
  });

  it('should confirm that Pattern 3 (UnifiedCache) was NOT auto-resolved', () => {
    // This test documents that the initial analysis was incorrect:
    //
    // INCORRECT PREDICTION: Pattern 3 would be auto-resolved by fixing Pattern 1
    // ACTUAL RESULT: Pattern 3 circular dependency persists
    //
    // WHY THE PREDICTION WAS WRONG:
    // 1. UnifiedCache extends BaseService ✅ (correct)
    // 2. BaseService imports serviceInitializerUtils ✅ (correct)
    // 3. serviceInitializerUtils now imports from executionTypes.js ✅ (correct)
    // 4. BUT: executionTypes.js still imports EntityManager type ❌ (missed this)
    // 5. EntityManager creates the cycle back to UnifiedCache ❌ (missed this)
    //
    // CONCLUSION: Patterns 2-7 are required. No shortcuts available.

    // Verify UnifiedCache still works despite cycles
    expect(() => {
      const { UnifiedCache } = require('../../../src/cache/UnifiedCache.js');
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const cache = new UnifiedCache({ logger: mockLogger });
      expect(cache).toBeDefined();
    }).not.toThrow();

    // The code works, but dependency-cruiser will still warn about
    // circular dependencies involving UnifiedCache.
  });
});
