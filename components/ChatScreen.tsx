
import React, { useState, useEffect, useRef } from 'react';
import { createMedicalChat, isAIEnabled } from '../services/geminiService';
import { ChatMessage, ChatSession } from '../types';
import { PROFILE_IMAGE } from '../constants';
import { supabase } from '../services/supabase';

const ChatScreen: React.FC = () => {
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chat, setChat] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (activeSession) {
      fetchMessages(activeSession.id);
      if (activeSession.type === 'AI') {
        if (isAIEnabled) {
          const newChat = createMedicalChat();
          setChat(newChat);
        } else {
          setMessages([{
            id: 'system',
            role: 'model',
            text: 'AI features are currently disabled. Please configure the Gemini API Key to enable the AI Consultant.',
            timestamp: Date.now()
          }]);
        }
      }
    }
  }, [activeSession]);

  async function fetchSessions() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching sessions:', error);
    else setSessions(data || []);
  }

  async function fetchMessages(sessionId: string) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) console.error('Error fetching messages:', error);
    else {
      setMessages(data?.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'model',
        text: m.content,
        timestamp: new Date(m.created_at).getTime()
      })) || []);
    }
  }

  const createNewSession = async (type: 'AI' | 'Peer' = 'AI') => {
    if (type === 'AI' && !isAIEnabled) {
      alert("AI features are disabled. Please configure the Gemini API Key.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        title: type === 'AI' ? 'New AI Consultation' : 'New Peer Chat',
        type
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return;
    }

    setSessions([data, ...sessions]);
    setActiveSession(data);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const saveMessage = async (sessionId: string, role: 'user' | 'model', text: string) => {
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      role,
      content: text
    });
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !activeSession) return;

    const userText = input;
    setInput('');

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    saveMessage(activeSession.id, 'user', userText);

    if (activeSession.type === 'AI' && chat) {
      setIsTyping(true);
      try {
        const result = await chat.sendMessage(userText); // Use simple sendMessage for now to simplify persistence
        const responseText = result.response.text();

        setIsTyping(false);
        const modelMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'model',
          text: responseText,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, modelMessage]);
        saveMessage(activeSession.id, 'model', responseText);

      } catch (error) {
        console.error("Chat error:", error);
        setIsTyping(false);
      }
    } else {
      // Mock Peer Reply
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const replyText = "This is a mock peer response.";
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'model',
          text: replyText,
          timestamp: Date.now()
        }]);
        saveMessage(activeSession.id, 'model', replyText);
      }, 1500);
    }
  };

  if (!activeSession) {
    return (
      <div className="px-6 pt-12 pb-12 flex flex-col h-full animate-in fade-in duration-500">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Messages</h1>
            <p className="text-slate-400 text-xs">Secure peer and AI clinical consultations</p>
          </div>
          <button onClick={() => createNewSession('AI')} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2">
            <span className="material-icons text-sm">add</span>
            New Chat
          </button>
        </header>

        <div className="space-y-4">
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 mb-2">Recent Consultations</h3>
            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() => setActiveSession(session)}
                className="w-full glass-card-enhanced p-4 rounded-2xl flex items-center gap-4 hover:bg-white/[0.04] hover:border-primary/20 transition-all text-left relative group"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center relative ${session.type === 'AI' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-slate-500/10 text-slate-400 border border-white/5'}`}>
                  <span className="material-icons text-2xl">{session.type === 'AI' ? 'psychology' : 'person'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors">{session.title}</h4>
                    <span className="text-[9px] text-slate-600 font-bold uppercase">{new Date(session.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate pr-2">Last active...</p>
                </div>
                <span className="material-icons text-slate-700 text-lg group-hover:text-primary transition-colors">chevron_right</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#050B14] relative animate-in slide-in-from-right-4 duration-300">
      {/* Chat Header */}
      <div className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center gap-4 border-b border-white/10">
        <button onClick={() => setActiveSession(null)} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors">
          <span className="material-icons">arrow_back</span>
        </button>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeSession.type === 'AI' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-white/5 text-slate-400 border border-white/5'}`}>
            <span className="material-icons">{activeSession.type === 'AI' ? 'psychology' : 'person'}</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{activeSession.title}</h3>
            <p className="text-[9px] text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {activeSession.type === 'AI' ? 'AI Consultant Active' : 'Online'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 custom-scrollbar pb-24">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg ${msg.role === 'user'
              ? 'bg-primary text-white rounded-tr-none'
              : 'glass-card-enhanced text-slate-200 border border-white/5 rounded-tl-none'
              }`}>
              {msg.text.split('\n').map((line, i) => (
                <p key={i} className={line.trim() === '' ? 'h-2' : 'mb-1'}>{line}</p>
              ))}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="glass-card-enhanced px-4 py-3 rounded-2xl rounded-tl-none border border-white/5 flex gap-1">
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-4 left-6 right-6 z-50">
        <form onSubmit={sendMessage} className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping}
            placeholder="Discuss case findings..."
            className="w-full bg-[#101c22]/80 backdrop-blur-xl border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-sm text-white focus:ring-1 focus:ring-primary/40 focus:border-primary/50 transition-all placeholder:text-slate-600 shadow-2xl"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg hover:bg-primary-dark transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
          >
            <span className="material-icons">send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatScreen;
