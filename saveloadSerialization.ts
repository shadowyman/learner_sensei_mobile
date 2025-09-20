/**
 * Save/Load Serialization Functions
 * Handles conversion of Sets, Maps, Dates, and other non-JSON types
 */

/**
 * Custom JSON replacer for serializing complex types
 * Converts Sets, Maps, Dates, and undefined values to JSON-compatible format
 */
export function serializeForSave(key: string, value: any): any {
    
    if (value instanceof Set) {
        return {
            __type: 'Set',
            data: Array.from(value)
        };
    }
    
    if (value instanceof Map) {
        return {
            __type: 'Map',
            data: Array.from(value.entries())
        };
    }
    
    if (value instanceof Date) {
        return {
            __type: 'Date',
            data: value.toISOString()
        };
    }
    
    if (value === undefined) {
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
        
        if (value.__type === 'Set') {
            return new Set(value.data);
        }
        
        if (value.__type === 'Map') {
            return new Map(value.data);
        }
        
        if (value.__type === 'Date') {
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
    
    const serialized = { ...state };
    
    if (state.coveredPointsInCurrentChunk instanceof Set) {
        serialized.coveredPointsInCurrentChunk = Array.from(state.coveredPointsInCurrentChunk);
    }
    
    if (state.pointsToRevisitInCurrentChunk instanceof Set) {
        serialized.pointsToRevisitInCurrentChunk = Array.from(state.pointsToRevisitInCurrentChunk);
    }
    
    if (state.activeConsolidationState?.plan instanceof Map) {
        serialized.activeConsolidationState = {
            ...state.activeConsolidationState,
            plan: Array.from(state.activeConsolidationState.plan.entries())
        };
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
    
    const deserialized = { ...state };
    
    if (Array.isArray(state.coveredPointsInCurrentChunk)) {
        deserialized.coveredPointsInCurrentChunk = new Set(state.coveredPointsInCurrentChunk);
    }
    
    if (Array.isArray(state.pointsToRevisitInCurrentChunk)) {
        deserialized.pointsToRevisitInCurrentChunk = new Set(state.pointsToRevisitInCurrentChunk);
    }
    
    if (state.activeConsolidationState?.plan && Array.isArray(state.activeConsolidationState.plan)) {
        deserialized.activeConsolidationState = {
            ...state.activeConsolidationState,
            plan: new Map(state.activeConsolidationState.plan)
        };
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
    
    const serialized = { ...model };
    
    if (model.awardedKcForPhasePoints instanceof Set) {
        serialized.awardedKcForPhasePoints = Array.from(model.awardedKcForPhasePoints);
    }
    
    return serialized;
}

/**
 * Deserializes LearnerModel restoring Sets
 */
export function deserializeLearnerModel(model: any): any {
    if (!model) return null;
    
    const deserialized = { ...model };
    
    if (Array.isArray(model.awardedKcForPhasePoints)) {
        deserialized.awardedKcForPhasePoints = new Set(model.awardedKcForPhasePoints);
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
    return { isValid, errors };
}
