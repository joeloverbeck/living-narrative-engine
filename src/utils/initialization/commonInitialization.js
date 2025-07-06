// src/utils/initialization/commonInitialization.js

/**
 * @description Resolves and returns the core services needed by most applications
 * @param {AppContainer} container - The configured DI container
 * @param {object} tokens - The DI tokens object
 * @returns {Promise<object>} Object containing resolved core services
 */
export async function initializeCoreServices(container, tokens) {
  const services = {
    logger: container.resolve(tokens.ILogger),
    modsLoader: container.resolve(tokens.ModsLoader),
    registry: container.resolve(tokens.IDataRegistry),
    entityManager: container.resolve(tokens.IEntityManager),
    systemInitializer: container.resolve(tokens.SystemInitializer),
    eventDispatcher: container.resolve(tokens.ISafeEventDispatcher),
  };
  
  services.logger.debug('Core services resolved successfully');
  return services;
}

/**
 * @description Initializes anatomy-specific services
 * @param {AppContainer} container - The configured DI container
 * @param {ILogger} logger - The logger instance
 * @param {object} tokens - The DI tokens object
 * @returns {Promise<object>} Object containing anatomy services
 */
export async function initializeAnatomyServices(container, logger, tokens) {
  logger.info('Initializing anatomy-specific services...');
  
  const anatomyFormattingService = container.resolve(tokens.AnatomyFormattingService);
  const anatomyDescriptionService = container.resolve(tokens.AnatomyDescriptionService);
  
  // Initialize the formatting service after mods are loaded
  await anatomyFormattingService.initialize();
  logger.info('AnatomyFormattingService initialized successfully');
  
  return {
    anatomyFormattingService,
    anatomyDescriptionService,
  };
}

/**
 * @description Initializes auxiliary services following the existing pattern
 * @param {AppContainer} container - The configured DI container
 * @param {ILogger} logger - The logger instance
 * @param {object} tokens - The DI tokens object
 * @returns {Promise<void>}
 */
export async function initializeAuxiliaryServices(container, logger, tokens) {
  logger.info('Initializing auxiliary services...');
  
  const systemInitializer = container.resolve(tokens.SystemInitializer);
  await systemInitializer.initializeAll();
  
  logger.info('Auxiliary services initialized successfully');
}