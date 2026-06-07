const express = require('express');
const cors    = require('cors');
const fetch   = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── ENV VARS (set these in Render dashboard, never in code) ──────────────────
const ALPACA_KEY    = process.env.ALPACA_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET;
const ALPACA_MODE   = process.env.ALPACA_MODE || 'paper'; // 'paper' or 'live'

const TRADING_BASE = ALPACA_MODE === 'live'
  ? 'https://api.alpaca.markets'
  : 'https://paper-api.alpaca.markets';

const DATA_BASE = 'https://data.alpaca.markets';

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve the frontend HTML from /public folder
app.use(express.static(path.join(__dirname, '../public')));

// ── ALPACA HEADERS (keys stay server-side only) ───────────────────────────────
function alpacaHeaders() {
  return {
    'APCA-API-KEY-ID':     ALPACA_KEY,
    'APCA-API-SECRET-KEY': ALPACA_SECRET,
    'Content-Type':        'application/json',
  };
}

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    mode:    ALPACA_MODE,
    keyset:  !!ALPACA_KEY && !!ALPACA_SECRET,
    version: '1.0.0',
  });
});

// ── ACCOUNT ───────────────────────────────────────────────────────────────────
app.get('/api/account', async (req, res) => {
  try {
    const r = await fetch(`${TRADING_BASE}/v2/account`, { headers: alpacaHeaders() });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POSITIONS ─────────────────────────────────────────────────────────────────
app.get('/api/positions', async (req, res) => {
  try {
    const r = await fetch(`${TRADING_BASE}/v2/positions`, { headers: alpacaHeaders() });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ORDERS (GET list) ─────────────────────────────────────────────────────────
app.get('/api/orders', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const r  = await fetch(`${TRADING_BASE}/v2/orders?${qs}`, { headers: alpacaHeaders() });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ORDERS (POST place) ───────────────────────────────────────────────────────
app.post('/api/orders', async (req, res) => {
  try {
    const r = await fetch(`${TRADING_BASE}/v2/orders`, {
      method:  'POST',
      headers: alpacaHeaders(),
      body:    JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── CANCEL ORDER ──────────────────────────────────────────────────────────────
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const r = await fetch(`${TRADING_BASE}/v2/orders/${req.params.id}`, {
      method:  'DELETE',
      headers: alpacaHeaders(),
    });
    res.status(r.status).json({ cancelled: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── QUOTES / SNAPSHOTS ────────────────────────────────────────────────────────
app.get('/api/quotes', async (req, res) => {
  try {
    const symbols = req.query.symbols || 'AAPL';
    const r = await fetch(
      `${DATA_BASE}/v2/stocks/snapshots?symbols=${symbols}&feed=iex`,
      { headers: alpacaHeaders() }
    );
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── BARS (historical OHLCV) ───────────────────────────────────────────────────
app.get('/api/bars/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const tf    = req.query.timeframe || '1D';
    const limit = req.query.limit     || '30';
    const start = req.query.start     || new Date(Date.now() - 30*86400000).toISOString();
    const end   = req.query.end       || new Date().toISOString();

    const r = await fetch(
      `${DATA_BASE}/v2/stocks/${symbol}/bars?timeframe=${tf}&start=${start}&end=${end}&limit=${limit}&feed=iex`,
      { headers: alpacaHeaders() }
    );
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── LATEST TRADE ──────────────────────────────────────────────────────────────
app.get('/api/latest/:symbol', async (req, res) => {
  try {
    const r = await fetch(
      `${DATA_BASE}/v2/stocks/${req.params.symbol}/trades/latest?feed=iex`,
      { headers: alpacaHeaders() }
    );
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── CLOCK (market hours) ──────────────────────────────────────────────────────
app.get('/api/clock', async (req, res) => {
  try {
    const r = await fetch(`${TRADING_BASE}/v2/clock`, { headers: alpacaHeaders() });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── CALENDAR ──────────────────────────────────────────────────────────────────
app.get('/api/calendar', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const r  = await fetch(`${TRADING_BASE}/v2/calendar?${qs}`, { headers: alpacaHeaders() });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── WATCHLIST ─────────────────────────────────────────────────────────────────
app.get('/api/watchlists', async (req, res) => {
  try {
    const r = await fetch(`${TRADING_BASE}/v2/watchlists`, { headers: alpacaHeaders() });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PORTFOLIO HISTORY ─────────────────────────────────────────────────────────
app.get('/api/portfolio/history', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const r  = await fetch(`${TRADING_BASE}/v2/account/portfolio/history?${qs}`, {
      headers: alpacaHeaders()
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Claude Stock AI server running on port ${PORT}`);
  console.log(`Mode: ${ALPACA_MODE} | Keys set: ${!!ALPACA_KEY && !!ALPACA_SECRET}`);
});
