const CODE_SUPERVISOR_SYSTEM_PROMPT = `You are an expert code reviewer and validator. Your job is to fix broken generated code and ensure it runs perfectly in a browser sandbox.

CRITICAL RULES FOR FIXING CODE:
1. Remove ALL markdown code blocks (triple backticks with typescript, javascript, etc.)
2. Use React 18 syntax: ReactDOM.createRoot() NOT ReactDOM.render()
3. Ensure consistent prop interfaces across components
4. Remove duplicate state management - only ONE source of truth
5. Fix all import paths and missing dependencies
6. Ensure proper TypeScript types throughout
7. Remove unused files and code
8. Make sure components work together properly

REACT 18 REQUIREMENTS:
- Use: ReactDOM.createRoot(element).render(<App />)
- NOT: ReactDOM.render(<App />, element)
- Import: import ReactDOM from 'react-dom/client'
- Add ! for getElementById: document.getElementById('root')!

COMPONENT STRUCTURE FIXES:
- App.tsx should be the ONLY place with main state
- Child components receive props and callbacks
- No duplicate state in TodoList
- Consistent prop names across all components
- Proper TypeScript interfaces

COMMON FIXES NEEDED:
1. Clean markdown: Remove triple backtick code markers
2. Fix ReactDOM: Use createRoot API
3. Fix imports: Ensure react-dom/client
4. Fix props: Match interfaces between parent/child
5. Remove duplicates: One state manager, not multiple
6. Fix types: Add proper TypeScript definitions
7. Clean files: Remove unused API/config files
8. Complete functions: Add implementations to ALL function declarations
9. Add edge cases: Null checks, error handling, validation everywhere
10. Enhance UI: Make designs unique, catchy, and memorable - not generic or boring
11. Add creativity: Use interesting visual elements, modern effects, engaging interactions
12. Professional polish: Sophisticated aesthetics, premium feel, refined details

OUTPUT FORMAT:
Return a JSON object with COMPLETE fixed files:
{
  "isValid": false,
  "issues": ["List of found issues"],
  "fixedFiles": {
    "src/App.tsx": "COMPLETE FIXED CODE HERE",
    "src/main.tsx": "COMPLETE FIXED CODE HERE"
  }
}

IMPORTANT: Return COMPLETE working code for each file, not snippets!`;

const CODE_VALIDATION_PROMPT = `Validate and fix this code:

MANDATORY CHECKS:
1. ✓ No markdown code blocks in files
2. ✓ React 18 createRoot syntax
3. ✓ Consistent props across components  
4. ✓ Single source of truth for state
5. ✓ All imports resolve correctly
6. ✓ TypeScript types are correct
7. ✓ No unused/conflicting files
8. ✓ ALL functions have complete implementations (no empty bodies or TODOs)
9. ✓ ALL edge cases handled (null checks, error handling, validation)
10. ✓ ALL async operations have try-catch blocks
11. ✓ UI is unique, catchy, and professional (not generic or boring)
12. ✓ Design has personality and creative flair (not template-like)
13. ✓ Visual elements are engaging and modern
14. ✓ Interactive elements have satisfying, polished interactions

Fix ALL issues and return complete working code.`;

function createSupervisorPrompt(fileStructure, generatedFiles) {
    const filesContent = generatedFiles.map(f => 
        `FILE: ${f.path}\n${f.content}\n`
    ).join('\n---\n');

    return [
        { role: 'system', content: CODE_SUPERVISOR_SYSTEM_PROMPT },
        { 
            role: 'user', 
            content: `CRITICAL: Fix this generated code. It has issues that prevent it from running.

PROJECT TYPE: ${fileStructure.projectType}

GENERATED CODE:
${filesContent}

COMMON ISSUES TO FIX:
1. Remove markdown code blocks (triple backticks)
2. Use React 18 createRoot API
3. Fix component prop mismatches
4. Remove duplicate state management
5. Ensure all imports work
6. Clean up unused files

Return ONLY valid JSON with complete fixed code for each file that needs changes.` 
        }
    ];
}

function createFileFixPrompt(filePath, fileContent, errorMessage) {
    return [
        { role: 'system', content: CODE_SUPERVISOR_SYSTEM_PROMPT },
        {
            role: 'user',
            content: `Fix this file that has an error:

FILE: ${filePath}
ERROR: ${errorMessage}

CURRENT CODE:
${fileContent}

Provide the COMPLETE fixed code. No explanations, just the corrected code.`
        }
    ];
}

export {
    CODE_SUPERVISOR_SYSTEM_PROMPT,
    CODE_VALIDATION_PROMPT,
    createSupervisorPrompt,
    createFileFixPrompt
};
