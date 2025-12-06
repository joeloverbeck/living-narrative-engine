import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionDefinitionValidator } from '../../../../src/actions/builders/actionDefinitionValidator.js';

const createBaseDefinition = () => ({
  id: 'core:test-action',
  name: 'Test Action',
  description: 'A valid test action',
  scope: 'core:test-scope',
  template: 'do something to {target}',
  required_components: { actor: ['core:test-component'] },
  prerequisites: ['core:test-prereq'],
});

describe('ActionDefinitionValidator integration coverage', () => {
  let validator;

  beforeEach(() => {
    validator = new ActionDefinitionValidator();
  });

  it('returns an invalid result when definition is not an object', () => {
    const result = validator.validate(null);

    expect(result).toEqual({
      isValid: false,
      errors: ['Definition must be a valid object'],
    });
  });

  it('requires all fundamental fields to be present', () => {
    const result = validator.validate({});

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Action ID is required',
        'Action name is required',
        'Action description is required',
        'Action scope is required',
        'Action template is required',
      ])
    );
  });

  it('validates ID and scope formats using namespace:identifier convention', () => {
    const definition = {
      ...createBaseDefinition(),
      id: 'invalid id',
      scope: 'not-valid-scope',
    };

    const result = validator.validate(definition);

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Action ID must follow namespace:identifier format (e.g., "core:attack")',
        'Scope must be "none" or follow namespace:identifier format (e.g., "core:nearby_actors")',
      ])
    );
  });

  it('allows non-targeted actions to omit the {target} placeholder', () => {
    const definition = {
      ...createBaseDefinition(),
      scope: 'none',
      template: 'wait patiently',
    };

    const result = validator.validate(definition);

    expect(result).toEqual({ isValid: true, errors: [] });
  });

  it('requires the {target} placeholder for targeted actions', () => {
    const definition = {
      ...createBaseDefinition(),
      template: 'speak to target directly',
    };

    const result = validator.validate(definition);

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Template for targeted actions should include {target} placeholder',
      ])
    );
  });

  it('enforces required_components actor to be an array', () => {
    const definition = {
      ...createBaseDefinition(),
      required_components: { actor: 'not-an-array' },
    };

    const result = validator.validate(definition);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'required_components.actor must be an array'
    );
  });

  it('validates every required component entry for type and format', () => {
    const definition = {
      ...createBaseDefinition(),
      required_components: {
        actor: ['core:good-component', 42, 'invalid-component'],
      },
    };

    const result = validator.validate(definition);

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Component at index 1 must be a string',
        'Invalid component ID at index 2: "invalid-component" (must follow namespace:identifier format)',
      ])
    );
  });

  it('requires required_components to be an object with an actor property', () => {
    const notObject = {
      ...createBaseDefinition(),
      required_components: 'broken',
    };

    const missingActor = {
      ...createBaseDefinition(),
      required_components: {},
    };

    const notObjectResult = validator.validate(notObject);
    const missingActorResult = validator.validate(missingActor);

    expect(notObjectResult.isValid).toBe(false);
    expect(notObjectResult.errors).toContain(
      'required_components must be an object'
    );
    expect(missingActorResult.isValid).toBe(false);
    expect(missingActorResult.errors).toContain(
      'required_components must have an "actor" property'
    );
  });

  it('validates prerequisite structures for arrays, strings, and objects', () => {
    const nonArrayDefinition = {
      ...createBaseDefinition(),
      prerequisites: 'broken',
    };

    const complexDefinition = {
      ...createBaseDefinition(),
      prerequisites: [
        'invalid-prereq',
        7,
        {},
        { logic: {} },
        { logic: { condition_ref: 99 } },
        { logic: { condition_ref: 'bad-ref' } },
        { logic: { condition_ref: 'core:valid' }, failure_message: 0 },
      ],
    };

    const nonArrayResult = validator.validate(nonArrayDefinition);
    const complexResult = validator.validate(complexDefinition);

    expect(nonArrayResult.isValid).toBe(false);
    expect(nonArrayResult.errors).toContain('Prerequisites must be an array');
    expect(complexResult.isValid).toBe(false);
    expect(complexResult.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Invalid prerequisite ID at index 0: "invalid-prereq" (must follow namespace:identifier format)'
        ),
        expect.stringContaining(
          'Invalid prerequisite format at index 1: expected string or object'
        ),
        expect.stringContaining(
          'Invalid prerequisite format at index 2: expected string or object'
        ),
        expect.stringContaining(
          'Invalid prerequisite format at index 3: expected string or object'
        ),
        expect.stringContaining(
          'Prerequisite condition_ref at index 4 must be a string'
        ),
        expect.stringContaining(
          'Invalid prerequisite condition_ref at index 5: "bad-ref" (must follow namespace:identifier format)'
        ),
        expect.stringContaining(
          'Prerequisite failure_message at index 6 must be a string'
        ),
      ])
    );
  });

  it('returns a successful validation result for comprehensive definitions', () => {
    const definition = {
      ...createBaseDefinition(),
      prerequisites: [
        'core:first-prereq',
        {
          logic: { condition_ref: 'core:second-prereq' },
          failure_message: 'Needs condition',
        },
      ],
      required_components: {
        actor: ['core:primary-component', 'core:secondary_component'],
      },
    };

    const result = validator.validate(definition);

    expect(result).toEqual({ isValid: true, errors: [] });
  });
});
