import React, { useState, useEffect, useRef } from 'react';
import { 
  PanelLeft, SquarePen, ChevronDown, Plus, Trash2, Settings, 
  ArrowUp, Square, Copy, Check, Paperclip, X, Search, 
  ThumbsUp, ThumbsDown, RotateCcw, Edit2, Globe, Brain, 
  Mic, Download, Sparkles, Sun, Moon, FileText, CheckCircle2
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'personalization' | 'data'>('general');
  const [selectedModel, setSelectedModel] = useState<'Kio 4o' | 'Kio 4o mini' | 'Kio o1'>('Kio 4o');

  // Dynamic API Base URL
  const apiBase = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://127.0.0.1:8000'
    : 'https://kio-backend-g7t0.onrender.com';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer Features
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [deepThinkEnabled, setDeepThinkEnabled] = useState(false);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [editingMsgIdx, setEditingMsgIdx] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState('');
  const [attachedItems, setAttachedItems] = useState<AttachedItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

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

  // Mobile sidebar default
  useEffect(() => {
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, []);

  // Textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputMessage]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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
    } catch (err) {
      console.error(err);
    }
  };

  const selectConversation = async (convId: string) => {
    setCurrentConvId(convId);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    try {
      const res = await fetch(`${apiBase}/api/conversations/${convId}/messages`);
      if (res.ok) {
        const msgs = await res.json();
        setMessages(msgs.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
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
        body: JSON.stringify({ title: 'New chat' })
      });
      if (res.ok) {
        const newConv = await res.json();
        setConversations((prev) => [newConv, ...prev]);
        setCurrentConvId(newConv.id);
        setMessages([]);
        setAttachedItems([]);
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
      }
    } catch (err) {
      console.error(err);
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

  useEffect(() => {
    loadConversations();
  }, []);

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

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const rawText = (customPrompt || inputMessage).trim();
    if ((!rawText && attachedItems.length === 0) || isLoading) return;

    let targetConvId = currentConvId;
    if (!targetConvId) {
      try {
        const snippet = (rawText || attachedItems[0]?.name || 'New chat').slice(0, 30);
        const res = await fetch(`${apiBase}/api/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: snippet })
        });
        const newConv = await res.json();
        targetConvId = newConv.id;
        setCurrentConvId(newConv.id);
        setConversations((prev) => [newConv, ...prev]);
      } catch {
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
        textPayload = `--- DOCUMENT: ${item.name} ---\n${item.text}\n--- END DOCUMENT ---\n\n${textPayload}`;
      }
    });

    if (webSearchEnabled) textPayload = `[SEARCH: Prioritize current factual research]\n${textPayload}`;
    if (deepThinkEnabled) textPayload = `[REASON: Think step-by-step with deep technical rigor]\n${textPayload}`;

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
          message: textPayload || 'Please analyze this.',
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
          { role: 'assistant', content: `Something went wrong. Please check your connection or retry in a moment. (${err.message})`, isError: true }
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

  const exportChat = () => {
    const blob = new Blob([JSON.stringify({ conversation_id: currentConvId, messages }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${currentConvId || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render ChatGPT Markdown
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
      <div className="space-y-4 leading-[1.75] text-[16px] antialiased">
        {parts.map((p, i) => {
          if (p.type === 'code') {
            const blockId = `code-block-${i}`;
            return (
              <div key={i} className="my-5 rounded-2xl overflow-hidden bg-black border border-white/[0.08] font-mono text-[13px]">
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#171717] text-zinc-400 border-b border-white/[0.06]">
                  <span className="text-xs font-sans text-zinc-400 lowercase">{p.language}</span>
                  <button
                    onClick={() => copyCode(p.value, blockId)}
                    className="flex items-center gap-1.5 hover:text-white px-2 py-1 rounded transition text-xs font-sans"
                  >
                    {copiedCodeId === blockId ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copiedCodeId === blockId ? 'Copied!' : 'Copy code'}</span>
                  </button>
                </div>
                <pre className="p-4 overflow-x-auto text-zinc-100 selection:bg-zinc-700">
                  <code>{p.value}</code>
                </pre>
              </div>
            );
          }

          const paragraphs = p.value.split('\n\n');
          return (
            <div key={i} className="space-y-4">
              {paragraphs.map((para, pIdx) => {
                if (para.startsWith('# ')) return <h1 key={pIdx} className="text-2xl font-bold text-white mt-4">{para.slice(2)}</h1>;
                if (para.startsWith('## ')) return <h2 key={pIdx} className="text-xl font-bold text-white mt-3">{para.slice(3)}</h2>;
                if (para.startsWith('### ')) return <h3 key={pIdx} className="text-lg font-semibold text-white mt-2">{para.slice(4)}</h3>;
                if (para.startsWith('> ')) return <blockquote key={pIdx} className="border-l-2 border-white pl-4 italic text-zinc-300">{para.slice(2)}</blockquote>;

                const formatted = para.split(/(\*\*.*?\*\*|`.*?`)/g).map((seg, sIdx) => {
                  if (seg.startsWith('**') && seg.endsWith('**')) return <strong key={sIdx} className="font-semibold text-white">{seg.slice(2, -2)}</strong>;
                  if (seg.startsWith('`') && seg.endsWith('`')) return <code key={sIdx} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-100 font-mono text-[14px]">{seg.slice(1, -1)}</code>;
                  return seg;
                });

                return <p key={pIdx} className="whitespace-pre-wrap">{formatted}</p>;
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

  return (
    <div className={`flex h-dvh w-full overflow-hidden ${darkMode ? 'bg-[#212121] text-[#ececec]' : 'bg-white text-zinc-900'} font-sans`}>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
        accept="image/*,.pdf,.txt,.md,.py,.js,.json,.csv" 
      />

      {/* --- CHATGPT SIDEBAR --- */}
      <aside 
        className={`fixed lg:relative inset-y-0 left-0 z-50 duration-200 transition-all overflow-hidden flex flex-col border-r shrink-0 select-none ${
          isSidebarOpen ? 'w-64 shadow-2xl lg:shadow-none' : 'w-0'
        } ${darkMode ? 'border-transparent bg-[#171717]' : 'border-zinc-200 bg-[#f9f9f9]'}`}
      >
        <div className="p-3 space-y-2 flex-1 flex flex-col min-w-[16rem] overflow-hidden">
          
          {/* Sidebar Top: Collapse & New Chat */}
          <div className="flex items-center justify-between px-1.5 py-1">
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
              title="Close sidebar"
            >
              <PanelLeft size={18} />
            </button>

            <button
              onClick={createNewChat}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
              title="New chat"
            >
              <SquarePen size={18} />
            </button>
          </div>

          {/* Search History */}
          <div className="relative pt-1 px-1">
            <Search size={14} className="absolute left-3.5 top-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none bg-zinc-800/60 border border-transparent focus:border-zinc-700 text-zinc-200"
            />
          </div>

          {/* Conversations History */}
          <div className="flex-1 overflow-y-auto space-y-0.5 pt-2 px-1 custom-scrollbar">
            <p className="text-[11px] font-semibold text-zinc-500 px-2 py-1">Recent</p>
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`w-full group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition ${
                  currentConvId === conv.id
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
                }`}
              >
                <span className="truncate flex-1">{conv.title || 'Conversation'}</span>
                <button
                  onClick={(e) => deleteChat(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-zinc-400 rounded"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* User Account / Settings Row at Bottom */}
        <div className="p-3 border-t border-zinc-800 bg-[#171717] min-w-[16rem]">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800 transition text-xs text-zinc-300"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-purple-600 flex items-center justify-center font-bold text-white text-xs">
                F
              </div>
              <div className="text-left leading-tight">
                <p className="font-semibold text-white">Farhan</p>
                <p className="text-[10px] text-zinc-400">Settings</p>
              </div>
            </div>
            <Settings size={15} className="text-zinc-400" />
          </button>
        </div>
      </aside>

      {/* --- MAIN CHAT STAGE --- */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        
        {/* Top Header: Hamburger, Model Picker & New Chat */}
        <header className="flex items-center justify-between py-2.5 px-3.5 border-b border-transparent bg-inherit shrink-0 z-20">
          <div className="flex items-center gap-1.5">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                title="Open sidebar"
              >
                <PanelLeft size={19} />
              </button>
            )}

            {!isSidebarOpen && (
              <button
                onClick={createNewChat}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                title="New chat"
              >
                <SquarePen size={18} />
              </button>
            )}

            {/* Model Picker Pill */}
            <div className="relative">
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-zinc-800/80 transition text-sm font-semibold text-zinc-200"
              >
                <span>{selectedModel}</span>
                <ChevronDown size={15} className="text-zinc-400" />
              </button>

              {/* Model Dropdown Menu */}
              {isModelDropdownOpen && (
                <div className="absolute left-0 top-10 mt-1 w-64 rounded-2xl bg-[#2f2f2f] border border-zinc-700 shadow-2xl p-1.5 z-50 text-xs">
                  <button
                    onClick={() => { setSelectedModel('Kio 4o'); setIsModelDropdownOpen(false); }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-700 text-left transition"
                  >
                    <div>
                      <p className="font-semibold text-white flex items-center gap-1.5">
                        <Sparkles size={14} className="text-purple-400" /> Kio 4o
                      </p>
                      <p className="text-[11px] text-zinc-400">OmniRoute Claude • Smartest</p>
                    </div>
                    {selectedModel === 'Kio 4o' && <CheckCircle2 size={16} className="text-white" />}
                  </button>

                  <button
                    onClick={() => { setSelectedModel('Kio 4o mini'); setIsModelDropdownOpen(false); }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-700 text-left transition"
                  >
                    <div>
                      <p className="font-semibold text-white">Kio 4o mini</p>
                      <p className="text-[11px] text-zinc-400">Fast & lightweight everyday tasks</p>
                    </div>
                    {selectedModel === 'Kio 4o mini' && <CheckCircle2 size={16} className="text-white" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
              title="Theme"
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        {/* --- CHAT FEED --- */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-6 max-w-3xl w-full mx-auto min-w-0 custom-scrollbar">
            
            {/* ChatGPT Empty State */}
            {messages.length === 0 && (
              <div className="h-full flex flex-col justify-center items-center text-center space-y-6 my-auto py-16">
                <h2 className="text-3xl font-semibold text-white">What can I help with?</h2>
              </div>
            )}

            {/* Messages */}
            {messages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} group w-full`}>
                <div className={`w-full max-w-3xl ${m.role === 'user' ? 'flex justify-end' : 'flex items-start gap-4'}`}>
                  
                  {m.role === 'assistant' && (
                    <div className="h-7 w-7 rounded-full bg-white text-black flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                      K
                    </div>
                  )}

                  <div className="space-y-2 min-w-0 flex-1">
                    
                    {/* User Image Thumbnail */}
                    {m.images && m.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 justify-end mb-2">
                        {m.images.map((img, i) => (
                          <img key={i} src={img} alt="Uploaded attachment" className="max-w-[240px] max-h-[240px] rounded-2xl object-cover border border-zinc-700 shadow-md" />
                        ))}
                      </div>
                    )}

                    {/* Document Badge */}
                    {m.files && m.files.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 justify-end mb-2">
                        {m.files.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-200 text-xs">
                            <FileText size={14} />
                            <span className="font-medium truncate max-w-[180px]">{f.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bubble for User, Open Editorial Layout for Assistant */}
                    {editingMsgIdx === idx ? (
                      <div className="p-3 bg-[#2f2f2f] rounded-2xl space-y-2">
                        <textarea
                          value={editBuffer}
                          onChange={(e) => setEditBuffer(e.target.value)}
                          className="w-full bg-transparent text-sm text-white outline-none resize-none font-sans"
                          rows={3}
                        />
                        <div className="flex justify-end gap-2 text-xs">
                          <button onClick={() => setEditingMsgIdx(null)} className="px-3 py-1 text-zinc-400 hover:text-white">Cancel</button>
                          <button onClick={() => handleSaveEdit(idx)} className="px-3 py-1 bg-white text-black font-semibold rounded-lg">Send</button>
                        </div>
                      </div>
                    ) : (
                      <div className={m.role === 'user' ? 'bg-[#2f2f2f] text-white px-5 py-3 rounded-[24px] max-w-[85%] ml-auto text-[15px]' : 'text-[#ececec]'}>
                        {renderMessageContent(m.content)}
                      </div>
                    )}

                    {/* ChatGPT Hover Action Bar */}
                    <div className="flex items-center gap-1.5 pt-1 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyText(m.content, idx)}
                        className="p-1 hover:text-white rounded"
                        title="Copy"
                      >
                        {copiedIdx === idx ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>

                      {m.role === 'assistant' && (
                        <>
                          <button onClick={() => handleRegenerate()} className="p-1 hover:text-white rounded" title="Regenerate">
                            <RotateCcw size={14} />
                          </button>
                          <button onClick={() => alert('Rated helpful!')} className="p-1 hover:text-white rounded" title="Good response">
                            <ThumbsUp size={14} />
                          </button>
                          <button onClick={() => alert('Feedback noted')} className="p-1 hover:text-white rounded" title="Bad response">
                            <ThumbsDown size={14} />
                          </button>
                        </>
                      )}

                      {m.role === 'user' && editingMsgIdx !== idx && (
                        <button
                          onClick={() => { setEditingMsgIdx(idx); setEditBuffer(m.content); }}
                          className="p-1 hover:text-white rounded"
                          title="Edit message"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            ))}

            {/* Thinking / Streaming Indicator */}
            {isLoading && (
              <div className="flex items-center gap-3 text-sm text-zinc-400 max-w-3xl">
                <div className="h-7 w-7 rounded-full bg-white text-black flex items-center justify-center font-bold text-xs shrink-0 animate-pulse">
                  K
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce" />
                  <span className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* --- THE ICONIC CHATGPT COMPOSER PILL --- */}
          <div className="p-4 md:p-6 max-w-3xl w-full mx-auto shrink-0 pb-[max(1.2rem,env(safe-area-inset-bottom))]">
            
            {/* Attachment preview pills */}
            {attachedItems.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 px-1">
                {attachedItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-[#2f2f2f] text-xs text-zinc-200">
                    {item.isImage && item.dataUrl ? (
                      <img src={item.dataUrl} alt="preview" className="h-8 w-8 rounded-lg object-cover" />
                    ) : (
                      <FileText size={15} className="ml-1" />
                    )}
                    <span className="truncate max-w-[140px]">{item.name}</span>
                    <button onClick={() => setAttachedItems(attachedItems.filter((_, idx) => idx !== i))} className="hover:text-rose-400">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* The Capsule */}
            <div className="rounded-[28px] bg-[#2f2f2f] border border-transparent focus-within:border-zinc-600 transition shadow-xl p-2.5 pl-3.5">
              
              <div className="flex items-end gap-2">
                {/* Plus / Attach Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isLoading}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-700/60 transition shrink-0"
                  title="Attach"
                >
                  <Plus size={20} />
                </button>

                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  disabled={isLoading}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Kio"
                  rows={1}
                  className="flex-1 bg-transparent py-2 text-[15px] outline-none text-[#ececec] placeholder:text-zinc-500 resize-none max-h-44 font-sans leading-relaxed"
                />

                {/* Right Action Buttons */}
                <div className="flex items-center gap-1 shrink-0 pb-0.5">
                  <button
                    type="button"
                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                    className={`p-1.5 rounded-full transition ${webSearchEnabled ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-400 hover:text-white'}`}
                    title="Search web"
                  >
                    <Globe size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeepThinkEnabled(!deepThinkEnabled)}
                    className={`p-1.5 rounded-full transition ${deepThinkEnabled ? 'text-purple-400 bg-purple-500/10' : 'text-zinc-400 hover:text-white'}`}
                    title="Deep Reasoning"
                  >
                    <Brain size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => alert('Voice mode is coming soon!')}
                    className="p-1.5 text-zinc-400 hover:text-white rounded-full transition"
                    title="Voice mode"
                  >
                    <Mic size={18} />
                  </button>

                  {/* Send or Stop Circular Pill */}
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="h-8 w-8 rounded-full bg-white text-black flex items-center justify-center transition active:scale-95"
                      title="Stop"
                    >
                      <Square size={13} fill="black" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSend()}
                      disabled={!inputMessage.trim() && attachedItems.length === 0}
                      className="h-8 w-8 rounded-full bg-white text-black disabled:bg-[#424242] disabled:text-[#878787] flex items-center justify-center transition active:scale-95"
                      title="Send"
                    >
                      <ArrowUp size={18} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 text-center mt-2">
              Kio can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </main>

      {/* --- FULL CHATGPT SETTINGS MODAL --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#212121] border border-zinc-700/80 rounded-2xl max-w-2xl w-full flex overflow-hidden shadow-2xl h-[480px]">
            
            {/* Left Nav Tabs */}
            <div className="w-52 bg-[#171717] p-3 border-r border-zinc-800 space-y-1">
              <button
                onClick={() => setSettingsTab('general')}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition ${settingsTab === 'general' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                General
              </button>
              <button
                onClick={() => setSettingsTab('personalization')}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition ${settingsTab === 'personalization' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                Personalization
              </button>
              <button
                onClick={() => setSettingsTab('data')}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition ${settingsTab === 'data' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                Data controls
              </button>
            </div>

            {/* Right Tab Content */}
            <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                  <h3 className="font-semibold text-base text-white capitalize">{settingsTab}</h3>
                  <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-400 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                {settingsTab === 'general' && (
                  <div className="py-4 space-y-4 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white text-sm">Theme</p>
                        <p className="text-zinc-400">Choose appearance</p>
                      </div>
                      <button
                        onClick={() => setDarkMode(!darkMode)}
                        className="px-3 py-1.5 bg-zinc-800 rounded-lg text-zinc-200 border border-zinc-700"
                      >
                        {darkMode ? 'Dark' : 'Light'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                      <div>
                        <p className="font-medium text-white text-sm">Delete all chats</p>
                        <p className="text-zinc-400">Permanently clear conversation history</p>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('Clear all conversation history?')) {
                            setConversations([]);
                            setMessages([]);
                            setCurrentConvId(null);
                            setIsSettingsOpen(false);
                          }
                        }}
                        className="px-3 py-1.5 bg-rose-600/20 text-rose-300 rounded-lg border border-rose-500/30"
                      >
                        Delete all
                      </button>
                    </div>
                  </div>
                )}

                {settingsTab === 'personalization' && (
                  <div className="py-4 space-y-4 text-xs">
                    <div>
                      <p className="font-medium text-white text-sm">Custom Instructions</p>
                      <p className="text-zinc-400 mt-1">Configured for <strong>Farhan (Faru)</strong></p>
                    </div>
                    <div className="p-3 bg-zinc-800/80 rounded-xl text-zinc-300 leading-relaxed">
                      Kio speaks warmly and conversationally without corporate disclaimers, calling you Farhan or Faru naturally.
                    </div>
                  </div>
                )}

                {settingsTab === 'data' && (
                  <div className="py-4 space-y-4 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white text-sm">Export data</p>
                        <p className="text-zinc-400">Download your chat history as JSON</p>
                      </div>
                      <button
                        onClick={exportChat}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 rounded-lg text-white border border-zinc-700"
                      >
                        <Download size={14} /> Export
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-zinc-800 flex justify-end">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 bg-white text-black font-semibold rounded-xl text-xs"
                >
                  Done
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
