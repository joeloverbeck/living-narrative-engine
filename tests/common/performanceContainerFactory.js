/**
 * @file Lightweight container factory for performance tests
 * @description Provides optimized container creation and reuse for performance testing
 */

import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../src/dependencyInjection/baseContainerConfig.js';
import ConsoleLogger, { LogLevel } from '../../src/logging/consoleLogger.js';
import NoOpLogger from '../../src/logging/noOpLogger.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';

/**
 * Singleton container instance for reuse across performance tests
 */
let sharedContainer = null;
let containerRefCount = 0;

/**
 * Creates a minimal logger for performance testing
 * Uses NoOpLogger to eliminate logging overhead
 */
function createPerformanceLogger() {
  // Use NoOpLogger for performance tests to eliminate logging overhead
  return new NoOpLogger();
}

/**
 * Creates minimal DOM elements required for container configuration
 * Reuses existing elements if available
 */
function createMinimalDOMElements() {
  // Check if elements already exist
  let outputDiv = document.getElementById('outputDiv');
  let inputElement = document.getElementById('inputBox');
  let titleElement = document.getElementById('gameTitle');
  
  if (!outputDiv) {
    outputDiv = document.createElement('div');
    outputDiv.id = 'outputDiv';
    const messageList = document.createElement('ul');
    messageList.id = 'message-list';
    outputDiv.appendChild(messageList);
    document.body.appendChild(outputDiv);
  }
  
  if (!inputElement) {
    inputElement = document.createElement('input');
    inputElement.id = 'inputBox';
    document.body.appendChild(inputElement);
  }
  
  if (!titleElement) {
    titleElement = document.createElement('h1');
    titleElement.id = 'gameTitle';
    document.body.appendChild(titleElement);
  }
  
  return { outputDiv, inputElement, titleElement };
}

/**
 * Creates or retrieves a shared lightweight container for performance testing
 * 
 * @param {Object} options Configuration options
 * @param {boolean} options.forceNew Force creation of a new container
 * @param {boolean} options.includeUI Include UI systems (default: false)
 * @returns {Promise<Object>} Container and cleanup function
 */
export async function createPerformanceContainer(options = {}) {
  const { forceNew = false, includeUI = false } = options;
  
  // Reuse existing container if available and not forcing new
  if (sharedContainer && !forceNew) {
    containerRefCount++;
    return {
      container: sharedContainer,
      cleanup: () => {
        containerRefCount--;
        if (containerRefCount === 0) {
          // Only cleanup when last reference is released
          cleanupSharedContainer();
        }
      }
    };
  }
  
  // Create new container
  const container = new AppContainer();
  const logger = createPerformanceLogger();
  
  // Register logger first
  container.register(tokens.ILogger, () => logger);
  
  // Create minimal DOM elements
  const { outputDiv, inputElement, titleElement } = createMinimalDOMElements();
  
  // Configure container with minimal services
  await configureBaseContainer(container, {
    includeGameSystems: true,
    includeUI: includeUI,
    includeCharacterBuilder: false, // Skip character builder for performance tests
    uiElements: {
      outputDiv,
      inputElement,
      titleElement,
      document: document,
    },
    logger: logger,
  });
  
  // Store as shared container
  if (!forceNew) {
    sharedContainer = container;
    containerRefCount = 1;
  }
  
  return {
    container,
    cleanup: forceNew 
      ? () => cleanupContainer(container)
      : () => {
          containerRefCount--;
          if (containerRefCount === 0) {
            cleanupSharedContainer();
          }
        }
  };
}

/**
 * Cleans up a specific container instance
 */
function cleanupContainer(container) {
  if (container && typeof container.cleanup === 'function') {
    container.cleanup();
  }
}

/**
 * Cleans up the shared container instance
 */
function cleanupSharedContainer() {
  if (sharedContainer) {
    cleanupContainer(sharedContainer);
    sharedContainer = null;
    containerRefCount = 0;
  }
}

/**
 * Resets container state without full recreation
 * Clears entities and registries while preserving service instances
 */
export async function resetContainerState(container) {
  try {
    // Get entity manager and clear all entities
    const entityManager = container.resolve(tokens.IEntityManager);
    if (entityManager && entityManager.clearAll) {
      entityManager.clearAll(); // Note: clearAll() is synchronous
    }
    
    // Reset data registry - InMemoryDataRegistry stores data in Maps
    // We need to clear specific data stores
    const dataRegistry = container.resolve(tokens.IDataRegistry);
    if (dataRegistry) {
      // Clear entity definitions if they exist
      if (dataRegistry.has && dataRegistry.has('entityDefinitions')) {
        const entityDefs = dataRegistry.get('entityDefinitions');
        if (entityDefs && typeof entityDefs === 'object') {
          // Clear the object/map
          for (const key in entityDefs) {
            delete entityDefs[key];
          }
        }
      }
    }
    
    // Reset scope registry - it has an initialize method that clears
    const scopeRegistry = container.resolve(tokens.IScopeRegistry);
    if (scopeRegistry && scopeRegistry.initialize) {
      scopeRegistry.initialize({}); // Re-initialize with empty scopes
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    // Ignore errors during reset - container might not have all services
  }
}

/**
 * Pre-warms a container by initializing key services
 * This reduces first-run overhead in performance tests
 */
export async function prewarmContainer(container) {
  // Resolve key services to ensure they're initialized
  const services = [
    tokens.IEntityManager,
    tokens.IScopeRegistry,
    tokens.IScopeEngine,
    tokens.DslParser,
    tokens.JsonLogicEvaluationService,
    tokens.ISpatialIndexManager,
    tokens.IDataRegistry,
  ];
  
  for (const token of services) {
    try {
      container.resolve(token);
    } catch (error) {
      // Ignore resolution errors for optional services
    }
  }
}

/**
 * Creates a batch of containers for parallel testing
 */
export async function createContainerPool(size = 3) {
  const pool = [];
  
  for (let i = 0; i < size; i++) {
    const { container, cleanup } = await createPerformanceContainer({ 
      forceNew: true 
    });
    await prewarmContainer(container);
    pool.push({ container, cleanup });
  }
  
  return {
    pool,
    cleanup: () => {
      pool.forEach(({ cleanup }) => cleanup());
    },
    getNext: (index) => pool[index % pool.length],
  };
}

/**
 * Force cleanup of all resources
 */
export function forceCleanup() {
  cleanupSharedContainer();
  
  // Clear DOM elements
  const outputDiv = document.getElementById('outputDiv');
  const inputElement = document.getElementById('inputBox');
  const titleElement = document.getElementById('gameTitle');
  
  if (outputDiv) outputDiv.remove();
  if (inputElement) inputElement.remove();
  if (titleElement) titleElement.remove();
  
  // Force garbage collection
  if (global.gc) {
    global.gc();
  }
}