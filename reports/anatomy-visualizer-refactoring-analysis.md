# Anatomy Visualizer Refactoring Analysis

## Executive Summary

This report analyzes the code duplication between `src/anatomy-visualizer.js` and `src/main.js` in the Living Narrative Engine project. The anatomy visualizer was implemented by duplicating initialization patterns from the main game, resulting in significant code repetition that could be refactored for better maintainability.

## Key Findings

### 1. Duplicated Logger Configuration Loading

Both `containerConfig.js` and `minimalContainerConfig.js` contain identical `loadLoggerConfig` functions (lines 107-162 in containerConfig.js and lines 88-137 in minimalContainerConfig.js). This is a clear violation of DRY principles.

**Code duplication:**

- Exact same function implementation
- Same error handling logic
- Same log messages (with minor prefix differences)

### 2. Duplicated Mods Loading Logic

The anatomy visualizer duplicates the mods loading pattern from the main game:

- `anatomy-visualizer.js` has its own `loadMods` function (lines 89-115)
- `initializationService.js` has a similar `#loadMods` method (lines 357-363)
- Both fetch and parse `game.json` independently
- Both call `modsLoader.loadMods` with similar patterns

### 3. Parallel Initialization Patterns

Both files follow similar initialization sequences but implement them separately:

**anatomy-visualizer.js pattern:**

1. Create container
2. Configure container (minimal)
3. Resolve services
4. Load mods
5. Initialize services
6. Setup UI

**main.js pattern:**

1. Ensure DOM elements
2. Create container
3. Configure container (full)
4. Resolve logger
5. Initialize game engine (which loads mods internally)
6. Initialize auxiliary services
7. Setup listeners

### 4. Container Configuration Duplication

The container configuration files share substantial code:

- Both register the same core services in the same order
- Both use identical logger bootstrapping
- Both implement the same asynchronous logger config loading
- The only difference is that `configureContainer` registers additional services (AI, UI, Turn Lifecycle, Orchestration)

### 5. Service Resolution Duplication

Both files manually resolve similar sets of services:

- Logger
- ModsLoader
- Registry
- EntityManager
- EventDispatcher
- SystemInitializer

## Refactoring Recommendations

### 1. Extract Common Logger Configuration

Create a shared utility function for logger configuration loading:

```javascript
// src/configuration/utils/loggerConfigUtils.js
export async function loadAndApplyLoggerConfig(
  container,
  logger,
  configPrefix = 'ContainerConfig'
) {
  // Extract the duplicated loadLoggerConfig logic here
}
```

### 2. Create Shared Initialization Utilities

Extract common initialization patterns into reusable functions:

```javascript
// src/bootstrapper/utils/commonInitialization.js
export async function loadModsFromGameConfig(modsLoader, logger) {
  const gameConfigResponse = await fetch('./data/game.json');
  if (!gameConfigResponse.ok) {
    throw new Error('Failed to load game configuration');
  }
  const gameConfig = await gameConfigResponse.json();
  const requestedMods = gameConfig.mods || [];
  return await modsLoader.loadMods('default', requestedMods);
}

export async function initializeCoreServices(container, tokens) {
  const services = {
    logger: container.resolve(tokens.ILogger),
    modsLoader: container.resolve(tokens.ModsLoader),
    registry: container.resolve(tokens.IDataRegistry),
    entityManager: container.resolve(tokens.IEntityManager),
    systemInitializer: container.resolve(tokens.SystemInitializer),
    eventDispatcher: container.resolve(tokens.ISafeEventDispatcher),
  };
  return services;
}
```

### 3. Unified Container Configuration

Create a base container configuration with optional feature flags:

```javascript
// src/dependencyInjection/baseContainerConfig.js
export function configureBaseContainer(container, options = {}) {
  const { includeUI = false, includeGameSystems = false } = options;

  // Register core services (always needed)
  registerLoaders(container);
  registerInfrastructure(container);
  registerPersistence(container);
  registerWorldAndEntity(container);
  // ... other core registrations

  // Conditionally register game-specific services
  if (includeGameSystems) {
    registerAI(container);
    registerTurnLifecycle(container);
    registerOrchestration(container);
  }

  if (includeUI && options.uiElements) {
    registerUI(container, options.uiElements);
  }
}
```

### 4. Shared Bootstrap Process

Create a common bootstrap process that can be customized:

```javascript
// src/bootstrapper/commonBootstrap.js
export class CommonBootstrapper {
  async bootstrap(options = {}) {
    const {
      containerConfig,
      includeUI = false,
      includeGameSystems = false,
      worldName = null,
      postInitHook = null,
    } = options;

    // Common initialization steps
    const container = new AppContainer();
    configureBaseContainer(container, { includeUI, includeGameSystems });

    // Resolve core services
    const services = await initializeCoreServices(container);

    // Load mods
    await loadModsFromGameConfig(services.modsLoader, services.logger);

    // Initialize systems
    await services.systemInitializer.initializeAll();

    // Custom post-initialization
    if (postInitHook) {
      await postInitHook(services);
    }

    return { container, services };
  }
}
```

### 5. Refactored Entry Points

The entry points would then be simplified:

```javascript
// anatomy-visualizer.js
const bootstrapper = new CommonBootstrapper();
const { services } = await bootstrapper.bootstrap({
  includeUI: false,
  includeGameSystems: false,
  postInitHook: async (services) => {
    await services.anatomyFormattingService.initialize();
  },
});

// main.js
const bootstrapper = new CommonBootstrapper();
const { services } = await bootstrapper.bootstrap({
  includeUI: true,
  includeGameSystems: true,
  uiElements,
  worldName: ACTIVE_WORLD,
});
```

## Benefits of Refactoring

1. **Reduced Code Duplication**: Eliminates ~200 lines of duplicated code
2. **Easier Maintenance**: Changes to initialization logic only need to be made in one place
3. **Better Testability**: Common initialization logic can be unit tested separately
4. **Clearer Architecture**: Makes the relationship between different app entry points explicit
5. **Easier Feature Addition**: New visualization tools can reuse the common bootstrap process
6. **Consistent Behavior**: Ensures all entry points follow the same initialization patterns

## Implementation Priority

1. **High Priority**: Extract logger configuration loading (easiest win, high duplication)
2. **High Priority**: Create shared mods loading utility (clear duplication, simple extraction)
3. **Medium Priority**: Unify container configuration (requires careful testing)
4. **Medium Priority**: Create common bootstrap process (larger architectural change)
5. **Low Priority**: Full refactor of entry points (depends on previous steps)

## Risks and Considerations

1. **Testing Requirements**: Extensive testing needed to ensure refactoring doesn't break existing functionality
2. **Backward Compatibility**: Need to ensure any new tools/pages can still use the simplified initialization
3. **Documentation**: Update documentation to reflect new initialization patterns
4. **Migration Path**: Consider creating the new structure alongside the old, then migrating gradually

## Conclusion

The current implementation shows significant code duplication between the anatomy visualizer and main game initialization. While functional, this approach makes maintenance harder and increases the risk of bugs when initialization logic needs to change. The proposed refactoring would create a more maintainable, DRY codebase while preserving all current functionality.
