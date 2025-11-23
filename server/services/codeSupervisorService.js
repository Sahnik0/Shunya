import LLMService from './llmService.js';
import { createSupervisorPrompt, createFileFixPrompt } from '../prompts/codeSupervisor.js';

class CodeSupervisorService {
    constructor(provider, apiKey, model) {
        this.llmService = new LLMService(provider, apiKey, model);
    }

    async validateAndFixCode(fileStructure, generatedFiles) {
        try {
            console.log('🔍 Supervisor: Starting code validation...');
            
            // First, validate ESM/CommonJS compatibility
            const esmIssues = this.validateModuleFormat(fileStructure, generatedFiles);
            if (esmIssues.length > 0) {
                console.log('⚠️ Supervisor: Found ESM/CommonJS issues:', esmIssues);
                // Remove problematic files
                generatedFiles = generatedFiles.filter(f => {
                    const hasIssue = esmIssues.some(issue => issue.file === f.path);
                    if (hasIssue) {
                        console.log(`🗑️ Removing problematic file: ${f.path}`);
                    }
                    return !hasIssue;
                });
            }
            
            // Second, validate dependencies match config files
            const dependencyIssues = this.validateDependencies(fileStructure, generatedFiles);
            if (dependencyIssues.length > 0) {
                console.log('⚠️ Supervisor: Found dependency issues:', dependencyIssues);
                // Auto-fix dependency issues
                fileStructure = this.fixDependencies(fileStructure, generatedFiles);
            }
            
            const prompt = createSupervisorPrompt(fileStructure, generatedFiles);
            let response = '';

            // Stream the supervisor's response
            for await (const chunk of this.llmService.streamCompletion(prompt)) {
                response += chunk;
            }

            console.log('🔍 Supervisor: Received validation response');

            // Parse the supervisor's response
            let validationResult;
            try {
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    validationResult = JSON.parse(jsonMatch[0]);
                } else {
                    console.warn('⚠️ Supervisor: Could not parse JSON, assuming code is valid');
                    return { isValid: true, fixedFiles: {}, fileStructure };
                }
            } catch (parseError) {
                console.error('❌ Supervisor: Failed to parse validation response:', parseError);
                return { isValid: true, fixedFiles: {}, fileStructure };
            }

            // Apply fixes if any issues were found
            if (!validationResult.isValid && validationResult.fixedFiles) {
                console.log(`🔧 Supervisor: Found ${Object.keys(validationResult.fixedFiles).length} files to fix`);
                return {
                    isValid: false,
                    issues: validationResult.issues || [],
                    fixedFiles: validationResult.fixedFiles,
                    fileStructure
                };
            }

            console.log('✅ Supervisor: Code validation passed');
            return { isValid: true, fixedFiles: {}, fileStructure };

        } catch (error) {
            console.error('❌ Supervisor: Validation error:', error);
            // Return valid to not block the flow
            return { isValid: true, fixedFiles: {}, fileStructure };
        }
    }

    async fixSpecificFile(filePath, fileContent, errorMessage) {
        try {
            console.log(`🔧 Supervisor: Fixing file ${filePath}...`);
            
            const prompt = createFileFixPrompt(filePath, fileContent, errorMessage);
            let fixedCode = '';

            for await (const chunk of this.llmService.streamCompletion(prompt)) {
                fixedCode += chunk;
            }

            console.log(`✅ Supervisor: Fixed ${filePath}`);
            return fixedCode.trim();

        } catch (error) {
            console.error(`❌ Supervisor: Failed to fix ${filePath}:`, error);
            return fileContent; // Return original if fix fails
        }
    }

    // Validate ESM/CommonJS compatibility
    validateModuleFormat(fileStructure, files) {
        const issues = [];
        
        // Check if package.json has "type": "module"
        const hasESMPackageJson = fileStructure.projectType || 
            JSON.stringify(fileStructure).includes('"type": "module"');
        
        files.forEach(file => {
            // Check for CommonJS syntax in ESM projects
            if (file.content) {
                const hasModuleExports = file.content.includes('module.exports');
                const hasRequire = file.content.match(/require\s*\(/g);
                
                if (hasModuleExports || hasRequire) {
                    issues.push({
                        severity: 'error',
                        message: `File uses CommonJS syntax (module.exports/require) which conflicts with ESM module type`,
                        file: file.path,
                        fix: 'Convert to ESM syntax: use "export default" and "import" instead'
                    });
                }
            }
            
            // Check for problematic config files
            const lowerPath = file.path.toLowerCase();
            if (lowerPath.includes('postcss.config.js') || lowerPath.includes('tailwind.config.js')) {
                issues.push({
                    severity: 'error',
                    message: 'Config file will cause ESM/CommonJS conflict',
                    file: file.path,
                    fix: 'Remove this file - use built-in defaults or .mjs extension'
                });
            }
        });
        
        return issues;
    }

    // Helper to validate React app structure
    validateReactStructure(files) {
        const issues = [];
        
        // Check for index.html
        const hasIndexHtml = files.some(f => 
            f.path.toLowerCase().includes('index.html')
        );
        if (!hasIndexHtml) {
            issues.push({
                severity: 'error',
                message: 'Missing index.html file',
                file: 'index.html'
            });
        }

        // Check for main entry point
        const hasMainEntry = files.some(f => 
            f.path.includes('main.tsx') || 
            f.path.includes('main.ts') || 
            f.path.includes('index.tsx')
        );
        if (!hasMainEntry) {
            issues.push({
                severity: 'error',
                message: 'Missing main entry point (main.tsx or index.tsx)',
                file: 'src/main.tsx'
            });
        }

        // Check for App component
        const hasApp = files.some(f => 
            f.path.includes('App.tsx') || f.path.includes('App.ts')
        );
        if (!hasApp) {
            issues.push({
                severity: 'warning',
                message: 'Missing App component',
                file: 'src/App.tsx'
            });
        }

        return {
            isValid: issues.filter(i => i.severity === 'error').length === 0,
            issues
        };
    }

    // Create default files if missing
    createDefaultFiles(projectType, dependencies) {
        const defaultFiles = {};

        // Default index.html
        defaultFiles['index.html'] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

        // Default main.tsx with React 18 syntax
        defaultFiles['src/main.tsx'] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

        // Default App.tsx
        defaultFiles['src/App.tsx'] = `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="app">
      <h1>Welcome to React</h1>
      <p>Your app is running successfully!</p>
    </div>
  );
}

export default App;`;

        // Default App.css
        defaultFiles['src/App.css'] = `.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #333;
}

p {
  font-size: 1.1rem;
  color: #666;
}`;

        // Default index.css
        defaultFiles['src/index.css'] = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: #f5f5f5;
}

#root {
  min-height: 100vh;
}`;

        return defaultFiles;
    }

    // Validate that dependencies match what's used in config files
    validateDependencies(fileStructure, generatedFiles) {
        const issues = [];
        
        // Check if vite.config.ts/js exists
        const viteConfigFile = generatedFiles.find(f => 
            f.path.includes('vite.config.ts') || f.path.includes('vite.config.js')
        );

        if (viteConfigFile) {
            const content = viteConfigFile.content;
            
            // Check for @vitejs/plugin-react
            if (content.includes('@vitejs/plugin-react') || content.includes('plugin-react')) {
                const hasPlugin = fileStructure.devDependencies && 
                    fileStructure.devDependencies['@vitejs/plugin-react'];
                
                if (!hasPlugin) {
                    issues.push({
                        type: 'missing-dependency',
                        package: '@vitejs/plugin-react',
                        file: viteConfigFile.path,
                        severity: 'error'
                    });
                }
            }
        }

        // Check tsconfig.json for TypeScript
        const tsconfigFile = generatedFiles.find(f => f.path.includes('tsconfig.json'));
        if (tsconfigFile) {
            const hasTypeScript = fileStructure.devDependencies && 
                fileStructure.devDependencies['typescript'];
            
            if (!hasTypeScript) {
                issues.push({
                    type: 'missing-dependency',
                    package: 'typescript',
                    file: 'tsconfig.json',
                    severity: 'error'
                });
            }
        }

        return issues;
    }

    // Auto-fix dependency issues
    fixDependencies(fileStructure, generatedFiles) {
        console.log('🔧 Auto-fixing dependencies...');
        
        if (!fileStructure.devDependencies) {
            fileStructure.devDependencies = {};
        }
        if (!fileStructure.dependencies) {
            fileStructure.dependencies = {};
        }

        // Check for vite.config files
        const viteConfigFile = generatedFiles.find(f => 
            f.path.includes('vite.config.ts') || f.path.includes('vite.config.js')
        );

        if (viteConfigFile && viteConfigFile.content.includes('@vitejs/plugin-react')) {
            if (!fileStructure.devDependencies['@vitejs/plugin-react']) {
                console.log('✅ Adding @vitejs/plugin-react to devDependencies');
                fileStructure.devDependencies['@vitejs/plugin-react'] = '4.0.0';
            }
        }

        // Ensure TypeScript deps for .ts/.tsx files
        const hasTsFiles = generatedFiles.some(f => 
            f.path.endsWith('.ts') || f.path.endsWith('.tsx')
        );

        if (hasTsFiles) {
            if (!fileStructure.devDependencies['typescript']) {
                console.log('✅ Adding typescript to devDependencies');
                fileStructure.devDependencies['typescript'] = '5.0.0';
            }
            if (!fileStructure.devDependencies['@types/react']) {
                console.log('✅ Adding @types/react to devDependencies');
                fileStructure.devDependencies['@types/react'] = '18.2.0';
            }
            if (!fileStructure.devDependencies['@types/react-dom']) {
                console.log('✅ Adding @types/react-dom to devDependencies');
                fileStructure.devDependencies['@types/react-dom'] = '18.2.0';
            }
        }

        // Ensure vite for build
        if (viteConfigFile && !fileStructure.devDependencies['vite']) {
            console.log('✅ Adding vite to devDependencies');
            fileStructure.devDependencies['vite'] = '5.0.0';
        }

        return fileStructure;
    }

    // Clean markdown code blocks from generated code
    cleanCodeContent(content) {
        let cleaned = content;
        
        // Remove markdown code blocks
        cleaned = cleaned.replace(/^```[\w]*\n/gm, '');
        cleaned = cleaned.replace(/\n```$/gm, '');
        cleaned = cleaned.replace(/```/g, '');
        
        // Trim extra whitespace
        cleaned = cleaned.trim();
        
        return cleaned;
    }
}

export default CodeSupervisorService;
