# SonarQube Configuration

This directory contains all SonarQube-related configuration files.

## Structure

```
.sonar-config/
├── sonar.sh                      # Main script to run SonarQube analysis
├── sonar-project.properties      # SonarQube project configuration
├── update-sonar-inclusions.js    # Updates inclusions from file-manifest.json
├── update-sonar-inclusions.py    # Python version of the update script
├── check-sonar-permissions.sh    # Utility to check SonarQube permissions
└── sonar-project-example.properties  # Example configurations

Root directory:
├── sonar -> .sonar-config/sonar.sh  # Symlink for easy access
└── sonar-project.properties -> .sonar-config/sonar-project.properties  # Symlink
```

## Usage

Run analysis:
```bash
./sonar
```

Or via npm:
```bash
npm run sonar
```

## Options

- `./sonar --disable-auth` - Disable authentication (one-time setup)
- `./sonar --stop` - Stop SonarQube server

## Configuration

The file inclusions are automatically generated from `file-manifest.json` in the root directory.

To modify which files are analyzed:
1. Edit `file-manifest.json`
2. Run `./sonar` (it automatically updates the configuration)

## Files

- **sonar-project.properties**: Main configuration file
- **sonar.sh**: Main script that handles everything
- **update-sonar-inclusions.js**: Reads file-manifest.json and updates inclusions

## SonarQube Server

The script expects SonarQube to be installed at:
`/Users/aligunes/Downloads/sonarqube-25.6.0.109173`

To change this, edit the `SONAR_HOME` variable in `sonar.sh`.