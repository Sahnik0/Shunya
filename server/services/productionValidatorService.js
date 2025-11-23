/**
 * Production Validator Service
 * Validates generated code for issues that only appear when running locally (not in Sandpack)
 * Catches ESM/CommonJS conflicts, missing dependencies, and other production-only errors
 */

class ProductionValidatorService {
    constructor() {
        this.validationRules = this.getValidationRules();
    }

    /**
     * Validate generated files for production readiness
     */
    validateForProduction(fileStructure, generatedFiles) {
        console.log('🔍 Production Validator: Checking for production-only issues...');
        
        const issues = [];
        
        // Check for ESM/CommonJS conflicts
        const esmIssues = this.checkESMConflicts(fileStructure, generatedFiles);
        issues.push(...esmIssues);
        
        // Check for missing dependencies
        const depIssues = this.checkMissingDependencies(generatedFiles, fileStructure);
        issues.push(...depIssues);
        
        // Check for invalid imports
        const importIssues = this.checkInvalidImports(generatedFiles);
        issues.push(...importIssues);
        
        // Check for config file issues
        const configIssues = this.checkConfigFiles(generatedFiles, fileStructure);
        issues.push(...configIssues);
        
        if (issues.length > 0) {
            console.log(`⚠️ Production Validator: Found ${issues.length} issue(s)`);
            issues.forEach(issue => {
                console.log(`  - ${issue.severity.toUpperCase()}: ${issue.message} (${issue.file})`);
            });
        } else {
            console.log('✅ Production Validator: No issues found');
        }
        
        return {
            isValid: issues.filter(i => i.severity === 'error').length === 0,
            issues,
            fixes: this.generateFixes(issues, generatedFiles, fileStructure)
        };
    }

    /**
     * Check for ESM/CommonJS conflicts (the main issue in the user's error)
     */
    checkESMConflicts(fileStructure, files) {
        const issues = [];
        
        // Check if package.json has "type": "module"
        const packageJsonFile = files.find(f => f.path.includes('package.json'));
        const hasESMModule = packageJsonFile?.content?.includes('"type": "module"');
        
        if (hasESMModule) {
            console.log('📦 Project uses ESM modules (type: module)');
            
            files.forEach(file => {
                if (!file.content) return;
                
                // Check for CommonJS syntax in .js files
                if (file.path.endsWith('.js') || file.path.endsWith('.config.js')) {
                    const hasModuleExports = file.content.includes('module.exports');
                    const hasRequire = file.content.match(/\brequire\s*\(/g);
                    
                    if (hasModuleExports) {
                        issues.push({
                            severity: 'error',
                            type: 'esm_conflict',
                            message: 'CommonJS syntax (module.exports) in ESM project',
                            file: file.path,
                            line: this.findLine(file.content, 'module.exports'),
                            fix: 'Use "export default" instead of "module.exports"',
                            autoFix: true
                        });
                    }
                    
                    if (hasRequire) {
                        issues.push({
                            severity: 'error',
                            type: 'esm_conflict',
                            message: 'CommonJS syntax (require) in ESM project',
                            file: file.path,
                            line: this.findLine(file.content, 'require('),
                            fix: 'Use "import" instead of "require()"',
                            autoFix: true
                        });
                    }
                }
                
                // Check for problematic config files
                if (file.path.includes('postcss.config.js') || 
                    file.path.includes('tailwind.config.js')) {
                    issues.push({
                        severity: 'error',
                        type: 'config_conflict',
                        message: 'Config file uses .js extension in ESM project',
                        file: file.path,
                        fix: 'Rename to .cjs or .mjs extension, or remove the file entirely',
                        autoFix: true
                    });
                }
            });
        }
        
        return issues;
    }

    /**
     * Check for missing dependencies
     */
    checkMissingDependencies(files, fileStructure) {
        const issues = [];
        const declaredDeps = {
            ...fileStructure.dependencies || {},
            ...fileStructure.devDependencies || {}
        };
        
        files.forEach(file => {
            if (!file.content) return;
            
            // Extract import statements
            const imports = file.content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];
            
            imports.forEach(importStatement => {
                const match = importStatement.match(/from\s+['"]([^'"]+)['"]/);
                if (match) {
                    const packageName = match[1];
                    
                    // Skip relative imports
                    if (packageName.startsWith('.') || packageName.startsWith('/')) {
                        return;
                    }
                    
                    // Get package name (handle scoped packages)
                    const pkgName = packageName.startsWith('@') 
                        ? packageName.split('/').slice(0, 2).join('/')
                        : packageName.split('/')[0];
                    
                    // Check if package is declared
                    if (!declaredDeps[pkgName]) {
                        issues.push({
                            severity: 'warning',
                            type: 'missing_dependency',
                            message: `Package "${pkgName}" imported but not in dependencies`,
                            file: file.path,
                            line: this.findLine(file.content, packageName),
                            fix: `Add "${pkgName}" to dependencies in package.json`,
                            autoFix: false
                        });
                    }
                }
            });
        });
        
        return issues;
    }

    /**
     * Check for invalid imports
     */
    checkInvalidImports(files) {
        const issues = [];
        
        files.forEach(file => {
            if (!file.content) return;
            
            // Check for imports from non-existent files
            const imports = file.content.match(/import\s+.*?\s+from\s+['"](\.[^'"]+)['"]/g) || [];
            
            imports.forEach(importStatement => {
                const match = importStatement.match(/from\s+['"](\.[^'"]+)['"]/);
                if (match) {
                    const importPath = match[1];
                    const resolvedPath = this.resolveImportPath(file.path, importPath);
                    
                    // Check if imported file exists
                    const fileExists = files.some(f => 
                        f.path === resolvedPath || 
                        f.path === resolvedPath + '.tsx' ||
                        f.path === resolvedPath + '.ts' ||
                        f.path === resolvedPath + '.jsx' ||
                        f.path === resolvedPath + '.js'
                    );
                    
                    if (!fileExists) {
                        issues.push({
                            severity: 'warning',
                            type: 'invalid_import',
                            message: `Import from non-existent file: ${importPath}`,
                            file: file.path,
                            line: this.findLine(file.content, importPath),
                            fix: `Ensure file ${resolvedPath} exists or fix the import path`,
                            autoFix: false
                        });
                    }
                }
            });
        });
        
        return issues;
    }

    /**
     * Check config files for common issues
     */
    checkConfigFiles(files, fileStructure) {
        const issues = [];
        
        files.forEach(file => {
            // Check vite.config files
            if (file.path.includes('vite.config')) {
                // Check if plugins are imported but not in dependencies
                if (file.content.includes('@vitejs/plugin-react')) {
                    const hasDep = fileStructure.devDependencies?.['@vitejs/plugin-react'];
                    if (!hasDep) {
                        issues.push({
                            severity: 'error',
                            type: 'missing_dependency',
                            message: '@vitejs/plugin-react used but not in devDependencies',
                            file: file.path,
                            fix: 'Add "@vitejs/plugin-react" to devDependencies',
                            autoFix: true
                        });
                    }
                }
            }
        });
        
        return issues;
    }

    /**
     * Generate automatic fixes for detected issues
     */
    generateFixes(issues, files, fileStructure) {
        const fixes = {
            filesToRemove: [],
            filesToModify: {},
            dependenciesToAdd: {}
        };
        
        issues.forEach(issue => {
            if (!issue.autoFix) return;
            
            switch (issue.type) {
                case 'config_conflict':
                    // Remove problematic config files
                    fixes.filesToRemove.push(issue.file);
                    break;
                    
                case 'esm_conflict':
                    // Convert CommonJS to ESM
                    const file = files.find(f => f.path === issue.file);
                    if (file) {
                        let fixed = file.content;
                        
                        // Convert module.exports to export default
                        fixed = fixed.replace(/module\.exports\s*=\s*/g, 'export default ');
                        
                        // Convert require to import (basic conversion)
                        fixed = fixed.replace(
                            /const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g,
                            'import $1 from \'$2\''
                        );
                        
                        fixes.filesToModify[issue.file] = fixed;
                    }
                    break;
                    
                case 'missing_dependency':
                    // Extract package name from message
                    const match = issue.message.match(/"([^"]+)"/);
                    if (match) {
                        const pkgName = match[1];
                        // Add with latest version (will need to be looked up)
                        fixes.dependenciesToAdd[pkgName] = 'latest';
                    }
                    break;
            }
        });
        
        return fixes;
    }

    /**
     * Apply automatic fixes
     */
    applyFixes(files, fileStructure, fixes) {
        console.log('🔧 Production Validator: Applying automatic fixes...');
        
        let fixedFiles = [...files];
        let fixedStructure = { ...fileStructure };
        
        // Remove problematic files
        if (fixes.filesToRemove.length > 0) {
            console.log(`🗑️ Removing ${fixes.filesToRemove.length} problematic file(s)`);
            fixedFiles = fixedFiles.filter(f => !fixes.filesToRemove.includes(f.path));
        }
        
        // Modify files
        Object.entries(fixes.filesToModify).forEach(([path, content]) => {
            console.log(`✏️ Fixing ${path}`);
            const fileIndex = fixedFiles.findIndex(f => f.path === path);
            if (fileIndex !== -1) {
                fixedFiles[fileIndex].content = content;
            }
        });
        
        // Add missing dependencies
        if (Object.keys(fixes.dependenciesToAdd).length > 0) {
            console.log(`📦 Adding ${Object.keys(fixes.dependenciesToAdd).length} missing dependencies`);
            fixedStructure.dependencies = {
                ...fixedStructure.dependencies,
                ...fixes.dependenciesToAdd
            };
        }
        
        console.log('✅ Production Validator: Fixes applied');
        
        return { files: fixedFiles, fileStructure: fixedStructure };
    }

    /**
     * Helper: Find line number of text in content
     */
    findLine(content, searchText) {
        const lines = content.split('\n');
        const lineIndex = lines.findIndex(line => line.includes(searchText));
        return lineIndex !== -1 ? lineIndex + 1 : 0;
    }

    /**
     * Helper: Resolve relative import path
     */
    resolveImportPath(fromPath, importPath) {
        const fromDir = fromPath.split('/').slice(0, -1).join('/');
        const parts = importPath.split('/');
        const resolved = [];
        
        const dirParts = fromDir.split('/').filter(p => p);
        
        for (const part of parts) {
            if (part === '.') {
                continue;
            } else if (part === '..') {
                dirParts.pop();
            } else {
                dirParts.push(part);
            }
        }
        
        return '/' + dirParts.join('/');
    }

    /**
     * Get validation rules
     */
    getValidationRules() {
        return {
            forbiddenPatterns: [
                {
                    pattern: /module\.exports/g,
                    message: 'CommonJS syntax not allowed in ESM projects',
                    severity: 'error'
                },
                {
                    pattern: /require\s*\(/g,
                    message: 'require() not allowed in ESM projects',
                    severity: 'error'
                }
            ],
            forbiddenFiles: [
                {
                    pattern: /postcss\.config\.js$/,
                    message: 'postcss.config.js causes ESM/CommonJS conflicts',
                    severity: 'error'
                },
                {
                    pattern: /tailwind\.config\.js$/,
                    message: 'tailwind.config.js causes ESM/CommonJS conflicts',
                    severity: 'error'
                }
            ]
        };
    }
}

export default ProductionValidatorService;
