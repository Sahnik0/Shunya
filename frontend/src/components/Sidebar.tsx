import { BookOpen, Users, FolderKanban, HelpCircle, PanelLeftClose, PanelLeft, MessageSquarePlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useChatHistory } from '@/contexts/ChatHistoryContext';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<{id: string, title: string} | null>(null);
  const { getRecentChats, deleteChat } = useChatHistory();
  const navigate = useNavigate();
  const recentChats = getRecentChats(10);

  const handleDeleteClick = (e: React.MouseEvent, chatId: string, chatTitle: string) => {
    e.stopPropagation();
    setChatToDelete({ id: chatId, title: chatTitle });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (chatToDelete) {
      deleteChat(chatToDelete.id);
      setChatToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

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
            {recentChats.map((chat) => (
              <div
                key={chat.id}
                className="relative group"
                onMouseEnter={() => setHoveredChatId(chat.id)}
                onMouseLeave={() => setHoveredChatId(null)}
              >
                <button 
                  onClick={() => navigate(`/chat/${chat.id}`)}
                  className="w-full text-left px-3 py-2 text-sm text-foreground/70 hover:text-foreground hover:bg-muted/50 rounded-lg transition-all truncate pr-10"
                  title={chat.title}
                >
                  {chat.title}
                </button>
                {hoveredChatId === chat.id && (
                  <button
                    onClick={(e) => handleDeleteClick(e, chat.id, chat.title)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-destructive/10 rounded-md transition-all text-muted-foreground hover:text-destructive"
                    title="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{chatToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}