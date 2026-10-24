import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Plus, Trash2, Loader2, Sparkles, Sun, Moon, 
  Send, Square, Copy, Check, ChevronLeft, ChevronRight, 
  Paperclip, FileText, X, Search, ThumbsUp, ThumbsDown, 
  RotateCcw, Edit3, Settings, Download, Globe, Brain, 
  Code2, CheckCircle2, AlertCircle, Compass, Lightbulb, 
  BookOpen
} from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface AttachedItem {
  name: string;
  size: number;
  text?: string;
  isImage?: boolean;
  dataUrl?: string;
}

interface Message {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  files?: { name: string; size: number }[];
  feedback?: 'up' | 'down';
  created_at?: string;
  isError?: boolean;
}

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem('kio-theme') !== 'light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Dynamic API Base URL
  const apiBase = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://127.0.0.1:8000'
    : 'https://kio-backend-g7t0.onrender.com';

  // Core State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Mode Toggles
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [deepThinkEnabled, setDeepThinkEnabled] = useState(false);

  // Power States
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(1);
  const [editingMsgIdx, setEditingMsgIdx] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState('');
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [renameBuffer, setRenameBuffer] = useState('');

  const [attachedItems, setAttachedItems] = useState<AttachedItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync Theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kio-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kio-theme', 'light');
    }
  }, [darkMode]);

  // Sidebar responsive default
  useEffect(() => {
    if (window.innerWidth >= 1024) setIsSidebarOpen(true);
  }, []);

  // Textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputMessage]);

  // Scroll to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, thinkingStep]);

  // Thinking step cycler
  useEffect(() => {
    if (!isLoading) {
      setThinkingStep(1);
      return;
    }
    const interval = setInterval(() => {
      setThinkingStep((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 1800);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Load Conversations
  const loadConversations = async () => {
    try {
      const res = await fetch(`${apiBase}/api/conversations`);
      if (res.ok) {
        const data: Conversation[] = await res.json();
        setConversations(data);
        if (data.length > 0 && !currentConvId) {
          selectConversation(data[0].id);
        }
      }
    } catch {
      setErrorNotice('Connecting to backend...');
    }
  };

  const selectConversation = async (convId: string) => {
    setCurrentConvId(convId);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    try {
      const res = await fetch(`${apiBase}/api/conversations/${convId}/messages`);
      if (res.ok) {
        const msgs = await res.json();
        setMessages(msgs.map((m: any) => ({ 
          id: m.id, 
          role: m.role, 
          content: m.content, 
          created_at: m.created_at 
        })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const createNewChat = async () => {
    try {
      const res = await fetch(`${apiBase}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' })
      });
      if (res.ok) {
        const newConv = await res.json();
        setConversations((prev) => [newConv, ...prev]);
        setCurrentConvId(newConv.id);
        setMessages([]);
        setAttachedItems([]);
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
      }
    } catch {
      setErrorNotice('Backend offline.');
    }
  };

  const deleteChat = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await fetch(`${apiBase}/api/conversations/${convId}`, { method: 'DELETE' });
      const updated = conversations.filter((c) => c.id !== convId);
      setConversations(updated);
      if (currentConvId === convId) {
        if (updated.length > 0) selectConversation(updated[0].id);
        else {
          setCurrentConvId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveRename = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (!renameBuffer.trim()) return;
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: renameBuffer.trim() } : c));
    setEditingConvId(null);
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // File Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachedItems((prev) => [
            ...prev,
            { name: file.name, size: file.size, isImage: true, dataUrl: reader.result as string }
          ]);
        };
        reader.readAsDataURL(file);
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${apiBase}/api/upload`, { method: 'POST', body: formData });
        if (!res.ok) throw new Error('PDF upload failed');
        const data = await res.json();
        setAttachedItems((prev) => [
          ...prev,
          { name: data.filename, size: data.size, text: data.text, isImage: false }
        ]);
      } else {
        const textContent = await file.text();
        setAttachedItems((prev) => [
          ...prev,
          { name: file.name, size: file.size, text: textContent.slice(0, 30000), isImage: false }
        ]);
      }
    } catch (err: any) {
      alert(`Could not process: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Stop Generation
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⏹ *Generation cancelled by user.*' }
      ]);
    }
  };

  // Send Message
  const handleSend = async (customPrompt?: string) => {
    const rawText = (customPrompt || inputMessage).trim();
    if ((!rawText && attachedItems.length === 0) || isLoading) return;

    setErrorNotice(null);
    let targetConvId = currentConvId;

    if (!targetConvId) {
      try {
        const title = (rawText || attachedItems[0]?.name || 'New Chat').slice(0, 32);
        const res = await fetch(`${apiBase}/api/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title })
        });
        const newConv = await res.json();
        targetConvId = newConv.id;
        setCurrentConvId(newConv.id);
        setConversations((prev) => [newConv, ...prev]);
      } catch {
        setErrorNotice('Cannot connect to backend.');
        return;
      }
    }

    const imagesToSend: string[] = [];
    const docFiles: { name: string; size: number }[] = [];
    let textPayload = rawText;

    attachedItems.forEach((item) => {
      if (item.isImage && item.dataUrl) {
        imagesToSend.push(item.dataUrl);
      } else if (item.text) {
        docFiles.push({ name: item.name, size: item.size });
        textPayload = `--- ATTACHMENT: ${item.name} ---\n${item.text}\n--- END ATTACHMENT ---\n\n${textPayload}`;
      }
    });

    if (webSearchEnabled) {
      textPayload = `[SYSTEM: Prioritize current factual research & structured synthesis]\n${textPayload}`;
    }
    if (deepThinkEnabled) {
      textPayload = `[SYSTEM: Provide detailed architectural breakdown and comprehensive reasoning]\n${textPayload}`;
    }

    setInputMessage('');
    setAttachedItems([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: rawText || (imagesToSend.length > 0 ? 'Analyze attached image' : ''),
        images: imagesToSend,
        files: docFiles
      }
    ]);
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: targetConvId,
          message: textPayload || 'Please inspect and analyze this request in detail.',
          images: imagesToSend
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Service error');
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      loadConversations();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `⚠️ Error: ${err.message}. Please retry or check backend connection.`, isError: true }
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveEdit = (idx: number) => {
    if (!editBuffer.trim()) return;
    setEditingMsgIdx(null);
    handleSend(editBuffer);
  };

  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser) handleSend(lastUser.content);
  };

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const setFeedback = (idx: number, type: 'up' | 'down') => {
    setMessages(prev => prev.map((m, i) => i === idx ? { ...m, feedback: type } : m));
  };

  const exportChat = () => {
    const blob = new Blob([JSON.stringify({ conversation_id: currentConvId, messages }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kio-conversation-${currentConvId || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Full Markdown Renderer
  const renderMessageContent = (content: string) => {
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'code', language: match[1] || 'code', value: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({ type: 'text', value: content.slice(lastIndex) });
    }

    return (
      <div className="space-y-3.5 leading-relaxed text-[15px] antialiased">
        {parts.map((p, i) => {
          if (p.type === 'code') {
            const blockId = `code-block-${i}`;
            return (
              <div key={i} className="my-4 rounded-xl overflow-hidden border border-white/[0.08] bg-[#0d0e12] font-mono text-xs shadow-xl">
                {/* macOS Style Window Bar */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#14161c] border-b border-white/[0.06] text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                    <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{p.language}</span>
                  </div>
                  <button
                    onClick={() => copyCode(p.value, blockId)}
                    className="flex items-center gap-1.5 hover:text-white px-2 py-1 rounded-md hover:bg-white/[0.06] transition"
                  >
                    {copiedCodeId === blockId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span className="text-[11px]">{copiedCodeId === blockId ? 'Copied' : 'Copy code'}</span>
                  </button>
                </div>
                <pre className="p-4 overflow-x-auto leading-relaxed text-zinc-200 selection:bg-indigo-500/30">
                  <code>{p.value}</code>
                </pre>
              </div>
            );
          }

          // Format paragraphs, bold, lists
          const paragraphs = p.value.split('\n\n');
          return (
            <div key={i} className="space-y-3">
              {paragraphs.map((para, pIdx) => {
                if (para.startsWith('# ')) {
                  return <h1 key={pIdx} className="text-xl font-bold tracking-tight text-white mt-3">{para.slice(2)}</h1>;
                }
                if (para.startsWith('## ')) {
                  return <h2 key={pIdx} className="text-lg font-semibold tracking-tight text-white mt-2">{para.slice(3)}</h2>;
                }
                if (para.startsWith('### ')) {
                  return <h3 key={pIdx} className="text-base font-semibold text-zinc-200 mt-2">{para.slice(4)}</h3>;
                }
                if (para.startsWith('> ')) {
                  return <blockquote key={pIdx} className="border-l-2 border-indigo-400 pl-3 italic text-zinc-300">{para.slice(2)}</blockquote>;
                }

                // Render bold & inline code
                const formattedText = para.split(/(\*\*.*?\*\*|`.*?`)/g).map((segment, sIdx) => {
                  if (segment.startsWith('**') && segment.endsWith('**')) {
                    return <strong key={sIdx} className="font-semibold text-white">{segment.slice(2, -2)}</strong>;
                  }
                  if (segment.startsWith('`') && segment.endsWith('`')) {
                    return <code key={sIdx} className="px-1.5 py-0.5 rounded-md bg-white/[0.08] text-indigo-300 font-mono text-[13px]">{segment.slice(1, -1)}</code>;
                  }
                  return segment;
                });

                return <p key={pIdx} className="leading-relaxed whitespace-pre-wrap">{formattedText}</p>;
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const heroSuggestions = [
    { title: "Architectural Deep Dive", desc: "Design a fault-tolerant async worker with retries", icon: Code2, prompt: "Can you provide a production-quality pattern for async task queues in Python FastAPI with backoff and error boundaries?" },
    { title: "Document Review", desc: "Inspect and extract critical insights from files", icon: FileText, prompt: "What are the core technical constraints, dependencies, and risks outlined in this attached document?" },
    { title: "Deep Explanation", desc: "Understand model quantization & token latency", icon: Lightbulb, prompt: "Explain how AI model quantization (FP8, INT4) impacts latency, memory, and throughput in high-concurrency environments." },
    { title: "Strategic Roadmap", desc: "Plan a zero-cost local-first cloud architecture", icon: Compass, prompt: "Outline a practical roadmap to scale a personal AI platform to 1,000 active users while keeping ongoing inference costs near zero." }
  ];

  return (
    <div className={`flex h-dvh w-full overflow-hidden ${darkMode ? 'bg-[#0f1115] text-[#eceff3]' : 'bg-[#f6f7f9] text-[#14171c]'} font-sans antialiased`}>
      
      {/* Hidden File Picker */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
        accept="image/*,.pdf,.txt,.md,.py,.js,.ts,.tsx,.jsx,.html,.css,.csv,.json" 
      />

      {/* --- COLLAPSIBLE WORKSPACE SIDEBAR --- */}
      <aside 
        className={`fixed lg:relative inset-y-0 left-0 z-50 duration-300 transition-all overflow-hidden flex flex-col border-r shrink-0 select-none ${
          isSidebarOpen ? 'w-76 shadow-2xl lg:shadow-none' : 'w-0'
        } ${darkMode ? 'border-white/[0.07] bg-[#181b21]' : 'border-zinc-200 bg-white'}`}
      >
        <div className="p-4 space-y-4 flex-1 flex flex-col min-w-[19rem] overflow-hidden">
          
          {/* Brand & Animated Logo */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25 relative group">
                <div className="absolute inset-0 rounded-2xl bg-indigo-400 blur-sm opacity-40 group-hover:opacity-75 transition" />
                <Sparkles size={18} className="relative z-10 animate-pulse" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-[15px] tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">KIO</h1>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono">v1.0</span>
                </div>
                <p className="text-[11px] text-[#a3acb9] font-medium">Farhan&apos;s Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-xl hover:bg-white/[0.06] text-zinc-400 hover:text-white transition"
                title="Toggle Theme"
              >
                {darkMode ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-2 rounded-xl hover:bg-white/[0.06] text-zinc-400"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* New Chat Button */}
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-between py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-2">
              <Plus size={16} />
              <span>New Conversation</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 font-mono">⌘N</span>
          </button>

          {/* Search History */}
          <div className="relative">
            <Search size={13} className="absolute left-3.5 top-2.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs outline-none border transition ${
                darkMode ? 'bg-[#0f1115] border-white/[0.08] text-zinc-200 focus:border-indigo-500/50' : 'bg-zinc-100 border-zinc-200'
              }`}
            />
          </div>

          {/* Conversation History Stream */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-2 pt-1 pb-1">
              Recent Chats
            </p>
            {filteredConversations.length === 0 ? (
              <p className="text-xs text-zinc-500 px-2 py-4 italic text-center">No conversations found</p>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition ${
                    currentConvId === conv.id
                      ? 'bg-indigo-600/15 text-indigo-400 font-medium border border-indigo-500/25'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate flex-1 mr-2">
                    <MessageSquare size={14} className="shrink-0 opacity-60 group-hover:opacity-100" />
                    {editingConvId === conv.id ? (
                      <input
                        type="text"
                        value={renameBuffer}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameBuffer(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(e as any, conv.id);
                        }}
                        className="bg-black/40 border border-indigo-500/40 rounded px-1.5 py-0.5 text-xs text-white outline-none w-full"
                      />
                    ) : (
                      <span className="truncate">{conv.title || 'Conversation'}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    {editingConvId === conv.id ? (
                      <button onClick={(e) => saveRename(e, conv.id)} className="p-1 text-emerald-400 hover:bg-white/[0.08] rounded">
                        <Check size={12} />
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingConvId(conv.id);
                          setRenameBuffer(conv.title);
                        }} 
                        className="p-1 text-zinc-400 hover:text-white rounded"
                        title="Rename"
                      >
                        <Edit3 size={12} />
                      </button>
                    )}
                    <button
                      onClick={(e) => deleteChat(e, conv.id)}
                      className="p-1 text-zinc-400 hover:text-rose-400 rounded"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Profile & Settings Footer */}
        <div className="p-3.5 border-t border-white/[0.08] bg-[#14161c] min-w-[19rem] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white">
              F
            </div>
            <div className="leading-tight">
              <p className="text-xs font-semibold text-white">Farhan</p>
              <p className="text-[10px] text-zinc-400">Personal Pro Plan</p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
            title="Settings & Data"
          >
            <Settings size={16} />
          </button>
        </div>
      </aside>

      {/* --- MAIN STAGE --- */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        
        {/* Top Navbar */}
        <header className="flex items-center justify-between py-3 px-5 border-b border-white/[0.06] bg-inherit shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl hover:bg-white/[0.06] text-zinc-300 transition"
              title="Toggle sidebar"
            >
              {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
            
            {/* Model Selector Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-zinc-200">Claude Haiku 4.5</span>
              <span className="text-[10px] text-zinc-500 border-l border-white/[0.1] pl-2 font-mono">OmniRoute</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportChat}
              disabled={messages.length === 0}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.06] text-xs font-medium text-zinc-300 transition disabled:opacity-40"
              title="Export Conversation"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
            <button
              onClick={createNewChat}
              className="lg:hidden p-2 rounded-xl bg-indigo-600 text-white"
              title="New Chat"
            >
              <Plus size={16} />
            </button>
          </div>
        </header>

        {/* Global Connection Notice */}
        {errorNotice && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-300 flex items-center justify-between">
            <span>{errorNotice}</span>
            <button onClick={() => setErrorNotice(null)} className="font-bold">&times;</button>
          </div>
        )}

        {/* --- CHAT FEED --- */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-7 max-w-4xl w-full mx-auto min-w-0 custom-scrollbar">
            
            {/* HERO LANDING (Claude & ChatGPT Hybrid) */}
            {messages.length === 0 && (
              <div className="h-full flex flex-col justify-center items-center text-center space-y-8 my-auto py-12 animate-fade-in">
                <div className="space-y-3.5">
                  <div className="inline-flex p-4 rounded-3xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-pink-500/10 border border-white/[0.1] text-indigo-400 shadow-2xl relative">
                    <Sparkles size={32} className="animate-pulse" />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                    Where would you like to start, Farhan?
                  </h2>
                  <p className="text-sm text-[#a3acb9] max-w-md mx-auto leading-relaxed">
                    Kio is ready with Claude Haiku intelligence, document review, and multimodal vision.
                  </p>
                </div>

                {/* Interactive Suggestion Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full max-w-2xl text-left">
                  {heroSuggestions.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSend(item.prompt)}
                        className="p-4 rounded-2xl border border-white/[0.08] bg-[#181b21]/70 hover:bg-[#232831]/80 hover:border-indigo-500/40 transition-all duration-200 group text-left shadow-sm active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-2 text-indigo-400 mb-1.5">
                          <Icon size={17} className="group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-semibold text-zinc-100">{item.title}</span>
                        </div>
                        <p className="text-[12px] text-[#a3acb9] leading-snug">{item.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MESSAGES FLOW */}
            {messages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} group w-full`}>
                <div className="flex items-start gap-3.5 max-w-[94%] md:max-w-[88%] min-w-0">
                  
                  {m.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md mt-1">
                      <Sparkles size={16} />
                    </div>
                  )}

                  <div className="flex-1 space-y-2 min-w-0">
                    
                    {/* Image Attachment Preview */}
                    {m.images && m.images.length > 0 && (
                      <div className="flex flex-wrap gap-2.5 justify-end">
                        {m.images.map((img, i) => (
                          <img key={i} src={img} alt="Uploaded attachment" className="max-w-[260px] max-h-[260px] rounded-2xl object-cover border border-white/[0.12] shadow-lg" />
                        ))}
                      </div>
                    )}

                    {/* Document Badges */}
                    {m.files && m.files.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {m.files.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs shadow-sm">
                            <FileText size={13} className="text-indigo-400" />
                            <span className="font-medium truncate max-w-[180px]">{f.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Content Box */}
                    {editingMsgIdx === idx ? (
                      <div className="p-4 rounded-2xl bg-[#181b21] border border-indigo-500/50 space-y-3">
                        <textarea
                          value={editBuffer}
                          onChange={(e) => setEditBuffer(e.target.value)}
                          className="w-full bg-transparent text-sm text-zinc-100 outline-none resize-none font-sans"
                          rows={3}
                        />
                        <div className="flex justify-end gap-2 text-xs">
                          <button
                            onClick={() => setEditingMsgIdx(null)}
                            className="px-3 py-1.5 rounded-xl text-zinc-400 hover:bg-white/[0.06]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(idx)}
                            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                          >
                            Save & Resubmit
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={`rounded-2xl px-5 py-4 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-xs shadow-md shadow-indigo-600/10'
                          : m.isError
                          ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-bl-xs'
                          : 'bg-[#181b21] border border-white/[0.06] text-[#eceff3] rounded-bl-xs shadow-sm'
                      }`}>
                        {renderMessageContent(m.content)}
                      </div>
                    )}

                    {/* Hover Utility Action Bar */}
                    <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyText(m.content, idx)}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] text-xs flex items-center gap-1 transition"
                        title="Copy text"
                      >
                        {copiedIdx === idx ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        <span className="text-[11px]">{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                      </button>

                      {m.role === 'assistant' && (
                        <>
                          <button
                            onClick={() => setFeedback(idx, 'up')}
                            className={`p-1.5 rounded-lg hover:bg-white/[0.06] transition ${m.feedback === 'up' ? 'text-indigo-400' : 'text-zinc-400 hover:text-white'}`}
                            title="Helpful response"
                          >
                            <ThumbsUp size={13} />
                          </button>
                          <button
                            onClick={() => setFeedback(idx, 'down')}
                            className={`p-1.5 rounded-lg hover:bg-white/[0.06] transition ${m.feedback === 'down' ? 'text-rose-400' : 'text-zinc-400 hover:text-white'}`}
                            title="Report poor response"
                          >
                            <ThumbsDown size={13} />
                          </button>
                          {idx === messages.length - 1 && !isLoading && (
                            <button
                              onClick={handleRegenerate}
                              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] text-xs flex items-center gap-1 transition"
                              title="Regenerate"
                            >
                              <RotateCcw size={13} />
                              <span className="text-[11px]">Retry</span>
                            </button>
                          )}
                        </>
                      )}

                      {m.role === 'user' && editingMsgIdx !== idx && (
                        <button
                          onClick={() => {
                            setEditingMsgIdx(idx);
                            setEditBuffer(m.content);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] text-xs flex items-center gap-1 transition"
                          title="Edit prompt"
                        >
                          <Edit3 size={13} />
                          <span className="text-[11px]">Edit</span>
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            ))}

            {/* MULTI-STAGE REASONING ANIMATION */}
            {isLoading && (
              <div className="flex items-start gap-3.5 max-w-lg pt-1">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md animate-pulse">
                  <Sparkles size={16} />
                </div>
                <div className="p-4 rounded-2xl bg-[#181b21] border border-white/[0.08] space-y-2.5 w-full shadow-xl">
                  <div className="flex items-center justify-between text-xs text-indigo-400 font-medium">
                    <span className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      {thinkingStep === 1 && "1. Tokenizing context & attachments..."}
                      {thinkingStep === 2 && "2. Routing through OmniRoute Gateway..."}
                      {thinkingStep === 3 && "3. Claude Haiku synthesizing answer..."}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Live</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#232831] rounded-full overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full animate-pulse w-3/4" />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* --- FLOATING COMMAND CAPSULE COMPOSER --- */}
          <div className="p-4 md:p-6 max-w-4xl w-full mx-auto shrink-0 pb-[max(1.2rem,env(safe-area-inset-bottom))]">
            
            {/* Attachment preview dock */}
            {attachedItems.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 px-1">
                {attachedItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-[#181b21] border border-indigo-500/40 text-xs text-zinc-200 shadow-lg animate-fade-in">
                    {item.isImage && item.dataUrl ? (
                      <img src={item.dataUrl} alt="preview" className="h-9 w-9 rounded-lg object-cover" />
                    ) : (
                      <FileText size={16} className="text-indigo-400 ml-1.5" />
                    )}
                    <span className="truncate max-w-[150px] font-medium">{item.name}</span>
                    <button onClick={() => setAttachedItems(attachedItems.filter((_, idx) => idx !== i))} className="text-zinc-400 hover:text-rose-400 transition">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Elevated Pill Container */}
            <div className="rounded-2xl border border-white/[0.1] bg-[#181b21]/95 shadow-2xl backdrop-blur-xl focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/15 transition-all">
              
              {/* Text Field */}
              <div className="flex items-end p-2.5 pl-3.5 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isLoading}
                  className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.06] transition disabled:opacity-50 shrink-0"
                  title="Attach photo or document"
                >
                  {isUploading ? <Loader2 size={19} className="animate-spin text-indigo-400" /> : <Paperclip size={19} />}
                </button>

                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  disabled={isLoading}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={attachedItems.length > 0 ? "Ask about this attachment..." : "Message Kio (Shift+Enter for new line)..."}
                  rows={1}
                  className="flex-1 bg-transparent py-2 text-sm outline-none text-[#eceff3] placeholder:text-[#a3acb9] resize-none max-h-40 font-sans leading-relaxed"
                />

                {isLoading ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md transition active:scale-95 flex items-center justify-center shrink-0 animate-pulse"
                    title="Stop generation"
                  >
                    <Square size={16} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!inputMessage.trim() && attachedItems.length === 0}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-30 text-white shadow-md shadow-indigo-600/20 transition active:scale-95 flex items-center justify-center shrink-0"
                    title="Send message"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>

              {/* Tool Mode Toggles Bar */}
              <div className="flex items-center justify-between px-3.5 py-2 border-t border-white/[0.06] text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition text-[11px] font-medium ${
                      webSearchEnabled ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Globe size={13} />
                    <span>Web Research</span>
                  </button>
                  <button
                    onClick={() => setDeepThinkEnabled(!deepThinkEnabled)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition text-[11px] font-medium ${
                      deepThinkEnabled ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Brain size={13} />
                    <span>Deep Reason</span>
                  </button>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">Claude Haiku • 24/7 Cloud</span>
              </div>
            </div>

            <p className="text-[10.5px] text-zinc-500 text-center mt-2 font-medium">
              Kio can make mistakes. Verify critical facts.
            </p>
          </div>
        </div>
      </main>

      {/* --- SETTINGS & DATA CONTROLS MODAL --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181b21] border border-white/[0.1] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-indigo-400" />
                <h3 className="font-bold text-base text-white">Settings & Data Controls</h3>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#232831] space-y-1">
                <p className="font-semibold text-white">User Persona</p>
                <p className="text-zinc-400">Tuned specifically for <strong>Farhan (Faru)</strong></p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#232831] space-y-1">
                <p className="font-semibold text-white">Backend Status</p>
                <p className="text-emerald-400 font-mono text-[11px]">{apiBase}</p>
                <p className="text-[10px] text-zinc-400">Cloud FastAPI companion on Render</p>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  onClick={exportChat}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-white/[0.1] hover:bg-white/[0.06] text-white font-medium transition"
                >
                  <Download size={15} />
                  <span>Export Chat History (JSON)</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm('Clear all conversation history?')) {
                      setConversations([]);
                      setMessages([]);
                      setCurrentConvId(null);
                      setIsSettingsOpen(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-medium border border-rose-500/20 transition"
                >
                  <Trash2 size={15} />
                  <span>Clear Local History</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
