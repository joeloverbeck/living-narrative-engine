# BODDESROB-004: Add Bootstrap Validation for Body Descriptors

**Status**: TODO
**Priority**: HIGH
**Phase**: 3 (Integration)
**Estimated Effort**: 0.5 days
**Dependencies**: BODDESROB-001, BODDESROB-002

---

## WORKFLOW VALIDATION SUMMARY

**Validated**: 2025-11-05
**Validator**: Claude Code Agent

### Key Corrections Made:

1. **AnatomyFormattingService Structure**
   - CORRECTED: Does NOT extend `BaseService` - is standalone class
   - CORRECTED: Uses public fields (`this.logger`) not private `#logger`
   - CORRECTED: Uses underscore-prefixed private methods (`_validateConfigurationConsistency`) not `#privateMethod`
   - CORRECTED: Uses `validateDependencies` (plural) with array, not singular form
   - CONFIRMED: Constructor takes `{ dataRegistry, logger, safeEventDispatcher }`

2. **Bootstrap Stage Pattern**
   - CORRECTED: Stages are functional (exported functions), not class-based
   - CORRECTED: Use `stageSuccess` and `stageFailure` helpers from `bootstrapperHelpers.js`
   - CONFIRMED: Existing stage at `/home/user/living-narrative-engine/src/bootstrapper/stages/anatomyFormattingStage.js`
   - CONFIRMED: Called from `CommonBootstrapper.js` (not `bootstrapper.js`)

3. **File Paths**
   - CONFIRMED: `/home/user/living-narrative-engine/src/services/anatomyFormattingService.js`
   - CONFIRMED: `/home/user/living-narrative-engine/src/anatomy/registries/bodyDescriptorRegistry.js`
   - CONFIRMED: `/home/user/living-narrative-engine/src/anatomy/validators/bodyDescriptorValidator.js`
   - CONFIRMED: `/home/user/living-narrative-engine/data/mods/anatomy/anatomy-formatting/default.json`
   - CORRECTED: `/home/user/living-narrative-engine/src/bootstrapper/CommonBootstrapper.js` (not `bootstrapper.js`)

4. **Testing Patterns**
   - CORRECTED: Tests define mock helpers locally (not always from testBed)
   - CORRECTED: Integration tests use `AppContainer`, `Registrar`, real services
   - CORRECTED: Pattern matches `anatomyFormattingStage.realService.integration.test.js`
   - CONFIRMED: Test files use Jest with `@jest/globals` imports

5. **Validator Interface**
   - CONFIRMED: `BodyDescriptorValidator.validateFormattingConfig(config)` returns `{valid, errors, warnings}`
   - CONFIRMED: `BodyDescriptorValidator.validateSystemConsistency({dataRegistry})` returns `{errors, warnings, info}`

All code examples and file references have been updated to reflect actual codebase structure.

---

## Overview

Integrate body descriptor validation into the system bootstrap process to detect configuration issues at startup. This provides immediate feedback when descriptors are missing from formatting configuration or when there are inconsistencies in the system.

## Problem Context

Currently, descriptor configuration issues are only discovered:
- During integration tests (if tests cover the scenario)
- At runtime when descriptions are generated (silent failures)
- Through manual inspection

This leads to late detection and difficult debugging. Bootstrap validation will detect issues immediately when the application starts.

## Acceptance Criteria

- [ ] Validation integrated into bootstrap/initialization process
- [ ] Validator checks formatting config consistency on startup
- [ ] Warnings logged for missing descriptors in development mode
- [ ] Critical errors fail fast in development mode
- [ ] Production mode logs warnings but doesn't fail
- [ ] Clear, actionable error messages with file paths
- [ ] Performance impact minimal (< 50ms)
- [ ] Integration tests verify validation behavior
- [ ] Environment-specific behavior (dev vs production)

## Technical Details

### Integration Point

Determine appropriate bootstrap stage for validation:
- Option 1: During anatomy formatting service initialization
- Option 2: As dedicated bootstrap validation stage
- Option 3: During data registry initialization

**Recommended**: Integrate into anatomy formatting service initialization for direct connection to config loading.

### Implementation Approach

**IMPORTANT**: AnatomyFormattingService does NOT extend BaseService. It is a standalone class with its own structure.

```javascript
// src/services/anatomyFormattingService.js (enhanced)

import { BODY_DESCRIPTOR_REGISTRY } from '../anatomy/registries/bodyDescriptorRegistry.js';
import { BodyDescriptorValidator } from '../anatomy/validators/bodyDescriptorValidator.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';
import { validateDependencies } from '../utils/dependencyUtils.js';

/**
 * Service for managing anatomy formatting configuration from mods.
 * Handles loading, merging, and accessing formatting rules for anatomy descriptions.
 */
export class AnatomyFormattingService {
  /**
   * @param {object} params
   * @param {IDataRegistry} params.dataRegistry - Data registry service
   * @param {ILogger} params.logger - Logging service
   * @param {ISafeEventDispatcher} params.safeEventDispatcher - Event dispatcher for error reporting
   */
  constructor({ dataRegistry, logger, safeEventDispatcher }) {
    // Validate dependencies (uses validateDependencies with array)
    validateDependencies(
      [
        {
          dependency: dataRegistry,
          name: 'dataRegistry',
          methods: ['getAll', 'get'],
        },
        {
          dependency: logger,
          name: 'logger',
          methods: ['info', 'warn', 'error', 'debug'],
        },
        {
          dependency: safeEventDispatcher,
          name: 'safeEventDispatcher',
          methods: ['dispatch'],
        },
      ],
      logger
    );

    this.dataRegistry = dataRegistry;
    this.logger = logger;
    this.safeEventDispatcher = safeEventDispatcher;

    // Initialize validator for bootstrap validation
    this._validator = new BodyDescriptorValidator({ logger: this.logger });

    // Cache for merged configuration
    this._mergedConfig = null;
    this._configInitialized = false;
  }

  /**
   * Initialize the service by loading and merging all formatting configurations
   * NOTE: This method is called by the bootstrap stage (anatomyFormattingStage.js)
   */
  initialize() {
    if (this._configInitialized) {
      return;
    }

    this.logger.debug(
      'AnatomyFormattingService: Initializing formatting configuration'
    );

    // Get mod load order from meta registry (stored by ModManifestProcessor)
    const modLoadOrder = this.dataRegistry.get('meta', 'final_mod_order') || [];

    this.logger.debug(
      `AnatomyFormattingService: Using mod load order: [${modLoadOrder.join(', ')}]`
    );

    // Get all anatomy formatting configurations from registry
    const allConfigs = this.dataRegistry.getAll('anatomyFormatting') || [];

    this.logger.debug(
      `AnatomyFormattingService: Retrieved ${allConfigs.length} anatomy formatting configs from registry`
    );

    // Start with empty base configuration
    let mergedConfig = {
      descriptionOrder: [],
      groupedParts: [],
      pairedParts: [],
      irregularPlurals: {},
      noArticleParts: [],
      descriptorOrder: [],
      descriptorValueKeys: [],
      equipmentIntegration: null,
    };

    // Process configs in mod load order
    for (const modId of modLoadOrder) {
      const modConfigs = allConfigs.filter((config) => config._modId === modId);

      for (const config of modConfigs) {
        mergedConfig = this._mergeConfigurations(mergedConfig, config);
      }
    }

    this._mergedConfig = mergedConfig;

    // NEW: Validate configuration consistency during bootstrap
    this._validateConfigurationConsistency();

    this._configInitialized = true;

    this.logger.debug('AnatomyFormattingService: Configuration initialized', {
      descriptionOrderCount: mergedConfig.descriptionOrder.length,
      descriptorOrderCount: mergedConfig.descriptorOrder.length,
      descriptorValueKeysCount: mergedConfig.descriptorValueKeys.length,
    });
  }

  /**
   * Validate configuration consistency with registry
   * Called during initialization to detect issues at startup
   * @private
   */
  _validateConfigurationConsistency() {
    const result = this._validator.validateFormattingConfig(this._mergedConfig);

    // Log errors (critical issues)
    for (const error of result.errors) {
      this.logger.error(`[Body Descriptor Config] ${error}`);
    }

    // Log warnings (missing descriptors)
    for (const warning of result.warnings) {
      this.logger.warn(`[Body Descriptor Config] ${warning}`);
    }

    // In development mode, fail fast on errors
    if (process.env.NODE_ENV !== 'production' && result.errors.length > 0) {
      throw new Error(
        `Body descriptor configuration errors detected:\n${result.errors.join('\n')}`
      );
    }

    // In development mode, make warnings visible
    if (process.env.NODE_ENV !== 'production' && result.warnings.length > 0) {
      console.warn('\n⚠️  Body Descriptor Configuration Issues:\n');
      result.warnings.forEach(warning => {
        console.warn(`   ${warning}`);
      });
      console.warn('\n   Fix by adding missing descriptors to:');
      console.warn('   data/mods/anatomy/anatomy-formatting/default.json\n');
    }
  }

  // ... rest of existing methods (getDescriptionOrder, getPairedParts, etc.)
}
```

### Alternative: Dedicated Bootstrap Stage

**NOTE**: The project uses functional bootstrap stages, not class-based ones. Stages follow the pattern in `anatomyFormattingStage.js`.

```javascript
// src/bootstrapper/stages/bodyDescriptorValidationStage.js

import { stageSuccess, stageFailure } from '../../utils/bootstrapperHelpers.js';
import { BodyDescriptorValidator } from '../../anatomy/validators/bodyDescriptorValidator.js';

/**
 * Bootstrap Stage: Validates body descriptor system consistency.
 * Checks that all descriptors are properly configured across schema, code, and config.
 *
 * @async
 * @param {AppContainer} container - The configured AppContainer instance.
 * @param {ILogger} logger - The logger instance.
 * @param {TokensObject} tokens - The DI tokens object.
 * @returns {Promise<StageResult>} Result object indicating success or failure.
 */
export async function validateBodyDescriptorSystemStage(
  container,
  logger,
  tokens
) {
  const stageName = 'Body Descriptor System Validation';
  logger.info(`Bootstrap Stage: Starting ${stageName}...`);

  try {
    // Resolve data registry
    const dataRegistry = container.resolve(tokens.IDataRegistry);

    if (!dataRegistry) {
      throw new Error('DataRegistry resolved to an invalid object.');
    }

    // Create validator
    const validator = new BodyDescriptorValidator({ logger });

    // Validate system consistency
    logger.debug('Validating body descriptor system consistency...');
    const issues = await validator.validateSystemConsistency({ dataRegistry });

    // Log errors
    issues.errors.forEach(error => {
      logger.error(`[Body Descriptor Validation] ${error}`);
    });

    // Log warnings
    issues.warnings.forEach(warning => {
      logger.warn(`[Body Descriptor Validation] ${warning}`);
    });

    // Log info
    issues.info.forEach(info => {
      logger.info(`[Body Descriptor Validation] ${info}`);
    });

    // In development mode, fail fast on errors
    if (process.env.NODE_ENV !== 'production' && issues.errors.length > 0) {
      throw new Error(
        `Body descriptor system validation failed:\n${issues.errors.join('\n')}`
      );
    }

    // In development mode, make warnings visible
    if (process.env.NODE_ENV !== 'production' && issues.warnings.length > 0) {
      console.warn('\n⚠️  Body Descriptor System Issues:\n');
      issues.warnings.forEach(warning => {
        console.warn(`   ${warning}`);
      });
      console.warn('\n');
    }

    logger.info(`Bootstrap Stage: ${stageName} completed successfully.`);
    return stageSuccess({ validationIssues: issues });
  } catch (error) {
    const errorMsg = `Failed to validate body descriptor system: ${error.message}`;
    logger.error(`Bootstrap Stage: ${stageName} failed. ${errorMsg}`, error);
    return stageFailure(stageName, errorMsg, error);
  }
}
```

### Implementation Steps

1. **Choose Integration Point**
   - Analyze bootstrap flow
   - Determine best location for validation
   - Consider dependency injection requirements

2. **Implement Validation Call**
   - Import validator
   - Call validation during initialization
   - Handle validation results

3. **Add Error/Warning Logging**
   - Log errors with full context
   - Log warnings with actionable guidance
   - Include file paths in messages

4. **Implement Environment Logic**
   - Development: fail fast on errors, show warnings
   - Production: log warnings, continue operation
   - Use NODE_ENV for detection

5. **Test Integration**
   - Test with valid configuration
   - Test with missing descriptors
   - Test with invalid configuration
   - Test environment-specific behavior

## Files to Modify

**Option 1 (Recommended)**: Integrate into existing service

- `/home/user/living-narrative-engine/src/services/anatomyFormattingService.js` (MODIFY)
  - Add `_validator` field initialization in constructor
  - Add `_validateConfigurationConsistency()` private method
  - Call validation from `initialize()` method after config merge
  - Add environment-specific behavior (dev vs production)

**Option 2 (Alternative)**: Create dedicated bootstrap stage

- `/home/user/living-narrative-engine/src/bootstrapper/stages/bodyDescriptorValidationStage.js` (NEW)
  - Create functional validation stage following `anatomyFormattingStage.js` pattern
  - Use `stageSuccess` and `stageFailure` helpers
- `/home/user/living-narrative-engine/src/bootstrapper/CommonBootstrapper.js` (MODIFY)
  - Add validation stage to bootstrap process
  - Import and call `validateBodyDescriptorSystemStage`

## Testing Requirements

### Unit Tests

**File**: `/home/user/living-narrative-engine/tests/unit/services/anatomyFormattingService.validation.test.js`

Test cases:
1. Validation called during initialization
2. Errors logged appropriately
3. Warnings logged appropriately
4. Development mode fails on errors
5. Production mode doesn't fail on warnings
6. Clear error messages with guidance

**NOTE**: Follow the existing test pattern in `anatomyFormattingService.test.js` which uses locally-defined mock helpers.

### Integration Tests

**File**: `/home/user/living-narrative-engine/tests/integration/bootstrapper/bodyDescriptorValidation.test.js`

Test cases:
1. Bootstrap succeeds with valid configuration
2. Bootstrap fails in dev mode with invalid config
3. Bootstrap succeeds in production with invalid config (warns only)
4. Validation output includes actionable guidance
5. Multiple validation issues reported together
6. System continues to work after warnings

**NOTE**: Follow the pattern in `anatomyFormattingStage.realService.integration.test.js` which uses:
- `AppContainer` and `Registrar` for DI setup
- Real service instances (not mocks)
- `InMemoryDataRegistry` for test data
- Capturing logger to verify log output

### Test Template

```javascript
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { AnatomyFormattingService } from '../../../src/services/anatomyFormattingService.js';

// Helper to create mock logger (defined locally per test file convention)
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

// Helper to create mock data registry
const createMockRegistry = (configs, mods = ['core']) => ({
  getAll: jest.fn((type) => {
    if (type === 'anatomyFormatting') return configs;
    return [];
  }),
  get: jest.fn((type, id) => {
    if (type === 'meta' && id === 'final_mod_order') {
      return mods;
    }
    return null;
  }),
});

// Helper to create mock safe event dispatcher
const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(true),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
});

describe('AnatomyFormattingService - Bootstrap Validation', () => {
  let originalNodeEnv;

  beforeEach(() => {
    // Save original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV;
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Development Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should fail fast when descriptors missing from config', () => {
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['head'], // Missing body descriptors
            descriptorOrder: ['size'],
            descriptorValueKeys: ['value'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      // Should throw during initialization due to missing descriptors
      expect(() => {
        service.initialize();
      }).toThrow('Body descriptor configuration');

      // Should log warnings before throwing
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should log warnings for missing descriptors', () => {
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['head'], // Missing body descriptors
            descriptorOrder: ['size'],
            descriptorValueKeys: ['value'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      try {
        service.initialize();
      } catch (e) {
        // Expected to throw
      }

      expect(logger.warn).toHaveBeenCalled();
      const warningCalls = logger.warn.mock.calls.map(call => call[0]);
      expect(warningCalls.some(msg => msg.includes('missing from descriptionOrder'))).toBe(true);
    });
  });

  describe('Production Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should not fail when descriptors missing from config', () => {
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['head'], // Missing body descriptors
            descriptorOrder: ['size'],
            descriptorValueKeys: ['value'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      // Should NOT throw in production mode
      expect(() => {
        service.initialize();
      }).not.toThrow();
    });

    it('should log warnings but continue', () => {
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['head'],
            descriptorOrder: ['size'],
            descriptorValueKeys: ['value'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      service.initialize();

      expect(logger.warn).toHaveBeenCalled();
      expect(service._configInitialized).toBe(true);
    });
  });
});
```

## Success Criteria

- [ ] Validation runs on every application startup
- [ ] Missing descriptors detected immediately
- [ ] Clear warnings in development console
- [ ] Development mode fails fast on critical errors
- [ ] Production mode logs but doesn't fail
- [ ] Performance impact < 50ms
- [ ] All tests pass
- [ ] ESLint passes with no errors
- [ ] Error messages include file paths and fixes

## Related Tickets

- Depends on: BODDESROB-001 (Centralized Registry)
- Depends on: BODDESROB-002 (Enhanced Validator)
- Related to: BODDESROB-007 (CLI Validation Tool)
- Related to: Spec Section 3.5 "Integration with Formatting Service"

## Environment Configuration

### Development Mode
- Fail fast on critical errors
- Display warnings prominently in console
- Include file paths and suggested fixes
- Help developers catch issues early

### Production Mode
- Log warnings to system logger
- Don't interrupt application startup
- Allow graceful degradation
- Monitor for issues

## Notes

- Keep validation lightweight (< 50ms)
- Consider caching validation results if needed
- Make error messages actionable and clear
- Include file paths in all messages
- Test both environment modes thoroughly
- Consider adding validation disable flag for emergencies
- Document validation behavior in README
