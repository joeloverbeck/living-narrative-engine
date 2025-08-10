/**
 * @file Unit tests for TemplateConfigManager
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TemplateConfigManager } from '../../../../../src/characterBuilder/templates/utilities/templateConfigManager.js';
import { ConfigValidator } from '../../../../../src/characterBuilder/templates/config/configValidator.js';
import { DEFAULT_TEMPLATE_CONFIGS } from '../../../../../src/characterBuilder/templates/config/defaultConfigs.js';
import { InvalidConfigError, ConfigMergeError } from '../../../../../src/characterBuilder/templates/errors/templateConfigurationError.js';

describe('TemplateConfigManager', () => {
  let configManager;
  let validator;

  beforeEach(() => {
    validator = new ConfigValidator();
    configManager = new TemplateConfigManager({
      defaults: DEFAULT_TEMPLATE_CONFIGS,
      environment: 'test',
      validator,
      enableCache: true,
    });
  });

  afterEach(() => {
    configManager.clearCache();
  });

  describe('Configuration Merging', () => {
    it('should merge configurations in correct precedence order', () => {
      // Set configs at different levels
      configManager.setConfig('global', 'test-page', { header: { show: false, sticky: false } });
      configManager.setConfig('page', 'test-page', { header: { sticky: true } });

      const config = configManager.getConfig('test-page', {
        header: { height: '100px' },
      });

      // Runtime override should win for height
      expect(config.header.height).toBe('100px');
      // Page-specific should win for sticky
      expect(config.header.sticky).toBe(true);
      // Page level overrides global, so show should be false from global
      // But since page level has sticky:true, it overrides global's sticky:false
      expect(config.header.show).toBe(false);
    });

    it('should preserve deep nested properties', () => {
      const config = configManager.getConfig('page', {
        panels: {
          leftPanel: {
            width: '50%',
          },
        },
      });

      // Should have defaults from DEFAULT_TEMPLATE_CONFIGS
      expect(config.panels.defaultLayout).toBeDefined();
      // Should have runtime override
      expect(config.panels.leftPanel.width).toBe('50%');
    });

    it('should handle array replacements correctly', () => {
      configManager.setConfig('global', 'page', {
        panels: {
          actions: ['edit', 'delete'],
        },
      });

      const config = configManager.getConfig('page', {
        panels: {
          actions: ['save'],
        },
      });

      // Arrays should be replaced, not merged
      expect(config.panels.actions).toEqual(['save']);
    });

    it('should handle null values correctly', () => {
      const config = configManager.getConfig('page', {
        header: {
          subtitle: null,
        },
      });

      expect(config.header.subtitle).toBeNull();
    });
  });

  describe('Global Overrides', () => {
    it('should apply global overrides using dot notation', () => {
      configManager.setGlobalOverride('header.show', false);
      configManager.setGlobalOverride('panels.defaultLayout', 'single');

      const config = configManager.getConfig('page');

      expect(config.header.show).toBe(false);
      expect(config.panels.defaultLayout).toBe('single');
    });

    it('should create nested properties for global overrides', () => {
      configManager.setGlobalOverride('custom.nested.property', 'value');

      const config = configManager.getConfig('page');

      expect(config.custom.nested.property).toBe('value');
    });

    it('should remove global overrides', () => {
      configManager.setGlobalOverride('header.show', false);
      configManager.removeGlobalOverride('header.show');

      const config = configManager.getConfig('page');

      // Should revert to default
      expect(config.header.show).toBe(true);
    });
  });

  describe('Environment Configuration', () => {
    it('should use environment-specific configuration', () => {
      configManager.setEnvironment('development');
      configManager.setConfig('environment', 'page', {
        performance: { cacheTimeout: 0 },
      });

      const config = configManager.getConfig('page');

      expect(config.performance.cacheTimeout).toBe(0);
    });

    it('should change environment and clear cache', () => {
      const config1 = configManager.getConfig('page');
      
      configManager.setEnvironment('production');
      
      // In production, the environment configs would normally be set differently
      // For this test, we just verify the environment change cleared the cache
      const config2 = configManager.getConfig('page');

      // Should have gotten a fresh config after environment change
      expect(config1).not.toBe(config2);
    });
  });

  describe('Validation', () => {
    it('should validate configuration and throw on invalid', () => {
      const invalidValidator = {
        validate: () => ({ valid: false, errors: ['Invalid config'] }),
      };

      const strictManager = new TemplateConfigManager({
        defaults: {},
        validator: invalidValidator,
      });

      expect(() => {
        strictManager.getConfig('page', { invalid: true });
      }).toThrow(InvalidConfigError);
    });

    it('should pass validation for valid configuration', () => {
      expect(() => {
        configManager.getConfig('page', {
          layout: {
            type: 'fluid',
            maxWidth: '1200px',
          },
        });
      }).not.toThrow();
    });
  });

  describe('Caching', () => {
    it('should cache merged configurations', () => {
      const config1 = configManager.getConfig('page');
      const config2 = configManager.getConfig('page');

      // Should be the same reference (cached)
      expect(config1).toBe(config2);
    });

    it('should invalidate cache on config change', () => {
      const config1 = configManager.getConfig('page');

      configManager.setConfig('global', 'page', { header: { show: false } });

      const config2 = configManager.getConfig('page');

      // Should be different references (cache invalidated)
      expect(config1).not.toBe(config2);
      expect(config2.header.show).toBe(false);
    });

    it('should clear specific template cache on setConfig', () => {
      configManager.getConfig('page1');
      configManager.getConfig('page2');

      const stats1 = configManager.getCacheStats();
      expect(stats1.size).toBe(2);

      configManager.setConfig('global', 'page1', {});

      const stats2 = configManager.getCacheStats();
      // Only page1 cache should be cleared
      expect(stats2.size).toBe(1);
    });

    it('should generate unique cache keys for different overrides', () => {
      const config1 = configManager.getConfig('page', { a: 1 });
      const config2 = configManager.getConfig('page', { b: 2 });
      const config3 = configManager.getConfig('page', { a: 1 });

      expect(config1).not.toBe(config2);
      expect(config1).toBe(config3); // Same overrides should use cache
    });

    it('should respect cache enabled setting', () => {
      const noCache = new TemplateConfigManager({
        defaults: DEFAULT_TEMPLATE_CONFIGS,
        enableCache: false,
      });

      const config1 = noCache.getConfig('page');
      const config2 = noCache.getConfig('page');

      // Should be different references (no cache)
      expect(config1).not.toBe(config2);
    });
  });

  describe('Template Type Detection', () => {
    it('should detect template type from ID patterns', () => {
      const pageConfig = configManager.getConfig('my-custom-page');
      expect(pageConfig.layout).toBeDefined(); // Should have page defaults

      const panelConfig = configManager.getConfig('side-panel');
      expect(panelConfig.appearance).toBeDefined(); // Should have panel defaults

      const modalConfig = configManager.getConfig('delete-modal');
      expect(modalConfig.overlay).toBeDefined(); // Should have modal defaults
    });

    it('should fallback to common config for unknown types', () => {
      const config = configManager.getConfig('unknown-template');
      expect(config.accessibility).toBeDefined(); // Should have common defaults
    });
  });

  describe('Configuration Levels', () => {
    it('should reject invalid configuration levels', () => {
      expect(() => {
        configManager.setConfig('invalid-level', 'page', {});
      }).toThrow('Invalid configuration level');
    });

    it('should clear configurations by level', () => {
      configManager.setConfig('global', 'page1', {});
      configManager.setConfig('global', 'page2', {});
      configManager.setConfig('page', 'page1', {});

      configManager.clearConfigs('global');

      // Global configs should be cleared
      const config = configManager.getConfig('page1');
      expect(config).toBeDefined(); // Should still have defaults
    });

    it('should clear all configurations', () => {
      configManager.setConfig('global', 'page1', {});
      configManager.setConfig('page', 'page2', {});

      configManager.clearConfigs();

      // All configs should be cleared, only defaults remain
      const config = configManager.getConfig('page');
      expect(config).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw ConfigMergeError on merge failure', () => {
      // Create a config manager with a validator that throws
      const throwingValidator = {
        validate: () => {
          throw new Error('Validation error');
        },
      };

      const manager = new TemplateConfigManager({
        defaults: {},
        validator: throwingValidator,
      });

      expect(() => {
        manager.getConfig('page');
      }).toThrow(ConfigMergeError);
    });

    it('should require template ID', () => {
      expect(() => {
        configManager.getConfig();
      }).toThrow('Template ID is required');
    });

    it('should require config when setting', () => {
      expect(() => {
        configManager.setConfig('global', 'page');
      }).toThrow('Configuration is required');
    });
  });

  describe('Cache Management', () => {
    it('should enable and disable caching', () => {
      configManager.setCacheEnabled(false);
      expect(configManager.getCacheStats().enabled).toBe(false);

      configManager.setCacheEnabled(true);
      expect(configManager.getCacheStats().enabled).toBe(true);
    });

    it('should clear cache when disabling', () => {
      configManager.getConfig('page');
      expect(configManager.getCacheStats().size).toBeGreaterThan(0);

      configManager.setCacheEnabled(false);
      expect(configManager.getCacheStats().size).toBe(0);
    });

    it('should provide cache statistics', () => {
      configManager.getConfig('page1');
      configManager.getConfig('page2', { custom: true });

      const stats = configManager.getCacheStats();
      expect(stats.enabled).toBe(true);
      expect(stats.size).toBe(2);
      expect(stats.keys).toHaveLength(2);
    });
  });
});