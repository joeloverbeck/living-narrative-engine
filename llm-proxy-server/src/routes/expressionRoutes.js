/**
 * @file Routes for expression diagnostic status endpoints
 * @see ../handlers/expressionStatusController.js
 */

import { Router } from 'express';

export const EXPRESSION_ROUTE_DEFINITIONS = [
  {
    method: 'post',
    path: '/update-status',
    handler: 'handleUpdateStatus',
    controller: 'status',
  },
  {
    method: 'get',
    path: '/scan-statuses',
    handler: 'handleScanStatuses',
    controller: 'status',
  },
  {
    method: 'post',
    path: '/log',
    handler: 'handleLogEntry',
    controller: 'log',
  },
];

/**
 * Creates Express router with expression routes.
 * @param {object} expressionStatusController - Controller instance for status routes
 * @param {object} expressionLogController - Controller instance for logging routes
 * @returns {Router} Configured Express router
 */
export const createExpressionRoutes = (
  expressionStatusController,
  expressionLogController
) => {
  const router = Router();
  const controllerMap = {
    status: expressionStatusController,
    log: expressionLogController,
  };

  EXPRESSION_ROUTE_DEFINITIONS.forEach(({ method, path, handler, controller }) => {
    const controllerInstance = controllerMap[controller];
    if (!controllerInstance || typeof controllerInstance[handler] !== 'function') {
      throw new Error(
        `Expression routes misconfigured: ${controller} controller missing ${handler}`
      );
    }

    router[method](path, (req, res) =>
      controllerInstance[handler](req, res)
    );
  });

  return router;
};

export default createExpressionRoutes;
