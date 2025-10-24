import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import ActionFormatter from '../../../../src/actions/actionFormatter.js';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import { EntityManagerTestBed } from '../../../common/entities/entityManagerTestBed.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';

class RecordingDispatcher {
  constructor() {
    this.dispatch = jest.fn();
  }
}

describe('MultiTargetActionFormatter comprehensive integration suite', () => {
  let formatter;
  let baseFormatter;
  let logger;
  let testBed;
  let entityManager;
  let dispatcher;
  let actor;
  let ally;

  beforeEach(async () => {
    testBed = new EntityManagerTestBed();
    entityManager = testBed.entityManager;

    logger = new ConsoleLogger('DEBUG');
    jest.spyOn(logger, 'debug');
    jest.spyOn(logger, 'warn');
    jest.spyOn(logger, 'error');

    baseFormatter = new ActionFormatter();
    dispatcher = new RecordingDispatcher();

    formatter = new MultiTargetActionFormatter(baseFormatter, logger);

    const actorDefinition = new EntityDefinition('integration:actor', {
      description: 'Primary actor definition',
      components: {
        'core:name': { text: 'Captain Lira' },
        'core:actor': { name: 'Captain Lira' },
      },
    });

    const allyDefinition = new EntityDefinition('integration:ally', {
      description: 'Support ally definition',
      components: {
        'core:name': { text: 'Ranger Lio' },
        'core:actor': { name: 'Ranger Lio' },
      },
    });

    testBed.setupDefinitions(actorDefinition, allyDefinition);

    actor = await entityManager.createEntityInstance('integration:actor', {
      instanceId: 'actor-hero',
    });
    ally = await entityManager.createEntityInstance('integration:ally', {
      instanceId: 'ally-support',
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
    jest.restoreAllMocks();
  });

  it('delegates legacy formatting to the base formatter and rejects missing resolved targets', () => {
    const actionDefinition = {
      id: 'integration:salute',
      template: 'Salute {target}',
    };

    const result = formatter.format(
      actionDefinition,
      ActionTargetContext.forEntity(ally.id),
      entityManager,
      { logger, safeEventDispatcher: dispatcher, debug: true }
    );

    expect(result).toEqual({ ok: true, value: 'Salute Ranger Lio' });
    expect(logger.debug).toHaveBeenCalled();

    const invalidMultiTarget = formatter.formatMultiTarget(
      actionDefinition,
      null,
      entityManager,
      { logger },
      {}
    );

    expect(invalidMultiTarget.ok).toBe(false);
    expect(invalidMultiTarget.error).toContain(
      'Invalid or missing resolvedTargets'
    );
  });

  it('formats complex placeholder scenarios with fallback, dot notation, and normalization', () => {
    const actionDefinition = {
      id: 'integration:announce',
      template:
        '{hero} secures {item} ({primary.id}) for {recipient.displayName} using {secondary.metadata.owner} and {secondary.missingProp} before logging {secondary.extra}.',
      targets: {
        primary: { placeholder: 'hero' },
        secondary: {},
        recipient: { placeholder: 'recipient' },
      },
    };

    const resolvedTargets = {
      primary: [
        {
          id: actor.id,
          displayName: 'Captain Lira',
          rank: { title: 'Commander' },
        },
      ],
      secondary: [
        {
          id: 'artifact-001',
          displayName: 'Ancient Map',
          metadata: { owner: 'Captain Lira' },
          extra: { nested: true },
        },
      ],
      recipient: [
        {
          id: ally.id,
          displayName: 'Ranger Lio',
          title: 'Scout',
        },
      ],
    };

    const targetDefinitions = {
      primary: { placeholder: 'hero' },
      secondary: {},
      recipient: { placeholder: 'recipient' },
    };

    const formatted = formatter.formatMultiTarget(
      actionDefinition,
      resolvedTargets,
      entityManager,
      { logger },
      { targetDefinitions }
    );

    expect(formatted).toEqual({
      ok: true,
      value:
        'Captain Lira secures Ancient Map (actor-hero) for Ranger Lio using Captain Lira and Ancient Map before logging Ancient Map.',
    });
  });

  it('reports missing target arrays before combination generation', () => {
    const actionDefinition = {
      id: 'integration:dispatch',
      template: 'Dispatch {primary} towards {secondary}',
      targets: {
        primary: {},
        secondary: {},
      },
      generateCombinations: true,
    };

    const resolvedTargets = {
      primary: [
        {
          id: actor.id,
          displayName: 'Captain Lira',
        },
      ],
      secondary: [],
    };

    const targetDefinitions = {
      primary: {},
      secondary: {},
    };

    const result = formatter.formatMultiTarget(
      actionDefinition,
      resolvedTargets,
      entityManager,
      { logger },
      { targetDefinitions }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      "Target 'secondary' could not be resolved - action not available"
    );
  });

  it('rejects unresolved placeholders with strict validation', () => {
    const actionDefinition = {
      id: 'integration:strict',
      template: '{hero} coordinates with {secondary} and {unmatched}',
      targets: {
        primary: { placeholder: 'hero' },
        secondary: {},
      },
    };

    const resolvedTargets = {
      primary: [
        {
          id: actor.id,
          displayName: 'Captain Lira',
        },
      ],
      secondary: [
        {
          id: ally.id,
          displayName: 'Ranger Lio',
        },
      ],
    };

    const targetDefinitions = {
      primary: { placeholder: 'hero' },
      secondary: {},
    };

    const outcome = formatter.formatMultiTarget(
      actionDefinition,
      resolvedTargets,
      entityManager,
      { logger },
      { targetDefinitions }
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain('unresolved placeholders');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('generates cartesian products for independent targets when enabled', () => {
    const actionDefinition = {
      id: 'integration:caravan',
      template: 'Assign {primary} with {secondary} and {support}',
      targets: {
        primary: { placeholder: 'hero' },
        secondary: { placeholder: 'companion' },
        support: {},
      },
      generateCombinations: true,
    };

    const resolvedTargets = {
      primary: [
        { id: 'captain-1', displayName: 'Captain A' },
        { id: 'captain-2', displayName: 'Captain B' },
      ],
      secondary: [
        { id: 'scout-1', displayName: 'Scout A' },
        { id: 'scout-2', displayName: 'Scout B' },
      ],
      support: [
        { id: 'wagon-1', displayName: 'Wagon Alpha' },
        { id: 'wagon-2', displayName: 'Wagon Beta' },
      ],
    };

    const targetDefinitions = {
      primary: { placeholder: 'hero' },
      secondary: { placeholder: 'companion' },
      support: {},
    };

    const combinations = formatter.formatMultiTarget(
      actionDefinition,
      resolvedTargets,
      entityManager,
      { logger },
      { targetDefinitions }
    );

    expect(combinations.ok).toBe(true);
    expect(Array.isArray(combinations.value)).toBe(true);
    expect(combinations.value).toHaveLength(8);
    const uniqueCommands = new Set(
      combinations.value.map((entry) => entry.command)
    );
    expect(uniqueCommands.size).toBe(8);
  });

  it('returns errors when context-dependent targets cannot be matched', () => {
    const actionDefinition = {
      id: 'integration:escort',
      template: '{hero} escorts {dependent}',
      targets: {
        primary: { placeholder: 'hero' },
        dependent: { placeholder: 'dependent' },
      },
      generateCombinations: true,
    };

    const resolvedTargets = {
      primary: [{ id: 'primary-1', displayName: 'Hero One' }],
      dependent: [
        { id: 'dependent-1', displayName: 'Guide', contextFromId: 'mismatch' },
      ],
    };

    const targetDefinitions = {
      primary: { placeholder: 'hero', optional: false },
      dependent: { placeholder: 'dependent', optional: false },
    };

    const outcome = formatter.formatMultiTarget(
      actionDefinition,
      resolvedTargets,
      entityManager,
      { logger },
      { targetDefinitions }
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe(
      'No valid target combinations could be generated for required targets'
    );
  });

  it('builds context-aware combinations with independent expansions', () => {
    const actionDefinition = {
      id: 'integration:support',
      template: '{hero} partners with {dependent} while securing {supply}',
      targets: {
        primary: { placeholder: 'hero' },
        dependent: { placeholder: 'dependent' },
        supply: {},
      },
      generateCombinations: true,
    };

    const resolvedTargets = {
      primary: [
        { id: 'primary-1', displayName: 'Hero One' },
        { id: 'primary-2', displayName: 'Hero Two' },
      ],
      dependent: [
        {
          id: 'dependent-1',
          displayName: 'Guide One',
          contextFromId: 'primary-1',
        },
        {
          id: 'dependent-2',
          displayName: 'Guide Two',
          contextFromId: 'primary-2',
        },
      ],
      supply: [
        { id: 'supply-1', displayName: 'Potion Kit' },
        { id: 'supply-2', displayName: 'Rope Bundle' },
      ],
    };

    const targetDefinitions = {
      primary: { placeholder: 'hero' },
      dependent: { placeholder: 'dependent' },
      supply: {},
    };

    const outcome = formatter.formatMultiTarget(
      actionDefinition,
      resolvedTargets,
      entityManager,
      { logger },
      { targetDefinitions }
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.value).toHaveLength(4);
    for (const entry of outcome.value) {
      expect(entry.command.includes('Hero')).toBe(true);
      expect(entry.command.includes('Guide')).toBe(true);
      expect(
        entry.command.includes('Potion Kit') ||
          entry.command.includes('Rope Bundle')
      ).toBe(true);
      expect(entry.targets.primary).toHaveLength(1);
      expect(entry.targets.dependent).toHaveLength(1);
      expect(entry.targets.supply).toHaveLength(1);
    }
  });

  it('handles multiple dependent target types respecting generateAllCombinations', () => {
    const actionDefinition = {
      id: 'integration:triad',
      template:
        '{hero} coordinates {dependentA} and {dependentB} with backup from {support}',
      targets: {
        primary: { placeholder: 'hero' },
        dependentA: { placeholder: 'dependentA' },
        dependentB: { placeholder: 'dependentB' },
        support: {},
      },
      generateCombinations: true,
    };

    const resolvedTargets = {
      primary: [{ id: 'primary-1', displayName: 'Hero One' }],
      dependentA: [
        {
          id: 'dependent-1',
          displayName: 'Guide One',
          contextFromId: 'primary-1',
        },
        {
          id: 'dependent-2',
          displayName: 'Guide Two',
          contextFromId: 'primary-1',
        },
      ],
      dependentB: [
        {
          id: 'dependent-3',
          displayName: 'Scout One',
          contextFromId: 'primary-1',
        },
        {
          id: 'dependent-4',
          displayName: 'Scout Two',
          contextFromId: 'primary-1',
        },
      ],
      support: [
        { id: 'support-1', displayName: 'Signal Flare' },
        { id: 'support-2', displayName: 'Smoke Bomb' },
      ],
    };

    const targetDefinitions = {
      primary: { placeholder: 'hero' },
      dependentA: { placeholder: 'dependentA' },
      dependentB: { placeholder: 'dependentB' },
      support: {},
    };

    const outcome = formatter.formatMultiTarget(
      actionDefinition,
      resolvedTargets,
      entityManager,
      { logger },
      { targetDefinitions }
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.value.length).toBeGreaterThan(0);
    const observedSupports = new Set(
      outcome.value.map((entry) => entry.targets.support[0].id)
    );
    expect(observedSupports.size).toBe(2);
  });
});
