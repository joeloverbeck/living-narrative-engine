import { describe, it, expect, jest } from '@jest/globals';
import { createDefaultServices } from '../../../../src/entities/utils/createDefaultServices.js';
import EntityRepositoryAdapter from '../../../../src/entities/services/entityRepositoryAdapter.js';
import ComponentMutationService from '../../../../src/entities/services/componentMutationService.js';
import ErrorTranslator from '../../../../src/entities/services/errorTranslator.js';
import EntityFactory from '../../../../src/entities/factories/entityFactory.js';
import DefinitionCache from '../../../../src/entities/services/definitionCache.js';
import {
  createSimpleMockDataRegistry,
  createMockSchemaValidator,
  createMockLogger,
  createMockSafeEventDispatcher,
} from '../../../common/mockFactories/index.js';

describe('createDefaultServices', () => {
  it('returns properly instantiated services', () => {
    const registry = createSimpleMockDataRegistry();
    const validator = createMockSchemaValidator();
    const logger = createMockLogger();
    const eventDispatcher = createMockSafeEventDispatcher();
    const idGen = jest.fn();
    const cloner = jest.fn((v) => v);
    const defaultPolicy = { apply: jest.fn() };

    const services = createDefaultServices({
      registry,
      validator,
      logger,
      eventDispatcher,
      idGenerator: idGen,
      cloner,
      defaultPolicy,
    });

    expect(services.entityRepository).toBeInstanceOf(EntityRepositoryAdapter);
    expect(services.componentMutationService).toBeInstanceOf(
      ComponentMutationService
    );
    expect(services.errorTranslator).toBeInstanceOf(ErrorTranslator);
    expect(services.entityFactory).toBeInstanceOf(EntityFactory);
    expect(services.definitionCache).toBeInstanceOf(DefinitionCache);
  });
});
