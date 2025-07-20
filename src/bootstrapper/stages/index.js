// src/bootstrapper/stages/index.js
export {
  ensureCriticalDOMElementsStage,
  setupMenuButtonListenersStage,
} from './uiStages.js';
export {
  setupDIContainerStage,
  resolveLoggerStage,
} from './containerStages.js';
export { initializeGlobalConfigStage } from './configurationStages.js';
export { initializeGameEngineStage, startGameStage } from './engineStages.js';
export { setupGlobalEventListenersStage } from './eventStages.js';
export { initializeAuxiliaryServicesStage } from './initializeAuxiliaryServicesStage.js';
