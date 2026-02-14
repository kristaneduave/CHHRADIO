import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, ChatSession, Profile } from '../types'; // Added Profile
import { PROFILE_IMAGE } from '../constants';
import { supabase } from '../services/supabase';

const ChatScreen: React.FC = () => {
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const subscriptionRef = useRef<any>(null); // To store valid subscription

  // New Chat Modal State
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    fetchSessions();
    fetchCurrentUser();

    return () => {
      // Cleanup subscription on unmount
      if (subscriptionRef.current) supabase.removeChannel(subscriptionRef.current);
    };
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setCurrentUserProfile(data);
    }
  }

  useEffect(() => {
    if (activeSession) {
      fetchMessages(activeSession.id);

      // Subscribe to new messages for this session
      const channel = supabase
        .channel(`chat:${activeSession.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `session_id=eq.${activeSession.id}`
          },
          (payload) => {
            console.log('New message received!', payload);
            const newMessage = payload.new;

            // Avoid duplicating own messages if we optimistically added them
            // Or just append. Since we optimized locally, we might need a check
            // For simplicity, let's just append if the ID is not already in list.
            // Actually, simpler to just append if the ID is not already in list.
            setMessages((prev) => {
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [...prev, {
                id: newMessage.id,
                role: newMessage.role as 'user' | 'model', // 'model' effectively 'peer' here
                text: newMessage.content,
                timestamp: new Date(newMessage.created_at).getTime()
              }];
            });
          }
        )
        .subscribe();

      subscriptionRef.current = channel;

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeSession]);

  async function fetchSessions() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch sessions where the user is a participant
    // Note: We use 'cs' (contains) for array column
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .contains('participants', [user.id])
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

  const handleOpenNewChat = async () => {
    setShowNewChatModal(true);
    setIsLoadingUsers(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch all profiles except current user
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id);

    if (error) {
      console.error("Error fetching profiles:", error);
    } else {
      setAvailableUsers(data || []);
    }
    setIsLoadingUsers(false);
  };

  const createPeerSession = async (peer: Profile) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if session already exists? (Optional optimization)
    // For now, just create new.

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id, // Creator
        title: peer.full_name || peer.username || 'Chat',
        type: 'Peer',
        participants: [user.id, peer.id]
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      alert('Failed to create chat');
      return;
    }

    setSessions([data, ...sessions]);
    setActiveSession(data);
    setShowNewChatModal(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !activeSession) return;

    const userText = input;
    setInput('');

    try {
      await supabase.from('chat_messages').insert({
        session_id: activeSession.id,
        role: 'user',
        content: userText
      });
      // Verification via subscription will update UI
    } catch (err) {
      console.error("Error sending message", err);
    }
  };

  if (!activeSession) {
    return (
      <div className="px-6 pt-12 pb-12 flex flex-col h-full animate-in fade-in duration-500 relative">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Messages</h1>
            <p className="text-slate-400 text-xs">Secure peer consultations</p>
          </div>
          <button onClick={handleOpenNewChat} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2">
            <span className="material-icons text-sm">add</span>
            New Chat
          </button>
        </header>

        <div className="space-y-4">
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 mb-2">Recent Consultations</h3>
            {sessions.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-8">No active chats. Start one with a colleague!</p>
            ) : (
              sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => setActiveSession(session)}
                  className="w-full glass-card-enhanced p-4 rounded-2xl flex items-center gap-4 hover:bg-white/[0.04] hover:border-primary/20 transition-all text-left relative group"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center relative bg-slate-500/10 text-slate-400 border border-white/5`}>
                    <span className="material-icons text-2xl">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors">{session.title}</h4>
                      <span className="text-[9px] text-slate-600 font-bold uppercase">{new Date(session.created_at || Date.now()).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate pr-2">Tap to view conversation...</p>
                  </div>
                  <span className="material-icons text-slate-700 text-lg group-hover:text-primary transition-colors">chevron_right</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* New Chat Modal */}
        {showNewChatModal && (
          <div className="absolute inset-0 z-50 bg-[#050B14]/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="w-full max-w-sm glass-card-enhanced rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[80%]">
              <div className="p-4 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-sm font-bold text-white">Select Colleague</h3>
                <button onClick={() => setShowNewChatModal(false)} className="text-slate-400 hover:text-white">
                  <span className="material-icons text-sm">close</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {isLoadingUsers ? (
                  <p className="text-center text-xs text-slate-500 py-4">Loading users...</p>
                ) : availableUsers.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-4">No other users found.</p>
                ) : (
                  availableUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => createPeerSession(user)}
                      className="w-full p-3 rounded-xl hover:bg-white/5 flex items-center gap-3 transition-colors text-left"
                    >
                      <img src={user.avatar_url || PROFILE_IMAGE} className="w-10 h-10 rounded-full object-cover bg-slate-800" alt="" />
                      <div>
                        <p className="text-sm font-bold text-white">{user.full_name || user.username || 'Unknown User'}</p>
                        <p className="text-[10px] text-slate-400">{user.year_level || 'Resident'} • {user.bio ? user.bio.substring(0, 20) + '...' : 'No bio'}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
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
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 text-slate-400 border border-white/5`}>
            <span className="material-icons">person</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{activeSession.title}</h3>
            <p className="text-[9px] text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Online
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 custom-scrollbar pb-24">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            {/* Avatar for other user (mock for now, or profile image) */}
            {msg.role !== 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center mr-2 self-end mb-1">
                <span className="material-icons text-xs text-slate-300">person</span>
              </div>
            )}
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg ${msg.role === 'user'
              ? 'bg-primary text-white rounded-tr-none'
              : 'glass-card-enhanced text-slate-200 border border-white/5 rounded-tl-none'
              }`}>
              {msg.text.split('\n').map((line, i) => (
                <p key={i} className={line.trim() === '' ? 'h-2' : 'mb-1'}>{line}</p>
              ))}
            </div>
            {/* Avatar for current user */}
            {msg.role === 'user' && currentUserProfile?.avatar_url && (
              <img src={currentUserProfile.avatar_url} className="w-8 h-8 rounded-full ml-2 self-end mb-1 object-cover" alt="Me" />
            )}
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
            placeholder="Type a message..."
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
