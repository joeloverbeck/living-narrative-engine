// src/actions/handlers/attackActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

export function executeAttack(context) {
    const { targets } = context;
    const messages = [];
    let success = false; // Placeholder

    if (targets.length === 0) {
        messages.push({ text: "Attack what?", type: 'error' });
    } else {
        const targetName = targets.join(' ');
        messages.push({ text: `(Placeholder) You attack the ${targetName}!`, type: 'info' });
        messages.push({ text: "Combat not fully implemented.", type: 'warning' });
        // TODO: Implement logic: find target NPC in room, perform attack roll, apply damage, check target health
    }
    return { success, messages };
}