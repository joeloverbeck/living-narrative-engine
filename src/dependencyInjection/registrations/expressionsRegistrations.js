// src/dependencyInjection/registrations/expressionsRegistrations.js

/**
 * @file Expression system dependency injection registrations.
 */

import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import ExpressionRegistry from '../../expressions/expressionRegistry.js';
import ExpressionContextBuilder from '../../expressions/expressionContextBuilder.js';
import ExpressionEvaluatorService from '../../expressions/expressionEvaluatorService.js';
import ExpressionDispatcher from '../../expressions/expressionDispatcher.js';
import ExpressionPersistenceListener from '../../expressions/expressionPersistenceListener.js';
import ExpressionEvaluationLogger from '../../expressions/expressionEvaluationLogger.js';
import { getEndpointConfig } from '../../config/endpointConfig.js';

/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Register all expression system services.
 *
 * @param {AppContainer} container - Application dependency container.
 */
export function registerExpressionServices(container) {
  const registrar = new Registrar(container);
  const logger = /** @type {ILogger} */ (container.resolve(tokens.ILogger));
  logger.debug('Expression Registration: starting...');

  registrar.singletonFactory(tokens.IExpressionRegistry, (c) => {
    return new ExpressionRegistry({
      dataRegistry: c.resolve(tokens.IDataRegistry),
      logger: c.resolve(tokens.ILogger),
    });
  });

  registrar.singletonFactory(tokens.IExpressionContextBuilder, (c) => {
    return new ExpressionContextBuilder({
      emotionCalculatorService: c.resolve(tokens.IEmotionCalculatorService),
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    });
  });

  registrar.singletonFactory(tokens.IExpressionEvaluatorService, (c) => {
    return new ExpressionEvaluatorService({
      expressionRegistry: c.resolve(tokens.IExpressionRegistry),
      jsonLogicEvaluationService: c.resolve(tokens.JsonLogicEvaluationService),
      gameDataRepository: c.resolve(tokens.IGameDataRepository),
      logger: c.resolve(tokens.ILogger),
    });
  });

  registrar.singletonFactory(tokens.IExpressionDispatcher, (c) => {
    return new ExpressionDispatcher({
      eventBus: c.resolve(tokens.IEventBus),
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    });
  });

  registrar.singletonFactory(tokens.IExpressionEvaluationLogger, (c) => {
    return new ExpressionEvaluationLogger({
      endpointConfig: getEndpointConfig(),
      logger: c.resolve(tokens.ILogger),
    });
  });

  registrar.singletonFactory(tokens.IExpressionPersistenceListener, (c) => {
    return new ExpressionPersistenceListener({
      expressionContextBuilder: c.resolve(tokens.IExpressionContextBuilder),
      expressionEvaluatorService: c.resolve(tokens.IExpressionEvaluatorService),
      expressionDispatcher: c.resolve(tokens.IExpressionDispatcher),
      expressionEvaluationLogger: c.resolve(
        tokens.IExpressionEvaluationLogger
      ),
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    });
  });

  logger.debug('Expression Registration: complete.');
}

export default registerExpressionServices;
