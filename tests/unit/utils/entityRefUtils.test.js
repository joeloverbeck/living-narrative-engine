/**
 * @file Unit tests for entityRefUtils module
 * @see src/utils/entityRefUtils.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { resolveEntityId } from '../../../src/utils/entityRefUtils.js';

describe('entityRefUtils', () => {
  describe('resolveEntityId', () => {
    let mockExecutionContext;

    beforeEach(() => {
      mockExecutionContext = {
        evaluationContext: {
          actor: { id: 'test_actor' },
          target: { id: 'test_target' },
          event: {
            type: 'core:attempt_action',
            payload: {
              actorId: 'test_actor',
              actionId: 'test:action',
              targetId: 'test_target',
              primaryId: 'primary_entity_123',
              secondaryId: 'secondary_entity_456',
              tertiaryId: 'tertiary_entity_789',
              targets: {
                primary: { entityId: 'primary_entity_123' },
                secondary: { entityId: 'secondary_entity_456' },
                tertiary: { entityId: 'tertiary_entity_789' },
              },
            },
          },
        },
        logger: {
          debug: jest.fn(),
          warn: jest.fn(),
        },
      };
    });

    describe('Placeholder Resolution', () => {
      it('should resolve primary placeholder to entity ID', () => {
        const result = resolveEntityId('primary', mockExecutionContext);
        expect(result).toBe('primary_entity_123');
        expect(mockExecutionContext.logger.debug).toHaveBeenCalledWith(
          "Resolved placeholder 'primary' to entity ID 'primary_entity_123'"
        );
      });

      it('should resolve secondary placeholder to entity ID', () => {
        const result = resolveEntityId('secondary', mockExecutionContext);
        expect(result).toBe('secondary_entity_456');
        expect(mockExecutionContext.logger.debug).toHaveBeenCalledWith(
          "Resolved placeholder 'secondary' to entity ID 'secondary_entity_456'"
        );
      });

      it('should resolve tertiary placeholder to entity ID', () => {
        const result = resolveEntityId('tertiary', mockExecutionContext);
        expect(result).toBe('tertiary_entity_789');
        expect(mockExecutionContext.logger.debug).toHaveBeenCalledWith(
          "Resolved placeholder 'tertiary' to entity ID 'tertiary_entity_789'"
        );
      });

      it('should resolve placeholder from targets object when string value', () => {
        mockExecutionContext.evaluationContext.event.payload = {
          targets: {
            primary: 'string_id_123',
          },
        };
        const result = resolveEntityId('primary', mockExecutionContext);
        expect(result).toBe('string_id_123');
      });

      it('should fallback to flattened format when targets object missing', () => {
        mockExecutionContext.evaluationContext.event.payload = {
          primaryId: 'fallback_id_123',
        };
        const result = resolveEntityId('primary', mockExecutionContext);
        expect(result).toBe('fallback_id_123');
      });

      it('should return null for unresolvable placeholder', () => {
        // Remove targets from payload
        mockExecutionContext.evaluationContext.event.payload.targets = {};
        mockExecutionContext.evaluationContext.event.payload.primaryId = null;

        const result = resolveEntityId('primary', mockExecutionContext);
        expect(result).toBeNull();
        expect(mockExecutionContext.logger.warn).toHaveBeenCalledWith(
          "Failed to resolve placeholder 'primary' - no matching target in event payload",
          {
            placeholder: 'primary',
            availableTargets: ['secondary', 'tertiary'],
            eventType: 'core:attempt_action',
            actionId: 'test:action',
            suggestion: 'Available targets: secondary, tertiary',
          }
        );
      });

      it('should handle placeholder with whitespace', () => {
        const result = resolveEntityId('  primary  ', mockExecutionContext);
        expect(result).toBe('primary_entity_123');
      });

      it('should not resolve non-placeholder names as placeholders', () => {
        const result = resolveEntityId('quaternary', mockExecutionContext);
        expect(result).toBe('quaternary'); // Should return as direct ID
        expect(mockExecutionContext.logger.debug).not.toHaveBeenCalled();
        expect(mockExecutionContext.logger.warn).not.toHaveBeenCalled();
      });
    });

    describe('Backward Compatibility', () => {
      it('should still resolve actor keyword', () => {
        const result = resolveEntityId('actor', mockExecutionContext);
        expect(result).toBe('test_actor');
      });

      it('should still resolve target keyword', () => {
        const result = resolveEntityId('target', mockExecutionContext);
        expect(result).toBe('test_target');
      });

      it('should still resolve direct entity IDs', () => {
        const result = resolveEntityId('core:player', mockExecutionContext);
        expect(result).toBe('core:player');
      });

      it('should still resolve UUID entity IDs', () => {
        const uuid = 'fd6a1e00-36b7-47cc-bdb2-4b65473614eb';
        const result = resolveEntityId(uuid, mockExecutionContext);
        expect(result).toBe(uuid);
      });

      it('should still resolve object references', () => {
        const result = resolveEntityId(
          { entityId: 'test_entity' },
          mockExecutionContext
        );
        expect(result).toBe('test_entity');
      });

      it('should trim whitespace from object entityId', () => {
        const result = resolveEntityId(
          { entityId: '  test_entity  ' },
          mockExecutionContext
        );
        expect(result).toBe('test_entity');
      });
    });

    describe('Edge Cases', () => {
      it('should handle null ref', () => {
        const result = resolveEntityId(null, mockExecutionContext);
        expect(result).toBeNull();
      });

      it('should handle undefined ref', () => {
        const result = resolveEntityId(undefined, mockExecutionContext);
        expect(result).toBeNull();
      });

      it('should handle empty string ref', () => {
        const result = resolveEntityId('', mockExecutionContext);
        expect(result).toBeNull();
      });

      it('should handle whitespace-only string ref', () => {
        const result = resolveEntityId('   ', mockExecutionContext);
        expect(result).toBeNull();
      });

      it('should handle object with null entityId', () => {
        const result = resolveEntityId(
          { entityId: null },
          mockExecutionContext
        );
        expect(result).toBeNull();
      });

      it('should handle object with empty entityId', () => {
        const result = resolveEntityId({ entityId: '' }, mockExecutionContext);
        expect(result).toBeNull();
      });

      it('should handle object without entityId property', () => {
        const result = resolveEntityId(
          { someOtherProp: 'value' },
          mockExecutionContext
        );
        expect(result).toBeNull();
      });

      it('should handle missing execution context', () => {
        const result = resolveEntityId('primary', null);
        expect(result).toBeNull();
      });

      it('should handle missing evaluation context', () => {
        const result = resolveEntityId('primary', {});
        expect(result).toBeNull();
      });

      it('should handle missing event in evaluation context', () => {
        const minimalContext = {
          evaluationContext: {
            actor: { id: 'test_actor' },
          },
        };
        const result = resolveEntityId('primary', minimalContext);
        expect(result).toBeNull();
      });

      it('should handle missing payload in event', () => {
        const contextNoPayload = {
          evaluationContext: {
            event: {},
          },
        };
        const result = resolveEntityId('primary', contextNoPayload);
        expect(result).toBeNull();
      });

      it('should work without logger', () => {
        delete mockExecutionContext.logger;
        const result = resolveEntityId('primary', mockExecutionContext);
        expect(result).toBe('primary_entity_123');
        // Should not throw even without logger
      });
    });

    describe('Debug Logging', () => {
      it('should provide available targets in warning when resolution fails', () => {
        mockExecutionContext.evaluationContext.event.payload = {
          primaryId: 'id1',
          tertiaryId: 'id3',
          targets: {
            custom: 'custom_id',
          },
        };

        resolveEntityId('secondary', mockExecutionContext);

        expect(mockExecutionContext.logger.warn).toHaveBeenCalledWith(
          "Failed to resolve placeholder 'secondary' - no matching target in event payload",
          expect.objectContaining({
            placeholder: 'secondary',
            availableTargets: expect.arrayContaining([
              'primary',
              'tertiary',
              'custom',
            ]),
            eventType: 'core:attempt_action',
            actionId: undefined,
            suggestion: 'Available targets: primary, tertiary, custom',
          })
        );
      });

      it('should not log for non-placeholder references', () => {
        resolveEntityId('actor', mockExecutionContext);
        resolveEntityId('target', mockExecutionContext);
        resolveEntityId('some_entity_id', mockExecutionContext);

        expect(mockExecutionContext.logger.debug).not.toHaveBeenCalled();
        expect(mockExecutionContext.logger.warn).not.toHaveBeenCalled();
      });
    });

    describe('Complex Payload Formats', () => {
      it('should handle mixed formats in payload', () => {
        mockExecutionContext.evaluationContext.event.payload = {
          primaryId: 'legacy_primary',
          targets: {
            secondary: { entityId: 'new_secondary' },
            tertiary: 'new_tertiary',
          },
        };

        expect(resolveEntityId('primary', mockExecutionContext)).toBe(
          'legacy_primary'
        );
        expect(resolveEntityId('secondary', mockExecutionContext)).toBe(
          'new_secondary'
        );
        expect(resolveEntityId('tertiary', mockExecutionContext)).toBe(
          'new_tertiary'
        );
      });

      it('should prefer targets object over flattened format', () => {
        mockExecutionContext.evaluationContext.event.payload = {
          primaryId: 'legacy_id',
          targets: {
            primary: { entityId: 'preferred_id' },
          },
        };

        const result = resolveEntityId('primary', mockExecutionContext);
        expect(result).toBe('preferred_id');
      });
    });
  });
});
