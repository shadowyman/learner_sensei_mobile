const fs = require('fs');

// Read the file
const content = fs.readFileSync('/Users/aligunes/Documents/sensei_files_20250615_204052/Modules_Standardized.txt', 'utf8');

// Split content into modules
const modulePattern = /^Module (\d+(?:\.\d+)?):\s*(.*?)$/gm;
const modules = [];
let match;
let lastIndex = 0;

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
    
    // Extract sections using the provided regex patterns
    // Updated to handle variations like "Concepts (" in Module 6
    const goalMatch = moduleContent.match(/\nGoal:\s*([\s\S]*?)(?=\n(?:Introduction:|Concepts[:\s\(])|$)/);
    const introMatch = moduleContent.match(/\nIntroduction:\s*([\s\S]*?)(?=\nConcepts[:\s\(]|$)/);
    const conceptsMatch = moduleContent.match(/\nConcepts[:\s\(][^:]*:\s*([\s\S]*?)(?=\nMethodology:|$)/);
    const methodologyMatch = moduleContent.match(/\nMethodology:\s*([\s\S]*?)(?=\nSocratic:|$)/);
    const socraticMatch = moduleContent.match(/\nSocratic:\s*([\s\S]*?)(?=\nSolidify & Prepare:|$)/);
    const solidifyMatch = moduleContent.match(/\nSolidify & Prepare:\s*([\s\S]*?)(?=\nModule|$)/);
    
    // Get section content and calculate lengths
    const goal = goalMatch ? goalMatch[1].trim() : '';
    const intro = introMatch ? introMatch[1].trim() : '';
    const concepts = conceptsMatch ? conceptsMatch[1].trim() : '';
    const methodology = methodologyMatch ? methodologyMatch[1].trim() : '';
    const socratic = socraticMatch ? socraticMatch[1].trim() : '';
    const solidify = solidifyMatch ? solidifyMatch[1].trim() : '';
    
    // For modules where Introduction is present, combine it with Goal
    const fullGoal = intro ? goal + '\n' + intro : goal;
    
    // Count concepts (look for numbered items in concepts section)
    const conceptPattern = /^\s*\d+\.\s+/gm;
    const conceptMatches = concepts.match(conceptPattern);
    const conceptCount = conceptMatches ? conceptMatches.length : 0;
    
    modules.push({
        number: currentModule.number,
        title: currentModule.title,
        goalLength: fullGoal.length,
        conceptsLength: concepts.length,
        methodologyLength: methodology.length,
        socraticLength: socratic.length,
        solidifyLength: solidify.length,
        conceptCount: conceptCount
    });
}

// Create table header
console.log('| Module | Title | Goal | Concepts | Methodology | Socratic | Solidify & Prepare | Concept Count |');
console.log('|--------|-------|------|----------|-------------|----------|-------------------|---------------|');

// Output results in table format
modules.forEach(module => {
    console.log(`| ${module.number} | ${module.title} | ${module.goalLength} | ${module.conceptsLength} | ${module.methodologyLength} | ${module.socraticLength} | ${module.solidifyLength} | ${module.conceptCount} |`);
});

// Also output as JSON for easier processing
console.log('\n\nJSON Output:');
console.log(JSON.stringify(modules, null, 2));