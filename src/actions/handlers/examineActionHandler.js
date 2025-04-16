// src/actions/handlers/examineActionHandler.js

// --- Core Components ---
import {NameComponent} from '../../components/nameComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
// Potentially import other components if 'examine' reveals more details (e.g., ItemComponent, WeightComponent)
import {ItemComponent} from '../../components/itemComponent.js';

// --- Utilities and Services ---
import {getDisplayName, TARGET_MESSAGES} from '../../utils/messages.js';
import {resolveTargetEntity} from '../../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';

// --- Type Imports ---
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */

/** @typedef {import('../../entities/entity.js').default} Entity */

/**
 * Handles the 'core:examine' action. Provides detailed information about a target.
 * Uses resolveTargetEntity service.
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeExamine(context) {
    const {dispatch, parsedCommand} = context;
    const messages = [];
    let success = false; // Default to failure

    // --- 1. Validate required target name ---
    if (!validateRequiredCommandPart(context, 'examine', 'directObjectPhrase')) {
        // Message "Examine what?" should be dispatched by the utility
        return {success: false, messages: [], newState: undefined};
    }
    const targetName = parsedCommand.directObjectPhrase;
    messages.push({text: `Examine intent: Target name '${targetName}'`, type: 'internal'});

    // --- 2. Resolve Target Entity using Service ---
    const resolution = resolveTargetEntity(context, {
        scope: 'nearby', // Examine things you can see or carry
        requiredComponents: [], // Examine any named entity initially
        // requiredComponents: [ItemComponent], // Alternative: If examine is ONLY for items
        actionVerb: 'examine', // For potential message construction
        targetName: targetName,
    });

    // --- 3. Handle Resolver Result ---
    switch (resolution.status) {
        case 'FOUND_UNIQUE': {
            const targetEntity = resolution.entity;
            const name = getDisplayName(targetEntity);
            const descComp = targetEntity.getComponent(DescriptionComponent);
            const description = descComp ? descComp.text : `There's nothing particularly noteworthy about the ${name}.`; // Default examine text

            // --- Construct Detailed Description ---
            // Start with a clear indication of the action
            let examineText = `You examine the ${name} closely.\n`;
            // Add the base description
            examineText += description;

            // --- Add Extra Details (Example) ---
            // This is where 'examine' differs from 'look'. Add details from other components.
            if (targetEntity.hasComponent(ItemComponent)) {
                // Add item-specific details if applicable
                examineText += `\nIt appears to be some kind of item.`;
                // Example: Check for weight, value, condition etc. based on other components
                // const weightComp = targetEntity.getComponent(WeightComponent);
                // if (weightComp) examineText += ` It feels ${weightComp.value > 10 ? 'heavy' : 'light'}.`;
            } else {
                // Add non-item specific details if applicable (e.g., for NPCs, scenery features)
                // const healthComp = targetEntity.getComponent(HealthComponent);
                // if (healthComp) examineText += `\nIt looks ${healthComp.current / healthComp.max > 0.7 ? 'healthy' : 'injured'}.`;
            }
            // --- End Extra Details ---

            dispatch('ui:message_display', {text: examineText.trim(), type: 'info'});
            messages.push({text: `Examined ${name} (${targetEntity.id})`, type: 'internal'});
            success = true;
            break;
        }

        case 'NOT_FOUND': {
            // Assume TARGET_MESSAGES.NOT_FOUND_EXAMINABLE exists or use a fallback
            const feedbackMsg = TARGET_MESSAGES.NOT_FOUND_EXAMINABLE
                ? TARGET_MESSAGES.NOT_FOUND_EXAMINABLE(targetName)
                : `You don't see anything called '${targetName}' to examine nearby.`;
            dispatch('ui:message_display', {text: feedbackMsg, type: 'info'});
            messages.push({text: `Resolution failed: NOT_FOUND. User message: "${feedbackMsg}"`, type: 'internal'});
            success = false;
            break;
        }

        case 'AMBIGUOUS': {
            const feedbackMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('examine', targetName, resolution.candidates);
            dispatch('ui:message_display', {text: feedbackMsg, type: 'warning'});
            messages.push({text: `Resolution failed: AMBIGUOUS. User message: "${feedbackMsg}"`, type: 'internal'});
            success = false;
            break;
        }

        case 'FILTER_EMPTY': {
            // 'nearby' scope was empty or filtered empty.
            const feedbackMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC('examine', 'nearby');
            dispatch('ui:message_display', {text: feedbackMsg, type: 'info'});
            messages.push({text: `Resolution failed: FILTER_EMPTY. User message: "${feedbackMsg}"`, type: 'internal'});
            success = false;
            break;
        }

        case 'INVALID_INPUT': {
            const feedbackMsg = TARGET_MESSAGES.INTERNAL_ERROR;
            dispatch('ui:message_display', {text: feedbackMsg, type: 'error'});
            messages.push({
                text: `Resolution failed: INVALID_INPUT. Configuration error calling resolveTargetEntity.`,
                type: 'internal_error'
            });
            console.error(`executeExamine: resolveTargetEntity returned INVALID_INPUT for target '${targetName}'. Context/Config issue?`);
            success = false;
            break;
        }

        default: {
            const feedbackMsg = TARGET_MESSAGES.INTERNAL_ERROR;
            dispatch('ui:message_display', {text: feedbackMsg, type: 'error'});
            messages.push({text: `Resolution failed: Unhandled status '${resolution.status}'`, type: 'internal_error'});
            console.error(`executeExamine: Unhandled resolution status: ${resolution.status}`);
            success = false;
            break;
        }
    } // End switch

    // --- 4. Return Result ---
    return {success, messages, newState: undefined};
}

/**
 * Placeholder/Example addition to messages.js:
 *
 * export const TARGET_MESSAGES = {
 * // ... other messages
 * NOT_FOUND_EXAMINABLE: (targetName) => `You don't see anything called '${targetName}' to examine nearby.`,
 * // ...
 * };
 */