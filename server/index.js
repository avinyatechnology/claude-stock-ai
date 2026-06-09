const express = require('express');
const cors    = require('cors');
const fetch   = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const ALPACA_KEY   = process.env.ALPACA_KEY;
const ALPACA_SECRET= process.env.ALPACA_SECRET;
const ALPACA_MODE  = process.env.ALPACA_MODE || 'paper';
const OPENAI_KEY   = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const FMP_KEY      = process.env.FMP_API_KEY;

const TRADING_BASE = ALPACA_MODE === 'live'
  ? 'https://api.alpaca.markets' : 'https://paper-api.alpaca.markets';
const DATA_BASE = 'https://data.alpaca.markets';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

function alpacaHeaders() {
  return {
    'APCA-API-KEY-ID': ALPACA_KEY,
    'APCA-API-SECRET-KEY': ALPACA_SECRET,
    'Content-Type': 'application/json',
  };
}

app.get('/health', (req, res) => res.json({
  status:'ok', mode:ALPACA_MODE,
  keyset:!!ALPACA_KEY&&!!ALPACA_SECRET,
  openai:!!OPENAI_KEY, fmp:!!FMP_KEY,
  model:OPENAI_MODEL, version:'6.0.0',
}));

app.get('/api/account',  async (req,res) => { try { const r=await fetch(`${TRADING_BASE}/v2/account`,{headers:alpacaHeaders()}); res.status(r.status).json(await r.json()); } catch(e){res.status(500).json({error:e.message});} });
app.get('/api/positions',async (req,res) => { try { const r=await fetch(`${TRADING_BASE}/v2/positions`,{headers:alpacaHeaders()}); res.status(r.status).json(await r.json()); } catch(e){res.status(500).json({error:e.message});} });
app.get('/api/orders',   async (req,res) => { try { const qs=new URLSearchParams(req.query).toString(); const r=await fetch(`${TRADING_BASE}/v2/orders?${qs}`,{headers:alpacaHeaders()}); res.status(r.status).json(await r.json()); } catch(e){res.status(500).json({error:e.message});} });
app.post('/api/orders',  async (req,res) => { try { const r=await fetch(`${TRADING_BASE}/v2/orders`,{method:'POST',headers:alpacaHeaders(),body:JSON.stringify(req.body)}); res.status(r.status).json(await r.json()); } catch(e){res.status(500).json({error:e.message});} });
app.delete('/api/orders/:id',async(req,res)=>{ try{const r=await fetch(`${TRADING_BASE}/v2/orders/${req.params.id}`,{method:'DELETE',headers:alpacaHeaders()});res.status(r.status).json({cancelled:true});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/quotes',   async (req,res) => { try { const r=await fetch(`${DATA_BASE}/v2/stocks/snapshots?symbols=${req.query.symbols||'AAPL'}&feed=iex`,{headers:alpacaHeaders()}); res.status(r.status).json(await r.json()); } catch(e){res.status(500).json({error:e.message});} });
app.get('/api/bars/:symbol', async (req,res) => {
  try {
    const {symbol}=req.params;
    const days=Math.min(parseInt(req.query.limit)||30,220);
    const start=req.query.start||new Date(Date.now()-days*1.5*86400000).toISOString();
    const end=req.query.end||new Date().toISOString();
    const r=await fetch(`${DATA_BASE}/v2/stocks/${symbol}/bars?timeframe=${req.query.timeframe||'1D'}&start=${start}&end=${end}&limit=${days}&feed=iex`,{headers:alpacaHeaders()});
    res.status(r.status).json(await r.json());
  } catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/latest/:symbol',async(req,res)=>{try{const r=await fetch(`${DATA_BASE}/v2/stocks/${req.params.symbol}/trades/latest?feed=iex`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/clock',    async (req,res) => { try{const r=await fetch(`${TRADING_BASE}/v2/clock`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});} });
app.get('/api/calendar', async (req,res) => { try{const qs=new URLSearchParams(req.query).toString();const r=await fetch(`${TRADING_BASE}/v2/calendar?${qs}`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});} });
app.get('/api/watchlists',async(req,res)=>{try{const r=await fetch(`${TRADING_BASE}/v2/watchlists`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});} });
app.get('/api/portfolio/history',async(req,res)=>{try{const qs=new URLSearchParams(req.query).toString();const r=await fetch(`${TRADING_BASE}/v2/account/portfolio/history?${qs}`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});} });
app.get('/api/asset/:symbol',async(req,res)=>{try{const r=await fetch(`${TRADING_BASE}/v2/assets/${req.params.symbol.toUpperCase()}`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});} });

app.get('/api/news', async (req,res) => {
  try {
    const symbols=req.query.symbols||'NVDA,AAPL,TSLA,META,MSFT,AMD,SPY';
    const limit=Math.min(parseInt(req.query.limit)||10,20);
    const [a,b]=await Promise.all([
      fetch(`${DATA_BASE}/v1beta1/news?symbols=${symbols}&limit=${limit}&sort=desc&include_content=false`,{headers:alpacaHeaders()}).then(r=>r.json()).catch(()=>null),
      fetch(`${DATA_BASE}/v1beta1/news?limit=5&sort=desc&include_content=false`,{headers:alpacaHeaders()}).then(r=>r.json()).catch(()=>null),
    ]);
    const seen=new Set();
    const news=[...(a?.news||[]),...(b?.news||[])].filter(n=>{if(seen.has(n.id))return false;seen.add(n.id);return true;}).sort((x,y)=>new Date(y.created_at)-new Date(x.created_at)).slice(0,limit);
    res.json({news,source:'alpaca',count:news.length});
  } catch(e){res.status(500).json({error:e.message,news:[]});}
});

app.get('/api/analyst/:symbol', async (req,res) => {
  const sym=req.params.symbol.toUpperCase();
  if(!FMP_KEY) return res.status(503).json({error:'FMP_API_KEY not set',noKey:true});
  try {
    const [ratings,target,profile,earnings]=await Promise.all([
      fetch(`https://financialmodelingprep.com/api/v3/analyst-stock-recommendations/${sym}?limit=1&apikey=${FMP_KEY}`).then(r=>r.json()).catch(()=>null),
      fetch(`https://financialmodelingprep.com/api/v4/price-target-consensus?symbol=${sym}&apikey=${FMP_KEY}`).then(r=>r.json()).catch(()=>null),
      fetch(`https://financialmodelingprep.com/api/v3/profile/${sym}?apikey=${FMP_KEY}`).then(r=>r.json()).catch(()=>null),
      fetch(`https://financialmodelingprep.com/api/v3/earning_calendar?symbol=${sym}&apikey=${FMP_KEY}`).then(r=>r.json()).catch(()=>null),
    ]);
    const r=Array.isArray(ratings)?ratings[0]:null;
    const t=Array.isArray(target)?target[0]:null;
    const p=Array.isArray(profile)?profile[0]:null;
    const now=Date.now();
    const nextE=Array.isArray(earnings)?earnings.filter(e=>new Date(e.date)>now).sort((a,b)=>new Date(a.date)-new Date(b.date))[0]:null;
    const buy=(r?.analystRatingsbuy||0)+(r?.analystRatingsStrongBuy||0);
    const hold=r?.analystRatingsHold||0;
    const sell=(r?.analystRatingsSell||0)+(r?.analystRatingsStrongSell||0);
    const daysToEarnings = nextE?.date ? Math.round((new Date(nextE.date)-now)/86400000) : null;
    res.json({
      symbol:sym,
      totalBuy:buy,totalHold:hold,totalSell:sell,totalAnalysts:buy+hold+sell,
      rating:buy>hold+sell?(r?.analystRatingsStrongBuy>r?.analystRatingsbuy?'Strong Buy':'Buy'):hold>buy+sell?'Hold':'Sell',
      targetMedian:t?.targetMedian||t?.targetConsensus||null,
      targetMean:t?.targetMean||null,targetHigh:t?.targetHigh||null,targetLow:t?.targetLow||null,
      peRatio:p?.pe?parseFloat(p.pe).toFixed(1)+'×':null,
      sector:p?.sector||null,industry:p?.industry||null,
      marketCap:p?.mktCap||null,description:p?.description||null,
      earningsDate:nextE?.date||null,
      earningsEPS:nextE?.epsEstimated?'$'+parseFloat(nextE.epsEstimated).toFixed(2)+' EPS est':null,
      earningsRevenue:nextE?.revenueEstimated?'$'+(nextE.revenueEstimated/1e9).toFixed(1)+'B est':null,
      daysToEarnings,
      source:'financialmodelingprep.com',
    });
  } catch(e){res.status(500).json({error:e.message});}
});

// ── AI INTELLIGENCE SUMMARY ───────────────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  if (!OPENAI_KEY) return res.status(503).json({error:'OPENAI_API_KEY not configured.'});

  const {
    symbol, companyName, price, prevClose, change, changePct,
    high, low, volume, vwap, avgVolume,
    rsi, macd, ema9, ema20, sma20, sma50, sma200,
    bbUpper, bbLower, atr, atrPct, rvol,
    marketOpen, recentBars,
    // New enriched context
    spyChangePct, qqqChangePct, vixLevel,
    sectorSymbol, sectorChangePct, sectorName,
    week52High, week52Low, distFrom52High, distFrom52Low,
    orbHigh, orbLow, orbBreakout,
    daysToEarnings, earningsDate, earningsEPS,
    recentNews,
    relPerf5d, sectorRelPerf5d,
  } = req.body;

  // ── DERIVED SIGNALS ──────────────────────────────────────────────────────────
  const aboveVwap   = price > vwap;
  const aboveEma9   = ema9   ? price > ema9   : null;
  const aboveEma20  = ema20  ? price > ema20  : null;
  const aboveSma50  = price > sma50;
  const aboveSma200 = price > sma200;
  const macdBull    = macd > 0;
  const rsiOB=rsi>70, rsiOS=rsi<30;
  const bbPct = bbUpper!==bbLower ? ((price-bbLower)/(bbUpper-bbLower)*100).toFixed(0) : 50;
  const earningsRisk = daysToEarnings !== null && daysToEarnings <= 14;

  // Weighted signal score (not all signals equal)
  // Price structure (40% weight): SMA50, SMA200, EMA9, VWAP
  // Momentum (30% weight): MACD, RSI zone, 5d momentum
  // Volume/Flow (30% weight): RVOL, VWAP position
  const priceScore  = [aboveSma200, aboveSma50, aboveEma20, aboveVwap].filter(Boolean).length;
  const momentumScore = [macdBull, !rsiOB, rsi > 45].filter(Boolean).length;
  const flowScore   = [aboveVwap, rvol>1.2].filter(Boolean).length;
  const totalScore  = (priceScore/4)*40 + (momentumScore/3)*30 + (flowScore/2)*30;
  const trendLabel  = totalScore>=75?'STRONG UPTREND':totalScore>=55?'MODERATE UPTREND':totalScore>=40?'NEUTRAL/MIXED':totalScore>=25?'MODERATE DOWNTREND':'STRONG DOWNTREND';

  let mom5d=null;
  if(recentBars?.length>=2){const o=recentBars[0]?.c,n=recentBars[recentBars.length-1]?.c;if(o&&n)mom5d=((n-o)/o*100).toFixed(2);}

  // ── PART 2 — ENRICHED DATA CONTEXT ──────────────────────────────────────────
  const dataContext = `
╔══════════════════════════════════════════════════════════╗
  GFinHub AI Intelligence Summary Request
  ${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
  Market: ${marketOpen?'OPEN':'CLOSED'} | ${companyName} (${symbol})
╚══════════════════════════════════════════════════════════╝

━━━ PRICE ACTION ━━━
Current:      $${price}
Prev Close:   $${prevClose}
Day Change:   ${change>=0?'+':''}$${Number(change).toFixed(2)} (${changePct>=0?'+':''}${Number(changePct).toFixed(2)}%)
Day Range:    $${low} – $${high}
ATR:          $${Number(atr).toFixed(2)} = ${Number(atrPct).toFixed(1)}% of price (expected daily move)
VWAP:         $${vwap} → price ${aboveVwap?'ABOVE ✓ institutional buyers supporting':'BELOW ✗ sellers in control today'}

━━━ MULTI-TIMEFRAME TREND ALIGNMENT ━━━
EMA 9    ($${ema9?Number(ema9).toFixed(2):'N/A'}):  price ${aboveEma9?'ABOVE ✓':'BELOW ✗'} [very short-term momentum]
EMA 20   ($${ema20?Number(ema20).toFixed(2):'N/A'}): price ${aboveEma20?'ABOVE ✓':'BELOW ✗'} [short-term trend]
SMA 50   ($${Number(sma50).toFixed(2)}): price ${aboveSma50?'ABOVE ✓':'BELOW ✗'} by ${Math.abs(((price-sma50)/sma50*100)).toFixed(1)}% [medium-term]
SMA 200  ($${Number(sma200).toFixed(2)}): price ${aboveSma200?'ABOVE ✓':'BELOW ✗'} by ${Math.abs(((price-sma200)/sma200*100)).toFixed(1)}% [long-term]
Trend Score: ${trendLabel} (weighted signal score: ${totalScore.toFixed(0)}/100)

━━━ MOMENTUM ━━━
RSI(14):  ${Number(rsi).toFixed(1)} [${rsiOB?'OVERBOUGHT >70 — buying may be exhausted':rsiOS?'OVERSOLD <30 — potential bounce zone':'NEUTRAL — momentum balanced'}]
MACD:     ${Number(macd).toFixed(4)} [${macdBull?'BULLISH — positive momentum':'BEARISH — negative momentum'}]
BB Position: ${bbPct}% of band (Upper:$${Number(bbUpper).toFixed(2)} / Lower:$${Number(bbLower).toFixed(2)})
5-Day Momentum: ${mom5d!==null?(mom5d>=0?'+':'')+mom5d+'%':'N/A'}

━━━ VOLUME & INSTITUTIONAL FLOW ━━━
Today Volume: ${Number(volume).toLocaleString()} shares
Avg Volume:   ${avgVolume?Number(avgVolume).toLocaleString():'N/A'}
RVOL:         ${rvol?Number(rvol).toFixed(2)+'x avg':'N/A'} [${rvol>2?'VERY HIGH — major institutional activity':rvol>1.5?'ELEVATED — strong institutional interest':rvol>1?'NORMAL — typical participation':rvol>0.5?'BELOW AVG — quiet session':'VERY LOW — minimal interest'}]

━━━ INTRADAY STRUCTURE ━━━
${orbHigh&&orbLow?`Opening Range (first 30min): $${Number(orbLow).toFixed(2)} – $${Number(orbHigh).toFixed(2)}
ORB Status: ${orbBreakout==='above'?'BROKEN ABOVE ✓ — bullish continuation signal':orbBreakout==='below'?'BROKEN BELOW ✗ — bearish breakdown':price>orbHigh?'ABOVE range (bullish)':price<orbLow?'BELOW range (bearish)':'INSIDE range (consolidating)'}
`:'Opening range: Market closed or data not yet available'}

━━━ 52-WEEK CONTEXT ━━━
52-Week High: ${week52High?'$'+Number(week52High).toFixed(2)+' ('+Number(distFrom52High).toFixed(1)+'% below current high)':'N/A'}
52-Week Low:  ${week52Low?'$'+Number(week52Low).toFixed(2)+' ('+Number(distFrom52Low).toFixed(1)+'% above 52w low)':'N/A'}
${week52High&&distFrom52High<5?'⚠️ Near 52-week high — potential resistance / breakout zone':week52High&&distFrom52High>30?'📉 Far from 52-week high — in recovery or downtrend territory':''}

━━━ MULTI-MARKET CONTEXT ━━━
S&P 500 (SPY):  ${spyChangePct>=0?'+':''}${Number(spyChangePct).toFixed(2)}% today [broad market direction]
NASDAQ (QQQ):   ${qqqChangePct!=null?(qqqChangePct>=0?'+':'')+Number(qqqChangePct).toFixed(2)+'% today [tech benchmark]':'N/A'}
VIX (Fear):     ${vixLevel?Number(vixLevel).toFixed(1)+' ['+( vixLevel>30?'HIGH FEAR — risk-off environment':vixLevel>20?'ELEVATED — uncertainty present':vixLevel>15?'NORMAL':'LOW — complacency/risk-on')+']':'N/A'}
Sector (${sectorSymbol||'N/A'}): ${sectorChangePct!=null?(sectorChangePct>=0?'+':'')+Number(sectorChangePct).toFixed(2)+'% today ['+( sectorName||'sector')+ ']':'N/A'}

${symbol} vs S&P 500:  ${changePct>spyChangePct?'OUTPERFORMING by +'+(changePct-spyChangePct).toFixed(2)+'% (relative STRENGTH)':'UNDERPERFORMING by '+(spyChangePct-changePct).toFixed(2)+'% (relative WEAKNESS)'}
${sectorChangePct!=null?symbol+' vs Sector: '+(changePct>sectorChangePct?'OUTPERFORMING sector by +'+(changePct-sectorChangePct).toFixed(2)+'%':'UNDERPERFORMING sector by '+(sectorChangePct-changePct).toFixed(2)+'%'):''}
${relPerf5d!=null?'5-Day Relative Performance vs S&P: '+(relPerf5d>=0?'+':'')+Number(relPerf5d).toFixed(2)+'%':''}

━━━ EARNINGS & CATALYST RISK ━━━
${earningsRisk?`⚠️ EARNINGS IN ${daysToEarnings} DAYS (${earningsDate}) — ELEVATED BINARY EVENT RISK
Estimate: ${earningsEPS||'N/A'}
IMPORTANT: Analyst confidence should be LOWER than normal. Price scenarios should be WIDER. 
The upcoming earnings report is the single most important risk/catalyst for this stock right now.`
:`Next Earnings: ${earningsDate||'Not available'} (${daysToEarnings!==null?daysToEarnings+' days away':'unknown'})
${daysToEarnings&&daysToEarnings<=30?'Earnings approaching within 30 days — factor into weekly outlook.':''}`}

━━━ LATEST NEWS (Alpaca — with timestamps) ━━━
${recentNews?.length?recentNews.map(n=>`• [${n.time||'Recent'}] ${n.headline} — ${n.source}`).join('\n'):'No recent news available'}
`;

  // ── PART 1 — INTELLIGENT SYSTEM PROMPT ───────────────────────────────────────
  const systemPrompt = `You are the Head of Equity Research at GFinHub. You are writing the AI Intelligence Summary — the single most important output of this platform.

━━━ YOUR ROLE ━━━
You are a professional equity research analyst with deep experience across market cycles. You synthesize quantitative data, market context, news flow, and earnings risk into one clear, honest, actionable verdict. You do NOT report what indicators are doing. You explain what they collectively mean.

━━━ SIGNAL HIERARCHY — HOW TO WEIGHT EVIDENCE ━━━
Use this hierarchy when signals conflict. Higher weight overrides lower weight.

1. EARNINGS RISK (highest weight): If earnings are within 14 days, this dominates everything. Lower confidence, widen scenarios, flag the binary risk prominently. The stock is "in the options zone" and directional calls are unreliable.

2. NEWS CATALYST: If a major news event appears in the headlines (earnings beat/miss, FDA decision, acquisition, guidance change, executive departure), this overrides pure technical signals. A stock can be technically bearish but fundamentally bullish based on a news catalyst.

3. INSTITUTIONAL FLOW (VWAP + RVOL together): This is the most reliable intraday signal. RVOL > 1.5x AND price above VWAP = institutions accumulating. RVOL > 1.5x AND price below VWAP = institutions distributing. Low RVOL = retail noise, ignore daily direction signals.

4. TREND STRUCTURE (SMA50 + SMA200 + EMA9/20 alignment): Multiple timeframe alignment is the backbone. All four above = strong uptrend. All four below = strong downtrend. Mixed = transitional.

5. MOMENTUM (RSI + MACD): Use for timing and confirmation, not as primary signal. Overbought RSI in an uptrend is normal — do not call bearish just because RSI > 70. Oversold RSI in a downtrend can stay oversold. MACD confirms trend direction.

6. MARKET REGIME (VIX + QQQ + Sector): Always contextualize the stock within its environment. VIX > 25 = defensive bias regardless of individual stock technicals. Sector underperformance creates headwinds even for technically strong stocks.

━━━ STOCK TYPE CALIBRATION ━━━
Before writing, determine the stock type from context:
- High-beta growth/tech (NVDA, AMD, META, TSLA): Wider price scenarios, higher volatility is normal, momentum signals more meaningful.
- Large-cap stable (AAPL, MSFT): Tighter scenarios, trend signals more meaningful than momentum.
- Index ETF (SPY, QQQ): No individual catalyst analysis, pure market direction assessment.

━━━ MARKET REGIME RULES ━━━
- VIX > 30: Reduce all confidence scores by 15 points. Add risk-off warning to all sections.
- VIX > 20: Acknowledge uncertainty. Widen scenario ranges by 20%.
- Stock underperforming sector AND market: Flag relative weakness explicitly — this is often the earliest warning of institutional selling.
- Stock outperforming sector AND market: Flag relative strength — institutional accumulation signal.
- 52-week high proximity (within 5%): Flag breakout potential or resistance. This is a key level.
- 52-week low proximity (within 10%): Flag support test or breakdown risk.

━━━ EARNINGS RULES ━━━
- 0-7 days: Confidence max 55%. Scenarios must include earnings outcome range. State clearly this is pre-earnings and direction is binary.
- 8-14 days: Confidence max 70%. Flag earnings as primary risk in Key Risks section.
- 15-30 days: Mention earnings in weekly outlook as an upcoming catalyst.

━━━ WRITING STANDARDS ━━━
- Plain English throughout. If you use a technical term, immediately explain it in parentheses.
- Maximum 30 seconds to read the Summary section.
- Every price you cite must come from the data. Never invent levels.
- Honest about uncertainty. "Signals are mixed" is a valid and valuable verdict.
- Confident tone but not overconfident. Professional analysts acknowledge risk.
- DO NOT list what each indicator is showing. Synthesize them into a narrative.
- DO NOT say "please consult a financial advisor" more than once (only in disclaimer).

━━━ RESPOND WITH ONLY VALID JSON. No markdown. No code blocks. Start with { end with }. ━━━

{
  "recommendation": "BUY" | "HOLD" | "SELL",
  "confidence": <integer 1-99>,

  "aiSummary": {
    "verdict": "Bullish" | "Cautiously Bullish" | "Neutral" | "Cautiously Bearish" | "Bearish",

    "verdictReason": "<One sentence. The single most important reason — the dominant signal from the hierarchy above. Reference a specific price or data point.>",

    "marketRegime": "<One sentence describing the current market environment this stock is operating in — VIX level, sector direction, broad market. This sets the stage for everything else.>",

    "todayOutlook": "<2-3 sentences MAX. What is happening today and why. Reference the dominant intraday signal (VWAP position, ORB status if market open, news if relevant). End with the most likely scenario for today's session. NO jargon.>",

    "weekOutlook": "<2-3 sentences MAX. Weekly direction and the primary driver. Reference the dominant trend, any upcoming catalyst (especially earnings if within 30 days), and the one price level that determines the weekly outcome.>",

    "keyDrivers": [
      "<Driver 1 — the most important, specific with number>",
      "<Driver 2>",
      "<Driver 3>",
      "<Driver 4 — only if genuinely adds signal>",
      "<Driver 5 — only if genuinely adds signal>"
    ],

    "keyRisks": [
      "<Risk 1 — most important, with specific price or event. If earnings within 14 days, this must be Risk 1.>",
      "<Risk 2>",
      "<Risk 3>"
    ],

    "priceScenarios": {
      "bull": {
        "label": "Bullish Scenario",
        "target": <number — based on resistance levels or ATR projection>,
        "probability": <integer 0-100>,
        "description": "<One sentence: specific condition needed and timeframe.>"
      },
      "neutral": {
        "label": "Neutral Scenario",
        "target": <number — consolidation range midpoint>,
        "probability": <integer 0-100>,
        "description": "<One sentence: range-bound outcome.>"
      },
      "bear": {
        "label": "Bearish Scenario",
        "target": <number — key support level from data>,
        "probability": <integer 0-100>,
        "description": "<One sentence: trigger and floor.>"
      }
    },

    "keyLevels": {
      "support": <number>,
      "supportLabel": "<source>",
      "resistance": <number>,
      "resistanceLabel": "<source>",
      "stopReference": <number — where risk-aware investors would exit>,
      "stopNote": "<One sentence on why this stop makes sense given ATR.>"
    },

    "earningsNote": "<If earnings within 30 days: specific note on the earnings risk, date, estimate, and what to watch. If not relevant: null>"
  },

  "todayOutlookFull": {
    "direction": "UP" | "DOWN" | "NEUTRAL",
    "directionLabel": "<e.g. 'Constructive — Buyers in Control' | 'Under Pressure' | 'Range-Bound'>",
    "expectedHigh": <number>,
    "expectedLow": <number>,
    "keyLevelToWatch": <number>,
    "keyLevelReason": "<Why this exact level matters today>",
    "narrative": "<5 sentences. Thorough today analysis. Lead with the dominant intraday signal, explain volume context, describe momentum state, identify key levels for bulls and bears, and close with the most likely scenario. Dollar levels throughout.>",
    "facts": [
      {"icon":"💰","title":"Intraday Control","body":"<VWAP at $X — specific sentence on who controls today's session>"},
      {"icon":"⚡","title":"Momentum State","body":"<RSI + MACD combined reading in plain English>"},
      {"icon":"📦","title":"Volume Signal","body":"<RVOL reading — what institutional activity level means practically>"},
      {"icon":"🎯","title":"The Level That Matters","body":"<Single most important price level today and exactly what happens at it>"}
    ]
  },

  "weekOutlookFull": {
    "direction": "UP" | "DOWN" | "NEUTRAL",
    "directionLabel": "<Weekly bias label>",
    "expectedHigh": <number>,
    "expectedLow": <number>,
    "baseCase": <number>,
    "bullCase": <number>,
    "bearCase": <number>,
    "narrative": "<6 sentences. Full weekly analysis. Open with the dominant weekly driver, describe trend structure, explain the relative performance signal, address the earnings risk if applicable, name support and resistance for the week, close with what investors should monitor each day.>",
    "facts": [
      {"icon":"🏛️","title":"Trend Structure","body":"<Multi-timeframe alignment this week — specific levels>"},
      {"icon":"🌐","title":"Relative Strength","body":"<How stock is performing vs sector and market this week>"},
      {"icon":"🎯","title":"Key Support","body":"<Most important support this week with source>"},
      {"icon":"🚧","title":"Key Resistance","body":"<Most important resistance this week with source>"},
      {"icon":"⚠️","title":"Primary Risk","body":"<The single thing that would change the weekly outlook — earnings, level break, or macro>"}
    ]
  },

  "threeMonthTargets": {
    "bull": <number>,
    "base": <number>,
    "bear": <number>,
    "bullReasoning": "<2 sentences>",
    "baseReasoning": "<2 sentences>",
    "bearReasoning": "<2 sentences>",
    "probabilityBull": <0-100>,
    "probabilityBase": <0-100>,
    "probabilityBear": <0-100>
  },

  "catalysts": {
    "bull": ["<catalyst 1 — specific to data/news>","<catalyst 2>","<catalyst 3>","<catalyst 4>"],
    "bear": ["<risk 1 — specific>","<risk 2>","<risk 3>","<risk 4>"]
  },

  "indicators": {
    "trendPanel": {
      "title": "Price Trend",
      "reading": "BULLISH" | "BEARISH" | "MIXED",
      "summary": "<One sentence verdict on trend.>",
      "explanation": "<4 sentences. Multi-timeframe alignment in plain English. What EMA9/20 means for short-term traders. What SMA50/200 means for investors. Specific dollar levels throughout.>",
      "whatToWatch": "<Exact price that would change the trend reading.>"
    },
    "momentumPanel": {
      "title": "Momentum & Timing",
      "reading": "STRONG" | "MODERATE" | "WEAK" | "EXHAUSTED" | "RECOVERING",
      "summary": "<One sentence verdict on momentum.>",
      "explanation": "<4 sentences. RSI and MACD in plain English — what the numbers mean for the investor, not what the indicator values are. Connect to current price action. What to expect.>",
      "whatToWatch": "<Signal that would change momentum reading.>"
    },
    "volumePanel": {
      "title": "Volume & Institutional Flow",
      "reading": "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL" | "CLIMACTIC",
      "summary": "<One sentence on who is in control.>",
      "explanation": "<4 sentences. VWAP plain English — what it is and what today's position reveals. RVOL context — what the volume level tells us about institutional presence. What retail investors should do with this information.>",
      "whatToWatch": "<Volume signal that would change the institutional reading.>"
    },
    "volatilityPanel": {
      "title": "Volatility & Risk",
      "reading": "HIGH" | "NORMAL" | "LOW" | "COMPRESSING",
      "summary": "<One sentence on volatility context.>",
      "explanation": "<4 sentences. ATR in dollar terms with practical position sizing context. Bollinger Band position — where price sits in its recent range. What the current volatility level means for risk management. If VIX is elevated, connect it to this stock.>",
      "whatToWatch": "<Volatility signal to watch.>"
    }
  },

  "analystNote": "<3-4 sentences. Professional closing paragraph. Synthesize the overall picture, state the key debate about this stock among professional investors, and give one clear actionable perspective. Leave the reader knowing exactly what they are deciding.>",

  "disclaimer": "This analysis is generated by GFinHub AI using live market data and is for informational purposes only. It does not constitute financial advice. Always conduct your own research."
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{'Authorization':`Bearer ${OPENAI_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:OPENAI_MODEL,
        messages:[
          {role:'system',content:systemPrompt},
          {role:'user',content:`Write the GFinHub AI Intelligence Summary. Return ONLY valid JSON:\n\n${dataContext}`},
        ],
        temperature:0.2,
        max_tokens:4000,
        response_format:{type:'json_object'},
      }),
    });
    const data=await response.json();
    if(!response.ok){console.error('OpenAI error:',data);return res.status(response.status).json({error:data.error?.message||'OpenAI error'});}
    let analysis;
    try{analysis=JSON.parse(data.choices?.[0]?.message?.content||'{}');}
    catch(e){return res.status(500).json({error:'Failed to parse AI response'});}
    res.json({analysis,model:OPENAI_MODEL,timestamp:new Date().toISOString()});
  } catch(e){console.error('OpenAI error:',e.message);res.status(500).json({error:e.message});}
});

app.listen(PORT,()=>{
  console.log(`GFinHub v6 on port ${PORT} | OpenAI:${!!OPENAI_KEY} | FMP:${!!FMP_KEY}`);
});
