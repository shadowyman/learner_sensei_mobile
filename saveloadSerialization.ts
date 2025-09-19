/**
 * Save/Load Serialization Functions
 * Handles conversion of Sets, Maps, Dates, and other non-JSON types
 */

import { logger } from './logger';

/**
 * Custom JSON replacer for serializing complex types
 * Converts Sets, Maps, Dates, and undefined values to JSON-compatible format
 */
export function serializeForSave(key: string, value: any): any {
    logger.debug(`[SAVELOAD] Serializing key: ${key}, type: ${typeof value}`);
    
    if (value instanceof Set) {
        logger.debug(`[SAVELOAD] Converting Set with ${value.size} items`);
        return {
            __type: 'Set',
            data: Array.from(value)
        };
    }
    
    if (value instanceof Map) {
        logger.debug(`[SAVELOAD] Converting Map with ${value.size} entries`);
        return {
            __type: 'Map',
            data: Array.from(value.entries())
        };
    }
    
    if (value instanceof Date) {
        logger.debug(`[SAVELOAD] Converting Date: ${value.toISOString()}`);
        return {
            __type: 'Date',
            data: value.toISOString()
        };
    }
    
    if (value === undefined) {
        logger.debug(`[SAVELOAD] Converting undefined to null for key: ${key}`);
        return null;
    }
    
    return value;
}

/**
 * Custom JSON reviver for deserializing complex types
 * Restores Sets, Maps, and Dates from their serialized format
 */
export function deserializeFromSave(key: string, value: any): any {
    if (value && typeof value === 'object' && value.__type) {
        logger.debug(`[SAVELOAD] Deserializing ${value.__type} for key: ${key}`);
        
        if (value.__type === 'Set') {
            logger.debug(`[SAVELOAD] Restoring Set with ${value.data.length} items`);
            return new Set(value.data);
        }
        
        if (value.__type === 'Map') {
            logger.debug(`[SAVELOAD] Restoring Map with ${value.data.length} entries`);
            return new Map(value.data);
        }
        
        if (value.__type === 'Date') {
            logger.debug(`[SAVELOAD] Restoring Date: ${value.data}`);
            return new Date(value.data);
        }
    }
    
    return value;
}

/**
 * Serializes CurriculumState with proper Set conversion
 */
export function serializeCurriculumState(state: any): any {
    if (!state) return null;
    
    logger.info('[SAVELOAD] Serializing curriculum state');
    logger.info('[SAVELOAD] Has teachingPlanForPhase:', !!state.teachingPlanForPhase);
    logger.info('[SAVELOAD] currentTeachingChunkIndex:', state.currentTeachingChunkIndex);
    
    const serialized = { ...state };
    
    if (state.coveredPointsInCurrentChunk instanceof Set) {
        serialized.coveredPointsInCurrentChunk = Array.from(state.coveredPointsInCurrentChunk);
        logger.debug(`[SAVELOAD] Converted coveredPoints Set: ${serialized.coveredPointsInCurrentChunk.length} items`);
    }
    
    if (state.pointsToRevisitInCurrentChunk instanceof Set) {
        serialized.pointsToRevisitInCurrentChunk = Array.from(state.pointsToRevisitInCurrentChunk);
        logger.debug(`[SAVELOAD] Converted pointsToRevisit Set: ${serialized.pointsToRevisitInCurrentChunk.length} items`);
    }
    
    if (state.activeConsolidationState?.plan instanceof Map) {
        serialized.activeConsolidationState = {
            ...state.activeConsolidationState,
            plan: Array.from(state.activeConsolidationState.plan.entries())
        };
        logger.debug(`[SAVELOAD] Converted consolidation plan Map: ${serialized.activeConsolidationState.plan.length} entries`);
    }

    if (!serialized.chunkUnderstandingLedger) {
        serialized.chunkUnderstandingLedger = {};
    }

    return serialized;
}

/**
 * Deserializes CurriculumState restoring Sets and Maps
 */
export function deserializeCurriculumState(state: any): any {
    if (!state) return null;
    
    logger.info('[SAVELOAD] Deserializing curriculum state');
    logger.info('[SAVELOAD] Loaded teachingPlanForPhase:', !!state.teachingPlanForPhase);
    logger.info('[SAVELOAD] Loaded currentTeachingChunkIndex:', state.currentTeachingChunkIndex);
    
    const deserialized = { ...state };
    
    if (Array.isArray(state.coveredPointsInCurrentChunk)) {
        deserialized.coveredPointsInCurrentChunk = new Set(state.coveredPointsInCurrentChunk);
        logger.debug(`[SAVELOAD] Restored coveredPoints Set: ${deserialized.coveredPointsInCurrentChunk.size} items`);
    }
    
    if (Array.isArray(state.pointsToRevisitInCurrentChunk)) {
        deserialized.pointsToRevisitInCurrentChunk = new Set(state.pointsToRevisitInCurrentChunk);
        logger.debug(`[SAVELOAD] Restored pointsToRevisit Set: ${deserialized.pointsToRevisitInCurrentChunk.size} items`);
    }
    
    if (state.activeConsolidationState?.plan && Array.isArray(state.activeConsolidationState.plan)) {
        deserialized.activeConsolidationState = {
            ...state.activeConsolidationState,
            plan: new Map(state.activeConsolidationState.plan)
        };
        logger.debug(`[SAVELOAD] Restored consolidation plan Map: ${deserialized.activeConsolidationState.plan.size} entries`);
    }

    if (!deserialized.chunkUnderstandingLedger) {
        deserialized.chunkUnderstandingLedger = {};
    }

    return deserialized;
}

/**
 * Serializes LearnerModel with proper Set conversion
 */
export function serializeLearnerModel(model: any): any {
    if (!model) return null;
    
    logger.info('[SAVELOAD] Serializing learner model');
    
    const serialized = { ...model };
    
    if (model.awardedKcForPhasePoints instanceof Set) {
        serialized.awardedKcForPhasePoints = Array.from(model.awardedKcForPhasePoints);
        logger.debug(`[SAVELOAD] Converted awardedKc Set: ${serialized.awardedKcForPhasePoints.length} items`);
    }
    
    return serialized;
}

/**
 * Deserializes LearnerModel restoring Sets
 */
export function deserializeLearnerModel(model: any): any {
    if (!model) return null;
    
    logger.info('[SAVELOAD] Deserializing learner model');
    
    const deserialized = { ...model };
    
    if (Array.isArray(model.awardedKcForPhasePoints)) {
        deserialized.awardedKcForPhasePoints = new Set(model.awardedKcForPhasePoints);
        logger.debug(`[SAVELOAD] Restored awardedKc Set: ${deserialized.awardedKcForPhasePoints.size} items`);
    }
    
    return deserialized;
}

/**
 * Deep clones an object preserving Sets, Maps, and Dates
 */
export function deepCloneState(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    if (obj instanceof Set) {
        return new Set(Array.from(obj).map(item => deepCloneState(item)));
    }
    
    if (obj instanceof Map) {
        const cloned = new Map();
        obj.forEach((value, key) => {
            cloned.set(deepCloneState(key), deepCloneState(value));
        });
        return cloned;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => deepCloneState(item));
    }
    
    if (typeof obj === 'object') {
        const cloned: any = {};
        Object.keys(obj).forEach(key => {
            cloned[key] = deepCloneState(obj[key]);
        });
        return cloned;
    }
    
    return obj;
}

/**
 * Validates that all required fields are present in the serialized data
 */
export function validateSerializedData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    logger.info('[SAVELOAD] Validating serialized data structure');
    
    if (!data) {
        errors.push('Data is null or undefined');
        return { isValid: false, errors };
    }
    
    // Curriculum is not saved - it's always loaded from Modules.txt
    // if (!data.curriculum) {
    //     errors.push('Missing required field: curriculum');
    // }
    
    if (!data.learnerModel) {
        errors.push('Missing required field: learnerModel');
    }
    
    if (data.applicationState) {
        if (data.applicationState.currentMessageId === undefined) {
            errors.push('Missing required field: applicationState.currentMessageId');
        }
        if (!data.applicationState.lastSenseiResponses) {
            errors.push('Missing required field: applicationState.lastSenseiResponses');
        }
    } else {
        errors.push('Missing required field: applicationState');
    }
    
    if (data.curriculumState) {
        const cs = data.curriculumState;
        if (cs.currentModuleIndex === undefined) {
            errors.push('Invalid curriculumState: missing currentModuleIndex');
        }
        if (cs.currentConceptIndex === undefined) {
            errors.push('Invalid curriculumState: missing currentConceptIndex');
        }
        if (!cs.currentPhase) {
            errors.push('Invalid curriculumState: missing currentPhase');
        }
    }
    
    const isValid = errors.length === 0;
    
    if (!isValid) {
        logger.error('[SAVELOAD] Validation failed:', errors);
    } else {
        logger.info('[SAVELOAD] Validation passed');
    }
    
    return { isValid, errors };
}
