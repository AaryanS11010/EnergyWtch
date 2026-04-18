import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ReferenceLine } from 'recharts';
import { Sun, Zap, Battery, Flame, Activity, TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine, Home, Cpu, AlertCircle, Lock, Mail, User, LogOut, Settings, Bell, Clock, Leaf, Gauge, Check, Sparkles, CloudSun, Droplets, Wind } from 'lucide-react';

export default function EnergyWatch() {
  const [authView, setAuthView] = useState('signin');
  const [isAuthed, setIsAuthed] = useState(false);
  const [user, setUser] = useState(null);
  const [tick, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const handleAuth = (email, name) => {
    setUser({
      email,
      name: name || email.split('@')[0],
      home: '247 Maple Ridge Dr, Columbus OH',
      system: 'Tesla Powerwall 3 + 11.2kW Solar'
    });
    setIsAuthed(true);
  };

  if (!isAuthed) {
    return <AuthScreen view={authView} setView={setAuthView} onAuth={handleAuth} />;
  }

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(180deg, #f4f7f2 0%, #eef2ec 100%)',
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: '#1a2e22'
    }}>
      <GlobalStyles />
      <TopNav user={user} onLogout={() => { setIsAuthed(false); setUser(null); }} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-[1500px] mx-auto px-6 py-8">
        {activeTab === 'dashboard' && <Dashboard tick={tick} user={user} />}
        {activeTab === 'sources' && <EnergySources tick={tick} />}
        {activeTab === 'ai' && <AIDecisions tick={tick} />}
        {activeTab === 'forecast' && <ForecastPanel tick={tick} />}
        {activeTab === 'settings' && <SettingsPanel user={user} />}
      </main>

      <Footer />
    </div>
  );
}

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&display=swap');

      * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; box-sizing: border-box; }
      .display-font { font-family: 'Fraunces', Georgia, serif; letter-spacing: -0.02em; }

      @keyframes softPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.1); }
      }
      @keyframes flow {
        0% { stroke-dashoffset: 100; }
        100% { stroke-dashoffset: 0; }
      }
      @keyframes ticker {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes gentleFloat {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-4px); }
      }
      @keyframes shimmer {
        0% { background-position: -1000px 0; }
        100% { background-position: 1000px 0; }
      }

      .fade-in { animation: fadeInUp 0.5s ease-out; }
      .pulse-dot { animation: softPulse 2.5s ease-in-out infinite; }
      .flow-line { stroke-dasharray: 6 4; animation: flow 2.5s linear infinite; }
      .gentle-float { animation: gentleFloat 3s ease-in-out infinite; }

      .card {
        background: #ffffff;
        border-radius: 24px;
        border: 1px solid rgba(26, 46, 34, 0.06);
        box-shadow: 0 1px 3px rgba(26, 46, 34, 0.04), 0 1px 2px rgba(26, 46, 34, 0.02);
        transition: box-shadow 0.2s ease, transform 0.2s ease;
      }
      .card:hover {
        box-shadow: 0 4px 20px rgba(26, 46, 34, 0.06), 0 2px 6px rgba(26, 46, 34, 0.04);
      }
      .card-tinted {
        background: linear-gradient(135deg, #f0fbf4 0%, #e6f5ec 100%);
        border-radius: 24px;
        border: 1px solid rgba(34, 139, 87, 0.15);
      }
      .card-sage {
        background: linear-gradient(135deg, #fdfdfb 0%, #f5f7f1 100%);
        border-radius: 24px;
        border: 1px solid rgba(26, 46, 34, 0.08);
      }

      .btn-primary {
        background: linear-gradient(135deg, #2d8659 0%, #1f6b45 100%);
        color: #ffffff;
        border: none;
        border-radius: 14px;
        padding: 14px 24px;
        font-weight: 600;
        font-size: 14px;
        transition: all 0.2s ease;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(45, 134, 89, 0.25);
      }
      .btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(45, 134, 89, 0.35);
      }
      .btn-secondary {
        background: #ffffff;
        color: #2d8659;
        border: 1.5px solid rgba(45, 134, 89, 0.2);
        border-radius: 14px;
        padding: 12px 22px;
        font-weight: 600;
        font-size: 13px;
        transition: all 0.2s ease;
        cursor: pointer;
      }
      .btn-secondary:hover {
        border-color: #2d8659;
        background: #f0fbf4;
      }

      .label-soft {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #6b7d70;
      }
      .metric-number {
        font-family: 'Fraunces', Georgia, serif;
        font-size: 42px;
        font-weight: 600;
        letter-spacing: -0.03em;
        line-height: 1;
        color: #1a2e22;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        font-size: 11px;
        font-weight: 600;
        border-radius: 999px;
        letter-spacing: 0.02em;
      }

      input {
        outline: none;
        transition: all 0.2s ease;
      }
      input:focus {
        border-color: #2d8659 !important;
        box-shadow: 0 0 0 4px rgba(45, 134, 89, 0.1);
      }

      /* Scrollbar */
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(26, 46, 34, 0.15); border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(26, 46, 34, 0.25); }
    `}</style>
  );
}

/* ============== AUTH ============== */
function AuthScreen({ view, setView, onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="min-h-screen flex" style={{ background: '#f4f7f2' }}>
      <GlobalStyles />

      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, #1a3a2a 0%, #0f2419 100%)'
        }} />
        {/* Decorative circles */}
        <div className="absolute rounded-full gentle-float" style={{
          top: '10%', right: '-8%', width: '420px', height: '420px',
          background: 'radial-gradient(circle, rgba(134, 239, 172, 0.15) 0%, transparent 70%)',
          filter: 'blur(40px)'
        }} />
        <div className="absolute rounded-full" style={{
          bottom: '-10%', left: '-10%', width: '380px', height: '380px',
          background: 'radial-gradient(circle, rgba(251, 191, 36, 0.12) 0%, transparent 70%)',
          filter: 'blur(50px)'
        }} />

        {/* Subtle dot grid */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'radial-gradient(circle, rgba(134, 239, 172, 0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />

        <div className="relative z-10 flex flex-col justify-between p-14 w-full text-white">
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{
                background: 'linear-gradient(135deg, #86efac, #4ade80)',
                boxShadow: '0 8px 24px rgba(134, 239, 172, 0.3)'
              }}>
                <Zap size={22} strokeWidth={2.5} style={{ color: '#0f2419' }} />
              </div>
              <span className="text-sm font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.9)' }}>EnergyWatch</span>
            </div>

            <h1 className="display-font text-6xl leading-[1.05] mb-6" style={{ color: '#f0fdf4' }}>
              Your home's<br/>
              <span style={{ fontStyle: 'italic', color: '#86efac' }}>energy brain</span>,<br/>
              thinking ahead.
            </h1>
            <p className="text-lg max-w-md leading-relaxed" style={{ color: 'rgba(240, 253, 244, 0.75)' }}>
              EnergyWatch analyzes weather and market signals every few seconds — deciding when to draw, store, or sell power. Quietly, in the background.
            </p>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <BrandStat label="Saved /mo" value="$142" />
              <BrandStat label="Grid sellback" value="847kWh" />
              <BrandStat label="CO₂ avoided" value="2.1T/yr" />
            </div>
            <div className="flex items-center gap-2 pt-6 text-sm" style={{ color: 'rgba(240, 253, 244, 0.55)' }}>
              <Sparkles size={14} />
              <span>Built for the IGS Energy Hackathon · 2026</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, #2d8659, #1f6b45)'
            }}>
              <Zap size={20} strokeWidth={2.5} color="white" />
            </div>
            <span className="display-font text-2xl" style={{ color: '#1a2e22' }}>EnergyWatch</span>
          </div>

          <h2 className="display-font text-4xl mb-3" style={{ color: '#1a2e22' }}>
            {view === 'signin' ? 'Welcome back.' : 'Get started.'}
          </h2>
          <p className="text-[15px] mb-10" style={{ color: '#6b7d70' }}>
            {view === 'signin'
              ? 'Sign in to check on your system.'
              : 'Create an account to connect your solar-plus-storage setup.'}
          </p>

          <div className="space-y-5">
            {view === 'signup' && (
              <AuthInput icon={<User size={17} />} label="Full name" value={name} onChange={setName} placeholder="Alex Rivera" />
            )}
            <AuthInput icon={<Mail size={17} />} label="Email address" value={email} onChange={setEmail} placeholder="you@home.com" type="email" />
            <AuthInput icon={<Lock size={17} />} label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password" />

            <button
              onClick={() => onAuth(email || 'demo@energywatch.io', name)}
              className="btn-primary w-full mt-3 flex items-center justify-center gap-2"
              style={{ padding: '16px 24px' }}
            >
              {view === 'signin' ? 'Sign in' : 'Create account'}
              <span>→</span>
            </button>

            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 h-px" style={{ background: 'rgba(26, 46, 34, 0.08)' }} />
              <span className="text-xs" style={{ color: '#9ba89e' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(26, 46, 34, 0.08)' }} />
            </div>

            <button
              onClick={() => onAuth('demo@energywatch.io', 'Demo User')}
              className="btn-secondary w-full"
            >
              Continue with demo account
            </button>

            <p className="text-center text-sm pt-4" style={{ color: '#6b7d70' }}>
              {view === 'signin' ? "New here?" : "Already have an account?"}{' '}
              <button
                onClick={() => setView(view === 'signin' ? 'signup' : 'signin')}
                className="font-semibold hover:underline"
                style={{ color: '#2d8659' }}
              >
                {view === 'signin' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthInput({ icon, label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="text-sm font-medium mb-2 block" style={{ color: '#3d5246' }}>
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#9ba89e' }}>
          {icon}
        </div>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-12 pr-4 py-3.5 text-[15px]"
          style={{
            background: '#fafbf9',
            border: '1.5px solid rgba(26, 46, 34, 0.08)',
            borderRadius: '14px',
            color: '#1a2e22'
          }}
        />
      </div>
    </div>
  );
}

function BrandStat({ label, value }) {
  return (
    <div>
      <div className="text-xs mb-1.5" style={{ color: 'rgba(240, 253, 244, 0.55)' }}>{label}</div>
      <div className="display-font text-2xl" style={{ color: '#86efac' }}>{value}</div>
    </div>
  );
}

/* ============== TOP NAV ============== */
function TopNav({ user, onLogout, activeTab, setActiveTab }) {
  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: <Gauge size={16} /> },
    { id: 'sources', label: 'Energy mix', icon: <Activity size={16} /> },
    { id: 'ai', label: 'AI decisions', icon: <Cpu size={16} /> },
    { id: 'forecast', label: 'Forecast', icon: <CloudSun size={16} /> },
    { id: 'settings', label: 'System', icon: <Settings size={16} /> },
  ];

  return (
    <nav className="sticky top-0 z-40" style={{
      background: 'rgba(244, 247, 242, 0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(26, 46, 34, 0.06)'
    }}>
      <div className="max-w-[1500px] mx-auto px-6 flex items-center justify-between h-[72px]">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, #2d8659 0%, #1f6b45 100%)',
              boxShadow: '0 4px 12px rgba(45, 134, 89, 0.25)'
            }}>
              <Zap size={18} strokeWidth={2.5} color="white" />
            </div>
            <div>
              <div className="display-font text-xl leading-none" style={{ color: '#1a2e22' }}>
                EnergyWatch
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: '#9ba89e' }}>powered by IGS</div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-1 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.6)' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="px-4 py-2 text-sm flex items-center gap-2 transition-all rounded-xl"
                style={{
                  color: activeTab === t.id ? '#ffffff' : '#4a5e52',
                  background: activeTab === t.id ? 'linear-gradient(135deg, #2d8659, #1f6b45)' : 'transparent',
                  fontWeight: activeTab === t.id ? 600 : 500,
                  boxShadow: activeTab === t.id ? '0 2px 8px rgba(45, 134, 89, 0.25)' : 'none'
                }}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full" style={{
            background: 'rgba(45, 134, 89, 0.08)'
          }}>
            <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: '#2d8659' }} />
            <span className="text-xs font-medium" style={{ color: '#2d8659' }}>Live</span>
          </div>
          <button className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white" style={{ color: '#6b7d70' }}>
            <Bell size={17} />
          </button>
          <div className="flex items-center gap-3 pl-4 border-l" style={{ borderColor: 'rgba(26, 46, 34, 0.08)' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{
              background: 'linear-gradient(135deg, #86efac, #4ade80)',
              color: '#0f2419'
            }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold" style={{ color: '#1a2e22' }}>{user?.name}</div>
              <div className="text-xs" style={{ color: '#9ba89e' }}>{user?.email}</div>
            </div>
            <button onClick={onLogout} className="ml-1 p-2 rounded-lg transition-colors hover:bg-white" style={{ color: '#9ba89e' }}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile tab strip */}
      <div className="lg:hidden flex overflow-x-auto px-4 py-2 gap-2 border-t" style={{ borderColor: 'rgba(26, 46, 34, 0.06)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="px-4 py-2 text-xs flex items-center gap-1.5 whitespace-nowrap rounded-xl transition-all"
            style={{
              color: activeTab === t.id ? '#ffffff' : '#4a5e52',
              background: activeTab === t.id ? '#2d8659' : 'rgba(255,255,255,0.6)',
              fontWeight: activeTab === t.id ? 600 : 500
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ============== DASHBOARD ============== */
function Dashboard({ tick, user }) {
  const hourlyData = useMemo(() => {
    const hours = [];
    for (let h = 0; h < 24; h++) {
      const solarCurve = Math.max(0, Math.sin((h - 6) * Math.PI / 12)) * 9.5;
      const demand = 1.2 + Math.sin(h * 0.5) * 0.6 + (h > 17 && h < 22 ? 2.5 : 0);
      const price = 0.08 + Math.sin((h - 14) * Math.PI / 12) * 0.06 + (h > 16 && h < 21 ? 0.08 : 0);
      hours.push({
        hour: `${String(h).padStart(2,'0')}:00`,
        h,
        solar: +solarCurve.toFixed(2),
        demand: +demand.toFixed(2),
        price: +price.toFixed(3),
        battery: 40 + Math.sin(h * 0.3) * 30 + h * 1.5,
      });
    }
    return hours;
  }, []);

  const currentHour = new Date().getHours();
  const now = hourlyData[currentHour];

  return (
    <div className="space-y-6 fade-in">
      {/* Greeting + AI banner */}
      <div>
        <h1 className="display-font text-4xl mb-1" style={{ color: '#1a2e22' }}>
          Good afternoon, <span style={{ fontStyle: 'italic', color: '#2d8659' }}>{user?.name?.split(' ')[0] || 'friend'}</span>
        </h1>
        <p className="text-[15px]" style={{ color: '#6b7d70' }}>
          Your system is making money right now. Here's the full picture.
        </p>
      </div>

      <AIDecisionBanner />

      {/* Top metric row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          label="Solar generating"
          value="6.24"
          unit="kW"
          trend="+12.4%"
          trendUp
          icon={<Sun />}
          accent="#f59e0b"
          accentBg="#fef3c7"
          subtext="Peaked at 9.1 kW · 1:14 PM"
        />
        <MetricCard
          label="Home using"
          value="2.11"
          unit="kW"
          trend="-3.2%"
          icon={<Home />}
          accent="#3b82f6"
          accentBg="#dbeafe"
          subtext="HVAC, lights, appliances"
        />
        <MetricCard
          label="Battery"
          value="87"
          unit="%"
          trend="Charging"
          trendUp
          icon={<Battery />}
          accent="#2d8659"
          accentBg="#dcfce7"
          subtext="11.8 of 13.5 kWh stored"
        />
        <MetricCard
          label="Selling to grid"
          value="4.13"
          unit="kW"
          trend="+$0.87/hr"
          trendUp
          icon={<ArrowUpFromLine />}
          accent="#dc2626"
          accentBg="#fee2e2"
          subtext="At premium peak rate"
        />
      </div>

      {/* Flow + price */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 card p-7">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="label-soft mb-1.5">Real-time power flow</div>
              <h3 className="display-font text-2xl" style={{ color: '#1a2e22' }}>How your system is moving energy</h3>
            </div>
            <div className="chip" style={{ background: '#dcfce7', color: '#166534' }}>
              <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: '#16a34a' }} />
              Synced
            </div>
          </div>
          <PowerFlowDiagram tick={tick} />
        </div>

        <div className="card p-7">
          <div className="label-soft mb-1.5">24-hour price signal</div>
          <h3 className="display-font text-xl mb-1" style={{ color: '#1a2e22' }}>Grid pricing today</h3>
          <p className="text-sm mb-4" style={{ color: '#6b7d70' }}>The green area shows peak-rate windows.</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={hourlyData}>
              <defs>
                <linearGradient id="priceG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2d8659" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2d8659" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" stroke="#9ba89e" fontSize={10} interval={3} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ba89e" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(26,46,34,0.08)', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
              <ReferenceLine x={now.hour} stroke="#dc2626" strokeDasharray="3 3" strokeWidth={1.5} />
              <Area type="monotone" dataKey="price" stroke="#2d8659" fill="url(#priceG)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(26, 46, 34, 0.06)' }}>
            <div>
              <div className="label-soft">Now</div>
              <div className="text-base font-semibold mt-1" style={{ color: '#2d8659' }}>${now.price.toFixed(3)}</div>
            </div>
            <div>
              <div className="label-soft">Peak</div>
              <div className="text-base font-semibold mt-1" style={{ color: '#dc2626' }}>$0.211</div>
            </div>
            <div>
              <div className="label-soft">Low</div>
              <div className="text-base font-semibold mt-1" style={{ color: '#1a2e22' }}>$0.074</div>
            </div>
          </div>
        </div>
      </div>

      {/* Today profile + savings */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 card p-7">
          <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
            <div>
              <div className="label-soft mb-1.5">Today's profile</div>
              <h3 className="display-font text-2xl" style={{ color: '#1a2e22' }}>Generation vs demand</h3>
            </div>
            <div className="flex gap-4 text-sm">
              <LegendDot color="#f59e0b" label="Solar" />
              <LegendDot color="#3b82f6" label="Demand" />
              <LegendDot color="#2d8659" label="Battery %" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={hourlyData}>
              <XAxis dataKey="hour" stroke="#9ba89e" fontSize={11} interval={2} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" stroke="#9ba89e" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#9ba89e" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(26,46,34,0.08)', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
              <ReferenceLine yAxisId="left" x={now.hour} stroke="#dc2626" strokeDasharray="3 3" strokeWidth={1.5} />
              <Line yAxisId="left" type="monotone" dataKey="solar" stroke="#f59e0b" strokeWidth={3} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="demand" stroke="#3b82f6" strokeWidth={3} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="battery" stroke="#2d8659" strokeWidth={2.5} strokeDasharray="5 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card-tinted p-7 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl" style={{ background: 'rgba(134, 239, 172, 0.3)' }} />
          <div className="relative">
            <div className="label-soft mb-1.5" style={{ color: '#2d8659' }}>This month</div>
            <h3 className="display-font text-2xl mb-5" style={{ color: '#1a2e22' }}>You've saved</h3>

            <div className="mb-6">
              <div className="display-font text-5xl" style={{ color: '#2d8659' }}>$287.42</div>
              <div className="text-sm mt-1.5 flex items-center gap-1.5" style={{ color: '#4a5e52' }}>
                <TrendingUp size={14} style={{ color: '#2d8659' }} />
                <span><b style={{ color: '#2d8659' }}>34%</b> more than last month</span>
              </div>
            </div>

            <div className="space-y-1">
              <SavingsRow label="Grid sellback" value="+$184.20" positive />
              <SavingsRow label="Self-consumption" value="+$72.80" positive />
              <SavingsRow label="Peak shaving" value="+$48.30" positive />
              <SavingsRow label="Demand charges" value="-$17.88" />
            </div>

            <div className="mt-6 pt-5 border-t" style={{ borderColor: 'rgba(45, 134, 89, 0.15)' }}>
              <div className="flex items-center gap-2.5 text-sm" style={{ color: '#3d5246' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(45, 134, 89, 0.15)' }}>
                  <Leaf size={14} style={{ color: '#2d8659' }} />
                </div>
                <span>Like planting <b style={{ color: '#2d8659' }}>38 trees</b> this month</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DecisionLog />
    </div>
  );
}

function AIDecisionBanner() {
  return (
    <div className="relative overflow-hidden rounded-3xl" style={{
      background: 'linear-gradient(135deg, #1a3a2a 0%, #0f2419 100%)',
      boxShadow: '0 8px 32px rgba(26, 58, 42, 0.2)'
    }}>
      {/* Decorative glows */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl" style={{
        background: 'radial-gradient(circle, rgba(134, 239, 172, 0.2) 0%, transparent 70%)'
      }} />
      <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full blur-3xl" style={{
        background: 'radial-gradient(circle, rgba(251, 191, 36, 0.15) 0%, transparent 70%)'
      }} />

      <div className="relative p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-6">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(134, 239, 172, 0.15)' }}>
              <Cpu size={16} style={{ color: '#86efac' }} />
            </div>
            <div>
              <div className="text-xs font-semibold" style={{ color: '#86efac' }}>AI Decision · just now</div>
              <div className="text-[11px]" style={{ color: 'rgba(240, 253, 244, 0.5)' }}>2:27 PM</div>
            </div>
            <span className="chip ml-2" style={{ background: 'rgba(220, 38, 38, 0.2)', color: '#fca5a5' }}>
              <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: '#f87171' }} />
              Active
            </span>
          </div>
          <h2 className="display-font text-4xl leading-tight" style={{ color: '#f0fdf4' }}>
            Selling <span style={{ fontStyle: 'italic', color: '#86efac' }}>4.13 kW</span> to the grid right now.
          </h2>
          <p className="text-[15px] mt-3 leading-relaxed" style={{ color: 'rgba(240, 253, 244, 0.75)' }}>
            Peak pricing window is open. Exporting your surplus solar while holding the battery at 87% for the evening demand bump.
          </p>
        </div>

        <div className="lg:col-span-3 grid grid-cols-3 lg:grid-cols-1 gap-3">
          <MiniStat label="Confidence" value="94%" color="#86efac" />
          <MiniStat label="Earning" value="+$0.87/hr" color="#86efac" />
          <MiniStat label="Next review" value="18 min" color="#fbbf24" />
        </div>

        <div className="lg:col-span-3 lg:border-l lg:pl-6" style={{ borderColor: 'rgba(134, 239, 172, 0.15)' }}>
          <div className="text-xs font-semibold mb-3" style={{ color: 'rgba(240, 253, 244, 0.55)' }}>Why this decision?</div>
          <div className="space-y-2 text-sm" style={{ color: 'rgba(240, 253, 244, 0.85)' }}>
            <ReasonRow text="Sun at 92% capacity" />
            <ReasonRow text="Peak rate: $0.211/kWh" />
            <ReasonRow text="Clear skies until 6 PM" />
            <ReasonRow text="Low load forecast" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReasonRow({ text }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(134, 239, 172, 0.2)' }}>
        <Check size={10} strokeWidth={3} style={{ color: '#86efac' }} />
      </div>
      {text}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <div className="text-xs font-medium" style={{ color: 'rgba(240, 253, 244, 0.5)' }}>{label}</div>
      <div className="display-font text-xl mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}

function MetricCard({ label, value, unit, trend, trendUp, icon, accent, accentBg, subtext }) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{
          background: accentBg, color: accent
        }}>
          {React.cloneElement(icon, { size: 20 })}
        </div>
        {trend && (
          <div className="chip text-xs font-semibold" style={{
            background: trendUp ? '#dcfce7' : '#fee2e2',
            color: trendUp ? '#166534' : '#991b1b'
          }}>
            {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trend}
          </div>
        )}
      </div>
      <div className="label-soft mb-1">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="metric-number">{value}</span>
        <span className="text-lg font-medium" style={{ color: '#9ba89e' }}>{unit}</span>
      </div>
      {subtext && (
        <div className="text-xs mt-3" style={{ color: '#6b7d70' }}>{subtext}</div>
      )}
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span className="text-xs font-medium" style={{ color: '#4a5e52' }}>{label}</span>
    </div>
  );
}

function SavingsRow({ label, value, positive }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b last:border-b-0" style={{ borderColor: 'rgba(45, 134, 89, 0.1)' }}>
      <span className="text-sm" style={{ color: '#4a5e52' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: positive ? '#2d8659' : '#dc2626' }}>{value}</span>
    </div>
  );
}

/* ============== POWER FLOW DIAGRAM ============== */
function PowerFlowDiagram({ tick }) {
  return (
    <svg viewBox="0 0 700 340" className="w-full">
      <defs>
        <linearGradient id="flowSolar" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#2d8659" />
        </linearGradient>
        <linearGradient id="flowHome" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2d8659" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="flowGrid" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2d8659" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
        <filter id="softShadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="0" dy="2" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.15" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Connecting lines - curved */}
      <path d="M 155 90 Q 260 130 350 170" stroke="url(#flowSolar)" strokeWidth="3.5" fill="none" className="flow-line" strokeLinecap="round" />
      <path d="M 155 250 Q 260 210 350 170" stroke="#9ba89e" strokeWidth="2" fill="none" strokeDasharray="3 5" opacity="0.4" strokeLinecap="round" />
      <path d="M 350 170 Q 460 130 550 90" stroke="url(#flowGrid)" strokeWidth="3.5" fill="none" className="flow-line" strokeLinecap="round" />
      <path d="M 350 170 Q 460 210 550 250" stroke="url(#flowHome)" strokeWidth="3.5" fill="none" className="flow-line" strokeLinecap="round" />

      {/* Nodes */}
      <FlowNode x={105} y={90} label="Solar" value="6.24 kW" color="#f59e0b" bgColor="#fef3c7" icon="sun" />
      <FlowNode x={105} y={250} label="Grid in" value="Off" color="#9ba89e" bgColor="#f3f4f6" icon="grid" dim />
      <FlowNode x={350} y={170} label="AI Router" value="Optimizing" color="#2d8659" bgColor="#dcfce7" icon="cpu" big />
      <FlowNode x={600} y={90} label="Selling" value="4.13 kW" color="#dc2626" bgColor="#fee2e2" icon="export" />
      <FlowNode x={600} y={250} label="Home" value="2.11 kW" color="#3b82f6" bgColor="#dbeafe" icon="home" />

      {/* Battery */}
      <g transform="translate(350, 285)">
        <rect x="-70" y="0" width="140" height="32" rx="16" fill="#ffffff" stroke="#2d8659" strokeWidth="1.5" filter="url(#softShadow)" />
        <rect x="-66" y="4" width={87 * 1.32} height="24" rx="12" fill="url(#flowSolar)" opacity="0.75" />
        <text x="0" y="21" textAnchor="middle" fill="#1a2e22" fontSize="12" fontWeight="700">Battery 87%</text>
      </g>

      {/* Flow labels */}
      <g fontFamily="Inter, sans-serif" fontWeight="600">
        <rect x="215" y="108" width="70" height="22" rx="11" fill="#ffffff" stroke="#f59e0b" strokeWidth="1" />
        <text x="250" y="123" textAnchor="middle" fill="#f59e0b" fontSize="11">6.24 kW</text>

        <rect x="425" y="108" width="110" height="22" rx="11" fill="#ffffff" stroke="#dc2626" strokeWidth="1" />
        <text x="480" y="123" textAnchor="middle" fill="#dc2626" fontSize="11">4.13 kW · $0.21</text>

        <rect x="430" y="208" width="70" height="22" rx="11" fill="#ffffff" stroke="#3b82f6" strokeWidth="1" />
        <text x="465" y="223" textAnchor="middle" fill="#3b82f6" fontSize="11">2.11 kW</text>
      </g>
    </svg>
  );
}

function FlowNode({ x, y, label, value, color, bgColor, icon, big, dim }) {
  const size = big ? 52 : 42;
  return (
    <g transform={`translate(${x}, ${y})`} opacity={dim ? 0.5 : 1}>
      {big && <circle r={size + 14} fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 4" opacity="0.4" />}
      <circle r={size + 4} fill={bgColor} opacity="0.6" />
      <circle r={size} fill="#ffffff" stroke={color} strokeWidth={big ? 2.5 : 2} filter="url(#softShadow)" />
      {icon === 'sun' && <g><circle r="10" fill={color} /><g stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="-16" y1="0" x2="-20" y2="0"/><line x1="16" y1="0" x2="20" y2="0"/><line x1="0" y1="-16" x2="0" y2="-20"/><line x1="0" y1="16" x2="0" y2="20"/><line x1="-12" y1="-12" x2="-15" y2="-15"/><line x1="12" y1="12" x2="15" y2="15"/><line x1="12" y1="-12" x2="15" y2="-15"/><line x1="-12" y1="12" x2="-15" y2="15"/></g></g>}
      {icon === 'grid' && <g stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"><rect x="-10" y="-10" width="20" height="20" rx="2"/><line x1="-10" y1="0" x2="10" y2="0"/><line x1="0" y1="-10" x2="0" y2="10"/></g>}
      {icon === 'cpu' && <g><rect x="-13" y="-13" width="26" height="26" rx="5" fill="none" stroke={color} strokeWidth="2.5" /><rect x="-6" y="-6" width="12" height="12" rx="2" fill={color}/><line x1="-13" y1="-4" x2="-18" y2="-4" stroke={color} strokeWidth="2" strokeLinecap="round"/><line x1="-13" y1="4" x2="-18" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round"/><line x1="13" y1="-4" x2="18" y2="-4" stroke={color} strokeWidth="2" strokeLinecap="round"/><line x1="13" y1="4" x2="18" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round"/></g>}
      {icon === 'export' && <g stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M -9 4 L 0 -7 L 9 4" /><line x1="0" y1="-7" x2="0" y2="12"/></g>}
      {icon === 'home' && <g stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M -11 2 L 0 -9 L 11 2 L 11 11 L -11 11 Z" /></g>}

      <text y={size + 22} textAnchor="middle" fill="#6b7d70" fontSize="11" fontWeight="500" fontFamily="Inter">{label}</text>
      <text y={size + 38} textAnchor="middle" fill={color} fontSize="13" fontWeight="700" fontFamily="Inter">{value}</text>
    </g>
  );
}

/* ============== DECISION LOG ============== */
function DecisionLog() {
  const decisions = [
    { time: '2:27 PM', action: 'Sell', icon: <ArrowUpFromLine size={13} />, color: '#dc2626', bg: '#fee2e2', desc: 'Peak pricing window. Exporting 4.13 kW surplus to grid.', impact: '+$0.87/hr' },
    { time: '1:45 PM', action: 'Charge', icon: <Battery size={13} />, color: '#2d8659', bg: '#dcfce7', desc: 'Battery reached 87% — holding reserve for evening peak.', impact: '—' },
    { time: '11:22 AM', action: 'Consume', icon: <Home size={13} />, color: '#3b82f6', bg: '#dbeafe', desc: 'Routing solar directly to HVAC load. Grid isolated.', impact: '+$0.42/hr' },
    { time: '8:14 AM', action: 'Buy', icon: <ArrowDownToLine size={13} />, color: '#6b7d70', bg: '#f3f4f6', desc: 'Low solar + off-peak rate. Topping battery from grid.', impact: '-$0.18/hr' },
    { time: '6:02 AM', action: 'Hold', icon: <Clock size={13} />, color: '#f59e0b', bg: '#fef3c7', desc: 'Dawn transition. System idle pending irradiance threshold.', impact: '—' },
  ];

  return (
    <div className="card p-7">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="label-soft mb-1.5">AI activity stream</div>
          <h3 className="display-font text-2xl" style={{ color: '#1a2e22' }}>Every decision, explained</h3>
        </div>
        <button className="text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all" style={{ color: '#2d8659' }}>
          View all <span>→</span>
        </button>
      </div>

      <div className="space-y-1">
        {decisions.map((d, i) => (
          <div key={i} className="grid grid-cols-12 gap-4 py-3.5 border-b last:border-b-0 items-center" style={{ borderColor: 'rgba(26, 46, 34, 0.06)' }}>
            <div className="col-span-2 text-xs font-medium" style={{ color: '#9ba89e' }}>{d.time}</div>
            <div className="col-span-2">
              <span className="chip" style={{ background: d.bg, color: d.color }}>
                {d.icon} {d.action}
              </span>
            </div>
            <div className="col-span-6 text-sm" style={{ color: '#3d5246' }}>{d.desc}</div>
            <div className="col-span-2 text-right text-sm font-semibold" style={{
              color: d.impact.startsWith('+') ? '#2d8659' : d.impact.startsWith('-') ? '#dc2626' : '#9ba89e'
            }}>
              {d.impact}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============== ENERGY SOURCES ============== */
function EnergySources({ tick }) {
  const sources = [
    { name: 'Solar PV', percent: 64, kwh: '38.2', icon: <Sun />, color: '#f59e0b', bg: '#fef3c7', status: 'Primary · generating' },
    { name: 'Battery', percent: 18, kwh: '10.8', icon: <Battery />, color: '#2d8659', bg: '#dcfce7', status: 'Buffering' },
    { name: 'Grid · mixed', percent: 14, kwh: '8.4', icon: <Zap />, color: '#6b7d70', bg: '#f3f4f6', status: 'Off-peak import' },
    { name: 'Natural gas', percent: 4, kwh: '2.3', icon: <Flame />, color: '#dc2626', bg: '#fee2e2', status: 'Water heater only' },
  ];

  const gridMix = [
    { name: 'Wind', value: 32, color: '#3b82f6', icon: <Wind size={14} /> },
    { name: 'Solar', value: 18, color: '#f59e0b', icon: <Sun size={14} /> },
    { name: 'Nuclear', value: 22, color: '#a78bfa', icon: <Zap size={14} /> },
    { name: 'Natural gas', value: 21, color: '#dc2626', icon: <Flame size={14} /> },
    { name: 'Hydro', value: 5, color: '#06b6d4', icon: <Droplets size={14} /> },
    { name: 'Coal', value: 2, color: '#64748b', icon: <Activity size={14} /> },
  ];

  return (
    <div className="space-y-6 fade-in">
      <div>
        <div className="label-soft mb-1.5">Energy mix</div>
        <h1 className="display-font text-4xl mb-2" style={{ color: '#1a2e22' }}>
          Where's your power <span style={{ fontStyle: 'italic', color: '#2d8659' }}>actually</span> coming from?
        </h1>
        <p className="text-[15px] max-w-2xl" style={{ color: '#6b7d70' }}>
          EnergyWatch meters every source feeding your home — distinguishing solar, battery, grid imports, and fossil utilities like natural gas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {sources.map(s => <SourceCard key={s.name} {...s} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 card p-7">
          <div className="label-soft mb-1.5">24-hour timeline</div>
          <h3 className="display-font text-2xl mb-5" style={{ color: '#1a2e22' }}>How your mix shifts through the day</h3>
          <SourceStackedChart />
          <div className="flex flex-wrap gap-4 mt-5 pt-5 border-t" style={{ borderColor: 'rgba(26, 46, 34, 0.06)' }}>
            {sources.map(s => <LegendDot key={s.name} color={s.color} label={s.name} />)}
          </div>
        </div>

        <div className="card p-7">
          <div className="label-soft mb-1.5">When you buy from grid</div>
          <h3 className="display-font text-xl mb-1" style={{ color: '#1a2e22' }}>Local fuel mix</h3>
          <p className="text-sm mb-5" style={{ color: '#6b7d70' }}>Per IGS disclosure data.</p>

          <div className="space-y-4">
            {gridMix.map(m => (
              <div key={m.name}>
                <div className="flex justify-between items-center text-sm mb-1.5">
                  <div className="flex items-center gap-2" style={{ color: '#3d5246' }}>
                    <div style={{ color: m.color }}>{m.icon}</div>
                    <span>{m.name}</span>
                  </div>
                  <span style={{ color: m.color }} className="font-semibold">{m.value}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(26, 46, 34, 0.05)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${m.value}%`, background: m.color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t" style={{ borderColor: 'rgba(26, 46, 34, 0.06)' }}>
            <div className="label-soft">Renewable share</div>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="display-font text-4xl" style={{ color: '#2d8659' }}>57%</span>
              <span className="chip" style={{ background: '#dcfce7', color: '#166534' }}>
                <TrendingUp size={11} /> +8pts YoY
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-7">
        <div className="label-soft mb-1.5">Load disaggregation</div>
        <h3 className="display-font text-2xl mb-5" style={{ color: '#1a2e22' }}>What's using your power right now</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DeviceCard name="HVAC" load="1.42 kW" percent={67} source="Solar" color="#f59e0b" bg="#fef3c7" />
          <DeviceCard name="EV Charger" load="0.00 kW" percent={0} source="Idle" color="#9ba89e" bg="#f3f4f6" />
          <DeviceCard name="Water Heater" load="0.38 kW" percent={18} source="Nat. Gas" color="#dc2626" bg="#fee2e2" />
          <DeviceCard name="Appliances" load="0.31 kW" percent={15} source="Solar" color="#f59e0b" bg="#fef3c7" />
        </div>
      </div>
    </div>
  );
}

function SourceCard({ name, percent, kwh, icon, color, bg, status }) {
  return (
    <div className="card p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1" style={{ background: color }} />
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: bg, color }}>
          {React.cloneElement(icon, { size: 20 })}
        </div>
        <div className="display-font text-3xl" style={{ color }}>{percent}%</div>
      </div>
      <div className="label-soft">{name}</div>
      <div className="text-xl font-semibold mt-1" style={{ color: '#1a2e22' }}>
        {kwh} kWh <span className="text-sm font-normal" style={{ color: '#9ba89e' }}>today</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs mt-3" style={{ color }}>
        <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: color }} />
        {status}
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
      arr.push({ hour: `${String(h).padStart(2,'0')}`, solar: +solar.toFixed(2), battery: +battery.toFixed(2), grid: +grid.toFixed(2), gas: +gas.toFixed(2) });
    }
    return arr;
  }, []);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <XAxis dataKey="hour" stroke="#9ba89e" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#9ba89e" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(26,46,34,0.08)', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
        <Area type="monotone" dataKey="solar" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.75} />
        <Area type="monotone" dataKey="battery" stackId="1" stroke="#2d8659" fill="#2d8659" fillOpacity={0.75} />
        <Area type="monotone" dataKey="grid" stackId="1" stroke="#6b7d70" fill="#6b7d70" fillOpacity={0.7} />
        <Area type="monotone" dataKey="gas" stackId="1" stroke="#dc2626" fill="#dc2626" fillOpacity={0.7} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DeviceCard({ name, load, percent, source, color, bg }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#fafbf9', border: '1px solid rgba(26, 46, 34, 0.05)' }}>
      <div className="flex justify-between items-start mb-3">
        <div className="label-soft">{name}</div>
        <span className="chip text-[10px]" style={{ background: bg, color }}>{source}</span>
      </div>
      <div className="text-2xl font-semibold" style={{ color: '#1a2e22' }}>{load}</div>
      <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(26, 46, 34, 0.05)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: color }} />
      </div>
    </div>
  );
}

/* ============== AI DECISIONS ============== */
function AIDecisions({ tick }) {
  const models = [
    { name: 'Price forecasting', version: 'v3.2', accuracy: 94.2, desc: 'LSTM on ISO-wholesale + retail tariff data', icon: <TrendingUp /> },
    { name: 'Weather synthesis', version: 'v2.8', accuracy: 89.7, desc: 'Ensemble: NOAA GFS + HRRR + local irradiance', icon: <CloudSun /> },
    { name: 'Load prediction', version: 'v4.1', accuracy: 96.1, desc: 'XGBoost on 90-day occupancy + device patterns', icon: <Home /> },
    { name: 'Optimizer', version: 'v1.9', accuracy: 91.5, desc: 'Mixed-integer LP with 72h rolling horizon', icon: <Sparkles /> },
  ];

  return (
    <div className="space-y-6 fade-in">
      <div>
        <div className="label-soft mb-1.5">AI decision engine</div>
        <h1 className="display-font text-4xl mb-2" style={{ color: '#1a2e22' }}>
          The <span style={{ fontStyle: 'italic', color: '#2d8659' }}>brain</span> behind every watt.
        </h1>
        <p className="text-[15px] max-w-2xl" style={{ color: '#6b7d70' }}>
          Four specialized models run every 2 seconds, synthesizing weather, pricing, and load signals into optimal dispatch decisions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {models.map(m => (
          <div key={m.name} className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: '#dcfce7', color: '#2d8659' }}>
                {React.cloneElement(m.icon, { size: 20 })}
              </div>
              <div className="chip" style={{ background: '#dcfce7', color: '#166534' }}>
                <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: '#16a34a' }} />
                Active
              </div>
            </div>
            <div className="label-soft">{m.name}</div>
            <div className="text-xs mt-0.5" style={{ color: '#9ba89e' }}>{m.version}</div>
            <div className="display-font text-4xl mt-4" style={{ color: '#1a2e22' }}>{m.accuracy}<span className="text-xl">%</span></div>
            <div className="label-soft mt-1">7-day accuracy</div>
            <div className="mt-4 pt-4 border-t text-sm leading-relaxed" style={{ borderColor: 'rgba(26, 46, 34, 0.06)', color: '#4a5e52' }}>
              {m.desc}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card p-7">
          <div className="label-soft mb-1.5">72-hour plan</div>
          <h3 className="display-font text-2xl mb-5" style={{ color: '#1a2e22' }}>Projected dispatch</h3>
          <DispatchPlan />
        </div>

        <div className="card p-7">
          <div className="label-soft mb-1.5">Current reasoning</div>
          <h3 className="display-font text-2xl mb-5" style={{ color: '#1a2e22' }}>Decision tree</h3>
          <DecisionTree />
        </div>
      </div>

      <DecisionLog />
    </div>
  );
}

function DispatchPlan() {
  const hours = [
    { h: 'Now · 2 PM', action: 'Sell', color: '#dc2626', bg: '#fee2e2', reason: 'Peak tariff · surplus solar', active: true },
    { h: '3 PM', action: 'Sell', color: '#dc2626', bg: '#fee2e2', reason: 'Peak tariff continues' },
    { h: '4 PM', action: 'Sell', color: '#dc2626', bg: '#fee2e2', reason: 'Price holding at $0.21' },
    { h: '5 PM', action: 'Consume', color: '#3b82f6', bg: '#dbeafe', reason: 'Demand ramp · HVAC + cooking' },
    { h: '6 PM', action: 'Discharge', color: '#2d8659', bg: '#dcfce7', reason: 'Battery → home · avoid peak buy' },
    { h: '7 PM', action: 'Discharge', color: '#2d8659', bg: '#dcfce7', reason: 'Continue battery-first strategy' },
    { h: '8 PM', action: 'Discharge', color: '#2d8659', bg: '#dcfce7', reason: 'Hold until price drop' },
    { h: '9 PM', action: 'Hold', color: '#f59e0b', bg: '#fef3c7', reason: 'Tariff transition window' },
    { h: '10 PM', action: 'Buy', color: '#6b7d70', bg: '#f3f4f6', reason: 'Off-peak · top battery to 95%' },
    { h: '6 AM tomorrow', action: 'Standby', color: '#6b7d70', bg: '#f3f4f6', reason: 'Dawn · awaiting solar threshold' },
  ];

  return (
    <div className="space-y-1 max-h-[420px] overflow-y-auto pr-2">
      {hours.map((h, i) => (
        <div key={i} className="grid grid-cols-12 gap-3 py-3 border-b last:border-b-0 items-center" style={{ borderColor: 'rgba(26, 46, 34, 0.05)' }}>
          <div className="col-span-3 text-xs font-medium" style={{ color: h.active ? '#2d8659' : '#9ba89e' }}>
            {h.h}
          </div>
          <div className="col-span-3">
            <span className="chip" style={{ background: h.bg, color: h.color }}>
              {h.action}
            </span>
          </div>
          <div className="col-span-6 text-sm" style={{ color: '#4a5e52' }}>{h.reason}</div>
        </div>
      ))}
    </div>
  );
}

function DecisionTree() {
  return (
    <div className="space-y-2.5">
      <TreeRow label="Market signals at 2:27 PM" bold color="#1a2e22" />
      <TreeRow label="Grid price > $0.18/kWh" detail="$0.211 ✓" pass depth={1} />
      <TreeRow label="Solar surplus > 2 kW" detail="4.13 kW ✓" pass depth={1} />
      <TreeRow label="Battery > 80%" detail="87% ✓" pass depth={1} />
      <TreeRow label="Clear weather next 3h" detail="Clear ✓" pass depth={1} />

      <div className="mt-5 p-5 rounded-2xl" style={{ background: 'linear-gradient(135deg, #f0fbf4 0%, #e6f5ec 100%)', border: '1px solid rgba(45, 134, 89, 0.15)' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#2d8659', color: 'white' }}>
            <Sparkles size={18} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold mb-0.5" style={{ color: '#2d8659' }}>Final decision · 94% confidence</div>
            <div className="display-font text-lg mb-1" style={{ color: '#1a2e22' }}>Sell 4.13 kW to grid</div>
            <div className="text-sm" style={{ color: '#3d5246' }}>
              Expected revenue: <b style={{ color: '#2d8659' }}>+$0.87/hr</b>. Re-evaluating in 18 minutes or on signal change &gt; 8%.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TreeRow({ label, detail, pass, bold, color, depth = 0 }) {
  return (
    <div className="flex items-center gap-3 py-1.5" style={{ paddingLeft: depth * 16 }}>
      {pass && (
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
          <Check size={12} strokeWidth={3} style={{ color: '#2d8659' }} />
        </div>
      )}
      <span className="text-sm flex-1" style={{ color: color || '#4a5e52', fontWeight: bold ? 600 : 400 }}>{label}</span>
      {detail && <span className="text-sm font-semibold" style={{ color: '#2d8659' }}>{detail}</span>}
    </div>
  );
}

/* ============== FORECAST ============== */
function ForecastPanel() {
  const forecast = [
    { day: 'Today', date: 'Apr 18', temp: 78, low: 61, cond: 'Sunny', icon: '☀️', irr: 94, price: 'high', rec: 'Sell aggressively' },
    { day: 'Sun', date: 'Apr 19', temp: 74, low: 58, cond: 'Clear', icon: '☀️', irr: 91, price: 'high', rec: 'Sell + charge EV' },
    { day: 'Mon', date: 'Apr 20', temp: 69, low: 54, cond: 'Cloudy', icon: '☁️', irr: 44, price: 'medium', rec: 'Self-consume' },
    { day: 'Tue', date: 'Apr 21', temp: 62, low: 49, cond: 'Rain', icon: '🌧️', irr: 18, price: 'medium', rec: 'Pre-charge battery' },
    { day: 'Wed', date: 'Apr 22', temp: 65, low: 51, cond: 'P. Cloudy', icon: '⛅', irr: 62, price: 'low', rec: 'Buy from grid' },
    { day: 'Thu', date: 'Apr 23', temp: 72, low: 56, cond: 'Sunny', icon: '☀️', irr: 88, price: 'high', rec: 'Sell window' },
    { day: 'Fri', date: 'Apr 24', temp: 75, low: 59, cond: 'Sunny', icon: '☀️', irr: 92, price: 'high', rec: 'Sell + store' },
  ];

  const priceColor = (p) => p === 'high' ? { c: '#dc2626', bg: '#fee2e2' } : p === 'medium' ? { c: '#f59e0b', bg: '#fef3c7' } : { c: '#2d8659', bg: '#dcfce7' };

  return (
    <div className="space-y-6 fade-in">
      <div>
        <div className="label-soft mb-1.5">Forecast · 7 days</div>
        <h1 className="display-font text-4xl mb-2" style={{ color: '#1a2e22' }}>
          The <span style={{ fontStyle: 'italic', color: '#2d8659' }}>week ahead</span>.
        </h1>
        <p className="text-[15px] max-w-2xl" style={{ color: '#6b7d70' }}>
          Weather and price forecasts drive every decision. Here's what the engine sees over the next 168 hours.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {forecast.map((d, i) => {
          const pc = priceColor(d.price);
          return (
            <div key={i} className="card p-5 text-center">
              <div className="text-xs font-semibold" style={{ color: '#1a2e22' }}>{d.day}</div>
              <div className="text-xs mb-2" style={{ color: '#9ba89e' }}>{d.date}</div>
              <div className="text-5xl my-3">{d.icon}</div>
              <div className="display-font text-3xl" style={{ color: '#1a2e22' }}>{d.temp}°</div>
              <div className="text-xs mt-1" style={{ color: '#6b7d70' }}>{d.low}° · {d.cond}</div>
              <div className="mt-4 pt-3 border-t space-y-2" style={{ borderColor: 'rgba(26, 46, 34, 0.06)' }}>
                <div className="flex justify-between items-center text-xs">
                  <span style={{ color: '#9ba89e' }}>Irrad</span>
                  <span className="font-semibold" style={{ color: '#f59e0b' }}>{d.irr}%</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span style={{ color: '#9ba89e' }}>Price</span>
                  <span className="chip text-[10px]" style={{ background: pc.bg, color: pc.c }}>{d.price}</span>
                </div>
              </div>
              <div className="mt-3 text-[11px] font-medium px-2 py-2 rounded-xl" style={{ background: '#f0fbf4', color: '#2d8659' }}>
                {d.rec}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card p-7">
          <div className="label-soft mb-1.5">7-day price forecast</div>
          <h3 className="display-font text-2xl mb-5" style={{ color: '#1a2e22' }}>Grid tariff projections</h3>
          <ForecastPriceChart />
        </div>

        <div className="card p-7">
          <div className="label-soft mb-1.5">Projected generation</div>
          <h3 className="display-font text-2xl mb-5" style={{ color: '#1a2e22' }}>Solar output forecast</h3>
          <ForecastSolarChart />
        </div>
      </div>

      <div className="card-tinted p-7">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251, 191, 36, 0.2)', color: '#d97706' }}>
            <AlertCircle size={24} />
          </div>
          <div className="flex-1">
            <div className="label-soft mb-1" style={{ color: '#d97706' }}>Strategic advisory</div>
            <h3 className="display-font text-2xl mb-2" style={{ color: '#1a2e22' }}>Storm front approaching Tuesday</h3>
            <p className="text-[15px] leading-relaxed mb-5" style={{ color: '#3d5246' }}>
              Expect an 80% reduction in solar yield on Apr 21. EnergyWatch recommends pre-charging your battery to 100% Monday evening at off-peak rates. Projected savings vs. reactive strategy: <b style={{ color: '#2d8659' }}>+$42.10</b>.
            </p>
            <div className="flex gap-3 flex-wrap">
              <button className="btn-primary flex items-center gap-2">
                <Check size={16} /> Approve plan
              </button>
              <button className="btn-secondary">Modify</button>
            </div>
          </div>
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
          t: `D${i+1}.${h}`,
          peak: 0.10 + Math.sin((h-14)*Math.PI/12) * 0.07 + Math.random() * 0.02 + (i === 1 || i === 5 ? 0.04 : 0),
          offpeak: 0.06 + Math.random() * 0.01,
        });
      }
    }
    return arr;
  }, []);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <XAxis dataKey="t" stroke="#9ba89e" fontSize={10} interval={7} tickLine={false} axisLine={false} />
        <YAxis stroke="#9ba89e" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(26,46,34,0.08)', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
        <Line type="monotone" dataKey="peak" stroke="#dc2626" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="offpeak" stroke="#2d8659" strokeWidth={2.5} dot={false} strokeDasharray="4 3" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ForecastSolarChart() {
  const data = useMemo(() => {
    const days = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
    const yields = [62, 58, 55, 38, 12, 42, 56];
    return days.map((d, i) => ({ day: d, kwh: yields[i] }));
  }, []);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <XAxis dataKey="day" stroke="#9ba89e" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#9ba89e" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(26,46,34,0.08)', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
        <Bar dataKey="kwh" fill="#f59e0b" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ============== SETTINGS ============== */
function SettingsPanel({ user }) {
  return (
    <div className="space-y-6 fade-in">
      <div>
        <div className="label-soft mb-1.5">System · connected account</div>
        <h1 className="display-font text-4xl mb-2" style={{ color: '#1a2e22' }}>
          Your <span style={{ fontStyle: 'italic', color: '#2d8659' }}>setup</span>.
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-7 lg:col-span-2">
          <div className="label-soft mb-4">Account</div>
          <div className="space-y-1">
            <SettingRow label="Name" value={user.name} />
            <SettingRow label="Email" value={user.email} />
            <SettingRow label="Property" value={user.home} />
            <SettingRow label="IGS customer ID" value="IGS-OH-4471992" />
            <SettingRow label="Plan" value="IGS ProGrid™ Tier 3" badge="Active" />
          </div>
        </div>

        <div className="card-tinted p-7">
          <div className="label-soft mb-4" style={{ color: '#2d8659' }}>System hardware</div>
          <div className="space-y-4">
            <HardwareRow label="Inverter" value="Enphase IQ8M-72-2-US" />
            <HardwareRow label="Solar array" value="11.2 kW · 28× REC Alpha 400W" />
            <HardwareRow label="Battery" value="Tesla Powerwall 3 · 13.5 kWh" />
            <HardwareRow label="Meter" value="Emporia Vue 3 · 16ch CT" />
            <HardwareRow label="Natural gas" value="Columbia Gas of Ohio · smart meter" />
          </div>
          <div className="mt-5 pt-5 border-t flex items-center gap-2 text-sm" style={{ borderColor: 'rgba(45, 134, 89, 0.2)', color: '#2d8659' }}>
            <div className="w-2 h-2 rounded-full pulse-dot" style={{ background: '#2d8659' }} />
            <span className="font-medium">All systems nominal</span>
          </div>
        </div>
      </div>

      <div className="card p-7">
        <div className="label-soft mb-4">AI preferences</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PreferenceCard title="Strategy" value="Aggressive" desc="Maximize grid sellback" active />
          <PreferenceCard title="Battery reserve" value="20%" desc="Minimum kept for outages" />
          <PreferenceCard title="Notifications" value="Daily digest" desc="+ critical alerts real-time" />
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, value, badge }) {
  return (
    <div className="flex justify-between items-center py-3.5 border-b last:border-b-0" style={{ borderColor: 'rgba(26, 46, 34, 0.06)' }}>
      <span className="text-sm" style={{ color: '#6b7d70' }}>{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium" style={{ color: '#1a2e22' }}>{value}</span>
        {badge && <span className="chip" style={{ background: '#dcfce7', color: '#166534' }}>
          <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: '#16a34a' }} />
          {badge}
        </span>}
      </div>
    </div>
  );
}

function HardwareRow({ label, value }) {
  return (
    <div>
      <div className="label-soft text-[10px]" style={{ color: '#2d8659' }}>{label}</div>
      <div className="text-sm font-medium mt-0.5" style={{ color: '#1a2e22' }}>{value}</div>
    </div>
  );
}

function PreferenceCard({ title, value, desc, active }) {
  return (
    <div className="rounded-2xl p-5 transition-all" style={{
      background: active ? 'linear-gradient(135deg, #f0fbf4 0%, #dcfce7 100%)' : '#fafbf9',
      border: active ? '1.5px solid #2d8659' : '1.5px solid rgba(26, 46, 34, 0.06)'
    }}>
      <div className="label-soft">{title}</div>
      <div className="display-font text-2xl mt-1" style={{ color: active ? '#2d8659' : '#1a2e22' }}>{value}</div>
      <div className="text-xs mt-2" style={{ color: '#6b7d70' }}>{desc}</div>
    </div>
  );
}

/* ============== FOOTER ============== */
function Footer() {
  return (
    <footer className="mt-16 py-8 border-t" style={{ borderColor: 'rgba(26, 46, 34, 0.06)' }}>
      <div className="max-w-[1500px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm" style={{ color: '#9ba89e' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2d8659, #1f6b45)' }}>
            <Zap size={12} color="white" strokeWidth={2.5} />
          </div>
          <span>© 2026 EnergyWatch · Built for IGS Energy Hackathon</span>
        </div>
        <div className="flex items-center gap-4">
          <span>v2.4.1</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: '#2d8659' }} />
            <span style={{ color: '#2d8659' }}>All systems OK</span>
          </div>
          <span>Uptime 99.97%</span>
        </div>
      </div>
    </footer>
  );
}