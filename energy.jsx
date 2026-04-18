import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { Sun, Zap, Battery, Wind, Flame, Droplet, Activity, TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine, Home, Cpu, AlertCircle, Lock, Mail, User, LogOut, Settings, Bell, ChevronRight, Clock, DollarSign, Leaf, Gauge } from 'lucide-react';

export default function EnergyWatch() {
  const [authView, setAuthView] = useState('signin'); // signin, signup
  const [isAuthed, setIsAuthed] = useState(false);
  const [user, setUser] = useState(null);
  const [tick, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Real-time tick for animations / live data feel
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const handleAuth = (email, name) => {
    setUser({ email, name: name || email.split('@')[0], home: '247 Maple Ridge Dr, Columbus OH', system: 'Tesla Powerwall 3 + 11.2kW Solar Array' });
    setIsAuthed(true);
  };

  if (!isAuthed) {
    return <AuthScreen view={authView} setView={setAuthView} onAuth={handleAuth} />;
  }

  return (
    <div className="min-h-screen" style={{
      background: 'radial-gradient(ellipse at top, #0a1410 0%, #050807 60%, #000 100%)',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      color: '#d4e8dc'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Archivo+Black&display=swap');

        * { font-family: 'JetBrains Mono', 'Courier New', monospace; }
        .display-font { font-family: 'Archivo Black', sans-serif; letter-spacing: -0.02em; }
        .sans-font { font-family: 'Space Grotesk', sans-serif; }

        @keyframes pulse-glow {
          0%, 100% { opacity: 1; box-shadow: 0 0 20px rgba(74, 222, 128, 0.4); }
          50% { opacity: 0.6; box-shadow: 0 0 30px rgba(74, 222, 128, 0.7); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes flow {
          0% { stroke-dashoffset: 100; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.3; }
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .scan-container { position: relative; overflow: hidden; }
        .scan-container::after {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, #4ade80, transparent);
          animation: scanline 3s linear infinite;
          pointer-events: none;
        }
        .live-dot { animation: pulse-glow 2s ease-in-out infinite; }
        .blink { animation: blink 1.5s infinite; }
        .flow-line { stroke-dasharray: 6 4; animation: flow 2s linear infinite; }
        .grid-bg {
          background-image:
            linear-gradient(rgba(74, 222, 128, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(74, 222, 128, 0.04) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .panel {
          background: linear-gradient(180deg, rgba(16, 30, 24, 0.6) 0%, rgba(8, 18, 14, 0.8) 100%);
          border: 1px solid rgba(74, 222, 128, 0.15);
          backdrop-filter: blur(10px);
        }
        .panel-accent {
          background: linear-gradient(180deg, rgba(26, 40, 32, 0.8) 0%, rgba(14, 24, 18, 0.9) 100%);
          border: 1px solid rgba(74, 222, 128, 0.3);
        }
        .btn-primary {
          background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
          color: #0a0f0d;
          border: none;
          font-weight: 700;
          transition: all 0.2s;
        }
        .btn-primary:hover {
          box-shadow: 0 0 25px rgba(74, 222, 128, 0.5);
          transform: translateY(-1px);
        }
        .label-tag {
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(212, 232, 220, 0.5);
        }
        .metric-big {
          font-family: 'Archivo Black', sans-serif;
          font-size: 42px;
          letter-spacing: -0.03em;
          line-height: 1;
        }
        .status-chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px;
          font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase;
          border-radius: 2px;
          font-weight: 600;
        }
        input, button { outline: none; }
        input:focus { border-color: #4ade80 !important; box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.2); }
      `}</style>

      <TopNav user={user} onLogout={() => { setIsAuthed(false); setUser(null); }} activeTab={activeTab} setActiveTab={setActiveTab} />
      <Ticker />

      <main className="max-w-[1600px] mx-auto px-6 py-6">
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

/* ============== AUTH ============== */
function AuthScreen({ view, setView, onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="min-h-screen flex" style={{
      fontFamily: "'JetBrains Mono', monospace",
      background: '#050807'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Archivo+Black&display=swap');
        * { font-family: 'JetBrains Mono', monospace; }
        .display-font { font-family: 'Archivo Black', sans-serif; letter-spacing: -0.03em; }
        .sans-font { font-family: 'Space Grotesk', sans-serif; }
        @keyframes gridpulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .slide-up { animation: slide-up 0.6s ease-out; }
        input:focus { border-color: #4ade80 !important; box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.2); }
      `}</style>

      {/* Left side: brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #0a1410 0%, #050807 100%)'
      }}>
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(74, 222, 128, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(74, 222, 128, 0.08) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
          animation: 'gridpulse 4s ease-in-out infinite'
        }} />

        {/* Red accent diagonal - IGS nod */}
        <div className="absolute top-0 right-0 w-2 h-full" style={{ background: 'linear-gradient(180deg, #dc2626, transparent)' }} />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full text-white">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 flex items-center justify-center" style={{ background: '#4ade80', color: '#0a0f0d' }}>
                <Zap size={22} strokeWidth={3} />
              </div>
              <span className="text-xs tracking-[0.3em] text-green-300/70">EW / IGS.HACKATHON.2026</span>
            </div>
            <h1 className="display-font text-7xl mt-8" style={{ color: '#f0fdf4' }}>
              ENERGY<br/>
              <span style={{ color: '#4ade80' }}>WATCH</span>
              <span style={{ color: '#dc2626' }}>.</span>
            </h1>
            <p className="sans-font text-lg mt-6 max-w-md" style={{ color: 'rgba(212, 232, 220, 0.7)' }}>
              Intelligent residential energy orchestration. Let AI decide when to pull, consume, or sell — optimized for weather, price, and your wallet.
            </p>
          </div>

          <div className="space-y-4">
            <StatBar label="AVG SAVINGS" value="$142/mo" />
            <StatBar label="GRID SELLBACK" value="847 kWh" />
            <StatBar label="CARBON OFFSET" value="2.1 tons/yr" />
            <div className="pt-6 border-t border-green-900/50 text-xs tracking-widest text-green-300/50">
              POWERED BY IGS ENERGY PARTNERS
            </div>
          </div>
        </div>
      </div>

      {/* Right side: form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 slide-up">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 flex items-center justify-center" style={{ background: '#4ade80', color: '#0a0f0d' }}>
              <Zap size={18} strokeWidth={3} />
            </div>
            <span className="display-font text-2xl" style={{ color: '#f0fdf4' }}>ENERGYWATCH<span style={{ color: '#dc2626' }}>.</span></span>
          </div>

          <div className="text-xs tracking-[0.25em] mb-3" style={{ color: '#4ade80' }}>
            {view === 'signin' ? '// ACCESS TERMINAL' : '// NEW REGISTRATION'}
          </div>
          <h2 className="display-font text-4xl mb-2" style={{ color: '#f0fdf4' }}>
            {view === 'signin' ? 'Sign in' : 'Create account'}
          </h2>
          <p className="sans-font text-sm mb-8" style={{ color: 'rgba(212, 232, 220, 0.6)' }}>
            {view === 'signin' ? 'Welcome back. Your grid is waiting.' : 'Join the next generation of prosumers.'}
          </p>

          <div className="space-y-4">
            {view === 'signup' && (
              <AuthInput icon={<User size={16} />} label="Full name" value={name} onChange={setName} placeholder="Alex Rivera" />
            )}
            <AuthInput icon={<Mail size={16} />} label="Email" value={email} onChange={setEmail} placeholder="you@domain.com" type="email" />
            <AuthInput icon={<Lock size={16} />} label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password" />

            <button
              onClick={() => onAuth(email || 'demo@energywatch.io', name)}
              className="w-full py-4 mt-2 text-sm tracking-[0.2em] font-bold transition-all"
              style={{
                background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
                color: '#0a0f0d'
              }}
            >
              {view === 'signin' ? 'ENTER DASHBOARD →' : 'CREATE ACCOUNT →'}
            </button>

            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 h-px" style={{ background: 'rgba(74, 222, 128, 0.15)' }} />
              <span className="text-xs tracking-widest" style={{ color: 'rgba(212, 232, 220, 0.4)' }}>OR</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(74, 222, 128, 0.15)' }} />
            </div>

            <button
              onClick={() => onAuth('demo@energywatch.io', 'Demo User')}
              className="w-full py-3 text-xs tracking-[0.2em] border transition-all hover:bg-green-900/10"
              style={{ borderColor: 'rgba(74, 222, 128, 0.3)', color: '#4ade80' }}
            >
              CONTINUE AS DEMO ▸
            </button>

            <p className="text-center text-sm pt-4" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>
              {view === 'signin' ? "No account?" : "Already registered?"}{' '}
              <button
                onClick={() => setView(view === 'signin' ? 'signup' : 'signin')}
                style={{ color: '#4ade80' }}
                className="hover:underline"
              >
                {view === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </div>

          <div className="mt-12 pt-6 border-t text-xs tracking-widest" style={{ borderColor: 'rgba(74, 222, 128, 0.1)', color: 'rgba(212, 232, 220, 0.35)' }}>
            <div className="flex justify-between">
              <span>v2.4.1 // BUILD 8847</span>
              <span style={{ color: '#4ade80' }}>● SECURE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthInput({ icon, label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="text-xs tracking-[0.2em] mb-2 block" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'rgba(74, 222, 128, 0.5)' }}>
          {icon}
        </div>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-11 pr-4 py-3.5 text-sm transition-all"
          style={{
            background: 'rgba(16, 30, 24, 0.5)',
            border: '1px solid rgba(74, 222, 128, 0.2)',
            color: '#f0fdf4'
          }}
        />
      </div>
    </div>
  );
}

function StatBar({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'rgba(74, 222, 128, 0.1)' }}>
      <span className="text-xs tracking-[0.2em]" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>{label}</span>
      <span className="display-font text-xl" style={{ color: '#4ade80' }}>{value}</span>
    </div>
  );
}

/* ============== TOP NAV ============== */
function TopNav({ user, onLogout, activeTab, setActiveTab }) {
  const tabs = [
    { id: 'dashboard', label: 'OVERVIEW', icon: <Gauge size={14} /> },
    { id: 'sources', label: 'ENERGY MIX', icon: <Activity size={14} /> },
    { id: 'ai', label: 'AI DECISIONS', icon: <Cpu size={14} /> },
    { id: 'forecast', label: 'FORECAST', icon: <TrendingUp size={14} /> },
    { id: 'settings', label: 'SYSTEM', icon: <Settings size={14} /> },
  ];

  return (
    <nav className="border-b sticky top-0 z-40" style={{
      background: 'rgba(5, 8, 7, 0.85)',
      backdropFilter: 'blur(20px)',
      borderColor: 'rgba(74, 222, 128, 0.15)'
    }}>
      <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center" style={{ background: '#4ade80', color: '#0a0f0d' }}>
              <Zap size={18} strokeWidth={3} />
            </div>
            <div>
              <div className="display-font text-lg leading-none" style={{ color: '#f0fdf4' }}>
                ENERGYWATCH<span style={{ color: '#dc2626' }}>.</span>
              </div>
              <div className="text-[9px] tracking-[0.3em]" style={{ color: 'rgba(74, 222, 128, 0.6)' }}>IGS / v2.4.1</div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="px-4 py-2 text-xs tracking-[0.15em] flex items-center gap-2 transition-all"
                style={{
                  color: activeTab === t.id ? '#4ade80' : 'rgba(212, 232, 220, 0.5)',
                  borderBottom: activeTab === t.id ? '2px solid #4ade80' : '2px solid transparent',
                  fontWeight: activeTab === t.id ? 700 : 400
                }}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: 'rgba(212, 232, 220, 0.6)' }}>
            <div className="w-2 h-2 rounded-full live-dot" style={{ background: '#4ade80' }} />
            <span className="tracking-widest">LIVE · 2s</span>
          </div>
          <Bell size={16} style={{ color: 'rgba(212, 232, 220, 0.6)' }} />
          <div className="flex items-center gap-2 pl-4 border-l" style={{ borderColor: 'rgba(74, 222, 128, 0.15)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)', color: '#0a0f0d' }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-semibold" style={{ color: '#f0fdf4' }}>{user?.name}</div>
              <div className="text-[10px]" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>{user?.email}</div>
            </div>
            <button onClick={onLogout} className="ml-2" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile tab strip */}
      <div className="lg:hidden flex overflow-x-auto border-t px-2" style={{ borderColor: 'rgba(74, 222, 128, 0.1)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="px-3 py-3 text-[10px] tracking-widest flex items-center gap-1.5 whitespace-nowrap"
            style={{
              color: activeTab === t.id ? '#4ade80' : 'rgba(212, 232, 220, 0.5)',
              borderBottom: activeTab === t.id ? '2px solid #4ade80' : '2px solid transparent'
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

/* ============== TICKER ============== */
function Ticker() {
  const items = [
    { label: 'GRID', value: '$0.184/kWh', trend: 'up' },
    { label: 'SOLAR OUT', value: '6.2 kW', trend: 'up' },
    { label: 'BATTERY', value: '87%', trend: 'neutral' },
    { label: 'DEMAND', value: '2.1 kW', trend: 'down' },
    { label: 'SELL PRICE', value: '$0.211/kWh', trend: 'up' },
    { label: 'CO₂ SAVED', value: '14.2 lbs TODAY', trend: 'up' },
    { label: 'NG SPOT', value: '$3.42 MMBtu', trend: 'down' },
    { label: 'FORECAST', value: 'SUNNY · 78°F', trend: 'neutral' },
  ];
  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden border-b" style={{
      background: 'rgba(8, 18, 14, 0.8)',
      borderColor: 'rgba(74, 222, 128, 0.1)'
    }}>
      <div className="flex gap-8 py-2 whitespace-nowrap" style={{ animation: 'ticker 40s linear infinite' }}>
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-4 text-xs">
            <span style={{ color: 'rgba(212, 232, 220, 0.4)' }} className="tracking-widest">{item.label}</span>
            <span style={{ color: '#f0fdf4' }} className="font-bold">{item.value}</span>
            {item.trend === 'up' && <TrendingUp size={10} style={{ color: '#4ade80' }} />}
            {item.trend === 'down' && <TrendingDown size={10} style={{ color: '#f87171' }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============== DASHBOARD ============== */
function Dashboard({ tick, user }) {
  // Generate live-ish data
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
    <div className="space-y-6">
      {/* Hero AI Decision banner */}
      <AIDecisionBanner />

      {/* Top metric row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="SOLAR GENERATION"
          value="6.24"
          unit="kW"
          trend="+12.4%"
          trendUp
          icon={<Sun />}
          accent="#fbbf24"
          subtext="Peak today: 9.1 kW @ 1:14 PM"
        />
        <MetricCard
          label="HOME DEMAND"
          value="2.11"
          unit="kW"
          trend="-3.2%"
          icon={<Home />}
          accent="#60a5fa"
          subtext="HVAC, lighting, EV charging"
        />
        <MetricCard
          label="BATTERY RESERVE"
          value="87"
          unit="%"
          trend="CHARGING"
          trendUp
          icon={<Battery />}
          accent="#4ade80"
          subtext="11.8 kWh / 13.5 kWh capacity"
        />
        <MetricCard
          label="GRID EXPORT"
          value="4.13"
          unit="kW"
          trend="+$0.87/hr"
          trendUp
          icon={<ArrowUpFromLine />}
          accent="#dc2626"
          subtext="Selling to grid @ premium rate"
        />
      </div>

      {/* Main grid: flow diagram + price chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 panel p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="label-tag mb-1">// REAL-TIME POWER FLOW</div>
              <h3 className="display-font text-2xl" style={{ color: '#f0fdf4' }}>System Topology</h3>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: '#4ade80' }}>
              <div className="w-2 h-2 rounded-full live-dot" style={{ background: '#4ade80' }} />
              SYNCED
            </div>
          </div>
          <PowerFlowDiagram tick={tick} />
        </div>

        <div className="panel p-6">
          <div className="label-tag mb-1">// 24H PRICE SIGNAL</div>
          <h3 className="display-font text-xl mb-1" style={{ color: '#f0fdf4' }}>Grid Pricing</h3>
          <p className="text-xs mb-4" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>Sell windows highlighted green</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hourlyData}>
              <defs>
                <linearGradient id="priceG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" stroke="#4a5a50" fontSize={9} interval={3} />
              <YAxis stroke="#4a5a50" fontSize={9} />
              <Tooltip contentStyle={{ background: '#0a1410', border: '1px solid #4ade80', fontSize: '11px' }} />
              <ReferenceLine x={now.hour} stroke="#dc2626" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="price" stroke="#4ade80" fill="url(#priceG)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(74, 222, 128, 0.1)' }}>
            <div>
              <div className="label-tag">NOW</div>
              <div className="text-sm font-bold" style={{ color: '#4ade80' }}>${now.price.toFixed(3)}</div>
            </div>
            <div>
              <div className="label-tag">PEAK</div>
              <div className="text-sm font-bold" style={{ color: '#dc2626' }}>$0.211</div>
            </div>
            <div>
              <div className="label-tag">OFF-PEAK</div>
              <div className="text-sm font-bold" style={{ color: 'rgba(212, 232, 220, 0.7)' }}>$0.074</div>
            </div>
          </div>
        </div>
      </div>

      {/* Solar + demand chart + savings */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 panel p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="label-tag mb-1">// TODAY'S PROFILE</div>
              <h3 className="display-font text-2xl" style={{ color: '#f0fdf4' }}>Generation vs Demand</h3>
            </div>
            <div className="flex gap-4 text-xs">
              <LegendDot color="#fbbf24" label="SOLAR" />
              <LegendDot color="#60a5fa" label="DEMAND" />
              <LegendDot color="#4ade80" label="BATTERY %" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={hourlyData}>
              <XAxis dataKey="hour" stroke="#4a5a50" fontSize={10} interval={2} />
              <YAxis yAxisId="left" stroke="#4a5a50" fontSize={10} label={{ value: 'kW', position: 'insideLeft', fill: '#4a5a50', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#4a5a50" fontSize={10} label={{ value: '%', position: 'insideRight', fill: '#4a5a50', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0a1410', border: '1px solid #4ade80', fontSize: '11px' }} />
              <ReferenceLine yAxisId="left" x={now.hour} stroke="#dc2626" strokeDasharray="3 3" />
              <Line yAxisId="left" type="monotone" dataKey="solar" stroke="#fbbf24" strokeWidth={2.5} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="demand" stroke="#60a5fa" strokeWidth={2.5} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="battery" stroke="#4ade80" strokeWidth={2} strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel-accent p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl" style={{ background: 'rgba(74, 222, 128, 0.15)' }} />
          <div className="relative">
            <div className="label-tag mb-1">// MONTH-TO-DATE</div>
            <h3 className="display-font text-2xl mb-4" style={{ color: '#f0fdf4' }}>Savings Report</h3>

            <div className="mb-6">
              <div className="label-tag">TOTAL SAVED</div>
              <div className="metric-big" style={{ color: '#4ade80' }}>$287.42</div>
              <div className="text-xs mt-1" style={{ color: 'rgba(212, 232, 220, 0.6)' }}>
                <span style={{ color: '#4ade80' }}>▲ 34%</span> vs. last month
              </div>
            </div>

            <div className="space-y-3">
              <SavingsRow label="Grid sellback" value="+$184.20" positive />
              <SavingsRow label="Self-consumption" value="+$72.80" positive />
              <SavingsRow label="Peak shaving" value="+$48.30" positive />
              <SavingsRow label="Demand charges" value="-$17.88" />
            </div>

            <div className="mt-6 pt-4 border-t" style={{ borderColor: 'rgba(74, 222, 128, 0.2)' }}>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(212, 232, 220, 0.7)' }}>
                <Leaf size={12} style={{ color: '#4ade80' }} />
                <span>Equivalent to planting <b style={{ color: '#4ade80' }}>38 trees</b> this month</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Decision log */}
      <DecisionLog />
    </div>
  );
}

function AIDecisionBanner() {
  return (
    <div className="panel-accent p-6 relative overflow-hidden scan-container">
      <div className="absolute top-0 left-0 w-1 h-full" style={{ background: 'linear-gradient(180deg, #4ade80, #dc2626)' }} />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Cpu size={14} style={{ color: '#4ade80' }} />
            <span className="text-xs tracking-[0.2em]" style={{ color: '#4ade80' }}>AI DECISION · 14:27:03</span>
            <span className="status-chip blink" style={{ background: 'rgba(220, 38, 38, 0.2)', color: '#fca5a5' }}>● ACTIVE</span>
          </div>
          <h2 className="display-font text-3xl lg:text-4xl" style={{ color: '#f0fdf4' }}>
            SELL TO GRID
          </h2>
          <p className="text-sm mt-2" style={{ color: 'rgba(212, 232, 220, 0.7)' }}>
            Peak pricing window detected. Diverting 4.13 kW surplus solar to grid. Battery holds at 87% for evening demand.
          </p>
        </div>

        <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 lg:border-l lg:pl-4" style={{ borderColor: 'rgba(74, 222, 128, 0.2)' }}>
          <MiniStat label="CONFIDENCE" value="94%" color="#4ade80" />
          <MiniStat label="REVENUE/HR" value="+$0.87" color="#4ade80" />
          <MiniStat label="NEXT REVIEW" value="18 MIN" color="#fbbf24" />
        </div>

        <div className="space-y-2">
          <div className="text-xs tracking-widest" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>REASONING</div>
          <div className="text-xs space-y-1" style={{ color: 'rgba(212, 232, 220, 0.8)' }}>
            <div>✓ Sun irradiance: 92% capacity</div>
            <div>✓ Grid rate: peak tier ($0.211)</div>
            <div>✓ Forecast: clear through 6 PM</div>
            <div>✓ Load forecast: low until 17:00</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <div className="label-tag">{label}</div>
      <div className="display-font text-xl" style={{ color }}>{value}</div>
    </div>
  );
}

function MetricCard({ label, value, unit, trend, trendUp, icon, accent, subtext }) {
  return (
    <div className="panel p-5 relative group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 flex items-center justify-center" style={{
          background: `${accent}15`,
          color: accent,
          border: `1px solid ${accent}40`
        }}>
          {React.cloneElement(icon, { size: 18 })}
        </div>
        {trend && (
          <div className="text-xs font-bold" style={{ color: trendUp ? '#4ade80' : '#f87171' }}>
            {trend}
          </div>
        )}
      </div>
      <div className="label-tag">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="metric-big" style={{ color: '#f0fdf4' }}>{value}</span>
        <span className="text-sm" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>{unit}</span>
      </div>
      {subtext && (
        <div className="text-[10px] mt-2" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>{subtext}</div>
      )}
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span style={{ color: 'rgba(212, 232, 220, 0.6)' }}>{label}</span>
    </div>
  );
}

function SavingsRow({ label, value, positive }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: 'rgba(74, 222, 128, 0.08)' }}>
      <span className="text-xs" style={{ color: 'rgba(212, 232, 220, 0.7)' }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: positive ? '#4ade80' : '#f87171' }}>{value}</span>
    </div>
  );
}

/* ============== POWER FLOW DIAGRAM ============== */
function PowerFlowDiagram({ tick }) {
  return (
    <svg viewBox="0 0 700 340" className="w-full">
      <defs>
        <linearGradient id="flow1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
        <linearGradient id="flow2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id="flow3" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
      </defs>

      {/* Grid background */}
      <g opacity="0.1">
        {Array.from({length: 18}).map((_, i) => (
          <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="340" stroke="#4ade80" strokeWidth="0.5" />
        ))}
        {Array.from({length: 9}).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 40} x2="700" y2={i * 40} stroke="#4ade80" strokeWidth="0.5" />
        ))}
      </g>

      {/* Connecting lines */}
      <path d="M 150 90 L 350 170" stroke="url(#flow1)" strokeWidth="3" fill="none" className="flow-line" />
      <path d="M 150 250 L 350 170" stroke="#4ade80" strokeWidth="1.5" fill="none" strokeDasharray="2 4" opacity="0.5" />
      <path d="M 350 170 L 550 90" stroke="url(#flow3)" strokeWidth="3" fill="none" className="flow-line" />
      <path d="M 350 170 L 550 250" stroke="url(#flow2)" strokeWidth="3" fill="none" className="flow-line" />

      {/* Nodes */}
      <FlowNode x={80} y={90} label="SOLAR" value="6.24 kW" color="#fbbf24" icon="sun" />
      <FlowNode x={80} y={250} label="GRID" value="BUY OFF" color="#94a3b8" icon="grid" dim />
      <FlowNode x={350} y={170} label="AI ROUTER" value="OPTIMIZING" color="#4ade80" icon="cpu" big />
      <FlowNode x={620} y={90} label="SELL" value="4.13 kW" color="#dc2626" icon="export" />
      <FlowNode x={620} y={250} label="HOME" value="2.11 kW" color="#60a5fa" icon="home" />

      {/* Battery indicator */}
      <g transform="translate(350, 280)">
        <rect x="-60" y="0" width="120" height="30" fill="#0a1410" stroke="#4ade80" strokeWidth="1" />
        <rect x="-58" y="2" width="104" height="26" fill="#4ade8020" />
        <rect x="-58" y="2" width="90" height="26" fill="url(#flow1)" opacity="0.6" />
        <text x="0" y="20" textAnchor="middle" fill="#f0fdf4" fontSize="11" fontWeight="700" fontFamily="JetBrains Mono">BATTERY 87%</text>
      </g>

      {/* Flow labels */}
      <text x="240" y="125" fill="#4ade80" fontSize="10" fontFamily="JetBrains Mono" fontWeight="600">→ 6.24 kW</text>
      <text x="460" y="125" fill="#dc2626" fontSize="10" fontFamily="JetBrains Mono" fontWeight="600">→ 4.13 kW · $0.21</text>
      <text x="460" y="220" fill="#60a5fa" fontSize="10" fontFamily="JetBrains Mono" fontWeight="600">→ 2.11 kW</text>
    </svg>
  );
}

function FlowNode({ x, y, label, value, color, icon, big, dim }) {
  const size = big ? 50 : 40;
  return (
    <g transform={`translate(${x}, ${y})`} opacity={dim ? 0.4 : 1}>
      <circle r={size + 6} fill="none" stroke={color} strokeOpacity="0.2" strokeWidth="1" />
      <circle r={size} fill="#0a1410" stroke={color} strokeWidth={big ? 2 : 1.5} />
      {big && <circle r={size + 12} fill="none" stroke={color} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5" />}
      {icon === 'sun' && <g><circle r="8" fill={color} /><g stroke={color} strokeWidth="2"><line x1="-14" y1="0" x2="-18" y2="0"/><line x1="14" y1="0" x2="18" y2="0"/><line x1="0" y1="-14" x2="0" y2="-18"/><line x1="0" y1="14" x2="0" y2="18"/></g></g>}
      {icon === 'grid' && <g stroke={color} strokeWidth="1.5" fill="none"><rect x="-10" y="-10" width="20" height="20"/><line x1="-10" y1="0" x2="10" y2="0"/><line x1="0" y1="-10" x2="0" y2="10"/></g>}
      {icon === 'cpu' && <g fill={color}><rect x="-12" y="-12" width="24" height="24" rx="2" fill="none" stroke={color} strokeWidth="2" /><rect x="-5" y="-5" width="10" height="10" fill={color}/></g>}
      {icon === 'export' && <g stroke={color} strokeWidth="2" fill="none"><path d="M -8 4 L 0 -6 L 8 4" /><line x1="0" y1="-6" x2="0" y2="10"/></g>}
      {icon === 'home' && <g stroke={color} strokeWidth="2" fill="none"><path d="M -10 2 L 0 -8 L 10 2 L 10 10 L -10 10 Z" /></g>}

      <text y={size + 20} textAnchor="middle" fill="rgba(212, 232, 220, 0.5)" fontSize="9" fontFamily="JetBrains Mono" letterSpacing="2">{label}</text>
      <text y={size + 35} textAnchor="middle" fill={color} fontSize="12" fontWeight="700" fontFamily="JetBrains Mono">{value}</text>
    </g>
  );
}

/* ============== DECISION LOG ============== */
function DecisionLog() {
  const decisions = [
    { time: '14:27:03', action: 'SELL', icon: <ArrowUpFromLine size={14} />, color: '#dc2626', desc: 'Peak pricing @ $0.211. Exporting 4.13 kW surplus.', impact: '+$0.87/hr' },
    { time: '13:45:11', action: 'CHARGE', icon: <Battery size={14} />, color: '#4ade80', desc: 'Battery reached 87% — holding reserve for evening peak.', impact: '—' },
    { time: '11:22:48', action: 'CONSUME', icon: <Home size={14} />, color: '#60a5fa', desc: 'Routing solar directly to HVAC load. Grid isolated.', impact: '+$0.42/hr' },
    { time: '08:14:33', action: 'BUY', icon: <ArrowDownToLine size={14} />, color: '#94a3b8', desc: 'Low solar + off-peak rate. Topping battery from grid.', impact: '-$0.18/hr' },
    { time: '06:02:19', action: 'HOLD', icon: <AlertCircle size={14} />, color: '#fbbf24', desc: 'Dawn transition. System idle pending irradiance threshold.', impact: '—' },
  ];

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="label-tag mb-1">// DECISION LOG</div>
          <h3 className="display-font text-2xl" style={{ color: '#f0fdf4' }}>AI Activity Stream</h3>
        </div>
        <button className="text-xs tracking-widest" style={{ color: '#4ade80' }}>
          VIEW ALL →
        </button>
      </div>

      <div className="space-y-0">
        {decisions.map((d, i) => (
          <div key={i} className="grid grid-cols-12 gap-4 py-3 border-b items-center text-sm" style={{ borderColor: 'rgba(74, 222, 128, 0.08)' }}>
            <div className="col-span-2 text-xs tracking-widest" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>{d.time}</div>
            <div className="col-span-2">
              <span className="status-chip" style={{ background: `${d.color}20`, color: d.color, border: `1px solid ${d.color}40` }}>
                {d.icon} {d.action}
              </span>
            </div>
            <div className="col-span-6" style={{ color: 'rgba(212, 232, 220, 0.85)' }}>{d.desc}</div>
            <div className="col-span-2 text-right text-xs font-bold" style={{ color: d.impact.startsWith('+') ? '#4ade80' : d.impact.startsWith('-') ? '#f87171' : 'rgba(212, 232, 220, 0.4)' }}>
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
    { name: 'SOLAR PV', percent: 64, kwh: '38.2', icon: <Sun />, color: '#fbbf24', status: 'PRIMARY · GENERATING' },
    { name: 'BATTERY', percent: 18, kwh: '10.8', icon: <Battery />, color: '#4ade80', status: 'BUFFERING' },
    { name: 'GRID · MIXED', percent: 14, kwh: '8.4', icon: <Zap />, color: '#94a3b8', status: 'OFF-PEAK IMPORT' },
    { name: 'NATURAL GAS', percent: 4, kwh: '2.3', icon: <Flame />, color: '#f87171', status: 'WATER HEATER ONLY' },
  ];

  const gridMix = [
    { name: 'Wind', value: 32, color: '#60a5fa' },
    { name: 'Solar', value: 18, color: '#fbbf24' },
    { name: 'Nuclear', value: 22, color: '#a78bfa' },
    { name: 'Natural Gas', value: 21, color: '#f87171' },
    { name: 'Hydro', value: 5, color: '#22d3ee' },
    { name: 'Coal', value: 2, color: '#64748b' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="label-tag mb-1">// ENERGY MIX / SOURCE IDENTIFICATION</div>
        <h2 className="display-font text-4xl" style={{ color: '#f0fdf4' }}>Where's your power coming from?</h2>
        <p className="sans-font text-sm mt-2 max-w-2xl" style={{ color: 'rgba(212, 232, 220, 0.6)' }}>
          EnergyWatch identifies and meters every energy source feeding your home in real-time — distinguishing solar generation, battery discharge, grid imports, and fossil-fuel utilities like natural gas.
        </p>
      </div>

      {/* Source cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sources.map(s => (
          <SourceCard key={s.name} {...s} />
        ))}
      </div>

      {/* 24h stacked chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 panel p-6">
          <div className="label-tag mb-1">// 24-HOUR ENERGY SOURCE TIMELINE</div>
          <h3 className="display-font text-2xl mb-4" style={{ color: '#f0fdf4' }}>Source Mix Over Time</h3>
          <SourceStackedChart />
          <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t text-xs" style={{ borderColor: 'rgba(74, 222, 128, 0.1)' }}>
            {sources.map(s => (
              <LegendDot key={s.name} color={s.color} label={s.name} />
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <div className="label-tag mb-1">// UTILITY GRID COMPOSITION</div>
          <h3 className="display-font text-xl mb-1" style={{ color: '#f0fdf4' }}>When You Buy From Grid</h3>
          <p className="text-xs mb-4" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>Current fuel mix on local grid (IGS disclosure data)</p>

          <div className="space-y-3">
            {gridMix.map(m => (
              <div key={m.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'rgba(212, 232, 220, 0.8)' }}>{m.name}</span>
                  <span style={{ color: m.color }} className="font-bold">{m.value}%</span>
                </div>
                <div className="h-1.5" style={{ background: 'rgba(74, 222, 128, 0.08)' }}>
                  <div className="h-full transition-all" style={{ width: `${m.value}%`, background: m.color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t" style={{ borderColor: 'rgba(74, 222, 128, 0.1)' }}>
            <div className="label-tag">RENEWABLE SHARE</div>
            <div className="metric-big mt-1" style={{ color: '#4ade80' }}>57%</div>
            <div className="text-xs mt-1" style={{ color: 'rgba(212, 232, 220, 0.6)' }}>
              <span style={{ color: '#4ade80' }}>▲ 8pts</span> year-over-year
            </div>
          </div>
        </div>
      </div>

      {/* Device-level breakdown */}
      <div className="panel p-6">
        <div className="label-tag mb-1">// LOAD DISAGGREGATION</div>
        <h3 className="display-font text-2xl mb-4" style={{ color: '#f0fdf4' }}>What's using your power right now</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DeviceCard name="HVAC" load="1.42 kW" percent={67} source="SOLAR" color="#fbbf24" />
          <DeviceCard name="EV CHARGER" load="0.00 kW" percent={0} source="IDLE" color="#94a3b8" />
          <DeviceCard name="WATER HEATER" load="0.38 kW" percent={18} source="NAT. GAS" color="#f87171" />
          <DeviceCard name="APPLIANCES" load="0.31 kW" percent={15} source="SOLAR" color="#fbbf24" />
        </div>
      </div>
    </div>
  );
}

function SourceCard({ name, percent, kwh, icon, color, status }) {
  return (
    <div className="panel p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: color, opacity: 0.6 }} />
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 flex items-center justify-center mb-3" style={{
          background: `${color}15`,
          color,
          border: `1px solid ${color}40`
        }}>
          {React.cloneElement(icon, { size: 18 })}
        </div>
        <div className="text-right">
          <div className="display-font text-3xl" style={{ color }}>{percent}%</div>
        </div>
      </div>
      <div className="label-tag mt-2">{name}</div>
      <div className="text-lg font-bold mt-1" style={{ color: '#f0fdf4' }}>{kwh} kWh <span className="text-xs font-normal" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>today</span></div>
      <div className="text-[10px] tracking-widest mt-2" style={{ color }}>● {status}</div>
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
        <XAxis dataKey="hour" stroke="#4a5a50" fontSize={10} />
        <YAxis stroke="#4a5a50" fontSize={10} label={{ value: 'kW', position: 'insideLeft', fill: '#4a5a50', fontSize: 10 }} />
        <Tooltip contentStyle={{ background: '#0a1410', border: '1px solid #4ade80', fontSize: '11px' }} />
        <Area type="monotone" dataKey="solar" stackId="1" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.7} />
        <Area type="monotone" dataKey="battery" stackId="1" stroke="#4ade80" fill="#4ade80" fillOpacity={0.7} />
        <Area type="monotone" dataKey="grid" stackId="1" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.7} />
        <Area type="monotone" dataKey="gas" stackId="1" stroke="#f87171" fill="#f87171" fillOpacity={0.7} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DeviceCard({ name, load, percent, source, color }) {
  return (
    <div className="p-4 border" style={{ borderColor: 'rgba(74, 222, 128, 0.15)', background: 'rgba(16, 30, 24, 0.3)' }}>
      <div className="flex justify-between items-start mb-2">
        <div className="label-tag">{name}</div>
        <div className="text-[9px] tracking-widest px-1.5 py-0.5" style={{ background: `${color}20`, color }}>{source}</div>
      </div>
      <div className="text-2xl font-bold" style={{ color: '#f0fdf4' }}>{load}</div>
      <div className="mt-3 h-1" style={{ background: 'rgba(74, 222, 128, 0.1)' }}>
        <div className="h-full" style={{ width: `${percent}%`, background: color }} />
      </div>
    </div>
  );
}

/* ============== AI DECISIONS ============== */
function AIDecisions({ tick }) {
  const models = [
    { name: 'PRICE FORECASTING', version: 'v3.2', accuracy: 94.2, status: 'ACTIVE', desc: 'LSTM on ISO-wholesale + retail tariff data' },
    { name: 'WEATHER SYNTHESIS', version: 'v2.8', accuracy: 89.7, status: 'ACTIVE', desc: 'Ensemble: NOAA GFS + HRRR + local irradiance' },
    { name: 'LOAD PREDICTION', version: 'v4.1', accuracy: 96.1, status: 'ACTIVE', desc: 'XGBoost on 90-day occupancy + device patterns' },
    { name: 'OPTIMIZER', version: 'v1.9', accuracy: 91.5, status: 'ACTIVE', desc: 'Mixed-integer LP with 72h rolling horizon' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="label-tag mb-1">// AI DECISION ENGINE</div>
        <h2 className="display-font text-4xl" style={{ color: '#f0fdf4' }}>The brain behind every watt.</h2>
        <p className="sans-font text-sm mt-2 max-w-2xl" style={{ color: 'rgba(212, 232, 220, 0.6)' }}>
          Four specialized models run every 2 seconds, synthesizing weather, pricing, and load signals into optimal dispatch decisions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {models.map(m => (
          <div key={m.name} className="panel p-5">
            <div className="flex items-center justify-between mb-3">
              <Cpu size={16} style={{ color: '#4ade80' }} />
              <div className="text-[9px] tracking-widest px-2 py-0.5" style={{ background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80' }}>
                ● {m.status}
              </div>
            </div>
            <div className="label-tag">{m.name}</div>
            <div className="text-xs mt-1" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>{m.version}</div>
            <div className="metric-big mt-4" style={{ color: '#f0fdf4' }}>{m.accuracy}%</div>
            <div className="text-[10px] tracking-widest mt-1" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>7-DAY ACCURACY</div>
            <div className="mt-3 pt-3 border-t text-xs" style={{ borderColor: 'rgba(74, 222, 128, 0.1)', color: 'rgba(212, 232, 220, 0.65)' }}>
              {m.desc}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="panel p-6">
          <div className="label-tag mb-1">// 72H PROJECTED ACTIONS</div>
          <h3 className="display-font text-2xl mb-4" style={{ color: '#f0fdf4' }}>Planned Dispatch</h3>
          <DispatchPlan />
        </div>

        <div className="panel p-6">
          <div className="label-tag mb-1">// CURRENT REASONING</div>
          <h3 className="display-font text-2xl mb-4" style={{ color: '#f0fdf4' }}>Decision Tree</h3>
          <DecisionTree />
        </div>
      </div>

      <DecisionLog />
    </div>
  );
}

function DispatchPlan() {
  const hours = [
    { h: 'NOW · 14:00', action: 'SELL', color: '#dc2626', reason: 'Peak tariff · surplus solar' },
    { h: '15:00', action: 'SELL', color: '#dc2626', reason: 'Peak tariff continues' },
    { h: '16:00', action: 'SELL', color: '#dc2626', reason: 'Price holding @ $0.21' },
    { h: '17:00', action: 'CONSUME', color: '#60a5fa', reason: 'Demand ramp · HVAC + cooking' },
    { h: '18:00', action: 'DISCHARGE', color: '#4ade80', reason: 'Battery → home · avoid peak buy' },
    { h: '19:00', action: 'DISCHARGE', color: '#4ade80', reason: 'Continue battery-first strategy' },
    { h: '20:00', action: 'DISCHARGE', color: '#4ade80', reason: 'Hold until price drop' },
    { h: '21:00', action: 'HOLD', color: '#fbbf24', reason: 'Tariff transition window' },
    { h: '22:00', action: 'BUY', color: '#94a3b8', reason: 'Off-peak · top battery to 95%' },
    { h: '06:00 (TMRW)', action: 'STANDBY', color: '#94a3b8', reason: 'Dawn · awaiting solar threshold' },
  ];

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
      {hours.map((h, i) => (
        <div key={i} className="grid grid-cols-12 gap-3 py-2 border-b items-center text-xs" style={{ borderColor: 'rgba(74, 222, 128, 0.08)' }}>
          <div className="col-span-3 tracking-widest" style={{ color: i === 0 ? '#4ade80' : 'rgba(212, 232, 220, 0.5)' }}>
            {h.h}
          </div>
          <div className="col-span-3">
            <span className="status-chip" style={{ background: `${h.color}20`, color: h.color, border: `1px solid ${h.color}40` }}>
              {h.action}
            </span>
          </div>
          <div className="col-span-6" style={{ color: 'rgba(212, 232, 220, 0.75)' }}>{h.reason}</div>
        </div>
      ))}
    </div>
  );
}

function DecisionTree() {
  return (
    <div className="space-y-3 text-xs font-mono">
      <TreeRow depth={0} color="#4ade80" label="INPUT: Market signals @ 14:27:03" />
      <TreeRow depth={1} color="rgba(212, 232, 220, 0.8)" label="IF grid_price > $0.18/kWh" pass />
      <TreeRow depth={2} color="rgba(212, 232, 220, 0.8)" label="→ $0.211 · MATCH" pass />
      <TreeRow depth={1} color="rgba(212, 232, 220, 0.8)" label="AND solar_surplus > 2 kW" pass />
      <TreeRow depth={2} color="rgba(212, 232, 220, 0.8)" label="→ 4.13 kW surplus · MATCH" pass />
      <TreeRow depth={1} color="rgba(212, 232, 220, 0.8)" label="AND battery_soc > 80%" pass />
      <TreeRow depth={2} color="rgba(212, 232, 220, 0.8)" label="→ 87% · MATCH" pass />
      <TreeRow depth={1} color="rgba(212, 232, 220, 0.8)" label="AND forecast_ok_next_3h" pass />
      <TreeRow depth={2} color="rgba(212, 232, 220, 0.8)" label="→ Clear skies · MATCH" pass />
      <TreeRow depth={0} color="#dc2626" label="DECISION: SELL 4.13 kW TO GRID" bold />
      <div className="mt-4 p-3 text-xs" style={{ background: 'rgba(74, 222, 128, 0.05)', borderLeft: '2px solid #4ade80' }}>
        <div className="label-tag mb-1">CONFIDENCE · 94%</div>
        <div style={{ color: 'rgba(212, 232, 220, 0.8)' }}>Expected revenue: <span className="font-bold" style={{ color: '#4ade80' }}>+$0.87/hr</span>. Re-evaluation scheduled in 18 min or on signal delta &gt; 8%.</div>
      </div>
    </div>
  );
}

function TreeRow({ depth, color, label, pass, bold }) {
  return (
    <div style={{ paddingLeft: depth * 20, color, fontWeight: bold ? 700 : 400 }} className="flex items-center gap-2">
      {depth > 0 && <span style={{ color: 'rgba(212, 232, 220, 0.3)' }}>{'└─'}</span>}
      {pass && <span style={{ color: '#4ade80' }}>✓</span>}
      <span>{label}</span>
    </div>
  );
}

/* ============== FORECAST ============== */
function ForecastPanel() {
  const forecast = [
    { day: 'TODAY', date: 'APR 18', temp: 78, low: 61, cond: 'Sunny', icon: '☀', irr: 94, price: 'HIGH', rec: 'SELL AGGRESSIVELY' },
    { day: 'SUN', date: 'APR 19', temp: 74, low: 58, cond: 'Clear', icon: '☀', irr: 91, price: 'HIGH', rec: 'SELL + CHARGE EV' },
    { day: 'MON', date: 'APR 20', temp: 69, low: 54, cond: 'Cloudy', icon: '☁', irr: 44, price: 'MED', rec: 'SELF-CONSUME' },
    { day: 'TUE', date: 'APR 21', temp: 62, low: 49, cond: 'Rain', icon: '⛆', irr: 18, price: 'MED', rec: 'PRE-CHARGE BATTERY' },
    { day: 'WED', date: 'APR 22', temp: 65, low: 51, cond: 'P. Cloudy', icon: '⛅', irr: 62, price: 'LOW', rec: 'BUY FROM GRID' },
    { day: 'THU', date: 'APR 23', temp: 72, low: 56, cond: 'Sunny', icon: '☀', irr: 88, price: 'HIGH', rec: 'SELL WINDOW' },
    { day: 'FRI', date: 'APR 24', temp: 75, low: 59, cond: 'Sunny', icon: '☀', irr: 92, price: 'HIGH', rec: 'SELL + STORE' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="label-tag mb-1">// FORECAST / 7 DAYS</div>
        <h2 className="display-font text-4xl" style={{ color: '#f0fdf4' }}>The week ahead.</h2>
        <p className="sans-font text-sm mt-2 max-w-2xl" style={{ color: 'rgba(212, 232, 220, 0.6)' }}>
          Weather and price forecasts drive every AI decision. Here's what the engine sees over the next 168 hours.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {forecast.map((d, i) => (
          <div key={i} className="panel p-4 text-center">
            <div className="text-[10px] tracking-widest" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>{d.day}</div>
            <div className="text-[10px]" style={{ color: 'rgba(212, 232, 220, 0.4)' }}>{d.date}</div>
            <div className="text-4xl my-2" style={{ color: '#fbbf24' }}>{d.icon}</div>
            <div className="display-font text-2xl" style={{ color: '#f0fdf4' }}>{d.temp}°</div>
            <div className="text-[10px]" style={{ color: 'rgba(212, 232, 220, 0.5)' }}>{d.low}° · {d.cond}</div>
            <div className="mt-3 pt-2 border-t" style={{ borderColor: 'rgba(74, 222, 128, 0.1)' }}>
              <div className="label-tag">IRRAD</div>
              <div className="text-sm font-bold" style={{ color: '#fbbf24' }}>{d.irr}%</div>
            </div>
            <div className="mt-2">
              <div className="label-tag">PRICE</div>
              <div className="text-sm font-bold" style={{ color: d.price === 'HIGH' ? '#dc2626' : d.price === 'MED' ? '#fbbf24' : '#4ade80' }}>{d.price}</div>
            </div>
            <div className="mt-3 text-[9px] tracking-wide px-1 py-1" style={{ background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80' }}>
              {d.rec}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="panel p-6">
          <div className="label-tag mb-1">// 7-DAY PRICE FORECAST</div>
          <h3 className="display-font text-2xl mb-4" style={{ color: '#f0fdf4' }}>Grid Tariff Projections</h3>
          <ForecastPriceChart />
        </div>

        <div className="panel p-6">
          <div className="label-tag mb-1">// PROJECTED GENERATION</div>
          <h3 className="display-font text-2xl mb-4" style={{ color: '#f0fdf4' }}>Solar Output Forecast</h3>
          <ForecastSolarChart />
        </div>
      </div>

      <div className="panel-accent p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 flex items-center justify-center" style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.4)' }}>
            <AlertCircle size={20} />
          </div>
          <div className="flex-1">
            <div className="label-tag mb-1" style={{ color: '#fbbf24' }}>// STRATEGIC ADVISORY</div>
            <h3 className="display-font text-xl mb-2" style={{ color: '#f0fdf4' }}>Storm front approaching Tuesday</h3>
            <p className="text-sm" style={{ color: 'rgba(212, 232, 220, 0.8)' }}>
              Expected 80% reduction in solar yield Apr 21. EnergyWatch recommends pre-charging battery to 100% on Monday evening using off-peak grid rates. Projected savings vs. reactive strategy: <b style={{ color: '#4ade80' }}>+$42.10</b>.
            </p>
            <div className="flex gap-3 mt-4">
              <button className="btn-primary px-4 py-2 text-xs tracking-widest">APPROVE PLAN</button>
              <button className="px-4 py-2 text-xs tracking-widest border" style={{ borderColor: 'rgba(74, 222, 128, 0.3)', color: '#4ade80' }}>MODIFY</button>
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
        <XAxis dataKey="t" stroke="#4a5a50" fontSize={9} interval={7} />
        <YAxis stroke="#4a5a50" fontSize={10} />
        <Tooltip contentStyle={{ background: '#0a1410', border: '1px solid #4ade80', fontSize: '11px' }} />
        <Line type="monotone" dataKey="peak" stroke="#dc2626" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="offpeak" stroke="#4ade80" strokeWidth={2} dot={false} strokeDasharray="3 3" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ForecastSolarChart() {
  const data = useMemo(() => {
    const days = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
    const yields = [62, 58, 55, 38, 12, 42, 56];
    return days.map((d, i) => ({ day: d, kwh: yields[i], projected: yields[i] * 0.9 + Math.random() * 4 }));
  }, []);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <XAxis dataKey="day" stroke="#4a5a50" fontSize={10} />
        <YAxis stroke="#4a5a50" fontSize={10} label={{ value: 'kWh', position: 'insideLeft', fill: '#4a5a50', fontSize: 10 }} />
        <Tooltip contentStyle={{ background: '#0a1410', border: '1px solid #4ade80', fontSize: '11px' }} />
        <Bar dataKey="kwh" fill="#fbbf24" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ============== SETTINGS ============== */
function SettingsPanel({ user }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="label-tag mb-1">// SYSTEM / CONNECTED ACCOUNT</div>
        <h2 className="display-font text-4xl" style={{ color: '#f0fdf4' }}>Your setup.</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="panel p-6 lg:col-span-2">
          <div className="label-tag mb-3">// ACCOUNT</div>
          <div className="space-y-4">
            <SettingRow label="Name" value={user.name} />
            <SettingRow label="Email" value={user.email} />
            <SettingRow label="Property" value={user.home} />
            <SettingRow label="IGS Customer ID" value="IGS-OH-4471992" />
            <SettingRow label="Plan" value="IGS ProGrid™ Tier 3" badge="ACTIVE" />
          </div>
        </div>

        <div className="panel-accent p-6">
          <div className="label-tag mb-3">// SYSTEM HARDWARE</div>
          <div className="text-sm space-y-3" style={{ color: 'rgba(212, 232, 220, 0.85)' }}>
            <div>
              <div className="label-tag">INVERTER</div>
              <div>Enphase IQ8M-72-2-US</div>
            </div>
            <div>
              <div className="label-tag">SOLAR ARRAY</div>
              <div>11.2 kW · 28× REC Alpha Pure 400W</div>
            </div>
            <div>
              <div className="label-tag">BATTERY</div>
              <div>Tesla Powerwall 3 · 13.5 kWh</div>
            </div>
            <div>
              <div className="label-tag">METER</div>
              <div>Emporia Vue 3 · 16ch CT</div>
            </div>
            <div>
              <div className="label-tag">NAT. GAS</div>
              <div>Columbia Gas of Ohio · smart meter</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(74, 222, 128, 0.2)' }}>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full live-dot" style={{ background: '#4ade80' }} />
              <span style={{ color: '#4ade80' }}>ALL SYSTEMS NOMINAL</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel p-6">
        <div className="label-tag mb-3">// AI PREFERENCES</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <PreferenceCard title="Strategy" value="AGGRESSIVE" desc="Maximize grid sellback" active />
          <PreferenceCard title="Battery Reserve" value="20%" desc="Minimum reserve for outages" />
          <PreferenceCard title="Notifications" value="DAILY DIGEST" desc="+ critical alerts real-time" />
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, value, badge }) {
  return (
    <div className="flex justify-between items-center py-3 border-b" style={{ borderColor: 'rgba(74, 222, 128, 0.08)' }}>
      <span className="label-tag">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm" style={{ color: '#f0fdf4' }}>{value}</span>
        {badge && <span className="status-chip" style={{ background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', border: '1px solid rgba(74, 222, 128, 0.3)' }}>● {badge}</span>}
      </div>
    </div>
  );
}

function PreferenceCard({ title, value, desc, active }) {
  return (
    <div className="p-4 border" style={{
      borderColor: active ? '#4ade80' : 'rgba(74, 222, 128, 0.2)',
      background: active ? 'rgba(74, 222, 128, 0.05)' : 'transparent'
    }}>
      <div className="label-tag">{title}</div>
      <div className="display-font text-xl mt-1" style={{ color: active ? '#4ade80' : '#f0fdf4' }}>{value}</div>
      <div className="text-xs mt-2" style={{ color: 'rgba(212, 232, 220, 0.6)' }}>{desc}</div>
    </div>
  );
}

/* ============== FOOTER ============== */
function Footer() {
  return (
    <footer className="border-t mt-12 py-6" style={{ borderColor: 'rgba(74, 222, 128, 0.1)' }}>
      <div className="max-w-[1600px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs" style={{ color: 'rgba(212, 232, 220, 0.4)' }}>
        <div className="flex items-center gap-4">
          <span className="tracking-widest">© 2026 ENERGYWATCH</span>
          <span>·</span>
          <span>BUILT FOR IGS ENERGY HACKATHON</span>
        </div>
        <div className="flex items-center gap-4 tracking-widest">
          <span>API v2.4.1</span>
          <span style={{ color: '#4ade80' }}>● ALL SYSTEMS OK</span>
          <span>UPTIME 99.97%</span>
        </div>
      </div>
    </footer>
  );
}