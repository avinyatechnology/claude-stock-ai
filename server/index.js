const express = require('express');
const cors    = require('cors');
const fetch   = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── ENV VARS ──────────────────────────────────────────────────────────────────
const ALPACA_KEY    = process.env.ALPACA_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET;
const ALPACA_MODE   = process.env.ALPACA_MODE || 'paper';
const OPENAI_KEY    = process.env.OPENAI_API_KEY;
const OPENAI_MODEL  = process.env.OPENAI_MODEL || 'gpt-4o';

const TRADING_BASE = ALPACA_MODE === 'live'
  ? 'https://api.alpaca.markets'
  : 'https://paper-api.alpaca.markets';
const DATA_BASE = 'https://data.alpaca.markets';

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── HEADERS ───────────────────────────────────────────────────────────────────
function alpacaHeaders() {
  return {
    'APCA-API-KEY-ID':     ALPACA_KEY,
    'APCA-API-SECRET-KEY': ALPACA_SECRET,
    'Content-Type':        'application/json',
  };
}

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:   'ok',
    mode:     ALPACA_MODE,
    keyset:   !!ALPACA_KEY && !!ALPACA_SECRET,
    openai:   !!OPENAI_KEY,
    model:    OPENAI_MODEL,
    version:  '3.0.0',
  });
});

// ── ACCOUNT ───────────────────────────────────────────────────────────────────
app.get('/api/account', async (req, res) => {
  try {
    const r = await fetch(`${TRADING_BASE}/v2/account`, { headers: alpacaHeaders() });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POSITIONS ─────────────────────────────────────────────────────────────────
app.get('/api/positions', async (req, res) => {
  try {
    const r = await fetch(`${TRADING_BASE}/v2/positions`, { headers: alpacaHeaders() });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ORDERS ────────────────────────────────────────────────────────────────────
app.get('/api/orders', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const r  = await fetch(`${TRADING_BASE}/v2/orders?${qs}`, { headers: alpacaHeaders() });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/orders', async (req, res) => {
  try {
    const r = await fetch(`${TRADING_BASE}/v2/orders`, {
      method: 'POST', headers: alpacaHeaders(), body: JSON.stringify(req.body),
    });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const r = await fetch(`${TRADING_BASE}/v2/orders/${req.params.id}`, {
      method: 'DELETE', headers: alpacaHeaders(),
    });
    res.status(r.status).json({ cancelled: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── QUOTES ────────────────────────────────────────────────────────────────────
app.get('/api/quotes', async (req, res) => {
  try {
    const symbols = req.query.symbols || 'AAPL';
    const r = await fetch(
      `${DATA_BASE}/v2/stocks/snapshots?symbols=${symbols}&feed=iex`,
      { headers: alpacaHeaders() }
    );
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── BARS ──────────────────────────────────────────────────────────────────────
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
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── LATEST TRADE ──────────────────────────────────────────────────────────────
app.get('/api/latest/:symbol', async (req, res) => {
  try {
    const r = await fetch(
      `${DATA_BASE}/v2/stocks/${req.params.symbol}/trades/latest?feed=iex`,
      { headers: alpacaHeaders() }
    );
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CLOCK ─────────────────────────────────────────────────────────────────────
app.get('/api/clock', async (req, res) => {
  try {
    const r = await fetch(`${TRADING_BASE}/v2/clock`, { headers: alpacaHeaders() });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CALENDAR ──────────────────────────────────────────────────────────────────
app.get('/api/calendar', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const r  = await fetch(`${TRADING_BASE}/v2/calendar?${qs}`, { headers: alpacaHeaders() });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── WATCHLISTS ────────────────────────────────────────────────────────────────
app.get('/api/watchlists', async (req, res) => {
  try {
    const r = await fetch(`${TRADING_BASE}/v2/watchlists`, { headers: alpacaHeaders() });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PORTFOLIO HISTORY ─────────────────────────────────────────────────────────
app.get('/api/portfolio/history', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const r  = await fetch(`${TRADING_BASE}/v2/account/portfolio/history?${qs}`, {
      headers: alpacaHeaders()
    });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ASSET INFO ────────────────────────────────────────────────────────────────
app.get('/api/asset/:symbol', async (req, res) => {
  try {
    const r = await fetch(
      `${TRADING_BASE}/v2/assets/${req.params.symbol.toUpperCase()}`,
      { headers: alpacaHeaders() }
    );
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── NEWS ──────────────────────────────────────────────────────────────────────
app.get('/api/news', async (req, res) => {
  try {
    const symbols = req.query.symbols || 'NVDA,AAPL,TSLA,META,MSFT,AMD,SPY';
    const limit   = Math.min(parseInt(req.query.limit) || 10, 20);
    const [tickerNews, marketNews] = await Promise.all([
      fetch(`${DATA_BASE}/v1beta1/news?symbols=${symbols}&limit=${limit}&sort=desc&include_content=false`,
        { headers: alpacaHeaders() }).then(r => r.json()).catch(() => null),
      fetch(`${DATA_BASE}/v1beta1/news?limit=5&sort=desc&include_content=false`,
        { headers: alpacaHeaders() }).then(r => r.json()).catch(() => null),
    ]);
    const allArticles = [...(tickerNews?.news||[]), ...(marketNews?.news||[])];
    const seen = new Set();
    const unique = allArticles
      .filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
    res.json({ news: unique, source: 'alpaca', count: unique.length });
  } catch (e) { res.status(500).json({ error: e.message, news: [] }); }
});

// ── OPENAI AI ANALYSIS ────────────────────────────────────────────────────────
// Receives live market data from frontend, sends to GPT-4o, returns structured analysis
app.post('/api/analyze', async (req, res) => {
  if (!OPENAI_KEY) {
    return res.status(503).json({ error: 'OpenAI API key not configured. Add OPENAI_API_KEY in Render environment.' });
  }

  const {
    symbol, companyName, price, prevClose, change, changePct,
    high, low, volume, vwap, avgVolume,
    rsi, macd, sma20, sma50, sma200, bbUpper, bbLower,
    atr, rvol, marketOpen,
    recentBars, // last 5 closing prices for context
    marketChangePct, // SPY day change for market context
    recentNews, // headlines from Alpaca news
  } = req.body;

  // Build a comprehensive data prompt for GPT-4o
  const dataContext = `
STOCK: ${symbol} (${companyName})
DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
MARKET STATUS: ${marketOpen ? 'OPEN' : 'CLOSED'}

LIVE PRICE DATA (from Alpaca Markets):
- Current Price: $${price}
- Previous Close: $${prevClose}
- Day Change: ${change >= 0 ? '+' : ''}$${change?.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct?.toFixed(2)}%)
- Day High: $${high} | Day Low: $${low}
- Volume: ${volume?.toLocaleString()} shares
- VWAP: $${vwap}
- Relative Volume (vs average): ${rvol?.toFixed(2)}x

TECHNICAL INDICATORS (calculated from live bar data):
- RSI (14-period): ${rsi?.toFixed(1)} ${rsi > 70 ? '[OVERBOUGHT]' : rsi < 30 ? '[OVERSOLD]' : '[NEUTRAL]'}
- MACD: ${macd >= 0 ? '+' : ''}${macd?.toFixed(3)} ${macd > 0 ? '[BULLISH]' : '[BEARISH]'}
- Price vs VWAP: ${price > vwap ? 'ABOVE [BULLISH]' : 'BELOW [BEARISH]'}
- Price vs 20-day SMA ($${sma20?.toFixed(2)}): ${price > sma20 ? 'ABOVE' : 'BELOW'}
- Price vs 50-day SMA ($${sma50?.toFixed(2)}): ${price > sma50 ? 'ABOVE' : 'BELOW'}
- Price vs 200-day SMA ($${sma200?.toFixed(2)}): ${price > sma200 ? 'ABOVE' : 'BELOW'}
- Bollinger Upper: $${bbUpper?.toFixed(2)} | Lower: $${bbLower?.toFixed(2)}
- ATR (daily range): $${atr?.toFixed(2)} (${((atr/price)*100)?.toFixed(1)}% of price)

RECENT PRICE HISTORY (last 5 sessions):
${recentBars?.map((b, i) => `  Session -${recentBars.length - i}: Close $${b.c?.toFixed(2)}, Volume ${b.v?.toLocaleString()}`).join('\n') || 'Not available'}

BROADER MARKET CONTEXT:
- S&P 500 (SPY) today: ${marketChangePct >= 0 ? '+' : ''}${marketChangePct?.toFixed(2)}%

RECENT NEWS HEADLINES (from Alpaca News API):
${recentNews?.length ? recentNews.slice(0, 5).map(n => `  - ${n.headline} [${n.source}]`).join('\n') : '  No recent news available'}
`;

  const systemPrompt = `You are GFinHub AI, a professional financial market analyst embedded in the GFinHub stock analysis platform. You analyze live market data and produce clear, structured, professional analysis for investors.

Your analysis must be:
- Based STRICTLY on the live data provided — do not invent numbers
- Written in plain English that any investor can understand
- Honest about uncertainty — if signals are mixed, say so
- Professional but not overly technical — explain what indicators MEAN not just their values
- Forward-looking — what does this data suggest about near-term price action

CRITICAL: You must respond with ONLY valid JSON. No markdown, no code blocks, no extra text. Start with { and end with }.

Respond with this exact JSON structure:
{
  "recommendation": "BUY" | "HOLD" | "SELL",
  "confidence": <number 1-100>,
  "verdictHeadline": "<one powerful sentence summarizing the call>",
  "verdictBody": "<2-3 sentences explaining the recommendation with specific price levels and reasons>",
  "insights": [
    {
      "icon": "<emoji>",
      "title": "<insight category>",
      "body": "<2-3 sentences of genuine insight based on the data>"
    }
  ],
  "todayOutlook": {
    "direction": "UP" | "DOWN" | "NEUTRAL",
    "expectedHigh": <number>,
    "expectedLow": <number>,
    "narrative": "<3-4 sentences about today specifically — what is driving the move, what levels matter today, what to watch>",
    "facts": [
      { "icon": "<emoji>", "title": "<label>", "body": "<specific fact with numbers>" }
    ]
  },
  "weekOutlook": {
    "direction": "UP" | "DOWN" | "NEUTRAL",
    "expectedHigh": <number>,
    "expectedLow": <number>,
    "baseCase": <number>,
    "narrative": "<3-4 sentences about this week — trend, key levels, what needs to happen for bull vs bear case>",
    "facts": [
      { "icon": "<emoji>", "title": "<label>", "body": "<specific fact with numbers>" }
    ]
  },
  "priceLevels": {
    "keySupport": <number>,
    "keyResistance": <number>,
    "stopLoss": <number>
  },
  "threeMonthTargets": {
    "bull": <number>,
    "base": <number>,
    "bear": <number>,
    "bullReasoning": "<one sentence>",
    "baseReasoning": "<one sentence>",
    "bearReasoning": "<one sentence>"
  },
  "catalysts": {
    "bull": ["<specific bullish catalyst 1>", "<specific bullish catalyst 2>", "<specific bullish catalyst 3>", "<specific bullish catalyst 4>"],
    "bear": ["<specific risk factor 1>", "<specific risk factor 2>", "<specific risk factor 3>", "<specific risk factor 4>"]
  },
  "indicators": {
    "trendInsight": "<2-3 sentences explaining what the MA alignment means for this specific stock right now>",
    "momentumInsight": "<2-3 sentences explaining RSI and MACD in plain English — what it means for near-term price action>",
    "volumeInsight": "<2-3 sentences explaining volume and VWAP — who is buying/selling and with what conviction>",
    "volatilityInsight": "<2-3 sentences explaining ATR and Bollinger Bands — expected range and what it means for risk>"
  },
  "analystNote": "<One honest paragraph about what Wall Street analysts broadly think about this stock type/sector, what drives institutional interest or concern, and what the key debate is among professional investors. Be specific to the company if you know it, general if not.>"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: `Analyze this stock and return JSON only:\n${dataContext}` },
        ],
        temperature: 0.3, // lower = more consistent, factual responses
        max_tokens: 2000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'OpenAI API error' });
    }

    const raw = data.choices?.[0]?.message?.content || '';

    // Parse JSON safely
    let analysis;
    try {
      // Strip any accidental markdown fences
      const clean = raw.replace(/```json|```/g, '').trim();
      analysis = JSON.parse(clean);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message, '\nRaw:', raw.slice(0, 200));
      return res.status(500).json({ error: 'Failed to parse AI response', raw: raw.slice(0, 500) });
    }

    res.json({ analysis, model: OPENAI_MODEL, timestamp: new Date().toISOString() });

  } catch (e) {
    console.error('OpenAI fetch error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`GFinHub server running on port ${PORT}`);
  console.log(`Mode: ${ALPACA_MODE} | Alpaca: ${!!ALPACA_KEY && !!ALPACA_SECRET} | OpenAI: ${!!OPENAI_KEY} | Model: ${OPENAI_MODEL}`);
});
