import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, 
  SearchCode, 
  Wrench, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  FileCode,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ReasoningStage {
  stage: string;
  message: string;
  progress: number;
  reasoning?: any;
  result?: any;
}

interface ErrorFixingReasoningProps {
  isVisible: boolean;
  currentStage: ReasoningStage | null;
  onStop: () => void;
  onClose: () => void;
}

export function ErrorFixingReasoning({ 
  isVisible, 
  currentStage, 
  onStop,
  onClose 
}: ErrorFixingReasoningProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['current']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'analyzing':
        return <SearchCode className="w-5 h-5 text-blue-500" />;
      case 'reasoning_complete':
        return <Brain className="w-5 h-5 text-purple-500" />;
      case 'codebase_analysis':
        return <FileCode className="w-5 h-5 text-orange-500" />;
      case 'generating_fix':
        return <Wrench className="w-5 h-5 text-yellow-500" />;
      case 'verifying':
        return <AlertCircle className="w-5 h-5 text-green-500" />;
      case 'complete':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />;
    }
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      analyzing: 'Analyzing Error',
      reasoning_complete: 'Root Cause Identified',
      codebase_analysis: 'Scanning Codebase',
      generating_fix: 'Implementing Fix',
      verifying: 'Verifying Changes',
      complete: 'Fix Complete',
      error: 'Fix Failed'
    };
    return labels[stage] || stage;
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-6 right-6 w-[480px] max-h-[600px] bg-card border border-border rounded-lg shadow-2xl overflow-hidden z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Brain className="w-5 h-5 text-primary" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <h3 className="font-semibold text-sm">AI Error Fixing</h3>
          </div>
          <div className="flex items-center gap-2">
            {currentStage?.stage !== 'complete' && currentStage?.stage !== 'error' && (
              <Button
                size="sm"
                variant="destructive"
                onClick={onStop}
                className="h-7 text-xs"
              >
                Stop
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-7 w-7 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[500px] p-4 space-y-4">
          {/* Current Stage */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {getStageIcon(currentStage?.stage || '')}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {getStageLabel(currentStage?.stage || '')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentStage?.message}
                </p>
              </div>
            </div>

            {currentStage?.progress !== undefined && (
              <Progress value={currentStage.progress} className="h-1" />
            )}
          </div>

          {/* Reasoning Details */}
          {currentStage?.reasoning && (
            <div className="space-y-2">
              <button
                onClick={() => toggleSection('reasoning')}
                className="flex items-center gap-2 w-full text-left p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                {expandedSections.has('reasoning') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <Brain className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">Root Cause Analysis</span>
              </button>

              <AnimatePresence>
                {expandedSections.has('reasoning') && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg space-y-2">
                      {currentStage.reasoning.errorAnalysis?.rootCause?.fundamentalIssue && (
                        <div>
                          <p className="text-xs font-semibold text-purple-400 mb-1">Root Cause:</p>
                          <p className="text-xs text-muted-foreground">
                            {currentStage.reasoning.errorAnalysis.rootCause.fundamentalIssue}
                          </p>
                        </div>
                      )}

                      {currentStage.reasoning.errorAnalysis?.fixStrategy?.selected && (
                        <div>
                          <p className="text-xs font-semibold text-purple-400 mb-1">Fix Strategy:</p>
                          <p className="text-xs text-muted-foreground">
                            {currentStage.reasoning.errorAnalysis.fixStrategy.selected}
                          </p>
                        </div>
                      )}

                      {currentStage.reasoning.errorAnalysis?.rootCause?.whyChain && (
                        <div>
                          <p className="text-xs font-semibold text-purple-400 mb-1">Analysis Chain:</p>
                          <ul className="space-y-1">
                            {currentStage.reasoning.errorAnalysis.rootCause.whyChain.map((why: string, idx: number) => (
                              <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                                <span className="text-purple-400">→</span>
                                <span>{why}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Result Details */}
          {currentStage?.result && (
            <div className="space-y-2">
              <button
                onClick={() => toggleSection('result')}
                className="flex items-center gap-2 w-full text-left p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                {expandedSections.has('result') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <FileCode className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Applied Changes</span>
              </button>

              <AnimatePresence>
                {expandedSections.has('result') && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg space-y-2">
                      {currentStage.result.analysis && (
                        <div>
                          <p className="text-xs font-semibold text-green-400 mb-1">Codebase Analysis:</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Total Files:</span>
                              <span className="ml-2 font-mono">{currentStage.result.analysis.totalFiles}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Affected:</span>
                              <span className="ml-2 font-mono">{currentStage.result.analysis.affectedFiles?.length || 0}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {currentStage.result.fixedFiles && (
                        <div>
                          <p className="text-xs font-semibold text-green-400 mb-1">Modified Files:</p>
                          <ul className="space-y-1">
                            {Object.keys(currentStage.result.fixedFiles).map((file, idx) => (
                              <li key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3 text-green-400" />
                                <span className="font-mono">{file}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {currentStage.result.verification && (
                        <div>
                          <p className="text-xs font-semibold text-green-400 mb-1">Verification:</p>
                          <div className="space-y-1">
                            {Object.entries(currentStage.result.verification.checks || {}).map(([check, passed]) => (
                              <div key={check} className="flex items-center gap-2 text-xs">
                                {passed ? (
                                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-yellow-400" />
                                )}
                                <span className="text-muted-foreground">{check}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Timeline */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Process Timeline</p>
            <div className="space-y-2">
              {['analyzing', 'reasoning_complete', 'codebase_analysis', 'generating_fix', 'verifying'].map((stage, idx) => {
                const isActive = currentStage?.stage === stage;
                const isPast = ['analyzing', 'reasoning_complete', 'codebase_analysis', 'generating_fix', 'verifying'].indexOf(currentStage?.stage || '') > idx;
                
                return (
                  <div key={stage} className={`flex items-center gap-2 ${isActive ? 'opacity-100' : isPast ? 'opacity-60' : 'opacity-30'}`}>
                    <div className={`w-2 h-2 rounded-full ${isPast ? 'bg-green-500' : isActive ? 'bg-blue-500 animate-pulse' : 'bg-gray-500'}`}></div>
                    <span className="text-xs">{getStageLabel(stage)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
