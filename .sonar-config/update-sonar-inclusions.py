#!/usr/bin/env python3

import json
import re

def update_sonar_inclusions():
    """Update sonar-project.properties with inclusions from file-manifest.json"""
    
    try:
        # Read file manifest
        with open('file-manifest.json', 'r') as f:
            manifest = json.load(f)
        
        # Create inclusion patterns
        inclusions = []
        
        # Add direct file names
        inclusions.extend(manifest)
        
        # Add files in any subdirectory
        inclusions.extend([f"**/{file}" for file in manifest])
        
        # Add additional patterns
        inclusions.extend([
            '**/*.json',          # All JSON files
            'server/**/*.ts',     # TypeScript in server
            'module/**/*.txt'     # Text files in module
        ])
        
        # Create inclusion string
        inclusion_string = ','.join(inclusions)
        
        # Read sonar properties
        with open('.sonar-config/sonar-project.properties', 'r') as f:
            content = f.read()
        
        # Update or add sonar.inclusions
        if 'sonar.inclusions=' in content:
            # Update existing
            content = re.sub(
                r'sonar\.inclusions=.*',
                f'sonar.inclusions={inclusion_string}',
                content
            )
        else:
            # Add after exclusions
            content = re.sub(
                r'(sonar\.exclusions=.*\n)',
                f'\\1sonar.inclusions={inclusion_string}\n',
                content
            )
        
        # Write back
        with open('.sonar-config/sonar-project.properties', 'w') as f:
            f.write(content)
        
        print(f'✅ Updated sonar-project.properties with {len(manifest)} files from manifest')
        print('\nInclusion patterns:')
        for pattern in inclusions[:10]:  # Show first 10
            print(f'  - {pattern}')
        if len(inclusions) > 10:
            print(f'  ... and {len(inclusions) - 10} more patterns')
            
    except Exception as e:
        print(f'❌ Error: {e}')
        exit(1)

if __name__ == '__main__':
    update_sonar_inclusions()