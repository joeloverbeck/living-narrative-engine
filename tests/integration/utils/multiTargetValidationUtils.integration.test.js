import {
  isValidTargetName,
  isValidEntityId,
  determinePrimaryTarget,
  validateTargetValue,
  validateAttemptActionPayload,
} from '../../../src/utils/multiTargetValidationUtils.js';

describe('multiTargetValidationUtils integration', () => {
  describe('isValidTargetName', () => {
    it('accepts well-formed identifiers', () => {
      expect(isValidTargetName('PrimaryTarget_01')).toBe(true);
    });

    it('rejects blank or improperly formatted names', () => {
      expect(isValidTargetName('')).toBe(false);
      expect(isValidTargetName('  ')).toBe(false);
      expect(isValidTargetName('1invalid')).toBe(false);
      expect(isValidTargetName('invalid-name')).toBe(false);
    });
  });

  describe('isValidEntityId', () => {
    it('supports both namespaced identifiers and uuids', () => {
      expect(isValidEntityId('module:entity_42')).toBe(true);
      expect(isValidEntityId('123e4567-e89b-12d3-a456-426614174000')).toBe(
        true
      );
    });

    it('rejects blank values and invalid characters', () => {
      expect(isValidEntityId('')).toBe(false);
      expect(isValidEntityId('invalid id')).toBe(false);
      expect(isValidEntityId('with%percent')).toBe(false);
    });
  });

  describe('determinePrimaryTarget', () => {
    it('returns null when targets are missing or empty', () => {
      expect(determinePrimaryTarget(null)).toBeNull();
      expect(determinePrimaryTarget(undefined)).toBeNull();
      expect(determinePrimaryTarget(42)).toBeNull();
      expect(determinePrimaryTarget({})).toBeNull();
    });

    it('honors priority order across roles', () => {
      const targets = {
        random: 'mod:random',
        target: 'legacy:target',
        actor: { entityId: 'actor:1' },
        secondary: { entityId: 'secondary:1' },
        primary: 'primary:target',
      };

      expect(determinePrimaryTarget(targets)).toBe('primary:target');
    });

    it('falls back to first target when no priority match exists', () => {
      const stringFirst = { unrelated: 'ally:1' };
      const objectFirst = { extra: { entityId: 'enemy:9' } };

      expect(determinePrimaryTarget(stringFirst)).toBe('ally:1');
      expect(determinePrimaryTarget(objectFirst)).toBe('enemy:9');
    });
  });

  describe('validateTargetValue', () => {
    it('requires a target to be provided', () => {
      const missingTarget = validateTargetValue(null, 'primary');
      const emptyLiteral = validateTargetValue('', 'primary');

      expect(missingTarget.isValid).toBe(false);
      expect(missingTarget.errors).toContain('primary target is required');

      expect(emptyLiteral.isValid).toBe(false);
      expect(emptyLiteral.errors).toContain('primary target is required');
    });

    it('validates string targets', () => {
      const whitespace = validateTargetValue('   ', 'secondary');
      const badFormat = validateTargetValue('invalid id', 'secondary');
      const valid = validateTargetValue('valid_id-1', 'secondary');

      expect(whitespace.isValid).toBe(false);
      expect(whitespace.errors).toContain(
        'secondary target cannot be empty string'
      );

      expect(badFormat.isValid).toBe(false);
      expect(badFormat.errors).toContain(
        'secondary target has invalid entity ID format'
      );

      expect(valid.isValid).toBe(true);
      expect(valid.errors).toHaveLength(0);
    });

    it('validates object targets thoroughly', () => {
      const missingEntity = validateTargetValue({}, 'ally');
      const nonStringEntity = validateTargetValue(
        {
          entityId: 123,
          placeholder: 42,
          description: {},
          resolvedFromContext: 'yes',
          contextSource: 77,
        },
        'ally'
      );
      const blankEntity = validateTargetValue({ entityId: '   ' }, 'ally');
      const invalidEntity = validateTargetValue(
        { entityId: 'bad id', placeholder: 'ok', description: 'text' },
        'ally'
      );

      expect(missingEntity.isValid).toBe(false);
      expect(missingEntity.errors).toContain(
        'ally target object must have entityId property'
      );

      expect(nonStringEntity.isValid).toBe(false);
      expect(nonStringEntity.errors).toEqual(
        expect.arrayContaining([
          'ally target entityId must be a string',
          'ally target placeholder must be a string',
          'ally target description must be a string',
          'ally target resolvedFromContext must be a boolean',
          'ally target contextSource must be a string',
        ])
      );

      expect(blankEntity.isValid).toBe(false);
      expect(blankEntity.errors).toContain(
        'ally target entityId cannot be empty'
      );

      expect(invalidEntity.isValid).toBe(false);
      expect(invalidEntity.errors).toContain(
        'ally target entityId has invalid format'
      );
    });

    it('rejects unsupported target types', () => {
      const result = validateTargetValue(42, 'other');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'other target must be a string or object'
      );
    });
  });

  describe('validateAttemptActionPayload', () => {
    it('requires a payload with mandatory fields', () => {
      expect(validateAttemptActionPayload(undefined)).toEqual({
        isValid: false,
        errors: ['Payload is required'],
        warnings: [],
        details: {},
      });

      const missingFields = validateAttemptActionPayload({});
      expect(missingFields.isValid).toBe(false);
      expect(missingFields.errors).toEqual(
        expect.arrayContaining([
          'actorId is required',
          'actionId is required',
          'originalInput is required',
          'Either targets object or targetId must be provided',
        ])
      );
    });

    it('propagates target validation errors before computing primary target', () => {
      const result = validateAttemptActionPayload({
        actorId: 'actor:1',
        actionId: 'action:wave',
        originalInput: 'wave at ally',
        targets: {
          primary: '   ',
        },
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('primary target cannot be empty string');
      expect(result.details.primaryTarget).toBeNull();
      expect(result.details.targetCount).toBe(1);
      expect(result.details.hasMultipleTargets).toBe(false);
    });

    it('validates multi-target payloads and surfaces warnings when inconsistent', () => {
      const result = validateAttemptActionPayload({
        actorId: 'actor:main',
        actionId: 'action:wave',
        originalInput: 'wave enthusiastically',
        targetId: 'legacy:target',
        targets: {
          primary: 'friend:primary',
          secondary: {
            entityId: 'friend:secondary',
            placeholder: 'Select a friend',
            description: 'Backup recipient',
            resolvedFromContext: true,
            contextSource: 'scene',
          },
          actor: { entityId: 'actor:main' },
        },
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContain(
        'targetId does not match determined primary target'
      );
      expect(result.details).toEqual(
        expect.objectContaining({
          primaryTarget: 'friend:primary',
          targetCount: 3,
          hasMultipleTargets: true,
        })
      );
    });

    it('accepts single targetId payloads and enforces formatting', () => {
      const validTargetId = validateAttemptActionPayload({
        actorId: 'actor:solo',
        actionId: 'action:bow',
        originalInput: 'bow gracefully',
        targetId: 'partner_1',
      });

      expect(validTargetId.isValid).toBe(true);
      expect(validTargetId.errors).toHaveLength(0);
      expect(validTargetId.details).toEqual(
        expect.objectContaining({
          primaryTarget: 'partner_1',
          targetCount: 1,
          hasMultipleTargets: false,
        })
      );

      const invalidTargetId = validateAttemptActionPayload({
        actorId: 'actor:solo',
        actionId: 'action:bow',
        originalInput: 'bow gracefully',
        targetId: 'invalid id',
      });

      expect(invalidTargetId.isValid).toBe(false);
      expect(invalidTargetId.errors).toContain(
        'targetId has invalid entity ID format'
      );
    });

    it('supports null targetId for legacy payloads', () => {
      const result = validateAttemptActionPayload({
        actorId: 'actor:solo',
        actionId: 'action:shrug',
        originalInput: 'shrug',
        targetId: null,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details).toEqual(
        expect.objectContaining({
          primaryTarget: null,
          targetCount: 0,
          hasMultipleTargets: false,
        })
      );
    });
  });
});
