import { useParams, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { ShiningText } from "@/components/ui/shining-text";
import { getApiSettings } from "@/lib/api";
import { toast } from "sonner";
import { useChatHistory } from "@/contexts/ChatHistoryContext";
import { FileTreeView } from "@/components/FileTreeView";

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
                break;

            case 'planning_chunk':
                // Could show planning progress if needed
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
                setGeneratedFiles(prev => ({
                    ...prev,
                    [data.file.path]: data.file.content
                }));
                setCurrentFile(null);
                setCurrentFileContent('');
                break;

            case 'complete':
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
            <div className="w-full max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold">{fileStructure?.description || 'Generated Project'}</h1>
                    <p className="text-sm text-muted-foreground">Session ID: {id}</p>
                    <p className="text-sm text-muted-foreground">{status}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* File Structure Panel */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">Project Structure</h2>
                        {fileStructure && <FileTreeView fileStructure={fileStructure.fileStructure} />}

                        {/* Dependencies */}
                        {fileStructure?.dependencies && Object.keys(fileStructure.dependencies).length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold">Dependencies</h3>
                                <div className="bg-card border border-border rounded-lg p-4 font-mono text-xs space-y-1">
                                    {Object.entries(fileStructure.dependencies).map(([pkg, version]) => (
                                        <div key={pkg}>{pkg}: {version}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Code Display Panel */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">Generated Files</h2>
                        <div className="space-y-4">
                            {Object.entries(generatedFiles).map(([path, content]) => (
                                <div key={path} className="bg-card border border-border rounded-lg overflow-hidden">
                                    <div className="bg-muted px-4 py-2 border-b border-border font-mono text-sm">
                                        {path}
                                    </div>
                                    <pre className="p-4 overflow-x-auto text-xs">
                                        <code>{content}</code>
                                    </pre>
                                </div>
                            ))}

                            {/* Currently generating file */}
                            {currentFile && (
                                <div className="bg-card border border-border rounded-lg overflow-hidden animate-pulse">
                                    <div className="bg-muted px-4 py-2 border-b border-border font-mono text-sm">
                                        {currentFile} (generating...)
                                    </div>
                                    <pre className="p-4 overflow-x-auto text-xs">
                                        <code>{currentFileContent}</code>
                                    </pre>
                                </div>
                            )}
                        </div>

                        {isComplete && (
                            <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 text-center">
                                <p className="text-green-500 font-semibold">✅ All files generated successfully!</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
