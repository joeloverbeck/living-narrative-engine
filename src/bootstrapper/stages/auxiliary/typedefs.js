// src/bootstrapper/stages/auxiliary/typedefs.js

/**
 * @typedef {import('../../dependencyInjection/appContainer.js').default} AppContainer
 * @typedef {import('../../engine/gameEngine.js').default} GameEngineInstance
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../dependencyInjection/tokens.js').tokens} TokensObject
 */

/**
 * Common dependencies object passed to helper functions.
 *
 * @typedef {object} AuxHelperDeps
 * @property {AppContainer} container
 * @property {GameEngineInstance} gameEngine
 * @property {ILogger} logger
 * @property {TokensObject} tokens
 */
