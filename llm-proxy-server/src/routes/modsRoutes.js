/**
 * @file Routes for mod scanning and listing API
 * @see ../handlers/modsController.js
 */

import { Router } from 'express';

/**
 * @typedef {import('../handlers/modsController.js').ModsController} ModsController
 */

/**
 * Creates the mods routes with the given controller
 * @param {ModsController} modsController - Controller instance for handling mod requests
 * @returns {Router} Express router configured with mod routes
 */
export const createModsRoutes = (modsController) => {
  const router = Router();

  router.get('/', (req, res) => modsController.handleGetMods(req, res));

  return router;
};

export default createModsRoutes;
