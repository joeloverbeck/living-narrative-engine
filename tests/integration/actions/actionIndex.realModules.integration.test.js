import { describe, it, beforeEach, expect } from '@jest/globals';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import {
  TraceContext,
  TRACE_INFO,
  TRACE_SUCCESS,
  TRACE_DATA,
} from '../../../src/actions/tracing/traceContext.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(...args) {
    this.debugLogs.push(args);
  }

  info(...args) {
    this.infoLogs.push(args);
  }

  warn(...args) {
    this.warnLogs.push(args);
  }

  error(...args) {
    this.errorLogs.push(args);
  }
}

const buildActor = (id, componentTypes) => ({
  id,
  components: componentTypes.reduce((acc, type) => {
    acc[type] = { ownedBy: id, component: type };
    return acc;
  }, {}),
});

const ACTION_DEFINITIONS = [
  null,
  'unexpected entry',
  {
    id: 'core:always',
    template: 'always available',
  },
  {
    id: 'core:strength-only',
    template: 'requires strength',
    required_components: { actor: ['core:strength'] },
  },
  {
    id: 'core:trimmed-only',
    template: 'ignored because requirement is blank',
    required_components: { actor: ['   '] },
  },
  {
    id: 'core:strength-and-agility',
    template: 'requires strength and agility',
    required_components: { actor: ['core:strength', 'core:agility'] },
  },
  {
    id: 'core:focus-required',
    template: 'requires focus',
    required_components: { actor: ['core:focus'] },
  },
  {
    id: 'core:forbid-cursed',
    template: 'no cursed actors',
    required_components: { actor: ['core:strength'] },
    forbidden_components: { actor: ['core:cursed', ''] },
  },
  {
    id: 'core:no-req-forbid-agility',
    template: 'agility forbidden',
    forbidden_components: { actor: ['core:agility'] },
  },
  {
    id: 'core:secondary-forbid-cursed',
    template: 'blocks cursed actors without requirements',
    forbidden_components: { actor: ['core:cursed'] },
  },
  {
    id: 'core:strength-forbid-frozen',
    template: 'no frozen actors',
    required_components: { actor: ['core:strength'] },
    forbidden_components: { actor: ['core:frozen'] },
  },
];

describe('ActionIndex integration with SimpleEntityManager', () => {
  /** @type {RecordingLogger} */
  let logger;
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {ActionIndex} */
  let actionIndex;

  const hero = buildActor('hero', [
    'core:strength',
    'core:agility',
    'core:focus',
  ]);
  const cursed = buildActor('cursed', ['core:strength', 'core:cursed']);
  const frozen = buildActor('frozen', ['core:strength', 'core:frozen']);
  const agileOnly = buildActor('agileOnly', ['core:agility']);
  const balanced = buildActor('balanced', ['core:strength', 'core:focus']);

  beforeEach(() => {
    logger = new RecordingLogger();
    entityManager = new SimpleEntityManager([
      hero,
      cursed,
      frozen,
      agileOnly,
      balanced,
    ]);
    actionIndex = new ActionIndex({ logger, entityManager });
  });

  it('throws when constructed without required dependencies', () => {
    expect(() => new ActionIndex({ logger: null, entityManager })).toThrow(
      'ActionIndex requires a logger dependency'
    );
    const standaloneLogger = new RecordingLogger();
    expect(
      () => new ActionIndex({ logger: standaloneLogger, entityManager: null })
    ).toThrow('ActionIndex requires an entityManager dependency');
  });

  it('warns and skips when buildIndex receives a non-array', () => {
    actionIndex.buildIndex('not-an-array');

    expect(logger.warnLogs).toEqual([
      [
        'ActionIndex.buildIndex: allActionDefinitions must be an array. Skipping index build.',
      ],
    ]);

    const heroEntity = entityManager.getEntityInstance('hero');
    expect(actionIndex.getCandidateActions(heroEntity)).toEqual([]);
  });

  describe('with a populated index', () => {
    beforeEach(() => {
      actionIndex.buildIndex(ACTION_DEFINITIONS);
    });

    it('builds the index while logging invalid definitions', () => {
      const debugMessages = logger.debugLogs.map((entry) => entry[0]);

      expect(debugMessages).toEqual(
        expect.arrayContaining([
          'ActionIndex initialised.',
          'Building action index from 11 definitions...',
          'ActionIndex.buildIndex: Skipping invalid action definition: null',
          'ActionIndex.buildIndex: Skipping invalid action definition: unexpected entry',
          'Action index built. 3 component-to-action maps created.',
        ])
      );

      const heroEntity = entityManager.getEntityInstance('hero');
      const candidates = actionIndex.getCandidateActions(heroEntity);
      const candidateIds = candidates.map((action) => action.id);

      expect(candidateIds).toEqual([
        'core:always',
        'core:secondary-forbid-cursed',
        'core:strength-only',
        'core:strength-and-agility',
        'core:forbid-cursed',
        'core:strength-forbid-frozen',
        'core:focus-required',
      ]);
      expect(candidateIds).not.toContain('core:trimmed-only');
      expect(
        candidateIds.filter((id) => id === 'core:strength-and-agility')
      ).toHaveLength(1);
      expect(
        logger.debugLogs.some((entry) =>
          entry[0].includes('Retrieved 7 candidate actions for actor hero.')
        )
      ).toBe(true);
    });

    it('provides detailed trace data when discovering hero actions', () => {
      const trace = new TraceContext();
      const heroEntity = entityManager.getEntityInstance('hero');

      const candidates = actionIndex.getCandidateActions(heroEntity, trace);
      const traceMessages = trace.logs.map((entry) => ({
        type: entry.type,
        message: entry.message,
        data: entry.data,
      }));

      expect(candidates).toHaveLength(7);

      expect(traceMessages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: TRACE_DATA,
            message: "Actor 'hero' has components.",
          }),
          expect.objectContaining({
            type: TRACE_INFO,
            message: 'Added 3 actions with no actor component requirements.',
          }),
          expect.objectContaining({
            type: TRACE_INFO,
            message: "Found 4 actions requiring component 'core:strength'.",
          }),
          expect.objectContaining({
            type: TRACE_INFO,
            message: "Found 1 actions requiring component 'core:agility'.",
          }),
          expect.objectContaining({
            type: TRACE_INFO,
            message: "Found 1 actions requiring component 'core:focus'.",
          }),
          expect.objectContaining({
            type: TRACE_INFO,
            message: 'Removed 1 actions due to forbidden components.',
            data: { removedActionIds: ['core:no-req-forbid-agility'] },
          }),
          expect.objectContaining({
            type: TRACE_SUCCESS,
            message:
              'Final candidate list contains 7 unique actions after component validation.',
          }),
        ])
      );
    });

    it('removes actions when the actor has forbidden components', () => {
      const trace = new TraceContext();
      const cursedEntity = entityManager.getEntityInstance('cursed');

      const candidates = actionIndex.getCandidateActions(cursedEntity, trace);
      const candidateIds = candidates.map((action) => action.id);

      expect(candidateIds).toEqual([
        'core:always',
        'core:no-req-forbid-agility',
        'core:strength-only',
        'core:strength-forbid-frozen',
      ]);

      const removalLog = trace.logs.find((entry) =>
        entry.message.includes('Removed')
      );
      expect(removalLog.data.removedActionIds).toEqual(
        expect.arrayContaining([
          'core:forbid-cursed',
          'core:secondary-forbid-cursed',
        ])
      );

      const exclusionLog = trace.logs.find((entry) =>
        entry.message.includes("Excluding action 'core:strength-and-agility'")
      );
      expect(exclusionLog).toBeDefined();
    });

    it('omits actions when the actor lacks required components', () => {
      const trace = new TraceContext();
      const agileOnlyEntity = entityManager.getEntityInstance('agileOnly');

      const candidates = actionIndex.getCandidateActions(
        agileOnlyEntity,
        trace
      );

      expect(candidates.map((action) => action.id)).toEqual([
        'core:always',
        'core:secondary-forbid-cursed',
      ]);
      expect(
        trace.logs.filter((entry) =>
          entry.message.startsWith('Excluding action ')
        )
      ).toHaveLength(1);
    });

    it('allows forbidden-component actions for actors without matching components', () => {
      const trace = new TraceContext();
      const balancedEntity = entityManager.getEntityInstance('balanced');

      const candidates = actionIndex.getCandidateActions(balancedEntity, trace);
      const candidateIds = candidates.map((action) => action.id);

      expect(candidateIds).toEqual([
        'core:always',
        'core:no-req-forbid-agility',
        'core:secondary-forbid-cursed',
        'core:strength-only',
        'core:forbid-cursed',
        'core:strength-forbid-frozen',
        'core:focus-required',
      ]);
      expect(
        trace.logs.some((entry) => entry.message.startsWith('Removed'))
      ).toBe(false);
    });

    it('falls back to empty component lists when the entity manager returns null', () => {
      class NullReturningEntityManager extends SimpleEntityManager {
        getAllComponentTypesForEntity(entityId) {
          if (entityId === 'null-components') {
            return null;
          }
          return super.getAllComponentTypesForEntity(entityId);
        }
      }

      const fallbackLogger = new RecordingLogger();
      const fallbackManager = new NullReturningEntityManager([
        buildActor('null-components', ['core:strength']),
      ]);
      const fallbackIndex = new ActionIndex({
        logger: fallbackLogger,
        entityManager: fallbackManager,
      });
      fallbackIndex.buildIndex(ACTION_DEFINITIONS);

      const trace = new TraceContext();
      const actor = fallbackManager.getEntityInstance('null-components');
      const candidates = fallbackIndex.getCandidateActions(actor, trace);

      expect(candidates.map((action) => action.id)).toEqual([
        'core:always',
        'core:no-req-forbid-agility',
        'core:secondary-forbid-cursed',
      ]);

      const componentLog = trace.logs.find((entry) =>
        entry.message.includes("Actor 'null-components' has components.")
      );
      expect(componentLog.data.components).toEqual([]);
      expect(
        trace.logs.some((entry) => entry.message.includes('Removed'))
      ).toBe(false);
    });

    it('provides default actions for unknown actors and returns empty when id is missing', () => {
      const trace = new TraceContext();
      const ghostCandidates = actionIndex.getCandidateActions(
        { id: 'ghost' },
        trace
      );

      expect(ghostCandidates.map((action) => action.id)).toEqual([
        'core:always',
        'core:no-req-forbid-agility',
        'core:secondary-forbid-cursed',
      ]);
      expect(
        trace.logs.some((entry) => entry.message.includes('Removed'))
      ).toBe(false);

      expect(actionIndex.getCandidateActions({})).toEqual([]);
      expect(actionIndex.getCandidateActions(null)).toEqual([]);
    });
  });
});
