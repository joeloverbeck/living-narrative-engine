import { describe, it, expect } from '@jest/globals';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import EntityManager from '../../../src/entities/entityManager.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import EventBus from '../../../src/events/eventBus.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import DefaultComponentPolicy from '../../../src/adapters/DefaultComponentPolicy.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

const loadJson = (relativePath) => {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const fileContents = readFileSync(absolutePath, 'utf8');
  return JSON.parse(fileContents);
};

describe('EntityManager integration with optional dependency factories', () => {
  const consoleSpies = {};

  beforeAll(() => {
    consoleSpies.debug = jest.spyOn(console, 'debug').mockImplementation(() => {});
    consoleSpies.info = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleSpies.warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleSpies.error = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    Object.values(consoleSpies).forEach((spy) => spy.mockRestore());
  });

  it('wires real services together and exercises uncovered EntityManager paths', async () => {
    const logger = new ConsoleLogger(LogLevel.DEBUG);
    const debugSpy = jest.spyOn(logger, 'debug');

    const registry = new InMemoryDataRegistry({ logger });
    const schemaValidator = new AjvSchemaValidator({ logger });

    const commonSchema = loadJson('data/schemas/common.schema.json');
    const componentSchema = loadJson('data/schemas/component.schema.json');
    const allowsSittingComponent = loadJson(
      'data/mods/positioning/components/allows_sitting.component.json'
    );
    const corePositionComponent = loadJson(
      'data/mods/core/components/position.component.json'
    );

    await schemaValidator.loadSchemaObject(commonSchema.$id, commonSchema);
    await schemaValidator.loadSchemaObject(componentSchema.$id, componentSchema);
    await schemaValidator.loadSchemaObject(
      allowsSittingComponent.id,
      allowsSittingComponent.dataSchema
    );
    await schemaValidator.loadSchemaObject(
      corePositionComponent.id,
      corePositionComponent.dataSchema
    );

    const eventBus = new EventBus({ logger });
    const gameDataRepository = new GameDataRepository(registry, logger);
    const validatedDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository,
      schemaValidator,
      logger,
    });
    const safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });

    const defaultPolicyFactory = jest
      .fn()
      .mockImplementation(() => new DefaultComponentPolicy());
    const batchManagerFactory = jest.fn().mockImplementation(() => null);

    const entityManager = new EntityManager({
      registry,
      validator: schemaValidator,
      logger,
      dispatcher: safeDispatcher,
      defaultPolicy: defaultPolicyFactory,
      batchOperationManager: batchManagerFactory,
    });

    expect(defaultPolicyFactory).toHaveBeenCalledTimes(1);
    expect(batchManagerFactory).toHaveBeenCalledTimes(1);

    const benchDefinition = new EntityDefinition('test:bench', {
      description: 'Integration test bench entity',
      components: {
        'core:position': { locationId: 'location:park' },
        'positioning:allows_sitting': { spots: [null, null] },
      },
    });
    registry.store('entityDefinitions', benchDefinition.id, benchDefinition);

    const coordinator = entityManager.getMonitoringCoordinator();
    coordinator?.setEnabled(false);

    const created = await entityManager.createEntityInstance('test:bench', {
      instanceId: 'bench-1',
    });
    expect(created.id).toBe('bench-1');

    const idsAfterCreate = entityManager.getEntityIds();
    expect(idsAfterCreate).toEqual(['bench-1']);

    expect(entityManager.hasBatchSupport()).toBe(true);

    const reconstructed = entityManager.reconstructEntity({
      instanceId: 'bench-2',
      definitionId: 'test:bench',
      components: {
        'core:position': { locationId: 'location:park' },
        'positioning:allows_sitting': { spots: ['npc:patron', null] },
      },
    });
    expect(reconstructed.id).toBe('bench-2');

    const entityIds = entityManager.getEntityIds().sort();
    expect(entityIds).toEqual(['bench-1', 'bench-2']);

    const seatingEntities = entityManager.getEntitiesWithComponent(
      'positioning:allows_sitting'
    );
    expect(seatingEntities.map((entity) => entity.id).sort()).toEqual([
      'bench-1',
      'bench-2',
    ]);

    expect(
      debugSpy.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes("EntityManager.getEntitiesWithComponent('positioning:allows_sitting')")
      )
    ).toBe(true);

    expect(
      entityManager.hasComponent('bench-1', 'positioning:allows_sitting', true)
    ).toBe(false);

    await entityManager.addComponent('bench-1', 'positioning:allows_sitting', {
      spots: ['npc:visitor', null],
    });

    expect(
      entityManager.hasComponentOverride('bench-1', 'positioning:allows_sitting')
    ).toBe(true);

    const found = entityManager.findEntities({
      withAll: ['positioning:allows_sitting'],
    });
    expect(found.map((entity) => entity.id).sort()).toEqual(['bench-1', 'bench-2']);

    const componentTypes = entityManager.getAllComponentTypesForEntity('bench-1');
    expect(componentTypes).toEqual(
      expect.arrayContaining(['core:position', 'positioning:allows_sitting'])
    );

    entityManager.clearAll();
    expect(entityManager.getEntityIds()).toHaveLength(0);

    coordinator?.close();
    debugSpy.mockRestore();
  });
});
