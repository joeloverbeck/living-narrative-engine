/**
 * @file Routes for salvaged response recovery
 * @see ../handlers/salvageRequestController.js
 */

import { Router } from 'express';

/**
 * Creates salvage recovery routes
 * @param {object} salvageController - SalvageRequestController instance
 * @returns {Router} Express router with salvage routes
 */
export const createSalvageRoutes = (salvageController) => {
  const router = Router();

  // GET /api/llm-request/salvage/:requestId - Retrieve salvaged response by request ID
  router.get('/salvage/:requestId', (req, res) =>
    salvageController.handleSalvageByRequestId(req, res)
  );

  // GET /api/llm-request/salvage-stats - Get salvage service statistics
  router.get('/salvage-stats', (req, res) =>
    salvageController.handleSalvageStats(req, res)
  );

  return router;
};

export default createSalvageRoutes;
