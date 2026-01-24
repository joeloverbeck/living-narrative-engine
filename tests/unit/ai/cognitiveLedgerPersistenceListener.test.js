import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { CognitiveLedgerPersistenceListener } from '../../../src/ai/cognitiveLedgerPersistenceListener.js';
import { persistCognitiveLedger } from '../../../src/ai/cognitiveLedgerPersistenceHook.js';

jest.mock('../../../src/ai/cognitiveLedgerPersistenceHook.js', () => ({
  persistCognitiveLedger: jest.fn(),
}));

describe('CognitiveLedgerPersistenceListener', () => {
  let logger;
  let entityManager;
  let componentAccessService;
  let listener;

  beforeEach(() => {
    logger = {
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    entityManager = { getEntityInstance: jest.fn() };
    componentAccessService = { applyComponent: jest.fn() };
    listener = new CognitiveLedgerPersistenceListener({
      logger,
      entityManager,
      componentAccessService,
    });
    persistCognitiveLedger.mockClear();
  });

  test('calls persistCognitiveLedger with extractedData.cognitive_ledger', () => {
    const actorEntity = { id: 'actor-1' };
    const cognitiveLedger = {
      settled_conclusions: ['Known'],
      open_questions: ['Next?'],
    };
    entityManager.getEntityInstance.mockReturnValue(actorEntity);

    listener.handleEvent({
      payload: {
        actorId: 'actor-1',
        extractedData: { cognitive_ledger: cognitiveLedger },
      },
    });

    expect(persistCognitiveLedger).toHaveBeenCalledWith(
      cognitiveLedger,
      actorEntity,
      logger,
      componentAccessService
    );
  });

  test('uses cognitiveLedger alias when provided', () => {
    const actorEntity = { id: 'actor-1' };
    const cognitiveLedger = {
      settled_conclusions: ['Known'],
      open_questions: [],
    };
    entityManager.getEntityInstance.mockReturnValue(actorEntity);

    listener.handleEvent({
      payload: {
        actorId: 'actor-1',
        extractedData: { cognitiveLedger },
      },
    });

    expect(persistCognitiveLedger).toHaveBeenCalledWith(
      cognitiveLedger,
      actorEntity,
      logger,
      componentAccessService
    );
  });

  test('logs warning when actorId missing from payload', () => {
    listener.handleEvent({
      payload: {
        extractedData: { cognitive_ledger: { settled_conclusions: [] } },
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'CognitiveLedgerPersistenceListener: Received event without actorId'
    );
    expect(persistCognitiveLedger).not.toHaveBeenCalled();
  });

  test('logs warning when actor entity not found', () => {
    entityManager.getEntityInstance.mockReturnValue(null);

    listener.handleEvent({
      payload: {
        actorId: 'actor-1',
        extractedData: { cognitive_ledger: { settled_conclusions: [] } },
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'CognitiveLedgerPersistenceListener: entity not found for actor actor-1'
    );
    expect(persistCognitiveLedger).not.toHaveBeenCalled();
  });

  test('handles missing extractedData gracefully', () => {
    listener.handleEvent({
      payload: {
        actorId: 'actor-1',
      },
    });

    expect(persistCognitiveLedger).not.toHaveBeenCalled();
  });

  test('handles null payload gracefully', () => {
    listener.handleEvent(null);
    listener.handleEvent({});

    expect(persistCognitiveLedger).not.toHaveBeenCalled();
  });
});
