import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Plus, Trash2, Shield, Loader2, Sparkles, Sun, Moon, 
  Send, Square, Copy, Check, ChevronLeft, ChevronRight, 
  Paperclip, FileText, X, Search, FileCode, ImageIcon
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
  isError?: boolean;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'admin'>('chat');
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem('kio-theme') !== 'light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const apiBase = window.location.hostname === 'localhost' ? 'http://127.0.0.1:8000' : 'https://kio-backend-g7t0.onrender.com';
    ? `http://${window.location.hostname}:8000` 
    : 'http://127.0.0.1:8000';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [attachedItems, setAttachedItems] = useState<AttachedItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kio-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kio-theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (window.innerWidth >= 768) setIsSidebarOpen(true);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
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
        if (data.length > 0 && !currentConvId) selectConversation(data[0].id);
      }
    } catch {
      setErrorNotice('Cannot connect to backend. Verify Wi-Fi network.');
    }
  };

  const selectConversation = async (convId: string) => {
    setCurrentConvId(convId);
    setActiveTab('chat');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
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
        body: JSON.stringify({ title: 'New Conversation' })
      });
      if (res.ok) {
        const newConv = await res.json();
        setConversations((prev) => [newConv, ...prev]);
        setCurrentConvId(newConv.id);
        setMessages([]);
        setAttachedItems([]);
        setActiveTab('chat');
        if (window.innerWidth < 768) setIsSidebarOpen(false);
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

  useEffect(() => {
    loadConversations();
  }, []);

  // Multimodal File & Image Selector
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      if (file.type.startsWith('image/')) {
        // Read as Base64 Data URL for Vision
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

  const handleSend = async () => {
    const rawText = inputMessage.trim();
    if ((!rawText && attachedItems.length === 0) || isLoading) return;

    setErrorNotice(null);
    let targetConvId = currentConvId;

    if (!targetConvId) {
      try {
        const title = (rawText || attachedItems[0]?.name || 'Photo Analysis').slice(0, 30);
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

    // Separate Images & Documents
    const imagesToSend: string[] = [];
    const docFiles: { name: string; size: number }[] = [];
    let textPayload = rawText;

    attachedItems.forEach((item) => {
      if (item.isImage && item.dataUrl) {
        imagesToSend.push(item.dataUrl);
      } else if (item.text) {
        docFiles.push({ name: item.name, size: item.size });
        textPayload = `[FILE: ${item.name}]\n${item.text}\n[END FILE]\n\n${textPayload}`;
      }
    });

    setInputMessage('');
    setAttachedItems([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: rawText || (imagesToSend.length > 0 ? 'Examine this image' : ''),
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
          message: textPayload || 'Please describe and analyze this image in detail.',
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
          { role: 'assistant', content: `?? Error: ${err.message}`, isError: true }
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className={`flex h-dvh w-full overflow-hidden ${darkMode ? 'bg-[#0B0C10] text-[#E4E6EA]' : 'bg-[#FAFAFB] text-[#141518]'}`}>
      
      {/* Accepts Images, PDF, Code, Docs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
        accept="image/*,.pdf,.txt,.md,.py,.js,.json,.csv" 
      />

      {/* Sidebar */}
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 duration-200 transition-all overflow-hidden flex flex-col border-r shrink-0 select-none ${
        isSidebarOpen ? 'w-72 shadow-2xl md:shadow-none' : 'w-0'
      } ${darkMode ? 'border-zinc-800/80 bg-[#101115]' : 'border-zinc-200 bg-white'}`}>
        <div className="p-3.5 space-y-3.5 flex-1 flex flex-col min-w-[18rem] overflow-hidden">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white shadow-md">
                <Sparkles size={16} />
              </div>
              <div>
                <h1 className="font-semibold text-sm tracking-tight text-white">KIO</h1>
                <p className="text-[10.5px] text-zinc-400 font-medium">Vision & Intelligence</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">
                {darkMode ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">
                <X size={17} />
              </button>
            </div>
          </div>

          <button onClick={createNewChat} className="w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-semibold shadow-sm transition active:scale-[0.99]">
            <div className="flex items-center gap-2">
              <Plus size={16} />
              <span>New Conversation</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 font-mono">New</span>
          </button>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-2 pt-1 pb-1">History</p>
            {conversations.map((conv) => (
              <div key={conv.id} onClick={() => selectConversation(conv.id)} className={`w-full group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition ${
                currentConvId === conv.id ? 'bg-indigo-600/15 text-indigo-400 font-medium border border-indigo-500/20' : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
              }`}>
                <div className="flex items-center gap-2.5 truncate">
                  <MessageSquare size={13} className="shrink-0 opacity-60" />
                  <span className="truncate">{conv.title || 'Conversation'}</span>
                </div>
                <button onClick={(e) => deleteChat(e, conv.id)} className="p-1 hover:text-rose-400 text-zinc-500 rounded">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <header className="flex items-center justify-between py-3 px-4 border-b border-zinc-800/40 bg-inherit shrink-0 z-20">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-300">
              {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
            <span className="font-semibold text-sm">Kio</span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Vision Ready
            </div>
          </div>
          <button onClick={createNewChat} className="p-2 rounded-xl bg-indigo-600 text-white">
            <Plus size={15} />
          </button>
        </header>

        {errorNotice && (
          <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 text-xs text-rose-300 flex justify-between">
            <span>{errorNotice}</span>
            <button onClick={() => setErrorNotice(null)}>&times;</button>
          </div>
        )}

        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 space-y-5 max-w-4xl w-full mx-auto min-w-0 custom-scrollbar">
            {messages.length === 0 && (
              <div className="h-full flex flex-col justify-center items-center text-center space-y-4 my-auto py-10">
                <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 text-indigo-400">
                  <Sparkles size={24} />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-white">Hey Farhan, I&apos;m ready.</h2>
                <p className="text-xs text-zinc-400 max-w-sm">Attach a photo, screenshot, or document to analyze it together.</p>
              </div>
            )}

            {messages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} group w-full`}>
                <div className="flex items-start gap-3 max-w-[92%] md:max-w-[85%] min-w-0">
                  {m.role === 'assistant' && (
                    <div className="h-7 w-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 mt-1 shadow-sm">
                      <Sparkles size={14} />
                    </div>
                  )}

                  <div className="flex-1 space-y-2 min-w-0">
                    {/* Render Image Thumbnail in Message */}
                    {m.images && m.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 justify-end">
                        {m.images.map((img, i) => (
                          <img key={i} src={img} alt="Uploaded" className="max-w-[220px] max-h-[220px] rounded-2xl object-cover border border-indigo-400/30 shadow-md" />
                        ))}
                      </div>
                    )}

                    {/* Content */}
                    <div className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                      m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-xs' : 'bg-zinc-900/80 border border-zinc-800 text-zinc-100 rounded-bl-xs'
                    }`}>
                      {m.content}
                    </div>

                    <button onClick={() => copyText(m.content, idx)} className="p-1 text-zinc-400 hover:text-zinc-200 text-xs flex items-center gap-1">
                      {copiedIdx === idx ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span className="text-[10px]">{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 text-xs text-indigo-400 max-w-md animate-pulse py-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Kio is examining and processing...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Composer */}
          <div className="p-3 md:p-5 max-w-4xl w-full mx-auto shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            
            {/* Attached Thumbnails / Chips */}
            {attachedItems.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 px-1">
                {attachedItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-xs text-zinc-200 shadow-sm animate-fade-in">
                    {item.isImage && item.dataUrl ? (
                      <img src={item.dataUrl} alt="preview" className="h-8 w-8 rounded-lg object-cover" />
                    ) : (
                      <FileText size={15} className="text-indigo-400 ml-1" />
                    )}
                    <span className="truncate max-w-[140px] font-medium">{item.name}</span>
                    <button onClick={() => setAttachedItems(attachedItems.filter((_, idx) => idx !== i))} className="text-zinc-400 hover:text-rose-400">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900 shadow-xl focus-within:border-indigo-500/60 transition-all">
              <div className="flex items-end p-2 pl-3 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isLoading}
                  className="p-2 text-zinc-400 hover:text-zinc-200 rounded-xl hover:bg-zinc-800 transition shrink-0"
                  title="Attach image or file"
                >
                  {isUploading ? <Loader2 size={18} className="animate-spin text-indigo-400" /> : <Paperclip size={18} />}
                </button>

                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  disabled={isLoading}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Message Kio or ask about this photo..."
                  rows={1}
                  className="flex-1 bg-transparent py-2 text-sm outline-none text-zinc-100 placeholder:text-zinc-500 resize-none max-h-36 font-sans leading-relaxed"
                />

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputMessage.trim() && attachedItems.length === 0}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white shadow-md transition active:scale-95 flex items-center justify-center shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
