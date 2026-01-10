/**
 * @file CORS validation helpers for route method coverage
 */

const normalizeMethods = (methods) => {
  if (!Array.isArray(methods)) {
    return [];
  }
  return methods
    .filter((method) => typeof method === 'string')
    .map((method) => method.trim().toUpperCase())
    .filter((method) => method.length > 0);
};

const collectRouteMethods = (routeDefinitions) => {
  if (!Array.isArray(routeDefinitions)) {
    return [];
  }
  return routeDefinitions
    .map((route) => route?.method)
    .filter((method) => typeof method === 'string')
    .map((method) => method.trim().toUpperCase())
    .filter((method) => method.length > 0);
};

export const validateRouteMethodsAgainstCors = (
  routeDefinitions,
  allowedMethods,
  { logger, throwOnMismatch = false, context = 'routes' } = {}
) => {
  const normalizedAllowedMethods = new Set(normalizeMethods(allowedMethods));
  const routeMethods = new Set(collectRouteMethods(routeDefinitions));
  const missingMethods = [...routeMethods].filter(
    (method) => !normalizedAllowedMethods.has(method)
  );

  if (missingMethods.length > 0) {
    const message =
      `LLM Proxy Server: CORS allowed methods missing for ${context}: ` +
      `${missingMethods.join(', ')}`;

    if (logger?.warn) {
      logger.warn(message, {
        missingMethods,
        allowedMethods: [...normalizedAllowedMethods],
        routeMethods: [...routeMethods],
      });
    }

    if (throwOnMismatch) {
      throw new Error(message);
    }
  }

  return {
    missingMethods,
    allowedMethods: [...normalizedAllowedMethods],
    routeMethods: [...routeMethods],
  };
};
