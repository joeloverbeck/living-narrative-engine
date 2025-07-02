import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ComponentMutationService from '../../../../src/entities/services/componentMutationService.js';
import { COMPONENT_ADDED_ID } from '../../../../src/constants/eventIds.js';
import { EntityNotFoundError } from '../../../../src/errors/entityNotFoundError.js';
import { ValidationError } from '../../../../src/errors/validationError.js';

const createService = ({ entity } = {}) => {
  const entityRepository = { get: jest.fn(() => entity) };
  const validator = { validate: jest.fn(() => ({ isValid: true })) };
  const logger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };
  const eventDispatcher = { dispatch: jest.fn() };
  const cloner = jest.fn((d) => ({ ...d }));

  const service = new ComponentMutationService({
    entityRepository,
    validator,
    logger,
    eventDispatcher,
    cloner,
  });

  return {
    service,
    entityRepository,
    validator,
    logger,
    eventDispatcher,
    cloner,
  };
};

describe('ComponentMutationService.addComponent', () => {
  let entity;

  beforeEach(() => {
    entity = {
      addComponent: jest.fn(() => true),
      getComponentData: jest.fn(() => undefined),
    };
  });

  it('adds a component and emits event', () => {
    const { service, eventDispatcher, cloner } = createService({ entity });
    const data = { hp: 5 };

    service.addComponent('e1', 'core:health', data);

    expect(entity.addComponent).toHaveBeenCalledWith('core:health', { hp: 5 });
    expect(cloner).toHaveBeenCalled();
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(COMPONENT_ADDED_ID, {
      entity,
      componentTypeId: 'core:health',
      componentData: { hp: 5 },
      oldComponentData: undefined,
    });
  });

  it('throws EntityNotFoundError when entity missing', () => {
    const { service, eventDispatcher } = createService({ entity: undefined });
    expect(() => service.addComponent('missing', 'c', {})).toThrow(
      EntityNotFoundError
    );
    expect(eventDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('throws ValidationError when validation fails', () => {
    const { service, validator } = createService({ entity });
    validator.validate.mockReturnValue({ isValid: false, errors: ['bad'] });
    expect(() => service.addComponent('e1', 'c', {})).toThrow(ValidationError);
  });

  it('throws when entity update fails', () => {
    entity.addComponent.mockReturnValue(false);
    const { service } = createService({ entity });
    expect(() => service.addComponent('e1', 'c', {})).toThrow(
      "Failed to add component 'c' to entity 'e1'. Internal entity update failed."
    );
  });
});
