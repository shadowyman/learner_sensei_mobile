#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read file manifest
const manifestPath = './file-manifest.json';
const sonarPropertiesPath = './.sonar-config/sonar-project.properties';

try {
  // Read the manifest
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Convert file list to sonar inclusion pattern
  // Only include files from manifest - no additional wildcard patterns
  const inclusions = [
    ...manifest.map(file => file), // Direct file names
    ...manifest.map(file => `**/${file}`) // Files in any subdirectory
  ];
  
  // Create the inclusion string
  const inclusionString = inclusions.join(',');
  
  // Read current sonar properties
  let sonarProperties = fs.readFileSync(sonarPropertiesPath, 'utf8');
  
  // Update or add sonar.inclusions
  if (sonarProperties.includes('sonar.inclusions=')) {
    // Update existing
    sonarProperties = sonarProperties.replace(
      /sonar\.inclusions=.*/,
      `sonar.inclusions=${inclusionString}`
    );
  } else {
    // Add after exclusions
    sonarProperties = sonarProperties.replace(
      /(sonar\.exclusions=.*\n)/,
      `$1sonar.inclusions=${inclusionString}\n`
    );
  }
  
  // Write back
  fs.writeFileSync(sonarPropertiesPath, sonarProperties);
  
  console.log('✅ Updated sonar-project.properties with inclusions from file-manifest.json');
  console.log(`📋 Added ${manifest.length} files from manifest`);
  console.log('\nInclusion patterns:');
  inclusions.forEach(pattern => console.log(`  - ${pattern}`));
  
} catch (error) {
  console.error('❌ Error updating sonar inclusions:', error.message);
  process.exit(1);
}