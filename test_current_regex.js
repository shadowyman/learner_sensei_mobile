const fs = require('fs');

// Test the current regex on whole Modules.txt
function testCurrentRegex() {
    const modulesTxt = fs.readFileSync('./Modules.txt', 'utf-8');
    
    // Current regex from curriculum.ts
    const moduleRegex = /^Module (\d+(?:\.\d+)?):\s*(.*?)\n[\s\S]*?Goal:\s*([\s\S]*?)\nConcepts[\s\S]*?:\s*([\s\S]*?)(?=\nMethodology:|\nModule|$)/gim;
    const conceptRegex = /(?:^|\n)\s*(\d+)\.\s+([^:]+?):\s*([\s\S]*?)(?=\n\s*\d+\.\s+[^:]+:|\nMethodology:|$)/g;
    
    let output = "=== CURRENT REGEX TEST OUTPUT ===\n\n";
    
    let moduleMatch;
    while ((moduleMatch = moduleRegex.exec(modulesTxt)) !== null) {
        const moduleNumber = moduleMatch[1];
        const moduleTitle = moduleMatch[2].trim().replace(/\s*\(Version.*?\)/i, '');
        const moduleGoal = moduleMatch[3].trim();
        const conceptsSection = moduleMatch[4];
        
        output += `Module ${moduleNumber}: ${moduleTitle}\n`;
        output += `Goal: ${moduleGoal}\n`;
        output += `Concepts:\n`;
        
        // Reset concept regex
        conceptRegex.lastIndex = 0;
        
        let conceptMatch;
        while ((conceptMatch = conceptRegex.exec(conceptsSection)) !== null) {
            const conceptNum = conceptMatch[1];
            const conceptTitle = conceptMatch[2].trim();
            const conceptText = conceptMatch[3].trim();
            
            output += `  ${conceptNum}. ${conceptTitle}\n`;
            output += `     Content length: ${conceptText.length} chars\n`;
            output += `     Content: ${conceptText}\n\n`;
        }
        
        output += "\n" + "=".repeat(80) + "\n\n";
    }
    
    // Write to file
    fs.writeFileSync('./current_regex_output.txt', output);
    console.log("Output written to: current_regex_output.txt");
}

testCurrentRegex();