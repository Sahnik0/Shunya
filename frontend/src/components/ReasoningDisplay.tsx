import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ReasoningDisplayProps {
  reasoning?: any;
  validation?: any;
  insights?: any;
  isStreaming?: boolean;
  streamingText?: string;
}

export const ReasoningDisplay: React.FC<ReasoningDisplayProps> = ({
  reasoning,
  validation,
  insights,
  isStreaming = false,
  streamingText = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!reasoning && !isStreaming) {
    return null;
  }

  const confidence = reasoning?.confidence?.overall || 0;
  const qualityScore = validation?.qualityScore || 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-4"
    >
      <div className="border border-border/40 rounded-md bg-muted/20">
        <div 
          className="px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors flex items-center justify-between"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-sm font-medium text-foreground">
              {isStreaming ? 'Analyzing...' : 'Analysis Complete'}
            </span>
            {!isStreaming && confidence > 0 && (
              <span className="text-xs text-muted-foreground ml-2">
                {(confidence * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="px-4 pb-3 pt-1 space-y-3 text-sm">
                {/* Streaming Text Display */}
                {isStreaming && streamingText && (
                  <div className="bg-background/50 rounded p-3 border border-border/40">
                    <pre className="whitespace-pre-wrap text-muted-foreground text-xs font-mono max-h-64 overflow-y-auto">
                      {streamingText}
                    </pre>
                  </div>
                )}

                {/* Quality Metrics */}
                {!isStreaming && validation && validation.qualityScore > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Quality: {qualityScore}/100
                  </div>
                )}

                {/* Key Insights */}
                {!isStreaming && insights && (
                  <div className="space-y-2">
                    {/* Key Decisions */}
                    {insights.keyDecisions && insights.keyDecisions.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-foreground mb-1">Key Decisions</div>
                        <div className="space-y-1">
                          {insights.keyDecisions.slice(0, 3).map((decision: any, idx: number) => (
                            <div key={idx} className="text-xs text-muted-foreground pl-3 border-l-2 border-border/60">
                              {decision.decision}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ReasoningDisplay;
