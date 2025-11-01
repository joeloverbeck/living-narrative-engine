/**
 * @file Migration tests for ActivityNLGSystem
 * @description Tests migrated from activityDescriptionService.characterization.test.js
 *              to use ActivityNLGSystem directly.
 *              Part of ACTTESMIG-002 - Batch 3 migration.
 *
 * Original tests: activityDescriptionService.characterization.test.js lines 1032-1296
 * Migration batch: Batch 3 (21 tests)
 * Hooks migrated: resolveEntityName, detectEntityGender, getPronounSet,
 *                 getReflexivePronoun, generateActivityPhrase, mergeAdverb, injectSoftener
 * @see workflows/ACTTESMIG-002-nlg-system-migration.md
 * @see workflows/ACTDESSERREF-010-migrate-test-suite.md
 * @see workflows/ACTTESMIG-000-migration-overview.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActivityNLGSystem from '../../../../src/anatomy/services/activityNLGSystem.js';

/**
 * Helper: Create mock logger
 *
 * @returns {object} Mock logger object
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Helper: Create mock entity manager
 * Provides getEntityInstance method with Map-based lookup
 *
 * @param {Map<string, object>} [entityMap] - Map of entity ID to entity object
 * @returns {object} Mock entity manager object
 */
function createMockEntityManager(entityMap = new Map()) {
  return {
    getEntityInstance: jest.fn((id) => entityMap.get(id) || null),
  };
}

/**
 * Helper: Create mock cache manager
 * Simple Map-based cache implementation
 *
 * @returns {object} Mock cache manager object
 */
function createMockCacheManager() {
  const cache = new Map();

  return {
    get: jest.fn((cacheName, key) => cache.get(`${cacheName}:${key}`)),
    set: jest.fn((cacheName, key, value) => {
      cache.set(`${cacheName}:${key}`, value);
    }),
    invalidate: jest.fn((cacheName, key) => {
      cache.delete(`${cacheName}:${key}`);
    }),
  };
}

/**
 * Helper: Create standard test entity with proper component structure
 * Matches the entity interface expected by ActivityNLGSystem
 *
 * @param {object} [config] - Entity configuration
 * @param {string} [config.id] - Entity ID
 * @param {string} [config.name] - Entity name (for core:name component)
 * @param {string} [config.gender] - Entity gender (for core:gender component)
 * @param {Map} [config.additionalComponents] - Additional components to add
 * @returns {object} Mock entity instance
 */
function createStandardEntity(config = {}) {
  const {
    id = 'entity1',
    name = 'John',
    gender = 'male',
    additionalComponents = new Map(),
  } = config;

  const baseComponents = new Map();

  // Add core:name component if name provided
  if (name !== null && name !== undefined) {
    baseComponents.set('core:name', { text: name });
  }

  // Add core:gender component if gender provided
  if (gender !== null && gender !== undefined) {
    baseComponents.set('core:gender', { value: gender });
  }

  // Merge additional components
  const allComponents = new Map([...baseComponents, ...additionalComponents]);

  return {
    id,
    componentTypeIds: Array.from(allComponents.keys()),
    getAllComponents: () => allComponents,
    getComponentData: function (componentId) {
      return this.getAllComponents().get(componentId);
    },
    hasComponent: function (componentId) {
      return this.getAllComponents().has(componentId);
    },
  };
}

describe('ActivityNLGSystem - Migrated Tests (Batch 3)', () => {
  let nlgSystem;
  let mockLogger;
  let mockEntityManager;
  let mockCacheManager;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEntityManager = createMockEntityManager();
    mockCacheManager = createMockCacheManager();

    // Direct instantiation (following Batch 1 & 2 pattern)
    nlgSystem = new ActivityNLGSystem({
      logger: mockLogger,
      entityManager: mockEntityManager,
      cacheManager: mockCacheManager,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Entity Name Resolution
  // ==========================================================================
  describe('Entity Name Resolution', () => {
    it('should resolve entity name from core:name component', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1032-1040
      const entity = createStandardEntity({ id: 'entity1', name: 'Alice' });
      const entityMap = new Map([['entity1', entity]]);
      mockEntityManager = createMockEntityManager(entityMap);

      nlgSystem = new ActivityNLGSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        cacheManager: mockCacheManager,
      });

      const hooks = nlgSystem.getTestHooks();
      const name = hooks.resolveEntityName('entity1');

      expect(name).toBe('Alice');
    });

    it('should fallback to entity ID when name component missing', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1042-1051
      const entity = createStandardEntity({ id: 'entity1', name: null, gender: null });
      const entityMap = new Map([['entity1', entity]]);
      mockEntityManager = createMockEntityManager(entityMap);

      nlgSystem = new ActivityNLGSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        cacheManager: mockCacheManager,
      });

      const hooks = nlgSystem.getTestHooks();
      const name = hooks.resolveEntityName('entity1');

      expect(name).toBe('entity1');
    });

    it('should handle non-existent entity gracefully', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1053-1060
      mockEntityManager = createMockEntityManager(new Map());

      nlgSystem = new ActivityNLGSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        cacheManager: mockCacheManager,
      });

      const hooks = nlgSystem.getTestHooks();
      const name = hooks.resolveEntityName('nonexistent');

      expect(name).toBe('nonexistent');
    });
  });

  // ==========================================================================
  // Gender Detection via core:gender Component
  // ==========================================================================
  describe('Gender Detection via core:gender Component', () => {
    it('should detect male gender', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1067-1075
      const entity = createStandardEntity({ id: 'entity1', gender: 'male' });
      const entityMap = new Map([['entity1', entity]]);
      mockEntityManager = createMockEntityManager(entityMap);

      nlgSystem = new ActivityNLGSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        cacheManager: mockCacheManager,
      });

      const hooks = nlgSystem.getTestHooks();
      const gender = hooks.detectEntityGender('entity1');

      expect(gender).toBe('male');
    });

    it('should detect female gender', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1077-1085
      const entity = createStandardEntity({ id: 'entity1', gender: 'female' });
      const entityMap = new Map([['entity1', entity]]);
      mockEntityManager = createMockEntityManager(entityMap);

      nlgSystem = new ActivityNLGSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        cacheManager: mockCacheManager,
      });

      const hooks = nlgSystem.getTestHooks();
      const gender = hooks.detectEntityGender('entity1');

      expect(gender).toBe('female');
    });

    it('should default to neutral when gender component missing', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1087-1096
      const entity = createStandardEntity({ id: 'entity1', gender: null });
      // Override getAllComponents to only have core:name
      entity.getAllComponents = () => new Map([['core:name', { text: 'Alex' }]]);
      const entityMap = new Map([['entity1', entity]]);
      mockEntityManager = createMockEntityManager(entityMap);

      nlgSystem = new ActivityNLGSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        cacheManager: mockCacheManager,
      });

      const hooks = nlgSystem.getTestHooks();
      const gender = hooks.detectEntityGender('entity1');

      expect(gender).toBe('neutral');
    });
  });

  // ==========================================================================
  // Pronoun Resolution (Self-Contained)
  // ==========================================================================
  describe('Pronoun Resolution (Self-Contained)', () => {
    it('should generate male pronoun set', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1104-1114
      const hooks = nlgSystem.getTestHooks();
      const pronouns = hooks.getPronounSet('male');

      expect(pronouns).toEqual({
        subject: 'he',
        object: 'him',
        possessive: 'his',
        possessivePronoun: 'his',
      });
    });

    it('should generate female pronoun set', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1116-1126
      const hooks = nlgSystem.getTestHooks();
      const pronouns = hooks.getPronounSet('female');

      expect(pronouns).toEqual({
        subject: 'she',
        object: 'her',
        possessive: 'her',
        possessivePronoun: 'hers',
      });
    });

    it('should generate neutral pronoun set', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1128-1138
      const hooks = nlgSystem.getTestHooks();
      const pronouns = hooks.getPronounSet('neutral');

      expect(pronouns).toEqual({
        subject: 'they',
        object: 'them',
        possessive: 'their',
        possessivePronoun: 'theirs',
      });
    });

    it('should get reflexive pronoun from pronoun set', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1140-1147
      const hooks = nlgSystem.getTestHooks();

      const malePronouns = hooks.getPronounSet('male');
      const reflexive = hooks.getReflexivePronoun(malePronouns);

      expect(reflexive).toBe('himself');
    });

    it('should handle female reflexive pronoun', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1149-1156
      const hooks = nlgSystem.getTestHooks();

      const femalePronouns = hooks.getPronounSet('female');
      const reflexive = hooks.getReflexivePronoun(femalePronouns);

      expect(reflexive).toBe('herself');
    });

    it('should handle neutral reflexive pronoun', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1158-1165
      const hooks = nlgSystem.getTestHooks();

      const neutralPronouns = hooks.getPronounSet('neutral');
      const reflexive = hooks.getReflexivePronoun(neutralPronouns);

      expect(reflexive).toBe('themselves');
    });
  });

  // ==========================================================================
  // Phrase Generation from Templates
  // ==========================================================================
  describe('Phrase Generation from Templates', () => {
    it('should generate phrase from simple template', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1172-1183
      // Note: Fixed to use proper activity structure with type: 'inline'
      const activity = {
        type: 'inline',
        template: '{actor} touches {target}',
        targetEntityId: 'target1',
      };
      const actorRef = 'Actor Name';

      const hooks = nlgSystem.getTestHooks();
      const phrase = hooks.generateActivityPhrase(actorRef, activity);

      expect(phrase).toContain('touches');
    });

    it('should replace {actor} placeholder', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1185-1204
      const activity = {
        type: 'inline',
        template: '{actor} performs action',
        targetEntityId: null,
      };

      const actor = createStandardEntity({ id: 'actor1', name: 'John' });
      const entityMap = new Map([['actor1', actor]]);
      mockEntityManager = createMockEntityManager(entityMap);

      nlgSystem = new ActivityNLGSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        cacheManager: mockCacheManager,
      });

      const hooks = nlgSystem.getTestHooks();
      const actorRef = 'John';
      const phrase = hooks.generateActivityPhrase(actorRef, activity);

      expect(phrase).toContain('John');
    });

    it('should replace {target} placeholder', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1206-1225
      const activity = {
        type: 'inline',
        template: '{actor} touches {target}',
        targetEntityId: 'target1',
      };

      const actor = createStandardEntity({ id: 'actor1', name: 'John' });
      const target = createStandardEntity({ id: 'target1', name: 'Alice' });
      const entityMap = new Map([
        ['actor1', actor],
        ['target1', target],
      ]);
      mockEntityManager = createMockEntityManager(entityMap);

      nlgSystem = new ActivityNLGSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        cacheManager: mockCacheManager,
      });

      const hooks = nlgSystem.getTestHooks();
      const actorRef = 'John';
      // generateActivityPhrase needs options with actorId for target resolution
      const phrase = hooks.generateActivityPhrase(actorRef, activity, false, { actorId: 'actor1' });

      expect(phrase).toContain('Alice');
    });

    it('should handle template without placeholders', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1227-1238
      const activity = {
        type: 'inline',
        template: 'a static description',
        targetEntityId: null,
      };
      const actorRef = 'Actor Name';

      const hooks = nlgSystem.getTestHooks();
      const phrase = hooks.generateActivityPhrase(actorRef, activity);

      expect(phrase).toBe('a static description');
    });
  });

  // ==========================================================================
  // Tone Modifiers (Adverbs, Softeners)
  // ==========================================================================
  describe('Tone Modifiers (Adverbs, Softeners)', () => {
    it('should merge adverbs when both present', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1245-1254
      const currentAdverb = 'gently';
      const injectedAdverb = 'softly';

      const hooks = nlgSystem.getTestHooks();
      const merged = hooks.mergeAdverb(currentAdverb, injectedAdverb);

      expect(merged).toContain('gently');
      expect(merged).toContain('softly');
    });

    it('should use injected adverb when current is null', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1256-1264
      const currentAdverb = null;
      const injectedAdverb = 'softly';

      const hooks = nlgSystem.getTestHooks();
      const merged = hooks.mergeAdverb(currentAdverb, injectedAdverb);

      expect(merged).toBe('softly');
    });

    it('should preserve current adverb when injected is null', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1266-1274
      const currentAdverb = 'gently';
      const injectedAdverb = null;

      const hooks = nlgSystem.getTestHooks();
      const merged = hooks.mergeAdverb(currentAdverb, injectedAdverb);

      expect(merged).toBe('gently');
    });

    it('should inject softener into template', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1276-1284
      const template = '{actor} touches {target}';
      const descriptor = 'gently';

      const hooks = nlgSystem.getTestHooks();
      const result = hooks.injectSoftener(template, descriptor);

      expect(result).toContain('gently');
    });

    it('should handle template without softener injection', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1286-1294
      const template = '{actor} touches {target}';
      const descriptor = '';

      const hooks = nlgSystem.getTestHooks();
      const result = hooks.injectSoftener(template, descriptor);

      expect(result).toBe(template);
    });
  });
});
