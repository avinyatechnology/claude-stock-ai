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
app.post('/api/analyze', async (req, res) => {
  if (!OPENAI_KEY) {
    return res.status(503).json({ error: 'OpenAI API key not configured.' });
  }

  const {
    symbol, companyName, price, prevClose, change, changePct,
    high, low, volume, vwap, avgVolume,
    rsi, macd, sma20, sma50, sma200, bbUpper, bbLower,
    atr, rvol, marketOpen,
    recentBars,
    marketChangePct,
    recentNews,
  } = req.body;

  // ── DERIVED SIGNALS (computed server-side for GPT context) ──
  const aboveVwap  = price > vwap;
  const aboveSma50 = price > sma50;
  const aboveSma200= price > sma200;
  const rrOverbought  = rsi > 70;
  const rsiOversold   = rsi < 30;
  const macdBullish   = macd > 0;
  const bbPosition    = bbUpper !== bbLower ? ((price - bbLower) / (bbUpper - bbLower) * 100).toFixed(0) : 50;
  const rvolLabel     = rvol > 2.0 ? 'VERY HIGH — major institutional activity' :
                        rvol > 1.5 ? 'ABOVE AVERAGE — elevated institutional interest' :
                        rvol > 1.0 ? 'NORMAL — typical session' :
                        rvol > 0.5 ? 'BELOW AVERAGE — quiet session' : 'VERY LOW — minimal participation';
  const trendStrength = (aboveSma50 ? 1 : 0) + (aboveSma200 ? 1 : 0) + (macdBullish ? 1 : 0) + (aboveVwap ? 1 : 0);
  const trendLabel    = trendStrength >= 4 ? 'STRONG UPTREND' : trendStrength === 3 ? 'MODERATE UPTREND' :
                        trendStrength === 2 ? 'MIXED/TRANSITIONAL' : trendStrength === 1 ? 'MODERATE DOWNTREND' : 'STRONG DOWNTREND';
  const priceVsSma50Pct  = sma50  ? ((price - sma50)  / sma50  * 100).toFixed(1) : null;
  const priceVsSma200Pct = sma200 ? ((price - sma200) / sma200 * 100).toFixed(1) : null;

  // 5-session momentum
  let momentum5d = null;
  if (recentBars?.length >= 2) {
    const oldest = recentBars[0]?.c;
    const newest = recentBars[recentBars.length - 1]?.c;
    if (oldest && newest) momentum5d = ((newest - oldest) / oldest * 100).toFixed(2);
  }

  const dataContext = `
╔══════════════════════════════════════════════════════════════╗
  GFINHUB AI ANALYSIS REQUEST
  ${new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
  Market: ${marketOpen ? 'OPEN' : 'CLOSED'}
╚══════════════════════════════════════════════════════════════╝

COMPANY: ${companyName} (${symbol})

━━━ LIVE PRICE DATA (Alpaca Markets) ━━━
Current Price:    $${price}
Previous Close:   $${prevClose}
Day Change:       ${change >= 0 ? '+' : ''}$${Number(change).toFixed(2)} (${changePct >= 0 ? '+' : ''}${Number(changePct).toFixed(2)}%)
Day Range:        $${low} — $${high}  (ATR: $${Number(atr).toFixed(2)}, ${((atr/price)*100).toFixed(1)}% of price)
Volume:           ${Number(volume).toLocaleString()} shares  [RVOL: ${Number(rvol).toFixed(2)}x = ${rvolLabel}]
VWAP:             $${vwap}  [Price is ${aboveVwap ? 'ABOVE ↑' : 'BELOW ↓'} VWAP]

━━━ TECHNICAL INDICATORS (computed from 220 days of real bar data) ━━━
RSI (14):         ${Number(rsi).toFixed(1)} → ${rrOverbought ? '⚠ OVERBOUGHT — buying exhaustion risk' : rsiOversold ? '✓ OVERSOLD — potential bounce zone' : 'NEUTRAL — balanced momentum'}
MACD:             ${macd >= 0 ? '+' : ''}${Number(macd).toFixed(4)} → ${macdBullish ? 'BULLISH (above signal line)' : 'BEARISH (below signal line)'}
SMA 20:           $${Number(sma20).toFixed(2)}  [Price ${price > sma20 ? 'above ↑' : 'below ↓'}]
SMA 50:           $${Number(sma50).toFixed(2)}  [Price ${aboveSma50 ? 'above ↑' : 'below ↓'} by ${Math.abs(priceVsSma50Pct)}%]
SMA 200:          $${Number(sma200).toFixed(2)} [Price ${aboveSma200 ? 'above ↑' : 'below ↓'} by ${Math.abs(priceVsSma200Pct)}%]
Bollinger Upper:  $${Number(bbUpper).toFixed(2)}
Bollinger Lower:  $${Number(bbLower).toFixed(2)}
BB Position:      ${bbPosition}% of band [${bbPosition > 80 ? 'Near upper — extended' : bbPosition < 20 ? 'Near lower — oversold' : 'Middle zone — neutral'}]
Overall Trend:    ${trendLabel} (${trendStrength}/4 bullish signals)

━━━ RECENT PRICE HISTORY (last ${recentBars?.length || 0} sessions) ━━━
${recentBars?.map((b, i) => `  Day -${recentBars.length - i}: Close $${Number(b.c).toFixed(2)}, Vol ${Number(b.v).toLocaleString()}`).join('\n') || '  Not available'}
5-Day Momentum:   ${momentum5d !== null ? (momentum5d >= 0 ? '+' : '') + momentum5d + '%' : 'N/A'}

━━━ BROADER MARKET CONTEXT ━━━
S&P 500 today:    ${marketChangePct >= 0 ? '+' : ''}${Number(marketChangePct).toFixed(2)}%
${symbol} vs Market: ${changePct > marketChangePct ? `Outperforming by ${(changePct - marketChangePct).toFixed(2)}% (bullish relative strength)` : `Underperforming by ${(marketChangePct - changePct).toFixed(2)}% (relative weakness)`}

━━━ LATEST NEWS (Alpaca News API) ━━━
${recentNews?.length ? recentNews.slice(0, 5).map(n => `  • ${n.headline} [${n.source}]`).join('\n') : '  No recent news available'}
`;

  const systemPrompt = `You are the Senior Portfolio Analyst at GFinHub, a professional financial intelligence platform. You have 20 years of experience at Goldman Sachs, JPMorgan, and leading hedge funds. You analyze stocks for both institutional and retail investors with the highest standards of professional rigor.

YOUR ROLE:
You receive live market data for a stock and produce a comprehensive, professional analysis that a serious investor — from a first-time retail investor to an experienced trader — can act on with confidence. Your analysis must be honest, precise, and genuinely useful. Never produce generic filler content.

CRITICAL RULES:
1. Use ONLY the data provided. Never fabricate numbers, news, or events you cannot verify from the data given.
2. Every claim must reference specific numbers from the data (prices, percentages, levels).
3. Be direct. If the stock is in trouble, say so clearly. If it is strong, explain exactly why.
4. Write as a trusted financial professional, not as a chatbot. No hedging every sentence with "please consult a financial advisor." One disclaimer at the end is enough.
5. Explain financial concepts in plain English — assume the user understands money but not technical jargon.
6. Be honest about uncertainty. Acknowledge when signals are mixed or the picture is unclear.
7. Minimum content: each narrative must be substantive — at least 3-4 sentences with specific numbers and reasoning.
8. CRITICAL: Respond with ONLY valid JSON. No markdown, no code blocks, no explanatory text before or after. Start directly with { and end with }.

JSON STRUCTURE — populate every field with high-quality, specific content:

{
  "recommendation": "BUY" | "HOLD" | "SELL",
  "confidence": <integer 1-100>,

  "summary": {
    "headline": "<A single powerful, specific sentence that captures the most important thing about this stock right now. Reference the actual price and a specific reason. Example: 'NVDA is holding above its 200-day average at $211 despite a 6.5% pullback — the technical structure remains intact for long-term holders.'>",
    "overallVerdict": "<3-4 sentences. This is the opening paragraph of a professional research note. State the recommendation clearly, explain the dominant reason with specific numbers, acknowledge the key risk, and give the reader a clear picture of what this stock is doing and why. This must be substantive and specific — not generic.>",
    "whatIsHappening": "<2-3 sentences explaining in plain English what is going on with this stock right now — today's move, why it is happening (reference news if available), and what it means for investors. Someone with no financial background should understand this completely.>",
    "keyStrength": "<The single most compelling bullish argument with specific supporting data from the numbers provided.>",
    "keyRisk": "<The single most important risk or concern with specific supporting data. Be honest — do not downplay real risks.>",
    "institutionalSignal": "<2-3 sentences interpreting the VWAP position and RVOL together. Explain what institutional investors are doing right now — are large funds accumulating, distributing, or sitting on the sidelines? Be specific about what the volume data tells us.>",
    "marketContext": "<2 sentences explaining how this stock is performing relative to the broader market today and what that means. Is it showing relative strength or weakness? Why does that matter?>"
  },

  "insights": [
    {
      "icon": "🏦",
      "title": "Institutional Money Flow",
      "body": "<3-4 sentences. Explain precisely what the VWAP and RVOL data reveals about institutional activity. Are large funds buying, selling, or neutral? What is the conviction level? What does this mean for retail investors watching the stock?>"
    },
    {
      "icon": "📊",
      "title": "Price Trend & Structure",
      "body": "<3-4 sentences. Explain the trend using the three SMAs. Where is price relative to each? What does this structure tell a long-term investor versus a short-term trader? Name the specific dollar levels that matter.>"
    },
    {
      "icon": "⚡",
      "title": "Momentum & Timing",
      "body": "<3-4 sentences. Interpret RSI, MACD, and the 5-day momentum together. Is momentum building or fading? Is this a good time to enter, or should an investor wait? Be specific about what would need to change for the picture to improve or worsen.>"
    },
    {
      "icon": "📰",
      "title": "News & Catalysts",
      "body": "<3-4 sentences. Reference the actual news headlines provided. What is the market reacting to? Is this move news-driven or purely technical? What upcoming events could change the picture? If no relevant news, explain the move from a purely technical perspective.>"
    }
  ],

  "todayOutlook": {
    "direction": "UP" | "DOWN" | "NEUTRAL",
    "directionLabel": "<Short label e.g. 'Cautiously Bullish' | 'Under Pressure' | 'Range-Bound' | 'Strong Momentum' | 'Selling Off'>",
    "expectedHigh": <specific number based on VWAP, resistance levels, and ATR>,
    "expectedLow": <specific number based on VWAP, support levels, and ATR>,
    "keyLevelToWatch": <the single most important price level today>,
    "keyLevelReason": "<Why this level matters today — support, resistance, VWAP, etc.>",
    "narrative": "<4-5 sentences giving a complete picture of today's session. Cover: what is driving the move today, whether the market is open or closed, the key levels that matter in today's session, what bulls need to see and what bears need to see, and what the most likely scenario is for the rest of today. Reference the news if relevant. Be specific with dollar levels throughout.>",
    "facts": [
      { "icon": "💰", "title": "VWAP Position", "body": "<Specific sentence about VWAP at $X and what it means for today's session>" },
      { "icon": "📈", "title": "Momentum Reading", "body": "<Specific sentence about RSI at X.X and what it implies for today>" },
      { "icon": "📦", "title": "Volume Activity", "body": "<Specific sentence about today's volume vs average and what it signals>" },
      { "icon": "🎯", "title": "Critical Level", "body": "<The most important price level today and exactly what happens if it breaks>" }
    ]
  },

  "weekOutlook": {
    "direction": "UP" | "DOWN" | "NEUTRAL",
    "directionLabel": "<Short weekly bias label e.g. 'Bullish with Caution' | 'Bearish Trend' | 'Consolidating' | 'Breakout Potential'>",
    "expectedHigh": <realistic weekly high based on resistance and ATR>,
    "expectedLow": <realistic weekly low based on support and ATR>,
    "baseCase": <most likely closing price by end of week>,
    "bullCase": <what happens if bulls take control — specific price>,
    "bearCase": <what happens if bears take control — specific price>,
    "narrative": "<5-6 sentences giving a thorough weekly outlook. Cover: the overall weekly bias and why, the key support and resistance levels for the week, what the 50-day and 200-day SMAs mean for this week's price action, what catalyst or event could change the weekly direction, and what an investor should be watching every day this week. Dollar levels throughout.>",
    "facts": [
      { "icon": "🏛️", "title": "Trend Structure", "body": "<How the SMA alignment sets up the week — specific levels>" },
      { "icon": "🎯", "title": "Key Support", "body": "<The most important support level this week and why it holds or breaks>" },
      { "icon": "🚧", "title": "Key Resistance", "body": "<The resistance level bulls need to clear this week to confirm momentum>" },
      { "icon": "⚡", "title": "Momentum Setup", "body": "<RSI/MACD entering the week — what this means for the week's direction>" },
      { "icon": "⚠️", "title": "Risk to Watch", "body": "<The specific event or level that would change the weekly outlook entirely>" }
    ]
  },

  "priceLevels": {
    "keySupport1": <number>,
    "keySupport1Label": "<Where this support comes from — e.g. '200-day SMA' or 'Bollinger Lower Band'>",
    "keySupport2": <number>,
    "keySupport2Label": "<Source of this support level>",
    "keyResistance1": <number>,
    "keyResistance1Label": "<Where this resistance comes from>",
    "keyResistance2": <number>,
    "keyResistance2Label": "<Source of this resistance>",
    "stopLossRef": <number — where a prudent stop-loss would sit based on ATR>,
    "stopLossNote": "<Brief explanation of why this stop level makes sense>"
  },

  "threeMonthTargets": {
    "bull": <specific number>,
    "base": <specific number>,
    "bear": <specific number>,
    "bullReasoning": "<2 sentences: specific conditions needed for the bull case — what needs to go right>",
    "baseReasoning": "<2 sentences: what the base case assumes about the stock and market>",
    "bearReasoning": "<2 sentences: specific conditions that produce the bear case — what risks materialise>",
    "probabilityBull": <integer 0-100 — your estimated probability of the bull case>,
    "probabilityBase": <integer 0-100 — your estimated probability of the base case>,
    "probabilityBear": <integer 0-100 — your estimated probability of the bear case>
  },

  "catalysts": {
    "bull": [
      "<Specific bullish catalyst 1 — tied to the data or news provided>",
      "<Specific bullish catalyst 2>",
      "<Specific bullish catalyst 3>",
      "<Specific bullish catalyst 4>"
    ],
    "bear": [
      "<Specific risk 1 — tied to the data or news provided>",
      "<Specific risk 2>",
      "<Specific risk 3>",
      "<Specific risk 4>"
    ]
  },

  "indicators": {
    "trendPanel": {
      "title": "Price Trend — Where Is This Stock Heading?",
      "reading": "BULLISH" | "BEARISH" | "MIXED",
      "explanation": "<4-5 sentences. Explain the SMA structure in plain English — what does it mean that price is above or below each moving average. Use an analogy if helpful. Explain why the 50-day and 200-day averages are the most watched levels by professional investors and fund managers. State specifically what the current alignment means for someone holding this stock for weeks versus months.>",
      "whatToWatch": "<The specific price level to watch that would change the trend reading — e.g. 'A daily close above $217 would confirm the 50-day SMA reclaim and shift the short-term outlook bullish.'>"
    },
    "momentumPanel": {
      "title": "Momentum — Is Buying or Selling Pressure Building?",
      "reading": "STRONG" | "MODERATE" | "WEAK" | "EXHAUSTED" | "RECOVERING",
      "explanation": "<4-5 sentences. Explain what RSI means without using the term 'overbought' — say what it actually means for the investor. Explain what MACD is telling us in terms a non-trader understands. Connect the momentum reading to the current price move and say what to expect next based on historical behaviour at this momentum level.>",
      "whatToWatch": "<The specific momentum signal that would change the reading — e.g. 'A MACD bullish crossover or RSI recovery above 50 would signal momentum is shifting back to buyers.'>"
    },
    "volumePanel": {
      "title": "Volume & Institutional Activity — Who Is Really Moving This Stock?",
      "reading": "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL" | "CLIMACTIC",
      "explanation": "<4-5 sentences. Explain VWAP in plain English — what it is, why institutions use it, and what today's position above or below VWAP reveals about who is in control. Interpret RVOL — what does trading at Xx the average volume actually mean? Are large funds likely building positions, exiting, or absent? What should a retail investor do with this information?>",
      "whatToWatch": "<The volume signal that would indicate a change in institutional behaviour.>"
    },
    "volatilityPanel": {
      "title": "Volatility & Risk — How Much Can This Stock Move?",
      "reading": "HIGH" | "NORMAL" | "LOW" | "COMPRESSING",
      "explanation": "<4-5 sentences. Explain the Bollinger Bands in a way a normal person understands — use the analogy of a rubber band or trading channel. Explain where price sits in the band today and what that historically implies. Explain the ATR in dollars per day — e.g. 'This stock typically moves $X in a single session, meaning a position of 100 shares has a one-day risk of approximately $Y.' Give practical risk context.>",
      "whatToWatch": "<What volatility signal to watch — e.g. 'A Bollinger Band squeeze followed by a volume breakout would signal the next large directional move is coming.'>"
    }
  },

  "analystNote": "<3-4 sentences that read like the closing paragraph of a Goldman Sachs research note. Summarise the overall picture clearly — what is the professional consensus, what is the key debate on Wall Street about this stock, what is the most important thing an investor needs to decide about this company right now, and what would make you change the recommendation. This should leave the reader with a clear, actionable perspective.>",

  "disclaimer": "This analysis is generated by GFinHub AI using live market data. It is for informational purposes only and does not constitute financial advice. Past performance does not guarantee future results. Always conduct your own research before making investment decisions."
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:       OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: `You are the Senior Portfolio Analyst. Produce a complete, professional analysis. Return ONLY valid JSON with no other text:\n\n${dataContext}` },
        ],
        temperature:  0.25, // precise, consistent, factual
        max_tokens:   4000, // enough for rich, detailed content
        response_format: { type: 'json_object' }, // forces valid JSON output
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'OpenAI API error' });
    }

    const raw = data.choices?.[0]?.message?.content || '';

    let analysis;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      analysis = JSON.parse(clean);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message);
      return res.status(500).json({ error: 'Failed to parse AI response', raw: raw.slice(0, 500) });
    }

    res.json({
      analysis,
      model:     OPENAI_MODEL,
      timestamp: new Date().toISOString(),
      dataPoints: Object.keys(req.body).length,
    });

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
