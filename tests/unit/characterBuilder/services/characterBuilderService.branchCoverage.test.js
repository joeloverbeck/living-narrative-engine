/**
 * @file Branch coverage tests for CharacterBuilderService
 * @description Tests for uncovered branches to achieve 100% coverage
 * @see src/characterBuilder/services/characterBuilderService.js
 */

import { describe, it, expect, afterEach, jest } from '@jest/globals';
import {
  CharacterBuilderService,
  CHARACTER_BUILDER_EVENTS,
  CharacterBuilderError,
} from '../../../../src/characterBuilder/services/characterBuilderService.js';
import { Cliche } from '../../../../src/characterBuilder/models/cliche.js';
import { CoreMotivation } from '../../../../src/characterBuilder/models/coreMotivation.js';

/**
 * Create base mock dependencies for CharacterBuilderService
 */
const createBaseDependencies = () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  storageService: {
    initialize: jest.fn().mockResolvedValue(),
    storeCharacterConcept: jest.fn(),
    listCharacterConcepts: jest.fn(),
    getCharacterConcept: jest.fn(),
    deleteCharacterConcept: jest.fn(),
    storeThematicDirections: jest.fn(),
    getThematicDirections: jest.fn(),
    getThematicDirection: jest.fn(),
  },
  directionGenerator: {
    generateDirections: jest.fn(),
  },
  eventBus: {
    dispatch: jest.fn(),
  },
  database: {
    getClicheByDirectionId: jest.fn(),
    saveCliche: jest.fn(),
    deleteCliche: jest.fn(),
    addMetadata: jest.fn(),
    getCoreMotivationsByDirectionId: jest.fn(),
    saveCoreMotivations: jest.fn(),
    getCoreMotivationsCount: jest.fn(),
    deleteCoreMotivation: jest.fn(),
    deleteAllCoreMotivationsForDirection: jest.fn(),
    getCoreMotivationsByConceptId: jest.fn(),
    debugDumpAllCharacterConcepts: jest.fn(),
    debugDumpAllThematicDirections: jest.fn(),
    debugDumpAllCliches: jest.fn(),
    hasCoreMotivationsForDirection: jest.fn(),
    updateCliche: jest.fn(),
  },
  schemaValidator: {
    validateAgainstSchema: jest.fn().mockReturnValue(true),
    formatAjvErrors: jest.fn().mockReturnValue(''),
  },
  clicheGenerator: {
    generateCliches: jest.fn(),
  },
});

/**
 * Create mock cliche data for testing
 */
const createMockClicheData = (overrides = {}) => ({
  id: 'cliche-1',
  directionId: 'dir-1',
  conceptId: 'concept-1',
  categories: {
    names: ['John', 'Jane'],
    physicalDescriptions: ['tall', 'dark'],
    personalityTraits: ['brooding'],
    skillsAbilities: ['sword fighting'],
    typicalLikes: ['justice'],
    typicalDislikes: ['evil'],
    commonFears: ['heights'],
    genericGoals: ['save the world'],
    backgroundElements: ['tragic backstory'],
    overusedSecrets: ['secret heritage'],
    speechPatterns: ['witty'],
  },
  tropesAndStereotypes: ['The Chosen One', 'Dark Past'],
  createdAt: '2023-01-01T00:00:00.000Z',
  ...overrides,
});

/**
 * Create mock CoreMotivation data
 */
const createMockMotivationData = (overrides = {}) => ({
  id: 'motivation-1',
  directionId: 'dir-1',
  conceptId: 'concept-1',
  coreDesire: 'A deep desire for something meaningful',
  internalContradiction: 'A contradicting internal struggle',
  centralQuestion: 'What does it mean to exist?',
  createdAt: '2023-01-01T00:00:00.000Z',
  ...overrides,
});

describe('CharacterBuilderService - Branch Coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Error wrapping branches', () => {
    describe('removeClicheItem - generic Error wrapping (lines 1365-1370)', () => {
      it('should wrap generic Error in CharacterBuilderError', async () => {
        const deps = createBaseDependencies();

        deps.database.getClicheByDirectionId.mockResolvedValue(createMockClicheData());

        // Mock the Cliche prototype to throw generic Error
        const originalCreateWithItemRemoved = Cliche.prototype.createWithItemRemoved;
        Cliche.prototype.createWithItemRemoved = jest.fn().mockImplementation(() => {
          throw new Error('Generic error from createWithItemRemoved');
        });

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          schemaValidator: deps.schemaValidator,
        });

        await expect(
          service.removeClicheItem('dir-1', 'names', 'John')
        ).rejects.toThrow(CharacterBuilderError);

        await expect(
          service.removeClicheItem('dir-1', 'names', 'John')
        ).rejects.toThrow('Failed to remove cliché item: Generic error from createWithItemRemoved');

        // Restore
        Cliche.prototype.createWithItemRemoved = originalCreateWithItemRemoved;
      });

      it('should re-throw CharacterBuilderError without wrapping', async () => {
        const deps = createBaseDependencies();

        deps.database.getClicheByDirectionId.mockResolvedValue(null);

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          schemaValidator: deps.schemaValidator,
        });

        // This throws CharacterBuilderError for "No clichés found"
        await expect(
          service.removeClicheItem('dir-1', 'names', 'John')
        ).rejects.toThrow('No clichés found for direction: dir-1');
      });
    });

    describe('removeClicheTrope - generic Error wrapping (lines 1432-1437)', () => {
      it('should wrap generic Error in CharacterBuilderError', async () => {
        const deps = createBaseDependencies();

        deps.database.getClicheByDirectionId.mockResolvedValue(createMockClicheData());

        // Mock the Cliche prototype to throw generic Error
        const originalCreateWithTropeRemoved = Cliche.prototype.createWithTropeRemoved;
        Cliche.prototype.createWithTropeRemoved = jest.fn().mockImplementation(() => {
          throw new Error('Generic error from createWithTropeRemoved');
        });

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          schemaValidator: deps.schemaValidator,
        });

        await expect(
          service.removeClicheTrope('dir-1', 'Some Trope')
        ).rejects.toThrow(CharacterBuilderError);

        await expect(
          service.removeClicheTrope('dir-1', 'Some Trope')
        ).rejects.toThrow('Failed to remove cliché trope: Generic error from createWithTropeRemoved');

        // Restore
        Cliche.prototype.createWithTropeRemoved = originalCreateWithTropeRemoved;
      });

      it('should re-throw CharacterBuilderError without wrapping', async () => {
        const deps = createBaseDependencies();

        deps.database.getClicheByDirectionId.mockResolvedValue(null);

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          schemaValidator: deps.schemaValidator,
        });

        // This throws CharacterBuilderError for "No clichés found"
        await expect(
          service.removeClicheTrope('dir-1', 'Some Trope')
        ).rejects.toThrow('No clichés found for direction: dir-1');
      });
    });
  });

  describe('Cache manager branches', () => {
    describe('getCoreMotivationsByDirectionId - cache hit (lines 1590-1596)', () => {
      it('should return cached data when cacheManager has data', async () => {
        const deps = createBaseDependencies();
        const cachedMotivations = [
          CoreMotivation.fromRawData(createMockMotivationData({ id: 'mot-1' })),
          CoreMotivation.fromRawData(createMockMotivationData({ id: 'mot-2' })),
        ];

        const mockCacheManager = {
          get: jest.fn().mockReturnValue(cachedMotivations),
          set: jest.fn(),
        };

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          cacheManager: mockCacheManager,
        });

        const result = await service.getCoreMotivationsByDirectionId('dir-1');

        expect(result).toEqual(cachedMotivations);
        expect(mockCacheManager.get).toHaveBeenCalled();
        expect(deps.database.getCoreMotivationsByDirectionId).not.toHaveBeenCalled();
        expect(deps.eventBus.dispatch).toHaveBeenCalledWith(
          CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED,
          expect.objectContaining({
            directionId: 'dir-1',
            source: 'cache',
            count: 2,
          })
        );
      });

      it('should handle cache error gracefully and fall back to database', async () => {
        const deps = createBaseDependencies();

        const mockCacheManager = {
          get: jest.fn().mockImplementation(() => {
            throw new Error('Cache read error');
          }),
          set: jest.fn(),
        };

        deps.database.getCoreMotivationsByDirectionId.mockResolvedValue([
          createMockMotivationData(),
        ]);

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          cacheManager: mockCacheManager,
        });

        const result = await service.getCoreMotivationsByDirectionId('dir-1');

        expect(result).toHaveLength(1);
        expect(deps.logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Cache error')
        );
        expect(deps.database.getCoreMotivationsByDirectionId).toHaveBeenCalled();
      });
    });

    describe('Legacy cache fallback - getCoreMotivationsByDirectionId (lines 1650-1656)', () => {
      it('should use legacy motivationCache when cacheManager is null', async () => {
        const deps = createBaseDependencies();

        deps.database.getCoreMotivationsByDirectionId.mockResolvedValue([
          createMockMotivationData({ id: 'mot-1' }),
        ]);

        // Create service WITHOUT cacheManager (uses internal motivationCache Map)
        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          cacheManager: null, // Explicitly null
        });

        // First call - should fetch from database and cache to motivationCache
        const result1 = await service.getCoreMotivationsByDirectionId('dir-1');
        expect(result1).toHaveLength(1);
        expect(deps.database.getCoreMotivationsByDirectionId).toHaveBeenCalledTimes(1);

        // Second call - should hit the legacy cache
        const result2 = await service.getCoreMotivationsByDirectionId('dir-1');
        expect(result2).toHaveLength(1);
        // Database should still be called only once (cached)
        expect(deps.database.getCoreMotivationsByDirectionId).toHaveBeenCalledTimes(1);
        expect(deps.logger.info).toHaveBeenCalledWith('Returning cached core motivations');
      });
    });

    describe('Legacy cache invalidation - saveCoreMotivations (lines 1739-1743)', () => {
      it('should invalidate legacy cache when saving motivations without cacheManager', async () => {
        const deps = createBaseDependencies();

        deps.database.saveCoreMotivations.mockResolvedValue(['saved-id-1']);
        deps.database.getCoreMotivationsCount.mockResolvedValue(1);

        // Create service WITHOUT cacheManager
        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          cacheManager: null,
        });

        const motivationData = [
          {
            directionId: 'dir-1',
            conceptId: 'concept-1',
            coreDesire: 'A desire',
            internalContradiction: 'A contradiction',
            centralQuestion: 'A question?',
          },
        ];

        // This should trigger the legacy cache invalidation path
        const result = await service.saveCoreMotivations('dir-1', motivationData);

        expect(result).toEqual(['saved-id-1']);
        expect(deps.database.saveCoreMotivations).toHaveBeenCalled();
      });
    });

    describe('Legacy cache invalidation - removeCoreMotivationItem (lines 1787-1790)', () => {
      it('should invalidate legacy cache on successful deletion without cacheManager', async () => {
        const deps = createBaseDependencies();

        deps.database.deleteCoreMotivation.mockResolvedValue(true);

        // Create service WITHOUT cacheManager
        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          cacheManager: null,
        });

        const result = await service.removeCoreMotivationItem('dir-1', 'motivation-1');

        expect(result).toBe(true);
        expect(deps.logger.info).toHaveBeenCalledWith(
          'Removed core motivation motivation-1'
        );
      });

      it('should not invalidate cache when deletion fails', async () => {
        const deps = createBaseDependencies();

        deps.database.deleteCoreMotivation.mockResolvedValue(false);

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          cacheManager: null,
        });

        const result = await service.removeCoreMotivationItem('dir-1', 'motivation-1');

        expect(result).toBe(false);
        // Logger.info should NOT be called since deletion returned false
        expect(deps.logger.info).not.toHaveBeenCalledWith(
          'Removed core motivation motivation-1'
        );
      });
    });
  });

  describe('Fallback branches', () => {
    describe('exportCoreMotivationsToText - direction title fallback (line 1900)', () => {
      it('should use directionId as fallback when direction is null', async () => {
        const deps = createBaseDependencies();

        // Mock getCoreMotivationsByDirectionId to return motivations
        deps.database.getCoreMotivationsByDirectionId.mockResolvedValue([
          createMockMotivationData({
            coreDesire: 'Test desire',
            internalContradiction: 'Test contradiction',
            centralQuestion: 'Test question?',
          }),
        ]);

        // Return null for the direction (simulating orphaned motivations)
        deps.storageService.getThematicDirection.mockResolvedValue(null);

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
        });

        const result = await service.exportCoreMotivationsToText('dir-orphan');

        // Should use directionId as fallback in the title
        expect(result).toContain('Core Motivations for: dir-orphan');
        expect(result).toContain('Test desire');
      });

      it('should use directionId as fallback when direction has no title', async () => {
        const deps = createBaseDependencies();

        deps.database.getCoreMotivationsByDirectionId.mockResolvedValue([
          createMockMotivationData(),
        ]);

        // Return direction without title
        deps.storageService.getThematicDirection.mockResolvedValue({
          id: 'dir-1',
          // title is missing
        });

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
        });

        const result = await service.exportCoreMotivationsToText('dir-no-title');

        // Should use directionId as fallback
        expect(result).toContain('Core Motivations for: dir-no-title');
      });

      it('should use direction title when available', async () => {
        const deps = createBaseDependencies();

        deps.database.getCoreMotivationsByDirectionId.mockResolvedValue([
          createMockMotivationData(),
        ]);

        deps.storageService.getThematicDirection.mockResolvedValue({
          id: 'dir-1',
          title: 'My Character Direction',
        });

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
        });

        const result = await service.exportCoreMotivationsToText('dir-1');

        expect(result).toContain('Core Motivations for: My Character Direction');
      });
    });

    describe('#validateCliches - schemaValidator null path (line 2237)', () => {
      it('should skip validation when schemaValidator is null', async () => {
        const deps = createBaseDependencies();

        const mockClicheInput = {
          directionId: 'dir-1',
          conceptId: 'concept-1',
          categories: {
            names: ['Test Name'],
            physicalDescriptions: [],
            personalityTraits: [],
            skillsAbilities: [],
            typicalLikes: [],
            typicalDislikes: [],
            commonFears: [],
            genericGoals: [],
            backgroundElements: [],
            overusedSecrets: [],
            speechPatterns: [],
          },
          tropesAndStereotypes: [],
        };

        deps.database.getClicheByDirectionId.mockResolvedValue(null); // No existing
        deps.database.saveCliche.mockResolvedValue(mockClicheInput);
        deps.database.addMetadata.mockResolvedValue();

        // Create service WITHOUT schemaValidator
        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          schemaValidator: null, // Explicitly null
        });

        // Should succeed without schema validation
        const result = await service.storeCliches(mockClicheInput);

        expect(result).toBeInstanceOf(Cliche);
        expect(result.directionId).toBe('dir-1');
      });

      it('should perform validation when schemaValidator is available', async () => {
        const deps = createBaseDependencies();

        deps.schemaValidator.validateAgainstSchema.mockReturnValue(false);
        deps.schemaValidator.formatAjvErrors.mockReturnValue('Validation failed');

        const mockClicheInput = {
          directionId: 'dir-1',
          conceptId: 'concept-1',
          categories: {
            names: ['Test'],
            physicalDescriptions: [],
            personalityTraits: [],
            skillsAbilities: [],
            typicalLikes: [],
            typicalDislikes: [],
            commonFears: [],
            genericGoals: [],
            backgroundElements: [],
            overusedSecrets: [],
            speechPatterns: [],
          },
          tropesAndStereotypes: [],
        };

        deps.database.getClicheByDirectionId.mockResolvedValue(null);

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          schemaValidator: deps.schemaValidator,
        });

        await expect(service.storeCliches(mockClicheInput)).rejects.toThrow(
          'Invalid cliché data'
        );
      });
    });
  });

  describe('String truncation branches', () => {
    describe('createCharacterConcept - concept truncation (lines 276, 293, 331)', () => {
      it('should truncate concept text over 50 characters in info log', async () => {
        const deps = createBaseDependencies();
        const longConcept = 'A'.repeat(60); // Over 50 chars

        // Mock successful creation
        const mockConcept = {
          id: 'concept-1',
          concept: longConcept,
          status: 'draft',
        };
        deps.storageService.storeCharacterConcept.mockResolvedValue(mockConcept);

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
        });

        await service.createCharacterConcept(longConcept);

        // Check that truncation occurred in log (concept > 50 triggers '...')
        expect(deps.logger.info).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            concept: expect.stringContaining('...'),
          })
        );
      });

      it('should truncate concept text over 100 characters in event dispatch', async () => {
        const deps = createBaseDependencies();
        const longConcept = 'B'.repeat(120); // Over 100 chars

        const mockConcept = {
          id: 'concept-1',
          concept: longConcept,
          status: 'draft',
        };
        deps.storageService.storeCharacterConcept.mockResolvedValue(mockConcept);

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
        });

        await service.createCharacterConcept(longConcept);

        // Check event dispatch truncation (concept > 100 triggers '...')
        expect(deps.eventBus.dispatch).toHaveBeenCalledWith(
          CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED,
          expect.objectContaining({
            concept: expect.stringContaining('...'),
          })
        );
      });

      it('should NOT add ellipsis for concept under 50 characters', async () => {
        const deps = createBaseDependencies();
        const shortConcept = 'ShortConcept'; // Under 50 chars, at least 10 chars

        const mockConcept = {
          id: 'concept-1',
          concept: shortConcept,
          status: 'draft',
        };
        deps.storageService.storeCharacterConcept.mockResolvedValue(mockConcept);

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
        });

        await service.createCharacterConcept(shortConcept);

        // Check that no truncation occurred
        expect(deps.logger.info).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            concept: shortConcept, // No ellipsis
          })
        );
      });
    });
  });

  describe('Error handling with missing properties', () => {
    describe('storeCliches - error fallback for missing properties (lines 1073-1074)', () => {
      it('should use unknown fallback when cliches lacks conceptId and directionId', async () => {
        const deps = createBaseDependencies();

        // Make database throw during save
        deps.database.saveCliche.mockRejectedValue(new Error('Database save failed'));
        deps.database.getClicheByDirectionId.mockResolvedValue(null);

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          schemaValidator: null, // Skip validation
        });

        // Create cliche with minimal/missing properties
        const incompleteCliche = {
          categories: {
            names: [],
            physicalDescriptions: [],
            personalityTraits: [],
            skillsAbilities: [],
            typicalLikes: [],
            typicalDislikes: [],
            commonFears: [],
            genericGoals: [],
            backgroundElements: [],
            overusedSecrets: [],
            speechPatterns: [],
          },
          tropesAndStereotypes: [],
          // conceptId and directionId are missing
        };

        await expect(service.storeCliches(incompleteCliche)).rejects.toThrow();

        // Check that 'unknown' fallback was used in error event
        expect(deps.eventBus.dispatch).toHaveBeenCalledWith(
          CHARACTER_BUILDER_EVENTS.CLICHES_STORAGE_FAILED,
          expect.objectContaining({
            conceptId: 'unknown',
            directionId: 'unknown',
          })
        );
      });
    });
  });

  describe('Cliché operations', () => {
    describe('generateClichesForDirection - success path (lines 1144-1168)', () => {
      it('should generate and store clichés successfully', async () => {
        const deps = createBaseDependencies();

        const mockConcept = {
          id: 'concept-1',
          concept: 'A brave warrior',
          text: 'A brave warrior with a dark past',
        };

        const mockDirection = {
          id: 'dir-1',
          title: 'The Redeemed Hero',
          conceptId: mockConcept.id,
        };

        const generatedData = {
          categories: {
            names: ['Warrior Name'],
            physicalDescriptions: ['Battle-scarred'],
            personalityTraits: ['Brave'],
            skillsAbilities: ['Combat'],
            typicalLikes: ['Honor'],
            typicalDislikes: ['Cowardice'],
            commonFears: ['Failure'],
            genericGoals: ['Redemption'],
            backgroundElements: ['Dark past'],
            overusedSecrets: ['Hidden shame'],
            speechPatterns: ['Grim'],
          },
          tropesAndStereotypes: ['Redeemed Villain'],
          metadata: {
            responseTime: 1500,
            model: 'test-model',
          },
        };

        deps.clicheGenerator.generateCliches.mockResolvedValue(generatedData);
        deps.database.getClicheByDirectionId.mockResolvedValue(null);
        deps.database.saveCliche.mockResolvedValue({
          ...generatedData,
          id: 'cliche-new',
          directionId: mockDirection.id,
          conceptId: mockConcept.id,
        });
        deps.database.addMetadata.mockResolvedValue();

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          schemaValidator: null,
          clicheGenerator: deps.clicheGenerator,
        });

        const result = await service.generateClichesForDirection(mockConcept, mockDirection);

        expect(result).toBeInstanceOf(Cliche);
        expect(deps.clicheGenerator.generateCliches).toHaveBeenCalledWith(
          mockConcept.id,
          mockConcept.text, // Uses text property when available
          mockDirection
        );
        expect(deps.eventBus.dispatch).toHaveBeenCalledWith(
          CHARACTER_BUILDER_EVENTS.CLICHES_GENERATION_COMPLETED,
          expect.objectContaining({
            conceptId: mockConcept.id,
            directionId: mockDirection.id,
            generationTime: 1500,
          })
        );
      });

      it('should use concept.concept when text is not available (line 1144)', async () => {
        const deps = createBaseDependencies();

        const mockConcept = {
          id: 'concept-1',
          concept: 'A brave warrior',
          // No text property
        };

        const mockDirection = {
          id: 'dir-1',
          title: 'The Hero',
          conceptId: mockConcept.id,
        };

        const generatedData = {
          categories: {
            names: [],
            physicalDescriptions: [],
            personalityTraits: [],
            skillsAbilities: [],
            typicalLikes: [],
            typicalDislikes: [],
            commonFears: [],
            genericGoals: [],
            backgroundElements: [],
            overusedSecrets: [],
            speechPatterns: [],
          },
          tropesAndStereotypes: [],
          metadata: {},
        };

        deps.clicheGenerator.generateCliches.mockResolvedValue(generatedData);
        deps.database.getClicheByDirectionId.mockResolvedValue(null);
        deps.database.saveCliche.mockResolvedValue({
          ...generatedData,
          id: 'cliche-new',
          directionId: mockDirection.id,
          conceptId: mockConcept.id,
        });
        deps.database.addMetadata.mockResolvedValue();

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          schemaValidator: null,
          clicheGenerator: deps.clicheGenerator,
        });

        await service.generateClichesForDirection(mockConcept, mockDirection);

        // Uses concept.concept as fallback since text is undefined
        expect(deps.clicheGenerator.generateCliches).toHaveBeenCalledWith(
          mockConcept.id,
          mockConcept.concept,
          mockDirection
        );
      });

      it('should handle missing metadata.responseTime (line 1168)', async () => {
        const deps = createBaseDependencies();

        const mockConcept = { id: 'concept-1', concept: 'Test concept longer' };
        const mockDirection = { id: 'dir-1', title: 'Test Direction', conceptId: 'concept-1' };

        const generatedData = {
          categories: {
            names: [],
            physicalDescriptions: [],
            personalityTraits: [],
            skillsAbilities: [],
            typicalLikes: [],
            typicalDislikes: [],
            commonFears: [],
            genericGoals: [],
            backgroundElements: [],
            overusedSecrets: [],
            speechPatterns: [],
          },
          tropesAndStereotypes: [],
          metadata: null, // No metadata
        };

        deps.clicheGenerator.generateCliches.mockResolvedValue(generatedData);
        deps.database.getClicheByDirectionId.mockResolvedValue(null);
        deps.database.saveCliche.mockResolvedValue({
          ...generatedData,
          id: 'cliche-new',
          directionId: mockDirection.id,
          conceptId: mockConcept.id,
        });
        deps.database.addMetadata.mockResolvedValue();

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
          schemaValidator: null,
          clicheGenerator: deps.clicheGenerator,
        });

        await service.generateClichesForDirection(mockConcept, mockDirection);

        // generationTime should fall back to 0
        expect(deps.eventBus.dispatch).toHaveBeenCalledWith(
          CHARACTER_BUILDER_EVENTS.CLICHES_GENERATION_COMPLETED,
          expect.objectContaining({
            generationTime: 0,
          })
        );
      });
    });

    describe('getClichesByDirectionIds - batch fetch uncached (lines 1227-1233)', () => {
      it('should batch fetch uncached clichés from database', async () => {
        const deps = createBaseDependencies();

        // First direction is cached, second is not
        const uncachedData = createMockClicheData({ directionId: 'dir-uncached' });

        deps.database.getClicheByDirectionId.mockResolvedValue(uncachedData);

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
        });

        // Pre-populate cache with one entry using getClichesByDirectionId first
        deps.database.getClicheByDirectionId.mockResolvedValueOnce(
          createMockClicheData({ directionId: 'dir-cached' })
        );
        await service.getClichesByDirectionId('dir-cached');

        // Now reset mock and setup for uncached
        deps.database.getClicheByDirectionId.mockResolvedValueOnce(uncachedData);

        const result = await service.getClichesForDirections(['dir-cached', 'dir-uncached']);

        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(2);
        expect(result.has('dir-cached')).toBe(true);
        expect(result.has('dir-uncached')).toBe(true);
      });

      it('should handle database returning null for uncached directions', async () => {
        const deps = createBaseDependencies();

        // Database returns null (no cliché found)
        deps.database.getClicheByDirectionId.mockResolvedValue(null);

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
        });

        const result = await service.getClichesForDirections(['dir-nonexistent']);

        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(0);
        expect(result.has('dir-nonexistent')).toBe(false);
      });
    });

    describe('deleteClichesForDirection - error wrapping (line 1287)', () => {
      it('should wrap generic Error in CharacterBuilderError', async () => {
        const deps = createBaseDependencies();

        // Setup so cliche exists but delete fails
        deps.database.getClicheByDirectionId.mockResolvedValue(createMockClicheData());
        deps.database.deleteCliche.mockRejectedValue(new Error('Database delete failed'));

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
        });

        await expect(
          service.deleteClichesForDirection('dir-1')
        ).rejects.toThrow(CharacterBuilderError);

        await expect(
          service.deleteClichesForDirection('dir-1')
        ).rejects.toThrow('Failed to delete clichés: Database delete failed');
      });

      it('should re-throw CharacterBuilderError without wrapping', async () => {
        const deps = createBaseDependencies();

        // Cliché exists but deleteCliche throws CharacterBuilderError
        deps.database.getClicheByDirectionId.mockResolvedValue(createMockClicheData());
        const originalError = new CharacterBuilderError('Database unavailable for deletion');
        deps.database.deleteCliche.mockRejectedValue(originalError);

        const service = new CharacterBuilderService({
          logger: deps.logger,
          storageService: deps.storageService,
          directionGenerator: deps.directionGenerator,
          eventBus: deps.eventBus,
          database: deps.database,
        });

        await expect(
          service.deleteClichesForDirection('dir-1')
        ).rejects.toBe(originalError);
      });
    });
  });

  describe('hasClichesForDirection - debug log ternary (line 955)', () => {
    it('should log yes when cached data exists', async () => {
      const deps = createBaseDependencies();

      // Pre-populate cache by fetching first
      const mockCliche = createMockClicheData();
      deps.database.getClicheByDirectionId.mockResolvedValue(mockCliche);

      const service = new CharacterBuilderService({
        logger: deps.logger,
        storageService: deps.storageService,
        directionGenerator: deps.directionGenerator,
        eventBus: deps.eventBus,
        database: deps.database,
      });

      // First fetch to populate cache - use getClichesByDirectionId
      await service.getClichesByDirectionId('dir-1');

      // Now check hasClichesForDirection - should hit cache
      const result = await service.hasClichesForDirection('dir-1');

      expect(result).toBe(true);
      expect(deps.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('cached data exists: yes')
      );
    });

    it('should check database when no cached data', async () => {
      const deps = createBaseDependencies();

      deps.database.getClicheByDirectionId.mockResolvedValue(createMockClicheData());

      const service = new CharacterBuilderService({
        logger: deps.logger,
        storageService: deps.storageService,
        directionGenerator: deps.directionGenerator,
        eventBus: deps.eventBus,
        database: deps.database,
      });

      // Call without pre-caching
      const result = await service.hasClichesForDirection('dir-fresh');

      expect(result).toBe(true);
      expect(deps.database.getClicheByDirectionId).toHaveBeenCalledWith('dir-fresh');
    });
  });

  describe('clearCoreMotivationsForDirection - legacy cache path (lines 1812-1823)', () => {
    it('should invalidate legacy motivationCache when clearing motivations without cacheManager', async () => {
      const deps = createBaseDependencies();

      deps.database.deleteAllCoreMotivationsForDirection.mockResolvedValue(5);
      deps.database.getCoreMotivationsByDirectionId.mockResolvedValue([
        createMockMotivationData(),
      ]);

      // Create service WITHOUT cacheManager
      const service = new CharacterBuilderService({
        logger: deps.logger,
        storageService: deps.storageService,
        directionGenerator: deps.directionGenerator,
        eventBus: deps.eventBus,
        database: deps.database,
        cacheManager: null,
      });

      // Warm up the legacy cache
      await service.getCoreMotivationsByDirectionId('dir-1');
      expect(deps.database.getCoreMotivationsByDirectionId).toHaveBeenCalledTimes(1);

      // Second call should hit cache
      await service.getCoreMotivationsByDirectionId('dir-1');
      expect(deps.database.getCoreMotivationsByDirectionId).toHaveBeenCalledTimes(1);

      // Clear motivations (this should invalidate the legacy cache)
      const cleared = await service.clearCoreMotivationsForDirection('dir-1');
      expect(cleared).toBe(5);

      // Update the mock to return empty
      deps.database.getCoreMotivationsByDirectionId.mockResolvedValue([]);

      // Third call should hit database again (cache was invalidated)
      await service.getCoreMotivationsByDirectionId('dir-1');
      expect(deps.database.getCoreMotivationsByDirectionId).toHaveBeenCalledTimes(2);
    });
  });

  describe('Short concept text paths - no truncation branches', () => {
    it('should not truncate concept under 100 chars in error dispatch (line 331)', async () => {
      const deps = createBaseDependencies();
      const shortConcept = 'Short concept text'; // Under 100 chars

      // Make all retry attempts fail
      deps.storageService.storeCharacterConcept
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Final failure'));

      const service = new CharacterBuilderService({
        logger: deps.logger,
        storageService: deps.storageService,
        directionGenerator: deps.directionGenerator,
        eventBus: deps.eventBus,
        database: deps.database,
      });

      await expect(service.createCharacterConcept(shortConcept)).rejects.toThrow();

      // Verify error dispatch has concept WITHOUT '...' truncation
      expect(deps.eventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED,
        expect.objectContaining({
          concept: shortConcept, // No truncation applied
        })
      );
    });

    it('should not truncate concept under 50 chars in logging (line 393)', async () => {
      const deps = createBaseDependencies();
      const mockConcept = { id: 'concept-1', concept: 'Short concept' }; // Under 50 chars

      deps.storageService.getCharacterConcept.mockResolvedValue(mockConcept);
      deps.directionGenerator.generateDirections.mockResolvedValue([
        { title: 'Direction 1', description: 'Desc' },
      ]);
      deps.storageService.storeThematicDirections.mockResolvedValue([
        { id: 'dir-1', title: 'Direction 1', description: 'Desc' },
      ]);

      const service = new CharacterBuilderService({
        logger: deps.logger,
        storageService: deps.storageService,
        directionGenerator: deps.directionGenerator,
        eventBus: deps.eventBus,
        database: deps.database,
      });

      await service.generateThematicDirections('concept-1');

      // Verify logging has concept WITHOUT '...' truncation
      expect(deps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting thematic direction generation'),
        expect.objectContaining({
          concept: 'Short concept', // No truncation applied
        })
      );
    });
  });

  describe('hasClichesForDirection - cache shows no data (line 955)', () => {
    it('should log cache miss and return false when cache has no data', async () => {
      const deps = createBaseDependencies();

      // Database returns null (no cliche exists)
      deps.database.getClicheByDirectionId.mockResolvedValue(null);

      const service = new CharacterBuilderService({
        logger: deps.logger,
        storageService: deps.storageService,
        directionGenerator: deps.directionGenerator,
        eventBus: deps.eventBus,
        database: deps.database,
      });

      const result = await service.hasClichesForDirection('nonexistent-dir');

      expect(result).toBe(false);
      expect(deps.database.getClicheByDirectionId).toHaveBeenCalledWith('nonexistent-dir');
    });

    it('should return true from cache when cached data exists (line 955 cached yes branch)', async () => {
      const deps = createBaseDependencies();

      // First fetch populates cache via getClichesByDirectionId
      // hasClichesForDirection doesn't populate cache, only reads it
      const mockRawData = {
        id: 'cliche-1',
        directionId: 'cached-dir',
        conceptId: 'concept-1',
        categories: {
          names: [],
          physicalDescriptions: [],
          personalityTraits: [],
          skillsAbilities: [],
          typicalLikes: [],
          typicalDislikes: [],
          commonFears: [],
          genericGoals: [],
          backgroundElements: [],
          overusedSecrets: [],
          speechPatterns: [],
        },
        tropesAndStereotypes: [],
        createdAt: new Date().toISOString(),
      };
      deps.database.getClicheByDirectionId.mockResolvedValue(mockRawData);

      const service = new CharacterBuilderService({
        logger: deps.logger,
        storageService: deps.storageService,
        directionGenerator: deps.directionGenerator,
        eventBus: deps.eventBus,
        database: deps.database,
      });

      // First call via getClichesByDirectionId - this populates the cache
      await service.getClichesByDirectionId('cached-dir');

      // Second call via hasClichesForDirection - should use cache
      const result = await service.hasClichesForDirection('cached-dir');

      expect(result).toBe(true);
      // Database should only be called once (via getClichesByDirectionId)
      expect(deps.database.getClicheByDirectionId).toHaveBeenCalledTimes(1);
    });
  });

  describe('getClichesForDirections - all cached scenario (line 1227)', () => {
    it('should skip database fetch when all items are cached', async () => {
      const deps = createBaseDependencies();

      // First call populates cache - use proper Cliche structure
      const mockRawData1 = {
        id: 'cliche-1',
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: {
          names: [],
          physicalDescriptions: [],
          personalityTraits: [],
          skillsAbilities: [],
          typicalLikes: [],
          typicalDislikes: [],
          commonFears: [],
          genericGoals: [],
          backgroundElements: [],
          overusedSecrets: [],
          speechPatterns: [],
        },
        tropesAndStereotypes: [],
        createdAt: new Date().toISOString(),
      };
      const mockRawData2 = {
        id: 'cliche-2',
        directionId: 'dir-2',
        conceptId: 'concept-2',
        categories: {
          names: [],
          physicalDescriptions: [],
          personalityTraits: [],
          skillsAbilities: [],
          typicalLikes: [],
          typicalDislikes: [],
          commonFears: [],
          genericGoals: [],
          backgroundElements: [],
          overusedSecrets: [],
          speechPatterns: [],
        },
        tropesAndStereotypes: [],
        createdAt: new Date().toISOString(),
      };
      deps.database.getClicheByDirectionId
        .mockResolvedValueOnce(mockRawData1)
        .mockResolvedValueOnce(mockRawData2);

      const service = new CharacterBuilderService({
        logger: deps.logger,
        storageService: deps.storageService,
        directionGenerator: deps.directionGenerator,
        eventBus: deps.eventBus,
        database: deps.database,
      });

      // First call - populates cache for both directions
      await service.getClichesForDirections(['dir-1', 'dir-2']);

      // Reset mock to track second call
      deps.database.getClicheByDirectionId.mockClear();

      // Second call - all cached, should NOT call database
      const result = await service.getClichesForDirections(['dir-1', 'dir-2']);

      expect(result.size).toBe(2);
      expect(deps.database.getClicheByDirectionId).not.toHaveBeenCalled();
    });
  });

  describe('removeCoreMotivationItem - legacy cache fallback (line 1787-1790)', () => {
    it('should invalidate legacy motivationCache when removing motivation without cacheManager', async () => {
      const deps = createBaseDependencies();

      // Setup: motivation exists and deletion succeeds
      deps.database.deleteCoreMotivation.mockResolvedValue(true);
      deps.database.getCoreMotivationsByDirectionId.mockResolvedValue([
        createMockMotivationData({ id: 'mot-1', directionId: 'dir-1' }),
      ]);

      // Create service WITHOUT cacheManager (uses legacy motivationCache)
      const service = new CharacterBuilderService({
        logger: deps.logger,
        storageService: deps.storageService,
        directionGenerator: deps.directionGenerator,
        eventBus: deps.eventBus,
        database: deps.database,
        cacheManager: null, // No cacheManager = uses legacy cache
      });

      // First populate the legacy cache
      await service.getCoreMotivationsByDirectionId('dir-1');
      expect(deps.database.getCoreMotivationsByDirectionId).toHaveBeenCalledTimes(1);

      // Verify cache is working (second call should not hit database)
      await service.getCoreMotivationsByDirectionId('dir-1');
      expect(deps.database.getCoreMotivationsByDirectionId).toHaveBeenCalledTimes(1);

      // Now remove a motivation - this should invalidate legacy cache
      // Note: removeCoreMotivationItem(directionId, motivationId) - directionId first
      const result = await service.removeCoreMotivationItem('dir-1', 'mot-1');

      expect(result).toBe(true);
      expect(deps.database.deleteCoreMotivation).toHaveBeenCalledWith('mot-1');

      // After deletion, cache should be invalidated
      // Next call should hit database again
      deps.database.getCoreMotivationsByDirectionId.mockResolvedValue([]);
      await service.getCoreMotivationsByDirectionId('dir-1');
      expect(deps.database.getCoreMotivationsByDirectionId).toHaveBeenCalledTimes(2);
    });
  });

  describe('Long concept text paths - WITH truncation branches', () => {
    it('should truncate concept over 100 chars in error dispatch (line 330)', async () => {
      const deps = createBaseDependencies();
      // Create concept longer than 100 characters
      const longConcept = 'A'.repeat(150); // 150 chars - should be truncated

      // Make all retry attempts fail
      deps.storageService.storeCharacterConcept
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Final failure'));

      const service = new CharacterBuilderService({
        logger: deps.logger,
        storageService: deps.storageService,
        directionGenerator: deps.directionGenerator,
        eventBus: deps.eventBus,
        database: deps.database,
      });

      await expect(service.createCharacterConcept(longConcept)).rejects.toThrow();

      // Verify error dispatch has concept WITH '...' truncation
      expect(deps.eventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED,
        expect.objectContaining({
          concept: longConcept.substring(0, 100) + '...', // Truncated at 100 + '...'
        })
      );
    });

    it('should truncate concept over 50 chars in logging (line 392)', async () => {
      const deps = createBaseDependencies();
      // Create concept with concept property longer than 50 characters
      const longConceptText = 'A'.repeat(75); // 75 chars - should be truncated
      const mockConcept = { id: 'concept-1', concept: longConceptText };

      deps.storageService.getCharacterConcept.mockResolvedValue(mockConcept);
      deps.directionGenerator.generateDirections.mockResolvedValue([
        { title: 'Direction 1', description: 'Desc' },
      ]);
      deps.storageService.storeThematicDirections.mockResolvedValue([
        { id: 'dir-1', title: 'Direction 1', description: 'Desc' },
      ]);

      const service = new CharacterBuilderService({
        logger: deps.logger,
        storageService: deps.storageService,
        directionGenerator: deps.directionGenerator,
        eventBus: deps.eventBus,
        database: deps.database,
      });

      await service.generateThematicDirections('concept-1');

      // Verify logging has concept WITH '...' truncation
      expect(deps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting thematic direction generation'),
        expect.objectContaining({
          concept: longConceptText.substring(0, 50) + '...', // Truncated at 50 + '...'
        })
      );
    });
  });

  describe('#validateCliches - schemaValidator null path (line 2237)', () => {
    it('should skip validation when schemaValidator is null', async () => {
      const deps = createBaseDependencies();

      // Setup concept and direction for generateClichesForDirection
      const mockConcept = {
        id: 'concept-1',
        concept: 'Test concept',
        text: 'Test concept text',
      };
      const mockDirection = {
        id: 'dir-1',
        title: 'Test Direction',
        description: 'Description',
        conceptId: 'concept-1', // Must match concept.id
      };

      // No existing cliche
      deps.database.getClicheByDirectionId.mockResolvedValue(null);

      // Cliche generator returns valid data with proper categories structure
      deps.clicheGenerator.generateCliches.mockResolvedValue({
        categories: {
          names: ['Test Name'],
          physicalDescriptions: ['tall'],
          personalityTraits: ['brave'],
          skillsAbilities: ['combat'],
          typicalLikes: ['adventure'],
          typicalDislikes: ['injustice'],
          backstoryElements: ['orphan'],
          relationships: ['mentor'],
          goals: ['save world'],
          speechPatterns: ['formal'],
        },
        tropesAndStereotypes: [{ trope: 'Chosen One', description: 'Hero destined' }],
        metadata: { responseTime: 100 },
      });

      // Database saves and returns the cliche with its id
      deps.database.saveCliche.mockImplementation((cliche) =>
        Promise.resolve(cliche)
      );

      // Create service WITHOUT schemaValidator
      const service = new CharacterBuilderService({
        logger: deps.logger,
        storageService: deps.storageService,
        directionGenerator: deps.directionGenerator,
        eventBus: deps.eventBus,
        database: deps.database,
        clicheGenerator: deps.clicheGenerator,
        schemaValidator: null, // No schema validator - tests line 2237 else branch
      });

      // Should complete without validation errors
      const result = await service.generateClichesForDirection(
        mockConcept,
        mockDirection
      );

      expect(result).toBeDefined();
      expect(deps.database.saveCliche).toHaveBeenCalled();
    });
  });
});
