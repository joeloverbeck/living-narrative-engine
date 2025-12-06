import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import ActionIndexingService from '../../../../src/turns/services/actionIndexingService.js';
import { ActionIndexingError } from '../../../../src/turns/services/errors/actionIndexingError.js';

/**
 * Lightweight logger that records structured log entries without using Jest mocks.
 */
class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, details) {
    this.debugLogs.push({ message, details });
  }

  info(message, details) {
    this.infoLogs.push({ message, details });
  }

  warn(message, details) {
    this.warnLogs.push({ message, details });
  }

  error(message, details) {
    this.errorLogs.push({ message, details });
  }
}

/**
 * Minimal entity manager that supports the ActionIndex contract without mocking behaviour.
 */
class InMemoryEntityManager {
  constructor() {
    this._store = new Map();
  }

  setComponents(entityId, components) {
    this._store.set(entityId, { ...components });
  }

  getAllComponentTypesForEntity(entityId) {
    const record = this._store.get(entityId);
    return record ? Object.keys(record) : [];
  }
}

/**
 * Simple trace probe that collects structured trace emissions for assertions.
 */
class TraceProbe {
  constructor() {
    this.dataEntries = [];
    this.infoEntries = [];
    this.successEntries = [];
  }

  data(message, source, metadata) {
    this.dataEntries.push({ message, source, metadata });
  }

  info(message, source, metadata) {
    this.infoEntries.push({ message, source, metadata });
  }

  success(message, source, metadata) {
    this.successEntries.push({ message, source, metadata });
  }
}

/**
 * Builds a discovered action payload from an action definition for indexing.
 *
 * @param {object} actionDefinition
 * @param {number} index
 * @returns {object}
 */
function buildDiscoveredAction(actionDefinition, index) {
  return {
    id: actionDefinition.id,
    command: `${actionDefinition.id}-command`,
    params: index % 2 === 0 ? { focus: 'ally' } : {},
    description: actionDefinition.name ?? actionDefinition.id,
    visual: index % 2 === 0 ? { icon: actionDefinition.id } : null,
  };
}

describe('ActionIndex ↔ ActionIndexingService integration', () => {
  let logger;
  let entityManager;
  let actionIndex;
  let indexingService;
  const hero = { id: 'actor-hero' };

  beforeEach(() => {
    logger = new RecordingLogger();
    entityManager = new InMemoryEntityManager();
    actionIndex = new ActionIndex({ logger, entityManager });
    indexingService = new ActionIndexingService({ logger });
  });

  it('discovers, filters, and indexes actions using real collaborators', () => {
    // Invalid build input triggers warning coverage before the real index is populated.
    actionIndex.buildIndex('not-an-array');
    expect(
      logger.warnLogs.some((entry) =>
        entry.message.includes('allActionDefinitions must be an array')
      )
    ).toBe(true);

    const actionDefinitions = [
      {
        id: 'core:wave',
        name: 'Wave to crowd',
        template: 'wave',
        required_components: { actor: [] },
      },
      {
        id: 'core:salute',
        name: 'Formal salute',
        template: 'salute',
        required_components: { actor: ['core:discipline', 'core:stealth'] },
      },
      {
        id: 'core:hide',
        name: 'Blend into shadows',
        template: 'hide',
        required_components: { actor: ['core:stealth'] },
        forbidden_components: { actor: ['core:armor'] },
      },
      {
        id: 'core:meditate',
        name: 'Find inner calm',
        template: 'meditate',
      },
      null, // Skip invalid entries gracefully
    ];

    actionIndex.buildIndex(actionDefinitions);

    // Provide the hero with complementary components for the first discovery pass.
    entityManager.setComponents(hero.id, {
      'core:actor': { name: 'Hero' },
      'core:discipline': { rank: 3 },
      'core:stealth': { level: 5 },
    });

    const trace = new TraceProbe();
    const initialCandidates = actionIndex.getCandidateActions(hero, trace);
    expect(initialCandidates.map((action) => action.id)).toEqual([
      'core:wave',
      'core:meditate',
      'core:salute',
      'core:hide',
    ]);
    expect(trace.dataEntries.length).toBeGreaterThan(0);
    expect(trace.successEntries[0].message).toContain('Final candidate list');

    // Missing actor id results in no candidates.
    expect(actionIndex.getCandidateActions({})).toEqual([]);

    // Adding forbidden component removes the hidden action.
    entityManager.setComponents(hero.id, {
      'core:actor': { name: 'Hero' },
      'core:discipline': { rank: 3 },
      'core:stealth': { level: 5 },
      'core:armor': { rating: 'heavy' },
    });
    const traceWithArmor = new TraceProbe();
    const restrictedCandidates = actionIndex.getCandidateActions(
      hero,
      traceWithArmor
    );
    expect(restrictedCandidates.map((action) => action.id)).toEqual([
      'core:wave',
      'core:meditate',
      'core:salute',
    ]);
    expect(
      traceWithArmor.infoEntries.some((entry) =>
        entry.message.includes('Removed 1 actions due to forbidden components')
      )
    ).toBe(true);

    // Removing required components leaves only requirement-free actions.
    entityManager.setComponents(hero.id, {
      'core:actor': { name: 'Hero' },
      'core:discipline': { rank: 3 },
    });
    const traceMissingComponents = new TraceProbe();
    const minimalCandidates = actionIndex.getCandidateActions(
      hero,
      traceMissingComponents
    );
    expect(minimalCandidates.map((action) => action.id)).toEqual([
      'core:wave',
      'core:meditate',
    ]);
    expect(
      traceMissingComponents.infoEntries.some((entry) =>
        entry.message.includes("Excluding action 'core:salute'")
      )
    ).toBe(true);

    // Restore full capability for indexing exercises.
    entityManager.setComponents(hero.id, {
      'core:actor': { name: 'Hero' },
      'core:discipline': { rank: 3 },
      'core:stealth': { level: 5 },
    });
    const finalCandidates = actionIndex.getCandidateActions(
      hero,
      new TraceProbe()
    );

    const discovered = finalCandidates.map(buildDiscoveredAction);
    discovered.push({ ...discovered[0] }); // Duplicate for deduplication branch coverage.

    const composites = indexingService.indexActions(hero.id, discovered);
    expect(composites).toHaveLength(finalCandidates.length);
    expect(
      logger.infoLogs.some((entry) => entry.message.includes('suppressed'))
    ).toBe(true);
    expect(
      logger.debugLogs.some((entry) =>
        entry.message.includes('actions have visual properties')
      )
    ).toBe(true);

    // Cached retrieval and resolution work with populated cache.
    const cachedList = indexingService.getIndexedList(hero.id);
    expect(cachedList).toEqual(composites);
    const reused = indexingService.indexActions(hero.id, []);
    expect(reused).toEqual(composites);
    expect(indexingService.resolve(hero.id, 2).actionId).toBe(
      composites[1].actionId
    );

    // Clearing cache removes indexed data.
    indexingService.clearActorCache(hero.id);
    expect(() => indexingService.getIndexedList(hero.id)).toThrow(
      ActionIndexingError
    );

    // Rebuild cache then clear via beginTurn to hit lifecycle branch.
    indexingService.indexActions(hero.id, discovered);
    indexingService.beginTurn(hero.id);
    expect(() => indexingService.resolve(hero.id, 1)).toThrow(
      ActionIndexingError
    );

    // Indexing with empty discovery after cache reset is safe.
    const emptyComposite = indexingService.indexActions(hero.id, []);
    expect(emptyComposite).toEqual([]);
  });

  it('enforces guardrails for invalid indexing requests', () => {
    expect(() => indexingService.indexActions('', [])).toThrow(TypeError);
    expect(() => indexingService.indexActions(hero.id, null)).toThrow(
      TypeError
    );
    expect(() => indexingService.getIndexedList(hero.id)).toThrow(
      ActionIndexingError
    );
    expect(() => indexingService.resolve(hero.id, 99)).toThrow(
      ActionIndexingError
    );

    // Lifecycle helpers should tolerate repeated calls without throwing.
    indexingService.beginTurn(hero.id);
    indexingService.clearActorCache(hero.id);
  });
});
