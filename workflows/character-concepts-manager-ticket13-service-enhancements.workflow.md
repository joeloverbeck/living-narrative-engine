# Ticket 13: Service Layer Enhancements

## Overview

Add the `getConceptsWithDirectionCounts` method to CharacterBuilderService if needed, ensure proper event dispatching for all operations, and verify cascade deletion support is working correctly.

## Dependencies

- Existing CharacterBuilderService implementation
- IndexedDB database schema with cascade deletion

## Implementation Details

### 1. Add getConceptsWithDirectionCounts Method

In `src/characterBuilder/characterBuilderService.js`, add the new method:

```javascript
/**
 * Get all character concepts with their associated direction counts
 * @returns {Promise<Array<{concept: CharacterConcept, directionCount: number}>>}
 */
async getConceptsWithDirectionCounts() {
    this.#logger.info('Getting concepts with direction counts');

    try {
        // Get all concepts
        const concepts = await this.getAllCharacterConcepts();

        // Create array to store results
        const conceptsWithCounts = [];

        // Get direction counts for each concept
        for (const concept of concepts) {
            try {
                const directions = await this.getThematicDirectionsByConceptId(concept.id);

                conceptsWithCounts.push({
                    concept,
                    directionCount: directions.length
                });

            } catch (error) {
                // Log error but don't fail the entire operation
                this.#logger.error(
                    `Failed to get directions for concept ${concept.id}`,
                    error
                );

                // Add concept with 0 directions on error
                conceptsWithCounts.push({
                    concept,
                    directionCount: 0
                });
            }
        }

        this.#logger.info(`Retrieved ${conceptsWithCounts.length} concepts with counts`);

        return conceptsWithCounts;

    } catch (error) {
        this.#logger.error('Failed to get concepts with direction counts', error);
        throw new Error('Failed to retrieve character concepts with direction counts');
    }
}
```

### 2. Add Optimized Batch Loading

For better performance with many concepts, add a batch loading method:

```javascript
/**
 * Get all concepts with direction counts using optimized batch loading
 * @returns {Promise<Array<{concept: CharacterConcept, directionCount: number}>>}
 */
async getConceptsWithDirectionCountsOptimized() {
    this.#logger.info('Getting concepts with direction counts (optimized)');

    try {
        const db = await this.#openDatabase();
        const transaction = db.transaction(
            [STORE_NAMES.CONCEPTS, STORE_NAMES.DIRECTIONS],
            'readonly'
        );

        const conceptStore = transaction.objectStore(STORE_NAMES.CONCEPTS);
        const directionStore = transaction.objectStore(STORE_NAMES.DIRECTIONS);

        // Get all concepts
        const concepts = await this.#promisifyRequest(conceptStore.getAll());

        // Create a map to store direction counts
        const directionCounts = new Map();

        // Get all directions and count by concept
        const directions = await this.#promisifyRequest(directionStore.getAll());

        // Count directions per concept
        directions.forEach(direction => {
            const count = directionCounts.get(direction.conceptId) || 0;
            directionCounts.set(direction.conceptId, count + 1);
        });

        // Combine concepts with counts
        const conceptsWithCounts = concepts.map(concept => ({
            concept,
            directionCount: directionCounts.get(concept.id) || 0
        }));

        this.#logger.info(
            `Retrieved ${conceptsWithCounts.length} concepts with counts (optimized)`
        );

        return conceptsWithCounts;

    } catch (error) {
        this.#logger.error('Failed to get concepts with direction counts', error);
        throw new Error('Failed to retrieve character concepts with direction counts');
    }
}
```

### 3. Ensure Event Dispatching

Verify and enhance event dispatching in all CRUD methods:

```javascript
/**
 * Create a new character concept
 * @param {string} conceptText
 * @returns {Promise<CharacterConcept>}
 */
async createCharacterConcept(conceptText) {
    // ... validation ...

    try {
        // ... create concept ...

        // Dispatch event
        this.#eventBus.dispatch({
            type: CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED,
            payload: {
                concept: newConcept,
                source: 'CharacterBuilderService'
            }
        });

        this.#logger.info('Character concept created', { id: newConcept.id });
        return newConcept;

    } catch (error) {
        // ... error handling ...
    }
}

/**
 * Update an existing character concept
 * @param {string} conceptId
 * @param {string} newText
 * @returns {Promise<CharacterConcept>}
 */
async updateCharacterConcept(conceptId, newText) {
    // ... validation ...

    try {
        // ... update concept ...

        // Dispatch event
        this.#eventBus.dispatch({
            type: CHARACTER_BUILDER_EVENTS.CONCEPT_UPDATED,
            payload: {
                concept: updatedConcept,
                previousText: existingConcept.text,
                source: 'CharacterBuilderService'
            }
        });

        this.#logger.info('Character concept updated', { id: conceptId });
        return updatedConcept;

    } catch (error) {
        // ... error handling ...
    }
}

/**
 * Delete a character concept and its thematic directions
 * @param {string} conceptId
 * @returns {Promise<void>}
 */
async deleteCharacterConcept(conceptId) {
    // ... validation ...

    try {
        // Count directions before deletion for event
        const directions = await this.getThematicDirectionsByConceptId(conceptId);
        const directionCount = directions.length;

        // ... delete concept and cascade ...

        // Dispatch event with cascade info
        this.#eventBus.dispatch({
            type: CHARACTER_BUILDER_EVENTS.CONCEPT_DELETED,
            payload: {
                conceptId,
                cascadedDirections: directionCount,
                source: 'CharacterBuilderService'
            }
        });

        this.#logger.info('Character concept deleted', {
            id: conceptId,
            cascadedDirections: directionCount
        });

    } catch (error) {
        // ... error handling ...
    }
}
```

### 4. Verify and Enhance Cascade Deletion

Ensure cascade deletion is properly implemented:

```javascript
/**
 * Delete concept with proper cascade deletion
 * @private
 * @param {string} conceptId
 * @returns {Promise<number>} Number of cascaded deletions
 */
async #deleteConceptWithCascade(conceptId) {
    const db = await this.#openDatabase();
    const transaction = db.transaction(
        [STORE_NAMES.CONCEPTS, STORE_NAMES.DIRECTIONS],
        'readwrite'
    );

    const conceptStore = transaction.objectStore(STORE_NAMES.CONCEPTS);
    const directionStore = transaction.objectStore(STORE_NAMES.DIRECTIONS);

    // First, delete all associated thematic directions
    const directionsIndex = directionStore.index('conceptId');
    const directionsRequest = directionsIndex.getAllKeys(conceptId);

    const directionKeys = await this.#promisifyRequest(directionsRequest);
    let deletedCount = 0;

    // Delete each direction
    for (const key of directionKeys) {
        await this.#promisifyRequest(directionStore.delete(key));
        deletedCount++;
    }

    // Then delete the concept
    await this.#promisifyRequest(conceptStore.delete(conceptId));

    // Ensure transaction completes
    await this.#promisifyRequest(transaction.complete);

    this.#logger.info(`Cascade deleted ${deletedCount} directions for concept ${conceptId}`);

    return deletedCount;
}
```

### 5. Add Batch Operations Support

Add methods for batch operations (future enhancement):

```javascript
/**
 * Create multiple character concepts in batch
 * @param {Array<string>} conceptTexts
 * @returns {Promise<Array<CharacterConcept>>}
 */
async createCharacterConceptsBatch(conceptTexts) {
    this.#logger.info(`Creating ${conceptTexts.length} concepts in batch`);

    if (!Array.isArray(conceptTexts) || conceptTexts.length === 0) {
        throw new Error('Concept texts must be a non-empty array');
    }

    const db = await this.#openDatabase();
    const transaction = db.transaction([STORE_NAMES.CONCEPTS], 'readwrite');
    const store = transaction.objectStore(STORE_NAMES.CONCEPTS);

    const createdConcepts = [];
    const errors = [];

    for (const [index, text] of conceptTexts.entries()) {
        try {
            // Validate each concept
            assertNonBlankString(text, `Concept text at index ${index}`);

            const newConcept = {
                id: uuidv4(),
                text: text.trim(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await this.#promisifyRequest(store.add(newConcept));
            createdConcepts.push(newConcept);

        } catch (error) {
            errors.push({ index, text, error: error.message });
        }
    }

    await this.#promisifyRequest(transaction.complete);

    // Dispatch batch event
    if (createdConcepts.length > 0) {
        this.#eventBus.dispatch({
            type: CHARACTER_BUILDER_EVENTS.CONCEPTS_CREATED_BATCH,
            payload: {
                concepts: createdConcepts,
                errors,
                source: 'CharacterBuilderService'
            }
        });
    }

    if (errors.length > 0) {
        this.#logger.warn(`Batch creation completed with ${errors.length} errors`, errors);
    }

    return createdConcepts;
}

/**
 * Delete multiple character concepts in batch
 * @param {Array<string>} conceptIds
 * @returns {Promise<{deleted: number, cascaded: number, errors: Array}>}
 */
async deleteCharacterConceptsBatch(conceptIds) {
    this.#logger.info(`Deleting ${conceptIds.length} concepts in batch`);

    if (!Array.isArray(conceptIds) || conceptIds.length === 0) {
        throw new Error('Concept IDs must be a non-empty array');
    }

    let totalDeleted = 0;
    let totalCascaded = 0;
    const errors = [];

    for (const conceptId of conceptIds) {
        try {
            const cascaded = await this.#deleteConceptWithCascade(conceptId);
            totalDeleted++;
            totalCascaded += cascaded;

        } catch (error) {
            errors.push({ conceptId, error: error.message });
        }
    }

    // Dispatch batch delete event
    this.#eventBus.dispatch({
        type: CHARACTER_BUILDER_EVENTS.CONCEPTS_DELETED_BATCH,
        payload: {
            deletedCount: totalDeleted,
            cascadedCount: totalCascaded,
            errors,
            source: 'CharacterBuilderService'
        }
    });

    return {
        deleted: totalDeleted,
        cascaded: totalCascaded,
        errors
    };
}
```

### 6. Add Transaction Retry Logic

Implement retry logic for database operations:

```javascript
/**
 * Execute database operation with retry logic
 * @private
 * @param {Function} operation
 * @param {number} maxRetries
 * @returns {Promise<any>}
 */
async #executeWithRetry(operation, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            if (attempt < maxRetries) {
                this.#logger.warn(
                    `Database operation failed, retrying (${attempt}/${maxRetries})`,
                    error
                );

                // Wait before retry with exponential backoff
                await new Promise(resolve =>
                    setTimeout(resolve, Math.pow(2, attempt) * 100)
                );
            }
        }
    }

    throw lastError;
}

// Use in methods like:
async createCharacterConcept(conceptText) {
    return this.#executeWithRetry(async () => {
        // ... existing create logic ...
    });
}
```

### 7. Add Service Health Check

Add a method to verify service health:

```javascript
/**
 * Check if the service is healthy and database is accessible
 * @returns {Promise<{healthy: boolean, details: Object}>}
 */
async checkHealth() {
    const health = {
        healthy: true,
        database: false,
        eventBus: false,
        storage: false,
        timestamp: new Date().toISOString()
    };

    try {
        // Check database
        const db = await this.#openDatabase();
        health.database = true;

        // Check if we can read from stores
        const transaction = db.transaction([STORE_NAMES.CONCEPTS], 'readonly');
        const store = transaction.objectStore(STORE_NAMES.CONCEPTS);
        await this.#promisifyRequest(store.count());

        // Check event bus
        health.eventBus = !!this.#eventBus;

        // Check storage
        health.storage = !!this.#storageProvider;

    } catch (error) {
        health.healthy = false;
        health.error = error.message;
        this.#logger.error('Health check failed', error);
    }

    return health;
}
```

### 8. Update Event Constants

Add new event types to `characterBuilderEvents.js`:

```javascript
export const CHARACTER_BUILDER_EVENTS = {
  // Existing events
  CONCEPT_CREATED: 'character-builder:concept-created',
  CONCEPT_UPDATED: 'character-builder:concept-updated',
  CONCEPT_DELETED: 'character-builder:concept-deleted',

  // Batch events
  CONCEPTS_CREATED_BATCH: 'character-builder:concepts-created-batch',
  CONCEPTS_DELETED_BATCH: 'character-builder:concepts-deleted-batch',

  // Thematic directions
  DIRECTIONS_GENERATED: 'character-builder:directions-generated',
  DIRECTION_CREATED: 'character-builder:direction-created',
  DIRECTION_UPDATED: 'character-builder:direction-updated',
  DIRECTION_DELETED: 'character-builder:direction-deleted',

  // Service events
  SERVICE_INITIALIZED: 'character-builder:service-initialized',
  SERVICE_ERROR: 'character-builder:service-error',
  SERVICE_HEALTH_CHECK: 'character-builder:service-health-check',
};
```

### 9. Add Migration Support

Add database migration support for future schema changes:

```javascript
/**
 * Handle database upgrades
 * @private
 * @param {IDBDatabase} db
 * @param {number} oldVersion
 * @param {number} newVersion
 */
#handleDatabaseUpgrade(db, oldVersion, newVersion) {
    this.#logger.info(`Upgrading database from v${oldVersion} to v${newVersion}`);

    // Version 1: Initial schema
    if (oldVersion < 1) {
        this.#createInitialSchema(db);
    }

    // Version 2: Add cascade deletion support (example)
    if (oldVersion < 2) {
        this.#addCascadeDeletionSupport(db);
    }

    // Future migrations...
}

/**
 * Add cascade deletion support
 * @private
 * @param {IDBDatabase} db
 */
#addCascadeDeletionSupport(db) {
    // Ensure directions have conceptId index
    if (db.objectStoreNames.contains(STORE_NAMES.DIRECTIONS)) {
        const directionStore = db.objectStore(STORE_NAMES.DIRECTIONS);

        if (!directionStore.indexNames.contains('conceptId')) {
            directionStore.createIndex('conceptId', 'conceptId', { unique: false });
            this.#logger.info('Added conceptId index for cascade deletion');
        }
    }
}
```

### 10. Add Performance Monitoring

Add basic performance monitoring:

```javascript
/**
 * Get service performance metrics
 * @returns {Object}
 */
getPerformanceMetrics() {
    return {
        operationCounts: this.#operationCounts,
        averageResponseTimes: this.#calculateAverageResponseTimes(),
        cacheHitRate: this.#calculateCacheHitRate(),
        errorRate: this.#calculateErrorRate()
    };
}

// Track operations
#trackOperation(operationName, duration, success = true) {
    if (!this.#operationCounts[operationName]) {
        this.#operationCounts[operationName] = {
            count: 0,
            totalDuration: 0,
            errors: 0
        };
    }

    const op = this.#operationCounts[operationName];
    op.count++;
    op.totalDuration += duration;
    if (!success) op.errors++;
}

// Use in methods:
async createCharacterConcept(conceptText) {
    const startTime = performance.now();
    let success = true;

    try {
        // ... existing logic ...
        return result;
    } catch (error) {
        success = false;
        throw error;
    } finally {
        const duration = performance.now() - startTime;
        this.#trackOperation('createCharacterConcept', duration, success);
    }
}
```

## Acceptance Criteria

1. ✅ `getConceptsWithDirectionCounts` method implemented
2. ✅ Optimized batch loading version available
3. ✅ All CRUD operations dispatch proper events
4. ✅ Events include relevant payload data
5. ✅ Cascade deletion verified and working
6. ✅ Batch operations supported
7. ✅ Retry logic implemented for resilience
8. ✅ Health check method available
9. ✅ Database migration support added
10. ✅ Performance monitoring implemented

## Testing Requirements

1. Test `getConceptsWithDirectionCounts` with various data sets
2. Test cascade deletion removes all directions
3. Test event dispatching for all operations
4. Test batch operations with partial failures
5. Test retry logic with simulated failures
6. Test health check in various states
7. Test database migration scenarios
8. Verify performance with large datasets

## Notes

- Consider implementing caching for frequently accessed data
- Monitor IndexedDB storage limits
- Test with concurrent operations
- Consider implementing data export/import functionality
- Add telemetry for usage patterns
