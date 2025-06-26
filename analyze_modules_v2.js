const fs = require('fs');

// Read the file
const content = fs.readFileSync('/Users/aligunes/Documents/sensei_files_20250615_204052/Modules_Standardized.txt', 'utf8');

// Split content into modules
const modulePattern = /^Module (\d+(?:\.\d+)?):\s*(.*?)$/gm;
const modules = [];
let match;

// Find all module headers and their positions
const moduleMatches = [];
while ((match = modulePattern.exec(content)) !== null) {
    moduleMatches.push({
        fullMatch: match[0],
        number: match[1],
        title: match[2],
        index: match.index
    });
}

// Process each module
for (let i = 0; i < moduleMatches.length; i++) {
    const currentModule = moduleMatches[i];
    const startIndex = currentModule.index;
    const endIndex = (i < moduleMatches.length - 1) ? moduleMatches[i + 1].index : content.length;
    const moduleContent = content.substring(startIndex, endIndex);
    
    // Debug: Check if this is Module 6 or 6.5
    if (currentModule.number === '6' || currentModule.number === '6.5') {
        console.error(`\nDEBUG Module ${currentModule.number}:`);
        console.error('First 500 chars after header:');
        console.error(moduleContent.substring(0, 500));
        console.error('---');
    }
    
    // Extract sections - handle variations in structure
    let goal = '';
    let concepts = '';
    let methodology = '';
    let socratic = '';
    let solidify = '';
    
    // For Module 6 and 6.5, the structure includes Introduction after Goal
    if (moduleContent.includes('\nIntroduction:')) {
        // Extract Goal up to Introduction
        const goalMatch = moduleContent.match(/\nGoal:\s*([\s\S]*?)(?=\nIntroduction:|$)/);
        const introMatch = moduleContent.match(/\nIntroduction:\s*([\s\S]*?)(?=\nConcepts|$)/);
        
        if (goalMatch) goal = goalMatch[1].trim();
        if (introMatch) goal = goal + '\nIntroduction: ' + introMatch[1].trim();
        
        // Look for Concepts with various patterns
        const conceptsMatch = moduleContent.match(/\nConcepts(?:\s*\([^)]*\))?[:\s]*\n([\s\S]*?)(?=\nMethodology:|$)/);
        if (conceptsMatch) concepts = conceptsMatch[1].trim();
    } else {
        // Standard structure
        const goalMatch = moduleContent.match(/\nGoal:\s*([\s\S]*?)(?=\nConcepts:|$)/);
        const conceptsMatch = moduleContent.match(/\nConcepts:\s*([\s\S]*?)(?=\nMethodology:|$)/);
        
        if (goalMatch) goal = goalMatch[1].trim();
        if (conceptsMatch) concepts = conceptsMatch[1].trim();
    }
    
    // Extract remaining sections (same for all modules)
    const methodologyMatch = moduleContent.match(/\nMethodology:\s*([\s\S]*?)(?=\nSocratic:|$)/);
    const socraticMatch = moduleContent.match(/\nSocratic:\s*([\s\S]*?)(?=\nSolidify & Prepare:|$)/);
    const solidifyMatch = moduleContent.match(/\nSolidify & Prepare:\s*([\s\S]*?)(?=\n(?:Module|$))/);
    
    if (methodologyMatch) methodology = methodologyMatch[1].trim();
    if (socraticMatch) socratic = socraticMatch[1].trim();
    if (solidifyMatch) solidify = solidifyMatch[1].trim();
    
    // Count concepts (look for numbered items in concepts section)
    const conceptPattern = /^\s*\d+\.\s+/gm;
    const conceptMatches = concepts.match(conceptPattern);
    const conceptCount = conceptMatches ? conceptMatches.length : 0;
    
    modules.push({
        number: currentModule.number,
        title: currentModule.title,
        goalLength: goal.length,
        conceptsLength: concepts.length,
        methodologyLength: methodology.length,
        socraticLength: socratic.length,
        solidifyLength: solidify.length,
        conceptCount: conceptCount
    });
}

// Create table header
console.log('\n\n| Module | Title | Goal | Concepts | Methodology | Socratic | Solidify & Prepare | Concept Count |');
console.log('|--------|-------|------|----------|-------------|----------|-------------------|---------------|');

// Output results in table format
modules.forEach(module => {
    console.log(`| ${module.number} | ${module.title} | ${module.goalLength} | ${module.conceptsLength} | ${module.methodologyLength} | ${module.socraticLength} | ${module.solidifyLength} | ${module.conceptCount} |`);
});

// Also output as JSON for easier processing
console.log('\n\nJSON Output:');
console.log(JSON.stringify(modules, null, 2));