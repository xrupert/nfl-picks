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

let msgCounter = 0;

export default function Chat() {
  const { leagueId } = useParams();
  const profile = useAuthStore((s) => s.profile);
  const userId = useAuthStore((s) => s.session?.user?.id);
  const members = useLeagueStore((s) => s.members);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const channelRef = useRef(null);
  const bottomRef = useRef(null);

  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]));

  useEffect(() => {
    if (!leagueId || !userId) return;

    const channel = supabase.channel(`smack-${leagueId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        setMessages((prev) => [...prev, payload]);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnected(true);
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      setConnected(false);
    };
  }, [leagueId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !channelRef.current || !connected) return;

    const msg = {
      id: `${Date.now()}-${++msgCounter}`,
      user_id: userId,
      username: profile?.username ?? 'You',
      avatar_url: profile?.avatar_url ?? null,
      content,
      created_at: new Date().toISOString(),
    };

    await channelRef.current.send({
      type: 'broadcast',
      event: 'message',
      payload: msg,
    });

    setText('');
  }, [text, connected, userId, profile]);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 240px)', minHeight: '400px' }}>
      {/* Status bar */}
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        <span className="text-xs text-slate-500">
          {connected ? 'Live — messages appear in real time' : 'Connecting…'}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && connected && (
          <p className="mt-12 text-center text-sm text-slate-400">
            No messages yet. Start the trash talk.
          </p>
        )}

        {messages.map((msg) => {
          const sender = memberMap[msg.user_id];
          const isMe = msg.user_id === userId;
          const name = msg.username ?? sender?.username ?? 'Unknown';
          const avatar = msg.avatar_url ?? sender?.avatar_url;

          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className="shrink-0">
                {avatar ? (
                  <img src={avatar} alt={name} className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${isMe ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {name[0]?.toUpperCase()}
                  </div>
                )}
              </div>

              {/* Bubble */}
              <div className={`flex max-w-[72%] flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                  <span className="px-1 text-[11px] font-semibold text-slate-500">{name}</span>
                )}
                <div className={`rounded-2xl px-3.5 py-2 text-sm leading-snug ${isMe ? 'rounded-br-sm bg-emerald-500 text-white' : 'rounded-bl-sm border border-slate-100 bg-white text-slate-900 shadow-sm'}`}>
                  {msg.content}
                </div>
                <span className="px-1 text-[10px] text-slate-400">{timeAgo(msg.created_at)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="mt-3 flex gap-2 border-t border-slate-200 pt-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={connected ? 'Talk some smack…' : 'Connecting…'}
          className="input flex-1"
          maxLength={500}
          autoComplete="off"
          disabled={!connected}
        />
        <button type="submit" disabled={!text.trim() || !connected} className="btn-primary shrink-0">
          Send
        </button>
      </form>
    </div>
  );
}
