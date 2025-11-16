"use client";

import { useEffect, useRef, useCallback } from "react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { saveApiSettings, getApiSettings, type ApiSettings } from "@/lib/api";
import { toast } from "sonner";
import {
    ImageIcon,
    FileUp,
    Figma,
    MonitorIcon,
    CircleUserRound,
    ArrowUpIcon,
    Paperclip,
    PlusIcon,
    Settings,
    X,
} from "lucide-react";

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            // Temporarily shrink to get the right scrollHeight
            textarea.style.height = `${minHeight}px`;

            // Calculate new height
            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        // Set initial height
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    // Adjust height on window resize
    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

export function VercelV0Chat() {
    const [value, setValue] = useState("");
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200,
    });

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [apiKey, setApiKey] = useState("");
    const [provider, setProvider] = useState("");
    const [model, setModel] = useState("");
    const [savedSettings, setSavedSettings] = useState<ApiSettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const providers = {
        openai: ['gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'gpt-4', 'gpt-4-32k', 'gpt-4-turbo', 'gpt-4-turbo-preview', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-vision-preview'],
        gemini: ['gemini-1.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro-vision', 'gemini-1.5-pro-latest'],
        groq: ['llama2-70b-4096', 'mixtral-8x7b-32768', 'gemma-7b-it', 'llama3-8b-8192', 'llama3-70b-8192', 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gpt-oss-120b', 'gpt-oss-20b', 'whisper-large-v3', 'whisper-large-v3-turbo']
    };

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await getApiSettings();
                if (settings) {
                    setSavedSettings(settings);
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        };
        loadSettings();
    }, []);

    // Populate form fields when dialog opens
    useEffect(() => {
        if (isDialogOpen && savedSettings) {
            setProvider(savedSettings.provider);
            setModel(savedSettings.model);
            setApiKey(savedSettings.apiKey);
        }
    }, [isDialogOpen, savedSettings]);

    const handleSaveSettings = async () => {
        if (apiKey && provider && model) {
            setIsLoading(true);
            try {
                const settings = { apiKey, provider, model };
                await saveApiSettings(settings);
                setSavedSettings(settings);
                setIsDialogOpen(false);
                setApiKey("");
                setProvider("");
                setModel("");
                toast.success('API settings saved successfully!');
            } catch (error) {
                console.error('Failed to save settings:', error);
                toast.error('Failed to save settings. Please try again.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleClearSettings = async () => {
        try {
            // Clear local state
            setSavedSettings(null);
            setProvider("");
            setModel("");
            setApiKey("");
            
            // Clear from localStorage (userId)
            localStorage.removeItem('userId');
            
            toast.success('API settings cleared');
        } catch (error) {
            console.error('Failed to clear settings:', error);
            toast.error('Failed to clear settings');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) {
                setValue("");
                adjustHeight(true);
            }
        }
    };

    return (
        <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 space-y-8">
            <h1 className="text-4xl font-bold text-foreground">
                What can I help you ship?
            </h1>

            <div className="w-full">
                <div className="relative bg-black/60 backdrop-blur-sm rounded-xl border border-neutral-700">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute select-none -z-10 left-1/2 -translate-x-1/2"
                        style={{
                            top: 'clamp(-10px, 0.5vw, 10px)',
                            width: 'clamp(340px, 50vw, 642px)',
                            height: 'clamp(162px, 20vw, 212px)',
                            opacity: 1
                        }}
                    >
                        <svg
                            width="642"
                            height="212"
                            viewBox="0 0 642 212"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-full h-full text-current"
                            preserveAspectRatio="xMidYMid meet"
                        >
                            <mask
                                id="mask0_603_1196-responsive"
                                style={{ maskType: 'alpha' }}
                                maskUnits="userSpaceOnUse"
                                x="0"
                                y="0"
                                width="642"
                                height="212"
                            >
                                <rect width="642" height="212" fill="url(#paint0_linear_603_1196-responsive)" />
                            </mask>
                            <g mask="url(#mask0_603_1196-responsive)">
                                <path
                                    d="M377.1 5.5C416.588 5.5 448.6 37.5116 448.6 77V209.3H398.4V91.3926L279.493 210.3H397.4V260.5H265.1C225.611 260.5 193.6 228.488 193.6 189V56.7002H243.8V175.007L244.653 174.153L362.254 56.5537L363.107 55.7002H244.8V5.5H377.1Z"
                                    stroke="currentColor"
                                    strokeOpacity="0.1"
                                />
                            </g>
                            <defs>
                                <linearGradient
                                    id="paint0_linear_603_1196-responsive"
                                    x1="321"
                                    y1="212"
                                    x2="321"
                                    y2="0"
                                    gradientUnits="userSpaceOnUse"
                                >
                                    <stop stopColor="white" stopOpacity="0" />
                                    <stop offset="0.987475" stopColor="white" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <div className="overflow-y-auto">
                        <Textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                adjustHeight();
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask Shunya a question..."
                            className={cn(
                                "w-full px-4 py-3",
                                "resize-none",
                                "bg-transparent",
                                "border-none",
                                "text-white text-sm",
                                "focus:outline-none",
                                "focus-visible:ring-0 focus-visible:ring-offset-0",
                                "placeholder:text-neutral-500 placeholder:text-sm",
                                "min-h-[60px]"
                            )}
                            style={{
                                overflow: "hidden",
                            }}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="group p-2 hover:bg-zinc-900 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <Paperclip className="w-4 h-4 text-white" />
                                <span className="text-xs text-zinc-400 hidden group-hover:inline transition-opacity">
                                    Attach
                                </span>
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {savedSettings ? (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsDialogOpen(true)}
                                        className="p-1 rounded-lg text-sm text-zinc-400 transition-colors border border-dashed border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 flex items-center gap-1"
                                    >
                                        <img 
                                            src={`/assets/${savedSettings.provider}.png`} 
                                            className="w-4 h-4" 
                                            alt={savedSettings.provider} 
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClearSettings}
                                        className="p-1 rounded-lg text-sm text-zinc-400 transition-colors hover:text-zinc-200 hover:bg-zinc-800"
                                        title="Clear API settings"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsDialogOpen(true)}
                                    className="px-2 py-1 rounded-lg text-sm text-zinc-400 transition-colors border border-dashed border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 flex items-center justify-between gap-1"
                                >
                                    <Settings className="w-4 h-4" />
                                    API
                                </button>
                            )}
                            <button
                                type="button"
                                className="px-2 py-1 rounded-lg text-sm text-zinc-400 transition-colors border border-dashed border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 flex items-center justify-between gap-1"
                            >
                                <PlusIcon className="w-4 h-4" />
                                Project
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    "px-1.5 py-1.5 rounded-lg text-sm transition-colors border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 flex items-center justify-between gap-1",
                                    value.trim()
                                        ? "bg-white text-black"
                                        : "text-zinc-400"
                                )}
                            >
                                <ArrowUpIcon
                                    className={cn(
                                        "w-4 h-4",
                                        value.trim()
                                            ? "text-black"
                                            : "text-zinc-400"
                                    )}
                                />
                                <span className="sr-only">Send</span>
                            </button>
                        </div>
                    </div>
                </div>

                {savedSettings && (
                    <div className="mt-2 text-xs text-zinc-500 text-center">
                        Using {savedSettings.provider} - {savedSettings.model}
                    </div>
                )}

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>API Settings</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="relative">
                                <label className="text-sm font-medium">Provider</label>
                                <Select value={provider} onValueChange={setProvider}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select provider" />
                                    </SelectTrigger>
                                    <SelectContent className="z-50">
                                        <SelectItem value="openai" className="data-[highlighted]:bg-zinc-700/30 data-[highlighted]:text-white">
                                            <div className="flex items-center gap-2">
                                                <img src="/assets/openai.png" className="w-4 h-4" alt="OpenAI" />
                                                OpenAI
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="gemini" className="data-[highlighted]:bg-zinc-700/30 data-[highlighted]:text-white">
                                            <div className="flex items-center gap-2">
                                                <img src="/assets/gemini.png" className="w-4 h-4" alt="Gemini" />
                                                Gemini
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="groq" className="data-[highlighted]:bg-zinc-700/30 data-[highlighted]:text-white">
                                            <div className="flex items-center gap-2">
                                                <img src="/assets/groq.png" className="w-4 h-4" alt="Groq" />
                                                Groq
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {provider && (
                                <div className="relative">
                                    <label className="text-sm font-medium">Model</label>
                                    <Select value={model} onValueChange={setModel}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select model" />
                                        </SelectTrigger>
                                        <SelectContent className="z-50 max-h-[240px]">
                                            {providers[provider].map((m) => (
                                                <SelectItem key={m} value={m}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div>
                                <label className="text-sm font-medium">API Key</label>
                                <Input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Enter your API key"
                                />
                            </div>
                            <Button onClick={handleSaveSettings} disabled={!apiKey || !provider || !model || isLoading}>
                                {isLoading ? 'Saving...' : 'Save Settings'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                    <ActionButton
                        icon={<ImageIcon className="w-4 h-4" />}
                        label="Clone a Screenshot"
                    />
                    <ActionButton
                        icon={<Figma className="w-4 h-4" />}
                        label="Import from Figma"
                    />
                    <ActionButton
                        icon={<FileUp className="w-4 h-4" />}
                        label="Upload a Project"
                    />
                    <ActionButton
                        icon={<MonitorIcon className="w-4 h-4" />}
                        label="Landing Page"
                    />
                    <ActionButton
                        icon={<CircleUserRound className="w-4 h-4" />}
                        label="Sign Up Form"
                    />
                </div>
            </div>
        </div>
    );
}

interface ActionButtonProps {
    icon: React.ReactNode;
    label: string;
}

function ActionButton({ icon, label }: ActionButtonProps) {
    return (
        <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-sm hover:bg-zinc-900/70 rounded-full border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
        >
            {icon}
            <span className="text-xs">{label}</span>
        </button>
    );
}
