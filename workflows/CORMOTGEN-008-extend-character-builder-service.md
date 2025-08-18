# CORMOTGEN-008: Extend CharacterBuilderService with Motivation APIs

## Ticket ID

CORMOTGEN-008

## Title

Add Core Motivations service methods to CharacterBuilderService

## Status

TODO

## Priority

HIGH

## Estimated Effort

3-4 hours

## Dependencies

- CORMOTGEN-006 (CoreMotivation model)
- CORMOTGEN-007 (CharacterDatabase methods)

## Related Specs

- specs/core-motivations-generator.spec.md (Section 5.1)
- Current implementation: src/characterBuilder/services/characterBuilderService.js
- Pattern: Follow existing cliché methods

## Description

Extend the CharacterBuilderService class with high-level methods for managing Core Motivations. These methods will orchestrate between the database, generation service, and other components.

## Technical Requirements

### Methods to Add to CharacterBuilderService

**File**: `src/characterBuilder/services/characterBuilderService.js`

Add these methods to the existing CharacterBuilderService class:

```javascript
/**
 * Generate new core motivations for a direction
 * @param {string} conceptId - Character concept ID
 * @param {string} directionId - Thematic direction ID
 * @param {Array} cliches - Associated clichés for context
 * @returns {Promise<Array>} Generated motivation objects
 */
async generateCoreMotivationsForDirection(conceptId, directionId, cliches) {
    assertNonBlankString(conceptId, 'Concept ID is required');
    assertNonBlankString(directionId, 'Direction ID is required');
    assertPresent(cliches, 'Clichés are required for generation');

    try {
        this.#logger.info(
            `Generating core motivations for direction ${directionId}`
        );

        // Get the concept
        const concept = await this.getCharacterConceptById(conceptId);
        if (!concept) {
            throw new EntityNotFoundError(`Concept ${conceptId} not found`);
        }

        // Get the direction
        const direction = await this.getThematicDirectionById(directionId);
        if (!direction) {
            throw new EntityNotFoundError(`Direction ${directionId} not found`);
        }

        // Verify direction belongs to concept
        if (direction.conceptId !== conceptId) {
            throw new ValidationError(
                'Direction does not belong to the specified concept'
            );
        }

        // Verify clichés exist
        if (!Array.isArray(cliches) || cliches.length === 0) {
            throw new ValidationError(
                'Cannot generate motivations without clichés context'
            );
        }

        // Dispatch generation started event
        this.#eventBus.dispatch({
            type: 'CORE_MOTIVATIONS_GENERATION_STARTED',
            payload: {
                conceptId,
                directionId,
                directionTitle: direction.title,
                timestamp: new Date().toISOString()
            }
        });

        const startTime = Date.now();

        try {
            // Call the Core Motivations Generator service
            const generator = this.#container.resolve(tokens.ICoreMotivationsGenerator);
            const generatedMotivations = await generator.generate({
                concept,
                direction,
                cliches
            });

            // Create CoreMotivation instances
            const motivations = generatedMotivations.map(rawMotivation =>
                CoreMotivation.fromLLMResponse({
                    directionId,
                    conceptId,
                    rawMotivation,
                    llmMetadata: {
                        model: generator.getLastModelUsed(),
                        temperature: 0.8,
                        generationTime: Date.now() - startTime
                    }
                })
            );

            // Validate all motivations
            for (const motivation of motivations) {
                const validation = motivation.validate();
                if (!validation.valid) {
                    this.#logger.warn(
                        `Motivation validation issues: ${validation.errors.join(', ')}`
                    );
                }
            }

            this.#logger.info(
                `Generated ${motivations.length} core motivations`
            );

            return motivations;

        } catch (error) {
            // Dispatch generation failed event
            this.#eventBus.dispatch({
                type: 'CORE_MOTIVATIONS_GENERATION_FAILED',
                payload: {
                    conceptId,
                    directionId,
                    error: error.message,
                    errorCode: error.code || 'GENERATION_ERROR'
                }
            });

            throw error;
        }

    } catch (error) {
        this.#logger.error('Failed to generate core motivations:', error);
        throw error;
    }
}

/**
 * Retrieve all motivations for a direction
 * @param {string} directionId - Direction ID
 * @returns {Promise<Array>} Array of motivation objects
 */
async getCoreMotivationsByDirectionId(directionId) {
    assertNonBlankString(directionId, 'Direction ID is required');

    try {
        // Check cache first
        const cacheKey = `motivations_${directionId}`;
        const cached = this.#cache?.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < 600000) { // 10 min cache
            this.#logger.info('Returning cached core motivations');

            this.#eventBus.dispatch({
                type: 'CORE_MOTIVATIONS_RETRIEVED',
                payload: {
                    directionId,
                    count: cached.data.length,
                    source: 'cache'
                }
            });

            return cached.data;
        }

        // Fetch from database
        const motivations = await this.#database.getCoreMotivationsByDirectionId(
            directionId
        );

        // Convert to model instances
        const motivationModels = motivations.map(data =>
            CoreMotivation.fromStorage(data)
        );

        // Update cache
        if (this.#cache) {
            this.#cache.set(cacheKey, {
                data: motivationModels,
                timestamp: Date.now()
            });
        }

        return motivationModels;

    } catch (error) {
        this.#logger.error(
            `Failed to get core motivations for direction ${directionId}:`,
            error
        );
        throw error;
    }
}

/**
 * Check if direction has motivations
 * @param {string} directionId - Direction ID
 * @returns {Promise<boolean>} True if motivations exist
 */
async hasCoreMotivationsForDirection(directionId) {
    assertNonBlankString(directionId, 'Direction ID is required');

    try {
        return await this.#database.hasCoreMotivationsForDirection(directionId);
    } catch (error) {
        this.#logger.error(
            `Failed to check core motivations for direction ${directionId}:`,
            error
        );
        return false;
    }
}

/**
 * Save core motivations (accumulative)
 * @param {string} directionId - Direction ID
 * @param {Array} motivations - Array of motivation objects
 * @returns {Promise<Array>} Array of saved motivation IDs
 */
async saveCoreMotivations(directionId, motivations) {
    assertNonBlankString(directionId, 'Direction ID is required');
    assertPresent(motivations, 'Motivations are required');

    if (!Array.isArray(motivations) || motivations.length === 0) {
        throw new ValidationError('Motivations must be a non-empty array');
    }

    try {
        // Convert to plain objects for storage
        const motivationData = motivations.map(m => {
            if (m instanceof CoreMotivation) {
                return m.toJSON();
            }
            return m;
        });

        // Ensure all have the correct directionId
        motivationData.forEach(m => {
            m.directionId = directionId;
        });

        // Save to database
        const savedIds = await this.#database.saveCoreMotivations(motivationData);

        // Clear cache for this direction
        if (this.#cache) {
            const cacheKey = `motivations_${directionId}`;
            this.#cache.delete(cacheKey);
        }

        // Dispatch completion event
        this.#eventBus.dispatch({
            type: 'CORE_MOTIVATIONS_GENERATION_COMPLETED',
            payload: {
                conceptId: motivationData[0].conceptId,
                directionId,
                motivationIds: savedIds,
                totalCount: await this.#database.getCoreMotivationsCount(directionId),
                generationTime: Date.now()
            }
        });

        this.#logger.info(`Saved ${savedIds.length} core motivations`);

        return savedIds;

    } catch (error) {
        this.#logger.error('Failed to save core motivations:', error);
        throw error;
    }
}

/**
 * Remove individual motivation
 * @param {string} directionId - Direction ID
 * @param {string} motivationId - Motivation ID to remove
 * @returns {Promise<boolean>} Success status
 */
async removeCoreMotivationItem(directionId, motivationId) {
    assertNonBlankString(directionId, 'Direction ID is required');
    assertNonBlankString(motivationId, 'Motivation ID is required');

    try {
        const success = await this.#database.deleteCoreMotivation(motivationId);

        if (success) {
            // Clear cache for this direction
            if (this.#cache) {
                const cacheKey = `motivations_${directionId}`;
                this.#cache.delete(cacheKey);
            }

            this.#logger.info(`Removed core motivation ${motivationId}`);
        }

        return success;

    } catch (error) {
        this.#logger.error(
            `Failed to remove core motivation ${motivationId}:`,
            error
        );
        throw error;
    }
}

/**
 * Clear all motivations for a direction
 * @param {string} directionId - Direction ID
 * @returns {Promise<number>} Number of deleted items
 */
async clearCoreMotivationsForDirection(directionId) {
    assertNonBlankString(directionId, 'Direction ID is required');

    try {
        const deletedCount = await this.#database
            .deleteAllCoreMotivationsForDirection(directionId);

        // Clear cache
        if (this.#cache) {
            const cacheKey = `motivations_${directionId}`;
            this.#cache.delete(cacheKey);
        }

        this.#logger.info(
            `Cleared ${deletedCount} core motivations for direction ${directionId}`
        );

        return deletedCount;

    } catch (error) {
        this.#logger.error(
            `Failed to clear core motivations for direction ${directionId}:`,
            error
        );
        throw error;
    }
}

/**
 * Get all core motivations for a concept
 * @param {string} conceptId - Concept ID
 * @returns {Promise<Object>} Map of directionId to motivations array
 */
async getAllCoreMotivationsForConcept(conceptId) {
    assertNonBlankString(conceptId, 'Concept ID is required');

    try {
        // Get all motivations for the concept
        const allMotivations = await this.#database
            .getCoreMotivationsByConceptId(conceptId);

        // Group by direction
        const motivationsByDirection = {};

        for (const motivation of allMotivations) {
            if (!motivationsByDirection[motivation.directionId]) {
                motivationsByDirection[motivation.directionId] = [];
            }

            motivationsByDirection[motivation.directionId].push(
                CoreMotivation.fromStorage(motivation)
            );
        }

        this.#logger.info(
            `Retrieved motivations for ${Object.keys(motivationsByDirection).length} directions`
        );

        return motivationsByDirection;

    } catch (error) {
        this.#logger.error(
            `Failed to get all core motivations for concept ${conceptId}:`,
            error
        );
        throw error;
    }
}

/**
 * Export core motivations to text format
 * @param {string} directionId - Direction ID
 * @returns {Promise<string>} Formatted text export
 */
async exportCoreMotivationsToText(directionId) {
    assertNonBlankString(directionId, 'Direction ID is required');

    try {
        const motivations = await this.getCoreMotivationsByDirectionId(directionId);

        if (motivations.length === 0) {
            return 'No core motivations found for this direction.';
        }

        const direction = await this.getThematicDirectionById(directionId);

        let text = `Core Motivations for: ${direction?.title || directionId}\n`;
        text += `${'='.repeat(60)}\n\n`;

        motivations.forEach((motivation, index) => {
            text += `Motivation Block ${index + 1}\n`;
            text += `${'-'.repeat(40)}\n`;
            text += `Core Motivation:\n${motivation.motivationBlock.coreMotivation}\n\n`;
            text += `Contradiction/Conflict:\n${motivation.motivationBlock.contradiction}\n\n`;
            text += `Central Question:\n${motivation.motivationBlock.centralQuestion}\n\n`;
            text += `Created: ${new Date(motivation.createdAt).toLocaleString()}\n`;
            text += `\n`;
        });

        text += `\nTotal Motivations: ${motivations.length}`;
        text += `\nGenerated on: ${new Date().toLocaleString()}`;

        return text;

    } catch (error) {
        this.#logger.error(
            `Failed to export core motivations for direction ${directionId}:`,
            error
        );
        throw error;
    }
}

/**
 * Get statistics about core motivations
 * @param {string} conceptId - Concept ID
 * @returns {Promise<Object>} Statistics object
 */
async getCoreMotivationsStatistics(conceptId) {
    assertNonBlankString(conceptId, 'Concept ID is required');

    try {
        const directions = await this.getThematicDirectionsByConceptId(conceptId);
        const stats = {
            totalDirections: directions.length,
            directionsWithMotivations: 0,
            totalMotivations: 0,
            averageMotivationsPerDirection: 0,
            directionStats: []
        };

        for (const direction of directions) {
            const count = await this.#database.getCoreMotivationsCount(direction.id);

            if (count > 0) {
                stats.directionsWithMotivations++;
                stats.totalMotivations += count;

                stats.directionStats.push({
                    directionId: direction.id,
                    directionTitle: direction.title,
                    motivationCount: count
                });
            }
        }

        if (stats.directionsWithMotivations > 0) {
            stats.averageMotivationsPerDirection =
                stats.totalMotivations / stats.directionsWithMotivations;
        }

        return stats;

    } catch (error) {
        this.#logger.error(
            `Failed to get core motivations statistics for concept ${conceptId}:`,
            error
        );
        throw error;
    }
}
```

## Implementation Steps

1. **Add imports**
   - Import CoreMotivation model
   - Import necessary tokens
   - Import validation utilities

2. **Implement generation method**
   - generateCoreMotivationsForDirection
   - Coordinate with generator service
   - Handle LLM metadata

3. **Implement retrieval methods**
   - getCoreMotivationsByDirectionId (with caching)
   - hasCoreMotivationsForDirection
   - getAllCoreMotivationsForConcept

4. **Implement persistence methods**
   - saveCoreMotivations (accumulative)
   - removeCoreMotivationItem
   - clearCoreMotivationsForDirection

5. **Implement utility methods**
   - exportCoreMotivationsToText
   - getCoreMotivationsStatistics

6. **Add caching**
   - Cache motivations for 10 minutes
   - Clear cache on modifications

## Validation Criteria

### Acceptance Criteria

- [ ] Generation method works with LLM service
- [ ] Retrieval methods return correct data
- [ ] Save methods persist accumulative data
- [ ] Delete methods work correctly
- [ ] Export formats text properly
- [ ] Statistics are calculated correctly
- [ ] Caching improves performance
- [ ] Events are dispatched properly

### Testing Requirements

1. **Unit Tests** (`tests/unit/characterBuilder/services/characterBuilderService.test.js`)
   - Test each method
   - Mock dependencies
   - Test error cases
   - Test caching behavior

2. **Integration Tests**
   - Test with real database
   - Test event flow
   - Test cache invalidation

## Notes

- Follow pattern from cliché methods
- Key difference: Motivations accumulate
- Ensure proper caching strategy
- Coordinate with generator service

## Checklist

- [ ] Add required imports
- [ ] Implement generation method
- [ ] Implement retrieval methods
- [ ] Implement save methods
- [ ] Implement delete methods
- [ ] Add export functionality
- [ ] Add statistics method
- [ ] Implement caching
- [ ] Add error handling
- [ ] Write tests
