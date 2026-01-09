/**
 * @file Routes for expression diagnostic status endpoints
 * @see ../handlers/expressionStatusController.js
 */

import { Router } from 'express';

/**
 * Creates Express router with expression diagnostic status routes.
 * @param {object} expressionStatusController - Controller instance for handling requests
 * @returns {Router} Configured Express router
 */
export const createExpressionRoutes = (expressionStatusController) => {
  const router = Router();

  router.post('/update-status', (req, res) =>
    expressionStatusController.handleUpdateStatus(req, res)
  );
  router.get('/scan-statuses', (req, res) =>
    expressionStatusController.handleScanStatuses(req, res)
  );

  return router;
};

export default createExpressionRoutes;
