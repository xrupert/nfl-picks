import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useLeagueStore } from '../store/leagueStore';
import { supabase } from '../lib/supabase';

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function Chat() {
  const { leagueId } = useParams();
  const profile = useAuthStore((s) => s.profile);
  const userId = useAuthStore((s) => s.session?.user?.id);
  const members = useLeagueStore((s) => s.members);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [chatHeight, setChatHeight] = useState(null);
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  // Always-current memberMap for use inside subscription callbacks
  const memberMapRef = useRef({});
  memberMapRef.current = Object.fromEntries(members.map((m) => [m.user_id, m]));

  // Visual viewport API: keep input above keyboard on mobile
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      if (!containerRef.current) return;
      const top = containerRef.current.getBoundingClientRect().top;
      setChatHeight(Math.max(320, vv.height - top - 12));
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  // Load history then subscribe to new messages
  useEffect(() => {
    if (!leagueId || !userId) return;

    // Load last 100 messages with profile info
    supabase
      .from('league_messages')
      .select('id, user_id, content, created_at, profiles(username, avatar_url)')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data) {
          setMessages(
            data.map((m) => ({
              id: m.id,
              user_id: m.user_id,
              username: m.profiles?.username ?? null,
              avatar_url: m.profiles?.avatar_url ?? null,
              content: m.content,
              created_at: m.created_at,
            }))
          );
        }
      });

    // Real-time: other users' inserts arrive here
    const channel = supabase
      .channel(`league-chat-realtime-${leagueId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'league_messages', filter: `league_id=eq.${leagueId}` },
        ({ new: row }) => {
          const member = memberMapRef.current[row.user_id];
          setMessages((prev) => {
            // Skip if we already have this row (optimistic message was given the real id)
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                user_id: row.user_id,
                username: member?.username ?? null,
                avatar_url: member?.avatar_url ?? null,
                content: row.content,
                created_at: row.created_at,
              },
            ];
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnected(true);
      });

    return () => {
      supabase.removeChannel(channel);
      setConnected(false);
    };
  }, [leagueId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content || !connected) return;

    // Clear input immediately — feels instant
    setText('');
    inputRef.current?.focus();

    // Show optimistic message right away
    const optimisticId = `opt-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        user_id: userId,
        username: profile?.username ?? 'You',
        avatar_url: profile?.avatar_url ?? null,
        content,
        created_at: new Date().toISOString(),
      },
    ]);

    // Persist to DB — postgres_changes broadcasts it to everyone else
    const { data, error } = await supabase
      .from('league_messages')
      .insert({ league_id: leagueId, user_id: userId, content })
      .select('id')
      .single();

    if (!error && data) {
      // Swap the optimistic id for the real DB uuid
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...m, id: data.id } : m))
      );
    }
  }, [text, connected, userId, profile, leagueId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const heightStyle = chatHeight
    ? { height: chatHeight }
    : { height: 'calc(100vh - 240px)', minHeight: 320 };

  return (
    <div ref={containerRef} className="flex flex-col" style={heightStyle}>
      {/* Status bar */}
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        <span className="text-xs text-slate-500">
          {connected ? 'Live · history saved' : 'Connecting…'}
        </span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && connected && (
          <p className="mt-12 text-center text-sm text-slate-400">
            No messages yet. Start the trash talk.
          </p>
        )}

        {messages.map((msg) => {
          const sender = memberMapRef.current[msg.user_id];
          const isMe = msg.user_id === userId;
          const name = msg.username ?? sender?.username ?? 'Unknown';
          const avatar = msg.avatar_url ?? sender?.avatar_url;

          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className="shrink-0">
                {avatar ? (
                  <img src={avatar} alt={name} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${isMe ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {name[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className={`flex max-w-[78%] flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                  <span className="px-1 text-[11px] font-semibold text-slate-500">{name}</span>
                )}
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-snug ${isMe ? 'rounded-br-sm bg-emerald-500 text-white' : 'rounded-bl-sm border border-slate-100 bg-white text-slate-900 shadow-sm'}`}>
                  {msg.content}
                </div>
                <span className="px-1 text-[10px] text-slate-400">{timeAgo(msg.created_at)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input — safe-area-inset-bottom for iPhone home bar */}
      <form
        onSubmit={handleSubmit}
        className="mt-3 flex gap-2 border-t border-slate-200 pt-3"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={connected ? 'Talk some smack…' : 'Connecting…'}
          className="input flex-1 text-base"
          maxLength={500}
          autoComplete="off"
          enterKeyHint="send"
          disabled={!connected}
        />
        <button
          type="submit"
          disabled={!text.trim() || !connected}
          className="btn-primary shrink-0 min-w-[64px] touch-manipulation"
        >
          Send
        </button>
      </form>
    </div>
  );
}
