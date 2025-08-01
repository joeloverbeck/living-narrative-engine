/**
 * @file Ensure multi-target enhancements don't break existing functionality
 * @description Integration tests for backward compatibility with legacy action systems
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TargetManager } from '../../../src/entities/multiTarget/targetManager.js';
import { TargetExtractionResult } from '../../../src/entities/multiTarget/targetExtractionResult.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

describe('Multi-Target Backward Compatibility', () => {
  let logger;
  let targetManager;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');
    logger.debug = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Legacy Action Support', () => {
    it('should handle pre-multi-target action definitions', async () => {
      // Should work with new system
      targetManager = new TargetManager({ logger });
      targetManager.addTarget('target', 'entity_001');

      expect(targetManager.getEntityIdByPlaceholder('target')).toBe(
        'entity_001'
      );
      expect(targetManager.isMultiTarget()).toBe(false);
    });

    it('should maintain compatibility with single-target event payloads', async () => {
      targetManager = new TargetManager({ logger });
      targetManager.addTarget('primary', 'single_target');

      // Legacy code expects getPrimaryTarget
      expect(targetManager.getPrimaryTarget()).toBe('single_target');

      // New code can use getEntityIdByPlaceholder
      expect(targetManager.getEntityIdByPlaceholder('primary')).toBe(
        'single_target'
      );

      // Both should return same value
      expect(targetManager.getPrimaryTarget()).toBe(
        targetManager.getEntityIdByPlaceholder('primary')
      );
    });

    it('should support legacy target property access', async () => {
      targetManager = new TargetManager({ logger });
      targetManager.setTargets({
        target: 'legacy_entity', // Legacy single target format
      });

      // Should work with both old and new access patterns
      expect(targetManager.getTarget('target')).toBe('legacy_entity');
      expect(targetManager.getEntityIdByPlaceholder('target')).toBe(
        'legacy_entity'
      );
      expect(targetManager.getPrimaryTarget()).toBe('legacy_entity');
    });

    it('should handle legacy action definitions with implicit primary target', async () => {
      targetManager = new TargetManager({ logger });

      // Legacy pattern: single unnamed target becomes primary
      targetManager.addTarget('target', 'entity_001');

      const targetsObject = targetManager.getTargetsObject();
      expect(targetsObject.target).toBe('entity_001');
      expect(targetManager.getPrimaryTarget()).toBe('entity_001');
    });
  });

  describe('Migration Path', () => {
    it('should support gradual migration from single to multi-target', async () => {
      targetManager = new TargetManager({ logger });

      // Start with single target (legacy)
      targetManager.addTarget('target', 'entity_001');
      expect(targetManager.isMultiTarget()).toBe(false);

      // Add second target (becomes multi-target)
      targetManager.addTarget('secondary', 'entity_002');
      expect(targetManager.isMultiTarget()).toBe(true);

      // Both access patterns work
      expect(targetManager.getTarget('target')).toBe('entity_001');
      expect(targetManager.getEntityIdByPlaceholder('target')).toBe(
        'entity_001'
      );
    });

    it('should preserve legacy behavior when using single targets', async () => {
      targetManager = new TargetManager({ logger });

      // Legacy single target setup
      targetManager.setTargets({ primary: 'entity_001' });

      // Should behave like legacy single-target
      expect(targetManager.isMultiTarget()).toBe(false);
      expect(targetManager.getTargetCount()).toBe(1);
      expect(targetManager.getPrimaryTarget()).toBe('entity_001');

      // Legacy serialization format should work
      const json = targetManager.toJSON();
      expect(json.primaryTarget).toBe('entity_001');
      expect(json.isMultiTarget).toBe(false);
    });

    it('should handle mixed legacy and new target formats', async () => {
      targetManager = new TargetManager({ logger });

      // Mix of legacy and new naming conventions
      targetManager.setTargets({
        target: 'legacy_target', // Legacy name
        primary: 'new_primary', // New convention
        secondary: 'new_secondary', // New convention
      });

      // All should be accessible
      expect(targetManager.getTarget('target')).toBe('legacy_target');
      expect(targetManager.getTarget('primary')).toBe('new_primary');
      expect(targetManager.getTarget('secondary')).toBe('new_secondary');

      // Should detect as multi-target
      expect(targetManager.isMultiTarget()).toBe(true);
    });
  });

  describe('Event Payload Compatibility', () => {
    it('should generate backward-compatible event payloads', async () => {
      targetManager = new TargetManager({ logger });
      targetManager.addTarget('primary', 'entity_001');

      const targetExtraction = new TargetExtractionResult({
        targetManager,
      });

      // Legacy systems expect specific payload structure
      const payload = {
        targetId: targetExtraction.getPrimaryTarget(),
        targetEntityId: targetExtraction.getPrimaryTarget(),
        isMultiTarget: targetExtraction.isMultiTarget(),
      };

      expect(payload.targetId).toBe('entity_001');
      expect(payload.targetEntityId).toBe('entity_001');
      expect(payload.isMultiTarget).toBe(false);
    });

    it('should support legacy target extraction patterns', async () => {
      targetManager = new TargetManager({ logger });
      targetManager.setTargets({
        primary: 'entity_001',
        secondary: 'entity_002',
      });

      const targetExtraction = new TargetExtractionResult({
        targetManager,
      });

      // Legacy code might access targets directly
      const primaryTarget = targetExtraction.getPrimaryTarget();
      expect(primaryTarget).toBe('entity_001');

      // Legacy code might check for multi-target
      expect(targetExtraction.isMultiTarget()).toBe(true);

      // Legacy code might get all targets
      const allTargets = targetExtraction.getTargets();
      expect(allTargets.primary).toBe('entity_001');
      expect(allTargets.secondary).toBe('entity_002');
    });
  });

  describe('API Surface Compatibility', () => {
    it('should maintain all legacy TargetManager methods', async () => {
      targetManager = new TargetManager({ logger });

      // Test all legacy methods exist and work
      const legacyMethods = [
        'addTarget',
        'setTargets',
        'getTarget',
        'getPrimaryTarget',
        'getTargetCount',
        'getTargetNames',
        'getEntityIds',
        'getTargetsObject',
        'isMultiTarget',
        'validate',
        'toJSON',
      ];

      legacyMethods.forEach((method) => {
        expect(typeof targetManager[method]).toBe('function');
      });

      // Test legacy method behaviors
      targetManager.addTarget('test', 'entity_001');
      expect(targetManager.getTarget('test')).toBe('entity_001');
      expect(targetManager.getTargetCount()).toBe(1);
      expect(targetManager.getTargetNames()).toContain('test');
      expect(targetManager.getEntityIds()).toContain('entity_001');
    });

    it('should maintain legacy TargetExtractionResult interface', async () => {
      targetManager = new TargetManager({ logger });
      targetManager.addTarget('primary', 'entity_001');

      const extraction = new TargetExtractionResult({ targetManager });

      // Legacy methods should exist
      expect(typeof extraction.getPrimaryTarget).toBe('function');
      expect(typeof extraction.isMultiTarget).toBe('function');
      expect(typeof extraction.getTargets).toBe('function');
      expect(typeof extraction.getTargetManager).toBe('function');

      // Legacy behavior
      expect(extraction.getPrimaryTarget()).toBe('entity_001');
      expect(extraction.isMultiTarget()).toBe(false);
    });
  });

  describe('Serialization Compatibility', () => {
    it('should maintain backward-compatible JSON serialization', async () => {
      targetManager = new TargetManager({ logger });
      targetManager.setTargets({
        primary: 'entity_001',
      });

      const json = targetManager.toJSON();

      // Legacy fields should exist
      expect(json).toHaveProperty('targets');
      expect(json).toHaveProperty('primaryTarget');
      expect(json).toHaveProperty('isMultiTarget');
      expect(json).toHaveProperty('targetCount');

      // Values should match legacy expectations
      expect(json.primaryTarget).toBe('entity_001');
      expect(json.isMultiTarget).toBe(false);
      expect(json.targetCount).toBe(1);
    });

    it('should deserialize legacy JSON formats', async () => {
      // Legacy JSON format
      const legacyJson = {
        targets: {
          target: 'entity_001',
        },
        primaryTarget: 'entity_001',
        isMultiTarget: false,
        targetCount: 1,
      };

      // Should be able to reconstruct from legacy format
      targetManager = new TargetManager({
        targets: legacyJson.targets,
        primaryTarget: legacyJson.primaryTarget,
        logger,
      });

      expect(targetManager.getPrimaryTarget()).toBe('entity_001');
      expect(targetManager.isMultiTarget()).toBe(false);
      expect(targetManager.getTargetCount()).toBe(1);
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should maintain legacy error behaviors', async () => {
      targetManager = new TargetManager({ logger });

      // Legacy code might expect specific error handling
      expect(() => {
        targetManager.addTarget('', 'entity_001');
      }).toThrow();

      expect(() => {
        targetManager.addTarget('target', '');
      }).toThrow();

      // Legacy null checks
      expect(() => {
        targetManager.addTarget(null, 'entity_001');
      }).toThrow();
    });

    it('should handle legacy undefined target gracefully', async () => {
      targetManager = new TargetManager({ logger });

      // Legacy code might check for undefined targets
      const undefinedTarget = targetManager.getTarget('nonexistent');
      expect(undefinedTarget).toBeNull(); // getTarget returns null for non-existent targets

      // Should not throw
      const undefinedById =
        targetManager.getEntityIdByPlaceholder('nonexistent');
      expect(undefinedById).toBeNull(); // Also returns null for consistency
    });
  });

  describe('Integration with Legacy Systems', () => {
    it('should work with legacy action resolution patterns', async () => {
      // Simulate legacy action resolution
      const legacyActionContext = {
        action: {
          id: 'examine',
          template: 'examine {target}',
        },
        target: 'entity_001', // Legacy single target
      };

      targetManager = new TargetManager({ logger });
      targetManager.addTarget('target', legacyActionContext.target);

      // Should work with legacy resolution
      expect(targetManager.getPrimaryTarget()).toBe('entity_001');
      expect(targetManager.getTarget('target')).toBe('entity_001');
    });

    it('should support legacy validation patterns', async () => {
      targetManager = new TargetManager({ logger });
      targetManager.addTarget('primary', 'entity_001');

      // Legacy validation might just check for primary target
      const validation = targetManager.validate();
      expect(validation.isValid).toBe(true);

      // Verify target count through the manager
      expect(targetManager.getTargetCount()).toBe(1);
      expect(targetManager.getPrimaryTarget()).toBe('entity_001');

      // Legacy code might only care about these fields
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });
  });
});
