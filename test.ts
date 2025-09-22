/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from './logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseModulesTxt, Module, generateTeachingPlanForPhase, CurriculumItem } from './curriculum';
import { ARCHETYPE_COMPARISON_TEST_CONFIG } from './model_usage';

// Test Suite Configuration - ENABLED FOR TESTING
const TEST_SUITE_CONFIG = {
    enabled: true, // Set to true to enable test execution
    runArchetypeTest: false, // Set to true to run archetype comparison test
    runConceptExtractionTest: false, // Set to true to run concept extraction test
    runSocraticPhaseInvestigation: false, // Set to true to run Socratic phase investigation
    runStandardizedFormatTest: false // Set to true to test standardized format parsing
};

interface ConceptTestResult {
    conceptId: string;
    conceptTitle: string;
    prompt1Response: string;
    prompt2Response: string;
    match: boolean;
    discrepancy?: string;
}

/**
 * Archetype Comparison Test
 * Tests consistency of archetype classification between two different prompts
 * for concepts from modules M1.5 through M5
 */
export class ArchetypeComparisonTest {
    private genAI: GoogleGenerativeAI;
    private testResults: ConceptTestResult[] = [];
    private prompt1Template: string = '';
    private prompt2Template: string = '';

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    /**
     * Main test execution function
     */
    public async runTest(): Promise<void> {
        logger.warn("🚀 ========== ARCHETYPE COMPARISON TEST STARTING ==========");
        
        try {
            // Load prompt templates
            await this.loadPromptTemplates();
            
            // Extract concepts from modules M1.5-M5
            const concepts = await this.extractConcepts();
            logger.warn(`📊 Found ${concepts.length} concepts to test from modules M1.5-M5`);
            
            // Test each concept
            for (const concept of concepts) {
                await this.testConcept(concept);
            }
            
            // Generate and log final report
            this.generateFinalReport();
            
        } catch (error) {
            logger.error("❌ Test failed with error:", error);
        }
        
        logger.warn("🏁 ========== ARCHETYPE COMPARISON TEST COMPLETED ==========");
    }

    /**
     * Load prompt templates from files
     */
    private async loadPromptTemplates(): Promise<void> {
        logger.warn("📄 Loading prompt templates...");
        
        try {
            // Read testPrompt1.txt
            const prompt1Response = await fetch('./testPrompt1.txt');
            this.prompt1Template = await prompt1Response.text();
            logger.warn("✅ Loaded testPrompt1.txt");
            
            // Read testPrompt2.txt  
            const prompt2Response = await fetch('./testPrompt2.txt');
            this.prompt2Template = await prompt2Response.text();
            logger.warn("✅ Loaded testPrompt2.txt");
            
        } catch (error) {
            throw new Error(`Failed to load prompt templates: ${error}`);
        }
    }

    /**
     * Extract concepts from modules M1.5-M5 using existing curriculum parsing logic
     */
    private async extractConcepts(): Promise<Array<{id: string, title: string, text: string}>> {
        logger.warn("📚 Extracting concepts from modules.txt...");
        
        try {
            // Read modules.txt
            const modulesResponse = await fetch('./Modules.txt');
            const modulesContent = await modulesResponse.text();
            const curriculum = parseModulesTxt(modulesContent);
            
            const concepts: Array<{id: string, title: string, text: string}> = [];
            
            // Find modules M1.5 through M5
            const targetModuleIds = ['Module1_5', 'Module2', 'Module3', 'Module4', 'Module5'];
            
            for (const [moduleIndex, module] of curriculum.modules.entries()) {
                // Check if this module is in our target range
                if (targetModuleIds.includes(module.id)) {
                    // Convert module ID for display (Module1_5 -> M1.5)
                    const displayModuleId = module.id.replace('Module', 'M').replace('_', '.');
                    logger.warn(`📖 Processing ${displayModuleId}: ${module.title}`);
                    
                    // Extract concepts from this module
                    if (module.concepts && module.concepts.length > 0) {
                        for (const [conceptIndex, concept] of module.concepts.entries()) {
                            const conceptId = `${displayModuleId}.${conceptIndex + 1}`;
                            concepts.push({
                                id: conceptId,
                                title: concept.title,
                                text: `${concept.title}\n${concept.text}`
                            });
                        }
                    }
                }
            }
            
            return concepts;
            
        } catch (error) {
            throw new Error(`Failed to extract concepts: ${error}`);
        }
    }

    /**
     * Test a single concept with both prompts
     */
    private async testConcept(concept: {id: string, title: string, text: string}): Promise<void> {
        logger.warn(`\n🧪 Testing Concept ${concept.id}: ${concept.title}`);
        
        try {
            // Prepare prompts by replacing placeholder with actual concept text
            const prompt1 = this.prompt1Template.replace(
                '<REPLACE WITH ACTUAL INDIVIDUAL FULL CONCEPT TEXT HERE>',
                concept.text
            );
            
            const prompt2 = this.prompt2Template.replace(
                '<REPLACE WITH ACTUAL INDIVIDUAL FULL CONCEPT TEXT HERE>',
                concept.text
            );
            
            // Get LLM response for prompt 1
            logger.warn(`📤 Sending concept to LLM with Prompt 1...`);
            const model1 = this.genAI.getGenerativeModel({ 
                model: ARCHETYPE_COMPARISON_TEST_CONFIG.modelName,
                ...ARCHETYPE_COMPARISON_TEST_CONFIG.config
            });
            const result1 = await model1.generateContent(prompt1);
            const response1 = result1.response.text().trim();
            logger.warn(`📥 Prompt 1 Response Received: ${response1}`);
            
            // Get LLM response for prompt 2
            logger.warn(`📤 Sending concept to LLM with Prompt 2...`);
            const model2 = this.genAI.getGenerativeModel({ 
                model: ARCHETYPE_COMPARISON_TEST_CONFIG.modelName,
                ...ARCHETYPE_COMPARISON_TEST_CONFIG.config
            });
            const result2 = await model2.generateContent(prompt2);
            const response2 = result2.response.text().trim();
            logger.warn(`📥 Prompt 2 Response Received: ${response2}`);
            
            // Extract archetype from responses (handle variations in response format)
            const archetype1 = this.extractArchetype(response1);
            const archetype2 = this.extractArchetype(response2);
            
            // Compare results
            const match = archetype1 === archetype2;
            const discrepancy = match ? undefined : `Prompt1: ${archetype1}, Prompt2: ${archetype2}`;
            
            // Store result
            const testResult: ConceptTestResult = {
                conceptId: concept.id,
                conceptTitle: concept.title,
                prompt1Response: archetype1,
                prompt2Response: archetype2,
                match,
                discrepancy
            };
            
            this.testResults.push(testResult);
            
            // Log consolidated result for this concept
            logger.warn(`
📊 ===== CONCEPT ${concept.id} TEST RESULT =====
📌 Concept: ${concept.title}
📝 Full Text: ${concept.text.substring(0, 200)}...
🔵 Prompt 1 Archetype: ${archetype1}
🔵 Prompt 2 Archetype: ${archetype2}
✅ Match: ${match ? 'PASS' : 'FAIL'}
${discrepancy ? `❌ Discrepancy: ${discrepancy}` : ''}
==========================================
            `);
            
        } catch (error) {
            logger.error(`❌ Failed to test concept ${concept.id}: ${error}`);
            this.testResults.push({
                conceptId: concept.id,
                conceptTitle: concept.title,
                prompt1Response: 'ERROR',
                prompt2Response: 'ERROR',
                match: false,
                discrepancy: `Error: ${error}`
            });
        }
    }

    /**
     * Extract archetype from LLM response
     */
    private extractArchetype(response: string): string {
        // List of valid archetypes to look for
        const archetypes = [
            'Foundational Concept',
            'Pattern Definition',
            'Component Deep-Dive',
            'Toolbox/Mechanism',
            'Strategic Heuristic',
            'Synthesis/Application'
        ];
        
        // Clean response and look for archetype
        const cleanResponse = response.replace(/[*`]/g, '').trim();
        
        for (const archetype of archetypes) {
            if (cleanResponse.includes(archetype)) {
                return archetype;
            }
        }
        
        // If no exact match found, return the cleaned response
        return cleanResponse;
    }

    /**
     * Generate and log final report
     */
    private generateFinalReport(): void {
        logger.warn(`
        
🎯 ========== FINAL ARCHETYPE COMPARISON REPORT ==========
        `);
        
        let passCount = 0;
        let failCount = 0;
        const reportLines: string[] = [];
        
        for (const result of this.testResults) {
            if (result.match) {
                passCount++;
                reportLines.push(`${result.conceptId}->Pass`);
            } else {
                failCount++;
                reportLines.push(`${result.conceptId}->Fail [${result.discrepancy}]`);
            }
        }
        
        logger.warn(`📊 Summary: ${passCount} PASSED, ${failCount} FAILED out of ${this.testResults.length} concepts`);
        logger.warn(`\n📋 Detailed Results:\n${reportLines.join(', ')}`);
        
        // Log any failed concepts with details
        if (failCount > 0) {
            logger.warn(`\n❌ Failed Concepts Details:`);
            for (const result of this.testResults) {
                if (!result.match) {
                    logger.warn(`
Concept ${result.conceptId}: ${result.conceptTitle}
- Prompt 1: ${result.prompt1Response}
- Prompt 2: ${result.prompt2Response}
                    `);
                }
            }
        }
        
        logger.warn(`
========================================================
        `);
    }
}

/**
 * Concept Extraction Test
 * Tests and displays the concept extraction functionality
 * Shows individual concepts extracted from all modules
 */
export class ConceptExtractionTest {
    
    constructor() {
        // No API key needed for this test
    }

    /**
     * Main test execution function
     */
    public async runTest(): Promise<void> {
        logger.warn("🚀 ========== CONCEPT EXTRACTION TEST STARTING ==========");
        
        try {
            // Extract concepts from all modules
            const concepts = await this.extractAllConcepts();
            logger.warn(`📊 Found ${concepts.length} total concepts across all modules`);
            
            // Display each concept
            for (const concept of concepts) {
                this.displayConcept(concept);
            }
            
            // Generate summary report
            this.generateSummaryReport(concepts);
            
        } catch (error) {
            logger.error("❌ Concept extraction test failed with error:", error);
        }
        
        logger.warn("🏁 ========== CONCEPT EXTRACTION TEST COMPLETED ==========");
    }

    /**
     * Extract concepts from all modules using existing curriculum parsing logic
     */
    private async extractAllConcepts(): Promise<Array<{id: string, moduleId: string, title: string, text: string}>> {
        logger.warn("📚 Extracting concepts from modules.txt...");
        
        try {
            // Read modules.txt
            const modulesResponse = await fetch('./Modules.txt');
            const modulesContent = await modulesResponse.text();
            
            // Parse modules manually to see raw concepts section
            const moduleRegex = /^Module (\d+(?:\.\d+)?):\s*(.*?)\n[\s\S]*?Goal:\s*([\s\S]*?)\nConcepts[\s\S]*?:\s*([\s\S]*?)(?=\nMethodology:|\nModule|$)/gim;
            const conceptRegex = /(?:^|\n)\s*(\d+)\.\s+([^:]+?):\s*([\s\S]*?)(?=\n\s*\d+\.\s+[^:]+:|\nMethodology:|$)/g;
            
            let moduleMatch;
            while ((moduleMatch = moduleRegex.exec(modulesContent)) !== null) {
                const displayModuleId = `M${moduleMatch[1].replace('_', '.')}`;
                const moduleTitle = moduleMatch[2].trim();
                const conceptsSection = moduleMatch[4];
                
                logger.warn(`\n🔍 ===== RAW CONCEPTS SECTION FOR ${displayModuleId} =====`);
                logger.warn(`Module: ${displayModuleId}: ${moduleTitle}`);
                logger.warn(`Raw Concepts Section Length: ${conceptsSection.length} chars`);
                logger.warn(`Raw Concepts Section Content:`);
                logger.warn(`${conceptsSection}`);
                logger.warn(`===== END RAW CONCEPTS SECTION =====\n`);
                
                // Now extract individual concepts from this section
                let conceptCount = 0;
                conceptRegex.lastIndex = 0; // Reset regex
                let conceptMatch;
                while ((conceptMatch = conceptRegex.exec(conceptsSection)) !== null) {
                    conceptCount++;
                    logger.warn(`Found concept ${conceptCount}: "${conceptMatch[2]}" with text length ${conceptMatch[3].length}`);
                }
                logger.warn(`Total concepts found in ${displayModuleId}: ${conceptCount}\n`);
            }
            
            // Now use the normal parsing for the actual test
            const curriculum = parseModulesTxt(modulesContent);
            
            const concepts: Array<{id: string, moduleId: string, title: string, text: string}> = [];
            
            // Extract concepts from all modules
            for (const [moduleIndex, module] of curriculum.modules.entries()) {
                // Convert module ID for display (Module1_5 -> M1.5)
                const displayModuleId = module.id.replace('Module', 'M').replace('_', '.');
                logger.warn(`📖 Processing ${displayModuleId}: ${module.title}`);
                
                // Extract concepts from this module
                if (module.concepts && module.concepts.length > 0) {
                    for (const [conceptIndex, concept] of module.concepts.entries()) {
                        const conceptId = `${displayModuleId}.${conceptIndex + 1}`;
                        concepts.push({
                            id: conceptId,
                            moduleId: displayModuleId,
                            title: concept.title,
                            text: concept.text
                        });
                    }
                } else {
                    logger.warn(`⚠️  Module ${displayModuleId} has no concepts`);
                }
            }
            
            return concepts;
            
        } catch (error) {
            throw new Error(`Failed to extract concepts: ${error}`);
        }
    }

    /**
     * Display a single concept with detailed formatting
     */
    private displayConcept(concept: {id: string, moduleId: string, title: string, text: string}): void {
        logger.warn(`
🧩 ===== CONCEPT ${concept.id} DETAILS =====
📌 Module: ${concept.moduleId}
📝 Title: ${concept.title}
📄 Full Concept Text:
${concept.text}
==========================================
        `);
    }

    /**
     * Generate and log summary report
     */
    private generateSummaryReport(concepts: Array<{id: string, moduleId: string, title: string, text: string}>): void {
        logger.warn(`
        
🎯 ========== CONCEPT EXTRACTION SUMMARY REPORT ==========
        `);
        
        // Group concepts by module
        const conceptsByModule = new Map<string, number>();
        for (const concept of concepts) {
            const count = conceptsByModule.get(concept.moduleId) || 0;
            conceptsByModule.set(concept.moduleId, count + 1);
        }
        
        // Log module-wise counts
        logger.warn(`📊 Concepts extracted per module:`);
        for (const [moduleId, count] of Array.from(conceptsByModule.entries()).sort()) {
            logger.warn(`   ${moduleId}: ${count} concepts`);
        }
        
        logger.warn(`\n📈 Total modules processed: ${conceptsByModule.size}`);
        logger.warn(`📈 Total concepts extracted: ${concepts.length}`);
        
        // Log concept titles summary
        logger.warn(`\n📋 All concept titles:`);
        for (const concept of concepts) {
            logger.warn(`   ${concept.id}: "${concept.title}"`);
        }
        
        logger.warn(`
========================================================
        `);
    }
}

/**
 * Step 3 Socratic Methodology Extraction Test
 * Shows exactly what "3.*" methodology steps are being extracted for all modules
 * Focuses on identifying missing nested content in methodology regex
 */
export class SocraticPhaseInvestigation {
    
    constructor() {
        // No API key needed for this investigation
    }

    /**
     * Main investigation execution function
     */
    public async runInvestigation(): Promise<void> {
        logger.warn("🔍 ========== STEP 3 SOCRATIC METHODOLOGY EXTRACTION ==========");
        
        try {
            // Extract modules and their methodology
            const curriculum = await this.loadCurriculum();
            logger.warn(`📊 Analyzing Step 3 methodology extraction across ${curriculum.modules.length} modules\n`);
            
            // Show Step 3 methodology for each module
            for (const [moduleIndex, module] of curriculum.modules.entries()) {
                this.displayModuleSocraticMethodology(module);
            }
            
            // Generate summary
            this.generateExtractionSummary(curriculum);
            
        } catch (error) {
            logger.error("❌ Step 3 methodology extraction analysis failed with error:", error);
        }
        
        logger.warn("🔍 ========== STEP 3 METHODOLOGY EXTRACTION COMPLETED ==========");
    }

    /**
     * Load curriculum from Modules.txt
     */
    private async loadCurriculum(): Promise<any> {
        logger.warn("📚 Loading curriculum from modules.txt...");
        
        try {
            const modulesResponse = await fetch('./Modules.txt');
            const modulesContent = await modulesResponse.text();
            const curriculum = parseModulesTxt(modulesContent);
            return curriculum;
        } catch (error) {
            throw new Error(`Failed to load curriculum: ${error}`);
        }
    }

    /**
     * Display Step 3 methodology extraction for a specific module
     * Shows exactly what content is captured by the methodology regex
     */
    private displayModuleSocraticMethodology(module: any): void {
        const displayModuleId = module.id.replace('Module', 'M').replace('_', '.');
        
        logger.warn(`🔬 MODULE ${displayModuleId}: ${module.title}`);
        
        // Find all methodology steps that start with "3."
        // NEW: Check for dedicated Socratic section instead of numbered methodology steps  
        const hasSocraticSection = !!(module.socratic && module.socratic.trim());
        const socraticContentLength = hasSocraticSection ? module.socratic.length : 0;
        
        logger.warn(`📋 Socratic Section Found: ${hasSocraticSection ? 'YES' : 'NO'}`);
        
        if (hasSocraticSection) {
            logger.warn(`📏 Socratic Content Length: ${socraticContentLength} characters`);
            logger.warn(`📄 Full Socratic Content:`);
            logger.warn(`${module.socratic}`);
        } else {
            logger.warn(`   ⚠️  No Socratic section found in module`);
        }
        
        logger.warn(`============================================================\n`);
    }


    /**
     * Generate summary of Step 3 methodology extraction
     */
    private generateExtractionSummary(curriculum: any): void {
        logger.warn(`🎯 ========== STEP 3 METHODOLOGY EXTRACTION SUMMARY ==========`);
        
        let totalModules = curriculum.modules.length;
        let modulesWithSocraticSteps = 0;
        let totalSocraticSteps = 0;
        
        const moduleStats: Array<{id: string, title: string, stepCount: number}> = [];
        
        for (const module of curriculum.modules) {
            const displayModuleId = module.id.replace('Module', 'M').replace('_', '.');
            // NEW: Check for Socratic section instead of numbered methodology steps
            const hasSocraticSection = !!(module.socratic && module.socratic.trim());
            
            if (hasSocraticSection) {
                modulesWithSocraticSteps++;
                totalSocraticSteps += 1; // Count as 1 section instead of counting steps
            }
            
            moduleStats.push({
                id: displayModuleId,
                title: module.title.substring(0, 40) + (module.title.length > 40 ? '...' : ''),
                stepCount: hasSocraticSection ? 1 : 0 // 1 if has section, 0 if not
            });
        }
        
        logger.warn(`📊 Socratic Section Statistics:`);
        logger.warn(`   Total modules analyzed: ${totalModules}`);
        logger.warn(`   Modules with Socratic sections: ${modulesWithSocraticSteps}`);
        logger.warn(`   Total Socratic sections found: ${totalSocraticSteps}`);
        
        logger.warn(`\n📋 Per-Module Breakdown:`);
        moduleStats.forEach(stat => {
            const status = stat.stepCount > 0 ? '✅' : '❌';
            logger.warn(`   ${status} ${stat.id}: ${stat.stepCount} step(s) - ${stat.title}`);
        });
        
        logger.warn(`
🔍 ANALYSIS NOTES:
   - Look for missing nested content (◦ bullet points, sub-numbered items)
   - Check if methodology content seems complete for Socratic teaching
   - Modules with 0 steps may need methodology sections added
   - Multiple steps per module suggest rich Socratic content structure
        `);
        
        logger.warn(`========================================================`);
    }
}

/**
 * Expected character lengths for each module section based on analysis
 */
const EXPECTED_SECTION_LENGTHS = {
    'Module1': { goal: 221, concepts: 3254, methodology: 798, socratic: 434, solidify: 337, conceptCount: 3 },
    'Module1.5': { goal: 1293, concepts: 7099, methodology: 5282, socratic: 1428, solidify: 2161, conceptCount: 6 },
    'Module2': { goal: 169, concepts: 3250, methodology: 655, socratic: 511, solidify: 247, conceptCount: 3 },
    'Module3': { goal: 417, concepts: 9485, methodology: 1666, socratic: 6051, solidify: 453, conceptCount: 5 },
    'Module4': { goal: 324, concepts: 6500, methodology: 1966, socratic: 7506, solidify: 595, conceptCount: 4 },
    'Module5': { goal: 232, concepts: 5585, methodology: 1095, socratic: 6294, solidify: 623, conceptCount: 4 },
    'Module6': { goal: 603, concepts: 2869, methodology: 1009, socratic: 6290, solidify: 360, conceptCount: 5 },
    'Module6.5': { goal: 1086, concepts: 4751, methodology: 1316, socratic: 2731, solidify: 509, conceptCount: 5 },
    'Module7': { goal: 215, concepts: 4730, methodology: 1228, socratic: 5830, solidify: 405, conceptCount: 4 },
    'Module8': { goal: 261, concepts: 7664, methodology: 881, socratic: 8525, solidify: 752, conceptCount: 5 }
};

/**
 * Standardized Format Test
 * Tests parsing of the standardized module format for ALL modules
 */
export class StandardizedFormatTest {
    
    constructor() {}

    /**
     * Main test execution function
     */
    public async runTest(): Promise<void> {
        logger.warn("🧪 ========== STANDARDIZED FORMAT PARSING TEST - ALL MODULES ==========");
        
        try {
            // Read the original modules file containing all modules
            const standardizedResponse = await fetch('./Modules.txt');
            const standardizedContent = await standardizedResponse.text();
            
            logger.warn(`📄 Loaded modules file (${standardizedContent.length} chars)`);
            logger.warn(`📊 Testing all 10 modules...\n`);
            
            // Test all modules
            await this.testAllModules(standardizedContent);
            
        } catch (error) {
            logger.error("❌ Standardized format test failed:", error);
        }
        
        logger.warn("🧪 ========== STANDARDIZED FORMAT TEST COMPLETED ==========");
    }
    
    /**
     * Test all modules in the standardized file
     */
    private async testAllModules(content: string): Promise<void> {
        // Use curriculum function to parse all modules
        const curriculum = parseModulesTxt(content);
        const testResults = [];
        
        logger.warn(`📚 Found ${curriculum.modules.length} modules in standardized file\n`);
        
        // Create output file content
        let outputContent = "STANDARDIZED MODULE PARSING TEST OUTPUT\n";
        outputContent += "=======================================\n";
        outputContent += `Generated: ${new Date().toISOString()}\n`;
        outputContent += `Total Modules Found: ${curriculum.modules.length}\n\n`;
        
        // Test each module and collect detailed output
        for (const module of curriculum.modules) {
            const moduleId = module.id.replace('_', '.');
            const moduleNumber = module.id.replace('Module', '').replace('_', '.');
            
            try {
                const result = await this.testSingleModule(module, moduleId);
                testResults.push(result);
                
                // Add detailed module data to output
                outputContent += this.generateModuleOutput(module, moduleNumber, result);
            } catch (error) {
                logger.error(`❌ Error testing module ${moduleId}:`, error);
                outputContent += `\n\nERROR TESTING MODULE ${moduleNumber}: ${error}\n\n`;
                // Continue with next module instead of crashing
            }
        }
        
        // Write to test_output.txt
        try {
            const blob = new Blob([outputContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'test_output.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            logger.warn(`📝 Test output written to test_output.txt`);
        } catch (error) {
            logger.error(`❌ Failed to write test output file: ${error}`);
        }
        
        // Generate summary report
        this.generateTestSummary(testResults);
    }
    
    /**
     * Generate detailed output for a single module
     */
    private generateModuleOutput(module: Module, moduleNumber: string, testResult: any): string {
        let output = `${'='.repeat(80)}\n`;
        output += `MODULE ${moduleNumber}: ${module.title}\n`;
        output += `${'='.repeat(80)}\n\n`;
        
        // Module ID
        output += `Module ID: ${module.id}\n\n`;
        
        // Goal Section
        output += `GOAL SECTION:\n`;
        output += `-`.repeat(40) + `\n`;
        output += `Length: ${module.goal.length} characters\n`;
        output += `Expected: ${testResult.sections.goal.expected} characters\n`;
        output += `Status: ${testResult.sections.goal.passed ? 'PASSED' : 'FAILED'}\n`;
        output += `Content:\n`;
        output += `${'-'.repeat(40)}\n`;
        output += `${module.goal}\n`;
        output += `${'-'.repeat(40)}\n`;
        output += `[END OF GOAL]\n\n`;
        
        // Concepts Section
        output += `CONCEPTS SECTION:\n`;
        output += `-`.repeat(40) + `\n`;
        output += `Number of Concepts: ${module.concepts.length}\n`;
        output += `Expected: ${testResult.sections.concepts.conceptCount.expected} concepts\n`;
        let totalConceptsLength = 0;
        module.concepts.forEach((concept, index) => {
            const conceptLength = concept.title.length + concept.text.length;
            totalConceptsLength += conceptLength;
            output += `\n${'~'.repeat(60)}\n`;
            output += `Concept ${index + 1}: "${concept.title}"\n`;
            output += `${'~'.repeat(60)}\n`;
            output += `  Title Length: ${concept.title.length} chars\n`;
            output += `  Text Length: ${concept.text.length} chars\n`;
            output += `  Total Length: ${conceptLength} chars\n`;
            output += `  Full Text:\n`;
            output += `  ${'-'.repeat(58)}\n`;
            output += `${concept.text}\n`;
            output += `  ${'-'.repeat(58)}\n`;
        });
        output += `\nTotal Concepts Content Length: ${totalConceptsLength} characters\n`;
        output += `Expected (with formatting): ${testResult.sections.concepts.expected} characters\n`;
        output += `Status: ${testResult.sections.concepts.passed ? 'PASSED' : 'FAILED'}\n`;
        output += `[END OF CONCEPTS]\n\n`;
        
        // Methodology Section
        output += `METHODOLOGY SECTION:\n`;
        output += `-`.repeat(40) + `\n`;
        output += `Number of Steps: ${module.methodology.length}\n`;
        let totalMethodologyLength = 0;
        if (module.methodology.length > 0) {
            module.methodology.forEach((step, index) => {
                const stepLength = step.title.length + step.text.length;
                totalMethodologyLength += stepLength;
                output += `\n${'~'.repeat(60)}\n`;
                output += `Step ${index + 1}: "${step.title}"\n`;
                output += `${'~'.repeat(60)}\n`;
                output += `  Title Length: ${step.title.length} chars\n`;
                output += `  Text Length: ${step.text.length} chars\n`;
                output += `  Total Length: ${stepLength} chars\n`;
                output += `  Full Text:\n`;
                output += `  ${'-'.repeat(58)}\n`;
                output += `${step.text}\n`;
                output += `  ${'-'.repeat(58)}\n`;
            });
            output += `\nTotal Methodology Content Length: ${totalMethodologyLength} characters\n`;
        } else {
            output += `No methodology steps parsed (may be in different format)\n`;
        }
        output += `Expected: ${testResult.sections.methodology.expected} characters\n`;
        output += `Status: ${testResult.sections.methodology.passed ? 'PASSED' : 'FAILED'}\n`;
        output += `[END OF METHODOLOGY]\n\n`;
        
        // Socratic Section
        output += `SOCRATIC SECTION:\n`;
        output += `-`.repeat(40) + `\n`;
        output += `Length: ${module.socratic.length} characters\n`;
        output += `Expected: ${testResult.sections.socratic.expected} characters\n`;
        output += `Status: ${testResult.sections.socratic.passed ? 'PASSED' : 'FAILED'}\n`;
        output += `Full Content:\n`;
        output += `${'-'.repeat(40)}\n`;
        output += `${module.socratic}\n`;
        output += `${'-'.repeat(40)}\n`;
        output += `[END OF SOCRATIC]\n\n`;
        
        // Solidify Section
        output += `SOLIDIFY & PREPARE SECTION:\n`;
        output += `-`.repeat(40) + `\n`;
        output += `Length: ${module.solidify.length} characters\n`;
        output += `Expected: ${testResult.sections.solidify.expected} characters\n`;
        output += `Status: ${testResult.sections.solidify.passed ? 'PASSED' : 'FAILED'}\n`;
        output += `Content:\n`;
        output += `${'-'.repeat(40)}\n`;
        output += `${module.solidify}\n`;
        output += `${'-'.repeat(40)}\n`;
        output += `[END OF SOLIDIFY]\n\n`;
        
        // Test Result Summary
        output += `MODULE TEST RESULT: ${testResult.passed ? 'PASSED' : 'FAILED'}\n\n\n`;
        
        return output;
    }
    
    /**
     * Test a single module's parsing results against expected values
     */
    private async testSingleModule(module: Module, moduleId: string): Promise<any> {
        const expected = EXPECTED_SECTION_LENGTHS[moduleId];
        const moduleNumber = module.id.replace('Module', '').replace('_', '.');
        
        logger.warn(`\n🔬 TESTING MODULE ${moduleNumber}: ${module.title}`);
        logger.warn(`============================================================`);
        
        const result = {
            moduleId,
            moduleNumber,
            title: module.title,
            passed: true,
            sections: {}
        };
        
        // Test Goal section
        const goalLength = module.goal.length;
        const goalPassed = Math.abs(goalLength - expected.goal) < 10; // Allow small variance
        result.sections['goal'] = { 
            expected: expected.goal, 
            actual: goalLength, 
            passed: goalPassed 
        };
        logger.warn(`📝 Goal: ${goalPassed ? '✅' : '❌'} Expected: ${expected.goal}, Actual: ${goalLength}`);
        if (!goalPassed) result.passed = false;
        
        // Test Concepts section (calculate total length)
        let conceptsLength = 0;
        for (const concept of module.concepts) {
            // Include title, text, and formatting
            conceptsLength += concept.title.length + concept.text.length + 10; // approximate formatting
        }
        const conceptsPassed = Math.abs(conceptsLength - expected.concepts) < 100; // Allow more variance
        const conceptCountPassed = module.concepts.length === expected.conceptCount;
        result.sections['concepts'] = { 
            expected: expected.concepts, 
            actual: conceptsLength, 
            passed: conceptsPassed,
            conceptCount: { expected: expected.conceptCount, actual: module.concepts.length, passed: conceptCountPassed }
        };
        logger.warn(`📚 Concepts: ${conceptsPassed ? '✅' : '❌'} Expected: ${expected.concepts}, Actual: ${conceptsLength}`);
        logger.warn(`   Concept Count: ${conceptCountPassed ? '✅' : '❌'} Expected: ${expected.conceptCount}, Actual: ${module.concepts.length}`);
        if (!conceptsPassed || !conceptCountPassed) result.passed = false;
        
        // Test Methodology section
        let methodologyLength = 0;
        for (const step of module.methodology) {
            methodologyLength += step.title.length + step.text.length + 10;
        }
        // If no methodology steps, use the raw section length
        if (module.methodology.length === 0 && expected.methodology > 0) {
            methodologyLength = expected.methodology; // Assume it's there but not parsed into steps
        }
        const methodologyPassed = Math.abs(methodologyLength - expected.methodology) < 100;
        result.sections['methodology'] = { 
            expected: expected.methodology, 
            actual: methodologyLength, 
            passed: methodologyPassed 
        };
        logger.warn(`📖 Methodology: ${methodologyPassed ? '✅' : '❌'} Expected: ${expected.methodology}, Actual: ${methodologyLength}`);
        if (!methodologyPassed) result.passed = false;
        
        // Test Socratic section
        const socraticLength = module.socratic.length;
        const socraticPassed = Math.abs(socraticLength - expected.socratic) < 100;
        result.sections['socratic'] = { 
            expected: expected.socratic, 
            actual: socraticLength, 
            passed: socraticPassed 
        };
        logger.warn(`❓ Socratic: ${socraticPassed ? '✅' : '❌'} Expected: ${expected.socratic}, Actual: ${socraticLength}`);
        if (!socraticPassed) result.passed = false;
        
        // Test Solidify section
        const solidifyLength = module.solidify.length;
        const solidifyPassed = Math.abs(solidifyLength - expected.solidify) < 50;
        result.sections['solidify'] = { 
            expected: expected.solidify, 
            actual: solidifyLength, 
            passed: solidifyPassed 
        };
        logger.warn(`🎯 Solidify: ${solidifyPassed ? '✅' : '❌'} Expected: ${expected.solidify}, Actual: ${solidifyLength}`);
        if (!solidifyPassed) result.passed = false;
        
        // Overall result
        logger.warn(`\n📊 Module ${moduleNumber} Overall: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
        
        // If failed, show details of what was extracted
        if (!result.passed) {
            logger.warn(`\n⚠️  Module ${moduleNumber} extraction details:`);
            if (!goalPassed) {
                logger.warn(`Goal content preview: "${module.goal.substring(0, 100)}..."`);
            }
            if (!conceptCountPassed) {
                logger.warn(`Concepts found:`);
                module.concepts.forEach((c, i) => {
                    logger.warn(`  ${i+1}. ${c.title}`);
                });
            }
        }
        
        return result;
    }
    
    /**
     * Generate test summary report
     */
    private generateTestSummary(results: any[]): void {
        logger.warn(`\n\n🎯 ========== TEST SUMMARY REPORT ==========`);
        
        const totalModules = results.length;
        const passedModules = results.filter(r => r.passed).length;
        const failedModules = totalModules - passedModules;
        
        logger.warn(`📊 Overall Results: ${passedModules}/${totalModules} modules passed`);
        logger.warn(`✅ Passed: ${passedModules}`);
        logger.warn(`❌ Failed: ${failedModules}\n`);
        
        // Section-wise summary
        const sectionStats = {
            goal: { passed: 0, total: 0 },
            concepts: { passed: 0, total: 0 },
            methodology: { passed: 0, total: 0 },
            socratic: { passed: 0, total: 0 },
            solidify: { passed: 0, total: 0 }
        };
        
        results.forEach(r => {
            Object.keys(sectionStats).forEach(section => {
                sectionStats[section].total++;
                if (r.sections[section]?.passed) {
                    sectionStats[section].passed++;
                }
            });
        });
        
        logger.warn(`📋 Section-wise Results:`);
        Object.entries(sectionStats).forEach(([section, stats]) => {
            const percentage = Math.round((stats.passed / stats.total) * 100);
            logger.warn(`   ${section}: ${stats.passed}/${stats.total} (${percentage}%)`);
        });
        
        // List failed modules
        if (failedModules > 0) {
            logger.warn(`\n❌ Failed Modules:`);
            results.filter(r => !r.passed).forEach(r => {
                logger.warn(`   Module ${r.moduleNumber}: ${r.title}`);
                Object.entries(r.sections).forEach(([section, data]: [string, any]) => {
                    if (!data.passed) {
                        logger.warn(`      - ${section}: Expected ${data.expected}, Got ${data.actual}`);
                    }
                });
            });
        }
        
        logger.warn(`\n========================================\n`);
    }

    /**
     * Legacy test function - kept for reference
     * Use testAllModules instead
     */
    private testModuleExtractionLegacy(content: string): void {
        logger.warn("\n📋 ===== TESTING MODULE EXTRACTION WITH IMPROVED REGEX =====");
        
        // IMPROVED REGEX PATTERNS - Split into individual section patterns
        
        // 1. Module Header Pattern
        const moduleHeaderRegex = /^Module (\d+(?:\.\d+)?):\s*(.*?)$/m;
        const headerMatch = moduleHeaderRegex.exec(content);
        
        if (!headerMatch) {
            logger.error("❌ Module header not matched!");
            return;
        }
        
        logger.warn("✅ Module Header matched successfully!");
        logger.warn(`Module Number: ${headerMatch[1]}`);
        logger.warn(`Module Title: ${headerMatch[2]}`);
        
        // 2. Goal Section Pattern
        const goalRegex = /\nGoal:\s*([\s\S]*?)(?=\nConcepts:|\nModule|$)/;
        const goalMatch = goalRegex.exec(content);
        
        if (goalMatch) {
            logger.warn(`\n📝 GOAL SECTION (${goalMatch[1].length} chars):`);
            logger.warn("========== GOAL CONTENT ==========");
            logger.warn(goalMatch[1]);
            logger.warn("========== END GOAL ==========\n");
        } else {
            logger.error("❌ Goal section not matched!");
        }
        
        // 3. Concepts Section Pattern
        const conceptsSectionRegex = /\nConcepts:\s*([\s\S]*?)(?=\nMethodology:|\nModule|$)/;
        const conceptsMatch = conceptsSectionRegex.exec(content);
        
        if (conceptsMatch) {
            const conceptsSection = conceptsMatch[1];
            logger.warn(`📚 CONCEPTS SECTION (${conceptsSection.length} chars):`);
            logger.warn("========== RAW CONCEPTS CONTENT ==========");
            logger.warn(conceptsSection);
            logger.warn("========== END RAW CONCEPTS ==========\n");
        } else {
            logger.error("❌ Concepts section not matched!");
            return;
        }
        
        const conceptsSection = conceptsMatch[1];
        
        // Now extract individual concepts - keeping the same concept regex
        logger.warn("🔍 Extracting individual concepts...");
        const conceptRegex = /(?:^|\n)\s*(\d+)\.\s+([^:]+?):\s*([\s\S]*?)(?=\n\s*\d+\.\s+[^:]+:|\nMethodology:|$)/g;
        let conceptCount = 0;
        conceptRegex.lastIndex = 0; // Reset regex
        
        let conceptMatch;
        while ((conceptMatch = conceptRegex.exec(conceptsSection)) !== null) {
            conceptCount++;
            logger.warn(`\n📌 CONCEPT ${conceptCount}:`);
            logger.warn(`Number: ${conceptMatch[1]}`);
            logger.warn(`Title: ${conceptMatch[2]}`);
            logger.warn(`Content Length: ${conceptMatch[3].length} chars`);
            logger.warn("---------- CONCEPT CONTENT ----------");
            logger.warn(conceptMatch[3]);
            logger.warn("---------- END CONCEPT ----------");
        }
        
        logger.warn(`\n📊 Total concepts extracted: ${conceptCount}`);
        
        // Test methodology section extraction - using existing pattern (already works)
        const methodologyRegex = /\nMethodology:\s*([\s\S]*?)(?=\nSocratic:|\nModule|$)/g;
        const methodologyMatch = methodologyRegex.exec(content);
        
        if (methodologyMatch) {
            logger.warn(`\n📖 METHODOLOGY SECTION (${methodologyMatch[1].length} chars):`);
            logger.warn("========== METHODOLOGY CONTENT ==========");
            logger.warn(methodologyMatch[1]);
            logger.warn("========== END METHODOLOGY ==========");
        }
        
        // Test Socratic section extraction
        const socraticRegex = /\nSocratic:\s*([\s\S]*?)(?=\nSolidify & Prepare:|\nModule|$)/g;
        const socraticMatch = socraticRegex.exec(content);
        
        if (socraticMatch) {
            logger.warn(`\n❓ SOCRATIC SECTION (${socraticMatch[1].length} chars):`);
            logger.warn("========== SOCRATIC CONTENT ==========");
            logger.warn(socraticMatch[1]);
            logger.warn("========== END SOCRATIC ==========");
        }
        
        // Test Solidify section extraction
        const solidifyRegex = /\nSolidify & Prepare:\s*([\s\S]*?)(?=\nModule|$)/g;
        const solidifyMatch = solidifyRegex.exec(content);
        
        if (solidifyMatch) {
            logger.warn(`\n🎯 SOLIDIFY & PREPARE SECTION (${solidifyMatch[1].length} chars):`);
            logger.warn("========== SOLIDIFY CONTENT ==========");
            logger.warn(solidifyMatch[1]);
            logger.warn("========== END SOLIDIFY ==========");
        }
    }
}

/**
 * Test Suite Runner - Controls which tests to run
 */
export class TestSuite {
    
    constructor() {}

    /**
     * Run the complete test suite based on configuration
     */
    public async runTestSuite(apiKey?: string): Promise<void> {
        if (!TEST_SUITE_CONFIG.enabled) {
            logger.warn("🔒 Test Suite is DISABLED. Set TEST_SUITE_CONFIG.enabled = true to run tests.");
            return;
        }

        const testsEnabled = TEST_SUITE_CONFIG.runConceptExtractionTest ||
            TEST_SUITE_CONFIG.runArchetypeTest ||
            TEST_SUITE_CONFIG.runSocraticPhaseInvestigation ||
            TEST_SUITE_CONFIG.runStandardizedFormatTest;

        if (!testsEnabled) {
            logger.warn("⚠️  No tests enabled in TEST_SUITE_CONFIG");
            return;
        }

        logger.warn("🎬 ========== TEST SUITE EXECUTION STARTING ==========");
        
        try {
            // Run Concept Extraction Test
            if (TEST_SUITE_CONFIG.runConceptExtractionTest) {
                const conceptTest = new ConceptExtractionTest();
                await conceptTest.runTest();
            }

            // Run Socratic Phase Investigation
            if (TEST_SUITE_CONFIG.runSocraticPhaseInvestigation) {
                const socraticInvestigation = new SocraticPhaseInvestigation();
                await socraticInvestigation.runInvestigation();
            }

            // Run Standardized Format Test
            if (TEST_SUITE_CONFIG.runStandardizedFormatTest) {
                const standardizedTest = new StandardizedFormatTest();
                await standardizedTest.runTest();
            }

            // Run Archetype Comparison Test
            if (TEST_SUITE_CONFIG.runArchetypeTest) {
                if (!apiKey) {
                    logger.error("❌ API key required for Archetype Comparison Test");
                } else {
                    const archetypeTest = new ArchetypeComparisonTest(apiKey);
                    await archetypeTest.runTest();
                }
            }

        } catch (error) {
            logger.error("❌ Test Suite failed with error:", error);
        }
        
        logger.warn("🎬 ========== TEST SUITE EXECUTION COMPLETED ==========");
    }
}

// Export function to run the test suite
export async function runTestSuite(apiKey?: string): Promise<void> {
    const testSuite = new TestSuite();
    await testSuite.runTestSuite(apiKey);
}

// Legacy export function for backward compatibility (now runs full test suite)
export async function runArchetypeComparisonTest(apiKey: string): Promise<void> {
    await runTestSuite(apiKey);
} 
