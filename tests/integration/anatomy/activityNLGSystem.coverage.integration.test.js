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

  it('covers fallback branches, additional phrase flows, and test hook exposure', async () => {
    const captain = await createActor(entityManager, {
      id: 'captain-1',
      name: 'Captain Flux',
      gender: 'male',
    });
    await entityManager.addComponent(captain.id, ACTOR_COMPONENT_ID, {
      role: 'captain',
    });

    const partner = await createActor(entityManager, {
      id: 'partner-1',
      name: 'Lady Aurora',
      gender: 'female',
    });
    await entityManager.addComponent(partner.id, ACTOR_COMPONENT_ID, {
      role: 'navigator',
    });

    const captainPronouns = nlgSystem.getPronounSet(
      nlgSystem.detectEntityGender(captain.id)
    );

    const inlineDescriptionPhrase = nlgSystem.generateActivityPhrase(
      'Captain Flux',
      {
        type: 'inline',
        targetEntityId: captain.id,
        description: 'salutes',
      },
      true,
      {
        actorId: captain.id,
        actorName: 'Captain Flux',
        actorPronouns: captainPronouns,
        preferReflexivePronouns: false,
      }
    );
    expect(inlineDescriptionPhrase).toBe('Captain Flux salutes him');

    const dedicatedNoTarget = nlgSystem.generateActivityPhrase(
      'Captain Flux',
      {
        type: 'dedicated',
        verb: 'scouting',
        adverb: 'silently',
      },
      false
    );
    expect(dedicatedNoTarget).toBe('Captain Flux is scouting silently');

    const customDescriptionWithTarget = nlgSystem.generateActivityPhrase(
      'Captain Flux',
      {
        type: 'custom',
        description: 'observes carefully',
        targetEntityId: partner.id,
      },
      false,
      {
        actorId: captain.id,
      }
    );
    expect(customDescriptionWithTarget).toBe(
      'Captain Flux observes carefully Lady Aurora'
    );

    const verbOnlyWithPronoun = nlgSystem.generateActivityPhrase(
      'Captain Flux',
      {
        verb: 'reassures',
        targetEntityId: partner.id,
      },
      true,
      {
        actorId: captain.id,
      }
    );
    expect(verbOnlyWithPronoun).toBe('Captain Flux reassures her');

    const emptyDecomposition = nlgSystem.generateActivityPhrase(
      '',
      { type: 'inline' },
      false,
      { omitActor: true }
    );
    expect(emptyDecomposition).toEqual({ fullPhrase: '', verbPhrase: '' });

    expect(nlgSystem.sanitizeVerbPhrase(null)).toBe('');
    expect(nlgSystem.sanitizeVerbPhrase('   ')).toBe('');
    expect(nlgSystem.sanitizeVerbPhrase(' were waiting')).toBe('waiting');

    const commonContext = {
      actorName: 'Captain Flux',
      actorReference: 'Captain Flux',
      actorPronouns: captainPronouns,
      pronounsEnabled: false,
    };

    expect(
      nlgSystem.buildRelatedActivityFragment('and', null, commonContext)
    ).toBe('');

    expect(
      nlgSystem.buildRelatedActivityFragment(
        'and',
        { fullPhrase: '', verbPhrase: '   ' },
        commonContext
      )
    ).toBe('');

    const whileWithSubject = nlgSystem.buildRelatedActivityFragment(
      'while',
      { fullPhrase: 'Captain Flux patrols the rim', verbPhrase: 'patrols the rim' },
      {
        actorName: 'Captain Flux',
        actorReference: '',
        actorPronouns: captainPronouns,
        pronounsEnabled: true,
      }
    );
    expect(whileWithSubject).toBe('while he patrols the rim');

    const whileFallback = nlgSystem.buildRelatedActivityFragment(
      'while',
      { fullPhrase: 'Captain Flux hums softly', verbPhrase: '' },
      {
        actorName: 'Captain Flux',
        actorReference: '',
        actorPronouns: captainPronouns,
        pronounsEnabled: false,
      }
    );
    expect(whileFallback).toBe('while Captain Flux hums softly');

    const whileWithoutSubject = nlgSystem.buildRelatedActivityFragment(
      'while',
      { fullPhrase: '', verbPhrase: 'observing quietly' },
      {
        actorName: '',
        actorReference: '',
        actorPronouns: captainPronouns,
        pronounsEnabled: false,
      }
    );
    expect(whileWithoutSubject).toBe('while observing quietly');

    const defaultConjunction = nlgSystem.buildRelatedActivityFragment(
      undefined,
      { fullPhrase: 'Captain Flux scans the horizon', verbPhrase: 'scanning the horizon' },
      commonContext
    );
    expect(defaultConjunction).toBe('and scanning the horizon');

    expect(nlgSystem.mergeAdverb('', 'carefully')).toBe('carefully');

    expect(nlgSystem.injectSoftener('{actor} greets {target}', '')).toBe(
      '{actor} greets {target}'
    );
    expect(nlgSystem.injectSoftener('{actor} greets {target}', '   ')).toBe(
      '{actor} greets {target}'
    );
    expect(
      nlgSystem.injectSoftener('{actor} greets {target}', 'warmly')
    ).toBe('{actor} greets warmly {target}');
    expect(
      nlgSystem.injectSoftener(
        '{actor} greets warmly {target}',
        'warmly'
      )
    ).toBe('{actor} greets warmly {target}');
    expect(nlgSystem.injectSoftener(null, 'warmly')).toBeNull();

    expect(nlgSystem.truncateDescription(12345, 10)).toBe('');
    expect(nlgSystem.truncateDescription('   ', 10)).toBe('');
    expect(nlgSystem.truncateDescription('Short sentence', 0)).toBe(
      'Short sentence'
    );
    expect(
      nlgSystem.truncateDescription(
        'No period but definitely long enough to be shortened',
        10
      )
    ).toBe('No peri...');

    expect(nlgSystem.formatActivityDescription(null)).toBe('');
    expect(nlgSystem.formatActivityDescription([])).toBe('');
    expect(
      nlgSystem.formatActivityDescription(
        ['', '   ', null, { description: '   ' }],
        {}
      )
    ).toBe('');

    const hooks = nlgSystem.getTestHooks();
    expect(hooks).toEqual(
      expect.objectContaining({
        resolveEntityName: expect.any(Function),
        sanitizeEntityName: expect.any(Function),
        generateActivityPhrase: expect.any(Function),
        truncateDescription: expect.any(Function),
      })
    );

    expect(hooks.mergeAdverb('', 'carefully')).toBe('carefully');
    expect(hooks.injectSoftener('{actor} meets {target}', 'warmly')).toBe(
      '{actor} meets warmly {target}'
    );
    expect(hooks.truncateDescription('Condensed statement here.', 15)).toBe(
      'Condensed st...'
    );
    expect(hooks.shouldUsePronounForTarget(partner.id)).toBe(true);
  });

  it('handles error flows for name/gender resolution and exercises remaining hooks', async () => {
    const originalGetEntityInstance = entityManager.getEntityInstance.bind(
      entityManager
    );
    const getEntityInstanceSpy = jest
      .spyOn(entityManager, 'getEntityInstance')
      .mockImplementation((...args) => originalGetEntityInstance(...args));

    expect(nlgSystem.sanitizeEntityName(123)).toBe('Unknown entity');
    expect(nlgSystem.sanitizeEntityName(' \u200B\u200C ')).toBe('Unknown entity');
    expect(nlgSystem.resolveEntityName('')).toBe('Unknown entity');

    const glitchActor = await createActor(entityManager, {
      id: 'glitch-actor',
      name: 'Glitch Actor',
      gender: 'male',
    });
    await entityManager.addComponent(glitchActor.id, ACTOR_COMPONENT_ID, {
      role: 'glitch',
    });

    const glitchEntity = originalGetEntityInstance(glitchActor.id);
    jest.spyOn(glitchEntity, 'getComponentData').mockImplementation(() => {
      throw new Error('component failure');
    });

    expect(nlgSystem.resolveEntityName(glitchActor.id)).toBe(glitchActor.id);

    getEntityInstanceSpy.mockImplementationOnce(() => {
      throw new Error('lookup failure');
    });
    expect(nlgSystem.resolveEntityName('problematic-id')).toBe('problematic-id');

    expect(nlgSystem.shouldUsePronounForTarget()).toBe(false);
    expect(nlgSystem.shouldUsePronounForTarget('missing-target')).toBe(false);

    const pronounTarget = await createActor(entityManager, {
      id: 'pronoun-target',
      name: 'Pronoun Target',
      gender: 'female',
    });
    await entityManager.addComponent(pronounTarget.id, ACTOR_COMPONENT_ID, {
      role: 'ally',
    });

    const pronounEntity = originalGetEntityInstance(pronounTarget.id);
    pronounEntity.hasComponent = undefined;
    expect(nlgSystem.shouldUsePronounForTarget(pronounTarget.id)).toBe(true);

    getEntityInstanceSpy.mockImplementationOnce(() => {
      throw new Error('target lookup failure');
    });
    expect(nlgSystem.shouldUsePronounForTarget('error-target')).toBe(false);

    expect(nlgSystem.detectEntityGender()).toBe('unknown');
    expect(nlgSystem.detectEntityGender('missing-gender')).toBe('unknown');

    const neutralEntity = await createActor(entityManager, {
      id: 'neutral-entity',
      name: 'Neutral Entity',
    });
    await entityManager.addComponent(neutralEntity.id, ACTOR_COMPONENT_ID, {
      role: 'observer',
    });

    expect(nlgSystem.detectEntityGender(neutralEntity.id)).toBe('neutral');

    getEntityInstanceSpy.mockImplementationOnce(() => {
      throw new Error('gender failure');
    });
    expect(nlgSystem.detectEntityGender('error-gender')).toBe('neutral');

    expect(nlgSystem.getReflexivePronoun({ subject: 'it' })).toBe('itself');
    expect(nlgSystem.getReflexivePronoun({ subject: 'I' })).toBe('myself');
    expect(nlgSystem.getReflexivePronoun({ subject: 'you' })).toBe('yourself');
    expect(nlgSystem.getReflexivePronoun({ subject: 'we' })).toBe('ourselves');
    expect(nlgSystem.getReflexivePronoun({ subject: 'unknown' })).toBe(
      'themselves'
    );

    const hooks = nlgSystem.getTestHooks();
    expect(hooks.sanitizeEntityName(456)).toBe('Unknown entity');
    expect(hooks.resolveEntityName(neutralEntity.id)).toBe('Neutral Entity');
    expect(hooks.shouldUsePronounForTarget(pronounTarget.id)).toBe(true);
    expect(hooks.detectEntityGender(pronounTarget.id)).toBe('female');

    const hookPronouns = hooks.getPronounSet('female');
    expect(hooks.getReflexivePronoun(hookPronouns)).toBe('herself');

    const hookPhrase = hooks.generateActivityPhrase(
      'Pronoun Target',
      {
        type: 'dedicated',
        verb: 'coordinating',
        targetEntityId: pronounTarget.id,
      },
      true,
      {
        actorId: pronounTarget.id,
        actorPronouns: hookPronouns,
      }
    );
    expect(hookPhrase).toBe('Pronoun Target is coordinating herself');

    expect(hooks.sanitizeVerbPhrase(' are coordinating')).toBe('coordinating');
    expect(
      hooks.buildRelatedActivityFragment(
        'and',
        { fullPhrase: 'Pronoun Target studies charts', verbPhrase: '' },
        {
          actorName: 'Pronoun Target',
          actorReference: '',
          actorPronouns: hookPronouns,
          pronounsEnabled: false,
        }
      )
    ).toBe('and Pronoun Target studies charts');

    expect(hooks.mergeAdverb('swiftly', 'carefully')).toBe(
      'swiftly carefully'
    );
    expect(
      hooks.injectSoftener('{actor} reviews {target}', 'thoughtfully')
    ).toBe('{actor} reviews thoughtfully {target}');
    expect(
      hooks.truncateDescription(
        'Pronoun Target studies charts and prepares reports.',
        30
      )
    ).toBe('Pronoun Target studies char...');
  });
});
