/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from '../logger';

/**
 * Validation tests for the teaching invariants optimization.
 * This file contains tests to ensure that the optimized curriculum instructions
 * maintain the same teaching quality while reducing token usage.
 */

import { getCurriculumFocusInstruction } from '../curriculum';
import { CurriculumState, CurriculumItem, Curriculum } from '../curriculum';
import { RECURSIVE_SENSEI_TEACHING_INVARIANTS } from '../prompts';

// Mock data for testing
const mockCurriculum: Curriculum = {
    modules: []
};

const mockItem: CurriculumItem = {
    moduleTitle: "Module 1: Introduction to Recursion",
    moduleGoal: "Understand the fundamental concepts of recursion",
    concept: {
        title: "Base Case",
        text: "The base case is the condition that stops the recursion"
    },
    curriculumPathId: "M1.C1.P1",
    isLastConceptInModule: false,
    isLastPhaseForConcept: false,
    isModuleWidePhase: false
};

const mockState: CurriculumState = {
    currentModuleIndex: 0,
    currentConceptIndex: 0,
    currentPhase: "IntroIllustrate",
    currentTeachingChunkIndex: 0,
    teachingPlanForPhase: [
        [
            { text: "Recursion requires a base case to prevent infinite loops", kcValue: 0.3 },
            { text: "The base case is the simplest form of the problem", kcValue: 0.3 }
        ]
    ],
    coveredPointsInCurrentChunk: new Set<string>(),
    pointsToRevisitInCurrentChunk: new Set<string>(),
    isCompleted: false,
    activeConsolidationState: null
};

/**
 * Test 1: Verify token reduction
 * Compare the length of legacy vs optimized instructions
 */
export function testTokenReduction(): void {
    // Force legacy mode
    process.env.USE_OPTIMIZED_INSTRUCTIONS = 'false';
    const legacyInstruction = getCurriculumFocusInstruction(
        mockCurriculum,
        mockItem,
        mockState,
        false
    );

    // Force optimized mode
    process.env.USE_OPTIMIZED_INSTRUCTIONS = 'true';
    const optimizedInstruction = getCurriculumFocusInstruction(
        mockCurriculum,
        mockItem,
        mockState,
        false
    );

    const reduction = legacyInstruction.length - optimizedInstruction.length;
    const reductionPercentage = (reduction / legacyInstruction.length) * 100;

    logger.log(`Token Reduction Test Results:`);
    logger.log(`Legacy instruction length: ${legacyInstruction.length} characters`);
    logger.log(`Optimized instruction length: ${optimizedInstruction.length} characters`);
    logger.log(`Reduction: ${reduction} characters (${reductionPercentage.toFixed(1)}%)`);
    logger.log(`Expected reduction: ~2000 characters`);
    
    if (reduction < 1500) {
        logger.error(`❌ WARNING: Token reduction is less than expected!`);
    } else {
        logger.log(`✅ Token reduction test passed!`);
    }
}

/**
 * Test 2: Verify all dynamic content is preserved
 * Ensure that module, phase, concept, and teaching points are still present
 */
export function testDynamicContentPreservation(): void {
    process.env.USE_OPTIMIZED_INSTRUCTIONS = 'true';
    const optimizedInstruction = getCurriculumFocusInstruction(
        mockCurriculum,
        mockItem,
        mockState,
        false
    );

    const requiredElements = [
        mockItem.moduleTitle,
        mockState.currentPhase,
        mockItem.concept!.title,
        mockItem.moduleGoal,
        "Teaching Points:",
        "Recursion requires a base case"
    ];

    logger.log(`\nDynamic Content Preservation Test:`);
    let allPresent = true;
    
    for (const element of requiredElements) {
        if (optimizedInstruction.includes(element)) {
            logger.log(`✅ Found: "${element}"`);
        } else {
            logger.error(`❌ Missing: "${element}"`);
            allPresent = false;
        }
    }

    if (allPresent) {
        logger.log(`✅ All dynamic content preserved!`);
    } else {
        logger.error(`❌ Some dynamic content is missing!`);
    }
}

/**
 * Test 3: Verify teaching invariants are included in base
 * Check that the TEACHING_INVARIANTS constant contains expected content
 */
export function testTeachingInvariantsContent(): void {
    logger.log(`\nTeaching Invariants Content Test:`);
    
    const expectedPhrases = [
        "MANDATORY TEACHING EXECUTION FRAMEWORK",
        "Core Idea Definition",
        "Illustrative Examples",
        "Confusion Anticipation",
        "immense depth and thoroughness",
        "Mermaid diagram creation",
        "Check Your Understanding"
    ];

    let allPresent = true;
    
    for (const phrase of expectedPhrases) {
        if (RECURSIVE_SENSEI_TEACHING_INVARIANTS.includes(phrase)) {
            logger.log(`✅ Found: "${phrase}"`);
        } else {
            logger.error(`❌ Missing: "${phrase}"`);
            allPresent = false;
        }
    }

    if (allPresent) {
        logger.log(`✅ All required teaching invariants present!`);
    } else {
        logger.error(`❌ Some teaching invariants are missing!`);
    }
}

/**
 * Run all tests
 */
export function runAllTests(): void {
    logger.log("=== Teaching Invariants Validation Tests ===\n");
    
    testTokenReduction();
    testDynamicContentPreservation();
    testTeachingInvariantsContent();
    
    logger.log("\n=== Tests Complete ===");
}

// Export a simple validation function that can be called from the console
(window as any).validateTeachingOptimization = runAllTests;

logger.log("Teaching invariants validation loaded. Run validateTeachingOptimization() in console to test.");
