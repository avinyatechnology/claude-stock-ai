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
const FMP_KEY       = process.env.FMP_API_KEY; // financialmodelingprep.com free key

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
    fmp:      !!FMP_KEY,
    model:    OPENAI_MODEL,
    version:  '4.0.0',
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
    // Support up to 220 days for SMA200 calculation
    const days  = Math.min(parseInt(limit), 220);
    const start = req.query.start || new Date(Date.now() - days*1.5*86400000).toISOString();
    const end   = req.query.end   || new Date().toISOString();
    const r = await fetch(
      `${DATA_BASE}/v2/stocks/${symbol}/bars?timeframe=${tf}&start=${start}&end=${end}&limit=${days}&feed=iex`,
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

// ── ANALYST DATA (Financial Modeling Prep) ───────────────────────────────────
// Returns: analyst ratings, price target, earnings info, PE ratio, revenue growth
// Free API key from financialmodelingprep.com — add FMP_API_KEY to Render env
app.get('/api/analyst/:symbol', async (req, res) => {
  const sym = req.params.symbol.toUpperCase();

  if (!FMP_KEY) {
    return res.status(503).json({ error: 'FMP_API_KEY not set', noKey: true });
  }

  try {
    // Fetch all data in parallel from FMP
    const [
      ratingsData,
      targetData,
      profileData,
      earningsData,
    ] = await Promise.all([
      // Analyst ratings consensus (buy/hold/sell counts)
      fetch(`https://financialmodelingprep.com/api/v3/analyst-stock-recommendations/${sym}?limit=1&apikey=${FMP_KEY}`)
        .then(r => r.json()).catch(() => null),

      // Analyst price target consensus
      fetch(`https://financialmodelingprep.com/api/v4/price-target-consensus?symbol=${sym}&apikey=${FMP_KEY}`)
        .then(r => r.json()).catch(() => null),

      // Company profile (PE ratio, industry, market cap, description)
      fetch(`https://financialmodelingprep.com/api/v3/profile/${sym}?apikey=${FMP_KEY}`)
        .then(r => r.json()).catch(() => null),

      // Earnings calendar — next earnings date + EPS estimate
      fetch(`https://financialmodelingprep.com/api/v3/earning_calendar?symbol=${sym}&apikey=${FMP_KEY}`)
        .then(r => r.json()).catch(() => null),
    ]);

    // Parse ratings
    const rating    = Array.isArray(ratingsData) ? ratingsData[0] : null;
    const target    = Array.isArray(targetData)  ? targetData[0]  : null;
    const profile   = Array.isArray(profileData) ? profileData[0] : null;

    // Find next upcoming earnings
    const now = Date.now();
    const nextEarnings = Array.isArray(earningsData)
      ? earningsData
          .filter(e => new Date(e.date) > now)
          .sort((a,b) => new Date(a.date) - new Date(b.date))[0]
      : null;

    // Build clean response
    const result = {
      symbol: sym,

      // Analyst consensus
      buy:    rating?.analystRatingsbuy         || 0,
      hold:   rating?.analystRatingsHold        || 0,
      sell:   rating?.analystRatingsSell        ||
              (rating?.analystRatingsStrongSell || 0),
      strongBuy:  rating?.analystRatingsStrongBuy  || 0,
      strongSell: rating?.analystRatingsStrongSell || 0,

      // Price target
      targetHigh:   target?.targetHigh   || null,
      targetLow:    target?.targetLow    || null,
      targetMean:   target?.targetConsensus || target?.targetMean || null,
      targetMedian: target?.targetMedian || null,

      // Overall rating text
      rating: rating?.analystRatingsStrongBuy > (rating?.analystRatingsbuy||0)
        ? 'Strong Buy'
        : (rating?.analystRatingsbuy||0) > (rating?.analystRatingsHold||0)
        ? 'Buy'
        : (rating?.analystRatingsHold||0) > ((rating?.analystRatingsSell||0)+(rating?.analystRatingsStrongSell||0))
        ? 'Hold'
        : 'Sell',

      // Company fundamentals from profile
      peRatio:       profile?.pe           ? parseFloat(profile.pe).toFixed(1)+'×'   : null,
      revGrowth:     null, // computed from income statement if needed
      sector:        profile?.sector       || null,
      industry:      profile?.industry     || null,
      marketCap:     profile?.mktCap       || null,
      description:   profile?.description  || null,
      ceo:           profile?.ceo          || null,
      employees:     profile?.fullTimeEmployees || null,
      website:       profile?.website      || null,

      // Next earnings
      earningsDate:  nextEarnings?.date    || null,
      earningsEPS:   nextEarnings?.epsEstimated
        ? '$' + parseFloat(nextEarnings.epsEstimated).toFixed(2) + ' EPS est'
        : null,
      earningsRevenue: nextEarnings?.revenueEstimated
        ? '$' + (nextEarnings.revenueEstimated/1e9).toFixed(1) + 'B est'
        : null,

      source: 'financialmodelingprep.com',
    };

    // Combine buy + strongBuy, sell + strongSell for display
    result.totalBuy  = result.buy  + result.strongBuy;
    result.totalSell = result.sell + result.strongSell;
    result.totalHold = result.hold;
    result.totalAnalysts = result.totalBuy + result.totalHold + result.totalSell;

    res.json(result);
  } catch (e) {
    console.error('FMP error:', e.message);
    res.status(500).json({ error: e.message });
  }
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
