/**
 * @file Routes for game configuration save/load endpoints
 * @see ../handlers/gameConfigController.js
 */

import { Router } from 'express';

/**
 * Creates Express router with game configuration routes.
 * @param {object} gameConfigController - Controller instance for handling requests
 * @returns {Router} Configured Express router
 */
export const createGameConfigRoutes = (gameConfigController) => {
  const router = Router();

  router.post('/save', (req, res) => gameConfigController.handleSave(req, res));
  router.get('/current', (req, res) =>
    gameConfigController.handleGetCurrent(req, res)
  );

  return router;
};
