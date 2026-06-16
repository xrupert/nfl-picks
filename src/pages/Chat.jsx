import { useEffect, useRef, useState } from 'react';
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
  const userId = useAuthStore((s) => s.session?.user?.id);
  const members = useLeagueStore((s) => s.members);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tableReady, setTableReady] = useState(true);
  const bottomRef = useRef(null);

  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]));

  useEffect(() => {
    if (!leagueId) return;
    (async () => {
      const { data, error } = await supabase
        .from('league_messages')
        .select('*')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error?.code === '42P01') {
        setTableReady(false);
      } else {
        setMessages(data ?? []);
      }
      setLoading(false);
    })();
  }, [leagueId]);

  // Realtime — new messages appear instantly
  useEffect(() => {
    if (!leagueId || !tableReady) return;
    const channel = supabase
      .channel(`chat-${leagueId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'league_messages', filter: `league_id=eq.${leagueId}` },
        (payload) => setMessages((prev) => [...prev, payload.new])
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [leagueId, tableReady]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    await supabase.from('league_messages').insert({ league_id: leagueId, user_id: userId, content });
    setSending(false);
    setText('');
  };

  if (loading) return <p className="text-slate-500">Loading chat…</p>;

  if (!tableReady) {
    return (
      <div className="card p-6">
        <p className="font-semibold text-slate-700">Chat needs a quick one-time setup.</p>
        <p className="mt-1 text-sm text-slate-500">
          Go to{' '}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-emerald-600 underline">
            supabase.com/dashboard
          </a>
          {' '}→ your project → <b>SQL Editor</b> → paste the block below → click <b>Run</b>.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-emerald-300 select-all">
{`CREATE TABLE IF NOT EXISTS league_messages (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id  uuid        NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    text        NOT NULL CHECK (char_length(content) <= 500),
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS league_messages_idx
  ON league_messages (league_id, created_at ASC);
ALTER TABLE league_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read messages" ON league_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM league_members
      WHERE league_members.league_id = league_messages.league_id
        AND league_members.user_id = auth.uid()));
CREATE POLICY "Members can send messages" ON league_messages
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM league_members
      WHERE league_members.league_id = league_messages.league_id
        AND league_members.user_id = auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE league_messages;`}
        </pre>
        <p className="mt-3 text-xs text-slate-400">After running, refresh the page and chat will be live.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 240px)', minHeight: '400px' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <p className="mt-12 text-center text-sm text-slate-400">
            No messages yet. Start the trash talk. 🗑️
          </p>
        )}

        {messages.map((msg) => {
          const sender = memberMap[msg.user_id];
          const isMe = msg.user_id === userId;
          const name = sender?.username ?? 'Unknown';

          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className="shrink-0">
                {sender?.avatar_url ? (
                  <img
                    src={sender.avatar_url}
                    alt={name}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${isMe ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {name[0].toUpperCase()}
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
          placeholder="Talk some smack…"
          className="input flex-1"
          maxLength={500}
          autoComplete="off"
        />
        <button type="submit" disabled={!text.trim() || sending} className="btn-primary shrink-0">
          Send
        </button>
      </form>
    </div>
  );
}
