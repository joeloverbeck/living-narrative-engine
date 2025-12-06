import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionDefinitionBuilder } from '../../../../src/actions/builders/actionDefinitionBuilder.js';
import { ActionDefinitionValidator } from '../../../../src/actions/builders/actionDefinitionValidator.js';
import { InvalidActionDefinitionError } from '../../../../src/errors/invalidActionDefinitionError.js';

/**
 * Integration tests that exercise the fluent builder together with the real validator.
 * The goal is to ensure the builder's convenience helpers generate definitions that the
 * validator accepts and that validation failures surface through the runtime error flow.
 */
describe('ActionDefinitionBuilder integration behavior', () => {
  let validator;

  beforeEach(() => {
    validator = new ActionDefinitionValidator();
  });

  it('builds targeted combat actions that remain valid and isolate the internal builder state', () => {
    const builder = new ActionDefinitionBuilder('core:engage-target');

    const definition = builder
      .withName('Engage')
      .withDescription('Engage a nearby opponent')
      .asTargetedAction('core:nearby_actors', 'with {target}')
      .asCombatAction()
      .withPrerequisite('core:combat-trained')
      .withPrerequisite('core:weapon-ready', 'You must brandish a weapon')
      .requiresComponents(['core:position', 'core:stamina'])
      .build();

    expect(definition).toMatchObject({
      id: 'core:engage-target',
      name: 'Engage',
      description: 'Engage a nearby opponent',
      scope: 'core:nearby_actors',
      template: 'engage with {target}',
      required_components: {
        actor: ['core:position', 'core:health', 'core:stamina'],
      },
      prerequisites: [
        {
          logic: { condition_ref: 'movement:actor-can-move' },
          failure_message: 'You cannot move right now',
        },
        {
          logic: { condition_ref: 'core:has-health' },
          failure_message: 'You need health to perform this action',
        },
        'core:combat-trained',
        {
          logic: { condition_ref: 'core:weapon-ready' },
          failure_message: 'You must brandish a weapon',
        },
      ],
    });

    const validationResult = validator.validate(definition);
    expect(validationResult).toEqual({ isValid: true, errors: [] });

    // Mutating the returned definition should not bleed back into the builder.
    definition.required_components.actor.push('core:spoofed');
    definition.name = 'Mutated';

    const snapshot = builder.toPartial();
    expect(snapshot.name).toBe('Engage');
    expect(snapshot.required_components.actor).toEqual([
      'core:position',
      'core:health',
      'core:stamina',
    ]);
  });

  it('reconstructs builders from existing definitions and surfaces validator errors when rules break', () => {
    const baseDefinition = {
      id: 'mod:ritual',
      name: 'Perform Ritual',
      description: 'Carry out a ritual at a sacred site',
      scope: 'none',
      template: 'perform ritual',
      prerequisites: ['mod:ritual-ready'],
      required_components: { actor: ['core:spirit'] },
    };

    const builder = ActionDefinitionBuilder.fromDefinition(baseDefinition);
    const targetedDefinition = builder
      .asTargetedAction('mod:ritual_circle', 'at {target}')
      .requiresComponent('core:focus_crystal')
      .withPrerequisite(
        'core:ritual-site-ready',
        'The ritual site must already be prepared'
      )
      .build();

    expect(targetedDefinition.scope).toBe('mod:ritual_circle');
    expect(targetedDefinition.template).toBe('perform ritual at {target}');
    expect(targetedDefinition.required_components.actor).toEqual([
      'core:spirit',
      'core:focus_crystal',
    ]);
    expect(targetedDefinition.prerequisites).toEqual([
      'mod:ritual-ready',
      {
        logic: { condition_ref: 'core:ritual-site-ready' },
        failure_message: 'The ritual site must already be prepared',
      },
    ]);
    expect(validator.validate(targetedDefinition)).toEqual({
      isValid: true,
      errors: [],
    });

    builder.withTemplate('perform ritual together');
    expect(() => builder.build()).toThrow(InvalidActionDefinitionError);
    try {
      builder.build();
      throw new Error(
        'Expected builder.build() to throw due to invalid targeted template'
      );
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidActionDefinitionError);
      expect(error.message).toContain(
        'Template for targeted actions should include {target} placeholder'
      );
    }

    builder.withTemplate('perform ritual beside {target}');
    const recoveredDefinition = builder.build();
    expect(recoveredDefinition.template).toBe('perform ritual beside {target}');
    expect(validator.validate(recoveredDefinition)).toEqual({
      isValid: true,
      errors: [],
    });
  });
});
