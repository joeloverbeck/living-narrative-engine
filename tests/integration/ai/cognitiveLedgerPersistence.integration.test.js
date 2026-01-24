import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { CognitiveLedgerPersistenceListener } from '../../../src/ai/cognitiveLedgerPersistenceListener.js';
import ComponentAccessService from '../../../src/entities/componentAccessService.js';
import { COGNITIVE_LEDGER_COMPONENT_ID } from '../../../src/constants/componentIds.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.warnMessages = [];
  }

  debug(message, context) {
    this.debugMessages.push({ message, context });
  }

  warn(message, context) {
    this.warnMessages.push({ message, context });
  }
}

function createEntity(initialLedger = null) {
  return {
    id: 'actor-1',
    components: initialLedger
      ? { [COGNITIVE_LEDGER_COMPONENT_ID]: initialLedger }
      : {},
    addComponent(componentId, data) {
      this.components[componentId] = data;
    },
    getComponentData(componentId) {
      return this.components[componentId];
    },
  };
}

describe('CognitiveLedgerPersistenceListener integration', () => {
  let logger;
  let componentAccessService;
  let entityManager;
  let actorEntity;
  let listener;

  beforeEach(() => {
    logger = new TestLogger();
    componentAccessService = new ComponentAccessService();
    actorEntity = createEntity();
    entityManager = {
      getEntityInstance: jest.fn(() => actorEntity),
    };
    listener = new CognitiveLedgerPersistenceListener({
      logger,
      entityManager,
      componentAccessService,
    });
  });

  it('persists cognitive ledger from event payload', () => {
    listener.handleEvent({
      payload: {
        actorId: 'actor-1',
        extractedData: {
          cognitive_ledger: {
            settled_conclusions: ['Known'],
            open_questions: ['Next?'],
          },
        },
      },
    });

    expect(actorEntity.components[COGNITIVE_LEDGER_COMPONENT_ID]).toEqual({
      settled_conclusions: ['Known'],
      open_questions: ['Next?'],
    });
  });

  it('overwrites ledger on subsequent events', () => {
    actorEntity = createEntity({
      settled_conclusions: ['Old'],
      open_questions: ['Old?'],
    });
    entityManager.getEntityInstance.mockReturnValue(actorEntity);

    listener.handleEvent({
      payload: {
        actorId: 'actor-1',
        extractedData: {
          cognitive_ledger: {
            settled_conclusions: ['New'],
            open_questions: [],
          },
        },
      },
    });

    listener.handleEvent({
      payload: {
        actorId: 'actor-1',
        extractedData: {
          cognitive_ledger: {
            settled_conclusions: [],
            open_questions: ['Follow up'],
          },
        },
      },
    });

    expect(actorEntity.components[COGNITIVE_LEDGER_COMPONENT_ID]).toEqual({
      settled_conclusions: [],
      open_questions: ['Follow up'],
    });
  });
});
