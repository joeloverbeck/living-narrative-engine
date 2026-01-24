import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { persistCognitiveLedger } from '../../../src/ai/cognitiveLedgerPersistenceHook.js';
import { COGNITIVE_LEDGER_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import ComponentAccessService from '../../../src/entities/componentAccessService.js';

describe('persistCognitiveLedger', () => {
  let logger;
  let componentAccess;
  let actorEntity;

  beforeEach(() => {
    logger = { debug: jest.fn() };
    componentAccess = new ComponentAccessService();
    actorEntity = {
      id: 'actor-1',
      components: {},
      addComponent(componentId, data) {
        this.components[componentId] = data;
      },
      getComponentData(componentId) {
        return this.components[componentId];
      },
    };
  });

  test('does nothing when cognitiveLedger is null', () => {
    const applySpy = jest.spyOn(componentAccess, 'applyComponent');

    persistCognitiveLedger(null, actorEntity, logger, componentAccess);

    expect(applySpy).not.toHaveBeenCalled();
  });

  test('does nothing when cognitiveLedger is undefined', () => {
    const applySpy = jest.spyOn(componentAccess, 'applyComponent');

    persistCognitiveLedger(undefined, actorEntity, logger, componentAccess);

    expect(applySpy).not.toHaveBeenCalled();
  });

  test('calls applyComponent with correct component ID and truncates lists', () => {
    const cognitiveLedger = {
      settled_conclusions: ['a', 'b', 'c', 'd'],
      open_questions: ['x', 'y', 'z', 'w'],
    };

    persistCognitiveLedger(cognitiveLedger, actorEntity, logger, componentAccess);

    expect(actorEntity.components[COGNITIVE_LEDGER_COMPONENT_ID]).toEqual({
      settled_conclusions: ['a', 'b', 'c'],
      open_questions: ['x', 'y', 'z'],
    });
  });

  test('handles missing settled_conclusions with empty array', () => {
    persistCognitiveLedger(
      { open_questions: ['x'] },
      actorEntity,
      logger,
      componentAccess
    );

    expect(actorEntity.components[COGNITIVE_LEDGER_COMPONENT_ID]).toEqual({
      settled_conclusions: [],
      open_questions: ['x'],
    });
  });

  test('handles missing open_questions with empty array', () => {
    persistCognitiveLedger(
      { settled_conclusions: ['a'] },
      actorEntity,
      logger,
      componentAccess
    );

    expect(actorEntity.components[COGNITIVE_LEDGER_COMPONENT_ID]).toEqual({
      settled_conclusions: ['a'],
      open_questions: [],
    });
  });

  test('overwrites existing component data', () => {
    actorEntity.components[COGNITIVE_LEDGER_COMPONENT_ID] = {
      settled_conclusions: ['old'],
      open_questions: ['old?'],
    };

    persistCognitiveLedger(
      { settled_conclusions: ['new'], open_questions: ['new?'] },
      actorEntity,
      logger,
      componentAccess
    );

    expect(actorEntity.components[COGNITIVE_LEDGER_COMPONENT_ID]).toEqual({
      settled_conclusions: ['new'],
      open_questions: ['new?'],
    });
  });
});
