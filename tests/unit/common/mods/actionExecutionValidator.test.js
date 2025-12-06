import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validateActionExecution,
  ActionValidationError,
} from '../../../common/mods/actionExecutionValidator.js';

describe('actionExecutionValidator - Entity Existence', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      // Note: EntityManager uses getEntityInstance(), not entityExists()
      getEntityInstance: jest.fn((id) =>
        id === 'existing_entity' ? {} : undefined
      ),
      hasComponent: jest.fn(() => false),
    };
  });

  it('should detect missing actor entity', () => {
    const errors = validateActionExecution({
      actorId: 'nonexistent_actor',
      targetId: null,
      actionDefinition: {},
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      type: 'entity_not_found',
      entityId: 'nonexistent_actor',
      role: 'actor',
      severity: 'critical',
    });
  });

  it('should detect missing target entity', () => {
    const errors = validateActionExecution({
      actorId: 'existing_entity',
      targetId: 'nonexistent_target',
      actionDefinition: {},
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      type: 'entity_not_found',
      entityId: 'nonexistent_target',
      role: 'primary target',
      severity: 'critical',
    });
  });

  it('should skip component validation if entity missing', () => {
    // This ensures we don't try to check components on nonexistent entities
    const errors = validateActionExecution({
      actorId: 'nonexistent_actor',
      targetId: null,
      actionDefinition: {
        required_components: {
          actor: ['some:component'],
        },
      },
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    // Should only have entity_not_found error, not component errors
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('entity_not_found');
  });
});

describe('actionExecutionValidator - Required Components', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      // Note: EntityManager uses getEntityInstance(), not entityExists()
      getEntityInstance: jest.fn(() => ({})), // All entities exist in this test suite
      hasComponent: jest.fn((entityId, componentType) => {
        // Simulate actor1 has positioning:sitting_on, but not positioning:standing
        if (
          entityId === 'actor1' &&
          componentType === 'positioning:sitting_on'
        ) {
          return true;
        }
        return false;
      }),
    };
  });

  it('should detect missing required component on actor', () => {
    const errors = validateActionExecution({
      actorId: 'actor1',
      targetId: null,
      actionDefinition: {
        required_components: {
          actor: ['positioning:standing'], // Actor doesn't have this
        },
      },
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      type: 'missing_required_component',
      entityId: 'actor1',
      role: 'actor',
      componentType: 'positioning:standing',
      severity: 'high',
    });
  });

  it('should detect missing required component on primary target', () => {
    const errors = validateActionExecution({
      actorId: 'actor1',
      targetId: 'target1',
      actionDefinition: {
        required_components: {
          primary: ['positioning:sitting_on'],
        },
      },
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      type: 'missing_required_component',
      entityId: 'target1',
      role: 'primary target',
      componentType: 'positioning:sitting_on',
      severity: 'high',
    });
  });

  it('should pass validation if all required components present', () => {
    const errors = validateActionExecution({
      actorId: 'actor1',
      targetId: null,
      actionDefinition: {
        required_components: {
          actor: ['positioning:sitting_on'], // Actor has this
        },
      },
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    expect(errors).toHaveLength(0);
  });
});

describe('actionExecutionValidator - Forbidden Components', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      // Note: EntityManager uses getEntityInstance(), not entityExists()
      getEntityInstance: jest.fn(() => ({})), // All entities exist in this test suite
      hasComponent: jest.fn((entityId, componentType) => {
        // Simulate actor1 has positioning:kneeling
        if (entityId === 'actor1' && componentType === 'positioning:kneeling') {
          return true;
        }
        return false;
      }),
    };
  });

  it('should detect forbidden component on actor', () => {
    const errors = validateActionExecution({
      actorId: 'actor1',
      targetId: null,
      actionDefinition: {
        forbidden_components: {
          actor: ['positioning:kneeling'], // Actor has this (forbidden)
        },
      },
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      type: 'forbidden_component_present',
      entityId: 'actor1',
      role: 'actor',
      componentType: 'positioning:kneeling',
      severity: 'medium',
    });
  });

  it('should pass validation if forbidden component absent', () => {
    const errors = validateActionExecution({
      actorId: 'actor1',
      targetId: null,
      actionDefinition: {
        forbidden_components: {
          actor: ['positioning:standing'], // Actor doesn't have this
        },
      },
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    expect(errors).toHaveLength(0);
  });
});

describe('ActionValidationError - Error Formatting', () => {
  it('should format errors with context', () => {
    const errors = [
      {
        type: 'missing_required_component',
        entityId: 'actor1',
        role: 'actor',
        componentType: 'positioning:sitting_on',
        message:
          "Actor 'actor1' missing required component 'positioning:sitting_on'",
        suggestion:
          "Add component: actor.withComponent('positioning:sitting_on', {...})",
        reason: 'Required by test:action',
        severity: 'high',
      },
    ];

    const err = new ActionValidationError(errors, {
      actorId: 'actor1',
      targetId: 'target1',
      actionId: 'test:action',
    });

    expect(err.message).toContain('ACTION EXECUTION VALIDATION FAILED');
    expect(err.message).toContain('Action: test:action');
    expect(err.message).toContain('Actor: actor1');
    expect(err.message).toContain('Primary Target: target1');
    expect(err.message).toContain('positioning:sitting_on');
    expect(err.message).toContain('💡 Suggestion');
  });

  it('should group errors by severity', () => {
    const errors = [
      {
        type: 'entity_not_found',
        message: 'Critical error',
        severity: 'critical',
      },
      {
        type: 'missing_required_component',
        message: 'High error',
        severity: 'high',
      },
      {
        type: 'forbidden_component_present',
        message: 'Medium error',
        severity: 'medium',
      },
    ];

    const err = new ActionValidationError(errors, {
      actorId: 'actor1',
      actionId: 'test:action',
    });

    expect(err.message).toContain('CRITICAL ERRORS (1)');
    expect(err.message).toContain('HIGH PRIORITY ERRORS (1)');
    expect(err.message).toContain('MEDIUM PRIORITY ERRORS (1)');
  });
});
