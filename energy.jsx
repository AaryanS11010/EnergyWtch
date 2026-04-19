import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ReferenceLine } from 'recharts';
import { Sun, Zap, Battery, Flame, Activity, TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine, Home, Cpu, AlertCircle, Lock, Mail, User, LogOut, Settings, Bell, Clock, Leaf, Gauge, Sparkles, ChevronRight, Check, MapPin, Navigation, X, RotateCcw, Cloud, CloudRain, CloudSnow, Loader2 } from 'lucide-react';
 
// -------------------------------------------------------------
// CONFIG — point this at your backend
// -------------------------------------------------------------
const API = 'http://localhost:4000/api';
 
// -------------------------------------------------------------
// DEMO MODE — bypasses backend entirely
// -------------------------------------------------------------
const DEMO_USER = {
  id: 0,
  email: 'demo@energywatch.igs',
  name: 'Demo User',
  verified: true,
  zip_code: '43215',
  latitude: 39.9612,
  longitude: -82.9988,
  location_label: 'Columbus, OH',
  created_at: new Date().toISOString(),
};
 
// Simulated Open-Meteo shape for Columbus, OH
const DEMO_WEATHER = (() => {
  const base = Date.now();
  const days = 7;
  const codes = [0, 1, 3, 61, 3, 0, 1];
  const maxTemps = [74, 71, 68, 63, 66, 72, 75];
  const minTemps = [58, 55, 53, 51, 52, 56, 59];
  const radiation = [18.4, 15.2, 8.1, 3.4, 10.7, 19.1, 17.8];
  const precip = [0, 0, 0.2, 1.1, 0, 0, 0];
  const times = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10);
  });
  return {
    current: {
      temperature_2m: 71,
      apparent_temperature: 69,
      relative_humidity_2m: 52,
      weather_code: 1,
      cloud_cover: 18,
      wind_speed_10m: 8,
      shortwave_radiation: 620,
      is_day: 1,
    },
    daily: {
      time: times,
      weather_code: codes,
      temperature_2m_max: maxTemps,
      temperature_2m_min: minTemps,
      shortwave_radiation_sum: radiation,
      precipitation_sum: precip,
      sunrise: times.map(t => `${t}T06:22`),
      sunset:  times.map(t => `${t}T20:11`),
    },
  };
})();
 
// -------------------------------------------------------------
// API HELPER
// -------------------------------------------------------------
const api = {
  token: null,
  setToken(t) { this.token = t; if (t) localStorage.setItem('ew_token', t); else localStorage.removeItem('ew_token'); },
  loadToken() { this.token = localStorage.getItem('ew_token'); return this.token; },
  async request(path, { method = 'GET', body, auth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;
    let res;
    try {
      res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      // Network error — backend not running or wrong port
      throw new Error(
        'Cannot reach the EnergyWatch server. Make sure the backend is running:\n' +
        '  cd your-project && npm install && node server.js\n' +
        'Then try again — or use Demo mode below to explore without a backend.'
      );
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
    return data;
  },
  signup(body)        { return this.request('/auth/signup',  { method: 'POST', body }); },
  verify(body)        { return this.request('/auth/verify',  { method: 'POST', body }); },
  resend(body)        { return this.request('/auth/resend',  { method: 'POST', body }); },
  signin(body)        { return this.request('/auth/signin',  { method: 'POST', body }); },
  me()                { return this.request('/me',           { auth: true }); },
  updateLocation(b)   { return this.request('/me/location',  { method: 'PUT',  body: b, auth: true }); },
  getNotifications()  { return this.request('/notifications',{ auth: true }); },
  createNotification(b){return this.request('/notifications',{ method: 'POST', body: b, auth: true }); },
  revertNotification(id){return this.request(`/notifications/${id}/revert`, { method: 'POST', auth: true }); },
  markRead(id)        { return this.request(`/notifications/${id}/read`, { method: 'POST', auth: true }); },
  markAllRead()       { return this.request(`/notifications/read-all`, { method: 'POST', auth: true }); },
  geocodeZip(zip)     { return this.request(`/geocode/zip?zip=${encodeURIComponent(zip)}`); },
  weather(lat, lon)   { return this.request(`/weather?lat=${lat}&lon=${lon}`); },
};
 
// -------------------------------------------------------------
// ROOT
// -------------------------------------------------------------
export default function EnergyWatch() {
  const [user, setUser] = useState(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [toast, setToast] = useState(null);
 
  const showToast = useCallback((msg, kind = 'info') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  }, []);
 
  // Boot: try to restore session
  useEffect(() => {
    (async () => {
      const t = api.loadToken();
      if (!t) { setBootLoading(false); return; }
      if (t === 'DEMO_TOKEN') { setUser(DEMO_USER); setBootLoading(false); return; }
      try {
        const { user } = await api.me();
        setUser(user);
      } catch {
        api.setToken(null);
      }
      setBootLoading(false);
    })();
  }, []);
 
  // After login: load notifications + weather, prompt for location if missing
  useEffect(() => {
    if (!user) return;
    const isDemo = api.token === 'DEMO_TOKEN';
    if (isDemo) {
      setWeather(DEMO_WEATHER);
      setNotifications([
        { id: 1, type: 'info', title: 'Welcome to EnergyWatch', body: 'This is demo mode — all data is simulated. No backend required.', read: false, reverted: false, prev_state: null, new_state: null, action: null, created_at: new Date().toISOString() },
        { id: 2, type: 'decision', title: 'Selling to grid', body: 'AI routed 4.13 kW surplus solar to the grid at peak rates.', action: 'SELL', read: false, reverted: false, prev_state: { battery_target: 80, mode: 'normal' }, new_state: { battery_target: 80, mode: 'sell' }, created_at: new Date(Date.now() - 300000).toISOString() },
        { id: 3, type: 'advisory', title: 'Monday looks overcast — pre-charge battery', body: 'Projected 63% reduction in solar yield. Pre-charge recommended.', action: 'PRE_CHARGE', read: true, reverted: false, prev_state: { battery_target: 80, mode: 'normal' }, new_state: { battery_target: 100, mode: 'pre_charge_night' }, created_at: new Date(Date.now() - 3600000).toISOString() },
      ]);
      return;
    }
    loadNotifications();
    if (user.latitude && user.longitude) {
      loadWeather(user.latitude, user.longitude);
    } else {
      setShowLocationPrompt(true);
    }
  }, [user?.id]);
 
  const loadNotifications = useCallback(async () => {
    try {
      const { notifications } = await api.getNotifications();
      setNotifications(notifications);
    } catch (e) { console.error(e); }
  }, []);
 
  const loadWeather = useCallback(async (lat, lon) => {
    setWeatherLoading(true);
    try {
      const data = await api.weather(lat, lon);
      setWeather(data);
    } catch (e) {
      showToast('Could not load weather — check backend is running', 'error');
    } finally {
      setWeatherLoading(false);
    }
  }, [showToast]);
 
  const handleLogout = () => {
    api.setToken(null);
    setUser(null); setWeather(null); setNotifications([]);
  };
 
  const handleLocationSet = async ({ lat, lon, label, zip }) => {
    if (api.token === 'DEMO_TOKEN') {
      setUser(u => ({ ...u, latitude: lat, longitude: lon, location_label: label || zip, zip_code: zip || u.zip_code }));
      setShowLocationPrompt(false);
      setWeather(DEMO_WEATHER);
      showToast(`Location updated: ${label || zip} (demo)`, 'success');
      return;
    }
    try {
      const { user: updated } = await api.updateLocation({ lat, lon, label, zip });
      setUser(updated);
      setShowLocationPrompt(false);
      loadWeather(lat, lon);
      showToast(`Location updated: ${label || zip}`, 'success');
    } catch (e) {
      showToast(e.message || 'Failed to update location', 'error');
    }
  };
 
  const handleRevert = async (id) => {
    if (api.token === 'DEMO_TOKEN') {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, reverted: true } : n));
      setNotifications(prev => [...prev, { id: Date.now(), type: 'info', title: 'Reverted (demo)', body: 'Change rolled back in demo mode.', read: false, reverted: false, prev_state: null, new_state: null, action: 'REVERT', created_at: new Date().toISOString() }]);
      showToast('Change reverted (demo mode)', 'success');
      return;
    }
    try {
      await api.revertNotification(id);
      await loadNotifications();
      showToast('Change reverted successfully', 'success');
    } catch (e) {
      showToast(e.message || 'Revert failed', 'error');
    }
  };
 
  const handleMarkAllRead = async () => {
    if (api.token === 'DEMO_TOKEN') {
      setNotifications(prev => prev.map(n => ({ ...n, read: true }))); return;
    }
    await api.markAllRead();
    loadNotifications();
  };
 
  if (bootLoading) return <BootScreen />;
 
  if (!user) {
    return <AuthScreen onAuth={(token, user) => { api.setToken(token); setUser(user); }} />;
  }
 
  const unreadCount = notifications.filter(n => !n.read).length;
 
  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(180deg, #f4f7f3 0%, #eef3ed 100%)',
      fontFamily: "'Inter', system-ui, sans-serif",
      color: '#1a2e25'
    }}>
      <style>{globalStyles}</style>
      <BackgroundDecor />
 
      <TopNav
        user={user}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadCount={unreadCount}
        onBellClick={() => setShowNotifications(true)}
        weather={weather}
      />
 
      <main className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {activeTab === 'dashboard' && (
          <Dashboard
            user={user}
            weather={weather}
            weatherLoading={weatherLoading}
            onAdvisoryApprove={async (advisory) => {
              if (api.token === 'DEMO_TOKEN') {
                setNotifications(prev => [{ id: Date.now(), ...advisory, read: false, reverted: false, created_at: new Date().toISOString() }, ...prev]);
                showToast('Plan approved and logged (demo)', 'success'); return;
              }
              try {
                await api.createNotification(advisory);
                loadNotifications();
                showToast('Plan approved and logged', 'success');
              } catch { showToast('Failed to log action', 'error'); }
            }}
          />
        )}
        {activeTab === 'sources' && <EnergySources />}
        {activeTab === 'ai' && <AIDecisions />}
        {activeTab === 'forecast' && <ForecastPanel weather={weather} user={user} />}
        {activeTab === 'settings' && (
          <SettingsPanel
            user={user}
            onUpdateLocation={handleLocationSet}
            onShowLocation={() => setShowLocationPrompt(true)}
          />
        )}
      </main>
 
      <Footer />
 
      {showNotifications && (
        <NotificationCenter
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onRevert={handleRevert}
          onMarkAllRead={handleMarkAllRead}
          onMarkRead={async (id) => {
            if (api.token === 'DEMO_TOKEN') { setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)); return; }
            await api.markRead(id); loadNotifications();
          }}
        />
      )}
 
      {showLocationPrompt && (
        <LocationModal
          onClose={() => setShowLocationPrompt(false)}
          onSet={handleLocationSet}
          current={user}
        />
      )}
 
      {toast && <Toast {...toast} />}
    </div>
  );
}
 
/* ============== BOOT ============== */
function BootScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f4f7f3' }}>
      <style>{globalStyles}</style>
      <div className="flex items-center gap-3">
        <Loader2 size={20} className="animate-spin" style={{ color: '#22c55e' }} />
        <span style={{ color: 'rgba(26, 46, 37, 0.6)' }}>Loading EnergyWatch…</span>
      </div>
    </div>
  );
}
 
/* ============== TOAST ============== */
function Toast({ msg, kind }) {
  const colors = {
    success: { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.35)', color: '#16a34a', icon: <Check size={16} /> },
    error:   { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)', color: '#dc2626', icon: <AlertCircle size={16} /> },
    info:    { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.35)', color: '#2563eb', icon: <Bell size={16} /> },
  }[kind] || {};
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl backdrop-blur-md"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.color, animation: 'slideInRight 0.3s ease-out' }}>
      {colors.icon}
      <span className="text-sm font-medium">{msg}</span>
    </div>
  );
}
 
/* ============== GLOBAL STYLES ============== */
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap');
  * { font-family: 'Inter', system-ui, sans-serif; }
  .serif { font-family: 'Instrument Serif', serif; font-weight: 400; letter-spacing: -0.01em; }
  .mono { font-family: 'JetBrains Mono', monospace; }
 
  @keyframes pulse-soft { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.1)} }
  @keyframes flow { 0%{stroke-dashoffset:100} 100%{stroke-dashoffset:0} }
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes fade-up { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes slideInRight { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
  @keyframes slideInUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
 
  .pulse-soft { animation: pulse-soft 2.5s ease-in-out infinite; }
  .flow-line { stroke-dasharray: 6 4; animation: flow 2.5s linear infinite; }
  .fade-up { animation: fade-up 0.6s ease-out backwards; }
  .float-slow { animation: float 6s ease-in-out infinite; }
  .animate-spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
 
  .card {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.8);
    border-radius: 24px;
    box-shadow: 0 1px 2px rgba(26, 46, 37, 0.04), 0 8px 24px rgba(26, 46, 37, 0.04);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .card:hover { box-shadow: 0 1px 2px rgba(26, 46, 37, 0.04), 0 12px 32px rgba(26, 46, 37, 0.08); }
  .card-dark {
    background: linear-gradient(135deg, #1a3329 0%, #0f1f18 100%);
    color: #f0f5f2;
    border-radius: 24px;
    border: 1px solid rgba(166, 230, 170, 0.15);
    box-shadow: 0 12px 40px rgba(26, 46, 37, 0.18);
  }
  .btn-primary {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white; border: none; border-radius: 14px;
    padding: 14px 24px; font-weight: 600; font-size: 14px; cursor: pointer;
    transition: all 0.25s; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.25);
  }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(34, 197, 94, 0.35); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .btn-ghost {
    background: rgba(255,255,255,0.6); color: #1a2e25;
    border: 1px solid rgba(26,46,37,0.1); border-radius: 14px;
    padding: 14px 24px; font-weight: 500; font-size: 14px; cursor: pointer; transition: all 0.25s;
  }
  .btn-ghost:hover { background: white; border-color: rgba(26,46,37,0.2); }
  .chip { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; font-size:11px; font-weight:600; letter-spacing:0.02em; }
  .label-caps { font-size:11px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:rgba(26,46,37,0.5); }
  .metric-xl { font-family:'Instrument Serif',serif; font-size:52px; line-height:1; letter-spacing:-0.02em; font-weight:400; }
  input { outline:none; transition:all 0.2s; }
  input:focus { border-color:#22c55e !important; box-shadow:0 0 0 4px rgba(34,197,94,0.12); }
  button { outline:none; }
  ::selection { background:rgba(34,197,94,0.25); }
  .shimmer-text { background:linear-gradient(90deg,#1a3329,#22c55e 50%,#1a3329); background-size:200% 100%; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:shimmer 3s linear infinite; }
  .error-text { color:#dc2626; font-size:13px; margin-top:6px; }
`;
 
function BackgroundDecor() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-3xl opacity-40 float-slow" style={{ background: 'radial-gradient(circle, #a7f3d0 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full blur-3xl opacity-30 float-slow" style={{ background: 'radial-gradient(circle, #fde68a 0%, transparent 70%)', animationDelay: '2s' }} />
      <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full blur-3xl opacity-20 float-slow" style={{ background: 'radial-gradient(circle, #bfdbfe 0%, transparent 70%)', animationDelay: '4s' }} />
    </div>
  );
}
 
/* ============== AUTH (signin / signup / verify) ============== */
function AuthScreen({ onAuth }) {
  const [view, setView] = useState('signin'); // signin | signup | verify
  const [form, setForm] = useState({ email: '', password: '', name: '', code: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [pendingEmail, setPendingEmail] = useState(null);
 
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
 
  const demoLogin = () => {
    onAuth('DEMO_TOKEN', DEMO_USER);
  };
 
  const submit = async () => {
    setError(null); setInfo(null); setLoading(true);
    try {
      if (view === 'signin') {
        // Req #6: block empty email/password on client (server also enforces)
        if (!form.email.trim() || !form.password) throw new Error('Email and password are required.');
        const { token, user } = await api.signin({ email: form.email, password: form.password });
        onAuth(token, user);
      } else if (view === 'signup') {
        // Req #6: cannot proceed without email + password
        if (!form.email.trim()) throw new Error('Gmail address is required.');
        if (!form.password) throw new Error('Password is required.');
        // Req #5: Gmail only (backend also enforces)
        if (!/@gmail\.com$/i.test(form.email.trim())) throw new Error('Must be a Gmail address (for verification email).');
        if (form.password.length < 8) throw new Error('Password must be at least 8 characters.');
        await api.signup({ email: form.email, password: form.password, name: form.name });
        setPendingEmail(form.email.trim().toLowerCase());
        setView('verify');
        setInfo(`We sent a 6-digit code to ${form.email.trim().toLowerCase()}. Enter it below to activate your account.`);
      } else if (view === 'verify') {
        if (!/^\d{6}$/.test(form.code)) throw new Error('Enter the 6-digit code.');
        const { token, user } = await api.verify({ email: pendingEmail, code: form.code });
        onAuth(token, user);
      }
    } catch (e) {
      setError(e.message || 'Something went wrong');
      if (e.data?.needs_verification) {
        setPendingEmail(e.data.email);
        setView('verify');
        setInfo('Your account is not yet verified. Enter the code we emailed you.');
      }
    } finally { setLoading(false); }
  };
 
  const resend = async () => {
    setError(null); setInfo(null);
    try {
      await api.resend({ email: pendingEmail });
      setInfo('New code sent. Check your inbox.');
    } catch (e) { setError(e.message); }
  };
 
  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(180deg, #f4f7f3 0%, #eef3ed 100%)' }}>
      <style>{globalStyles}</style>
      <BackgroundDecor />
 
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden p-12 flex-col z-10">
        <div className="absolute inset-8 rounded-[32px] overflow-hidden" style={{
          background: 'linear-gradient(135deg, #1a3329 0%, #0f1f18 100%)',
          boxShadow: '0 30px 80px rgba(26, 46, 37, 0.25)'
        }}>
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'radial-gradient(circle at 20% 30%, #a7f3d0 0%, transparent 40%), radial-gradient(circle at 80% 70%, #fde68a 0%, transparent 40%)'
          }} />
        </div>
        <div className="relative z-10 flex flex-col justify-between h-full p-8 text-white">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4)' }}>
                <Zap size={22} fill="white" strokeWidth={2.5} color="white" />
              </div>
              <div>
                <div className="font-bold text-lg tracking-tight">EnergyWatch</div>
                <div className="text-xs text-green-300/70 mono">IGS · HACKATHON 2026</div>
              </div>
            </div>
            <div className="mt-20">
              <h1 className="serif text-7xl leading-[0.95] text-green-50">
                The smartest<br/>watt you've<br/>ever owned<span className="text-green-400">.</span>
              </h1>
              <p className="mt-8 text-green-100/70 max-w-md text-lg leading-relaxed">
                AI that watches weather and markets 24/7 — deciding when your home should pull, store, or sell power.
              </p>
            </div>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Avg savings" value="$142" sub="per month" />
              <StatTile label="Grid sellback" value="847" sub="kWh / mo" />
              <StatTile label="CO₂ offset" value="2.1" sub="tons / yr" />
            </div>
          </div>
        </div>
      </div>
 
      {/* Form side */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">
        <div className="w-full max-w-md fade-up">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
              <Zap size={20} fill="white" strokeWidth={2.5} color="white" />
            </div>
            <span className="font-bold text-xl" style={{ color: '#1a2e25' }}>EnergyWatch</span>
          </div>
 
          <div className="chip mb-4" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}>
            <Sparkles size={12} />
            {view === 'signin' ? 'Welcome back' : view === 'signup' ? 'Join EnergyWatch' : 'Verify your email'}
          </div>
 
          <h2 className="serif text-5xl mb-3" style={{ color: '#1a2e25' }}>
            {view === 'signin' ? 'Sign in to your grid' : view === 'signup' ? 'Create your account' : 'Check your inbox'}
          </h2>
          <p className="mb-8" style={{ color: 'rgba(26, 46, 37, 0.6)' }}>
            {view === 'signin' && 'Your energy, optimized — every second.'}
            {view === 'signup' && 'Start saving from day one. Gmail address required for verification.'}
            {view === 'verify' && `We sent a code to ${pendingEmail}.`}
          </p>
 
          <div className="space-y-4">
            {view === 'signup' && (
              <AuthInput icon={<User size={16} />} label="Full name" value={form.name} onChange={v => update('name', v)} placeholder="Alex Rivera" />
            )}
 
            {view !== 'verify' && (
              <>
                <AuthInput
                  icon={<Mail size={16} />}
                  label={view === 'signup' ? 'Gmail address' : 'Email'}
                  value={form.email}
                  onChange={v => update('email', v)}
                  placeholder={view === 'signup' ? 'you@gmail.com' : 'you@example.com'}
                  type="email"
                  required
                />
                <AuthInput
                  icon={<Lock size={16} />}
                  label="Password"
                  value={form.password}
                  onChange={v => update('password', v)}
                  placeholder={view === 'signup' ? '8+ characters' : '••••••••'}
                  type="password"
                  required
                />
              </>
            )}
 
            {view === 'verify' && (
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#1a2e25' }}>6-digit code</label>
                <input
                  value={form.code}
                  onChange={e => update('code', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-5 py-4 text-center mono"
                  style={{
                    background: 'rgba(255, 255, 255, 0.8)',
                    border: '1px solid rgba(26, 46, 37, 0.12)',
                    borderRadius: '12px',
                    color: '#1a2e25',
                    fontSize: '28px',
                    letterSpacing: '0.5em',
                    fontWeight: 700
                  }}
                />
                <div className="flex items-center justify-between mt-3 text-sm">
                  <button onClick={resend} style={{ color: '#16a34a' }} className="font-semibold hover:underline">Resend code</button>
                  <button onClick={() => { setView('signup'); setError(null); setInfo(null); }} style={{ color: 'rgba(26,46,37,0.5)' }} className="hover:underline">Use a different email</button>
                </div>
              </div>
            )}
 
            {error && (
              error.includes('EnergyWatch server') ? (
                <div className="rounded-2xl p-4" style={{ background: 'rgba(239, 68, 68, 0.07)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={15} style={{ color: '#dc2626', flexShrink: 0 }} />
                    <span className="text-sm font-semibold" style={{ color: '#dc2626' }}>Backend not reachable</span>
                  </div>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(26,46,37,0.7)' }}>
                    The server at <span className="mono font-semibold">localhost:4000</span> isn't responding. Start it with:
                  </p>
                  <div className="rounded-xl px-3 py-2 mono text-xs mb-3" style={{ background: 'rgba(26,46,37,0.06)', color: '#1a2e25' }}>
                    npm install &amp;&amp; node server.js
                  </div>
                  <button onClick={demoLogin} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <Sparkles size={12} /> Or try Demo mode instead
                  </button>
                </div>
              ) : (
                <div className="error-text flex items-center gap-2">
                  <AlertCircle size={13} style={{ flexShrink: 0 }} />
                  {error}
                </div>
              )
            )}
            {info && !error && <div className="text-sm" style={{ color: '#16a34a' }}>{info}</div>}
 
            <button onClick={submit} disabled={loading} className="btn-primary w-full mt-2 flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {view === 'signin' ? 'Sign in' : view === 'signup' ? 'Send verification code' : 'Verify and enter dashboard'} →
            </button>
 
            {view === 'signin' && (
              <>
                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px" style={{ background: 'rgba(26, 46, 37, 0.1)' }} />
                  <span className="text-xs font-medium" style={{ color: 'rgba(26, 46, 37, 0.4)' }}>or</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(26, 46, 37, 0.1)' }} />
                </div>
                <button onClick={demoLogin} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: 'rgba(255, 255, 255, 0.7)',
                    border: '1.5px dashed rgba(26, 46, 37, 0.2)',
                    color: 'rgba(26, 46, 37, 0.75)',
                  }}>
                  <Sparkles size={15} style={{ color: '#f59e0b' }} />
                  Try demo — no account needed
                </button>
              </>
            )}
 
            {view !== 'verify' && (
              <p className="text-center text-sm pt-4" style={{ color: 'rgba(26, 46, 37, 0.6)' }}>
                {view === 'signin' ? "Don't have an account? " : "Already have one? "}
                <button onClick={() => { setView(view === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null); }}
                  className="font-semibold hover:underline" style={{ color: '#16a34a' }}>
                  {view === 'signin' ? 'Create one' : 'Sign in'}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
 
function AuthInput({ icon, label, value, onChange, placeholder, type = 'text', required }) {
  return (
    <div>
      <label className="text-sm font-medium mb-1.5 block" style={{ color: '#1a2e25' }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'rgba(26, 46, 37, 0.4)' }}>{icon}</div>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full pl-11 pr-4 py-3.5 text-sm"
          style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,46,37,0.12)', borderRadius: '12px', color: '#1a2e25' }} />
      </div>
    </div>
  );
}
 
function StatTile({ label, value, sub }) {
  return (
    <div className="p-4 rounded-2xl" style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(166, 230, 170, 0.12)' }}>
      <div className="text-[10px] uppercase tracking-wider text-green-200/60 mb-1">{label}</div>
      <div className="serif text-3xl text-green-50">{value}</div>
      <div className="text-[10px] text-green-200/50 mt-0.5">{sub}</div>
    </div>
  );
}
 
/* ============== LOCATION MODAL ============== */
function LocationModal({ onClose, onSet, current }) {
  const [mode, setMode] = useState('geo'); // geo | zip
  const [zip, setZip] = useState(current?.zip_code || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
 
  const useGeolocation = () => {
    setError(null);
    if (!navigator.geolocation) return setError('Geolocation not supported by this browser.');
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        // Reverse label via Open-Meteo geocoder as a nice touch
        let label = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
        try {
          const r = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en`);
          const j = await r.json();
          if (j?.results?.[0]) label = `${j.results[0].name}, ${j.results[0].admin1 || ''}`.trim().replace(/,$/, '');
        } catch {}
        await onSet({ lat, lon, label });
        setLoading(false);
      },
      (err) => {
        setError(err.message || 'Could not get location.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
 
  const useZip = async () => {
    setError(null);
    if (!/^\d{5}$/.test(zip)) return setError('Enter a 5-digit US zip code.');
    setLoading(true);
    try {
      const g = await api.geocodeZip(zip);
      await onSet({ lat: g.lat, lon: g.lon, label: g.label, zip: g.zip });
    } catch (e) {
      setError(e.message || 'Could not find that zip code.');
    } finally { setLoading(false); }
  };
 
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(26, 46, 37, 0.35)', backdropFilter: 'blur(8px)' }}>
      <style>{globalStyles}</style>
      <div className="card w-full max-w-md p-7 relative" style={{ animation: 'slideInUp 0.3s ease-out' }}>
        <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5" style={{ color: 'rgba(26,46,37,0.5)' }}>
          <X size={18} />
        </button>
 
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a' }}>
          <MapPin size={22} />
        </div>
        <h2 className="serif text-3xl mb-2" style={{ color: '#1a2e25' }}>Set your location</h2>
        <p className="text-sm mb-6" style={{ color: 'rgba(26, 46, 37, 0.65)' }}>
          Used for accurate weather and solar forecasts. Your coordinates stay on our servers only.
        </p>
 
        <div className="flex gap-2 p-1 rounded-xl mb-5" style={{ background: 'rgba(26, 46, 37, 0.04)' }}>
          {[
            { id: 'geo', label: 'Use my location', icon: <Navigation size={14} /> },
            { id: 'zip', label: 'Enter zip code',    icon: <MapPin size={14} /> }
          ].map(t => (
            <button key={t.id} onClick={() => setMode(t.id)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all"
              style={{
                background: mode === t.id ? 'white' : 'transparent',
                color: mode === t.id ? '#16a34a' : 'rgba(26, 46, 37, 0.6)',
                fontWeight: mode === t.id ? 600 : 500,
                boxShadow: mode === t.id ? '0 2px 6px rgba(26, 46, 37, 0.06)' : 'none'
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
 
        {mode === 'geo' ? (
          <div>
            <p className="text-sm mb-4" style={{ color: 'rgba(26, 46, 37, 0.7)' }}>
              We'll ask your browser for your current location and use those coordinates for weather forecasts.
            </p>
            <button onClick={useGeolocation} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
              {loading ? 'Locating…' : 'Share my location'}
            </button>
          </div>
        ) : (
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: '#1a2e25' }}>US zip code</label>
            <input value={zip} onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="43302" maxLength={5}
              className="w-full px-4 py-3.5 text-sm mb-4"
              style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,46,37,0.12)', borderRadius: '12px', color: '#1a2e25' }} />
            <button onClick={useZip} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {loading ? 'Looking up…' : 'Save zip code'}
            </button>
          </div>
        )}
 
        {error && <div className="error-text">{error}</div>}
 
        {current?.location_label && (
          <div className="mt-6 pt-5 border-t text-sm flex items-center gap-2" style={{ borderColor: 'rgba(26, 46, 37, 0.08)', color: 'rgba(26, 46, 37, 0.6)' }}>
            <MapPin size={14} /> Current: <b style={{ color: '#1a2e25' }}>{current.location_label}</b>
          </div>
        )}
      </div>
    </div>
  );
}
 
/* ============== NOTIFICATION CENTER ============== */
function NotificationCenter({ notifications, onClose, onRevert, onMarkAllRead, onMarkRead }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(26, 46, 37, 0.35)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <style>{globalStyles}</style>
      <div className="w-full max-w-md h-full overflow-y-auto" onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #f4f7f3 0%, #eef3ed 100%)',
          animation: 'slideInRight 0.3s ease-out',
          boxShadow: '-20px 0 60px rgba(26, 46, 37, 0.2)'
        }}>
        <div className="sticky top-0 z-10 p-6 border-b backdrop-blur-xl" style={{ background: 'rgba(244, 247, 243, 0.85)', borderColor: 'rgba(26, 46, 37, 0.08)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="serif text-3xl" style={{ color: '#1a2e25' }}>Notifications</h2>
              <p className="text-sm mt-1" style={{ color: 'rgba(26, 46, 37, 0.55)' }}>AI changes, alerts, and system events</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5" style={{ color: 'rgba(26,46,37,0.5)' }}>
              <X size={18} />
            </button>
          </div>
          {notifications.some(n => !n.read) && (
            <button onClick={onMarkAllRead} className="text-sm font-semibold" style={{ color: '#16a34a' }}>Mark all as read</button>
          )}
        </div>
 
        <div className="p-4 space-y-2">
          {notifications.length === 0 && (
            <div className="py-16 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(26, 46, 37, 0.05)', color: 'rgba(26, 46, 37, 0.4)' }}>
                <Bell size={22} />
              </div>
              <p className="text-sm" style={{ color: 'rgba(26, 46, 37, 0.55)' }}>No notifications yet.</p>
            </div>
          )}
          {notifications.map(n => (
            <NotificationItem key={n.id} n={n} onRevert={onRevert} onMarkRead={onMarkRead} />
          ))}
        </div>
      </div>
    </div>
  );
}
 
function NotificationItem({ n, onRevert, onMarkRead }) {
  const typeStyle = {
    advisory: { bg: 'rgba(245, 158, 11, 0.12)', color: '#b45309', icon: <AlertCircle size={14} /> },
    decision: { bg: 'rgba(34, 197, 94, 0.12)',  color: '#16a34a', icon: <Cpu size={14} /> },
    alert:    { bg: 'rgba(239, 68, 68, 0.12)',  color: '#dc2626', icon: <AlertCircle size={14} /> },
    info:     { bg: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', icon: <Bell size={14} /> },
  }[n.type] || { bg: 'rgba(100, 116, 139, 0.12)', color: '#475569', icon: <Bell size={14} /> };
 
  const canRevert = !!n.prev_state && !n.reverted;
  const when = new Date(n.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
 
  return (
    <div className="p-4 rounded-2xl border transition-all"
      style={{
        background: n.read ? 'rgba(255,255,255,0.5)' : 'white',
        borderColor: n.read ? 'rgba(26,46,37,0.06)' : 'rgba(34,197,94,0.25)',
        boxShadow: n.read ? 'none' : '0 4px 16px rgba(34, 197, 94, 0.08)'
      }}
      onClick={() => !n.read && onMarkRead(n.id)}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: typeStyle.bg, color: typeStyle.color }}>
          {typeStyle.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-sm" style={{ color: '#1a2e25' }}>{n.title}</h4>
            {!n.read && <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#22c55e' }} />}
          </div>
          {n.body && <p className="text-sm mt-1 leading-relaxed" style={{ color: 'rgba(26, 46, 37, 0.7)' }}>{n.body}</p>}
          <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: 'rgba(26, 46, 37, 0.45)' }}>
            <span>{when}</span>
            {n.action && <><span>·</span><span className="mono font-semibold" style={{ color: typeStyle.color }}>{n.action}</span></>}
            {n.reverted && <><span>·</span><span style={{ color: '#dc2626' }} className="font-semibold">Reverted</span></>}
          </div>
          {canRevert && (
            <button onClick={(e) => { e.stopPropagation(); onRevert(n.id); }}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <RotateCcw size={12} /> Revert this change
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
 
/* ============== TOP NAV ============== */
function TopNav({ user, onLogout, activeTab, setActiveTab, unreadCount, onBellClick, weather }) {
  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: <Gauge size={15} /> },
    { id: 'sources', label: 'Energy mix', icon: <Activity size={15} /> },
    { id: 'ai', label: 'AI decisions', icon: <Cpu size={15} /> },
    { id: 'forecast', label: 'Forecast', icon: <TrendingUp size={15} /> },
    { id: 'settings', label: 'System', icon: <Settings size={15} /> },
  ];
 
  const currentTemp = weather?.current?.temperature_2m;
 
  return (
    <nav className="sticky top-0 z-40 px-4 sm:px-6 lg:px-8 pt-4">
      <div className="max-w-[1500px] mx-auto">
        <div className="card flex items-center justify-between px-5 py-3" style={{ borderRadius: '20px' }}>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' }}>
                <Zap size={17} fill="white" strokeWidth={2.5} color="white" />
              </div>
              <div>
                <div className="font-bold text-[15px] leading-none" style={{ color: '#1a2e25' }}>EnergyWatch</div>
                <div className="text-[10px] mt-0.5 mono" style={{ color: 'rgba(26, 46, 37, 0.5)' }}>IGS · v2.4.1</div>
              </div>
            </div>
 
            <div className="hidden lg:flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(26, 46, 37, 0.04)' }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className="px-3.5 py-2 text-sm flex items-center gap-2 rounded-lg transition-all"
                  style={{
                    background: activeTab === t.id ? 'white' : 'transparent',
                    color: activeTab === t.id ? '#16a34a' : 'rgba(26, 46, 37, 0.6)',
                    fontWeight: activeTab === t.id ? 600 : 500,
                    boxShadow: activeTab === t.id ? '0 2px 8px rgba(26, 46, 37, 0.06)' : 'none'
                  }}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
          </div>
 
          <div className="flex items-center gap-3">
            {user.location_label && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs" style={{ background: 'rgba(26, 46, 37, 0.05)', color: 'rgba(26, 46, 37, 0.7)' }}>
                <MapPin size={12} /><span className="font-medium">{user.location_label}</span>
                {currentTemp != null && <span className="font-semibold" style={{ color: '#16a34a' }}>· {Math.round(currentTemp)}°F</span>}
              </div>
            )}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
              <div className="w-1.5 h-1.5 rounded-full pulse-soft" style={{ background: '#22c55e' }} />
              <span className="text-xs font-medium" style={{ color: '#16a34a' }}>Live</span>
            </div>
            <button onClick={onBellClick} className="p-2 rounded-lg hover:bg-black/5 relative" style={{ color: 'rgba(26, 46, 37, 0.6)' }}>
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
                  style={{ background: '#ef4444', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)' }}>
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2.5 pl-3 ml-1 border-l" style={{ borderColor: 'rgba(26, 46, 37, 0.1)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold" style={{ color: '#1a2e25' }}>{user?.name || user?.email?.split('@')[0]}</div>
                <div className="text-[11px]" style={{ color: 'rgba(26, 46, 37, 0.5)' }}>{user?.email}</div>
              </div>
              <button onClick={onLogout} className="p-2 rounded-lg hover:bg-black/5 ml-1" style={{ color: 'rgba(26, 46, 37, 0.5)' }}>
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>
 
        <div className="lg:hidden flex overflow-x-auto gap-1 mt-2 pb-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className="px-3 py-2 text-xs flex items-center gap-1.5 rounded-lg whitespace-nowrap"
              style={{
                background: activeTab === t.id ? 'white' : 'rgba(255, 255, 255, 0.5)',
                color: activeTab === t.id ? '#16a34a' : 'rgba(26, 46, 37, 0.6)',
                fontWeight: activeTab === t.id ? 600 : 500
              }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
 
/* ============== DASHBOARD ============== */
function Dashboard({ user, weather, weatherLoading, onAdvisoryApprove }) {
  const hourlyData = useMemo(() => {
    const hours = [];
    for (let h = 0; h < 24; h++) {
      const solar = Math.max(0, Math.sin((h - 6) * Math.PI / 12)) * 9.5;
      const demand = 1.2 + Math.sin(h * 0.5) * 0.6 + (h > 17 && h < 22 ? 2.5 : 0);
      const price = 0.08 + Math.sin((h - 14) * Math.PI / 12) * 0.06 + (h > 16 && h < 21 ? 0.08 : 0);
      hours.push({
        hour: `${String(h).padStart(2, '0')}:00`,
        h, solar: +solar.toFixed(2), demand: +demand.toFixed(2),
        price: +price.toFixed(3), battery: 40 + Math.sin(h * 0.3) * 30 + h * 1.5,
      });
    }
    return hours;
  }, []);
 
  const currentHour = new Date().getHours();
  const now = hourlyData[currentHour];
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user.name?.split(' ')[0] || user.email?.split('@')[0];
 
  const currentTemp = weather?.current?.temperature_2m;
  const currentCloud = weather?.current?.cloud_cover;
  const currentCode = weather?.current?.weather_code;
 
  return (
    <div className="space-y-6">
      <div className="fade-up">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="label-caps mb-2">{greeting}, {firstName}</p>
            <h1 className="serif text-5xl" style={{ color: '#1a2e25' }}>
              Your home is <span className="shimmer-text font-semibold">earning money</span>
            </h1>
            <p className="mt-2 text-base" style={{ color: 'rgba(26, 46, 37, 0.65)' }}>
              Selling 4.13 kW of surplus solar to the grid at peak rates · making <span className="font-semibold" style={{ color: '#16a34a' }}>+$0.87/hr</span>
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="chip" style={{ background: 'rgba(255, 255, 255, 0.7)', color: '#1a2e25' }}>
              <Clock size={12} /> {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </div>
            {weatherLoading ? (
              <div className="chip" style={{ background: 'rgba(26,46,37,0.06)', color: 'rgba(26,46,37,0.6)' }}>
                <Loader2 size={12} className="animate-spin" /> Weather…
              </div>
            ) : currentTemp != null ? (
              <div className="chip" style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#b45309' }}>
                <WeatherIcon code={currentCode} cloud={currentCloud} size={14} />
                {Math.round(currentTemp)}°F {describeWeather(currentCode)}
              </div>
            ) : (
              <div className="chip" style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#b45309' }}>
                <MapPin size={12} /> Set location for weather
              </div>
            )}
          </div>
        </div>
      </div>
 
      <AIDecisionBanner weather={weather} />
 
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-up" style={{ animationDelay: '0.1s' }}>
        <MetricCard label="Solar generation" value="6.24" unit="kW" trend="+12.4%" trendUp icon={<Sun />} accent="#f59e0b" subtext="Peak 9.1 kW at 1:14 PM" />
        <MetricCard label="Home demand" value="2.11" unit="kW" trend="−3.2%" icon={<Home />} accent="#3b82f6" subtext="HVAC, lighting, EV" />
        <MetricCard label="Battery reserve" value="87" unit="%" trend="Charging" trendUp icon={<Battery />} accent="#22c55e" subtext="11.8 / 13.5 kWh" />
        <MetricCard label="Grid export" value="4.13" unit="kW" trend="+$0.87/hr" trendUp icon={<ArrowUpFromLine />} accent="#ef4444" subtext="Selling at premium" />
      </div>
 
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 fade-up" style={{ animationDelay: '0.2s' }}>
        <div className="xl:col-span-2 card p-7">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="label-caps">Real-time flow</p>
              <h3 className="serif text-3xl mt-1" style={{ color: '#1a2e25' }}>System topology</h3>
            </div>
            <div className="chip" style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a' }}>
              <div className="w-1.5 h-1.5 rounded-full pulse-soft" style={{ background: '#22c55e' }} />Synced
            </div>
          </div>
          <PowerFlowDiagram />
        </div>
 
        <div className="card p-7">
          <p className="label-caps">24h price signal</p>
          <h3 className="serif text-3xl mt-1 mb-1" style={{ color: '#1a2e25' }}>Grid pricing</h3>
          <p className="text-sm mb-5" style={{ color: 'rgba(26, 46, 37, 0.55)' }}>Premium sell windows in green</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={hourlyData}>
              <defs>
                <linearGradient id="priceG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" stroke="#9ca3af" fontSize={10} interval={3} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
              <ReferenceLine x={now.hour} stroke="#ef4444" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="price" stroke="#22c55e" fill="url(#priceG)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t" style={{ borderColor: 'rgba(26, 46, 37, 0.08)' }}>
            <PriceStat label="Now" value={`$${now.price.toFixed(3)}`} color="#16a34a" />
            <PriceStat label="Peak" value="$0.211" color="#ef4444" />
            <PriceStat label="Low" value="$0.074" color="#64748b" />
          </div>
        </div>
      </div>
 
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 fade-up" style={{ animationDelay: '0.3s' }}>
        <div className="xl:col-span-2 card p-7">
          <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
            <div>
              <p className="label-caps">Today's profile</p>
              <h3 className="serif text-3xl mt-1" style={{ color: '#1a2e25' }}>Generation vs. demand</h3>
            </div>
            <div className="flex gap-4 text-xs">
              <LegendDot color="#f59e0b" label="Solar" />
              <LegendDot color="#3b82f6" label="Demand" />
              <LegendDot color="#22c55e" label="Battery %" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={hourlyData}>
              <XAxis dataKey="hour" stroke="#9ca3af" fontSize={11} interval={2} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
              <ReferenceLine yAxisId="left" x={now.hour} stroke="#ef4444" strokeDasharray="3 3" />
              <Line yAxisId="left" type="monotone" dataKey="solar" stroke="#f59e0b" strokeWidth={3} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="demand" stroke="#3b82f6" strokeWidth={3} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="battery" stroke="#22c55e" strokeWidth={2.5} strokeDasharray="5 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
 
        <div className="card-dark p-7 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl" style={{ background: 'rgba(167, 243, 208, 0.4)' }} />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#a7f3d0' }}>Month-to-date</p>
            <h3 className="serif text-3xl mb-6">Savings report</h3>
            <div className="mb-6">
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'rgba(240, 245, 242, 0.6)' }}>Total saved</p>
              <div className="serif text-6xl" style={{ color: '#a7f3d0' }}>$287.42</div>
              <div className="text-sm mt-2 flex items-center gap-1.5" style={{ color: 'rgba(240, 245, 242, 0.8)' }}>
                <TrendingUp size={14} style={{ color: '#a7f3d0' }} />
                <span><span style={{ color: '#a7f3d0' }} className="font-semibold">34% more</span> than last month</span>
              </div>
            </div>
            <div className="space-y-1">
              <SavingsRow label="Grid sellback" value="+$184.20" positive />
              <SavingsRow label="Self-consumption" value="+$72.80" positive />
              <SavingsRow label="Peak shaving" value="+$48.30" positive />
              <SavingsRow label="Demand charges" value="−$17.88" />
            </div>
            <div className="mt-6 pt-5 border-t flex items-center gap-2.5" style={{ borderColor: 'rgba(167, 243, 208, 0.15)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(167, 243, 208, 0.12)' }}>
                <Leaf size={16} style={{ color: '#a7f3d0' }} />
              </div>
              <div className="text-sm" style={{ color: 'rgba(240, 245, 242, 0.85)' }}>
                Equal to <b style={{ color: '#a7f3d0' }}>38 trees</b> planted this month
              </div>
            </div>
          </div>
        </div>
      </div>
 
      <AdvisoryCard weather={weather} onApprove={onAdvisoryApprove} />
    </div>
  );
}
 
/* ============== AI DECISION BANNER ============== */
function AIDecisionBanner({ weather }) {
  const cloud = weather?.current?.cloud_cover ?? 8;
  const radiation = weather?.current?.shortwave_radiation;
  const solarCapacity = radiation != null ? Math.min(100, Math.round((radiation / 900) * 100)) : 92;
 
  return (
    <div className="card-dark p-7 relative overflow-hidden fade-up" style={{ animationDelay: '0.05s' }}>
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30" style={{ background: '#ef4444' }} />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl opacity-20" style={{ background: '#22c55e' }} />
 
      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="chip" style={{ background: 'rgba(167, 243, 208, 0.12)', color: '#a7f3d0' }}>
              <Cpu size={12} /> AI decision · {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="chip" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}>
              <div className="w-1.5 h-1.5 rounded-full pulse-soft" style={{ background: '#fca5a5' }} />Active
            </div>
          </div>
          <h2 className="serif text-5xl mb-3">
            Selling to the grid<span style={{ color: '#a7f3d0' }}>.</span>
          </h2>
          <p className="text-base leading-relaxed" style={{ color: 'rgba(240, 245, 242, 0.75)' }}>
            Peak pricing detected. Routing 4.13 kW surplus solar to the grid while the battery holds 87% for your evening demand.
          </p>
        </div>
 
        <div className="lg:col-span-3 grid grid-cols-3 lg:grid-cols-1 gap-3">
          <MiniStat label="Confidence" value="94%" color="#a7f3d0" />
          <MiniStat label="Revenue / hr" value="+$0.87" color="#a7f3d0" />
          <MiniStat label="Next review" value="18 min" color="#fde68a" />
        </div>
 
        <div className="lg:col-span-4 p-5 rounded-2xl" style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(167, 243, 208, 0.1)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#a7f3d0' }}>Reasoning</p>
          <div className="space-y-2 text-sm" style={{ color: 'rgba(240, 245, 242, 0.9)' }}>
            <ReasonItem text={`Solar capacity at ${solarCapacity}%`} />
            <ReasonItem text="Grid rate in peak tier ($0.211)" />
            <ReasonItem text={`Cloud cover ${cloud}% — favorable`} />
            <ReasonItem text="Low household load until 5 PM" />
          </div>
        </div>
      </div>
    </div>
  );
}
 
/* ============== ADVISORY ============== */
function AdvisoryCard({ weather, onApprove }) {
  // Derive a real advisory from the forecast if available
  const advisory = useMemo(() => {
    const daily = weather?.daily;
    if (!daily?.time?.length) {
      return {
        title: 'Pre-charge battery ahead of cloudy stretch',
        body: 'The AI recommends topping the battery to 100% on the next off-peak window to cover low-solar periods.',
        savings: '+$42.10'
      };
    }
    // Find the day with the lowest radiation in the next 7 days
    let worstIdx = 0, worst = Infinity;
    daily.shortwave_radiation_sum?.forEach((v, i) => { if (v != null && v < worst) { worst = v; worstIdx = i; } });
    const day = new Date(daily.time[worstIdx]).toLocaleDateString(undefined, { weekday: 'long' });
    const dropPct = Math.round((1 - worst / (Math.max(...daily.shortwave_radiation_sum))) * 100);
    return {
      title: `${day} looks overcast — pre-charge battery`,
      body: `Projected ${dropPct}% reduction in solar yield. EnergyWatch recommends pre-charging the battery to 100% the night before using off-peak rates.`,
      savings: '+$42.10',
      day,
      dropPct
    };
  }, [weather]);
 
  const handleApprove = () => {
    onApprove({
      type: 'advisory',
      title: `Approved: ${advisory.title}`,
      body: `Plan engaged. ${advisory.body} Expected savings vs. reactive: ${advisory.savings}.`,
      action: 'PRE_CHARGE',
      prev_state: { battery_target: 80, mode: 'normal' },
      new_state: { battery_target: 100, mode: 'pre_charge_night', trigger_day: advisory.day }
    });
  };
 
  return (
    <div className="card-dark p-7 relative overflow-hidden fade-up" style={{ animationDelay: '0.4s' }}>
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30" style={{ background: '#fde68a' }} />
      <div className="relative flex items-start gap-5 flex-wrap">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(253, 230, 138, 0.15)', border: '1px solid rgba(253, 230, 138, 0.3)' }}>
          <AlertCircle size={22} style={{ color: '#fde68a' }} />
        </div>
        <div className="flex-1 min-w-[280px]">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#fde68a' }}>Strategic advisory</p>
          <h3 className="serif text-3xl mb-2">{advisory.title}</h3>
          <p className="text-base leading-relaxed" style={{ color: 'rgba(240, 245, 242, 0.8)' }}>
            {advisory.body} Projected savings vs. reactive strategy: <b style={{ color: '#a7f3d0' }}>{advisory.savings}</b>.
          </p>
          <div className="flex gap-3 mt-5 flex-wrap">
            <button onClick={handleApprove} className="btn-primary">Approve plan</button>
            <button className="px-6 py-3.5 rounded-xl font-semibold text-sm" style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#f0f5f2', border: '1px solid rgba(255, 255, 255, 0.15)' }}>Modify</button>
          </div>
          <p className="text-xs mt-3" style={{ color: 'rgba(240, 245, 242, 0.5)' }}>
            Approving logs the change to your notification center — you can revert it anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
 
/* ============== WEATHER ICON ============== */
function WeatherIcon({ code, cloud, size = 16 }) {
  if (code == null) return <Cloud size={size} />;
  // Open-Meteo WMO codes
  if (code === 0) return <Sun size={size} />;
  if (code <= 3) return <Cloud size={size} />;
  if (code >= 51 && code <= 67) return <CloudRain size={size} />;
  if (code >= 71 && code <= 77) return <CloudSnow size={size} />;
  if (code >= 80 && code <= 99) return <CloudRain size={size} />;
  return <Cloud size={size} />;
}
 
function describeWeather(code) {
  if (code == null) return '';
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code >= 45 && code <= 48) return 'Foggy';
  if (code >= 51 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80) return 'Showers';
  return '';
}
 
function ReasonItem({ text }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(167, 243, 208, 0.15)' }}>
        <Check size={10} style={{ color: '#a7f3d0' }} strokeWidth={3} />
      </div>
      {text}
    </div>
  );
}
 
function MiniStat({ label, value, color }) {
  return (
    <div className="p-3 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(167, 243, 208, 0.08)' }}>
      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(240, 245, 242, 0.5)' }}>{label}</p>
      <div className="serif text-2xl" style={{ color }}>{value}</div>
    </div>
  );
}
 
function MetricCard({ label, value, unit, trend, trendUp, icon, accent, subtext }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${accent}15`, color: accent }}>
          {React.cloneElement(icon, { size: 20, strokeWidth: 2 })}
        </div>
        {trend && (
          <div className="chip" style={{ background: trendUp ? 'rgba(34, 197, 94, 0.1)' : 'rgba(100, 116, 139, 0.1)', color: trendUp ? '#16a34a' : '#64748b' }}>
            {trend}
          </div>
        )}
      </div>
      <p className="label-caps">{label}</p>
      <div className="flex items-baseline gap-1.5 mt-1.5">
        <span className="metric-xl" style={{ color: '#1a2e25' }}>{value}</span>
        <span className="text-base font-medium" style={{ color: 'rgba(26, 46, 37, 0.5)' }}>{unit}</span>
      </div>
      {subtext && <p className="text-xs mt-2" style={{ color: 'rgba(26, 46, 37, 0.55)' }}>{subtext}</p>}
    </div>
  );
}
 
function LegendDot({ color, label }) {
  return <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: color }} /><span style={{ color: 'rgba(26, 46, 37, 0.65)' }}>{label}</span></div>;
}
 
function SavingsRow({ label, value, positive }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b" style={{ borderColor: 'rgba(167, 243, 208, 0.08)' }}>
      <span className="text-sm" style={{ color: 'rgba(240, 245, 242, 0.75)' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: positive ? '#a7f3d0' : '#fca5a5' }}>{value}</span>
    </div>
  );
}
 
function PriceStat({ label, value, color }) {
  return (
    <div><p className="label-caps">{label}</p><p className="text-base font-bold mt-1" style={{ color }}>{value}</p></div>
  );
}
 
/* ============== POWER FLOW ============== */
function PowerFlowDiagram() {
  return (
    <svg viewBox="0 0 700 320" className="w-full">
      <defs>
        <linearGradient id="fl1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#22c55e" /></linearGradient>
        <linearGradient id="fl2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient>
        <linearGradient id="fl3" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#ef4444" /></linearGradient>
      </defs>
      <path d="M 155 90 Q 250 90 350 170" stroke="url(#fl1)" strokeWidth="3" fill="none" className="flow-line" strokeLinecap="round" />
      <path d="M 155 230 Q 250 230 350 170" stroke="#cbd5e1" strokeWidth="2" fill="none" strokeDasharray="4 5" opacity="0.5" strokeLinecap="round" />
      <path d="M 350 170 Q 450 170 545 90" stroke="url(#fl3)" strokeWidth="3" fill="none" className="flow-line" strokeLinecap="round" />
      <path d="M 350 170 Q 450 170 545 230" stroke="url(#fl2)" strokeWidth="3" fill="none" className="flow-line" strokeLinecap="round" />
      <FlowNode x={90} y={90} label="SOLAR" value="6.24 kW" color="#f59e0b" icon="sun" />
      <FlowNode x={90} y={230} label="GRID" value="Idle" color="#94a3b8" icon="grid" dim />
      <FlowNode x={350} y={170} label="AI ROUTER" value="Optimizing" color="#22c55e" icon="cpu" big />
      <FlowNode x={610} y={90} label="EXPORT" value="4.13 kW" color="#ef4444" icon="export" />
      <FlowNode x={610} y={230} label="HOME" value="2.11 kW" color="#3b82f6" icon="home" />
      <g transform="translate(350, 260)">
        <rect x="-70" y="0" width="140" height="32" rx="16" fill="white" stroke="#22c55e" strokeWidth="1.5" />
        <rect x="-66" y="4" width="121" height="24" rx="12" fill="url(#fl1)" opacity="0.85" />
        <text x="0" y="21" textAnchor="middle" fill="white" fontSize="12" fontWeight="700">Battery · 87%</text>
      </g>
      <g className="mono">
        <rect x="200" y="115" width="100" height="22" rx="11" fill="white" stroke="#e5e7eb" strokeWidth="1" />
        <text x="250" y="130" textAnchor="middle" fill="#16a34a" fontSize="11" fontWeight="700">→ 6.24 kW</text>
        <rect x="400" y="115" width="130" height="22" rx="11" fill="white" stroke="#e5e7eb" strokeWidth="1" />
        <text x="465" y="130" textAnchor="middle" fill="#ef4444" fontSize="11" fontWeight="700">→ 4.13 kW · $0.21</text>
        <rect x="410" y="205" width="100" height="22" rx="11" fill="white" stroke="#e5e7eb" strokeWidth="1" />
        <text x="460" y="220" textAnchor="middle" fill="#3b82f6" fontSize="11" fontWeight="700">→ 2.11 kW</text>
      </g>
    </svg>
  );
}
 
function FlowNode({ x, y, label, value, color, icon, big, dim }) {
  const size = big ? 48 : 40;
  return (
    <g transform={`translate(${x}, ${y})`} opacity={dim ? 0.5 : 1}>
      {big && <circle r={size + 14} fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 4" opacity="0.3" />}
      <circle r={size + 6} fill={`${color}15`} />
      <circle r={size} fill="white" stroke={color} strokeWidth="2" />
      <g>
        {icon === 'sun' && <g><circle r="8" fill={color} /><g stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="-14" y1="0" x2="-18" y2="0" /><line x1="14" y1="0" x2="18" y2="0" /><line x1="0" y1="-14" x2="0" y2="-18" /><line x1="0" y1="14" x2="0" y2="18" /><line x1="-10" y1="-10" x2="-13" y2="-13" /><line x1="10" y1="-10" x2="13" y2="-13" /><line x1="-10" y1="10" x2="-13" y2="13" /><line x1="10" y1="10" x2="13" y2="13" /></g></g>}
        {icon === 'grid' && <g stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"><rect x="-11" y="-11" width="22" height="22" rx="2" /><line x1="-11" y1="0" x2="11" y2="0" /><line x1="0" y1="-11" x2="0" y2="11" /></g>}
        {icon === 'cpu' && <g><rect x="-14" y="-14" width="28" height="28" rx="5" fill="none" stroke={color} strokeWidth="2.5" /><rect x="-6" y="-6" width="12" height="12" rx="2" fill={color} /></g>}
        {icon === 'export' && <g stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"><path d="M -9 5 L 0 -7 L 9 5" /><line x1="0" y1="-7" x2="0" y2="11" /></g>}
        {icon === 'home' && <g stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M -11 2 L 0 -9 L 11 2 L 11 11 L -11 11 Z" /></g>}
      </g>
      <text y={size + 20} textAnchor="middle" fill="rgba(26, 46, 37, 0.5)" fontSize="10" fontWeight="600" letterSpacing="1.5">{label}</text>
      <text y={size + 36} textAnchor="middle" fill={color} fontSize="13" fontWeight="700">{value}</text>
    </g>
  );
}
 
/* ============== ENERGY SOURCES ============== */
function EnergySources() {
  const sources = [
    { name: 'Solar PV', percent: 64, kwh: '38.2', icon: <Sun />, color: '#f59e0b', status: 'Primary · Generating' },
    { name: 'Battery', percent: 18, kwh: '10.8', icon: <Battery />, color: '#22c55e', status: 'Buffering' },
    { name: 'Grid (mixed)', percent: 14, kwh: '8.4', icon: <Zap />, color: '#64748b', status: 'Off-peak import' },
    { name: 'Natural gas', percent: 4, kwh: '2.3', icon: <Flame />, color: '#ef4444', status: 'Water heater only' },
  ];
  const gridMix = [
    { name: 'Wind', value: 32, color: '#3b82f6' },
    { name: 'Solar', value: 18, color: '#f59e0b' },
    { name: 'Nuclear', value: 22, color: '#8b5cf6' },
    { name: 'Natural gas', value: 21, color: '#ef4444' },
    { name: 'Hydro', value: 5, color: '#06b6d4' },
    { name: 'Coal', value: 2, color: '#475569' },
  ];
 
  return (
    <div className="space-y-6">
      <div className="fade-up">
        <p className="label-caps mb-2">Energy mix · source identification</p>
        <h2 className="serif text-5xl" style={{ color: '#1a2e25' }}>Where your power comes from</h2>
        <p className="text-base mt-3 max-w-3xl" style={{ color: 'rgba(26, 46, 37, 0.65)' }}>
          EnergyWatch identifies and meters every source feeding your home — separating solar, battery, grid imports, and fossil utilities like natural gas in real time.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 fade-up" style={{ animationDelay: '0.1s' }}>
        {sources.map(s => <SourceCard key={s.name} {...s} />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 fade-up" style={{ animationDelay: '0.2s' }}>
        <div className="xl:col-span-2 card p-7">
          <p className="label-caps">24-hour timeline</p>
          <h3 className="serif text-3xl mt-1 mb-5" style={{ color: '#1a2e25' }}>Source mix over time</h3>
          <SourceStackedChart />
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-xs" style={{ borderColor: 'rgba(26, 46, 37, 0.08)' }}>
            {sources.map(s => <LegendDot key={s.name} color={s.color} label={s.name} />)}
          </div>
        </div>
        <div className="card p-7">
          <p className="label-caps">Utility grid composition</p>
          <h3 className="serif text-2xl mt-1 mb-1" style={{ color: '#1a2e25' }}>When you buy from grid</h3>
          <p className="text-sm mb-5" style={{ color: 'rgba(26, 46, 37, 0.55)' }}>Local fuel mix from IGS disclosure</p>
          <div className="space-y-3.5">
            {gridMix.map(m => (
              <div key={m.name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span style={{ color: 'rgba(26, 46, 37, 0.8)' }}>{m.name}</span>
                  <span style={{ color: m.color }} className="font-bold">{m.value}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(26, 46, 37, 0.06)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${m.value}%`, background: m.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(34, 197, 94, 0.02))', border: '1px solid rgba(34, 197, 94, 0.15)' }}>
            <p className="label-caps">Renewable share</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="metric-xl" style={{ color: '#16a34a' }}>57%</span>
              <span className="text-sm font-semibold" style={{ color: '#16a34a' }}>↑ 8pts YoY</span>
            </div>
          </div>
        </div>
      </div>
      <div className="card p-7 fade-up" style={{ animationDelay: '0.3s' }}>
        <p className="label-caps">Load disaggregation</p>
        <h3 className="serif text-3xl mt-1 mb-5" style={{ color: '#1a2e25' }}>What's using your power right now</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DeviceCard name="HVAC" load="1.42 kW" percent={67} source="Solar" color="#f59e0b" />
          <DeviceCard name="EV charger" load="0.00 kW" percent={0} source="Idle" color="#94a3b8" />
          <DeviceCard name="Water heater" load="0.38 kW" percent={18} source="Nat. gas" color="#ef4444" />
          <DeviceCard name="Appliances" load="0.31 kW" percent={15} source="Solar" color="#f59e0b" />
        </div>
      </div>
    </div>
  );
}
 
function SourceCard({ name, percent, kwh, icon, color, status }) {
  return (
    <div className="card p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: color, opacity: 0.8 }} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
          {React.cloneElement(icon, { size: 20, strokeWidth: 2 })}
        </div>
        <div className="serif text-4xl" style={{ color }}>{percent}<span className="text-lg">%</span></div>
      </div>
      <p className="label-caps">{name}</p>
      <p className="text-lg font-bold mt-1" style={{ color: '#1a2e25' }}>{kwh} kWh <span className="text-sm font-medium" style={{ color: 'rgba(26, 46, 37, 0.5)' }}>today</span></p>
      <div className="flex items-center gap-1.5 mt-3 text-xs" style={{ color }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} /><span className="font-medium">{status}</span>
      </div>
    </div>
  );
}
 
function SourceStackedChart() {
  const data = useMemo(() => {
    const arr = [];
    for (let h = 0; h < 24; h++) {
      const solar = Math.max(0, Math.sin((h - 6) * Math.PI / 12)) * 5;
      const battery = h > 17 && h < 23 ? 2 + Math.random() * 1.5 : (h < 6 ? 1.2 : 0.3);
      const grid = h < 6 || h > 22 ? 1.5 + Math.random() : 0.2;
      const gas = 0.3 + Math.random() * 0.2;
      arr.push({ hour: String(h).padStart(2, '0'), solar: +solar.toFixed(2), battery: +battery.toFixed(2), grid: +grid.toFixed(2), gas: +gas.toFixed(2) });
    }
    return arr;
  }, []);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <XAxis dataKey="hour" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
        <Area type="monotone" dataKey="solar" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.75} />
        <Area type="monotone" dataKey="battery" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.75} />
        <Area type="monotone" dataKey="grid" stackId="1" stroke="#64748b" fill="#64748b" fillOpacity={0.65} />
        <Area type="monotone" dataKey="gas" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.65} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
 
function DeviceCard({ name, load, percent, source, color }) {
  return (
    <div className="p-4 rounded-2xl" style={{ background: 'rgba(255, 255, 255, 0.6)', border: '1px solid rgba(26, 46, 37, 0.06)' }}>
      <div className="flex justify-between items-start mb-3">
        <p className="label-caps">{name}</p>
        <span className="chip" style={{ background: `${color}15`, color, padding: '3px 9px', fontSize: '10px' }}>{source}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: '#1a2e25' }}>{load}</div>
      <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(26, 46, 37, 0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${percent}%`, background: color }} />
      </div>
    </div>
  );
}
 
/* ============== AI DECISIONS ============== */
function AIDecisions() {
  const models = [
    { name: 'Price forecasting', version: 'v3.2', accuracy: 94.2, status: 'Active', desc: 'LSTM trained on ISO-wholesale and retail tariff data' },
    { name: 'Weather synthesis', version: 'v2.8', accuracy: 89.7, status: 'Active', desc: 'Ensemble of NOAA GFS, HRRR, and local irradiance sensors' },
    { name: 'Load prediction', version: 'v4.1', accuracy: 96.1, status: 'Active', desc: 'XGBoost on 90-day occupancy and device-level patterns' },
    { name: 'Optimizer', version: 'v1.9', accuracy: 91.5, status: 'Active', desc: 'Mixed-integer LP with a 72-hour rolling horizon' },
  ];
  return (
    <div className="space-y-6">
      <div className="fade-up">
        <p className="label-caps mb-2">AI decision engine</p>
        <h2 className="serif text-5xl" style={{ color: '#1a2e25' }}>The brain behind every watt</h2>
        <p className="text-base mt-3 max-w-3xl" style={{ color: 'rgba(26, 46, 37, 0.65)' }}>
          Four specialized models run every two seconds — synthesizing weather, pricing, and load signals into optimal dispatch decisions.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 fade-up" style={{ animationDelay: '0.1s' }}>
        {models.map(m => (
          <div key={m.name} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}>
                <Cpu size={18} />
              </div>
              <span className="chip" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}>
                <div className="w-1.5 h-1.5 rounded-full pulse-soft" style={{ background: '#22c55e' }} />{m.status}
              </span>
            </div>
            <p className="label-caps">{m.name}</p>
            <p className="text-xs mt-0.5 mono" style={{ color: 'rgba(26, 46, 37, 0.5)' }}>{m.version}</p>
            <div className="serif text-5xl mt-4" style={{ color: '#1a2e25' }}>{m.accuracy}<span className="text-xl">%</span></div>
            <p className="label-caps mt-1">7-day accuracy</p>
            <p className="text-xs mt-3 pt-3 border-t leading-relaxed" style={{ borderColor: 'rgba(26, 46, 37, 0.08)', color: 'rgba(26, 46, 37, 0.65)' }}>{m.desc}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 fade-up" style={{ animationDelay: '0.2s' }}>
        <div className="card p-7">
          <p className="label-caps">72h projected actions</p>
          <h3 className="serif text-3xl mt-1 mb-5" style={{ color: '#1a2e25' }}>Planned dispatch</h3>
          <DispatchPlan />
        </div>
        <div className="card p-7">
          <p className="label-caps">Current reasoning</p>
          <h3 className="serif text-3xl mt-1 mb-5" style={{ color: '#1a2e25' }}>Decision tree</h3>
          <DecisionTree />
        </div>
      </div>
    </div>
  );
}
 
function DispatchPlan() {
  const hours = [
    { h: 'Now · 14:00', action: 'Sell', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', reason: 'Peak tariff · surplus solar' },
    { h: '15:00', action: 'Sell', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', reason: 'Peak tariff continues' },
    { h: '16:00', action: 'Sell', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', reason: 'Price holding at $0.21' },
    { h: '17:00', action: 'Consume', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', reason: 'Demand ramp · HVAC + cooking' },
    { h: '18:00', action: 'Discharge', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', reason: 'Battery → home · avoid peak buy' },
    { h: '19:00', action: 'Discharge', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', reason: 'Continue battery-first strategy' },
    { h: '20:00', action: 'Discharge', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', reason: 'Hold until price drop' },
    { h: '21:00', action: 'Hold', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', reason: 'Tariff transition window' },
    { h: '22:00', action: 'Buy', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', reason: 'Off-peak · top battery to 95%' },
  ];
  return (
    <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-2">
      {hours.map((h, i) => (
        <div key={i} className="grid grid-cols-12 gap-3 p-3 rounded-xl items-center text-sm" style={{ background: i === 0 ? 'rgba(34, 197, 94, 0.05)' : 'transparent' }}>
          <div className="col-span-3 font-medium" style={{ color: i === 0 ? '#16a34a' : 'rgba(26, 46, 37, 0.6)' }}>{h.h}</div>
          <div className="col-span-3"><span className="chip" style={{ background: h.bg, color: h.color }}>{h.action}</span></div>
          <div className="col-span-6" style={{ color: 'rgba(26, 46, 37, 0.75)' }}>{h.reason}</div>
        </div>
      ))}
    </div>
  );
}
 
function DecisionTree() {
  return (
    <div className="space-y-2.5">
      <TreeRow depth={0} color="#16a34a" label="Input: market signals" bold />
      <TreeRow depth={1} label="If grid_price > $0.18/kWh" pass detail="→ $0.211" />
      <TreeRow depth={1} label="And solar_surplus > 2 kW" pass detail="→ 4.13 kW" />
      <TreeRow depth={1} label="And battery_soc > 80%" pass detail="→ 87%" />
      <TreeRow depth={1} label="And forecast_ok_next_3h" pass detail="→ Clear" />
      <div className="mt-4 p-5 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.02))', borderLeft: '3px solid #ef4444' }}>
        <div className="flex items-center gap-2 mb-2">
          <ArrowUpFromLine size={14} style={{ color: '#ef4444' }} />
          <p className="font-bold text-sm" style={{ color: '#dc2626' }}>Decision · Sell 4.13 kW to grid</p>
        </div>
        <div className="flex items-center gap-4 text-sm flex-wrap" style={{ color: 'rgba(26, 46, 37, 0.75)' }}>
          <span>Confidence <b style={{ color: '#16a34a' }}>94%</b></span>
          <span>Revenue <b style={{ color: '#16a34a' }}>+$0.87/hr</b></span>
          <span>Next review <b>18 min</b></span>
        </div>
      </div>
    </div>
  );
}
 
function TreeRow({ depth, label, pass, bold, detail, color }) {
  return (
    <div className="flex items-center gap-3 text-sm" style={{ paddingLeft: depth * 16 }}>
      {pass && (
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34, 197, 94, 0.15)' }}>
          <Check size={11} style={{ color: '#16a34a' }} strokeWidth={3} />
        </div>
      )}
      <span style={{ color: color || (bold ? '#1a2e25' : 'rgba(26, 46, 37, 0.85)'), fontWeight: bold ? 600 : 500 }}>{label}</span>
      {detail && <span className="text-xs font-mono ml-auto px-2 py-0.5 rounded-md" style={{ background: 'rgba(34, 197, 94, 0.08)', color: '#16a34a' }}>{detail}</span>}
    </div>
  );
}
 
/* ============== FORECAST ============== */
function ForecastPanel({ weather, user }) {
  // Convert Open-Meteo daily to displayable format
  const forecast = useMemo(() => {
    if (!weather?.daily?.time) return null;
    const { time, weather_code, temperature_2m_max, temperature_2m_min, shortwave_radiation_sum, precipitation_sum } = weather.daily;
    const maxRadiation = Math.max(...(shortwave_radiation_sum || [1]));
    return time.map((t, i) => {
      const d = new Date(t);
      const isToday = i === 0;
      const radPct = shortwave_radiation_sum ? Math.round((shortwave_radiation_sum[i] / maxRadiation) * 100) : 50;
      const code = weather_code?.[i];
      const priceCategory = radPct > 75 ? 'High' : radPct > 40 ? 'Med' : 'Low';
      const rec = radPct > 75 ? 'Sell aggressively' : radPct > 40 ? 'Self-consume' : 'Pre-charge battery';
      return {
        day: isToday ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' }),
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        temp: Math.round(temperature_2m_max?.[i] ?? 0),
        low: Math.round(temperature_2m_min?.[i] ?? 0),
        cond: describeWeather(code),
        code,
        irr: radPct,
        price: priceCategory,
        rec,
      };
    });
  }, [weather]);
 
  return (
    <div className="space-y-6">
      <div className="fade-up">
        <p className="label-caps mb-2">Forecast · 7 days</p>
        <h2 className="serif text-5xl" style={{ color: '#1a2e25' }}>The week ahead</h2>
        <p className="text-base mt-3 max-w-3xl" style={{ color: 'rgba(26, 46, 37, 0.65)' }}>
          Live weather from Open-Meteo{user?.location_label ? <> for <b>{user.location_label}</b></> : ''}. The AI uses this to drive every dispatch decision.
        </p>
      </div>
 
      {!forecast && (
        <div className="card p-10 text-center">
          <Loader2 size={24} className="animate-spin mx-auto mb-3" style={{ color: '#22c55e' }} />
          <p style={{ color: 'rgba(26, 46, 37, 0.6)' }}>
            {user?.latitude ? 'Loading weather data…' : 'Set your location in System to see the forecast.'}
          </p>
        </div>
      )}
 
      {forecast && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 fade-up" style={{ animationDelay: '0.1s' }}>
          {forecast.map((d, i) => (
            <div key={i} className="card p-4 text-center" style={{ background: i === 0 ? 'linear-gradient(180deg, rgba(34, 197, 94, 0.08), rgba(255, 255, 255, 0.7))' : undefined }}>
              <p className="label-caps">{d.day}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(26, 46, 37, 0.45)' }}>{d.date}</p>
              <div className="my-3 flex justify-center" style={{ color: d.code === 0 ? '#f59e0b' : '#64748b' }}>
                <WeatherIcon code={d.code} size={44} />
              </div>
              <div className="serif text-3xl" style={{ color: '#1a2e25' }}>{d.temp}°</div>
              <p className="text-xs mt-1" style={{ color: 'rgba(26, 46, 37, 0.55)' }}>{d.low}° · {d.cond}</p>
              <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: 'rgba(26, 46, 37, 0.08)' }}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'rgba(26, 46, 37, 0.5)' }}>Irrad</span>
                  <span className="font-bold" style={{ color: '#f59e0b' }}>{d.irr}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'rgba(26, 46, 37, 0.5)' }}>Price</span>
                  <span className="font-bold" style={{ color: d.price === 'High' ? '#ef4444' : d.price === 'Med' ? '#f59e0b' : '#16a34a' }}>{d.price}</span>
                </div>
              </div>
              <div className="mt-3 px-2 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}>
                {d.rec}
              </div>
            </div>
          ))}
        </div>
      )}
 
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 fade-up" style={{ animationDelay: '0.2s' }}>
        <div className="card p-7">
          <p className="label-caps">7-day price forecast</p>
          <h3 className="serif text-3xl mt-1 mb-5" style={{ color: '#1a2e25' }}>Grid tariff projections</h3>
          <ForecastPriceChart />
        </div>
        <div className="card p-7">
          <p className="label-caps">Projected generation</p>
          <h3 className="serif text-3xl mt-1 mb-5" style={{ color: '#1a2e25' }}>Solar output forecast</h3>
          <ForecastSolarChart weather={weather} />
        </div>
      </div>
    </div>
  );
}
 
function ForecastPriceChart() {
  const data = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 7; i++) {
      for (let h = 0; h < 24; h += 3) {
        arr.push({
          t: `D${i + 1}.${h}`,
          peak: 0.10 + Math.sin((h - 14) * Math.PI / 12) * 0.07 + Math.random() * 0.02 + (i === 1 || i === 5 ? 0.04 : 0),
          offpeak: 0.06 + Math.random() * 0.01,
        });
      }
    }
    return arr;
  }, []);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <XAxis dataKey="t" stroke="#9ca3af" fontSize={10} interval={7} tickLine={false} axisLine={false} />
        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
        <Line type="monotone" dataKey="peak" stroke="#ef4444" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="offpeak" stroke="#22c55e" strokeWidth={2.5} dot={false} strokeDasharray="5 3" />
      </LineChart>
    </ResponsiveContainer>
  );
}
 
function ForecastSolarChart({ weather }) {
  const data = useMemo(() => {
    if (weather?.daily?.shortwave_radiation_sum) {
      return weather.daily.time.map((t, i) => ({
        day: new Date(t).toLocaleDateString(undefined, { weekday: 'short' }),
        kwh: Math.round((weather.daily.shortwave_radiation_sum[i] || 0) / 100)
      }));
    }
    const days = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
    const yields = [62, 58, 55, 38, 12, 42, 56];
    return days.map((d, i) => ({ day: d, kwh: yields[i] }));
  }, [weather]);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <defs>
          <linearGradient id="solarB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
            <stop offset="100%" stopColor="#fde68a" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
        <Bar dataKey="kwh" fill="url(#solarB)" radius={[12, 12, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
 
/* ============== SETTINGS ============== */
function SettingsPanel({ user, onShowLocation }) {
  return (
    <div className="space-y-6">
      <div className="fade-up">
        <p className="label-caps mb-2">System · connected account</p>
        <h2 className="serif text-5xl" style={{ color: '#1a2e25' }}>Your setup</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-up" style={{ animationDelay: '0.1s' }}>
        <div className="card p-7 lg:col-span-2">
          <p className="label-caps mb-5">Account</p>
          <div className="space-y-1">
            <SettingRow label="Name" value={user.name || '—'} />
            <SettingRow label="Email" value={user.email} />
            <SettingRow label="Location" value={user.location_label || 'Not set'} action={
              <button onClick={onShowLocation} className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}>
                {user.location_label ? 'Change' : 'Set location'}
              </button>
            } />
            {user.zip_code && <SettingRow label="Zip code" value={user.zip_code} />}
            {user.latitude && <SettingRow label="Coordinates" value={`${user.latitude.toFixed(3)}, ${user.longitude.toFixed(3)}`} />}
            <SettingRow label="Verification" value="Verified via email" badge="Active" />
          </div>
        </div>
        <div className="card-dark p-7">
          <p className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: '#a7f3d0' }}>System hardware</p>
          <div className="space-y-4 text-sm">
            <HardwareRow label="Inverter" value="Enphase IQ8M-72-2-US" />
            <HardwareRow label="Solar array" value="11.2 kW · 28× REC Alpha Pure" />
            <HardwareRow label="Battery" value="Tesla Powerwall 3 · 13.5 kWh" />
            <HardwareRow label="Meter" value="Emporia Vue 3 · 16ch CT" />
            <HardwareRow label="Natural gas" value="Columbia Gas of Ohio" />
          </div>
          <div className="mt-6 pt-5 border-t flex items-center gap-2" style={{ borderColor: 'rgba(167, 243, 208, 0.15)' }}>
            <div className="w-2 h-2 rounded-full pulse-soft" style={{ background: '#a7f3d0' }} />
            <span className="text-sm font-semibold" style={{ color: '#a7f3d0' }}>All systems nominal</span>
          </div>
        </div>
      </div>
      <div className="card p-7 fade-up" style={{ animationDelay: '0.2s' }}>
        <p className="label-caps mb-5">AI preferences</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PreferenceCard title="Strategy" value="Aggressive" desc="Maximize grid sellback" active />
          <PreferenceCard title="Battery reserve" value="20%" desc="Minimum reserve for outages" />
          <PreferenceCard title="Notifications" value="All events" desc="Every AI change goes to the notification center" />
        </div>
      </div>
    </div>
  );
}
 
function SettingRow({ label, value, badge, action }) {
  return (
    <div className="flex justify-between items-center py-3 border-b" style={{ borderColor: 'rgba(26, 46, 37, 0.06)' }}>
      <span className="label-caps">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium" style={{ color: '#1a2e25' }}>{value}</span>
        {badge && <span className="chip" style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a' }}><div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />{badge}</span>}
        {action}
      </div>
    </div>
  );
}
 
function HardwareRow({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(240, 245, 242, 0.5)' }}>{label}</p>
      <p className="mt-0.5" style={{ color: 'rgba(240, 245, 242, 0.95)' }}>{value}</p>
    </div>
  );
}
 
function PreferenceCard({ title, value, desc, active }) {
  return (
    <div className="p-5 rounded-2xl transition-all" style={{
      background: active ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(34, 197, 94, 0.02))' : 'rgba(255, 255, 255, 0.6)',
      border: active ? '1.5px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(26, 46, 37, 0.08)'
    }}>
      <p className="label-caps">{title}</p>
      <div className="serif text-3xl mt-1" style={{ color: active ? '#16a34a' : '#1a2e25' }}>{value}</div>
      <p className="text-sm mt-2" style={{ color: 'rgba(26, 46, 37, 0.6)' }}>{desc}</p>
    </div>
  );
}
 
/* ============== FOOTER ============== */
function Footer() {
  return (
    <footer className="mt-12 pb-8 relative z-10">
      <div className="max-w-[1500px] mx-auto px-6 lg:px-8">
        <div className="card px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs" style={{ color: 'rgba(26, 46, 37, 0.5)' }}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
              <Zap size={13} fill="white" strokeWidth={2.5} color="white" />
            </div>
            <span>© 2026 EnergyWatch · Built for the IGS Energy Hackathon</span>
          </div>
          <div className="flex items-center gap-4 mono">
            <span>API v2.4.1</span>
            <span className="flex items-center gap-1.5" style={{ color: '#16a34a' }}>
              <div className="w-1.5 h-1.5 rounded-full pulse-soft" style={{ background: '#22c55e' }} />All systems OK
            </span>
            <span>99.97% uptime</span>
          </div>
        </div>
      </div>
    </footer>
  );
}