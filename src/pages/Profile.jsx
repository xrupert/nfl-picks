import { useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

export default function Profile() {
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const loadProfile = useAuthStore((s) => s.loadProfile);

  const [username, setUsername] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef(null);

  const userId = session?.user?.id;

  const flash = (ok, err) => {
    if (ok) { setSuccessMsg(ok); setErrorMsg(''); setTimeout(() => setSuccessMsg(''), 3000); }
    if (err) { setErrorMsg(err); setSuccessMsg(''); }
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    const uname = username.trim();
    if (uname.length < 3) { flash(null, 'Username must be at least 3 characters.'); return; }

    setSaving(true);
    const { data: existing } = await supabase
      .from('profiles').select('id').eq('username', uname).neq('id', userId).maybeSingle();
    if (existing) { setSaving(false); flash(null, 'That username is already taken.'); return; }

    const { error } = await supabase.from('profiles').update({ username: uname }).eq('id', userId);
    setSaving(false);
    if (error) { flash(null, error.message); return; }
    await loadProfile(userId);
    flash('Display name updated!');
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { flash(null, 'Image must be under 2MB.'); return; }

    setUploading(true);
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `${userId}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) { setUploading(false); flash(null, upErr.message); return; }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const urlWithBust = `${publicUrl}?t=${Date.now()}`;

    const { error: dbErr } = await supabase.from('profiles')
      .update({ avatar_url: urlWithBust }).eq('id', userId);

    setUploading(false);
    if (dbErr) { flash(null, dbErr.message); return; }
    await loadProfile(userId);
    flash('Profile photo updated!');
  };

  const avatarUrl = profile?.avatar_url;
  const initial = (profile?.username ?? session?.user?.email ?? 'U')[0].toUpperCase();

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl font-extrabold text-slate-900">Your Profile</h1>

      {/* Avatar */}
      <div className="card p-6">
        <h2 className="mb-4 font-semibold text-slate-900">Profile Photo</h2>
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Your avatar"
                className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-200"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-3xl font-bold text-white">
                {initial}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-700 text-white shadow transition hover:bg-slate-600"
              title="Change photo"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn-primary text-sm"
            >
              {uploading ? 'Uploading…' : 'Upload photo'}
            </button>
            <p className="mt-1.5 text-xs text-slate-400">JPG, PNG, GIF · Max 2 MB</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Username */}
      <div className="card p-6">
        <h2 className="mb-4 font-semibold text-slate-900">Display Name</h2>
        <form onSubmit={handleSaveName} className="flex gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input flex-1"
            placeholder="your_name"
            minLength={3}
            required
          />
          <button type="submit" disabled={saving} className="btn-primary shrink-0">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-400">This is what other league members see on the leaderboard.</p>
      </div>

      {/* Account info */}
      <div className="card p-6">
        <h2 className="mb-3 font-semibold text-slate-900">Account</h2>
        <p className="text-sm text-slate-500">
          Email: <span className="font-medium text-slate-700">{session?.user?.email}</span>
        </p>
      </div>

      {successMsg && <p className="text-sm font-medium text-emerald-600">{successMsg}</p>}
      {errorMsg && <p className="text-sm font-medium text-red-500">{errorMsg}</p>}
    </div>
  );
}
