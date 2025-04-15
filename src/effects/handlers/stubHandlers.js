// src/effects/handlers/stubHandlers.js

// Type Imports for JSDoc
/** @typedef {import('../../systems/itemUsageSystem.js').EffectContext} EffectContext */

/** @typedef {import('../../systems/itemUsageSystem.js').EffectResult} EffectResult */

/** @type {(params: object | undefined, context: EffectContext) => EffectResult} */
export function handleApplyStatusEffectStub(params, context) {
    const messages = [{
        text: `Apply_status_effect processed (stub) for ${context.itemName}. Target: ${context.target ? (context.target.id || context.target.connectionId) : 'None'}`,
        type: 'internal'
    }];
    console.log(messages[0].text, "Params:", params);
    return {success: true, messages};
}

/** @type {(params: object | undefined, context: EffectContext) => EffectResult} */
export function handleDamageEffectStub(params, context) {
    const messages = [{
        text: `Damage effect processed (stub) for ${context.itemName}. Target: ${context.target ? (context.target.id || context.target.connectionId) : 'None'}`,
        type: 'internal'
    }];
    console.log(messages[0].text, "Params:", params);
    return {success: true, messages};
}

/** @type {(params: object | undefined, context: EffectContext) => EffectResult} */
export function handleSpawnEntityEffectStub(params, context) {
    const messages = [{
        text: `Spawn_entity effect processed (stub) for ${context.itemName}. Target: ${context.target ? (context.target.id || context.target.connectionId) : 'None'}`,
        type: 'internal'
    }];
    console.log(messages[0].text, "Params:", params);
    return {success: true, messages};
}

/** @type {(params: object | undefined, context: EffectContext) => EffectResult} */
export function handleRemoveStatusEffectStub(params, context) {
    const messages = [{
        text: `Remove_status_effect processed (stub) for ${context.itemName}. Target: ${context.target ? (context.target.id || context.target.connectionId) : 'None'}`,
        type: 'internal'
    }];
    console.log(messages[0].text, "Params:", params);
    return {success: true, messages};
}