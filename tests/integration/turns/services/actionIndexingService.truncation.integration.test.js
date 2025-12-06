import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import ActionIndexingService from '../../../../src/turns/services/actionIndexingService.js';
import { ActionIndexingError } from '../../../../src/turns/services/errors/actionIndexingError.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../../../src/constants/core.js';

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
 *
 * @param actionDefinition
 * @param index
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

describe('ActionIndexingService overflow handling integration', () => {
  let logger;
  let entityManager;
  let actionIndex;
  let indexingService;
  const actor = { id: 'overflow-actor' };

  beforeEach(() => {
    logger = new RecordingLogger();
    entityManager = new InMemoryEntityManager();
    actionIndex = new ActionIndex({ logger, entityManager });
    indexingService = new ActionIndexingService({ logger });
  });

  it('truncates extreme action lists and reports overflow gracefully', () => {
    const overflowCount = MAX_AVAILABLE_ACTIONS_PER_TURN + 10;
    const actionDefinitions = Array.from(
      { length: overflowCount },
      (_, index) => ({
        id: `overflow:action-${index}`,
        name: `Overflow Action ${index}`,
      })
    );

    actionIndex.buildIndex(actionDefinitions);
    entityManager.setComponents(actor.id, {
      'core:actor': { name: 'Overflow Actor' },
    });

    const discovered = actionIndex
      .getCandidateActions(actor)
      .map((definition, index) => buildDiscoveredAction(definition, index));

    expect(discovered).toHaveLength(overflowCount);

    const composites = indexingService.indexActions(actor.id, discovered);

    expect(composites).toHaveLength(MAX_AVAILABLE_ACTIONS_PER_TURN);
    expect(
      logger.warnLogs.some(
        (entry) =>
          entry.message.includes('truncated') &&
          entry.message.includes(actor.id)
      )
    ).toBe(true);

    expect(() =>
      indexingService.resolve(actor.id, MAX_AVAILABLE_ACTIONS_PER_TURN + 50)
    ).toThrow(ActionIndexingError);

    const indexedList = indexingService.getIndexedList(actor.id);
    expect(indexedList).toHaveLength(MAX_AVAILABLE_ACTIONS_PER_TURN);
    expect(indexedList[0].index).toBe(1);
    expect(indexedList[indexedList.length - 1].index).toBe(
      MAX_AVAILABLE_ACTIONS_PER_TURN
    );
  });
});
