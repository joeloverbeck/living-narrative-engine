name: "Anatomy Visualizer Initialization Refactoring PRP"
description: |

## Goal

Implement the refactoring recommendations from `reports/anatomy-visualizer-refactoring-analysis.md` to eliminate code duplication between `src/anatomy-visualizer.js` and `src/main.js` initialization processes. Create a shared, maintainable initialization architecture that supports both the game and anatomy visualizer entry points while maintaining all existing functionality.

## Why

- **Eliminate ~200 lines of duplicated code** between anatomy-visualizer.js and main.js
- **Reduce maintenance burden** - changes to initialization logic only need to be made in one place
- **Improve testability** - common initialization logic can be unit tested separately
- **Enable easier feature addition** - new visualization tools can reuse the common bootstrap process
- **Ensure consistent behavior** across all entry points

## What

Create a unified initialization system that:
- Extracts duplicated logger configuration loading into a shared utility
- Creates a shared mod loading function that both entry points can use
- Implements a base container configuration with options for full vs minimal setup
- Develops a common bootstrap process that can be customized for different entry points
- Refactors both entry points to use the new shared infrastructure

### Success Criteria

- [ ] All existing tests pass without modification
- [ ] Both anatomy-visualizer.html and game.html work exactly as before
- [ ] Logger configuration loading code is no longer duplicated
- [ ] Mod loading logic exists in only one place
- [ ] Container configuration follows DRY principles
- [ ] No runtime errors in either entry point
- [ ] Code coverage maintained or improved

## All Needed Context

### Documentation & References

```yaml
# MUST READ - Include these in your context window
- file: reports/anatomy-visualizer-refactoring-analysis.md
  why: Complete analysis of duplication and refactoring recommendations

- file: src/anatomy-visualizer.js
  why: Current implementation to refactor, understand initialization sequence

- file: src/main.js
  why: Game initialization pattern to preserve and align with

- file: src/dependencyInjection/containerConfig.js
  why: Full container configuration to understand all registrations

- file: src/dependencyInjection/minimalContainerConfig.js
  why: Minimal configuration showing what anatomy visualizer needs

- file: src/bootstrapper/stages/index.js
  why: Stage pattern to follow for new initialization stages

- file: src/utils/bootstrapperHelpers.js
  why: Contains stageSuccess/stageFailure utilities we'll use

- file: src/initializers/services/initializationService.js
  why: Shows existing mod loading implementation (lines 357-363)

- file: tests/integration/domUI/AnatomyVisualizerUI.integration.test.js
  why: Integration test that must continue passing

- url: https://github.com/inversify/InversifyJS
  why: Dependency injection container documentation for proper usage
```

### Current Codebase tree

```bash
src/
├── bootstrapper/
│   ├── stages/
│   │   ├── auxiliary/
│   │   ├── containerStages.js
│   │   ├── engineStages.js
│   │   ├── eventStages.js
│   │   ├── index.js
│   │   ├── initializeAuxiliaryServicesStage.js
│   │   └── uiStages.js
│   ├── StageError.js
│   └── UIBootstrapper.js
├── configuration/
│   ├── httpConfigurationProvider.js
│   ├── loggerConfigLoader.js
│   └── staticConfiguration.js
├── dependencyInjection/
│   ├── registrations/
│   │   ├── aiRegistrations.js
│   │   ├── commandAndActionRegistrations.js
│   │   ├── infrastructureRegistrations.js
│   │   ├── loadersRegistrations.js
│   │   └── ... (other registration modules)
│   ├── tokens/
│   ├── containerConfig.js
│   └── minimalContainerConfig.js
├── utils/
│   ├── bootstrapperHelpers.js
│   ├── initHelpers.js
│   └── serviceInitializerUtils.js
├── anatomy-visualizer.js
└── main.js
```

### Desired Codebase tree with files to be added

```bash
src/
├── bootstrapper/
│   ├── stages/
│   │   └── anatomyFormattingStage.js (NEW - anatomy formatting initialization stage)
│   └── CommonBootstrapper.js (NEW - shared bootstrap orchestration)
├── configuration/
│   └── utils/
│       └── loggerConfigUtils.js (NEW - shared logger config loading)
├── dependencyInjection/
│   ├── baseContainerConfig.js (NEW - base configuration with options)
│   ├── containerConfig.js (MODIFIED - uses base config)
│   └── minimalContainerConfig.js (MODIFIED - uses base config)
├── utils/
│   └── initialization/
│       ├── commonInitialization.js (NEW - shared init utilities)
│       └── modLoadingUtils.js (NEW - shared mod loading)
├── anatomy-visualizer.js (MODIFIED - uses CommonBootstrapper)
└── main.js (MODIFIED - uses CommonBootstrapper)
```

### Known Gotchas & Library Quirks

```javascript
// CRITICAL: InversifyJS container requires all dependencies to be registered before resolution
// The order of registration modules matters - infrastructure must come before services that depend on it

// CRITICAL: Logger must be configured before any logging occurs
// The logger configuration is loaded asynchronously and must complete before service initialization

// CRITICAL: Mods must be loaded before services that depend on mod data (like AnatomyFormattingService)
// The mod loading process affects the data registry and must happen in the correct sequence

// CRITICAL: The game uses different world names ('default' for anatomy visualizer, ACTIVE_WORLD for game)
// This affects mod loading and must be preserved

// CRITICAL: Error handling must use displayFatalStartupError for consistency
// Both entry points expect this pattern for startup failures
```

## Implementation Blueprint

### list of tasks to be completed to fulfill the PRP in the order they should be completed

```yaml
Task 1 - Extract Logger Configuration Utility:
CREATE src/configuration/utils/loggerConfigUtils.js:
  - EXTRACT loadLoggerConfig function from containerConfig.js (lines 113-162)
  - PARAMETERIZE the log prefix to support both contexts
  - EXPORT as loadAndApplyLoggerConfig function
  - ADD JSDoc documentation

Task 2 - Update Container Configs to Use Shared Logger:
MODIFY src/dependencyInjection/containerConfig.js:
  - IMPORT loadAndApplyLoggerConfig from new utility
  - REPLACE loadLoggerConfig function with import
  - UPDATE call site to use imported function

MODIFY src/dependencyInjection/minimalContainerConfig.js:
  - IMPORT loadAndApplyLoggerConfig from new utility
  - REPLACE loadLoggerConfig function with import
  - UPDATE call site to use imported function

Task 3 - Create Mod Loading Utility:
CREATE src/utils/initialization/modLoadingUtils.js:
  - EXTRACT mod loading logic from anatomy-visualizer.js (lines 89-115)
  - CREATE loadModsFromGameConfig function
  - HANDLE fetch errors appropriately
  - RETURN load report for logging

Task 4 - Create Common Initialization Utilities:
CREATE src/utils/initialization/commonInitialization.js:
  - CREATE initializeCoreServices function to resolve common services
  - CREATE initializeAnatomyServices function for anatomy-specific init
  - FOLLOW existing service initialization patterns from auxiliaryServices

Task 5 - Create Base Container Configuration:
CREATE src/dependencyInjection/baseContainerConfig.js:
  - EXTRACT common registrations from both configs
  - ADD options parameter for conditional registrations
  - SUPPORT includeUI and includeGameSystems flags
  - MAINTAIN registration order requirements

Task 6 - Refactor Existing Container Configs:
MODIFY src/dependencyInjection/containerConfig.js:
  - IMPORT and use baseContainerConfig
  - PASS appropriate options for full configuration
  - REMOVE duplicated registration calls

MODIFY src/dependencyInjection/minimalContainerConfig.js:
  - IMPORT and use baseContainerConfig
  - PASS appropriate options for minimal configuration
  - REMOVE duplicated registration calls

Task 7 - Create Anatomy Formatting Stage:
CREATE src/bootstrapper/stages/anatomyFormattingStage.js:
  - FOLLOW stage pattern from existing stages
  - RESOLVE IAnatomyFormattingService
  - CALL initialize method
  - USE stageSuccess/stageFailure helpers

Task 8 - Create Common Bootstrapper:
CREATE src/bootstrapper/CommonBootstrapper.js:
  - CREATE class with bootstrap method
  - ACCEPT options for customization
  - ORCHESTRATE initialization sequence
  - INTEGRATE with existing stage patterns
  - SUPPORT both game and anatomy visualizer needs

Task 9 - Update Anatomy Visualizer Entry Point:
MODIFY src/anatomy-visualizer.js:
  - IMPORT CommonBootstrapper
  - REMOVE duplicated initialization code
  - USE CommonBootstrapper with minimal options
  - PRESERVE all existing functionality
  - MAINTAIN error handling patterns

Task 10 - Update Main Game Entry Point:
MODIFY src/main.js:
  - IMPORT CommonBootstrapper
  - INTEGRATE with existing bootstrap stages
  - PRESERVE all game-specific initialization
  - MAINTAIN backward compatibility
  - TEST thoroughly as this is critical path

Task 11 - Create Unit Tests:
CREATE tests/unit/configuration/utils/loggerConfigUtils.test.js:
  - TEST logger config loading with various scenarios
  - TEST error handling

CREATE tests/unit/utils/initialization/modLoadingUtils.test.js:
  - TEST successful mod loading
  - TEST error cases
  - TEST empty mod list handling

CREATE tests/unit/bootstrapper/CommonBootstrapper.test.js:
  - TEST initialization sequences
  - TEST option handling
  - TEST error propagation
```

### Per task pseudocode

```javascript
// Task 1 - loggerConfigUtils.js
export async function loadAndApplyLoggerConfig(container, logger, configPrefix = 'ContainerConfig') {
  try {
    logger.debug(`[${configPrefix}] Attempting to load logger configuration...`);
    
    // Check if running in browser
    if (typeof window !== 'undefined') {
      const configLoader = new LoggerConfigLoader(/* ... */);
      const config = await configLoader.loadConfig();
      
      if (config?.logLevel) {
        logger.setLevel(config.logLevel);
        logger.debug(`[${configPrefix}] Logger level set to: ${config.logLevel}`);
      }
    }
  } catch (error) {
    logger.warn(`[${configPrefix}] Failed to load logger config`, error);
  }
}

// Task 3 - modLoadingUtils.js
export async function loadModsFromGameConfig(modsLoader, logger, worldName = 'default') {
  const gameConfigResponse = await fetch('./data/game.json');
  if (!gameConfigResponse.ok) {
    throw new Error(`Failed to load game configuration: ${gameConfigResponse.status}`);
  }
  
  const gameConfig = await gameConfigResponse.json();
  const requestedMods = gameConfig.mods || [];
  
  logger.info(`Loading ${requestedMods.length} mods for world: ${worldName}`);
  return await modsLoader.loadMods(worldName, requestedMods);
}

// Task 5 - baseContainerConfig.js
export function configureBaseContainer(container, options = {}) {
  const { includeUI = false, includeGameSystems = false, uiElements = null } = options;
  
  // Always register core services
  registerLoaders(container);
  registerInfrastructure(container);
  registerPersistence(container);
  registerWorldAndEntity(container);
  registerCommandAndAction(container);
  registerInterpreters(container);
  registerEventBusAdapters(container);
  registerInitializers(container);
  registerRuntime(container);
  
  // Conditionally register game-specific services
  if (includeGameSystems) {
    registerAI(container);
    registerTurnLifecycle(container);
    registerOrchestration(container);
  }
  
  if (includeUI && uiElements) {
    registerUI(container, uiElements);
  }
}

// Task 8 - CommonBootstrapper.js
export class CommonBootstrapper {
  async bootstrap(options = {}) {
    const {
      containerConfigType = 'minimal', // 'minimal' | 'full'
      worldName = 'default',
      uiElements = null,
      postInitHook = null,
      includeAnatomyFormatting = false
    } = options;
    
    // Create and configure container
    const container = new AppContainer();
    
    if (containerConfigType === 'full') {
      configureContainer(container, uiElements);
    } else {
      configureMinimalContainer(container);
    }
    
    // Resolve core services
    const services = await initializeCoreServices(container, tokens);
    
    // Load mods
    const loadReport = await loadModsFromGameConfig(
      services.modsLoader, 
      services.logger, 
      worldName
    );
    
    // Initialize systems
    await services.systemInitializer.initializeAll();
    
    // Initialize anatomy formatting if needed
    if (includeAnatomyFormatting) {
      await initializeAnatomyServices(container, services.logger, tokens);
    }
    
    // Custom post-initialization
    if (postInitHook) {
      await postInitHook(services, container);
    }
    
    return { container, services, loadReport };
  }
}
```

## Validation Loop

### Level 1: Syntax & Style

```bash
# Run these FIRST - fix any errors in modified files before proceeding
npm run lint

# Expected: No errors in any modified files
# Common issues: Missing semicolons, unused imports, formatting
```

### Level 2: Unit Tests

```bash
# Run all tests to ensure nothing breaks
npm run test

# Specifically verify the anatomy visualizer integration test passes:
npm run test -- tests/integration/domUI/AnatomyVisualizerUI.integration.test.js

# If any test fails: 
# 1. Read the error carefully
# 2. Check if initialization sequence changed
# 3. Verify service resolution order
# 4. Never mock to make tests pass - fix the actual issue
```

### Level 3: Manual Testing

```bash
# Test anatomy visualizer
# 1. Open anatomy-visualizer.html in browser
# 2. Verify it loads without errors
# 3. Check console for proper initialization logs
# 4. Test anatomy visualization functionality

# Test main game
# 1. Open game.html in browser
# 2. Verify game starts normally
# 3. Check all game features work as before
# 4. Verify no regression in functionality
```

## Final Validation Checklist

- [ ] All tests pass: `npm run test`
- [ ] No linting errors: `npm run lint`
- [ ] anatomy-visualizer.html loads and functions correctly
- [ ] game.html loads and functions correctly
- [ ] No console errors in either entry point
- [ ] Logger configuration loads properly in both contexts
- [ ] Mods load correctly for both entry points
- [ ] Code duplication eliminated (~200 lines removed)
- [ ] All services initialize in correct order

## Anti-Patterns to Avoid

- ❌ Don't change the initialization order without understanding dependencies
- ❌ Don't skip the integration test - it's critical for anatomy visualizer
- ❌ Don't modify service interfaces - only refactor initialization
- ❌ Don't introduce circular dependencies between new modules
- ❌ Don't hardcode values that should remain configurable
- ❌ Don't remove error handling - preserve all existing error patterns
- ❌ Don't change the world name handling ('default' vs ACTIVE_WORLD)
- ❌ Don't break the stage pattern - follow existing conventions

---

## Implementation Confidence Score: 8/10

High confidence due to:
- Clear duplication patterns identified
- Existing stage patterns to follow
- Comprehensive test coverage available
- Well-defined refactoring steps

Moderate risk areas:
- Main.js is critical path and requires careful testing
- Container registration order must be preserved
- Integration between new CommonBootstrapper and existing stages