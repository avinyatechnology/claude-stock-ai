const express = require('express');
const cors    = require('cors');
const fetch   = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── ENV ───────────────────────────────────────────────────────────────────────
const ALPACA_KEY    = process.env.ALPACA_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET;
const ALPACA_MODE   = process.env.ALPACA_MODE || 'paper';
const OPENAI_KEY    = process.env.OPENAI_API_KEY;
const OPENAI_MODEL  = process.env.OPENAI_MODEL || 'gpt-4o';
const FMP_KEY       = process.env.FMP_API_KEY;

const TRADING_BASE  = ALPACA_MODE === 'live'
  ? 'https://api.alpaca.markets'
  : 'https://paper-api.alpaca.markets';
const DATA_BASE = 'https://data.alpaca.markets';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

function alpacaHeaders() {
  return {
    'APCA-API-KEY-ID':     ALPACA_KEY,
    'APCA-API-SECRET-KEY': ALPACA_SECRET,
    'Content-Type':        'application/json',
  };
}

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok', mode: ALPACA_MODE,
  keyset: !!ALPACA_KEY && !!ALPACA_SECRET,
  openai: !!OPENAI_KEY, fmp: !!FMP_KEY,
  model: OPENAI_MODEL, version: '5.0.0',
}));

// ── ALPACA ENDPOINTS ──────────────────────────────────────────────────────────
app.get('/api/account',  async (req, res) => {
  try { const r = await fetch(`${TRADING_BASE}/v2/account`, { headers: alpacaHeaders() }); res.status(r.status).json(await r.json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/positions', async (req, res) => {
  try { const r = await fetch(`${TRADING_BASE}/v2/positions`, { headers: alpacaHeaders() }); res.status(r.status).json(await r.json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/orders', async (req, res) => {
  try { const qs = new URLSearchParams(req.query).toString(); const r = await fetch(`${TRADING_BASE}/v2/orders?${qs}`, { headers: alpacaHeaders() }); res.status(r.status).json(await r.json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/orders', async (req, res) => {
  try { const r = await fetch(`${TRADING_BASE}/v2/orders`, { method:'POST', headers: alpacaHeaders(), body: JSON.stringify(req.body) }); res.status(r.status).json(await r.json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/orders/:id', async (req, res) => {
  try { const r = await fetch(`${TRADING_BASE}/v2/orders/${req.params.id}`, { method:'DELETE', headers: alpacaHeaders() }); res.status(r.status).json({ cancelled: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/quotes', async (req, res) => {
  try { const r = await fetch(`${DATA_BASE}/v2/stocks/snapshots?symbols=${req.query.symbols||'AAPL'}&feed=iex`, { headers: alpacaHeaders() }); res.status(r.status).json(await r.json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/bars/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const days  = Math.min(parseInt(req.query.limit)||30, 220);
    const start = req.query.start || new Date(Date.now() - days*1.5*86400000).toISOString();
    const end   = req.query.end   || new Date().toISOString();
    const r = await fetch(`${DATA_BASE}/v2/stocks/${symbol}/bars?timeframe=${req.query.timeframe||'1D'}&start=${start}&end=${end}&limit=${days}&feed=iex`, { headers: alpacaHeaders() });
    res.status(r.status).json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/latest/:symbol', async (req, res) => {
  try { const r = await fetch(`${DATA_BASE}/v2/stocks/${req.params.symbol}/trades/latest?feed=iex`, { headers: alpacaHeaders() }); res.status(r.status).json(await r.json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/clock', async (req, res) => {
  try { const r = await fetch(`${TRADING_BASE}/v2/clock`, { headers: alpacaHeaders() }); res.status(r.status).json(await r.json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/calendar', async (req, res) => {
  try { const qs = new URLSearchParams(req.query).toString(); const r = await fetch(`${TRADING_BASE}/v2/calendar?${qs}`, { headers: alpacaHeaders() }); res.status(r.status).json(await r.json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/watchlists', async (req, res) => {
  try { const r = await fetch(`${TRADING_BASE}/v2/watchlists`, { headers: alpacaHeaders() }); res.status(r.status).json(await r.json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/portfolio/history', async (req, res) => {
  try { const qs = new URLSearchParams(req.query).toString(); const r = await fetch(`${TRADING_BASE}/v2/account/portfolio/history?${qs}`, { headers: alpacaHeaders() }); res.status(r.status).json(await r.json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/asset/:symbol', async (req, res) => {
  try { const r = await fetch(`${TRADING_BASE}/v2/assets/${req.params.symbol.toUpperCase()}`, { headers: alpacaHeaders() }); res.status(r.status).json(await r.json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/news', async (req, res) => {
  try {
    const symbols = req.query.symbols || 'NVDA,AAPL,TSLA,META,MSFT,AMD,SPY';
    const limit   = Math.min(parseInt(req.query.limit)||10, 20);
    const [a, b]  = await Promise.all([
      fetch(`${DATA_BASE}/v1beta1/news?symbols=${symbols}&limit=${limit}&sort=desc&include_content=false`, { headers: alpacaHeaders() }).then(r=>r.json()).catch(()=>null),
      fetch(`${DATA_BASE}/v1beta1/news?limit=5&sort=desc&include_content=false`, { headers: alpacaHeaders() }).then(r=>r.json()).catch(()=>null),
    ]);
    const seen = new Set();
    const news = [...(a?.news||[]), ...(b?.news||[])]
      .filter(n => { if(seen.has(n.id)) return false; seen.add(n.id); return true; })
      .sort((x,y) => new Date(y.created_at)-new Date(x.created_at))
      .slice(0, limit);
    res.json({ news, source:'alpaca', count:news.length });
  } catch(e) { res.status(500).json({ error: e.message, news:[] }); }
});

// ── FMP ANALYST DATA ──────────────────────────────────────────────────────────
app.get('/api/analyst/:symbol', async (req, res) => {
  const sym = req.params.symbol.toUpperCase();
  if (!FMP_KEY) return res.status(503).json({ error:'FMP_API_KEY not set', noKey:true });
  try {
    const [ratings, target, profile, earnings] = await Promise.all([
      fetch(`https://financialmodelingprep.com/api/v3/analyst-stock-recommendations/${sym}?limit=1&apikey=${FMP_KEY}`).then(r=>r.json()).catch(()=>null),
      fetch(`https://financialmodelingprep.com/api/v4/price-target-consensus?symbol=${sym}&apikey=${FMP_KEY}`).then(r=>r.json()).catch(()=>null),
      fetch(`https://financialmodelingprep.com/api/v3/profile/${sym}?apikey=${FMP_KEY}`).then(r=>r.json()).catch(()=>null),
      fetch(`https://financialmodelingprep.com/api/v3/earning_calendar?symbol=${sym}&apikey=${FMP_KEY}`).then(r=>r.json()).catch(()=>null),
    ]);
    const r   = Array.isArray(ratings) ? ratings[0] : null;
    const t   = Array.isArray(target)  ? target[0]  : null;
    const p   = Array.isArray(profile) ? profile[0] : null;
    const now = Date.now();
    const nextE = Array.isArray(earnings)
      ? earnings.filter(e=>new Date(e.date)>now).sort((a,b)=>new Date(a.date)-new Date(b.date))[0]
      : null;
    const buy  = (r?.analystRatingsbuy||0)    + (r?.analystRatingsStrongBuy||0);
    const hold =  r?.analystRatingsHold       || 0;
    const sell = (r?.analystRatingsSell||0)   + (r?.analystRatingsStrongSell||0);
    res.json({
      symbol: sym,
      totalBuy: buy, totalHold: hold, totalSell: sell,
      totalAnalysts: buy+hold+sell,
      rating: buy > hold+sell ? (r?.analystRatingsStrongBuy > r?.analystRatingsbuy ? 'Strong Buy' : 'Buy')
             : hold > buy+sell ? 'Hold' : 'Sell',
      targetMedian: t?.targetMedian || t?.targetConsensus || null,
      targetMean:   t?.targetMean   || null,
      targetHigh:   t?.targetHigh   || null,
      targetLow:    t?.targetLow    || null,
      peRatio:      p?.pe ? parseFloat(p.pe).toFixed(1)+'×' : null,
      sector:       p?.sector   || null,
      industry:     p?.industry || null,
      earningsDate: nextE?.date || null,
      earningsEPS:  nextE?.epsEstimated ? '$'+parseFloat(nextE.epsEstimated).toFixed(2)+' EPS est' : null,
      source: 'financialmodelingprep.com',
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── AI INTELLIGENCE SUMMARY (GPT-4o) ─────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  if (!OPENAI_KEY) return res.status(503).json({ error:'OPENAI_API_KEY not configured in Render environment.' });

  const {
    symbol, companyName, price, prevClose, change, changePct,
    high, low, volume, vwap, avgVolume,
    rsi, macd, sma20, sma50, sma200, bbUpper, bbLower,
    atr, rvol, marketOpen, recentBars, marketChangePct, recentNews,
  } = req.body;

  // Pre-compute signals for richer GPT context
  const aboveVwap   = price > vwap;
  const aboveSma20  = price > sma20;
  const aboveSma50  = price > sma50;
  const aboveSma200 = price > sma200;
  const macdBull    = macd > 0;
  const rsiOB = rsi > 70, rsiOS = rsi < 30;
  const bbPct = bbUpper !== bbLower ? ((price-bbLower)/(bbUpper-bbLower)*100).toFixed(0) : 50;
  const bullCount = [aboveVwap,aboveSma20,aboveSma50,aboveSma200,macdBull,!rsiOB].filter(Boolean).length;
  const trendScore = bullCount>=5?'STRONG UPTREND':bullCount>=4?'MODERATE UPTREND':bullCount>=3?'NEUTRAL/MIXED':bullCount>=2?'MODERATE DOWNTREND':'STRONG DOWNTREND';

  let mom5d = null;
  if (recentBars?.length >= 2) {
    const o = recentBars[0]?.c, n = recentBars[recentBars.length-1]?.c;
    if (o && n) mom5d = ((n-o)/o*100).toFixed(2);
  }

  const relPerf = changePct > marketChangePct
    ? `Outperforming S&P 500 by +${(changePct-marketChangePct).toFixed(2)}% today (relative STRENGTH)`
    : `Underperforming S&P 500 by ${(marketChangePct-changePct).toFixed(2)}% today (relative WEAKNESS)`;

  const dataContext = `
GFinHub AI Intelligence Summary Request
Date: ${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
Market: ${marketOpen ? 'OPEN' : 'CLOSED'} | Company: ${companyName} (${symbol})

LIVE PRICE DATA
Price: $${price} | Prev Close: $${prevClose} | Change: ${change>=0?'+':''}${Number(change).toFixed(2)} (${changePct>=0?'+':''}${Number(changePct).toFixed(2)}%)
Day Range: $${low} – $${high} | ATR: $${Number(atr).toFixed(2)} (${((atr/price)*100).toFixed(1)}% daily move)
Volume: ${Number(volume).toLocaleString()} shares | RVOL: ${Number(rvol).toFixed(2)}x avg | Avg Vol: ${avgVolume?Number(avgVolume).toLocaleString():'N/A'}
VWAP: $${vwap} → price ${aboveVwap?'ABOVE (institutional buyers in control)':'BELOW (sellers in control today)'}

TECHNICAL PICTURE
RSI(14): ${Number(rsi).toFixed(1)} [${rsiOB?'OVERBOUGHT — buying exhaustion':rsiOS?'OVERSOLD — bounce candidate':'NEUTRAL — balanced'}]
MACD: ${Number(macd).toFixed(4)} [${macdBull?'BULLISH momentum':'BEARISH momentum'}]
vs SMA20 ($${Number(sma20).toFixed(2)}): ${aboveSma20?'ABOVE':'BELOW'}
vs SMA50 ($${Number(sma50).toFixed(2)}): ${aboveSma50?'ABOVE':'BELOW'} by ${Math.abs(sma50?((price-sma50)/sma50*100).toFixed(1):0)}%
vs SMA200 ($${Number(sma200).toFixed(2)}): ${aboveSma200?'ABOVE':'BELOW'} by ${Math.abs(sma200?((price-sma200)/sma200*100).toFixed(1):0)}%
Bollinger Bands: Upper $${Number(bbUpper).toFixed(2)} | Lower $${Number(bbLower).toFixed(2)} | Position: ${bbPct}%
Trend Alignment: ${trendScore} (${bullCount}/6 bullish signals)

RECENT SESSIONS (last ${recentBars?.length||0} days)
${recentBars?.map((b,i)=>`Day-${recentBars.length-i}: $${Number(b.c).toFixed(2)} vol ${Number(b.v).toLocaleString()}`).join(' | ')||'N/A'}
5-Day Momentum: ${mom5d!==null?(mom5d>=0?'+':'')+mom5d+'%':'N/A'}

MARKET CONTEXT
S&P 500 today: ${marketChangePct>=0?'+':''}${Number(marketChangePct).toFixed(2)}%
${symbol} vs market: ${relPerf}

LATEST NEWS
${recentNews?.length?recentNews.slice(0,5).map(n=>`• ${n.headline} [${n.source}]`).join('\n'):'No recent news available'}
`;

  // ── THE SYSTEM PROMPT: exactly matching the specification ──────────────────
  const systemPrompt = `You are the Head of Equity Research at GFinHub. You are writing the AI Intelligence Summary — the single most important section of the application.

YOUR MISSION — READ THIS CAREFULLY:
Produce ONE professional investment verdict for this stock. Your job is NOT to report what indicators are doing. Your job is to synthesize ALL available data — price action, volume, technical signals, news, market context — and translate it into a clear, honest assessment that tells the investor what the stock is likely to do today and this week.

Think of it as a 30-second brief from your portfolio manager before market open. Every word counts.

WHO READS THIS:
Both beginners (who need plain English) and experienced investors (who need to trust your rigor). The beginner must understand the verdict immediately. The experienced investor must feel the analysis is credible and backed by data.

NON-NEGOTIABLE RULES:
1. Write in plain English. No indicator jargon unless you immediately explain it simply.
2. Every price level and percentage you cite must come from the data provided — never fabricate.
3. Be direct and honest. If signals are mixed, say so. Do not force a bullish verdict when the data is bearish.
4. Maximum brevity. Today outlook: 2-3 sentences. Week outlook: 2-3 sentences. These must be concise.
5. Key Drivers: 3-5 bullet points explaining WHY you hold this view — specific, with numbers.
6. Key Risks: exactly 3 risks with specific price levels or events that would invalidate the outlook.
7. Price Scenarios: give three specific price targets (bull/neutral/bear) with one-sentence rationale each.
8. NEVER use phrases like "please consult a financial advisor" more than once (put it only in disclaimer).
9. The user must immediately understand: direction today, direction this week, why, key levels, key risks.
10. Respond with ONLY valid JSON. No markdown. No code blocks. Start with { end with }.

REQUIRED JSON — fill every field with genuine, specific, non-generic content:

{
  "recommendation": "BUY" | "HOLD" | "SELL",
  "confidence": <integer 1-100>,

  "aiSummary": {
    "verdict": "Bullish" | "Cautiously Bullish" | "Neutral" | "Cautiously Bearish" | "Bearish",

    "verdictReason": "<Single sentence. The ONE most important reason for your verdict. Must reference a specific price, level, or data point from what was provided. Example: 'Price is holding above the 200-day average at $211 while RVOL of 1.8x confirms institutional buyers are active.'>",

    "todayOutlook": "<2-3 sentences ONLY. What is this stock doing today and why? Reference the most relevant factor (VWAP, momentum, news, volume) without jargon. End by stating the most likely scenario for today's session. This must be readable in under 10 seconds.>",

    "weekOutlook": "<2-3 sentences ONLY. What is the stock likely to do this week? Name the dominant trend driver, any news catalyst if present, and the one price level that determines the outcome. No lists.>",

    "keyDrivers": [
      "<Driver 1: specific fact with number — e.g. 'Trading 3.2% above the 200-day average — long-term uptrend intact'>",
      "<Driver 2>",
      "<Driver 3>",
      "<Driver 4 — include only if genuinely meaningful>",
      "<Driver 5 — include only if genuinely meaningful>"
    ],

    "keyRisks": [
      "<Risk 1: specific with price level — e.g. 'A close below $211 (200-day average) would signal trend breakdown'>",
      "<Risk 2: specific event or level>",
      "<Risk 3: specific event or level>"
    ],

    "priceScenarios": {
      "bull": {
        "label": "Bullish Scenario",
        "target": <specific price derived from resistance/ATR data>,
        "description": "<One sentence: what needs to happen and the timeframe.>"
      },
      "neutral": {
        "label": "Neutral Scenario",
        "target": <current price zone, range midpoint>,
        "description": "<One sentence: what range-bound looks like and why.>"
      },
      "bear": {
        "label": "Bearish Scenario",
        "target": <specific support level from data>,
        "description": "<One sentence: what triggers downside and the floor level.>"
      }
    },

    "keyLevels": {
      "support": <most important support price — use SMA200, VWAP, or BB lower>,
      "supportLabel": "<source e.g. '200-day average' or 'VWAP support'>",
      "resistance": <most important resistance price — use BB upper, SMA50 if below, or day high>,
      "resistanceLabel": "<source e.g. 'Bollinger upper band' or '50-day average'>"
    }
  },

  "todayOutlookFull": {
    "direction": "UP" | "DOWN" | "NEUTRAL",
    "directionLabel": "<e.g. 'Constructive' | 'Under Pressure' | 'Range-Bound' | 'Cautiously Bullish'>",
    "expectedHigh": <number based on VWAP+ATR or resistance>,
    "expectedLow": <number based on VWAP-ATR or support>,
    "keyLevelToWatch": <single most important level today>,
    "keyLevelReason": "<Why this level matters today — support/resistance/VWAP/etc.>",
    "narrative": "<4-5 sentences. More detailed today analysis for the Outlook tab. Include what is driving the move, current momentum state, volume context, and what bulls/bears each need to see. Dollar levels throughout.>",
    "facts": [
      {"icon": "💰", "title": "VWAP Signal", "body": "<Specific: VWAP at $X, price is above/below, what this means for today>"},
      {"icon": "⚡", "title": "Momentum", "body": "<Specific: RSI at X.X — what this means practically for today's move>"},
      {"icon": "📦", "title": "Volume Activity", "body": "<Specific: RVOL X.Xx, what this institutional signal means>"},
      {"icon": "🎯", "title": "Key Level", "body": "<The exact level and precisely what happens if it breaks or holds>"}
    ]
  },

  "weekOutlookFull": {
    "direction": "UP" | "DOWN" | "NEUTRAL",
    "directionLabel": "<Weekly bias e.g. 'Bullish Bias' | 'Bearish Trend' | 'Consolidation Phase'>",
    "expectedHigh": <number>,
    "expectedLow": <number>,
    "baseCase": <most likely weekly close price>,
    "bullCase": <bull scenario weekly target>,
    "bearCase": <bear scenario weekly target>,
    "narrative": "<5-6 sentences. Thorough weekly view. Cover: overall weekly bias and the primary reason, key SMA levels that define the week's range, what the 5-day momentum trend suggests, the single most important catalyst or risk for the week, and what an investor should watch day by day. Dollar levels throughout.>",
    "facts": [
      {"icon": "🏛️", "title": "Trend Structure", "body": "<How SMA alignment sets up the week with specific levels>"},
      {"icon": "🎯", "title": "Key Support", "body": "<Most important support this week and what a break would mean>"},
      {"icon": "🚧", "title": "Key Resistance", "body": "<The resistance bulls need to clear and what that would confirm>"},
      {"icon": "⚡", "title": "Momentum Setup", "body": "<RSI/MACD entering the week — what this means for weekly direction>"},
      {"icon": "⚠️", "title": "Primary Risk", "body": "<The specific thing that would completely change the weekly outlook>"}
    ]
  },

  "threeMonthTargets": {
    "bull": <number>,
    "base": <number>,
    "bear": <number>,
    "bullReasoning": "<2 sentences: what conditions produce the bull case>",
    "baseReasoning": "<2 sentences: what the base case assumes>",
    "bearReasoning": "<2 sentences: what produces the bear case>",
    "probabilityBull": <0-100>,
    "probabilityBase": <0-100>,
    "probabilityBear": <0-100>
  },

  "catalysts": {
    "bull": ["<specific bullish driver 1>", "<driver 2>", "<driver 3>", "<driver 4>"],
    "bear": ["<specific risk 1>", "<risk 2>", "<risk 3>", "<risk 4>"]
  },

  "indicators": {
    "trendPanel": {
      "title": "Price Trend",
      "reading": "BULLISH" | "BEARISH" | "MIXED",
      "explanation": "<4-5 sentences. SMA structure in plain English — what being above/below each average actually means for investors. Name the specific dollar levels. Explain what this means for someone holding for weeks vs months.>",
      "whatToWatch": "<Exact price level or event that would change the trend reading.>"
    },
    "momentumPanel": {
      "title": "Momentum",
      "reading": "STRONG" | "MODERATE" | "WEAK" | "EXHAUSTED" | "RECOVERING",
      "explanation": "<4-5 sentences. Explain RSI and MACD without jargon — what do these numbers mean for the investor practically. Connect to current move. What to expect next.>",
      "whatToWatch": "<Specific momentum signal to watch.>"
    },
    "volumePanel": {
      "title": "Volume & Institutional Flow",
      "reading": "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL" | "CLIMACTIC",
      "explanation": "<4-5 sentences. VWAP in plain English — why it matters. What RVOL tells us about who is trading. Are institutions buying, selling, or absent? What should a retail investor do with this.>",
      "whatToWatch": "<Volume signal that would change the institutional reading.>"
    },
    "volatilityPanel": {
      "title": "Volatility & Risk Range",
      "reading": "HIGH" | "NORMAL" | "LOW" | "COMPRESSING",
      "explanation": "<4-5 sentences. Bollinger Bands as a plain English trading range. ATR in dollar terms — 'this stock moves $X per day on average.' Practical risk context for a position.>",
      "whatToWatch": "<Volatility signal to watch for the next big move.>"
    }
  },

  "analystNote": "<3-4 sentences. Closing paragraph like a Goldman Sachs research note. Summarise the overall picture, the key debate on this stock among professional investors, and what would make you change the recommendation. Leave the reader with one clear, actionable perspective.>",

  "disclaimer": "This analysis is generated by GFinHub AI using live market data and is for informational purposes only. It does not constitute financial advice. Always conduct your own research and consult a qualified financial advisor before making investment decisions."
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: `Write the GFinHub AI Intelligence Summary. Return ONLY valid JSON:\n\n${dataContext}` },
        ],
        temperature: 0.2,
        max_tokens:  3500,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'OpenAI error' });
    }

    let analysis;
    try {
      analysis = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    } catch(e) {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    res.json({ analysis, model: OPENAI_MODEL, timestamp: new Date().toISOString() });
  } catch(e) {
    console.error('OpenAI error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`GFinHub v5 running on port ${PORT}`);
  console.log(`Alpaca: ${!!ALPACA_KEY&&!!ALPACA_SECRET} | OpenAI: ${!!OPENAI_KEY} | FMP: ${!!FMP_KEY} | Model: ${OPENAI_MODEL}`);
});
