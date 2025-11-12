import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityCacheManager from '../../../src/anatomy/cache/activityCacheManager.js';
import ActivityNLGSystem from '../../../src/anatomy/services/activityNLGSystem.js';
import { ACTOR_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { createActor } from './activityNaturalLanguageTestUtils.js';

describe('ActivityNLGSystem integration coverage', () => {
  let testBed;
  let entityManager;
  let cacheManager;
  let nlgSystem;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    entityManager = testBed.entityManager;

    cacheManager = new ActivityCacheManager({
      logger: testBed.logger,
      eventBus: null,
    });
    cacheManager.registerCache('entityName', { ttl: 1000, maxSize: 50 });
    cacheManager.registerCache('gender', { ttl: 1000, maxSize: 50 });

    nlgSystem = new ActivityNLGSystem({
      logger: testBed.logger,
      entityManager,
      cacheManager,
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (cacheManager) {
      cacheManager.destroy();
    }
    await testBed.cleanup();
  });

  it('resolves and caches sanitized entity names with fallbacks', async () => {
    const rawName = '  \u200BDr.\u0007  Jane\t Doe  ';
    const actor = await createActor(entityManager, {
      id: 'actor-weird',
      name: rawName,
      gender: 'female',
    });
    await entityManager.addComponent(actor.id, ACTOR_COMPONENT_ID, { role: 'agent' });

    const sanitized = nlgSystem.sanitizeEntityName(rawName);
    expect(sanitized).toBe('Dr. Jane Doe');

    const getSpy = jest.spyOn(entityManager, 'getEntityInstance');

    const resolvedFirst = nlgSystem.resolveEntityName(actor.id);
    expect(resolvedFirst).toBe('Dr. Jane Doe');
    expect(getSpy).toHaveBeenCalledTimes(1);

    const resolvedSecond = nlgSystem.resolveEntityName(actor.id);
    expect(resolvedSecond).toBe('Dr. Jane Doe');
    expect(getSpy).toHaveBeenCalledTimes(1);

    const fallbackRawId = '   \u200Bunknown\u0000  ';
    const fallback = nlgSystem.resolveEntityName(fallbackRawId);
    expect(fallback).toBe('unknown');

    const cacheEntry = cacheManager
      ._getInternalCacheForTesting('entityName')
      .get(fallbackRawId);
    expect(cacheEntry).toBeDefined();
    expect(cacheEntry.value).toBe('unknown');
  });

  it('generates pronoun-aware phrases and caches genders for actors and targets', async () => {
    const hero = await createActor(entityManager, {
      id: 'hero-1',
      name: 'Hero Prime',
      gender: 'male',
    });
    await entityManager.addComponent(hero.id, ACTOR_COMPONENT_ID, { role: 'hero' });

    const ally = await createActor(entityManager, {
      id: 'ally-1',
      name: 'Lady Zero',
      gender: 'female',
    });
    await entityManager.addComponent(ally.id, ACTOR_COMPONENT_ID, { role: 'companion' });

    const heroPronouns = nlgSystem.getPronounSet(
      nlgSystem.detectEntityGender(hero.id)
    );
    expect(heroPronouns.subject).toBe('he');

    const reflexive = nlgSystem.getReflexivePronoun(heroPronouns);
    expect(reflexive).toBe('himself');

    const selfPhrase = nlgSystem.generateActivityPhrase(
      'Hero Prime',
      {
        type: 'inline',
        targetEntityId: hero.id,
        template: '{actor} admires {target}',
      },
      true,
      {
        actorId: hero.id,
        actorName: 'Hero Prime',
        actorPronouns: heroPronouns,
        preferReflexivePronouns: true,
      }
    );
    expect(selfPhrase).toBe('Hero Prime admires himself');

    const dedicatedPhrase = nlgSystem.generateActivityPhrase(
      'Hero Prime',
      {
        type: 'dedicated',
        verb: 'patrolling',
        adverb: 'vigilantly',
        targetEntityId: ally.id,
      },
      true,
      {
        actorId: hero.id,
        actorPronouns: heroPronouns,
      }
    );
    expect(dedicatedPhrase).toBe('Hero Prime is patrolling her vigilantly');

    expect(nlgSystem.shouldUsePronounForTarget(ally.id)).toBe(true);

    const genderCacheEntry = cacheManager
      ._getInternalCacheForTesting('gender')
      .get(ally.id);
    expect(genderCacheEntry.value).toBe('female');

    testBed.loadEntityDefinitions({
      'test:statue': {
        id: 'test:statue',
        description: 'Stone statue',
        components: {},
      },
    });
    const statue = await entityManager.createEntityInstance('test:statue', {
      instanceId: 'statue-1',
    });
    expect(nlgSystem.shouldUsePronounForTarget(statue.id)).toBe(false);

    const neutralPronouns = nlgSystem.getPronounSet('unknown');
    expect(neutralPronouns.subject).toBe('they');
  });

  it('composes activity fragments, adverbs, and descriptions end-to-end', async () => {
    const explorer = await createActor(entityManager, {
      id: 'explorer-1',
      name: 'Alex Voyager',
      gender: 'neutral',
    });
    await entityManager.addComponent(explorer.id, ACTOR_COMPONENT_ID, {
      role: 'explorer',
    });

    const pronouns = nlgSystem.getPronounSet(
      nlgSystem.detectEntityGender(explorer.id)
    );

    const decomposed = nlgSystem.generateActivityPhrase(
      'Alex Voyager',
      {
        type: 'inline',
        targetEntityId: explorer.id,
        template: '{actor} is centering {target}',
      },
      false,
      {
        actorId: explorer.id,
        actorName: 'Alex Voyager',
        actorPronouns: pronouns,
        forceReflexivePronoun: true,
        omitActor: true,
      }
    );

    expect(decomposed.fullPhrase).toBe(
      'Alex Voyager is centering themselves'
    );
    expect(decomposed.verbPhrase).toBe('is centering themselves');

    const sanitizedVerb = nlgSystem.sanitizeVerbPhrase(decomposed.verbPhrase);
    expect(sanitizedVerb).toBe('centering themselves');

    const whileFragment = nlgSystem.buildRelatedActivityFragment(
      'while',
      decomposed,
      {
        actorName: 'Alex Voyager',
        actorReference: 'they',
        actorPronouns: pronouns,
        pronounsEnabled: true,
      }
    );
    expect(whileFragment).toBe('while centering themselves');

    const fallbackFragment = nlgSystem.buildRelatedActivityFragment(
      'and',
      { fullPhrase: 'Alex hums softly', verbPhrase: '' },
      {
        actorName: 'Alex Voyager',
        actorReference: '',
        actorPronouns: pronouns,
        pronounsEnabled: false,
      }
    );
    expect(fallbackFragment).toBe('and Alex hums softly');

    expect(nlgSystem.mergeAdverb('gently', 'gently')).toBe('gently');
    expect(nlgSystem.mergeAdverb('gently', 'slowly')).toBe('gently slowly');
    expect(nlgSystem.mergeAdverb('gently', '')).toBe('gently');

    expect(
      nlgSystem.injectSoftener('{actor} embraces {target}', 'tenderly')
    ).toBe('{actor} embraces tenderly {target}');
    expect(
      nlgSystem.injectSoftener('{actor} waits alone', 'tenderly')
    ).toBe('{actor} waits alone');

    const truncated = nlgSystem.truncateDescription(
      'Sentence one. Sentence two is quite long indeed.',
      25
    );
    expect(truncated).toBe('Sentence one.');

    const formatted = nlgSystem.formatActivityDescription(
      [
        { description: 'Alex charts the nebula' },
        { description: 'They catalog new stars' },
        '',
        null,
      ],
      {
        prefix: 'Activity: ',
        suffix: '!',
        separator: ' | ',
        maxLength: 80,
      }
    );
    expect(formatted).toBe(
      'Activity: Alex charts the nebula | They catalog new stars!'
    );
  });
});
