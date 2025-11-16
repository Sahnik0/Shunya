import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ChatSession {
  id: string;
  title: string;
  userRequest: string;
  timestamp: Date;
  status: 'active' | 'completed' | 'error';
}

interface ChatHistoryContextType {
  chatHistory: ChatSession[];
  addChat: (chat: Omit<ChatSession, 'timestamp'>) => void;
  updateChat: (id: string, updates: Partial<ChatSession>) => void;
  deleteChat: (id: string) => void;
  getRecentChats: (limit?: number) => ChatSession[];
}

const ChatHistoryContext = createContext<ChatHistoryContextType | undefined>(undefined);

const CHAT_HISTORY_KEY = 'shunya_chat_history';

export function ChatHistoryProvider({ children }: { children: ReactNode }) {
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);

  // Load chat history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CHAT_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        const chats = parsed.map((chat: any) => ({
          ...chat,
          timestamp: new Date(chat.timestamp)
        }));
        setChatHistory(chats);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, []);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  }, [chatHistory]);

  const addChat = (chat: Omit<ChatSession, 'timestamp'>) => {
    const newChat: ChatSession = {
      ...chat,
      timestamp: new Date()
    };
    setChatHistory(prev => [newChat, ...prev]);
  };

  const updateChat = (id: string, updates: Partial<ChatSession>) => {
    setChatHistory(prev =>
      prev.map(chat =>
        chat.id === id ? { ...chat, ...updates } : chat
      )
    );
  };

  const deleteChat = (id: string) => {
    setChatHistory(prev => prev.filter(chat => chat.id !== id));
  };

  const getRecentChats = (limit = 10) => {
    return chatHistory.slice(0, limit);
  };

  return (
    <ChatHistoryContext.Provider value={{
      chatHistory,
      addChat,
      updateChat,
      deleteChat,
      getRecentChats
    }}>
      {children}
    </ChatHistoryContext.Provider>
  );
}

export function useChatHistory() {
  const context = useContext(ChatHistoryContext);
  if (context === undefined) {
    throw new Error('useChatHistory must be used within a ChatHistoryProvider');
  }
  return context;
}