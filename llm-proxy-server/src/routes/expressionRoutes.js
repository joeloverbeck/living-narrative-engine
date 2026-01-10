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
  },
  {
    method: 'get',
    path: '/scan-statuses',
    handler: 'handleScanStatuses',
  },
];

/**
 * Creates Express router with expression diagnostic status routes.
 * @param {object} expressionStatusController - Controller instance for handling requests
 * @returns {Router} Configured Express router
 */
export const createExpressionRoutes = (expressionStatusController) => {
  const router = Router();

  EXPRESSION_ROUTE_DEFINITIONS.forEach(({ method, path, handler }) => {
    router[method](path, (req, res) =>
      expressionStatusController[handler](req, res)
    );
  });

  return router;
};

export default createExpressionRoutes;
