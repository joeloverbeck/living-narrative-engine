/**
 * @file Unit tests for ActivityNLGSystem
 * @description Tests Natural Language Generation system including name resolution,
 * pronoun resolution, phrase generation, tone modifiers, and composition.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActivityNLGSystem from '../../../../src/anatomy/services/activityNLGSystem.js';

describe('ActivityNLGSystem', () => {
  let nlgSystem;
  let mockLogger;
  let mockEntityManager;
  let mockCacheManager;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    // Create mock entity manager
    mockEntityManager = {
      getEntityInstance: (entityId) => {
        if (entityId === 'test-actor-1') {
          return {
            id: 'test-actor-1',
            getComponentData: (componentId) => {
              if (componentId === 'core:name') {
                return { text: 'John Doe' };
              }
              if (componentId === 'core:gender') {
                return { value: 'male' };
              }
              return null;
            },
            hasComponent: (componentId) => {
              return componentId === 'core:actor' || componentId === 'core:gender';
            },
          };
        }
        return null;
      },
    };

    // Create mock cache manager
    mockCacheManager = {
      get: () => undefined,
      set: () => {},
      invalidate: () => {},
    };

    nlgSystem = new ActivityNLGSystem({
      logger: mockLogger,
      entityManager: mockEntityManager,
      cacheManager: mockCacheManager,
      config: {},
    });
  });

  describe('constructor', () => {
    it('should create fallback logger for invalid logger', () => {
      // ensureValidLogger creates a fallback rather than throwing
      const instance = new ActivityNLGSystem({
        logger: {},
        entityManager: mockEntityManager,
        cacheManager: mockCacheManager,
      });
      expect(instance).toBeInstanceOf(ActivityNLGSystem);
    });

    it('should require entityManager with getEntityInstance method', () => {
      expect(
        () =>
          new ActivityNLGSystem({
            logger: mockLogger,
            entityManager: {},
            cacheManager: mockCacheManager,
          })
      ).toThrow();
    });

    it('should require cacheManager with get/set/invalidate methods', () => {
      expect(
        () =>
          new ActivityNLGSystem({
            logger: mockLogger,
            entityManager: mockEntityManager,
            cacheManager: {},
          })
      ).toThrow();
    });

    it('should create instance with valid dependencies', () => {
      const instance = new ActivityNLGSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        cacheManager: mockCacheManager,
      });
      expect(instance).toBeInstanceOf(ActivityNLGSystem);
    });

    it('should accept optional config parameter', () => {
      const customConfig = { customOption: true };
      const instance = new ActivityNLGSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        cacheManager: mockCacheManager,
        config: customConfig,
      });
      expect(instance).toBeInstanceOf(ActivityNLGSystem);
    });

    it('should default config to empty object when null is provided', () => {
      const instance = new ActivityNLGSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        cacheManager: mockCacheManager,
        config: null,
      });

      expect(instance).toBeInstanceOf(ActivityNLGSystem);
    });
  });

  describe('sanitizeEntityName', () => {
    it('should return "Unknown entity" for non-string input', () => {
      expect(nlgSystem.sanitizeEntityName(null)).toBe('Unknown entity');
      expect(nlgSystem.sanitizeEntityName(undefined)).toBe('Unknown entity');
      expect(nlgSystem.sanitizeEntityName(123)).toBe('Unknown entity');
      expect(nlgSystem.sanitizeEntityName({})).toBe('Unknown entity');
    });

    it('should remove control characters', () => {
      const nameWithControl = 'John\x00Doe';
      expect(nlgSystem.sanitizeEntityName(nameWithControl)).toBe('JohnDoe');
    });

    it('should remove zero-width characters', () => {
      const nameWithZeroWidth = 'John\u200BDoe';
      expect(nlgSystem.sanitizeEntityName(nameWithZeroWidth)).toBe('JohnDoe');
    });

    it('should collapse whitespace', () => {
      const nameWithExtraSpaces = 'John  \t\n  Doe';
      expect(nlgSystem.sanitizeEntityName(nameWithExtraSpaces)).toBe('John Doe');
    });

    it('should return "Unknown entity" for empty string after sanitization', () => {
      expect(nlgSystem.sanitizeEntityName('   ')).toBe('Unknown entity');
      expect(nlgSystem.sanitizeEntityName('\u200B\u200B')).toBe('Unknown entity');
    });

    it('should handle normal names correctly', () => {
      expect(nlgSystem.sanitizeEntityName('John Doe')).toBe('John Doe');
      expect(nlgSystem.sanitizeEntityName('Alice')).toBe('Alice');
    });
  });

  describe('resolveEntityName', () => {
    it('should return "Unknown entity" for falsy entityId', () => {
      expect(nlgSystem.resolveEntityName(null)).toBe('Unknown entity');
      expect(nlgSystem.resolveEntityName(undefined)).toBe('Unknown entity');
      expect(nlgSystem.resolveEntityName('')).toBe('Unknown entity');
    });

    it('should return cached name if available', () => {
      mockCacheManager.get = (cacheName, key) => {
        if (cacheName === 'entityName' && key === 'test-actor-1') {
          return 'Cached Name';
        }
        return undefined;
      };

      expect(nlgSystem.resolveEntityName('test-actor-1')).toBe('Cached Name');
    });

    it('should resolve name from core:name component', () => {
      mockCacheManager.get = () => undefined;
      mockCacheManager.set = () => {};

      expect(nlgSystem.resolveEntityName('test-actor-1')).toBe('John Doe');
    });

    it('should cache resolved name', () => {
      let setCalled = false;
      mockCacheManager.get = () => undefined;
      mockCacheManager.set = (cacheName, key, value) => {
        if (cacheName === 'entityName' && key === 'test-actor-1' && value === 'John Doe') {
          setCalled = true;
        }
      };

      nlgSystem.resolveEntityName('test-actor-1');
      expect(setCalled).toBe(true);
    });

    it('should fallback to entityId when entity not found', () => {
      mockCacheManager.get = () => undefined;
      mockEntityManager.getEntityInstance = () => null;

      const result = nlgSystem.resolveEntityName('unknown-entity');
      expect(result).toBe('unknown-entity');
    });

    it('should handle errors gracefully', () => {
      mockCacheManager.get = () => undefined;
      mockEntityManager.getEntityInstance = () => {
        throw new Error('Test error');
      };

      const result = nlgSystem.resolveEntityName('error-entity');
      expect(result).toBe('error-entity');
    });

    it('should fallback to entity id when name component access fails', () => {
      mockCacheManager.get = () => undefined;
      mockEntityManager.getEntityInstance = (entityId) => {
        if (entityId === 'unstable-entity') {
          return {
            id: 'unstable-entity',
            getComponentData: (componentId) => {
              if (componentId === 'core:name') {
                throw new Error('component access failure');
              }
              return null;
            },
          };
        }
        return null;
      };

      mockCacheManager.set = () => {};

      const result = nlgSystem.resolveEntityName('unstable-entity');
      expect(result).toBe('unstable-entity');
    });

    it('should fallback to entity id when name component missing text', () => {
      mockCacheManager.get = () => undefined;
      mockCacheManager.set = () => {};
      mockEntityManager.getEntityInstance = (entityId) => {
        if (entityId === 'componentless') {
          return {
            id: 'componentless',
            getComponentData: () => ({ text: undefined }),
          };
        }
        return null;
      };

      const result = nlgSystem.resolveEntityName('componentless');
      expect(result).toBe('componentless');
    });

    it('should fallback to provided entityId when entity id missing', () => {
      mockCacheManager.get = () => undefined;
      mockCacheManager.set = () => {};
      mockEntityManager.getEntityInstance = (entityId) => {
        if (entityId === 'nameless') {
          return {
            getComponentData: () => null,
          };
        }
        return null;
      };

      const result = nlgSystem.resolveEntityName('nameless');
      expect(result).toBe('nameless');
    });
  });

  describe('shouldUsePronounForTarget', () => {
    it('should return false for falsy targetEntityId', () => {
      expect(nlgSystem.shouldUsePronounForTarget(null)).toBe(false);
      expect(nlgSystem.shouldUsePronounForTarget(undefined)).toBe(false);
      expect(nlgSystem.shouldUsePronounForTarget('')).toBe(false);
    });

    it('should return false when entity not found', () => {
      mockEntityManager.getEntityInstance = () => null;
      expect(nlgSystem.shouldUsePronounForTarget('unknown')).toBe(false);
    });

    it('should return true for entities with actor component', () => {
      expect(nlgSystem.shouldUsePronounForTarget('test-actor-1')).toBe(true);
    });

    it('should return true for entities with gender component', () => {
      mockEntityManager.getEntityInstance = (entityId) => {
        if (entityId === 'gendered-entity') {
          return {
            id: 'gendered-entity',
            hasComponent: (componentId) => componentId === 'core:gender',
            getComponentData: (componentId) => {
              if (componentId === 'core:gender') {
                return { value: 'female' };
              }
              return null;
            },
          };
        }
        return null;
      };

      expect(nlgSystem.shouldUsePronounForTarget('gendered-entity')).toBe(true);
    });

    it('should return false for entities without actor or gender components', () => {
      mockEntityManager.getEntityInstance = (entityId) => {
        if (entityId === 'furniture') {
          return {
            id: 'furniture',
            hasComponent: () => false,
            getComponentData: () => null,
          };
        }
        return null;
      };

      expect(nlgSystem.shouldUsePronounForTarget('furniture')).toBe(false);
    });

    it('should handle errors gracefully', () => {
      mockEntityManager.getEntityInstance = () => {
        throw new Error('Test error');
      };

      expect(nlgSystem.shouldUsePronounForTarget('error-entity')).toBe(false);
    });

    it('should use pronouns when actor component is retrieved via getComponentData', () => {
      mockEntityManager.getEntityInstance = (entityId) => {
        if (entityId === 'data-actor') {
          return {
            id: 'data-actor',
            getComponentData: (componentId) => {
              if (componentId === 'core:actor') {
                return { id: 'actor-component' };
              }
              return null;
            },
          };
        }
        return null;
      };

      expect(nlgSystem.shouldUsePronounForTarget('data-actor')).toBe(true);
    });

    it('should not use pronouns when gender component lacks value', () => {
      mockEntityManager.getEntityInstance = (entityId) => {
        if (entityId === 'unknown-gender') {
          return {
            id: 'unknown-gender',
            hasComponent: (componentId) => componentId === 'core:gender',
            getComponentData: (componentId) => {
              if (componentId === 'core:gender') {
                return { value: '' };
              }
              return null;
            },
          };
        }
        return null;
      };

      expect(nlgSystem.shouldUsePronounForTarget('unknown-gender')).toBe(false);
    });
  });

  describe('detectEntityGender', () => {
    it('should return "unknown" for falsy entityId', () => {
      expect(nlgSystem.detectEntityGender(null)).toBe('unknown');
      expect(nlgSystem.detectEntityGender(undefined)).toBe('unknown');
      expect(nlgSystem.detectEntityGender('')).toBe('unknown');
    });

    it('should return cached gender if available', () => {
      mockCacheManager.get = (cacheName, key) => {
        if (cacheName === 'gender' && key === 'test-actor-1') {
          return 'male';
        }
        return undefined;
      };

      expect(nlgSystem.detectEntityGender('test-actor-1')).toBe('male');
    });

    it('should detect gender from core:gender component', () => {
      mockCacheManager.get = () => undefined;
      mockCacheManager.set = () => {};

      expect(nlgSystem.detectEntityGender('test-actor-1')).toBe('male');
    });

    it('should cache detected gender', () => {
      let setCalled = false;
      mockCacheManager.get = () => undefined;
      mockCacheManager.set = (cacheName, key, value) => {
        if (cacheName === 'gender' && key === 'test-actor-1' && value === 'male') {
          setCalled = true;
        }
      };

      nlgSystem.detectEntityGender('test-actor-1');
      expect(setCalled).toBe(true);
    });

    it('should return "unknown" when entity not found', () => {
      mockCacheManager.get = () => undefined;
      mockEntityManager.getEntityInstance = () => null;

      expect(nlgSystem.detectEntityGender('unknown')).toBe('unknown');
    });

    it('should return "neutral" when entity has no gender component', () => {
      mockCacheManager.get = () => undefined;
      mockEntityManager.getEntityInstance = (entityId) => {
        if (entityId === 'no-gender') {
          return {
            id: 'no-gender',
            getComponentData: () => null,
          };
        }
        return null;
      };

      expect(nlgSystem.detectEntityGender('no-gender')).toBe('neutral');
    });

    it('should handle errors gracefully and return "neutral"', () => {
      mockCacheManager.get = () => undefined;
      mockEntityManager.getEntityInstance = () => {
        throw new Error('Test error');
      };

      expect(nlgSystem.detectEntityGender('error-entity')).toBe('neutral');
    });
  });

  describe('getPronounSet', () => {
    it('should return male pronouns for "male" gender', () => {
      const pronouns = nlgSystem.getPronounSet('male');
      expect(pronouns).toEqual({
        subject: 'he',
        object: 'him',
        possessive: 'his',
        possessivePronoun: 'his',
      });
    });

    it('should return female pronouns for "female" gender', () => {
      const pronouns = nlgSystem.getPronounSet('female');
      expect(pronouns).toEqual({
        subject: 'she',
        object: 'her',
        possessive: 'her',
        possessivePronoun: 'hers',
      });
    });

    it('should return neutral pronouns for "neutral" gender', () => {
      const pronouns = nlgSystem.getPronounSet('neutral');
      expect(pronouns).toEqual({
        subject: 'they',
        object: 'them',
        possessive: 'their',
        possessivePronoun: 'theirs',
      });
    });

    it('should return neutral pronouns for "unknown" gender', () => {
      const pronouns = nlgSystem.getPronounSet('unknown');
      expect(pronouns).toEqual({
        subject: 'they',
        object: 'them',
        possessive: 'their',
        possessivePronoun: 'theirs',
      });
    });

    it('should return neutral pronouns for unrecognized gender', () => {
      const pronouns = nlgSystem.getPronounSet('invalid');
      expect(pronouns).toEqual({
        subject: 'they',
        object: 'them',
        possessive: 'their',
        possessivePronoun: 'theirs',
      });
    });
  });

  describe('getReflexivePronoun', () => {
    it('should return "himself" for "he" subject', () => {
      const pronouns = { subject: 'he' };
      expect(nlgSystem.getReflexivePronoun(pronouns)).toBe('himself');
    });

    it('should return "herself" for "she" subject', () => {
      const pronouns = { subject: 'she' };
      expect(nlgSystem.getReflexivePronoun(pronouns)).toBe('herself');
    });

    it('should return "itself" for "it" subject', () => {
      const pronouns = { subject: 'it' };
      expect(nlgSystem.getReflexivePronoun(pronouns)).toBe('itself');
    });

    it('should return "myself" for "i" subject', () => {
      const pronouns = { subject: 'i' };
      expect(nlgSystem.getReflexivePronoun(pronouns)).toBe('myself');
    });

    it('should return "yourself" for "you" subject', () => {
      const pronouns = { subject: 'you' };
      expect(nlgSystem.getReflexivePronoun(pronouns)).toBe('yourself');
    });

    it('should return "ourselves" for "we" subject', () => {
      const pronouns = { subject: 'we' };
      expect(nlgSystem.getReflexivePronoun(pronouns)).toBe('ourselves');
    });

    it('should return "themselves" for "they" subject', () => {
      const pronouns = { subject: 'they' };
      expect(nlgSystem.getReflexivePronoun(pronouns)).toBe('themselves');
    });

    it('should return "themselves" for unrecognized subject', () => {
      const pronouns = { subject: 'unknown' };
      expect(nlgSystem.getReflexivePronoun(pronouns)).toBe('themselves');
    });

    it('should handle null/undefined pronouns', () => {
      expect(nlgSystem.getReflexivePronoun(null)).toBe('themselves');
      expect(nlgSystem.getReflexivePronoun(undefined)).toBe('themselves');
      expect(nlgSystem.getReflexivePronoun({})).toBe('themselves');
    });

    it('should be case-insensitive', () => {
      const pronouns = { subject: 'HE' };
      expect(nlgSystem.getReflexivePronoun(pronouns)).toBe('himself');
    });
  });

  describe('generateActivityPhrase', () => {
    it('should generate phrase with actorRef', () => {
      const actorRef = 'John';
      const activity = { verb: 'kisses', targetEntityId: 'test-actor-1' };
      const usePronounsForTarget = false;
      const options = { actorId: 'actor-1', actorName: 'John' };

      const result = nlgSystem.generateActivityPhrase(actorRef, activity, usePronounsForTarget, options);
      expect(typeof result).toBe('string');
    });

    it('should handle dedicated activity with adverb', () => {
      const actorRef = 'John';
      const activity = {
        type: 'dedicated',
        verb: 'kisses',
        adverb: 'passionately',
        targetEntityId: 'test-actor-1'
      };
      const options = { actorId: 'actor-1', actorName: 'John' };

      const result = nlgSystem.generateActivityPhrase(actorRef, activity, false, options);
      expect(result).toContain('kisses');
      expect(result).toContain('passionately');
    });

    it('should handle self-targeting with reflexive pronouns', () => {
      const actorRef = 'John';
      const activity = { verb: 'stretches', targetEntityId: 'test-actor-1' };
      const usePronounsForTarget = true;
      const options = {
        actorId: 'test-actor-1',
        actorName: 'John',
        actorPronouns: { subject: 'he', object: 'him' },
        forceReflexivePronoun: true
      };

      const result = nlgSystem.generateActivityPhrase(actorRef, activity, usePronounsForTarget, options);
      expect(result).toContain('himself');
    });

    it('should return decomposed components when omitActor is true', () => {
      const actorRef = 'John (Hero)';
      const activity = {
        type: 'inline',
        description: 'is observing the horizon',
      };

      const result = nlgSystem.generateActivityPhrase(actorRef, activity, false, {
        omitActor: true,
      });

      expect(result).toEqual({
        fullPhrase: 'John (Hero) is observing the horizon',
        verbPhrase: 'is observing the horizon',
      });
    });

    it('should use object pronoun for self-target when reflexive not preferred', () => {
      const actorRef = 'John';
      const activity = { verb: 'supports', targetEntityId: 'test-actor-1' };
      const options = {
        actorId: 'test-actor-1',
        actorPronouns: { subject: 'he', object: 'him' },
        preferReflexivePronouns: false,
      };

      const result = nlgSystem.generateActivityPhrase(
        actorRef,
        activity,
        true,
        options
      );

      expect(result).toContain('him');
    });

    it('should fallback to actor name when self-target pronouns are disabled', () => {
      const actorRef = 'John';
      const activity = { verb: 'examines', targetEntityId: 'test-actor-1' };
      const options = {
        actorId: 'test-actor-1',
        actorName: 'John',
      };

      const result = nlgSystem.generateActivityPhrase(
        actorRef,
        activity,
        false,
        options
      );

      expect(result).toContain('examines John');
    });

    it('should use target pronouns for non-self targets when enabled', () => {
      mockCacheManager.get = () => undefined;
      mockEntityManager.getEntityInstance = (entityId) => {
        if (entityId === 'test-actor-1') {
          return {
            id: 'test-actor-1',
            getComponentData: (componentId) => {
              if (componentId === 'core:gender') {
                return { value: 'male' };
              }
              if (componentId === 'core:name') {
                return { text: 'John Doe' };
              }
              return null;
            },
            hasComponent: (componentId) =>
              componentId === 'core:actor' || componentId === 'core:gender',
          };
        }
        if (entityId === 'listener-1') {
          return {
            id: 'listener-1',
            getComponentData: (componentId) => {
              if (componentId === 'core:gender') {
                return { value: 'female' };
              }
              if (componentId === 'core:name') {
                return { text: 'Audience Member' };
              }
              return null;
            },
            hasComponent: (componentId) => componentId === 'core:gender',
          };
        }
        return null;
      };

      const actorRef = 'John';
      const activity = {
        type: 'inline',
        template: '{actor} thanks {target}',
        targetEntityId: 'listener-1',
      };

      const result = nlgSystem.generateActivityPhrase(actorRef, activity, true, {
        actorId: 'test-actor-1',
      });

      expect(result).toBe('John thanks her');
    });

    it('should handle dedicated activities without targets', () => {
      const result = nlgSystem.generateActivityPhrase(
        'John',
        { type: 'dedicated', verb: 'meditating' },
        false,
        {}
      );

      expect(result).toBe('John is meditating');
    });

    it('should return empty components when omitActor is true and phrase blank', () => {
      const result = nlgSystem.generateActivityPhrase(
        'John',
        { description: '   ' },
        false,
        { omitActor: true }
      );

      expect(result).toEqual({ fullPhrase: '', verbPhrase: '' });
    });

    it('should integrate target name into descriptive phrases', () => {
      mockCacheManager.get = () => undefined;
      mockEntityManager.getEntityInstance = (entityId) => {
        if (entityId === 'test-actor-1') {
          return {
            id: 'test-actor-1',
            getComponentData: (componentId) => {
              if (componentId === 'core:name') {
                return { text: 'John' };
              }
              if (componentId === 'core:gender') {
                return { value: 'male' };
              }
              return null;
            },
            hasComponent: (componentId) =>
              componentId === 'core:actor' || componentId === 'core:gender',
          };
        }
        if (entityId === 'target-1') {
          return {
            id: 'target-1',
            getComponentData: (componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Target' };
              }
              return null;
            },
            hasComponent: () => false,
          };
        }
        return null;
      };

      const result = nlgSystem.generateActivityPhrase(
        'John',
        { description: 'greets', targetEntityId: 'target-1' },
        false,
        { actorId: 'test-actor-1' }
      );

      expect(result).toBe('John greets Target');
    });

    it('should skip actor token removal when actor reference absent', () => {
      const activity = { verb: 'meditates' };
      const result = nlgSystem.generateActivityPhrase(
        '   ',
        activity,
        false,
        { omitActor: true }
      );

      expect(result).toEqual({
        fullPhrase: 'meditates',
        verbPhrase: 'meditates',
      });
    });

    it('should resolve actor name when provided actorName is not a string', () => {
      mockCacheManager.get = () => undefined;
      mockEntityManager.getEntityInstance = (entityId) => {
        if (entityId === 'actor-without-name') {
          return {
            id: 'actor-without-name',
            getComponentData: (componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Resolved Name' };
              }
              if (componentId === 'core:gender') {
                return { value: 'neutral' };
              }
              return null;
            },
            hasComponent: (componentId) => componentId === 'core:actor',
          };
        }
        return null;
      };

      const result = nlgSystem.generateActivityPhrase(
        'Resolved Name',
        { description: 'waves', targetEntityId: 'actor-without-name' },
        false,
        { actorId: 'actor-without-name', actorName: 123 }
      );

      expect(result).toBe('Resolved Name waves Resolved Name');
    });

    it('should fallback to resolved target name when pronoun candidate missing', () => {
      const pronounSpy = jest
        .spyOn(nlgSystem, 'getPronounSet')
        .mockImplementation(() => ({ subject: 'they' }));

      mockCacheManager.get = () => undefined;
      mockCacheManager.set = () => {};
      mockEntityManager.getEntityInstance = (entityId) => {
        if (entityId === 'speaker') {
          return {
            id: 'speaker',
            getComponentData: (componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Speaker' };
              }
              if (componentId === 'core:gender') {
                return { value: 'neutral' };
              }
              return null;
            },
            hasComponent: (componentId) => componentId === 'core:actor',
          };
        }
        if (entityId === 'audience') {
          return {
            id: 'audience',
            getComponentData: (componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Audience' };
              }
              if (componentId === 'core:gender') {
                return { value: 'unknown' };
              }
              return null;
            },
            hasComponent: (componentId) => componentId === 'core:gender',
          };
        }
        return null;
      };

      const result = nlgSystem.generateActivityPhrase(
        'Speaker',
        { description: 'addresses', targetEntityId: 'audience' },
        true,
        { actorId: 'speaker' }
      );

      expect(result).toBe('Speaker addresses Audience');
      pronounSpy.mockRestore();
    });

    it('should use default dedicated verb when verb missing', () => {
      const result = nlgSystem.generateActivityPhrase(
        'John',
        { type: 'dedicated' },
        false,
        {}
      );

      expect(result).toBe('John is interacting with');
    });
  });

  describe('generateActivityPhrase - multi-target support', () => {
    let multiTargetEntityManager;

    beforeEach(() => {
      // Set up entity manager that can resolve multiple item names
      multiTargetEntityManager = {
        getEntityInstance: (entityId) => {
          const entities = {
            'sword-1': { id: 'sword-1', getComponentData: (cid) => cid === 'core:name' ? { text: 'sword' } : null },
            'dagger-2': { id: 'dagger-2', getComponentData: (cid) => cid === 'core:name' ? { text: 'dagger' } : null },
            'staff-3': { id: 'staff-3', getComponentData: (cid) => cid === 'core:name' ? { text: 'staff' } : null },
          };
          return entities[entityId] || null;
        },
      };

      nlgSystem = new ActivityNLGSystem({
        logger: mockLogger,
        entityManager: multiTargetEntityManager,
        cacheManager: mockCacheManager,
        config: {},
      });
    });

    it('should format single item in targetEntityIds', () => {
      const activity = {
        isMultiTarget: true,
        targetEntityIds: ['sword-1'],
        template: '{actor} is wielding {targets} threateningly',
      };

      const result = nlgSystem.generateActivityPhrase('Alice', activity);
      expect(result).toBe('Alice is wielding sword threateningly');
    });

    it('should format two items with "and" conjunction', () => {
      const activity = {
        isMultiTarget: true,
        targetEntityIds: ['sword-1', 'dagger-2'],
        template: '{actor} is wielding {targets} threateningly',
      };

      const result = nlgSystem.generateActivityPhrase('Alice', activity);
      expect(result).toBe('Alice is wielding sword and dagger threateningly');
    });

    it('should format three items with Oxford comma', () => {
      const activity = {
        isMultiTarget: true,
        targetEntityIds: ['sword-1', 'dagger-2', 'staff-3'],
        template: '{actor} is wielding {targets} threateningly',
      };

      const result = nlgSystem.generateActivityPhrase('Alice', activity);
      expect(result).toBe('Alice is wielding sword, dagger, and staff threateningly');
    });

    it('should handle empty targetEntityIds array gracefully', () => {
      const activity = {
        isMultiTarget: true,
        targetEntityIds: [],
        template: '{actor} is wielding {targets} threateningly',
      };

      const result = nlgSystem.generateActivityPhrase('Alice', activity);
      // With empty list, template becomes "Alice is wielding  threateningly"
      expect(result).toBe('Alice is wielding  threateningly');
    });

    it('should use fallback phrase when no template provided', () => {
      const activity = {
        isMultiTarget: true,
        targetEntityIds: ['sword-1', 'dagger-2'],
      };

      const result = nlgSystem.generateActivityPhrase('Alice', activity);
      expect(result).toBe('Alice is with sword and dagger');
    });

    it('should not affect non-multi-target activities (backward compatibility)', () => {
      // Reset to standard mock that has test-actor-1
      nlgSystem = new ActivityNLGSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        cacheManager: mockCacheManager,
        config: {},
      });

      const activity = {
        type: 'inline',
        template: '{actor} thanks {target}',
        targetEntityId: 'test-actor-1',
      };

      const result = nlgSystem.generateActivityPhrase('Bob', activity);
      expect(result).toBe('Bob thanks John Doe');
    });
  });

  describe('sanitizeVerbPhrase', () => {
    it('should remove leading/trailing whitespace', () => {
      expect(nlgSystem.sanitizeVerbPhrase('  kisses  ')).toBe('kisses');
    });

    it('should remove copula (is/are/was/were/am)', () => {
      expect(nlgSystem.sanitizeVerbPhrase('is kissing')).toBe('kissing');
      expect(nlgSystem.sanitizeVerbPhrase('are running')).toBe('running');
    });

    it('should return empty string for falsy input', () => {
      expect(nlgSystem.sanitizeVerbPhrase(null)).toBe('');
      expect(nlgSystem.sanitizeVerbPhrase(undefined)).toBe('');
      expect(nlgSystem.sanitizeVerbPhrase('')).toBe('');
    });

    it('should handle normal phrases', () => {
      expect(nlgSystem.sanitizeVerbPhrase('kisses')).toBe('kisses');
    });

    it('should return empty string for whitespace-only phrases', () => {
      expect(nlgSystem.sanitizeVerbPhrase('   ')).toBe('');
    });
  });

  describe('buildRelatedActivityFragment', () => {
    it('should build fragment with conjunction "while"', () => {
      const conjunction = 'while';
      const phraseComponents = { verbPhrase: 'smiling', fullPhrase: 'is smiling' };
      const context = {
        actorName: 'John',
        actorReference: 'John',
        actorPronouns: { subject: 'he' },
        pronounsEnabled: false
      };

      const result = nlgSystem.buildRelatedActivityFragment(conjunction, phraseComponents, context);
      expect(result).toContain('while');
    });

    it('should handle "and" conjunction', () => {
      const conjunction = 'and';
      const phraseComponents = { verbPhrase: 'laughing', fullPhrase: 'laughing' };
      const context = {
        actorName: 'John',
        actorReference: 'John',
        actorPronouns: { subject: 'he' },
        pronounsEnabled: false
      };

      const result = nlgSystem.buildRelatedActivityFragment(conjunction, phraseComponents, context);
      expect(result).toContain('and');
    });

    it('should return empty string when phrase components are missing', () => {
      const context = {
        actorName: 'John',
        actorReference: 'John',
        actorPronouns: { subject: 'he' },
        pronounsEnabled: true,
      };

      const result = nlgSystem.buildRelatedActivityFragment('and', null, context);
      expect(result).toBe('');
    });

    it('should return empty string when both sanitized and fallback phrases are empty', () => {
      const context = {
        actorName: 'John',
        actorReference: 'John',
        actorPronouns: { subject: 'he' },
        pronounsEnabled: false,
      };

      const result = nlgSystem.buildRelatedActivityFragment('and', {
        verbPhrase: '   ',
        fullPhrase: '   ',
      }, context);

      expect(result).toBe('');
    });

    it('should return while fragment when copula is removed', () => {
      const context = {
        actorName: 'John',
        actorReference: 'John',
        actorPronouns: { subject: 'he' },
        pronounsEnabled: false,
      };

      const result = nlgSystem.buildRelatedActivityFragment('while', {
        verbPhrase: 'is running',
        fullPhrase: 'is running',
      }, context);

      expect(result).toBe('while running');
    });

    it('should include subject when pronouns are enabled', () => {
      const context = {
        actorName: 'John',
        actorReference: 'John',
        actorPronouns: { subject: 'he' },
        pronounsEnabled: true,
      };

      const result = nlgSystem.buildRelatedActivityFragment('while', {
        verbPhrase: 'running quickly',
        fullPhrase: 'running quickly',
      }, context);

      expect(result).toBe('while he running quickly');
    });

    it('should fallback to sanitized phrase when subject reference missing', () => {
      const context = {
        actorName: '',
        actorReference: '',
        actorPronouns: {},
        pronounsEnabled: false,
      };

      const result = nlgSystem.buildRelatedActivityFragment('while', {
        verbPhrase: 'running',
        fullPhrase: 'running',
      }, context);

      expect(result).toBe('while running');
    });

    it('should fallback to full phrase when sanitized verb phrase missing', () => {
      const context = {
        actorName: 'John',
        actorReference: 'John',
        actorPronouns: { subject: 'he' },
        pronounsEnabled: true,
      };

      const result = nlgSystem.buildRelatedActivityFragment('while', {
        verbPhrase: '   ',
        fullPhrase: 'is smiling brightly',
      }, context);

      expect(result).toBe('while is smiling brightly');
    });
  });

  describe('mergeAdverb', () => {
    it('should use injected adverb when current is null', () => {
      expect(nlgSystem.mergeAdverb(null, 'gently')).toBe('gently');
    });

    it('should keep current adverb when injected is null', () => {
      expect(nlgSystem.mergeAdverb('softly', null)).toBe('softly');
    });

    it('should merge adverbs when both exist', () => {
      const result = nlgSystem.mergeAdverb('softly', 'firmly');
      expect(result).toContain('softly');
      expect(result).toContain('firmly');
    });

    it('should return empty string when both are null', () => {
      expect(nlgSystem.mergeAdverb(null, null)).toBe('');
    });

    it('should handle empty strings as null', () => {
      expect(nlgSystem.mergeAdverb('', 'gently')).toBe('gently');
      expect(nlgSystem.mergeAdverb('softly', '')).toBe('softly');
    });

    it('should avoid duplicating adverbs', () => {
      const result = nlgSystem.mergeAdverb('softly', 'softly');
      expect(result).toBe('softly');
    });
  });

  describe('injectSoftener', () => {
    it('should inject softener into template with {target} placeholder', () => {
      const template = 'kisses {target}';
      const descriptor = 'gently';

      const result = nlgSystem.injectSoftener(template, descriptor);
      expect(result).toBe('kisses gently {target}');
    });

    it('should return template unchanged when descriptor is null', () => {
      const template = 'kisses {target}';

      expect(nlgSystem.injectSoftener(template, null)).toBe(template);
    });

    it('should return null when template is null', () => {
      const result = nlgSystem.injectSoftener(null, 'gently');
      expect(result).toBe(null);
    });

    it('should not inject if template lacks {target} placeholder', () => {
      const template = 'kisses';
      const descriptor = 'gently';

      expect(nlgSystem.injectSoftener(template, descriptor)).toBe(template);
    });

    it('should ignore descriptors that trim to empty strings', () => {
      const template = 'embraces {target}';

      expect(nlgSystem.injectSoftener(template, '   ')).toBe(template);
    });

    it('should avoid duplicating existing descriptors', () => {
      const template = 'embraces gently {target}';

      expect(nlgSystem.injectSoftener(template, 'gently')).toBe(template);
    });
  });

  describe('truncateDescription', () => {
    it('should truncate text longer than maxLength', () => {
      const longText = 'a'.repeat(500);
      const result = nlgSystem.truncateDescription(longText, 100);

      expect(result.length).toBeLessThanOrEqual(103); // 100 + "..."
      expect(result).toMatch(/\.\.\.$/);
    });

    it('should not truncate text shorter than maxLength', () => {
      const shortText = 'Short description';
      const result = nlgSystem.truncateDescription(shortText, 100);

      expect(result).toBe(shortText);
    });

    it('should handle null/undefined input', () => {
      expect(nlgSystem.truncateDescription(null, 100)).toBe('');
      expect(nlgSystem.truncateDescription(undefined, 100)).toBe('');
    });

    it('should use default maxLength when not provided', () => {
      const longText = 'a'.repeat(5000);
      const result = nlgSystem.truncateDescription(longText);

      expect(result.length).toBeLessThan(5000);
      expect(result).toMatch(/\.\.\.$/);
    });

    it('should return empty string for whitespace-only values', () => {
      expect(nlgSystem.truncateDescription('   ', 50)).toBe('');
    });

    it('should return trimmed text when maxLength is invalid', () => {
      const text = 'Short description.';
      expect(nlgSystem.truncateDescription(text, 0)).toBe('Short description.');
      expect(nlgSystem.truncateDescription(text, Number.POSITIVE_INFINITY)).toBe(
        'Short description.'
      );
    });

    it('should prefer full sentences when truncating', () => {
      const text = 'Sentence one. Sentence two is longer and should be removed.';
      const result = nlgSystem.truncateDescription(text, 25);

      expect(result).toBe('Sentence one.');
    });
  });

  describe('formatActivityDescription', () => {
    it('should return empty string for invalid or empty groups', () => {
      expect(nlgSystem.formatActivityDescription(null)).toBe('');
      expect(nlgSystem.formatActivityDescription([])).toBe('');
    });

    it('should filter invalid entries and compose description', () => {
      const groups = [
        { description: 'First event' },
        null,
        'Second event',
        { description: '   ' },
      ];

      const result = nlgSystem.formatActivityDescription(groups, {
        prefix: 'Before: ',
        suffix: ' :After',
        separator: ' & ',
        maxLength: 200,
      });

      expect(result).toBe('Before: First event & Second event :After');
    });

    it('should return empty string when no descriptions resolved', () => {
      const groups = [null, { description: '' }, { description: '   ' }];

      expect(nlgSystem.formatActivityDescription(groups)).toBe('');
    });

    it('should respect maxLength when composing description', () => {
      const groups = [
        { description: 'Sentence one' },
        { description: 'Sentence two' },
      ];

      const result = nlgSystem.formatActivityDescription(groups, {
        maxLength: 20,
      });

      expect(result).toBe('Sentence one.');
    });
  });

  describe('getTestHooks', () => {
    it('should return all 12 required test hooks', () => {
      const hooks = nlgSystem.getTestHooks();

      expect(hooks).toHaveProperty('resolveEntityName');
      expect(hooks).toHaveProperty('sanitizeEntityName');
      expect(hooks).toHaveProperty('shouldUsePronounForTarget');
      expect(hooks).toHaveProperty('detectEntityGender');
      expect(hooks).toHaveProperty('getPronounSet');
      expect(hooks).toHaveProperty('getReflexivePronoun');
      expect(hooks).toHaveProperty('generateActivityPhrase');
      expect(hooks).toHaveProperty('sanitizeVerbPhrase');
      expect(hooks).toHaveProperty('buildRelatedActivityFragment');
      expect(hooks).toHaveProperty('mergeAdverb');
      expect(hooks).toHaveProperty('injectSoftener');
      expect(hooks).toHaveProperty('truncateDescription');
    });

    it('should have all hooks as callable functions', () => {
      const hooks = nlgSystem.getTestHooks();

      expect(typeof hooks.resolveEntityName).toBe('function');
      expect(typeof hooks.sanitizeEntityName).toBe('function');
      expect(typeof hooks.shouldUsePronounForTarget).toBe('function');
      expect(typeof hooks.detectEntityGender).toBe('function');
      expect(typeof hooks.getPronounSet).toBe('function');
      expect(typeof hooks.getReflexivePronoun).toBe('function');
      expect(typeof hooks.generateActivityPhrase).toBe('function');
      expect(typeof hooks.sanitizeVerbPhrase).toBe('function');
      expect(typeof hooks.buildRelatedActivityFragment).toBe('function');
      expect(typeof hooks.mergeAdverb).toBe('function');
      expect(typeof hooks.injectSoftener).toBe('function');
      expect(typeof hooks.truncateDescription).toBe('function');
    });

    it('should execute test hooks successfully', () => {
      const hooks = nlgSystem.getTestHooks();

      expect(hooks.sanitizeEntityName('John Doe')).toBe('John Doe');
      expect(hooks.getPronounSet('male').subject).toBe('he');

      expect(hooks.resolveEntityName('test-actor-1')).toBe('John Doe');
      expect(hooks.detectEntityGender('test-actor-1')).toBe('male');
      expect(hooks.getReflexivePronoun({ subject: 'they' })).toBe('themselves');

      // mergeAdverb concatenates adverbs unless one contains the other
      const mergedResult = hooks.mergeAdverb('soft', 'gentle');
      expect(mergedResult).toContain('soft');
      expect(mergedResult).toContain('gentle');

      expect(hooks.shouldUsePronounForTarget('test-actor-1')).toBe(true);
      expect(
        hooks.generateActivityPhrase('John', { description: 'smiles' }, false)
      ).toBe('John smiles');
      expect(hooks.sanitizeVerbPhrase(' is walking')).toBe('walking');
      expect(
        hooks.buildRelatedActivityFragment(
          'and',
          { verbPhrase: 'walking', fullPhrase: 'walking' },
          {
            actorName: 'John',
            actorReference: 'John',
            actorPronouns: { subject: 'he' },
            pronounsEnabled: false,
          }
        )
      ).toBe('and walking');
      expect(hooks.injectSoftener('greets {target}', 'warmly')).toBe(
        'greets warmly {target}'
      );
      expect(hooks.truncateDescription('A tiny phrase.', 100)).toBe(
        'A tiny phrase.'
      );
    });
  });
});
