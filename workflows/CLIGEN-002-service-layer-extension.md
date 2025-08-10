# CLIGEN-002: Service Layer Extension for Cliché Operations

## Summary

Extend the CharacterBuilderService with four new methods to support cliché operations: retrieval, existence checking, storage, and generation orchestration. This ticket integrates cliché functionality into the existing service layer while maintaining backward compatibility.

## Status

- **Type**: Implementation
- **Priority**: High
- **Complexity**: Medium
- **Estimated Time**: 5 hours
- **Dependencies**: CLIGEN-001 (Database Schema & Model)

## Objectives

### Primary Goals

1. **Add Cliché Methods** - Four new methods in CharacterBuilderService
2. **Maintain Compatibility** - No breaking changes to existing methods
3. **Implement Caching** - Optimize repeated queries
4. **Error Handling** - Comprehensive error management
5. **Transaction Support** - Atomic operations for data consistency
6. **Event Integration** - Dispatch events for cliché operations

### Success Criteria

- [ ] All four methods implemented and working
- [ ] Existing service functionality unchanged
- [ ] Caching reduces query time by 50%+
- [ ] Transaction rollback on failures
- [ ] Events dispatched for all operations
- [ ] 95% test coverage achieved
- [ ] Performance benchmarks met (<50ms for cached queries)

## Technical Specification

### 1. Service Layer Extension

#### File: `src/characterBuilder/services/CharacterBuilderService.js`

```javascript
/**
 * Extend existing CharacterBuilderService with cliché operations
 * Note: This shows only the new methods to be added
 */

import { Cliche } from '../models/cliche.js';
import { validateDependency, assertNonBlankString } from '../../utils/validationUtils.js';

export class CharacterBuilderService {
  // Existing private fields...
  #clicheCache = new Map(); // Add cache for clichés
  #clicheCacheTTL = 300000; // 5 minutes TTL
  
  /**
   * Get clichés for a thematic direction
   * @param {string} directionId - Thematic direction ID
   * @returns {Promise<Cliche|null>} Cliche data or null if not found
   */
  async getClichesByDirectionId(directionId) {
    assertNonBlankString(directionId, 'Direction ID is required');
    
    try {
      // Check cache first
      const cached = this.#getCachedCliches(directionId);
      if (cached) {
        this.#logger.debug(`Cache hit for clichés: ${directionId}`);
        return cached;
      }
      
      // Query database
      const rawData = await this.#storageService.getByIndex(
        'cliches',
        'directionId',
        directionId
      );
      
      if (!rawData) {
        this.#logger.info(`No clichés found for direction: ${directionId}`);
        return null;
      }
      
      // Create model instance
      const cliche = Cliche.fromRawData(rawData);
      
      // Cache the result
      this.#cacheCliches(directionId, cliche);
      
      // Dispatch event
      this.#eventBus.dispatch({
        type: 'CLICHES_RETRIEVED',
        payload: {
          directionId,
          clicheId: cliche.id,
          categoryCount: cliche.getCategoryStats()
        }
      });
      
      return cliche;
      
    } catch (error) {
      this.#logger.error(`Failed to get clichés for direction ${directionId}:`, error);
      
      this.#eventBus.dispatch({
        type: 'CLICHES_RETRIEVAL_FAILED',
        payload: { 
          directionId, 
          error: error.message 
        }
      });
      
      throw new Error(`Failed to retrieve clichés: ${error.message}`);
    }
  }
  
  /**
   * Check if clichés exist for a direction
   * @param {string} directionId - Thematic direction ID
   * @returns {Promise<boolean>} True if clichés exist
   */
  async hasClichesForDirection(directionId) {
    assertNonBlankString(directionId, 'Direction ID is required');
    
    try {
      // Check cache first
      if (this.#clicheCache.has(directionId)) {
        return true;
      }
      
      // Quick existence check using index
      const count = await this.#storageService.countByIndex(
        'cliches',
        'directionId',
        directionId
      );
      
      return count > 0;
      
    } catch (error) {
      this.#logger.error(`Failed to check clichés existence for ${directionId}:`, error);
      return false;
    }
  }
  
  /**
   * Store clichés for a direction
   * @param {Cliche|object} cliches - Cliche data to store
   * @returns {Promise<Cliche>} Stored cliche data
   */
  async storeCliches(cliches) {
    assertPresent(cliches, 'Clichés data is required');
    
    try {
      // Convert to Cliche instance if needed
      const clicheInstance = cliches instanceof Cliche 
        ? cliches 
        : new Cliche(cliches);
      
      // Validate against schema
      await this.#validateCliches(clicheInstance);
      
      // Check for existing clichés (enforce one-to-one)
      const existing = await this.hasClichesForDirection(clicheInstance.directionId);
      if (existing) {
        throw new Error(`Clichés already exist for direction ${clicheInstance.directionId}`);
      }
      
      // Start transaction for atomic operation
      const transaction = await this.#storageService.transaction(
        ['cliches', 'metadata'],
        'readwrite'
      );
      
      try {
        // Store clichés
        await transaction.objectStore('cliches').add(clicheInstance.toJSON());
        
        // Update metadata
        await transaction.objectStore('metadata').put({
          key: `last_cliche_generation`,
          value: {
            directionId: clicheInstance.directionId,
            timestamp: new Date().toISOString(),
            count: clicheInstance.getTotalCount()
          }
        });
        
        await transaction.complete();
        
        // Clear cache for this direction
        this.#invalidateClicheCache(clicheInstance.directionId);
        
        // Cache the new data
        this.#cacheCliches(clicheInstance.directionId, clicheInstance);
        
        // Dispatch success event
        this.#eventBus.dispatch({
          type: 'CLICHES_STORED',
          payload: {
            directionId: clicheInstance.directionId,
            conceptId: clicheInstance.conceptId,
            clicheId: clicheInstance.id,
            totalCount: clicheInstance.getTotalCount()
          }
        });
        
        this.#logger.info(`Stored clichés for direction ${clicheInstance.directionId}`);
        
        return clicheInstance;
        
      } catch (error) {
        // Transaction will auto-rollback on error
        await transaction.abort();
        throw error;
      }
      
    } catch (error) {
      this.#logger.error('Failed to store clichés:', error);
      
      this.#eventBus.dispatch({
        type: 'CLICHES_STORAGE_FAILED',
        payload: { 
          error: error.message,
          directionId: cliches.directionId 
        }
      });
      
      throw new Error(`Failed to store clichés: ${error.message}`);
    }
  }
  
  /**
   * Generate clichés for a thematic direction
   * @param {CharacterConcept} concept - Original character concept
   * @param {ThematicDirection} direction - Selected thematic direction
   * @returns {Promise<Cliche>} Generated and stored clichés
   */
  async generateClichesForDirection(concept, direction) {
    assertPresent(concept, 'Character concept is required');
    assertPresent(direction, 'Thematic direction is required');
    
    try {
      // Check if clichés already exist
      const existing = await this.getClichesByDirectionId(direction.id);
      if (existing) {
        this.#logger.info(`Clichés already exist for direction ${direction.id}`);
        return existing;
      }
      
      // Validate concept and direction relationship
      if (direction.conceptId !== concept.id) {
        throw new Error('Direction does not belong to the provided concept');
      }
      
      // Dispatch generation started event
      this.#eventBus.dispatch({
        type: 'CLICHES_GENERATION_STARTED',
        payload: {
          conceptId: concept.id,
          directionId: direction.id,
          directionTitle: direction.title
        }
      });
      
      // Generate clichés using ClicheGenerator (implemented in CLIGEN-003)
      const generator = this.#dependencyContainer.get('ClicheGenerator');
      const generatedData = await generator.generateCliches(
        concept.text,
        {
          title: direction.title,
          description: direction.description,
          coreTension: direction.coreTension
        }
      );
      
      // Create Cliche instance
      const cliche = new Cliche({
        directionId: direction.id,
        conceptId: concept.id,
        categories: generatedData.categories,
        tropesAndStereotypes: generatedData.tropesAndStereotypes,
        llmMetadata: generatedData.metadata
      });
      
      // Store the generated clichés
      const stored = await this.storeCliches(cliche);
      
      // Dispatch generation completed event
      this.#eventBus.dispatch({
        type: 'CLICHES_GENERATION_COMPLETED',
        payload: {
          conceptId: concept.id,
          directionId: direction.id,
          clicheId: stored.id,
          totalCount: stored.getTotalCount(),
          generationTime: generatedData.metadata.responseTime
        }
      });
      
      return stored;
      
    } catch (error) {
      this.#logger.error(`Failed to generate clichés for direction ${direction.id}:`, error);
      
      this.#eventBus.dispatch({
        type: 'CLICHES_GENERATION_FAILED',
        payload: {
          conceptId: concept.id,
          directionId: direction.id,
          error: error.message
        }
      });
      
      throw new Error(`Failed to generate clichés: ${error.message}`);
    }
  }
  
  // ============= Private Helper Methods =============
  
  /**
   * Get cached clichés
   * @private
   */
  #getCachedCliches(directionId) {
    const cached = this.#clicheCache.get(directionId);
    
    if (cached && cached.timestamp + this.#clicheCacheTTL > Date.now()) {
      return cached.data;
    }
    
    // Remove expired cache
    if (cached) {
      this.#clicheCache.delete(directionId);
    }
    
    return null;
  }
  
  /**
   * Cache clichés with TTL
   * @private
   */
  #cacheCliches(directionId, cliche) {
    this.#clicheCache.set(directionId, {
      data: cliche,
      timestamp: Date.now()
    });
    
    // Limit cache size to prevent memory issues
    if (this.#clicheCache.size > 50) {
      const firstKey = this.#clicheCache.keys().next().value;
      this.#clicheCache.delete(firstKey);
    }
  }
  
  /**
   * Invalidate cache for a direction
   * @private
   */
  #invalidateClicheCache(directionId) {
    this.#clicheCache.delete(directionId);
  }
  
  /**
   * Clear all cliché caches
   * @private
   */
  #clearClicheCache() {
    this.#clicheCache.clear();
  }
  
  /**
   * Validate clichés against schema
   * @private
   */
  async #validateCliches(cliche) {
    if (this.#schemaValidator) {
      const isValid = await this.#schemaValidator.validate(
        cliche.toJSON(),
        'clicheSchema'
      );
      
      if (!isValid) {
        const errors = this.#schemaValidator.getErrors();
        throw new ValidationError(`Invalid cliché data: ${errors.join(', ')}`);
      }
    }
  }
  
  // ============= Batch Operations =============
  
  /**
   * Get clichés for multiple directions
   * @param {string[]} directionIds - Array of direction IDs
   * @returns {Promise<Map<string, Cliche>>} Map of directionId to Cliche
   */
  async getClichesForDirections(directionIds) {
    assertPresent(directionIds, 'Direction IDs are required');
    
    const results = new Map();
    const uncached = [];
    
    // Check cache first
    for (const id of directionIds) {
      const cached = this.#getCachedCliches(id);
      if (cached) {
        results.set(id, cached);
      } else {
        uncached.push(id);
      }
    }
    
    // Batch fetch uncached
    if (uncached.length > 0) {
      try {
        const cliches = await this.#storageService.getMultipleByIndex(
          'cliches',
          'directionId',
          uncached
        );
        
        for (const rawData of cliches) {
          const cliche = Cliche.fromRawData(rawData);
          results.set(cliche.directionId, cliche);
          this.#cacheCliches(cliche.directionId, cliche);
        }
      } catch (error) {
        this.#logger.error('Batch fetch failed:', error);
      }
    }
    
    return results;
  }
  
  /**
   * Delete clichés for a direction
   * @param {string} directionId - Direction ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteClichesForDirection(directionId) {
    assertNonBlankString(directionId, 'Direction ID is required');
    
    try {
      const cliche = await this.getClichesByDirectionId(directionId);
      
      if (!cliche) {
        return false;
      }
      
      await this.#storageService.delete('cliches', cliche.id);
      
      this.#invalidateClicheCache(directionId);
      
      this.#eventBus.dispatch({
        type: 'CLICHES_DELETED',
        payload: { 
          directionId,
          clicheId: cliche.id 
        }
      });
      
      return true;
      
    } catch (error) {
      this.#logger.error(`Failed to delete clichés for ${directionId}:`, error);
      throw error;
    }
  }
}
```

### 2. Service Configuration Update

#### File: `src/characterBuilder/services/serviceConfiguration.js`

```javascript
/**
 * Update service configuration to include cliché dependencies
 */

export const serviceConfiguration = {
  // Existing configuration...
  
  characterBuilderService: {
    dependencies: [
      'storageService',
      'eventBus',
      'logger',
      'schemaValidator',
      'clicheGenerator' // Add new dependency
    ],
    singleton: true,
    lazy: false
  },
  
  // Add ClicheGenerator configuration (implemented in CLIGEN-003)
  clicheGenerator: {
    dependencies: [
      'llmService',
      'logger'
    ],
    singleton: true,
    lazy: true
  }
};
```

### 3. Storage Service Extension

#### File: `src/characterBuilder/storage/CharacterStorageService.js`

```javascript
/**
 * Add helper methods for cliché operations
 */

export class CharacterStorageService {
  // Existing methods...
  
  /**
   * Count records by index
   * @param {string} storeName - Store name
   * @param {string} indexName - Index name
   * @param {any} value - Index value
   * @returns {Promise<number>} Count
   */
  async countByIndex(storeName, indexName, value) {
    const db = await this.#getDatabase();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    
    const request = index.count(value);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get multiple records by index values
   * @param {string} storeName - Store name
   * @param {string} indexName - Index name
   * @param {any[]} values - Array of index values
   * @returns {Promise<any[]>} Array of records
   */
  async getMultipleByIndex(storeName, indexName, values) {
    const db = await this.#getDatabase();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    
    const results = [];
    
    for (const value of values) {
      const request = index.get(value);
      
      await new Promise((resolve, reject) => {
        request.onsuccess = () => {
          if (request.result) {
            results.push(request.result);
          }
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    }
    
    return results;
  }
  
  /**
   * Create a transaction for atomic operations
   * @param {string[]} storeNames - Store names
   * @param {string} mode - Transaction mode
   * @returns {Promise<IDBTransaction>} Transaction object
   */
  async transaction(storeNames, mode = 'readonly') {
    const db = await this.#getDatabase();
    const transaction = db.transaction(storeNames, mode);
    
    // Add helper methods
    transaction.complete = () => new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    
    transaction.abort = () => {
      transaction.abort();
      return Promise.resolve();
    };
    
    return transaction;
  }
}
```

## Implementation Tasks

### Phase 1: Core Method Implementation (2 hours)

1. **Implement getClichesByDirectionId**
   - [ ] Add method signature
   - [ ] Implement cache logic
   - [ ] Add database query
   - [ ] Event dispatching
   - [ ] Error handling

2. **Implement hasClichesForDirection**
   - [ ] Add method signature
   - [ ] Cache check
   - [ ] Database existence check
   - [ ] Error handling

3. **Implement storeCliches**
   - [ ] Add method signature
   - [ ] Validation logic
   - [ ] Transaction handling
   - [ ] Cache invalidation
   - [ ] Event dispatching

4. **Implement generateClichesForDirection**
   - [ ] Add method signature
   - [ ] Existence check
   - [ ] Generator integration
   - [ ] Storage orchestration
   - [ ] Event flow

### Phase 2: Cache Implementation (1 hour)

1. **Set up cache structure**
   - [ ] Add cache Map
   - [ ] Configure TTL
   - [ ] Size limits

2. **Implement cache methods**
   - [ ] getCachedCliches
   - [ ] cacheCliches
   - [ ] invalidateClicheCache
   - [ ] clearClicheCache

3. **Add cache management**
   - [ ] TTL expiration
   - [ ] Size limiting
   - [ ] Memory management

### Phase 3: Helper Methods (1 hour)

1. **Add batch operations**
   - [ ] getClichesForDirections
   - [ ] Batch caching

2. **Add delete operation**
   - [ ] deleteClichesForDirection
   - [ ] Cache cleanup

3. **Add validation helper**
   - [ ] Schema validation
   - [ ] Error formatting

### Phase 4: Storage Service Updates (1 hour)

1. **Add storage helpers**
   - [ ] countByIndex method
   - [ ] getMultipleByIndex method
   - [ ] transaction wrapper

2. **Test storage methods**
   - [ ] Unit tests
   - [ ] Integration tests

## Testing Requirements

### Unit Tests

#### File: `tests/unit/characterBuilder/services/characterBuilderServiceCliches.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CharacterBuilderService } from '../../../../src/characterBuilder/services/CharacterBuilderService.js';
import { Cliche } from '../../../../src/characterBuilder/models/cliche.js';

describe('CharacterBuilderService - Cliché Operations', () => {
  let service;
  let mockStorageService;
  let mockEventBus;
  let mockLogger;
  let mockGenerator;
  
  beforeEach(() => {
    mockStorageService = {
      getByIndex: jest.fn(),
      countByIndex: jest.fn(),
      add: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn()
    };
    
    mockEventBus = {
      dispatch: jest.fn()
    };
    
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn()
    };
    
    mockGenerator = {
      generateCliches: jest.fn()
    };
    
    service = new CharacterBuilderService({
      storageService: mockStorageService,
      eventBus: mockEventBus,
      logger: mockLogger,
      clicheGenerator: mockGenerator
    });
  });
  
  describe('getClichesByDirectionId', () => {
    it('should retrieve clichés from database', async () => {
      const mockData = {
        id: 'cliche-1',
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: { /* ... */ }
      };
      
      mockStorageService.getByIndex.mockResolvedValue(mockData);
      
      const result = await service.getClichesByDirectionId('dir-1');
      
      expect(result).toBeInstanceOf(Cliche);
      expect(result.directionId).toBe('dir-1');
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CLICHES_RETRIEVED'
        })
      );
    });
    
    it('should return cached clichés on second call', async () => {
      const mockData = { /* ... */ };
      mockStorageService.getByIndex.mockResolvedValue(mockData);
      
      // First call - hits database
      await service.getClichesByDirectionId('dir-1');
      expect(mockStorageService.getByIndex).toHaveBeenCalledTimes(1);
      
      // Second call - uses cache
      await service.getClichesByDirectionId('dir-1');
      expect(mockStorageService.getByIndex).toHaveBeenCalledTimes(1);
    });
    
    it('should return null for non-existent clichés', async () => {
      mockStorageService.getByIndex.mockResolvedValue(null);
      
      const result = await service.getClichesByDirectionId('dir-999');
      
      expect(result).toBeNull();
    });
    
    it('should handle database errors', async () => {
      mockStorageService.getByIndex.mockRejectedValue(new Error('DB Error'));
      
      await expect(
        service.getClichesByDirectionId('dir-1')
      ).rejects.toThrow('Failed to retrieve clichés');
      
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CLICHES_RETRIEVAL_FAILED'
        })
      );
    });
  });
  
  describe('hasClichesForDirection', () => {
    it('should return true when clichés exist', async () => {
      mockStorageService.countByIndex.mockResolvedValue(1);
      
      const result = await service.hasClichesForDirection('dir-1');
      
      expect(result).toBe(true);
    });
    
    it('should return false when no clichés exist', async () => {
      mockStorageService.countByIndex.mockResolvedValue(0);
      
      const result = await service.hasClichesForDirection('dir-1');
      
      expect(result).toBe(false);
    });
    
    it('should check cache first', async () => {
      // Populate cache
      const mockData = { /* ... */ };
      mockStorageService.getByIndex.mockResolvedValue(mockData);
      await service.getClichesByDirectionId('dir-1');
      
      // Check existence - should use cache
      const result = await service.hasClichesForDirection('dir-1');
      
      expect(result).toBe(true);
      expect(mockStorageService.countByIndex).not.toHaveBeenCalled();
    });
  });
  
  describe('storeCliches', () => {
    it('should store new clichés', async () => {
      const cliche = new Cliche({
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: { /* ... */ }
      });
      
      const mockTransaction = {
        objectStore: jest.fn(() => ({
          add: jest.fn()
        })),
        complete: jest.fn().mockResolvedValue(),
        abort: jest.fn()
      };
      
      mockStorageService.transaction.mockResolvedValue(mockTransaction);
      mockStorageService.countByIndex.mockResolvedValue(0);
      
      const result = await service.storeCliches(cliche);
      
      expect(result).toEqual(cliche);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CLICHES_STORED'
        })
      );
    });
    
    it('should prevent duplicate clichés', async () => {
      mockStorageService.countByIndex.mockResolvedValue(1);
      
      const cliche = new Cliche({ /* ... */ });
      
      await expect(
        service.storeCliches(cliche)
      ).rejects.toThrow('Clichés already exist');
    });
    
    it('should rollback on transaction failure', async () => {
      const mockTransaction = {
        objectStore: jest.fn(() => ({
          add: jest.fn().mockRejectedValue(new Error('DB Error'))
        })),
        abort: jest.fn()
      };
      
      mockStorageService.transaction.mockResolvedValue(mockTransaction);
      mockStorageService.countByIndex.mockResolvedValue(0);
      
      await expect(
        service.storeCliches({ /* ... */ })
      ).rejects.toThrow();
      
      expect(mockTransaction.abort).toHaveBeenCalled();
    });
  });
  
  describe('generateClichesForDirection', () => {
    it('should generate and store new clichés', async () => {
      const concept = { id: 'concept-1', text: 'A hero...' };
      const direction = { 
        id: 'dir-1', 
        conceptId: 'concept-1',
        title: 'The Chosen One'
      };
      
      mockStorageService.getByIndex.mockResolvedValue(null);
      mockGenerator.generateCliches.mockResolvedValue({
        categories: { /* ... */ },
        tropesAndStereotypes: [],
        metadata: { responseTime: 1000 }
      });
      
      const mockTransaction = {
        objectStore: jest.fn(() => ({
          add: jest.fn(),
          put: jest.fn()
        })),
        complete: jest.fn().mockResolvedValue()
      };
      
      mockStorageService.transaction.mockResolvedValue(mockTransaction);
      mockStorageService.countByIndex.mockResolvedValue(0);
      
      const result = await service.generateClichesForDirection(concept, direction);
      
      expect(result).toBeInstanceOf(Cliche);
      expect(mockGenerator.generateCliches).toHaveBeenCalled();
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CLICHES_GENERATION_COMPLETED'
        })
      );
    });
    
    it('should return existing clichés without regeneration', async () => {
      const existing = new Cliche({ /* ... */ });
      mockStorageService.getByIndex.mockResolvedValue(existing.toJSON());
      
      const result = await service.generateClichesForDirection(
        { id: 'concept-1' },
        { id: 'dir-1', conceptId: 'concept-1' }
      );
      
      expect(mockGenerator.generateCliches).not.toHaveBeenCalled();
    });
    
    it('should validate concept-direction relationship', async () => {
      mockStorageService.getByIndex.mockResolvedValue(null);
      
      await expect(
        service.generateClichesForDirection(
          { id: 'concept-1' },
          { id: 'dir-1', conceptId: 'concept-999' } // Wrong concept
        )
      ).rejects.toThrow('Direction does not belong');
    });
  });
  
  describe('Cache Management', () => {
    it('should expire cache after TTL', async () => {
      jest.useFakeTimers();
      
      const mockData = { /* ... */ };
      mockStorageService.getByIndex.mockResolvedValue(mockData);
      
      // First call
      await service.getClichesByDirectionId('dir-1');
      expect(mockStorageService.getByIndex).toHaveBeenCalledTimes(1);
      
      // Advance time past TTL
      jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes
      
      // Second call - cache expired
      await service.getClichesByDirectionId('dir-1');
      expect(mockStorageService.getByIndex).toHaveBeenCalledTimes(2);
      
      jest.useRealTimers();
    });
    
    it('should limit cache size', async () => {
      // Test cache size limiting logic
      for (let i = 0; i < 60; i++) {
        mockStorageService.getByIndex.mockResolvedValue({
          id: `cliche-${i}`,
          directionId: `dir-${i}`,
          categories: {}
        });
        
        await service.getClichesByDirectionId(`dir-${i}`);
      }
      
      // Cache should not exceed 50 entries
      // Implementation detail: oldest entries removed
    });
  });
});
```

## Error Handling

### Error Types

1. **ValidationError**
   - Invalid cliché data
   - Missing required fields
   - Schema validation failures

2. **DuplicateError**
   - Clichés already exist for direction
   - Unique constraint violation

3. **NotFoundError**
   - Direction not found
   - Concept not found

4. **GenerationError**
   - LLM service failure
   - Timeout during generation

5. **StorageError**
   - Database transaction failure
   - IndexedDB quota exceeded

## Performance Considerations

### Optimization Strategies

1. **Caching**
   - 5-minute TTL for active sessions
   - LRU eviction for cache size
   - Batch cache warming

2. **Batch Operations**
   - Multiple direction queries
   - Reduced database roundtrips
   - Parallel processing

3. **Transaction Management**
   - Atomic operations
   - Minimal lock time
   - Optimistic concurrency

## Dependencies

### Internal Dependencies
- Cliche model (CLIGEN-001)
- CharacterStorageService
- EventBus
- Logger
- SchemaValidator

### External Dependencies
- ClicheGenerator (CLIGEN-003)
- IndexedDB API

## Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Cache memory overflow | Low | Medium | Size limits, LRU eviction |
| Transaction deadlocks | Low | High | Timeout, retry logic |
| Backward compatibility | Low | High | Extensive testing |
| Performance regression | Medium | Medium | Benchmarking, profiling |

## Acceptance Criteria

- [ ] All four methods implemented
- [ ] Cache working with TTL
- [ ] Transaction rollback functional
- [ ] Events dispatched correctly
- [ ] 95% test coverage
- [ ] Performance benchmarks met
- [ ] No breaking changes
- [ ] Documentation complete

## Definition of Done

- [ ] Code implemented per specification
- [ ] Unit tests passing (95% coverage)
- [ ] Integration tests passing
- [ ] Code reviewed and approved
- [ ] Performance validated
- [ ] Documentation updated
- [ ] No regressions in existing functionality