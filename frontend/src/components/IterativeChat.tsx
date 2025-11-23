import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Check, X, Sparkles, Zap, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getApiSettings } from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'chat' | 'code_edit' | 'answer';
  changes?: any[];
  stats?: {
    edited: number;
    created: number;
    deleted: number;
  };
  error?: any;
}

interface IterativeChatProps {
  projectId: string;
  userId: string;
  currentFiles: any[];
  onCodeChange?: (changes: any[]) => void;
}

export function IterativeChat({ projectId, userId, currentFiles, onCodeChange }: IterativeChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory();
  }, [projectId, userId]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/chat/history/${projectId}/${userId}?limit=20`);
      const data = await response.json();
      
      if (data.success && data.history) {
        const formattedMessages = data.history.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          type: msg.type || 'chat'
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const apiSettings = await getApiSettings();
      if (!apiSettings) {
        toast.error('Please configure API settings');
        setIsLoading(false);
        setIsTyping(false);
        return;
      }

      const response = await fetch('http://localhost:5000/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId,
          message: input,
          currentFiles,
          apiSettings
        })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let assistantMessage: ChatMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'response') {
                assistantMessage = {
                  role: 'assistant',
                  content: data.data.content || data.data.explanation || JSON.stringify(data.data),
                  timestamp: new Date(),
                  type: data.data.type,
                  changes: data.data.changes,
                  stats: data.data.stats,
                  error: data.data.error
                };

                setMessages(prev => [...prev, assistantMessage]);
                setIsTyping(false);

                // Handle errors
                if (data.data.error) {
                  toast.error('AI response error: ' + (data.data.error.message || 'Unknown error'));
                }

                // AUTOMATICALLY APPLY code changes when AI returns them
                if (data.data.changes && data.data.changes.length > 0 && onCodeChange) {
                  console.log('🤖 Auto-applying AI changes to codebase...');
                  setIsApplyingChanges(true);
                  
                  // Small delay to show the applying animation
                  setTimeout(() => {
                    onCodeChange(data.data.changes);
                    setIsApplyingChanges(false);
                    
                    const stats = data.data.stats;
                    if (stats) {
                      toast.success(`✅ Applied changes: ${stats.edited} edited, ${stats.created} created, ${stats.deleted} deleted`, {
                        duration: 4000
                      });
                    } else {
                      toast.success(`✅ Applied ${data.data.changes.length} file change(s) to codebase`, {
                        duration: 4000
                      });
                    }
                  }, 500);
                } else if (data.data.changes && data.data.changes.length === 0) {
                  // No changes returned - might be an error or question
                  console.log('No code changes returned');
                }
              } else if (data.type === 'complete') {
                setIsLoading(false);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }

    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to send message');
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const applyChanges = (changes: any[]) => {
    // Changes are already auto-applied, this is just for manual re-application if needed
    if (onCodeChange) {
      onCodeChange(changes);
      toast.success(`✅ Re-applied ${changes.length} file change(s)`, {
        duration: 3000
      });
    }
  };

  const renderChange = (change: any, index: number) => {
    return (
      <div key={index} className="text-xs bg-background/50 rounded px-2 py-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono font-semibold">{change.file}</span>
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded",
            change.action === 'edit' && "bg-blue-500/20 text-blue-400",
            change.action === 'create' && "bg-green-500/20 text-green-400",
            change.action === 'delete' && "bg-red-500/20 text-red-400"
          )}>
            {change.action}
          </span>
        </div>
        {change.summary && (
          <p className="text-muted-foreground mt-1 text-xs">{change.summary}</p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background border border-border rounded-lg overflow-hidden">
      {/* Chat Header */}
      <div className="bg-muted/50 border-b border-border px-4 py-3">
        <h3 className="font-semibold text-sm">Iterative Chat</h3>
        <p className="text-xs text-muted-foreground">Ask questions or request changes to your project</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center text-muted-foreground text-sm py-12"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary/50" />
            </motion.div>
            <p className="text-base font-medium mb-2">Start a conversation about your project</p>
            <div className="space-y-1 mt-4">
              <p className="text-xs text-muted-foreground/70">💡 Try: "Fix the button styling"</p>
              <p className="text-xs text-muted-foreground/70">🎨 Try: "Add dark mode theme"</p>
              <p className="text-xs text-muted-foreground/70">🔧 Try: "Add error handling"</p>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-4 py-2 shadow-sm hover:shadow-md transition-shadow',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              
              {message.error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3 }}
                  className="mt-3 pt-3 border-t border-destructive/50"
                >
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1 text-destructive">
                    <X className="w-3 h-3 animate-pulse" />
                    Error Details:
                  </p>
                  <p className="text-xs text-destructive/80">{message.error.message}</p>
                  {message.error.responsePreview && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer">Response preview</summary>
                      <pre className="text-xs mt-1 p-2 bg-background/50 rounded overflow-x-auto">
                        {message.error.responsePreview}
                      </pre>
                    </details>
                  )}
                </motion.div>
              )}
              
              {message.changes && message.changes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="mt-3 pt-3 border-t border-border/50"
                >
                  <motion.p
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-xs font-semibold mb-2 flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3 text-yellow-500" />
                    Code Changes ({message.changes.length} file{message.changes.length > 1 ? 's' : ''}):
                  </motion.p>
                  {message.stats && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-xs text-muted-foreground mb-2"
                    >
                      {message.stats.edited > 0 && `${message.stats.edited} edited`}
                      {message.stats.created > 0 && `, ${message.stats.created} created`}
                      {message.stats.deleted > 0 && `, ${message.stats.deleted} deleted`}
                    </motion.p>
                  )}
                  <div className="space-y-1.5">
                    {message.changes.map((change: any, idx: number) => (
                      <motion.div
                        key={idx}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.1 * idx, duration: 0.3 }}
                      >
                        {renderChange(change, idx)}
                      </motion.div>
                    ))}
                  </div>
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="mt-3 p-2 bg-green-500/10 border border-green-500/30 rounded-md">
                      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                        <Check className="w-3 h-3" />
                        <span className="font-medium">Changes automatically applied to codebase</span>
                      </p>
                    </div>
                  </motion.div>
                </motion.div>
              )}

      {/* Applying Changes Overlay */}
      <AnimatePresence>
        {isApplyingChanges && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border-2 border-primary rounded-lg p-6 shadow-2xl max-w-sm"
            >
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Code2 className="w-12 h-12 text-primary" />
                </motion.div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-1">Applying Changes</h3>
                  <p className="text-sm text-muted-foreground">Updating your codebase...</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

              <p className="text-xs text-muted-foreground mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </motion.div>
        ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex justify-start"
          >
            <div className="bg-muted rounded-lg px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                <div className="flex items-center gap-1">
                  <motion.div
                    animate={{ y: [-2, 2, -2] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                    className="w-2 h-2 bg-primary/70 rounded-full"
                  />
                  <motion.div
                    animate={{ y: [-2, 2, -2] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                    className="w-2 h-2 bg-primary/70 rounded-full"
                  />
                  <motion.div
                    animate={{ y: [-2, 2, -2] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                    className="w-2 h-2 bg-primary/70 rounded-full"
                  />
                </div>
                <span className="text-xs text-muted-foreground">AI is thinking...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (e.g., 'Fix the button styling' or 'Add error handling')"
            className="min-h-[60px] max-h-[120px] resize-none"
            disabled={isLoading}
          />
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="shrink-0 shadow-sm hover:shadow-md transition-shadow"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </motion.div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
