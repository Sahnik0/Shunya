import { useParams, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { ShiningText } from "@/components/ui/shining-text";
import { getApiSettings } from "@/lib/api";
import { toast } from "sonner";
import { useChatHistory } from "@/contexts/ChatHistoryContext";
import { FileTreeView } from "@/components/FileTreeView";
import { CodePreview } from "@/components/CodePreview";
import { CodeEditor } from "@/components/CodeEditor";
import { IterativeChat } from "@/components/IterativeChat";
import { ReasoningDisplay } from "@/components/ReasoningDisplay";
import { ShaderAnimation } from "@/components/ShaderAnimation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2, Eye, FolderTree, MessageSquare } from "lucide-react";

interface FileItem {
    path: string;
    type: 'file' | 'folder';
    description: string;
}

interface GeneratedFile {
    path: string;
    content: string;
}

interface FileStructure {
    projectType: string;
    description: string;
    fileStructure: FileItem[];
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
}

export default function Chat() {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const userRequest = location.state?.userRequest || '';
    
    const [isThinking, setIsThinking] = useState(true);
    const [status, setStatus] = useState('Analyzing your request...');
    const [fileStructure, setFileStructure] = useState<FileStructure | null>(null);
    const [generatedFiles, setGeneratedFiles] = useState<Record<string, string>>({});
    const [currentFile, setCurrentFile] = useState<string | null>(null);
    const [currentFileContent, setCurrentFileContent] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showThinkingDelay, setShowThinkingDelay] = useState(true);
    const [previewKey, setPreviewKey] = useState(0); // Force rerender on changes
    
    // Reasoning state
    const [isReasoning, setIsReasoning] = useState(false);
    const [reasoningText, setReasoningText] = useState('');
    const [reasoningData, setReasoningData] = useState<any>(null);
    const [reasoningValidation, setReasoningValidation] = useState<any>(null);
    const [reasoningInsights, setReasoningInsights] = useState<any>(null);
    
    const eventSourceRef = useRef<EventSource | null>(null);
    const { updateChat } = useChatHistory();

    useEffect(() => {
        if (!userRequest) {
            setError('No request provided');
            setIsThinking(false);
            setShowThinkingDelay(false);
            return;
        }

        // Show thinking animation for 4-5 seconds
        const thinkingTimer = setTimeout(() => {
            setShowThinkingDelay(false);
            startCodeGeneration();
        }, 4500); // 4.5 seconds delay

        return () => {
            clearTimeout(thinkingTimer);
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    const startCodeGeneration = async () => {
        try {
            // Get user API settings
            const apiSettings = await getApiSettings();
            
            if (!apiSettings) {
                setError('Please configure your API settings first');
                setIsThinking(false);
                setShowThinkingDelay(false);
                toast.error('API settings not configured');
                return;
            }

            // Start SSE connection
            const response = await fetch('http://localhost:5000/api/codegen/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userRequest,
                    apiSettings
                })
            });

            if (!response.ok) {
                throw new Error('Failed to start code generation');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            handleSSEEvent(data);
                        } catch (e) {
                            console.error('Failed to parse SSE data:', e);
                        }
                    }
                }
            }

        } catch (err) {
            console.error('Code generation error:', err);
            setError(err instanceof Error ? err.message : 'An error occurred');
            setIsThinking(false);
            setShowThinkingDelay(false);
            toast.error('Failed to generate code');
        }
    };

    const handleSSEEvent = (data: any) => {
        switch (data.type) {
            case 'status':
                setStatus(data.message);
                // Check if entering reasoning phase
                if (data.message.includes('Reasoning')) {
                    setIsReasoning(true);
                    setReasoningText('');
                }
                break;

            case 'reasoning_chunk':
                setIsReasoning(true);
                setReasoningText(prev => prev + (data.content || ''));
                break;

            case 'reasoning_complete':
                setIsReasoning(false);
                setReasoningData(data.reasoning);
                setReasoningValidation(data.validation);
                setReasoningInsights(data.insights);
                console.log('🧠 Reasoning complete:', data.reasoning);
                toast.success('AI reasoning complete!', {
                    description: `Quality score: ${data.validation?.qualityScore || 'N/A'}/100`
                });
                break;

            case 'reasoning_error':
                setIsReasoning(false);
                console.warn('⚠️ Reasoning unavailable:', data.message);
                break;

            case 'planning_chunk':
                // Could show planning progress if needed
                break;

            case 'diagnostic_report':
                console.log('🔍 DIAGNOSTIC REPORT:', data.diagnosis);
                console.log('💡 RECOMMENDATION:', data.recommendation);
                toast.info('Diagnostic AI analyzing sandbox...');
                break;

            case 'file_structure':
                setFileStructure(data.data);
                setIsThinking(false);
                break;

            case 'file_generation_start':
                setCurrentFile(data.file.path);
                setCurrentFileContent('');
                break;

            case 'code_chunk':
                if (data.file === currentFile) {
                    setCurrentFileContent(prev => prev + data.content);
                }
                break;

            case 'file_complete':
                setGeneratedFiles(prev => {
                    const updated = {
                        ...prev,
                        [data.file.path]: data.file.content
                    };
                    console.log('📝 File complete:', data.file.path, '| Total files:', Object.keys(updated).length);
                    return updated;
                });
                setCurrentFile(null);
                setCurrentFileContent('');
                break;

            case 'file_fixed':
                setGeneratedFiles(prev => ({
                    ...prev,
                    [data.file]: prev[data.file] // Will be updated by supervisor
                }));
                toast.info(`Fixed: ${data.file}`);
                break;

            case 'file_added':
                toast.info(`Added missing file: ${data.file}`);
                break;

            case 'complete':
                // Handle complete event with all files
                if (data.data && data.data.files) {
                    const filesObj: Record<string, string> = {};
                    data.data.files.forEach((file: any) => {
                        filesObj[file.path] = file.content;
                    });
                    console.log('✅ Complete event received with', data.data.files.length, 'files');
                    console.log('📦 Files:', Object.keys(filesObj));
                    setGeneratedFiles(filesObj);
                }
                setIsComplete(true);
                setStatus('Code generation complete!');
                if (id) {
                    updateChat(id, { status: 'completed' });
                }
                toast.success('Project generated successfully!');
                break;

            case 'error':
                setError(data.message);
                setIsThinking(false);
                setShowThinkingDelay(false);
                if (id) {
                    updateChat(id, { status: 'error' });
                }
                toast.error(data.message);
                break;
        }
    };

    if (error) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-4xl mx-auto text-center">
                    <h2 className="text-2xl font-bold text-red-500 mb-4">Error</h2>
                    <p className="text-muted-foreground">{error}</p>
                </div>
            </div>
        );
    }

    if (isThinking && showThinkingDelay) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-4xl mx-auto text-center">
                    <ShiningText text="Shunya analyzing your request..." />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4">
            <div className="w-full max-w-[1920px] mx-auto space-y-6">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold">{fileStructure?.description || 'Generated Project'}</h1>
                    <p className="text-sm text-muted-foreground">Session ID: {id}</p>
                    <p className="text-sm text-muted-foreground">{status}</p>
                </div>

                {/* Reasoning Display - Shows AI's thinking process */}
                {(isReasoning || reasoningData) && (
                    <ReasoningDisplay
                        reasoning={reasoningData}
                        validation={reasoningValidation}
                        insights={reasoningInsights}
                        isStreaming={isReasoning}
                        streamingText={reasoningText}
                    />
                )}

                {/* Main Content with Tabs */}
                <Tabs defaultValue="preview" className="w-full">
                    <TabsList className="grid w-full max-w-2xl grid-cols-4">
                        <TabsTrigger value="preview" className="flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            Live Preview
                        </TabsTrigger>
                        <TabsTrigger value="chat" className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Chat & Edit
                        </TabsTrigger>
                        <TabsTrigger value="structure" className="flex items-center gap-2">
                            <FolderTree className="w-4 h-4" />
                            Structure
                        </TabsTrigger>
                        <TabsTrigger value="code" className="flex items-center gap-2">
                            <Code2 className="w-4 h-4" />
                            Raw Code
                        </TabsTrigger>
                    </TabsList>

                    {/* Live Preview Tab */}
                    <TabsContent value="preview" className="mt-6">
                        {isComplete && fileStructure ? (
                            <>
                                <div className="mb-4 text-sm text-muted-foreground flex items-center gap-2">
                                    <Eye className="w-4 h-4" />
                                    Rendering {Object.keys(generatedFiles).length} files
                                </div>
                                <CodePreview
                                    key={previewKey}
                                    files={Object.entries(generatedFiles).map(([path, content]) => ({
                                        path,
                                        content
                                    }))}
                                    fileStructure={fileStructure}
                                    onFilesUpdated={(updatedFiles) => {
                                        const filesObj: Record<string, string> = {};
                                        updatedFiles.forEach(file => {
                                            filesObj[file.path] = file.content;
                                        });
                                        setGeneratedFiles(filesObj);
                                        setPreviewKey(prev => prev + 1);
                                        toast.success('Files updated with fixes!');
                                    }}
                                />
                            </>
                        ) : (
                            <div className="relative flex items-center justify-center min-h-[600px] bg-black border border-border rounded-lg overflow-hidden">
                                <div className="absolute inset-0 w-full h-full">
                                    <ShaderAnimation />
                                </div>
                                <div className="relative z-10 text-center space-y-4 bg-black/50 backdrop-blur-sm p-8 rounded-lg border border-white/10">
                                    <p className="text-white text-xl font-semibold">Generating Code...</p>
                                    <p className="text-white/80 text-sm">{status}</p>
                                    {currentFile && (
                                        <p className="text-white/60 text-xs font-mono">
                                            {currentFile}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-center gap-2 pt-2">
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-75"></div>
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-150"></div>
                                    </div>
                                    <p className="text-white/60 text-xs">
                                        Files: {Object.keys(generatedFiles).length}
                                    </p>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* Iterative Chat Tab */}
                    <TabsContent value="chat" className="mt-6">
                        {isComplete && id ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Chat Interface */}
                                <div className="h-[700px]">
                                    <IterativeChat
                                        projectId={id}
                                        userId="user-123" // TODO: Replace with actual user ID from auth
                                        currentFiles={Object.entries(generatedFiles).map(([path, content]) => ({
                                            path,
                                            content
                                        }))}
                                        onCodeChange={(changes) => {
                                            // Apply code changes from AI - AUTO-APPLY TO CODEBASE
                                            console.log('🔧 Auto-applying AI code changes to codebase:', changes);
                                            const updatedFiles = { ...generatedFiles };
                                            let changeCount = 0;
                                            
                                            changes.forEach((change: any) => {
                                                // Normalize file path (handle both /path and path formats)
                                                const normalizedPath = change.file.startsWith('/') ? change.file.slice(1) : change.file;
                                                const pathWithSlash = change.file.startsWith('/') ? change.file : '/' + change.file;
                                                
                                                if (change.action === 'edit' || change.action === 'create') {
                                                    const content = change.newContent || change.content;
                                                    
                                                    // Update with both path formats to ensure compatibility
                                                    updatedFiles[normalizedPath] = content;
                                                    updatedFiles[pathWithSlash] = content;
                                                    
                                                    changeCount++;
                                                    console.log(`✅ ${change.action.toUpperCase()}: ${change.file}`, {
                                                        contentLength: content?.length,
                                                        normalizedPath,
                                                        pathWithSlash
                                                    });
                                                } else if (change.action === 'delete') {
                                                    delete updatedFiles[normalizedPath];
                                                    delete updatedFiles[pathWithSlash];
                                                    changeCount++;
                                                    console.log(`🗑️ DELETED: ${change.file}`);
                                                }
                                            });
                                            
                                            console.log('📦 Total files after changes:', Object.keys(updatedFiles).length);
                                            console.log('📝 Updated file paths:', Object.keys(updatedFiles));
                                            
                                            setGeneratedFiles(updatedFiles);
                                            setPreviewKey(prev => prev + 1); // Force preview rerender
                                            console.log('✅ Codebase updated - triggering preview rerender');
                                        }}
                                    />
                                </div>

                                {/* Live Preview Side-by-Side */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Eye className="w-5 h-5 text-primary" />
                                        Live Preview
                                    </h3>
                                    <CodePreview
                                        key={previewKey}
                                        files={Object.entries(generatedFiles).map(([path, content]) => ({
                                            path,
                                            content
                                        }))}
                                        fileStructure={fileStructure}
                                        onFilesUpdated={(updatedFiles) => {
                                            const filesObj: Record<string, string> = {};
                                            updatedFiles.forEach(file => {
                                                filesObj[file.path] = file.content;
                                            });
                                            setGeneratedFiles(filesObj);
                                            setPreviewKey(prev => prev + 1);
                                            toast.success('Files updated with fixes!');
                                        }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center min-h-[500px] bg-card border border-border rounded-lg">
                                <div className="text-center space-y-4">
                                    <MessageSquare className="w-16 h-16 text-muted-foreground mx-auto" />
                                    <p className="text-muted-foreground">
                                        Chat will be available after code generation completes
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        You'll be able to request changes and improvements
                                    </p>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* File Structure Tab */}
                    <TabsContent value="structure" className="mt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* File Structure Panel */}
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold">Project Structure</h2>
                                {fileStructure ? (
                                    <FileTreeView fileStructure={fileStructure.fileStructure} />
                                ) : (
                                    <div className="bg-card border border-border rounded-lg p-8 text-center">
                                        <p className="text-muted-foreground">Generating structure...</p>
                                    </div>
                                )}

                                {/* Dependencies */}
                                {fileStructure?.dependencies && Object.keys(fileStructure.dependencies).length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-semibold">Dependencies</h3>
                                        <div className="bg-card border border-border rounded-lg p-4 font-mono text-xs space-y-1 max-h-[300px] overflow-y-auto">
                                            {Object.entries(fileStructure.dependencies).map(([pkg, version]) => (
                                                <div key={pkg} className="flex justify-between">
                                                    <span className="text-primary">{pkg}</span>
                                                    <span className="text-muted-foreground">{version}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Dev Dependencies */}
                                {fileStructure?.devDependencies && Object.keys(fileStructure.devDependencies).length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-semibold">Dev Dependencies</h3>
                                        <div className="bg-card border border-border rounded-lg p-4 font-mono text-xs space-y-1 max-h-[300px] overflow-y-auto">
                                            {Object.entries(fileStructure.devDependencies).map(([pkg, version]) => (
                                                <div key={pkg} className="flex justify-between">
                                                    <span className="text-primary">{pkg}</span>
                                                    <span className="text-muted-foreground">{version}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Generation Progress */}
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold">Generation Progress</h2>
                                <div className="space-y-2">
                                    {Object.entries(generatedFiles).map(([path]) => (
                                        <div key={path} className="bg-green-500/10 border border-green-500/50 rounded-lg p-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <span className="font-mono text-sm">{path}</span>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Currently generating file */}
                                    {currentFile && (
                                        <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-3 animate-pulse">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                                                <span className="font-mono text-sm">{currentFile}</span>
                                                <span className="text-xs text-muted-foreground ml-auto">generating...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {isComplete && (
                                    <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 text-center mt-4">
                                        <p className="text-green-500 font-semibold">✅ All files generated successfully!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* Raw Code Tab */}
                    <TabsContent value="code" className="mt-6">
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold">Generated Files</h2>
                            <div className="space-y-4">
                                {Object.entries(generatedFiles).map(([path, content]) => (
                                    <CodeEditor
                                        key={path}
                                        code={content}
                                        fileName={path}
                                    />
                                ))}

                                {/* Currently generating file */}
                                {currentFile && (
                                    <div className="bg-card border border-border rounded-lg overflow-hidden animate-pulse">
                                        <div className="bg-muted px-4 py-2 border-b border-border font-mono text-sm">
                                            {currentFile} (generating...)
                                        </div>
                                        <pre className="p-4 overflow-x-auto text-xs max-h-[500px] overflow-y-auto">
                                            <code>{currentFileContent}</code>
                                        </pre>
                                    </div>
                                )}

                                {Object.keys(generatedFiles).length === 0 && !currentFile && (
                                    <div className="bg-card border border-border rounded-lg p-8 text-center">
                                        <p className="text-muted-foreground">No files generated yet...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
