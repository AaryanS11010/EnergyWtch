import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ReferenceLine } from 'recharts';
import { Sun, Zap, Battery, Flame, Activity, TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine, Home, Cpu, AlertCircle, Lock, Mail, User, LogOut, Settings, Bell, Clock, Leaf, Gauge, Sparkles, ChevronRight, Check, MapPin, Navigation, X, RotateCcw, Cloud, CloudRain, CloudSnow, Loader2, KeyRound, Eye, EyeOff, MessageCircle, Send, ChevronDown } from 'lucide-react';

// -------------------------------------------------------------
// CONFIG — point this at the Flask backend
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
        'Cannot reach the EnergyWatch server. Start the Flask backend with:\n' +
        '  pip install flask pyjwt && python app.py\n' +
        'Or use Demo mode below to explore without a backend.'
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
  changePassword(b)   { return this.request('/me/password', { method: 'PUT', body: b, auth: true }); },
};

// -------------------------------------------------------------
// ROOT
// -------------------------------------------------------------
// Default AI settings — used as fallback and for reset
const DEFAULT_AI_SETTINGS = {
  strategy: 'balanced',
  batteryReserve: 20,
  sellThreshold: 0.14,
  buyThreshold: 0.09,
  peakStart: 16,
  peakEnd: 21,
  notifyDecisions: true,
  notifyAdvisories: true,
  notifyAlerts: true,
  notifyPriceSpikes: false,
  autoApproveAdvisories: false,
};

// Hardware profile — user-editable in Settings
const DEFAULT_HARDWARE = {
  inverter:       'Enphase IQ8M-72-2-US',
  solarKw:        11.2,     // array size in kW
  batteryKwh:     13.5,     // usable battery capacity
  meterModel:     'Emporia Vue 3 · 16ch CT',
  gasUtility:     'Columbia Gas of Ohio',
  hasEV:          false,
};

// Central computed stats — single source of truth for all live numbers
function useSystemStats(aiSettings, hardware, hour) {
  return useMemo(() => {
    const s = aiSettings;
    const hw = hardware;
    const h = hour ?? new Date().getHours();

    // Solar generation at current hour (sine curve, scaled to array size)
    const solarKw = +(Math.max(0, Math.sin((h - 6) * Math.PI / 12)) * hw.solarKw * 0.88).toFixed(2);

    // Strategy multipliers
    const stratMult = { aggressive: 1.0, balanced: 0.85, self_sufficient: 0.75 }[s.strategy] ?? 0.85;
    const battMult  = { aggressive: 0.87, balanced: 0.92, self_sufficient: 0.98 }[s.strategy] ?? 0.92;

    const effectiveSolar = +(solarKw * stratMult).toFixed(2);

    // Home demand varies by hour
    const demandKw = +(1.2 + Math.sin(h * 0.5) * 0.6 + (h > 17 && h < 22 ? 2.5 : 0)).toFixed(2);

    // Export = surplus above demand, capped by strategy
    const surplus   = Math.max(0, effectiveSolar - demandKw);
    const exportKw  = s.strategy === 'self_sufficient' ? +(surplus * 0.1).toFixed(2) : +(surplus * (s.strategy === 'aggressive' ? 1.0 : 0.6)).toFixed(2);

    // Grid price at current hour
    const inPeak   = h >= s.peakStart && h < s.peakEnd;
    const gridPrice = +(0.08 + Math.sin((h - 14) * Math.PI / 12) * 0.06 + (inPeak ? 0.08 : 0)).toFixed(3);

    // Battery SoC
    const battSoc  = Math.round(battMult * 100);
    const battKwh  = +(hw.batteryKwh * battMult).toFixed(1);

    // Revenue per hour from export
    const revenuePerHr = +(exportKw * gridPrice).toFixed(2);

    // Month-to-date savings (estimated from strategy)
    const hoursInMonth   = 30 * 24;
    const avgExport      = hw.solarKw * stratMult * 0.35; // avg over day/night
    const avgPrice       = 0.12;
    const sellback       = +(avgExport * avgPrice * hoursInMonth * 0.4).toFixed(2);
    const selfConsume    = +(avgExport * avgPrice * hoursInMonth * 0.25).toFixed(2);
    const peakShave      = +(hw.solarKw * 0.08 * 20).toFixed(2);   // ~20 peak days
    const demandCharge   = +(hw.solarKw * 0.12).toFixed(2);
    const totalSaved     = +(sellback + selfConsume + peakShave - demandCharge).toFixed(2);

    // Monthly kWh exported
    const monthlyExportKwh = Math.round(avgExport * hoursInMonth * 0.4);

    // CO2 offset (0.386 kg CO2 per kWh avoided, 12 months)
    const co2TonsPerYear = +((monthlyExportKwh * 12 * 0.386) / 1000).toFixed(1);

    // Trees equivalent (1 tree ≈ 21 kg CO2/yr)
    const treesThisMonth = Math.round((monthlyExportKwh * 0.386) / 21);

    // Energy source percentages for current hour
    const totalPower    = demandKw + exportKw;
    const solarPercent  = Math.round((effectiveSolar / Math.max(totalPower, 0.1)) * 100);
    const battPercent   = Math.max(0, Math.round((battMult * 0.18) * 100));
    const gridPercent   = Math.max(0, 100 - solarPercent - battPercent - 4);

    // Device loads (time-of-day model)
    const hvacLoad      = +(0.8 + (h > 6 && h < 21 ? 0.6 : 0) + (h > 14 && h < 19 ? 0.4 : 0)).toFixed(2);
    const evLoad        = hw.hasEV && h > 22 ? 7.2 : hw.hasEV && h < 6 ? 3.6 : 0;
    const waterLoad     = +(0.2 + (h === 7 || h === 8 || h === 19 || h === 20 ? 0.6 : 0)).toFixed(2);
    const appLoad       = +(0.15 + (h > 17 && h < 23 ? 0.25 : 0)).toFixed(2);

    return {
      solarKw: effectiveSolar,
      demandKw,
      exportKw,
      gridPrice,
      battSoc,
      battKwh,
      battCapacity: hw.batteryKwh,
      revenuePerHr,
      surplus: +(surplus).toFixed(2),
      inPeak,
      // Savings
      totalSaved,
      sellback,
      selfConsume,
      peakShave,
      demandCharge,
      monthlyExportKwh,
      co2TonsPerYear,
      treesThisMonth,
      avgMonthlySavings: Math.round(totalSaved * 0.9),
      // Sources
      solarPercent: Math.min(solarPercent, 100),
      battPercent,
      gridPercent: Math.max(0, gridPercent),
      // Devices
      hvacLoad,
      evLoad,
      waterLoad,
      appLoad,
    };
  }, [aiSettings, hardware, hour]);
}

// -------------------------------------------------------------
// HOOK — Claude AI engine
// Calls the Anthropic API with live weather + stats + settings
// and returns structured JSON for the decision banner, advisory,
// dispatch plan, and decision tree reasoning.
// -------------------------------------------------------------
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

function useClaudeAI(weather, stats, aiSettings, hardware, enabled = true) {
  const [claudeData, setClaudeData] = useState(null);
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [claudeError, setClaudeError] = useState(null);
  const lastFetchRef = useRef(0);

  const fetchDecision = useCallback(async () => {
    if (!enabled || !stats || !aiSettings) return;

    // Throttle: only re-call Claude every 60 seconds
    const now = Date.now();
    if (now - lastFetchRef.current < 60000) return;
    lastFetchRef.current = now;

    setClaudeLoading(true);
    setClaudeError(null);

    const currentHour = new Date().getHours();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Build a rich context snapshot for Claude
    const context = {
      time: timeStr,
      hour: currentHour,
      location: hardware?.gasUtility || 'Unknown location',
      weather: weather?.current ? {
        temperature_f: Math.round(weather.current.temperature_2m),
        cloud_cover_pct: weather.current.cloud_cover,
        solar_irradiance_wm2: weather.current.shortwave_radiation,
        wind_mph: weather.current.wind_speed_10m,
        condition: weather.current.weather_code,
      } : null,
      forecast_7day: weather?.daily ? weather.daily.time.map((t, i) => ({
        date: t,
        max_f: Math.round(weather.daily.temperature_2m_max[i]),
        min_f: Math.round(weather.daily.temperature_2m_min[i]),
        radiation_mj: weather.daily.shortwave_radiation_sum[i]?.toFixed(1),
        precip_mm: weather.daily.precipitation_sum[i],
      })) : [],
      system: {
        solar_array_kw: hardware?.solarKw,
        battery_kwh: hardware?.batteryKwh,
        battery_soc_pct: stats.battSoc,
        solar_now_kw: stats.solarKw,
        demand_now_kw: stats.demandKw,
        export_now_kw: stats.exportKw,
        grid_price_per_kwh: stats.gridPrice,
        surplus_kw: stats.surplus,
      },
      ai_settings: {
        strategy: aiSettings.strategy,
        battery_reserve_pct: aiSettings.batteryReserve,
        sell_threshold: aiSettings.sellThreshold,
        buy_threshold: aiSettings.buyThreshold,
        peak_start_hour: aiSettings.peakStart,
        peak_end_hour: aiSettings.peakEnd,
      },
    };

    const prompt = `You are the AI engine for EnergyWatch, a residential solar-plus-storage energy management system. 
Analyze the current system state and produce an energy dispatch decision.

CURRENT SYSTEM SNAPSHOT:
${JSON.stringify(context, null, 2)}

Respond ONLY with a valid JSON object (no markdown, no preamble) with this exact structure:
{
  "decision": "Sell" | "Buy" | "Charge" | "Discharge" | "Hold" | "Consume",
  "headline": "Short 3-5 word action phrase (e.g. 'Selling surplus to grid')",
  "reasoning": "2-3 sentence natural language explanation of why this decision was made right now, referencing actual data values",
  "confidence": 0-100,
  "revenue_per_hr": "$X.XX/hr gained or saved (or null)",
  "key_factors": ["factor 1", "factor 2", "factor 3"],
  "advisory": {
    "title": "Short advisory title based on 7-day forecast",
    "body": "2-3 sentence strategic recommendation based on the forecast data",
    "action": "PRE_CHARGE" | "SELL_AHEAD" | "CONSERVE" | "HOLD",
    "estimated_savings": "$X.XX"
  },
  "dispatch_next_6h": [
    { "hour": "HH:00", "action": "Sell|Buy|Charge|Discharge|Hold|Consume", "reason": "brief reason" }
  ],
  "tree_checks": [
    { "label": "check description with actual values", "pass": true|false, "detail": "value" }
  ]
}

Make dispatch_next_6h start from hour ${currentHour} and cover the next 6 hours.
Make tree_checks cover: grid price vs threshold, solar surplus, battery SoC vs reserve, peak window, weather outlook.
Be specific — use real numbers from the snapshot in your reasoning.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      const text = data.content?.map(c => c.text || '').join('') || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setClaudeData(parsed);
    } catch (e) {
      console.error('Claude API error:', e);
      setClaudeError(e.message);
    } finally {
      setClaudeLoading(false);
    }
  }, [weather, stats, aiSettings, hardware, enabled]);

  // Fetch on mount and every 60s
  useEffect(() => {
    fetchDecision();
    const id = setInterval(fetchDecision, 60000);
    return () => clearInterval(id);
  }, [fetchDecision]);

  return { claudeData, claudeLoading, claudeError, refresh: fetchDecision };
}
function useLocalTime(timezone) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const formatted = time.toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: timezone || undefined
  });
  const hour = timezone
    ? parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }), 10)
    : time.getHours();
  return { formatted, hour };
}

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

  // AI settings — persisted to localStorage so they survive page reloads
  const [aiSettings, setAiSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('ew_ai_settings');
      return saved ? { ...DEFAULT_AI_SETTINGS, ...JSON.parse(saved) } : DEFAULT_AI_SETTINGS;
    } catch { return DEFAULT_AI_SETTINGS; }
  });

  // Hardware profile — persisted to localStorage
  const [hardware, setHardware] = useState(() => {
    try {
      const saved = localStorage.getItem('ew_hardware');
      return saved ? { ...DEFAULT_HARDWARE, ...JSON.parse(saved) } : DEFAULT_HARDWARE;
    } catch { return DEFAULT_HARDWARE; }
  });

  const updateHardware = useCallback((patch) => {
    setHardware(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem('ew_hardware', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const updateAiSettings = useCallback((patch) => {
    setAiSettings(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem('ew_ai_settings', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

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
            aiSettings={aiSettings}
            hardware={hardware}
            timezone={weather?.timezone}
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
        {activeTab === 'sources' && <EnergySources aiSettings={aiSettings} hardware={hardware} />}
        {activeTab === 'ai' && <AIDecisions aiSettings={aiSettings} hardware={hardware} weather={weather} />}
        {activeTab === 'forecast' && <ForecastPanel weather={weather} user={user} />}
        {activeTab === 'settings' && (
          <SettingsPanel
            user={user}
            onUpdateLocation={handleLocationSet}
            onShowLocation={() => setShowLocationPrompt(true)}
            aiSettings={aiSettings}
            onAiSettingsChange={updateAiSettings}
            hardware={hardware}
            onHardwareChange={updateHardware}
            isDemo={api.token === 'DEMO_TOKEN'}
            onNotify={(n) => {
              if (api.token === 'DEMO_TOKEN') {
                setNotifications(prev => [{ id: Date.now(), ...n, read: false, reverted: false, prev_state: null, new_state: null, created_at: new Date().toISOString() }, ...prev]);
                return;
              }
              api.createNotification(n).then(loadNotifications).catch(() => {});
            }}
            onPasswordChange={async (currentPassword, newPassword) => {
              if (api.token === 'DEMO_TOKEN') {
                showToast('Password change not available in demo mode', 'info');
                return { ok: false };
              }
              try {
                await api.changePassword({ currentPassword, newPassword });
                api.createNotification({
                  type: 'info',
                  title: 'Password changed',
                  body: 'Your account password was updated successfully. A confirmation email has been sent.',
                  action: 'SECURITY'
                }).then(loadNotifications).catch(() => {});
                showToast('Password updated — check your email for confirmation', 'success');
                return { ok: true };
              } catch (e) {
                showToast(e.message || 'Password change failed', 'error');
                return { ok: false, error: e.message };
              }
            }}
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
      <ClaudeChat user={user} weather={weather} aiSettings={aiSettings} hardware={hardware} />
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
              <StatTile label="Avg savings" value={`$${Math.round(DEFAULT_HARDWARE.solarKw * 12.4)}`} sub="per month est." />
              <StatTile label="Grid sellback" value={`${Math.round(DEFAULT_HARDWARE.solarKw * 0.88 * 5.2 * 30 * 0.4)}`} sub="kWh / mo est." />
              <StatTile label="CO₂ offset" value={`${((DEFAULT_HARDWARE.solarKw * 0.88 * 5.2 * 30 * 0.4 * 12 * 0.386) / 1000).toFixed(1)}`} sub="tons / yr est." />
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
                    pip install flask pyjwt &amp;&amp; python app.py
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
function Dashboard({ user, weather, weatherLoading, aiSettings, hardware, timezone, onAdvisoryApprove }) {
  const s = aiSettings;
  const { formatted: localTime, hour: localHour } = useLocalTime(timezone);

  const stats = useSystemStats(aiSettings, hardware, localHour);
  const { claudeData, claudeLoading, claudeError, refresh } = useClaudeAI(weather, stats, aiSettings, hardware);
  const strategyConfig = {
    aggressive:     { label: 'Selling to grid',       action: 'earning money',      color: '#ef4444' },
    balanced:       { label: 'Balanced mode',          action: 'saving and selling', color: '#22c55e' },
    self_sufficient:{ label: 'Self-sufficient mode',   action: 'staying off-grid',   color: '#3b82f6' },
  };
  const sc = strategyConfig[s.strategy] || strategyConfig.balanced;

  const hourlyData = useMemo(() => {
    const hours = [];
    const mults = { aggressive:{solarMult:1.0,battMult:0.87}, balanced:{solarMult:0.85,battMult:0.92}, self_sufficient:{solarMult:0.75,battMult:0.98} }[s.strategy] || {solarMult:0.85,battMult:0.92};
    for (let h = 0; h < 24; h++) {
      const solar  = +(Math.max(0, Math.sin((h - 6) * Math.PI / 12)) * hardware.solarKw * 0.88 * mults.solarMult).toFixed(2);
      const demand = +(1.2 + Math.sin(h * 0.5) * 0.6 + (h > 17 && h < 22 ? 2.5 : 0)).toFixed(2);
      const inPeak = h >= s.peakStart && h < s.peakEnd;
      const price  = +(0.08 + Math.sin((h - 14) * Math.PI / 12) * 0.06 + (inPeak ? 0.08 : 0)).toFixed(3);
      const battery = +(Math.max(s.batteryReserve, 40 + Math.sin(h * 0.3) * 30 * mults.battMult + h * 1.2)).toFixed(1);
      hours.push({ hour: `${String(h).padStart(2,'0')}:00`, h, solar, demand, price, battery });
    }
    return hours;
  }, [s.strategy, s.batteryReserve, s.peakStart, s.peakEnd, hardware.solarKw]);

  const now = hourlyData[localHour] || hourlyData[0];
  const greeting = localHour < 12 ? 'Good morning' : localHour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user.name?.split(' ')[0] || user.email?.split('@')[0];

  const currentTemp = weather?.current?.temperature_2m;
  const currentCloud = weather?.current?.cloud_cover;
  const currentCode = weather?.current?.weather_code;
  const revenueStr = stats.revenuePerHr > 0 ? `+$${stats.revenuePerHr}/hr` : '—';

  return (
    <div className="space-y-6">
      {/* Simulated data notice */}
      <div className="flex items-center gap-3 px-5 py-3 rounded-2xl fade-up" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
          <AlertCircle size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold" style={{ color: '#1e40af' }}>Demo · Simulated hardware data</span>
          <span className="text-sm ml-2" style={{ color: 'rgba(26,46,37,0.6)' }}>Readings are modeled from real Open-Meteo weather for your location. In production, live data would come from your inverter, battery, and meter APIs.</span>
        </div>
        <div className="chip flex-shrink-0" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#3b82f6' }} />Physics model
        </div>
      </div>

      <div className="fade-up">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="label-caps mb-2">{greeting}, {firstName}</p>
            <h1 className="serif text-5xl" style={{ color: '#1a2e25' }}>
              Your home is <span className="shimmer-text font-semibold">{sc.action}</span>
            </h1>
            <p className="mt-2 text-base" style={{ color: 'rgba(26, 46, 37, 0.65)' }}>
              {sc.label} · {stats.exportKw} kW exported · making <span className="font-semibold" style={{ color: '#16a34a' }}>{revenueStr}</span>
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="chip" style={{ background: 'rgba(255, 255, 255, 0.7)', color: '#1a2e25' }}>
              <Clock size={12} /> {localTime}{timezone && <span style={{ opacity: 0.5, marginLeft: 4, fontSize: 10 }}>{timezone.split('/')[1]?.replace('_', ' ') || timezone}</span>}
            </div>
            <div className="chip" style={{ background: `${sc.color}15`, color: sc.color }}>
              <Cpu size={12} /> {s.strategy === 'aggressive' ? 'Aggressive' : s.strategy === 'balanced' ? 'Balanced' : 'Self-sufficient'}
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

      <AIDecisionBanner weather={weather} aiSettings={aiSettings} stats={stats} claudeData={claudeData} claudeLoading={claudeLoading} onRefresh={refresh} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-up" style={{ animationDelay: '0.1s' }}>
        <MetricCard label="Solar generation" value={stats.solarKw} unit="kW" trend="+12.4%" trendUp icon={<Sun />} accent="#f59e0b" subtext={`Array: ${hardware.solarKw} kW · ${Math.round(stats.solarKw/hardware.solarKw*100)}% capacity`} />
        <MetricCard label="Home demand"      value={stats.demandKw} unit="kW" trend="−3.2%" icon={<Home />} accent="#3b82f6" subtext="HVAC, lighting, appliances" />
        <MetricCard label="Battery reserve"  value={stats.battSoc} unit="%" trend={stats.battSoc > 90 ? 'Full' : 'Charging'} trendUp icon={<Battery />} accent="#22c55e" subtext={`${stats.battKwh} / ${hardware.batteryKwh} kWh · min ${s.batteryReserve}%`} />
        <MetricCard label="Grid export"      value={stats.exportKw} unit="kW" trend={stats.revenuePerHr > 0 ? `+$${stats.revenuePerHr}/hr` : '—'} trendUp={stats.exportKw > 0} icon={<ArrowUpFromLine />} accent="#ef4444" subtext={stats.exportKw > 0 ? `$${stats.gridPrice}/kWh · selling` : 'Below threshold'} />
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
          <PowerFlowDiagram stats={stats} hardware={hardware} />
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
            <PriceStat label="Now" value={`$${stats.gridPrice}`} color={stats.gridPrice >= s.sellThreshold ? '#16a34a' : '#64748b'} />
            <PriceStat label="Sell floor" value={`$${s.sellThreshold}`} color="#ef4444" />
            <PriceStat label="Off-peak" value="$0.074" color="#64748b" />
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

        <SavingsCard stats={stats} />
      </div>

      <AdvisoryCard weather={weather} onApprove={onAdvisoryApprove} claudeData={claudeData} claudeLoading={claudeLoading} />
    </div>
  );
}

/* ============== AI DECISION BANNER ============== */
function AIDecisionBanner({ weather, aiSettings, stats, claudeData, claudeLoading, onRefresh }) {
  const s = aiSettings;
  const sv = stats ?? {};
  const cloud = weather?.current?.cloud_cover ?? 8;
  const aboveThreshold = (sv.gridPrice || 0) >= s.sellThreshold;

  // Use Claude's response if available, fall back to rule-based
  const decision = claudeData?.decision || (aboveThreshold && sv.surplus > 0 ? 'Sell' : 'Hold');
  const headline = claudeData?.headline || (aboveThreshold ? 'Selling to the grid' : 'Holding position');
  const reasoning = claudeData?.reasoning || `Grid price $${sv.gridPrice} vs threshold $${s.sellThreshold}. Solar surplus ${sv.surplus} kW. Battery at ${sv.battSoc}%.`;
  const confidence = claudeData?.confidence ?? (aboveThreshold && sv.surplus > 0 ? 94 : 72);
  const revenuePerHr = claudeData?.revenue_per_hr || (sv.revenuePerHr > 0 ? `+$${sv.revenuePerHr}/hr` : '—');
  const keyFactors = claudeData?.key_factors || [`Solar: ${sv.solarKw} kW`, `Price: $${sv.gridPrice}`, `Battery: ${sv.battSoc}%`];

  const decisionColor = {
    Sell: '#ef4444', Buy: '#64748b', Charge: '#22c55e',
    Discharge: '#22c55e', Hold: '#f59e0b', Consume: '#3b82f6'
  }[decision] || '#22c55e';

  const decisionChipBg = {
    Sell: 'rgba(239,68,68,0.15)', Buy: 'rgba(100,116,139,0.15)', Charge: 'rgba(34,197,94,0.15)',
    Discharge: 'rgba(34,197,94,0.15)', Hold: 'rgba(245,158,11,0.15)', Consume: 'rgba(59,130,246,0.15)'
  }[decision] || 'rgba(34,197,94,0.15)';

  return (
    <div className="card-dark p-7 relative overflow-hidden fade-up" style={{ animationDelay: '0.05s' }}>
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30" style={{ background: decisionColor }} />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl opacity-20" style={{ background: '#22c55e' }} />

      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="chip" style={{ background: 'rgba(167,243,208,0.12)', color: '#a7f3d0' }}>
              <Cpu size={12} /> {claudeData ? 'Claude AI' : 'Rule engine'} · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="chip" style={{ background: decisionChipBg, color: decisionColor }}>
              <div className="w-1.5 h-1.5 rounded-full pulse-soft" style={{ background: decisionColor }} />
              {decision}
            </div>
            {claudeLoading && (
              <div className="chip" style={{ background: 'rgba(167,243,208,0.1)', color: '#a7f3d0' }}>
                <Loader2 size={11} className="animate-spin" /> Thinking…
              </div>
            )}
          </div>
          <h2 className="serif text-5xl mb-3">
            {headline}<span style={{ color: '#a7f3d0' }}>.</span>
          </h2>
          <p className="text-base leading-relaxed" style={{ color: 'rgba(240,245,242,0.8)' }}>
            {reasoning}
          </p>
          <button onClick={onRefresh}
            className="mt-4 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(167,243,208,0.1)', color: '#a7f3d0', border: '1px solid rgba(167,243,208,0.15)' }}>
            <RotateCcw size={11} /> Ask Claude again
          </button>
        </div>

        <div className="lg:col-span-3 grid grid-cols-3 lg:grid-cols-1 gap-3">
          <MiniStat label="Confidence" value={`${confidence}%`} color={confidence > 80 ? '#a7f3d0' : '#fde68a'} />
          <MiniStat label="Grid price" value={`$${sv.gridPrice || '—'}`} color={aboveThreshold ? '#a7f3d0' : '#fde68a'} />
          <MiniStat label="Impact" value={revenuePerHr} color="#a7f3d0" />
        </div>

        <div className="lg:col-span-4 p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(167,243,208,0.1)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#a7f3d0' }}>
              {claudeData ? 'Claude\'s reasoning' : 'Rule-based factors'}
            </p>
            {claudeData && (
              <div className="chip" style={{ background: 'rgba(167,243,208,0.1)', color: '#a7f3d0', padding: '2px 8px', fontSize: '10px' }}>
                <Sparkles size={10} /> Claude
              </div>
            )}
          </div>
          <div className="space-y-2 text-sm" style={{ color: 'rgba(240,245,242,0.85)' }}>
            {keyFactors.map((f, i) => <ReasonItem key={i} text={f} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== ADVISORY ============== */
function AdvisoryCard({ weather, onApprove, claudeData, claudeLoading }) {
  // Use Claude's advisory if available, otherwise fall back to weather-based rule
  const advisory = useMemo(() => {
    if (claudeData?.advisory) {
      return {
        title: claudeData.advisory.title,
        body: claudeData.advisory.body,
        savings: claudeData.advisory.estimated_savings || '+$42.10',
        action: claudeData.advisory.action || 'PRE_CHARGE',
        fromClaude: true,
      };
    }
    const daily = weather?.daily;
    if (!daily?.time?.length) {
      return { title: 'Pre-charge battery ahead of cloudy stretch', body: 'The AI recommends topping the battery to 100% on the next off-peak window to cover low-solar periods.', savings: '+$42.10', action: 'PRE_CHARGE' };
    }
    let worstIdx = 0, worst = Infinity;
    daily.shortwave_radiation_sum?.forEach((v, i) => { if (v != null && v < worst) { worst = v; worstIdx = i; } });
    const day = new Date(daily.time[worstIdx]).toLocaleDateString(undefined, { weekday: 'long' });
    const dropPct = Math.round((1 - worst / (Math.max(...daily.shortwave_radiation_sum))) * 100);
    return { title: `${day} looks overcast — pre-charge battery`, body: `Projected ${dropPct}% reduction in solar yield. Recommend pre-charging to 100% the night before using off-peak rates.`, savings: '+$42.10', action: 'PRE_CHARGE', day };
  }, [claudeData, weather]);

  const handleApprove = () => {
    onApprove({
      type: 'advisory',
      title: `Approved: ${advisory.title}`,
      body: `Plan engaged. ${advisory.body} Expected savings: ${advisory.savings}.`,
      action: advisory.action,
      prev_state: { battery_target: 80, mode: 'normal' },
      new_state: { battery_target: 100, mode: 'pre_charge_night' }
    });
  };

  return (
    <div className="card-dark p-7 relative overflow-hidden fade-up" style={{ animationDelay: '0.4s' }}>
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30" style={{ background: '#fde68a' }} />
      <div className="relative flex items-start gap-5 flex-wrap">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(253,230,138,0.15)', border: '1px solid rgba(253,230,138,0.3)' }}>
          {claudeLoading ? <Loader2 size={22} className="animate-spin" style={{ color: '#fde68a' }} /> : <AlertCircle size={22} style={{ color: '#fde68a' }} />}
        </div>
        <div className="flex-1 min-w-[280px]">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#fde68a' }}>Strategic advisory</p>
            {advisory.fromClaude && (
              <div className="chip" style={{ background: 'rgba(253,230,138,0.12)', color: '#fde68a', padding: '2px 8px', fontSize: '10px' }}>
                <Sparkles size={10} /> Claude AI
              </div>
            )}
          </div>
          <h3 className="serif text-3xl mb-2">{claudeLoading ? 'Claude is analyzing your forecast…' : advisory.title}</h3>
          <p className="text-base leading-relaxed" style={{ color: 'rgba(240,245,242,0.8)' }}>
            {claudeLoading ? 'Reviewing 7-day solar irradiance, pricing signals, and your battery schedule to generate a personalized recommendation.' : `${advisory.body} Projected savings vs. reactive strategy: `}
            {!claudeLoading && <b style={{ color: '#a7f3d0' }}>{advisory.savings}</b>}
            {!claudeLoading && '.'}
          </p>
          {!claudeLoading && (
            <div className="flex gap-3 mt-5 flex-wrap">
              <button onClick={handleApprove} className="btn-primary">Approve plan</button>
              <button className="px-6 py-3.5 rounded-xl font-semibold text-sm" style={{ background: 'rgba(255,255,255,0.08)', color: '#f0f5f2', border: '1px solid rgba(255,255,255,0.15)' }}>Modify</button>
            </div>
          )}
          <p className="text-xs mt-3" style={{ color: 'rgba(240,245,242,0.5)' }}>
            {advisory.fromClaude ? 'Generated by Claude · ' : ''}Approving logs the change to your notification center — you can revert it anytime.
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

function ReasonItem({ text, pass = true }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: pass ? 'rgba(167, 243, 208, 0.15)' : 'rgba(253, 230, 138, 0.15)' }}>
        <Check size={10} style={{ color: pass ? '#a7f3d0' : '#fde68a' }} strokeWidth={3} />
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

/* ============== SAVINGS CARD ============== */
function SavingsCard({ stats }) {
  return (
    <div className="card-dark p-7 relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl" style={{ background: 'rgba(167, 243, 208, 0.4)' }} />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#a7f3d0' }}>Month-to-date</p>
        <h3 className="serif text-3xl mb-6">Savings report</h3>
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'rgba(240, 245, 242, 0.6)' }}>Total saved</p>
          <div className="serif text-6xl" style={{ color: '#a7f3d0' }}>${stats.totalSaved.toFixed(2)}</div>
          <div className="text-sm mt-2 flex items-center gap-1.5" style={{ color: 'rgba(240, 245, 242, 0.8)' }}>
            <TrendingUp size={14} style={{ color: '#a7f3d0' }} />
            <span>Est. based on your <span style={{ color: '#a7f3d0' }} className="font-semibold">{stats.monthlyExportKwh} kWh</span> export</span>
          </div>
        </div>
        <div className="space-y-1">
          <SavingsRow label="Grid sellback"     value={`+$${stats.sellback.toFixed(2)}`}     positive />
          <SavingsRow label="Self-consumption"  value={`+$${stats.selfConsume.toFixed(2)}`}  positive />
          <SavingsRow label="Peak shaving"      value={`+$${stats.peakShave.toFixed(2)}`}    positive />
          <SavingsRow label="Demand charges"    value={`−$${stats.demandCharge.toFixed(2)}`} />
        </div>
        <div className="mt-6 pt-5 border-t flex items-center gap-2.5" style={{ borderColor: 'rgba(167, 243, 208, 0.15)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(167, 243, 208, 0.12)' }}>
            <Leaf size={16} style={{ color: '#a7f3d0' }} />
          </div>
          <div className="text-sm" style={{ color: 'rgba(240, 245, 242, 0.85)' }}>
            Equal to <b style={{ color: '#a7f3d0' }}>{stats.treesThisMonth} trees</b> planted this month
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== POWER FLOW ============== */
function PowerFlowDiagram({ stats, hardware }) {
  const sv = stats ?? { solarKw: 0, exportKw: 0, demandKw: 0, battSoc: 0, battKwh: 0, gridPrice: 0 };
  const hw = hardware ?? DEFAULT_HARDWARE;
  return (
    <svg viewBox="0 0 700 320" className="w-full">
      <defs>
        <linearGradient id="fl1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#22c55e" /></linearGradient>
        <linearGradient id="fl2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient>
        <linearGradient id="fl3" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#ef4444" /></linearGradient>
      </defs>
      <path d="M 155 90 Q 250 90 350 170" stroke="url(#fl1)" strokeWidth="3" fill="none" className="flow-line" strokeLinecap="round" />
      <path d="M 155 230 Q 250 230 350 170" stroke="#cbd5e1" strokeWidth="2" fill="none" strokeDasharray="4 5" opacity="0.5" strokeLinecap="round" />
      <path d="M 350 170 Q 450 170 545 90" stroke="url(#fl3)" strokeWidth={sv.exportKw > 0 ? "3" : "1.5"} fill="none" className={sv.exportKw > 0 ? "flow-line" : ""} strokeLinecap="round" opacity={sv.exportKw > 0 ? 1 : 0.3} />
      <path d="M 350 170 Q 450 170 545 230" stroke="url(#fl2)" strokeWidth="3" fill="none" className="flow-line" strokeLinecap="round" />
      <FlowNode x={90}  y={90}  label="SOLAR"     value={`${sv.solarKw} kW`} color="#f59e0b" icon="sun" />
      <FlowNode x={90}  y={230} label="GRID"      value={sv.exportKw > 0 ? 'Idle' : 'Importing'} color="#94a3b8" icon="grid" dim={sv.exportKw > 0} />
      <FlowNode x={350} y={170} label="AI ROUTER" value="Optimizing" color="#22c55e" icon="cpu" big />
      <FlowNode x={610} y={90}  label="EXPORT"    value={sv.exportKw > 0 ? `${sv.exportKw} kW` : 'Idle'} color="#ef4444" icon="export" dim={sv.exportKw === 0} />
      <FlowNode x={610} y={230} label="HOME"      value={`${sv.demandKw} kW`} color="#3b82f6" icon="home" />
      <g transform="translate(350, 260)">
        <rect x="-70" y="0" width="140" height="32" rx="16" fill="white" stroke="#22c55e" strokeWidth="1.5" />
        <rect x="-66" y="4" width={`${Math.round(121 * sv.battSoc / 100)}`} height="24" rx="12" fill="url(#fl1)" opacity="0.85" />
        <text x="0" y="21" textAnchor="middle" fill="#1a2e25" fontSize="12" fontWeight="700">Battery · {sv.battSoc}%</text>
      </g>
      <g className="mono">
        <rect x="200" y="115" width="100" height="22" rx="11" fill="white" stroke="#e5e7eb" strokeWidth="1" />
        <text x="250" y="130" textAnchor="middle" fill="#16a34a" fontSize="11" fontWeight="700">→ {sv.solarKw} kW</text>
        <rect x="400" y="115" width="130" height="22" rx="11" fill="white" stroke="#e5e7eb" strokeWidth="1" />
        <text x="465" y="130" textAnchor="middle" fill={sv.exportKw > 0 ? "#ef4444" : "#94a3b8"} fontSize="11" fontWeight="700">{sv.exportKw > 0 ? `→ ${sv.exportKw} kW · $${sv.gridPrice}` : '→ holding'}</text>
        <rect x="410" y="205" width="100" height="22" rx="11" fill="white" stroke="#e5e7eb" strokeWidth="1" />
        <text x="460" y="220" textAnchor="middle" fill="#3b82f6" fontSize="11" fontWeight="700">→ {sv.demandKw} kW</text>
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
function EnergySources({ aiSettings, hardware }) {
  const { hour } = useLocalTime();
  const stats = useSystemStats(aiSettings, hardware, hour);
  const hw = hardware ?? DEFAULT_HARDWARE;

  // Daily kWh estimates (solar model summed over daylight hours)
  const dailySolarKwh = +(hw.solarKw * 0.88 * 5.2).toFixed(1); // ~5.2 peak sun hours
  const dailyBattKwh  = +(hw.batteryKwh * 0.6).toFixed(1);
  const dailyGridKwh  = +(dailySolarKwh * 0.14).toFixed(1);
  const dailyGasKwh   = +(hw.batteryKwh * 0.04).toFixed(1);

  const sources = [
    { name: 'Solar PV',     percent: stats.solarPercent,  kwh: dailySolarKwh, icon: <Sun />,     color: '#f59e0b', status: stats.solarKw > 0 ? `${stats.solarKw} kW now` : 'Offline (night)' },
    { name: 'Battery',      percent: stats.battPercent,   kwh: dailyBattKwh,  icon: <Battery />, color: '#22c55e', status: `${stats.battSoc}% charged` },
    { name: 'Grid (mixed)', percent: stats.gridPercent,   kwh: dailyGridKwh,  icon: <Zap />,     color: '#64748b', status: stats.exportKw > 0 ? 'Exporting' : 'On standby' },
    { name: 'Natural gas',  percent: 4,                   kwh: dailyGasKwh,   icon: <Flame />,   color: '#ef4444', status: hw.gasUtility },
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
          <DeviceCard name="HVAC" load={`${stats.hvacLoad} kW`} percent={Math.round(stats.hvacLoad / stats.demandKw * 100)} source="Solar" color="#f59e0b" />
          <DeviceCard name="EV charger" load={stats.evLoad > 0 ? `${stats.evLoad} kW` : '0.00 kW'} percent={stats.evLoad > 0 ? Math.round(stats.evLoad / stats.demandKw * 100) : 0} source={stats.evLoad > 0 ? 'Charging' : 'Idle'} color={stats.evLoad > 0 ? '#22c55e' : '#94a3b8'} />
          <DeviceCard name="Water heater" load={`${stats.waterLoad} kW`} percent={Math.round(stats.waterLoad / stats.demandKw * 100)} source="Nat. gas" color="#ef4444" />
          <DeviceCard name="Appliances" load={`${stats.appLoad} kW`} percent={Math.round(stats.appLoad / stats.demandKw * 100)} source="Solar" color="#f59e0b" />
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
function AIDecisions({ aiSettings, hardware, weather }) {
  const { hour: localHour } = useLocalTime();
  const [tick, setTick] = useState(0);
  const stats = useSystemStats(aiSettings, hardware, localHour);
  const { claudeData, claudeLoading, claudeError, refresh } = useClaudeAI(weather, stats, aiSettings, hardware);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const nextReview = 30 - (now.getSeconds() % 30);

  const models = [
    { name: 'Price forecasting', version: 'v3.2', accuracy: 94.2, status: 'Active', desc: 'LSTM trained on ISO-wholesale and retail tariff data' },
    { name: 'Weather synthesis', version: 'v2.8', accuracy: 89.7, status: 'Active', desc: 'Ensemble of NOAA GFS, HRRR, and local irradiance sensors' },
    { name: 'Load prediction',   version: 'v4.1', accuracy: 96.1, status: 'Active', desc: 'XGBoost on 90-day occupancy and device-level patterns' },
    { name: 'Claude Sonnet',     version: 'claude-sonnet-4', accuracy: '—', status: claudeLoading ? 'Thinking…' : claudeData ? 'Active' : 'Standby', desc: 'Natural language reasoning over all signals — produces decisions, advisories, and dispatch plans.' },
  ];

  return (
    <div className="space-y-6">
      <div className="fade-up">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="label-caps mb-2">AI decision engine</p>
            <h2 className="serif text-5xl" style={{ color: '#1a2e25' }}>The brain behind every watt</h2>
            <p className="text-base mt-3 max-w-3xl" style={{ color: 'rgba(26,46,37,0.65)' }}>
              Three specialized models plus Claude Sonnet synthesize weather, pricing, and load signals into optimal dispatch decisions every 30 seconds.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="chip" style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}>
              <div className="w-1.5 h-1.5 rounded-full pulse-soft" style={{ background: '#22c55e' }} />
              Live · next update in {nextReview}s
            </div>
            <button onClick={refresh} disabled={claudeLoading}
              className="chip flex items-center gap-1.5 transition-all"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309', border: '1px solid rgba(245,158,11,0.2)', cursor: 'pointer' }}>
              {claudeLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {claudeLoading ? 'Asking Claude…' : 'Ask Claude now'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 fade-up" style={{ animationDelay: '0.1s' }}>
        {models.map((m, i) => (
          <div key={m.name} className="card p-5" style={{ border: i === 3 ? '1.5px solid rgba(245,158,11,0.3)' : undefined }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: i === 3 ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', color: i === 3 ? '#f59e0b' : '#16a34a' }}>
                {i === 3 ? <Sparkles size={18} /> : <Cpu size={18} />}
              </div>
              <span className="chip" style={{ background: m.status === 'Thinking…' ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', color: m.status === 'Thinking…' ? '#b45309' : '#16a34a' }}>
                {m.status === 'Thinking…' ? <Loader2 size={10} className="animate-spin" /> : <div className="w-1.5 h-1.5 rounded-full pulse-soft" style={{ background: m.status === 'Active' ? '#22c55e' : '#94a3b8' }} />}
                {m.status}
              </span>
            </div>
            <p className="label-caps">{m.name}</p>
            <p className="text-xs mt-0.5 mono" style={{ color: 'rgba(26,46,37,0.5)' }}>{m.version}</p>
            {m.accuracy !== '—' ? (
              <>
                <div className="serif text-5xl mt-4" style={{ color: '#1a2e25' }}>{m.accuracy}<span className="text-xl">%</span></div>
                <p className="label-caps mt-1">7-day accuracy</p>
              </>
            ) : (
              <>
                <div className="serif text-3xl mt-4" style={{ color: '#1a2e25' }}>
                  {claudeData ? `${claudeData.confidence}%` : '—'}
                </div>
                <p className="label-caps mt-1">{claudeData ? 'Current confidence' : 'Awaiting response'}</p>
              </>
            )}
            <p className="text-xs mt-3 pt-3 border-t leading-relaxed" style={{ borderColor: 'rgba(26,46,37,0.08)', color: 'rgba(26,46,37,0.65)' }}>{m.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 fade-up" style={{ animationDelay: '0.2s' }}>
        <div className="card p-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="label-caps">72h projected actions</p>
              <h3 className="serif text-3xl mt-1" style={{ color: '#1a2e25' }}>Planned dispatch</h3>
            </div>
            <div className="flex items-center gap-2">
              {claudeData?.dispatch_next_6h && (
                <div className="chip" style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309', fontSize: '10px' }}>
                  <Sparkles size={10} /> Claude
                </div>
              )}
              <div className="text-xs mono" style={{ color: 'rgba(26,46,37,0.45)' }}>
                From {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
          <DispatchPlan aiSettings={aiSettings} currentHour={localHour} claudeDispatch={claudeData?.dispatch_next_6h} />
        </div>

        <div className="card p-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="label-caps">Current reasoning</p>
              <h3 className="serif text-3xl mt-1" style={{ color: '#1a2e25' }}>Decision tree</h3>
            </div>
            <div className="flex items-center gap-2">
              {claudeData?.tree_checks && (
                <div className="chip" style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309', fontSize: '10px' }}>
                  <Sparkles size={10} /> Claude
                </div>
              )}
              <div className="text-xs mono" style={{ color: 'rgba(26,46,37,0.45)' }}>
                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>
          <DecisionTree aiSettings={aiSettings} currentHour={localHour} nextReview={nextReview} claudeData={claudeData} claudeLoading={claudeLoading} />
        </div>
      </div>
    </div>
  );
}

// Pure function — compute price at any given hour based on user's AI settings
function computePrice(h, aiSettings) {
  const inPeak = h >= aiSettings.peakStart && h < aiSettings.peakEnd;
  return +(0.08 + Math.sin((h - 14) * Math.PI / 12) * 0.06 + (inPeak ? 0.08 : 0)).toFixed(3);
}

// Pure function — decide what action the AI takes at a given hour
function computeAction(h, aiSettings) {
  const price = computePrice(h, aiSettings);
  const solar = Math.max(0, Math.sin((h - 6) * Math.PI / 12)) * 9.5;
  const demand = 1.2 + Math.sin(h * 0.5) * 0.6 + (h > 17 && h < 22 ? 2.5 : 0);
  const surplus = solar - demand;
  const inPeak = h >= aiSettings.peakStart && h < aiSettings.peakEnd;
  const battSoc = 87; // simulated SoC

  if (aiSettings.strategy === 'self_sufficient') {
    if (surplus > 0 && battSoc < 95) return { action: 'Charge',    color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    reason: 'Filling battery · self-sufficient mode' };
    if (surplus < 0 && battSoc > aiSettings.batteryReserve) return { action: 'Discharge', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  reason: 'Battery → home · avoiding grid' };
    return { action: 'Consume', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', reason: 'Self-consuming solar output' };
  }

  if (price >= aiSettings.sellThreshold && surplus > 0) {
    const kw = surplus.toFixed(1);
    return { action: 'Sell', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', reason: `$${price.toFixed(3)} > threshold · ${kw} kW surplus` };
  }
  if (inPeak && battSoc > aiSettings.batteryReserve) {
    return { action: 'Discharge', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', reason: `Peak window · battery at ${battSoc}%` };
  }
  if (price < aiSettings.buyThreshold && battSoc < 90) {
    return { action: 'Buy', color: '#64748b', bg: 'rgba(100,116,139,0.1)', reason: `$${price.toFixed(3)} < buy threshold · charging battery` };
  }
  if (surplus < 0) {
    return { action: 'Consume', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', reason: 'Demand exceeds generation · grid supplementing' };
  }
  return { action: 'Hold', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', reason: 'Price between thresholds · holding position' };
}

function DispatchPlan({ aiSettings, currentHour, claudeDispatch }) {
  // Build rule-based fallback for hours not covered by Claude
  const ruleRows = useMemo(() => {
    const result = [];
    for (let offset = 0; offset < 18; offset++) {
      const h = (currentHour + offset) % 24;
      const { action, color, bg, reason } = computeAction(h, aiSettings);
      const label = offset === 0 ? `Now · ${String(h).padStart(2,'0')}:00` : `${String(h).padStart(2,'0')}:00`;
      result.push({ label, action, color, bg, reason, isNow: offset === 0, fromClaude: false });
    }
    return result;
  }, [currentHour, aiSettings]);

  // Merge Claude's 6h dispatch over the rule-based rows
  const rows = useMemo(() => {
    if (!claudeDispatch?.length) return ruleRows;
    const claudeMap = {};
    claudeDispatch.forEach(r => { claudeMap[r.hour] = r; });
    return ruleRows.map(r => {
      const hourKey = r.label.replace('Now · ', '');
      const claude = claudeMap[hourKey];
      if (!claude) return r;
      const actionColors = {
        Sell: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
        Buy:  { color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
        Charge: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
        Discharge: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
        Hold: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        Consume: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
      }[claude.action] || { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' };
      return { ...r, action: claude.action, reason: claude.reason, ...actionColors, fromClaude: true };
    });
  }, [ruleRows, claudeDispatch]);

  return (
    <div className="space-y-1 max-h-[420px] overflow-y-auto pr-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-3 p-3 rounded-xl items-center text-sm transition-all"
          style={{ background: r.isNow ? 'rgba(34,197,94,0.06)' : 'transparent', border: r.isNow ? '1px solid rgba(34,197,94,0.15)' : '1px solid transparent' }}>
          <div className="col-span-3 font-medium mono text-xs" style={{ color: r.isNow ? '#16a34a' : 'rgba(26,46,37,0.55)' }}>{r.label}</div>
          <div className="col-span-3 flex items-center gap-1">
            <span className="chip" style={{ background: r.bg, color: r.color, padding: '3px 8px', fontSize: '11px' }}>{r.action}</span>
            {r.fromClaude && <Sparkles size={9} style={{ color: '#f59e0b', flexShrink: 0 }} />}
          </div>
          <div className="col-span-6 text-xs" style={{ color: 'rgba(26,46,37,0.7)' }}>{r.reason}</div>
        </div>
      ))}
    </div>
  );
}

function DecisionTree({ aiSettings, currentHour, nextReview, claudeData, claudeLoading }) {
  const s = aiSettings;
  const price = computePrice(currentHour, s);
  const solar = Math.max(0, Math.sin((currentHour - 6) * Math.PI / 12)) * 9.5;
  const demand = 1.2 + Math.sin(currentHour * 0.5) * 0.6 + (currentHour > 17 && currentHour < 22 ? 2.5 : 0);
  const surplus = +(solar - demand).toFixed(2);
  const battSoc = 87;
  const inPeak = currentHour >= s.peakStart && currentHour < s.peakEnd;

  const { action, color, bg, reason } = computeAction(currentHour, s);
  const confidence = claudeData?.confidence ?? (price >= s.sellThreshold && surplus > 0 ? 94 : 72);
  const revenue = claudeData?.revenue_per_hr || (action === 'Sell' ? `+$${(surplus * price).toFixed(2)}/hr` : '—');
  const decision = claudeData?.decision || action;
  const decisionColor = { Sell: '#ef4444', Buy: '#64748b', Charge: '#22c55e', Discharge: '#22c55e', Hold: '#f59e0b', Consume: '#3b82f6' }[decision] || color;

  const actionIcon = decision === 'Sell' ? <ArrowUpFromLine size={14} style={{ color: decisionColor }} />
    : decision === 'Buy' ? <ArrowDownToLine size={14} style={{ color: decisionColor }} />
    : decision === 'Charge' || decision === 'Discharge' ? <Battery size={14} style={{ color: decisionColor }} />
    : <Activity size={14} style={{ color: decisionColor }} />;

  // Use Claude's checks if available, otherwise rule-based
  const checks = claudeData?.tree_checks || [
    { label: `grid_price ($${price.toFixed(3)}) ≥ sell threshold ($${s.sellThreshold})`, pass: price >= s.sellThreshold, detail: `$${price.toFixed(3)}` },
    { label: `solar_surplus (${surplus > 0 ? '+' : ''}${surplus} kW) > 0`, pass: surplus > 0, detail: `${surplus} kW` },
    { label: `battery_soc (${battSoc}%) > reserve (${s.batteryReserve}%)`, pass: battSoc > s.batteryReserve, detail: `${battSoc}%` },
    { label: `peak_window: ${inPeak ? 'active' : 'inactive'} (${s.peakStart}:00–${s.peakEnd}:00)`, pass: inPeak, detail: inPeak ? 'In peak' : 'Off-peak' },
    { label: 'weather_forecast_ok (next 3h)', pass: true, detail: 'Clear' },
  ];

  if (claudeLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={28} className="animate-spin" style={{ color: '#f59e0b' }} />
        <p className="text-sm font-semibold" style={{ color: '#1a2e25' }}>Claude is reasoning…</p>
        <p className="text-xs text-center max-w-xs" style={{ color: 'rgba(26,46,37,0.55)' }}>Analyzing weather forecast, pricing signals, battery state, and your strategy settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 mb-1">
        <TreeRow depth={0} color="#16a34a" label="Evaluating market signals…" bold />
        {claudeData && <div className="chip ml-auto" style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309', fontSize: '10px', padding: '2px 8px' }}><Sparkles size={9} /> Claude</div>}
      </div>

      {checks.map((c, i) => (
        <TreeRow key={i} depth={1}
          label={c.label}
          pass={c.pass} fail={!c.pass}
          detail={c.detail}
          passColor="#16a34a" failColor="#dc2626" />
      ))}

      <div className="mt-4 p-5 rounded-2xl" style={{ background: `linear-gradient(135deg, ${decisionColor}12, rgba(255,255,255,0))`, borderLeft: `3px solid ${decisionColor}` }}>
        <div className="flex items-center gap-2 mb-2">
          {actionIcon}
          <p className="font-bold text-sm" style={{ color: decisionColor }}>
            Decision · {decision}{decision === 'Sell' ? ` ${surplus > 0 ? surplus : 0} kW to grid` : decision === 'Discharge' ? ' battery → home' : decision === 'Buy' ? ' from grid' : ''}
          </p>
        </div>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: 'rgba(26,46,37,0.65)' }}>
          {claudeData?.reasoning || reason}
        </p>
        <div className="flex items-center gap-4 text-sm flex-wrap" style={{ color: 'rgba(26,46,37,0.75)' }}>
          <span>Confidence <b style={{ color: confidence > 85 ? '#16a34a' : confidence > 65 ? '#f59e0b' : '#ef4444' }}>{confidence}%</b></span>
          <span>Impact <b style={{ color: decisionColor }}>{revenue}</b></span>
          <span>Next review <b>{nextReview}s</b></span>
        </div>
      </div>
    </div>
  );
}

function TreeRow({ depth, label, pass, fail, bold, detail, color, passColor, failColor }) {
  const dotColor = pass ? (passColor || '#16a34a') : fail ? (failColor || '#dc2626') : 'rgba(26,46,37,0.3)';
  return (
    <div className="flex items-center gap-3 text-sm" style={{ paddingLeft: depth * 16 }}>
      {(pass !== undefined || fail !== undefined) && (
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `${dotColor}20`, border: `1.5px solid ${dotColor}` }}>
          {pass && <Check size={10} style={{ color: dotColor }} strokeWidth={3} />}
          {fail && <X size={10} style={{ color: dotColor }} strokeWidth={3} />}
        </div>
      )}
      <span style={{ color: color || (bold ? '#1a2e25' : 'rgba(26,46,37,0.8)'), fontWeight: bold ? 600 : 400, fontSize: '13px' }}>{label}</span>
      {detail && (
        <span className="text-xs mono ml-auto px-2 py-0.5 rounded-md flex-shrink-0"
          style={{ background: pass ? `${passColor || '#16a34a'}12` : fail ? `${failColor || '#dc2626'}12` : 'rgba(26,46,37,0.06)', color: pass ? (passColor || '#16a34a') : fail ? (failColor || '#dc2626') : 'rgba(26,46,37,0.5)' }}>
          {detail}
        </span>
      )}
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
      // Open-Meteo shortwave_radiation_sum is in MJ/m².
      // Convert to estimated kWh output: MJ/m² × 0.2778 (→ kWh/m²) × 11.2 kW array × 0.18 efficiency
      return weather.daily.time.map((t, i) => {
        const mj = weather.daily.shortwave_radiation_sum[i] || 0;
        const kwh = +(mj * 0.2778 * 11.2 * 0.18).toFixed(1);
        return {
          day: new Date(t).toLocaleDateString(undefined, { weekday: 'short' }),
          kwh,
        };
      });
    }
    // Fallback demo data
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
        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} unit=" kWh" />
        <Tooltip
          formatter={(v) => [`${v} kWh`, 'Est. output']}
          contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
        />
        <Bar dataKey="kwh" fill="url(#solarB)" radius={[12, 12, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ============== SETTINGS ============== */
function SettingsPanel({ user, onShowLocation, onUpdateLocation, aiSettings, onAiSettingsChange, hardware, onHardwareChange, isDemo, onNotify, onPasswordChange }) {
  const s = aiSettings;
  const [saved, setSaved] = useState(false);
  const [zipInput, setZipInput] = useState('');
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState(null);

  // Password change state
  const [showPwForm, setShowPwForm] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState(null);

  const handleZipChange = async () => {
    setZipError(null);
    if (!/^\d{5}$/.test(zipInput)) { setZipError('Enter a valid 5-digit zip code.'); return; }
    setZipLoading(true);
    try {
      const g = await api.geocodeZip(zipInput);
      await onUpdateLocation({ lat: g.lat, lon: g.lon, label: g.label, zip: g.zip });
      onNotify({ type: 'info', title: 'Location updated', body: `Location changed to ${g.label} (${g.zip}).`, action: 'LOCATION' });
      setZipInput('');
    } catch (e) { setZipError(e.message || 'Zip code not found.'); }
    finally { setZipLoading(false); }
  };

  const handlePasswordChange = async () => {
    setPwError(null);
    if (!pw.current) { setPwError('Enter your current password.'); return; }
    if (pw.next.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (pw.next !== pw.confirm) { setPwError('New passwords do not match.'); return; }
    setPwLoading(true);
    const result = await onPasswordChange(pw.current, pw.next);
    setPwLoading(false);
    if (result?.ok) { setPw({ current: '', next: '', confirm: '' }); setShowPwForm(false); }
    else if (result?.error) { setPwError(result.error); }
  };

  const handleSaveAI = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onNotify({ type: 'info', title: 'AI settings saved', body: `Strategy: ${s.strategy} · Reserve: ${s.batteryReserve}% · Sell at $${s.sellThreshold}/kWh · Peak ${s.peakStart}:00–${s.peakEnd}:00.`, action: 'SETTINGS' });
  };

  const handleReset = () => {
    onAiSettingsChange({ ...DEFAULT_AI_SETTINGS });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onNotify({ type: 'info', title: 'AI settings reset', body: 'All AI preferences have been restored to defaults.', action: 'SETTINGS' });
  };

  return (
    <div className="space-y-6">
      <div className="fade-up">
        <p className="label-caps mb-2">System · connected account</p>
        <h2 className="serif text-5xl" style={{ color: '#1a2e25' }}>Your setup</h2>
      </div>

      {/* Account + Hardware */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-up" style={{ animationDelay: '0.1s' }}>
        <div className="card p-7 lg:col-span-2">
          <p className="label-caps mb-5">Account</p>
          <div className="space-y-1">
            <SettingRow label="Name" value={user.name || '—'} />
            <SettingRow label="Email" value={user.email} />
            <SettingRow label="Location" value={user.location_label || 'Not set'} action={
              <button onClick={onShowLocation} className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}>
                {user.location_label ? 'Change via GPS' : 'Set location'}
              </button>
            } />
            {user.zip_code && <SettingRow label="Zip code" value={user.zip_code} />}
            {user.latitude && <SettingRow label="Coordinates" value={`${user.latitude.toFixed(3)}, ${user.longitude.toFixed(3)}`} />}
            <SettingRow label="Verification" value="Verified via email" badge="Active" />
          </div>

          {/* Inline zip change */}
          <div className="mt-6 pt-6 border-t" style={{ borderColor: 'rgba(26,46,37,0.08)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#1a2e25' }}>Change location by zip code</p>
            <p className="text-xs mb-3" style={{ color: 'rgba(26,46,37,0.55)' }}>Enter a US zip code to update your weather and solar data.</p>
            <div className="flex gap-2">
              <input value={zipInput} onChange={e => setZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="e.g. 43215"
                className="flex-1 px-4 py-2.5 text-sm rounded-xl"
                style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,46,37,0.12)', color: '#1a2e25' }}
                onKeyDown={e => e.key === 'Enter' && handleZipChange()} />
              <button onClick={handleZipChange} disabled={zipLoading} className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
                {zipLoading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                {zipLoading ? 'Looking up…' : 'Update'}
              </button>
            </div>
            {zipError && <p className="error-text mt-2">{zipError}</p>}
          </div>

          {/* Password change */}
          <div className="mt-6 pt-6 border-t" style={{ borderColor: 'rgba(26,46,37,0.08)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1a2e25' }}>Password</p>
                <p className="text-xs" style={{ color: 'rgba(26,46,37,0.55)' }}>You'll receive a confirmation email when changed.</p>
              </div>
              <button onClick={() => { setShowPwForm(v => !v); setPwError(null); }}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: showPwForm ? 'rgba(239,68,68,0.08)' : 'rgba(26,46,37,0.06)', color: showPwForm ? '#dc2626' : '#1a2e25' }}>
                <KeyRound size={13} /> {showPwForm ? 'Cancel' : 'Change password'}
              </button>
            </div>
            {showPwForm && (
              <div className="space-y-3 mt-4 p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(26,46,37,0.08)' }}>
                {[
                  { key: 'current', label: 'Current password', placeholder: '••••••••' },
                  { key: 'next',    label: 'New password',     placeholder: 'Min 8 characters' },
                  { key: 'confirm', label: 'Confirm new password', placeholder: 'Re-enter new password' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgba(26,46,37,0.7)' }}>{label}</label>
                    <div className="relative">
                      <input
                        type={showPw[key] ? 'text' : 'password'}
                        value={pw[key]}
                        onChange={e => setPw(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full px-4 py-2.5 pr-10 text-sm rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(26,46,37,0.12)', color: '#1a2e25' }}
                      />
                      <button onClick={() => setShowPw(p => ({ ...p, [key]: !p[key] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'rgba(26,46,37,0.4)' }}>
                        {showPw[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                ))}
                {pwError && <p className="error-text">{pwError}</p>}
                <button onClick={handlePasswordChange} disabled={pwLoading || isDemo}
                  className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-3">
                  {pwLoading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                  {isDemo ? 'Not available in demo' : pwLoading ? 'Updating…' : 'Update password'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card-dark p-7">
          <p className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: '#a7f3d0' }}>System hardware</p>
          <div className="space-y-4 text-sm">
            <EditableHardwareRow label="Inverter"         value={hardware.inverter}     onChange={v => onHardwareChange({ inverter: v })} />
            <EditableHardwareRow label="Solar array (kW)" value={hardware.solarKw}      onChange={v => onHardwareChange({ solarKw: parseFloat(v) || hardware.solarKw })} type="number" />
            <EditableHardwareRow label="Battery (kWh)"    value={hardware.batteryKwh}   onChange={v => onHardwareChange({ batteryKwh: parseFloat(v) || hardware.batteryKwh })} type="number" />
            <EditableHardwareRow label="Meter"            value={hardware.meterModel}   onChange={v => onHardwareChange({ meterModel: v })} />
            <EditableHardwareRow label="Gas utility"      value={hardware.gasUtility}   onChange={v => onHardwareChange({ gasUtility: v })} />
          </div>
          <div className="mt-5 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'rgba(167, 243, 208, 0.15)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full pulse-soft" style={{ background: '#a7f3d0' }} />
              <span className="text-sm font-semibold" style={{ color: '#a7f3d0' }}>All systems nominal</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(167,243,208,0.6)' }}>
              <span>Has EV?</span>
              <button onClick={() => onHardwareChange({ hasEV: !hardware.hasEV })}
                className="relative w-9 h-5 rounded-full transition-all"
                style={{ background: hardware.hasEV ? '#22c55e' : 'rgba(255,255,255,0.15)' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: hardware.hasEV ? '17px' : '2px' }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── HARDWARE INTEGRATIONS ── */}
      <div className="card p-7 fade-up" style={{ animationDelay: '0.15s' }}>
        <div className="flex items-start justify-between mb-2 flex-wrap gap-3">
          <div>
            <p className="label-caps">Hardware integrations</p>
            <h3 className="serif text-3xl mt-1" style={{ color: '#1a2e25' }}>Connect your devices</h3>
            <p className="text-sm mt-1 max-w-2xl" style={{ color: 'rgba(26,46,37,0.6)' }}>
              In production, EnergyWatch reads live data directly from your inverter, battery, and smart meter APIs. The dashboard currently uses a physics-based simulation driven by real weather data for your location.
            </p>
          </div>
          <div className="chip" style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb' }}>
            <AlertCircle size={12} /> Demo · Simulated data
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              name: 'Enphase Enlighten',
              category: 'Solar inverter',
              desc: 'Real-time panel-level generation, microinverter health, and lifetime production data.',
              color: '#f59e0b',
              bg: 'rgba(245,158,11,0.08)',
              border: 'rgba(245,158,11,0.2)',
              docsUrl: 'https://developer-v4.enphase.com/',
              icon: <Sun size={20} />,
            },
            {
              name: 'Tesla Gateway',
              category: 'Battery storage',
              desc: 'Powerwall state of charge, charge/discharge rate, backup reserve, and grid status.',
              color: '#ef4444',
              bg: 'rgba(239,68,68,0.08)',
              border: 'rgba(239,68,68,0.2)',
              docsUrl: 'https://developer.tesla.com/',
              icon: <Battery size={20} />,
            },
            {
              name: 'Emporia Energy',
              category: 'Smart meter · load',
              desc: 'Whole-home consumption, circuit-level disaggregation, and EV charger monitoring.',
              color: '#22c55e',
              bg: 'rgba(34,197,94,0.08)',
              border: 'rgba(34,197,94,0.2)',
              docsUrl: 'https://www.emporiaenergy.com/',
              icon: <Gauge size={20} />,
            },
            {
              name: 'SolarEdge',
              category: 'Solar inverter (alt.)',
              desc: 'String inverter data, optimizer performance, and energy flow via SolarEdge Monitoring API.',
              color: '#f59e0b',
              bg: 'rgba(245,158,11,0.08)',
              border: 'rgba(245,158,11,0.2)',
              docsUrl: 'https://developers.solaredge.com/',
              icon: <Sun size={20} />,
            },
            {
              name: 'Columbia Gas / IGS',
              category: 'Natural gas utility',
              desc: 'Usage data, billing, and demand signals from utility smart meter AMI network.',
              color: '#ef4444',
              bg: 'rgba(239,68,68,0.08)',
              border: 'rgba(239,68,68,0.2)',
              docsUrl: 'https://www.igs.com/',
              icon: <Flame size={20} />,
            },
            {
              name: 'Open-Meteo',
              category: 'Weather · active',
              desc: 'Live solar irradiance, cloud cover, and 7-day forecast already powering your AI decisions.',
              color: '#22c55e',
              bg: 'rgba(34,197,94,0.08)',
              border: 'rgba(34,197,94,0.2)',
              docsUrl: 'https://open-meteo.com/',
              icon: <Cloud size={20} />,
              connected: true,
            },
          ].map(intg => (
            <div key={intg.name} className="p-5 rounded-2xl transition-all"
              style={{ background: intg.bg, border: `1px solid ${intg.border}` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${intg.color}20`, color: intg.color }}>
                  {intg.icon}
                </div>
                {intg.connected ? (
                  <span className="chip" style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a' }}>
                    <div className="w-1.5 h-1.5 rounded-full pulse-soft" style={{ background: '#22c55e' }} />Connected
                  </span>
                ) : (
                  <span className="chip" style={{ background: 'rgba(26,46,37,0.06)', color: 'rgba(26,46,37,0.5)' }}>
                    Coming soon
                  </span>
                )}
              </div>
              <p className="font-semibold text-sm" style={{ color: '#1a2e25' }}>{intg.name}</p>
              <p className="label-caps mt-0.5">{intg.category}</p>
              <p className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(26,46,37,0.6)' }}>{intg.desc}</p>
              <a href={intg.docsUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: intg.color }}>
                View API docs →
              </a>
            </div>
          ))}
        </div>

        <div className="mt-6 p-5 rounded-2xl" style={{ background: 'rgba(26,46,37,0.03)', border: '1px solid rgba(26,46,37,0.07)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#1a2e25' }}>How it works in production</p>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(26,46,37,0.65)' }}>
            Each integration polls its API every 15–30 seconds and feeds real readings into the AI engine — replacing the simulated solar curve and battery model with actual kW and SoC values from your hardware. The decision logic, notifications, and settings remain exactly the same.
          </p>
        </div>
      </div>

      {/* ── AI SETTINGS ── */}
      <div className="card p-7 fade-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <p className="label-caps">AI decision settings</p>
            <h3 className="serif text-3xl mt-1" style={{ color: '#1a2e25' }}>Customize how the AI behaves</h3>
            <p className="text-sm mt-1" style={{ color: 'rgba(26,46,37,0.6)' }}>Changes apply instantly. Saving logs them to your notification center.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleReset} className="btn-ghost text-sm px-4 py-2.5">Reset defaults</button>
            <button onClick={handleSaveAI} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
              {saved ? <><Check size={15} /> Saved!</> : 'Save & notify'}
            </button>
          </div>
        </div>

        {/* Energy Strategy */}
        <div className="mb-8">
          <p className="text-sm font-semibold mb-1" style={{ color: '#1a2e25' }}>Energy strategy</p>
          <p className="text-xs mb-4" style={{ color: 'rgba(26,46,37,0.55)' }}>Sets the overall priority for how the AI manages your system.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { id: 'aggressive',      label: 'Aggressive',      icon: <TrendingUp size={18} />,    color: '#ef4444', desc: 'Maximize grid sellback. Export surplus aggressively at every opportunity.' },
              { id: 'balanced',        label: 'Balanced',        icon: <Activity size={18} />,      color: '#22c55e', desc: 'Split between selling, storing, and consuming. Best for most households.' },
              { id: 'self_sufficient', label: 'Self-sufficient', icon: <Home size={18} />,           color: '#3b82f6', desc: 'Prioritize self-consumption and battery. Minimize grid dependency.' },
            ].map(opt => (
              <button key={opt.id} onClick={() => onAiSettingsChange({ strategy: opt.id })}
                className="p-5 rounded-2xl text-left transition-all"
                style={{
                  background: s.strategy === opt.id ? `${opt.color}10` : 'rgba(255,255,255,0.5)',
                  border: s.strategy === opt.id ? `2px solid ${opt.color}` : '1.5px solid rgba(26,46,37,0.08)',
                  boxShadow: s.strategy === opt.id ? `0 4px 20px ${opt.color}20` : 'none',
                }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${opt.color}15`, color: opt.color }}>
                    {opt.icon}
                  </div>
                  {s.strategy === opt.id && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: opt.color }}>
                      <Check size={11} color="white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p className="font-semibold text-sm" style={{ color: '#1a2e25' }}>{opt.label}</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(26,46,37,0.6)' }}>{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Battery & Thresholds */}
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#1a2e25' }}>Battery reserve minimum</p>
                  <p className="text-xs" style={{ color: 'rgba(26,46,37,0.55)' }}>AI will never drain below this level</p>
                </div>
                <div className="serif text-3xl" style={{ color: '#22c55e' }}>{s.batteryReserve}%</div>
              </div>
              <input type="range" min={5} max={50} step={5} value={s.batteryReserve}
                onChange={e => onAiSettingsChange({ batteryReserve: Number(e.target.value) })}
                className="w-full" style={{ accentColor: '#22c55e' }} />
              <div className="flex justify-between text-xs mt-1" style={{ color: 'rgba(26,46,37,0.4)' }}>
                <span>5% (aggressive)</span><span>50% (conservative)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#1a2e25' }}>Sell threshold</p>
                  <p className="text-xs" style={{ color: 'rgba(26,46,37,0.55)' }}>Only export to grid above this price</p>
                </div>
                <div className="serif text-3xl" style={{ color: '#ef4444' }}>${s.sellThreshold}</div>
              </div>
              <input type="range" min={0.08} max={0.25} step={0.01} value={s.sellThreshold}
                onChange={e => onAiSettingsChange({ sellThreshold: parseFloat(e.target.value).toFixed(2) * 1 })}
                className="w-full" style={{ accentColor: '#ef4444' }} />
              <div className="flex justify-between text-xs mt-1" style={{ color: 'rgba(26,46,37,0.4)' }}>
                <span>$0.08/kWh</span><span>$0.25/kWh</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#1a2e25' }}>Buy threshold</p>
                  <p className="text-xs" style={{ color: 'rgba(26,46,37,0.55)' }}>Only buy from grid below this price</p>
                </div>
                <div className="serif text-3xl" style={{ color: '#3b82f6' }}>${s.buyThreshold}</div>
              </div>
              <input type="range" min={0.05} max={0.15} step={0.01} value={s.buyThreshold}
                onChange={e => onAiSettingsChange({ buyThreshold: parseFloat(e.target.value).toFixed(2) * 1 })}
                className="w-full" style={{ accentColor: '#3b82f6' }} />
              <div className="flex justify-between text-xs mt-1" style={{ color: 'rgba(26,46,37,0.4)' }}>
                <span>$0.05/kWh</span><span>$0.15/kWh</span>
              </div>
            </div>
          </div>

          {/* Peak Hours + Notifications */}
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#1a2e25' }}>Peak hour window</p>
              <p className="text-xs mb-4" style={{ color: 'rgba(26,46,37,0.55)' }}>AI prioritizes selling during this window</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgba(26,46,37,0.6)' }}>Start</label>
                  <select value={s.peakStart} onChange={e => onAiSettingsChange({ peakStart: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 text-sm rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,46,37,0.12)', color: '#1a2e25' }}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgba(26,46,37,0.6)' }}>End</label>
                  <select value={s.peakEnd} onChange={e => onAiSettingsChange({ peakEnd: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 text-sm rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,46,37,0.12)', color: '#1a2e25' }}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Clock size={14} style={{ color: '#f59e0b' }} />
                <span style={{ color: '#b45309' }}>
                  Peak: {s.peakStart < 12 ? `${s.peakStart}:00 AM` : `${s.peakStart - 12 || 12}:00 PM`} – {s.peakEnd < 12 ? `${s.peakEnd}:00 AM` : `${s.peakEnd - 12 || 12}:00 PM`}
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#1a2e25' }}>Notification preferences</p>
              <p className="text-xs mb-4" style={{ color: 'rgba(26,46,37,0.55)' }}>Choose which AI events appear in your notification center</p>
              <div className="space-y-2.5">
                {[
                  { key: 'notifyDecisions',       label: 'AI dispatch decisions',     desc: 'Every sell, buy, charge, or hold action' },
                  { key: 'notifyAdvisories',       label: 'Strategic advisories',      desc: 'Multi-day planning recommendations' },
                  { key: 'notifyAlerts',           label: 'System alerts',             desc: 'Hardware issues, connectivity drops' },
                  { key: 'notifyPriceSpikes',      label: 'Price threshold crossings', desc: `When grid price crosses $${s.sellThreshold}/kWh` },
                  { key: 'autoApproveAdvisories',  label: 'Auto-approve advisories',   desc: 'Engage plans without manual confirmation' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between p-3.5 rounded-xl transition-all"
                    style={{ background: s[key] ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.5)', border: `1px solid ${s[key] ? 'rgba(34,197,94,0.2)' : 'rgba(26,46,37,0.06)'}` }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#1a2e25' }}>{label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(26,46,37,0.5)' }}>{desc}</p>
                    </div>
                    <button onClick={() => onAiSettingsChange({ [key]: !s[key] })}
                      className="relative flex-shrink-0 w-11 h-6 rounded-full transition-all"
                      style={{ background: s[key] ? '#22c55e' : 'rgba(26,46,37,0.15)' }}>
                      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                        style={{ left: s[key] ? '22px' : '2px' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
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

function EditableHardwareRow({ label, value, onChange, type = 'text' }) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const commit = () => { onChange(draft); setEditing(false); };
  return (
    <div
      className="rounded-xl px-4 py-3 -mx-4 transition-all cursor-default flex items-center justify-between gap-4"
      style={{ background: editing ? 'rgba(167,243,208,0.1)' : hovered ? 'rgba(167,243,208,0.07)' : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'rgba(240, 245, 242, 0.55)' }}>{label}</p>
        {editing ? (
          <div className="flex gap-2">
            <input type={type} value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 px-3 py-1.5 text-sm rounded-lg mono"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(167,243,208,0.3)', color: '#f0f5f2' }}
              autoFocus />
            <button onClick={commit} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: 'rgba(34,197,94,0.2)', color: '#a7f3d0' }}>✓</button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: 'rgba(167,243,208,0.5)' }}>✕</button>
          </div>
        ) : (
          <p className="text-base font-medium truncate" style={{ color: 'rgba(240, 245, 242, 0.95)' }}>{value}</p>
        )}
      </div>
      {!editing && (
        <button onClick={() => { setDraft(String(value)); setEditing(true); }}
          className="flex-shrink-0 px-4 py-2 rounded-lg font-semibold transition-all"
          style={{
            color: 'rgba(167,243,208,0.95)',
            background: 'rgba(167,243,208,0.15)',
            fontSize: '13px',
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateX(0)' : 'translateX(6px)',
            transition: 'opacity 0.15s, transform 0.15s',
          }}>Edit</button>
      )}
    </div>
  );
}

/* ============== CLAUDE CHATBOX ============== */
function ClaudeChat({ user, weather, aiSettings, hardware }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: `Hi${user?.name ? ` ${user.name.split(' ')[0]}` : ''}! I'm Claude, your EnergyWatch AI assistant. Ask me anything about your energy system, solar generation, pricing strategy, or how to get the most out of your setup.`,
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

  const systemPrompt = `You are Claude, the AI energy advisor embedded in EnergyWatch — a residential solar-plus-storage management system built for the IGS Energy Hackathon.

Current system context:
- User: ${user?.name || user?.email || 'homeowner'}
- Location: ${user?.location_label || 'not set'}
- Strategy: ${aiSettings?.strategy || 'balanced'}
- Solar array: ${hardware?.solarKw || 11.2} kW
- Battery: ${hardware?.batteryKwh || 13.5} kWh
- Battery reserve: ${aiSettings?.batteryReserve || 20}%
- Sell threshold: $${aiSettings?.sellThreshold || 0.14}/kWh
- Buy threshold: $${aiSettings?.buyThreshold || 0.09}/kWh
- Peak window: ${aiSettings?.peakStart || 16}:00–${aiSettings?.peakEnd || 21}:00
${weather?.current ? `- Current weather: ${Math.round(weather.current.temperature_2m)}°F, ${weather.current.cloud_cover}% cloud cover, ${weather.current.shortwave_radiation} W/m² irradiance` : ''}

You are helpful, concise, and specific. Use real numbers from the context above when answering. Keep responses to 2-4 sentences unless the user asks for more detail. You can help with: understanding energy bills, optimizing solar strategy, explaining AI decisions, weather impact on generation, battery management, and general energy tips.`;

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = [...messages, userMsg]
        .map(m => ({ role: m.role, content: m.text }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1000,
          system: systemPrompt,
          messages: history,
        }),
      });

      const data = await response.json();
      const reply = data.content?.map(c => c.text || '').join('') || 'Sorry, I couldn\'t generate a response.';
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Connection error — make sure the backend is running and try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'How does my sell threshold affect earnings?',
    'When should I pre-charge my battery?',
    'Why is the AI holding right now?',
    "What's the best strategy for cloudy days?",
  ];

  return (
    <>
      <style>{`
        @keyframes chatSlideUp { from { opacity:0; transform:translateY(16px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
        .chat-slide-up { animation: chatSlideUp 0.25s cubic-bezier(0.4,0,0.2,1); }
        .chat-msg { animation: chatSlideUp 0.2s ease-out; }
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(26,46,37,0.15); border-radius: 999px; }
      `}</style>

      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all"
        style={{
          background: open ? '#1a2e25' : 'linear-gradient(135deg, #22c55e, #16a34a)',
          boxShadow: '0 8px 32px rgba(34,197,94,0.35)',
          transform: open ? 'scale(0.92)' : 'scale(1)',
        }}>
        {open
          ? <ChevronDown size={22} color="white" strokeWidth={2.5} />
          : <MessageCircle size={22} color="white" strokeWidth={2.5} />
        }
        {!open && messages.length > 1 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
            style={{ background: '#f59e0b' }}>
            {messages.filter(m => m.role === 'assistant').length}
          </div>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] rounded-3xl overflow-hidden shadow-2xl chat-slide-up"
          style={{ background: 'white', border: '1px solid rgba(26,46,37,0.1)', maxHeight: '520px', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #1a3329, #0f1f18)', borderBottom: '1px solid rgba(167,243,208,0.1)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <Sparkles size={17} color="white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#f0fdf4' }}>Ask Claude</p>
              <p className="text-xs" style={{ color: 'rgba(167,243,208,0.7)' }}>Your EnergyWatch AI advisor</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full pulse-soft" style={{ background: '#22c55e' }} />
              <span className="text-xs font-medium" style={{ color: '#a7f3d0' }}>Live</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 chat-scroll" style={{ minHeight: 0 }}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                    <Sparkles size={13} color="white" />
                  </div>
                )}
                <div className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                  style={{
                    background: m.role === 'user'
                      ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                      : 'rgba(26,46,37,0.05)',
                    color: m.role === 'user' ? 'white' : '#1a2e25',
                    borderBottomRightRadius: m.role === 'user' ? '6px' : undefined,
                    borderBottomLeftRadius: m.role === 'assistant' ? '6px' : undefined,
                  }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-msg flex justify-start gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  <Sparkles size={13} color="white" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5"
                  style={{ background: 'rgba(26,46,37,0.05)' }}>
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: '#22c55e', animation: `pulse-soft 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions — only show after first message and before user has typed */}
          {messages.length === 1 && !input && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => setInput(s)}
                  className="text-xs px-3 py-1.5 rounded-full transition-all"
                  style={{ background: 'rgba(34,197,94,0.08)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.2)' }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t" style={{ borderColor: 'rgba(26,46,37,0.07)' }}>
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask about your energy system…"
                rows={1}
                className="flex-1 resize-none text-sm px-4 py-2.5 rounded-2xl"
                style={{
                  background: 'rgba(26,46,37,0.05)',
                  border: '1px solid rgba(26,46,37,0.1)',
                  color: '#1a2e25',
                  outline: 'none',
                  maxHeight: '100px',
                  lineHeight: '1.5',
                  fontFamily: 'inherit',
                }}
                onInput={e => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                }}
              />
              <button onClick={send} disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: input.trim() && !loading ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(26,46,37,0.08)',
                  boxShadow: input.trim() && !loading ? '0 4px 12px rgba(34,197,94,0.3)' : 'none',
                }}>
                <Send size={15} color={input.trim() && !loading ? 'white' : 'rgba(26,46,37,0.3)'} />
              </button>
            </div>
            <p className="text-[10px] mt-2 text-center" style={{ color: 'rgba(26,46,37,0.35)' }}>
              Powered by Claude · Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
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