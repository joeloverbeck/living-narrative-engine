export const CORE_MOD_ID = 'core';

// Allow tests or specialized builds to override the default cap via an
// environment variable. This keeps heavy loops short for test suites.
const parsedMax = parseInt(process.env.MAX_AVAILABLE_ACTIONS_PER_TURN, 10);
export const MAX_AVAILABLE_ACTIONS_PER_TURN =
  Number.isInteger(parsedMax) && parsedMax > 0 ? parsedMax : 30000;
