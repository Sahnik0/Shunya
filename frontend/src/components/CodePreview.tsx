import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  SandpackProvider, 
  SandpackLayout, 
  SandpackCodeEditor,
  SandpackPreview,
  SandpackConsole,
  SandpackFileExplorer,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { Button } from '@/components/ui/button';
import { Download, Code2, Eye, Terminal, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getApiSettings } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorFixingReasoning } from './ErrorFixingReasoning';
// @ts-ignore - JSZip types may not be fully compatible
import JSZip from 'jszip';
// @ts-ignore - file-saver types
import { saveAs } from 'file-saver';

interface GeneratedFile {
  path: string;
  content: string;
}

interface FileStructure {
  projectType: string;
  description: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

interface CodePreviewProps {
  files: GeneratedFile[];
  fileStructure: FileStructure;
  onFilesUpdated?: (files: GeneratedFile[]) => void;
}

interface ReasoningStage {
  stage: string;
  message: string;
  progress: number;
  reasoning?: any;
  result?: any;
}

// Convert generated files to Sandpack format
function convertToSandpackFiles(files: GeneratedFile[]): Record<string, string> {
  const sandpackFiles: Record<string, string> = {};
  
  console.log('🔧 Converting files to Sandpack format:', files.length, 'files');
  
  files.forEach(file => {
    // Normalize path - Sandpack expects paths starting with /
    let normalizedPath = file.path.startsWith('/') ? file.path : `/${file.path}`;
    
    // Clean up the content - remove markdown code blocks if present
    let cleanedContent = file.content;
    
    // Remove markdown code blocks
    cleanedContent = cleanedContent.replace(/^```[\w]*\n/gm, '');
    cleanedContent = cleanedContent.replace(/\n```$/gm, '');
    cleanedContent = cleanedContent.replace(/```[\w]*$/gm, '');
    cleanedContent = cleanedContent.replace(/^```/gm, '');
    
    // Remove control characters and artifacts
    cleanedContent = cleanedContent.replace(/<ctrl\d+>/g, '');
    cleanedContent = cleanedContent.replace(/<end>/g, '');
    cleanedContent = cleanedContent.replace(/<start>/g, '');
    
    cleanedContent = cleanedContent.trim();
    
    console.log('📄 File:', normalizedPath, '| Length:', cleanedContent.length);
    sandpackFiles[normalizedPath] = cleanedContent;
  });

  console.log('✅ Sandpack files ready:', Object.keys(sandpackFiles));
  return sandpackFiles;
}

// Determine the template based on project type
function getTemplate(projectType: string): string {
  const typeMap: Record<string, string> = {
    'react': 'react',
    'react-ts': 'react-ts',
    'nextjs': 'nextjs',
    'vue': 'vue',
    'vue3': 'vue3',
    'angular': 'angular',
    'svelte': 'svelte',
    'vanilla': 'vanilla',
    'vanilla-js': 'vanilla',
    'static': 'static',
    'node-api': 'node',
    'full-stack': 'react-ts',
  };
  
  return typeMap[projectType.toLowerCase()] || 'react-ts';
}

// Find the entry file
function getEntryFile(files: GeneratedFile[], projectType: string): string {
  // Common entry file patterns
  const entryPatterns = [
    'src/main.tsx',
    'src/main.ts',
    'src/index.tsx',
    'src/index.ts',
    'src/App.tsx',
    'src/App.ts',
    'index.html',
    'index.tsx',
    'index.ts',
    'main.tsx',
    'main.ts',
  ];

  for (const pattern of entryPatterns) {
    const found = files.find(f => 
      f.path === pattern || f.path === `/${pattern}` || f.path.endsWith(pattern)
    );
    if (found) {
      return found.path.startsWith('/') ? found.path : `/${found.path}`;
    }
  }

  // Default fallbacks
  if (files.length > 0) {
    return files[0].path.startsWith('/') ? files[0].path : `/${files[0].path}`;
  }

  return '/src/App.tsx';
}

// Error Monitor Component - watches for sandbox errors and auto-fixes them
function ErrorMonitor({ files, fileStructure, onFilesFixed, onFixingStart, onReasoningUpdate, stopSignal }: {
  files: GeneratedFile[];
  fileStructure: FileStructure;
  onFilesFixed: (files: GeneratedFile[]) => void;
  onFixingStart: () => void;
  onReasoningUpdate: (stage: ReasoningStage) => void;
  stopSignal?: { stopped: boolean };
}) {
  const { listen } = useSandpack();
  const [lastErrorHash, setLastErrorHash] = useState<string>('');
  const [fixedErrors, setFixedErrors] = useState<Set<string>>(new Set());
  const [errorCooldown, setErrorCooldown] = useState<boolean>(false);
  const [lastSuccessTime, setLastSuccessTime] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Watch for stop signal and abort ongoing requests
  useEffect(() => {
    if (stopSignal?.stopped && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [stopSignal?.stopped]);

  useEffect(() => {
    const unsubscribe = listen((message: any) => {
      let errorMessage = '';
      let errorType = '';

      // Check for successful compilation - reset error tracking
      if (message.type === 'done' && message.compilatonError !== true) {
        setLastSuccessTime(Date.now());
        // Clear fixed errors after successful build
        setFixedErrors(new Set());
        setErrorCooldown(false);
        return;
      }

      // Log all messages for debugging (can be removed later)
      if (message.type !== 'state' && message.type !== 'success') {
        console.log('📦 Sandpack Message:', message.type, message);
      }

      // 1. Compilation errors: type="action" action="show-error"
      if (message.type === 'action' && message.action === 'show-error') {
        errorType = 'Compilation Error';
        errorMessage = message.message || message.title || 'Compilation failed';
        if (message.line) {
          errorMessage += `\nLine: ${message.line}`;
        }
        if (message.column) {
          errorMessage += `, Column: ${message.column}`;
        }
        if (message.path) {
          errorMessage += `\nFile: ${message.path}`;
        }
        console.error('🔴 Compilation Error:', errorMessage);
      }

      // 2. Notification errors: type="action" action="notification"
      if (message.type === 'action' && message.action === 'notification' && message.notificationType === 'error') {
        errorType = 'Build Error';
        errorMessage = message.title || 'Build notification error';
        console.error('🔴 Build Error:', errorMessage);
      }

      // 3. Console errors: type="console"
      if (message.type === 'console' && message.codesandbox === true && message.log) {
        const logs = Array.isArray(message.log) ? message.log : [message.log];
        const errorLogs = logs.filter((log: any) => 
          typeof log === 'object' && (log.method === 'error' || log.method === 'warn')
        );
        
        if (errorLogs.length > 0) {
          errorType = 'Runtime Error';
          errorMessage = errorLogs.map((log: any) => 
            log.data ? log.data.join(' ') : ''
          ).join('\n');
          
          if (errorMessage.includes('Error') || errorMessage.includes('Syntax') || errorMessage.includes('Warning')) {
            console.error('🔴 Console Error:', errorMessage);
          } else {
            errorMessage = ''; // Not an actual error
          }
        }
      }

      // 4. Done with compilation error: type="done" compilatonError=true
      if (message.type === 'done' && message.compilatonError === true) {
        errorType = 'Compilation Failed';
        errorMessage = 'Build completed with compilation errors';
        console.error('🔴 Compilation Failed');
      }

      // If we have an error message, attempt to fix it
      if (errorMessage) {
        // Create a hash to prevent fixing the same error multiple times
        const errorHash = `${errorType}:${errorMessage.substring(0, 100)}`;
        
        // Check if we're in cooldown period (5 seconds after last fix attempt)
        if (errorCooldown) {
          console.log('⏸️ Error detection in cooldown period, skipping...');
          return;
        }

        // Check if this error was already fixed
        if (fixedErrors.has(errorHash)) {
          console.log('✅ Error already fixed, skipping re-fix:', errorHash.substring(0, 50));
          return;
        }
        
        // Check if error is different from last one AND hasn't been seen recently
        if (errorHash !== lastErrorHash) {
          // Verify it's not appearing right after a successful build (within 2 seconds)
          const timeSinceSuccess = Date.now() - lastSuccessTime;
          if (timeSinceSuccess < 2000) {
            console.log('⚠️ Error appeared right after success, might be transient, waiting...');
            return;
          }

          setLastErrorHash(errorHash);
          setFixedErrors(prev => new Set(prev).add(errorHash));
          setErrorCooldown(true);
          
          console.log(`🔧 Detected ${errorType}, triggering auto-fix...`);
          handleSandboxError(`${errorType}: ${errorMessage}`, errorHash);
          
          // Reset cooldown after 5 seconds
          setTimeout(() => {
            setErrorCooldown(false);
          }, 5000);
        }
      }
    });

    return () => unsubscribe();
  }, [listen, lastErrorHash]);

  const handleSandboxError = async (error: string, errorHash: string) => {
    // Create abort controller for cancellation support
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      console.log('🔧 Attempting to fix sandbox error...');
      onFixingStart();
      toast.info('AI is analyzing and fixing the error...');

      const apiSettings = await getApiSettings();
      if (!apiSettings) {
        toast.error('API settings not configured');
        return;
      }

      // Use fetch with streaming for SSE
      const response = await fetch('http://localhost:5000/api/sandbox/fix-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error,
          files,
          fileStructure,
          apiSettings
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Failed to fix error');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: any = null;

      // Read SSE stream
      while (reader) {
        // Check if cancelled
        if (stopSignal.stopped) {
          reader.cancel();
          console.log('🛑 Error fixing cancelled by user');
          break;
        }
        
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'complete') {
              finalResult = data;
            } else if (data.type === 'error') {
              throw new Error(data.error || 'Error fixing failed');
            } else {
              // Update reasoning UI with progress
              onReasoningUpdate(data);
            }
          }
        }
      }

      // Apply the final result (only if not cancelled)
      if (!stopSignal.stopped && finalResult?.success && finalResult?.fixedFiles) {
        console.log('✅ Files fixed:', Object.keys(finalResult.fixedFiles));
        toast.success(finalResult.explanation || 'Error fixed!');

        // Update files with fixed versions
        const updatedFiles = files.map(file => {
          const fixedContent = finalResult.fixedFiles[file.path] || finalResult.fixedFiles[`/${file.path}`];
          if (fixedContent) {
            return { ...file, content: fixedContent };
          }
          return file;
        });

        // Add any new files from the fix
        Object.entries(finalResult.fixedFiles).forEach(([path, content]) => {
          const exists = files.some(f => f.path === path || `/${f.path}` === path);
          if (!exists) {
            updatedFiles.push({ path, content: content as string });
          }
        });

        onFilesFixed(updatedFiles);
        // Reset error hash after successful fix to allow detecting new errors
        setLastErrorHash('');
        setLastSuccessTime(Date.now());
        console.log('✅ Fix applied successfully, resetting error tracking');
      }
    } catch (err) {
      console.error('Failed to fix error:', err);
      toast.error('Failed to auto-fix the error');
      // On failure, remove this error from fixed set to allow retry later
      setFixedErrors(prev => {
        const newSet = new Set(prev);
        newSet.delete(errorHash);
        return newSet;
      });
      setLastErrorHash('');
    }
  };

  return null; // This component doesn't render anything
}

export function CodePreview({ files, fileStructure, onFilesUpdated }: CodePreviewProps) {
  const [activeView, setActiveView] = useState<'split' | 'code' | 'preview'>('split');
  const [showConsole, setShowConsole] = useState(true);
  const [isFixingError, setIsFixingError] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [isRerendering, setIsRerendering] = useState(false);
  const [reasoningStage, setReasoningStage] = useState<ReasoningStage | null>(null);
  const [stopSignal] = useState({ stopped: false });
  const [showReasoning, setShowReasoning] = useState(false);
  
  console.log('🎨 CodePreview rendering with:', files.length, 'files', fileStructure);
  
  // Handle reasoning updates from error fixer
  const handleReasoningUpdate = (stage: ReasoningStage) => {
    setReasoningStage(stage);
    setShowReasoning(true);
  };
  
  // Handle stop button
  const handleStopFixing = () => {
    stopSignal.stopped = true;
    setShowReasoning(false);
    setIsFixingError(false);
    toast.info('Error fixing cancelled');
  };
  
  const sandpackFiles = useMemo(() => convertToSandpackFiles(files), [files]);
  const template = useMemo(() => getTemplate(fileStructure.projectType), [fileStructure.projectType]);
  const entryFile = useMemo(() => getEntryFile(files, fileStructure.projectType), [files, fileStructure.projectType]);

  // Trigger rerender animation when files change
  useEffect(() => {
    setIsRerendering(true);
    const timer = setTimeout(() => setIsRerendering(false), 1000);
    return () => clearTimeout(timer);
  }, [files]);

  const customSetup = {
    dependencies: {
      'react': '18.2.0',
      'react-dom': '18.2.0',
      ...fileStructure.dependencies,
    },
  };

  // Ensure we have required entry files for React
  const ensureRequiredFiles = () => {
    const required: Record<string, string> = { ...sandpackFiles };

    // Always add package.json with all dependencies
    required['/package.json'] = JSON.stringify({
      name: 'shunya-project',
      version: '1.0.0',
      main: '/src/index.tsx',
      dependencies: {
        'react': '18.2.0',
        'react-dom': '18.2.0',
        ...fileStructure.dependencies
      },
      devDependencies: fileStructure.devDependencies || {},
      author: {
        name: 'Generated by Shunya AI',
        url: 'https://shunya.ai'
      },
      keywords: ['shunya-ai', 'ai-generated'],
      generator: {
        name: 'Shunya AI',
        url: 'https://shunya.ai',
        generatedAt: new Date().toISOString()
      }
    }, null, 2);

    // Ensure index.html exists - critical for rendering
    const hasIndexHtml = Object.keys(required).some(path => 
      path.toLowerCase().includes('index.html')
    );
    
    if (!hasIndexHtml) {
      required['/index.html'] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileStructure.description || 'React App'}</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
      console.log('✅ Added missing index.html');
    }

    // Ensure main entry exists for React - critical for app startup
    if (template.includes('react')) {
      const hasMainEntry = Object.keys(required).some(path => 
        path.includes('/src/main.tsx') || path.includes('/src/index.tsx') || path.includes('/src/main.jsx')
      );
      
      if (!hasMainEntry) {
        required['/src/main.tsx'] = `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
        console.log('✅ Added missing main.tsx entry point');
      }

      // Ensure App.tsx exists
      const hasApp = Object.keys(required).some(path => 
        path.includes('/src/App.tsx') || path.includes('/src/App.ts') || path.includes('/src/App.jsx')
      );
      
      if (!hasApp) {
        required['/src/App.tsx'] = `import React from 'react';

function App() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }}>
      <h1>Hello React!</h1>
      <p>Your app is running successfully.</p>
    </div>
  );
}

export default App;`;
        console.log('✅ Added missing App.tsx component');
      }
    }

    console.log('📦 Final required files:', Object.keys(required).length);
    return required;
  };

  const finalFiles = ensureRequiredFiles();

  console.log('🚀 Final files for Sandpack:', Object.keys(finalFiles));
  console.log('📦 Template:', template, '| Entry:', entryFile);

  const handleDownload = async () => {
    const zip = new JSZip();

    // Add all generated files
    files.forEach(file => {
      zip.file(file.path, file.content);
    });

    // Add package.json with Shunya attribution
    const packageJson = {
      name: fileStructure.description.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: fileStructure.description,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: customSetup.dependencies,
      devDependencies: fileStructure.devDependencies || {},
      author: {
        name: 'Generated by Shunya AI',
        url: 'https://shunya.ai'
      },
      keywords: ['shunya-ai', 'ai-generated'],
      generator: {
        name: 'Shunya AI',
        version: '1.0.0',
        url: 'https://shunya.ai',
        generatedAt: new Date().toISOString()
      }
    };

    zip.file('package.json', JSON.stringify(packageJson, null, 2));

    // Add README with attribution
    const readme = `# ${fileStructure.description}

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`

---

## 🤖 Generated with Shunya AI

This project was generated using [Shunya AI](https://shunya.ai), an intelligent code generation platform.

**Project Details:**
- **Generated:** ${new Date().toLocaleDateString()}
- **Generator:** Shunya AI v1.0.0

### About Shunya AI

Shunya AI helps developers build applications faster by generating clean, production-ready code. Visit [shunya.ai](https://shunya.ai) to create your own projects.

---

Generated by Shunya AI
`;
    zip.file('README.md', readme);

    // Generate and download
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${fileStructure.description.toLowerCase().replace(/\s+/g, '-')}.zip`);
  };

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-card border border-border rounded-lg">
        <p className="text-muted-foreground">No files to preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={activeView === 'code' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('code')}
          >
            <Code2 className="w-4 h-4 mr-2" />
            Code
          </Button>
          <Button
            variant={activeView === 'preview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('preview')}
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button
            variant={activeView === 'split' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('split')}
          >
            Split
          </Button>
          
          {/* AI Monitoring Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-md ml-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-blue-500">AI Error Monitor Active</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConsole(!showConsole)}
          >
            <Terminal className="w-4 h-4 mr-2" />
            {showConsole ? 'Hide' : 'Show'} Console
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Sandpack Preview */}
      <motion.div
        key={files.length}
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="border border-border rounded-lg overflow-hidden bg-[#1e1e1e] min-h-[600px]"
      >
        <AnimatePresence>
          {isFixingError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-yellow-500/10 border-b border-yellow-500/50 p-3 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4 animate-spin text-yellow-500" />
              <span className="text-sm text-yellow-500">AI is fixing the error... (Attempt {errorCount})</span>
            </motion.div>
          )}
        </AnimatePresence>
        <SandpackProvider
          template={template as any}
          files={finalFiles}
          customSetup={{
            dependencies: {
              'react': '18.2.0',
              'react-dom': '18.2.0',
              ...fileStructure.dependencies
            },
            devDependencies: fileStructure.devDependencies || {},
            entry: entryFile
          }}
          theme="dark"
          options={{
            activeFile: entryFile,
            visibleFiles: Object.keys(finalFiles).filter(f => !f.includes('package.json') && !f.includes('.json')).slice(0, 5),
            autorun: true,
            autoReload: !isFixingError, // Disable auto-reload during error fixing to prevent lag
            recompileMode: 'delayed',
            recompileDelay: isFixingError ? 2000 : 500, // Longer delay during error fixing
            bundlerURL: undefined,
          }}
        >
          <ErrorMonitor 
            files={files} 
            fileStructure={fileStructure} 
            onFilesFixed={(fixedFiles) => {
              if (onFilesUpdated) {
                setIsFixingError(false);
                setShowReasoning(false);
                onFilesUpdated(fixedFiles);
              }
            }}
            onFixingStart={() => {
              setIsFixingError(true);
              setErrorCount(prev => prev + 1);
            }}
            onReasoningUpdate={handleReasoningUpdate}
            stopSignal={stopSignal}
          />
          <SandpackLayout className="!border-0">
            {/* Code Editor - shown in 'code' or 'split' mode */}
            {(activeView === 'code' || activeView === 'split') && (
              <div className="flex-1 min-w-[400px]">
                <SandpackFileExplorer className="!bg-[#1e1e1e] !border-0" />
                <SandpackCodeEditor 
                  showTabs
                  showLineNumbers
                  showInlineErrors
                  wrapContent
                  closableTabs
                  className="!bg-[#1e1e1e] !h-[500px]"
                />
              </div>
            )}
            
            {/* Preview - shown in 'preview' or 'split' mode */}
            {(activeView === 'preview' || activeView === 'split') && (
              <div className="flex-1 min-w-[400px] flex flex-col">
                <SandpackPreview 
                  showOpenInCodeSandbox
                  showRefreshButton
                  showNavigator
                  className="!bg-white !h-[500px]"
                  actionsChildren={
                    <div className="flex items-center gap-2 px-2">
                      <span className="text-xs text-gray-500">Live Preview</span>
                    </div>
                  }
                />
                {/* Console - always shown with preview */}
                {showConsole && (
                  <div className="border-t border-border">
                    <SandpackConsole 
                      showHeader
                      showSetupProgress
                      resetOnPreviewRestart
                      className="!bg-[#1e1e1e] !h-[200px]"
                    />
                  </div>
                )}
              </div>
            )}
          </SandpackLayout>
        </SandpackProvider>
      </motion.div>
      
      {/* Reasoning Display - Fixed bottom-right corner */}
      <ErrorFixingReasoning
        isVisible={showReasoning}
        currentStage={reasoningStage}
        onStop={handleStopFixing}
        onClose={() => setShowReasoning(false)}
      />
    </div>
  );
}
