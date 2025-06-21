// src/bootstrapper/stages/index.js
export {
  ensureCriticalDOMElementsStage,
  setupMenuButtonListenersStage,
} from './uiStages.js';
export {
  setupDIContainerStage,
  resolveLoggerStage,
} from './containerStages.js';
export { initializeGameEngineStage, startGameStage } from './engineStages.js';
export { setupGlobalEventListenersStage } from './eventStages.js';
export { initializeAuxiliaryServicesStage } from './auxiliary';
