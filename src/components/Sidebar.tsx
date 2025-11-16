import { BookOpen, Users, FolderKanban, HelpCircle, PanelLeftClose, PanelLeft, MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  {
    title: "New Chat",
    variant: "primary"
  },
  {
    icon: Users,
    title: "Community"
  },
  {
    icon: BookOpen,
    title: "Library"
  },
  {
    icon: FolderKanban,
    title: "Projects"
  },
  {
    icon: HelpCircle,
    title: "Feedback"
  }
];

const RECENT_CHATS = [
  "Landing Page Design",
  "API Integration Help",
  "Next.js Auth Setup",
  "Database Schema Review",
  "Tailwind Components",
  "React Performance Issue",
  "Docker Setup Guide",
  "GraphQL Query Help",
  "UI Animation Bug",
  "TypeScript Types"
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`relative h-screen bg-background/95 flex flex-col border-r border-border/10 transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'} py-6 ${isCollapsed ? 'px-2' : 'px-3'}`}>
      <div className="mb-6 px-2 flex items-center justify-between">
        <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          <div className="whitespace-nowrap">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Shunya
            </h1>
            <p className="text-xs text-muted-foreground mt-1">AI Builder Platform</p>
          </div>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-muted/50 rounded-lg transition-all"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      
      <nav className="space-y-1.5 mb-6">
        {NAV_ITEMS.map((item, index) => {
          const Icon = item.icon || (item.variant === "primary" ? MessageSquarePlus : null);
          return (
            <button
              key={index}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} py-2.5 ${isCollapsed ? 'px-2' : 'px-3'} rounded-lg text-sm font-medium transition-all ${
                item.variant === "primary" 
                  ? "bg-muted/60 text-foreground hover:bg-muted border border-border/40"
                  : "text-foreground/70 hover:text-foreground hover:bg-muted/50"
              }`}
              title={isCollapsed ? item.title : undefined}
            >
              {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
              <span className={`overflow-hidden transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                {item.title}
              </span>
            </button>
          );
        })}
      </nav>

      {!isCollapsed && (
        <div className="flex-1 min-h-0 flex flex-col border-t border-border/30 pt-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Chats</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
            {RECENT_CHATS.map((chat, index) => (
              <button 
                key={index} 
                className="w-full text-left px-3 py-2 text-sm text-foreground/70 hover:text-foreground hover:bg-muted/50 rounded-lg transition-all truncate"
                title={chat}
              >
                {chat}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}