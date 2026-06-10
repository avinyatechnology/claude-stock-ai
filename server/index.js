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
  model:OPENAI_MODEL, version:'7.0.0',
}));

app.get('/api/account',  async (req,res) => { try{const r=await fetch(`${TRADING_BASE}/v2/account`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});} });
app.get('/api/positions',async (req,res) => { try{const r=await fetch(`${TRADING_BASE}/v2/positions`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});} });
app.get('/api/orders',   async (req,res) => { try{const qs=new URLSearchParams(req.query).toString();const r=await fetch(`${TRADING_BASE}/v2/orders?${qs}`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});} });
app.post('/api/orders',  async (req,res) => { try{const r=await fetch(`${TRADING_BASE}/v2/orders`,{method:'POST',headers:alpacaHeaders(),body:JSON.stringify(req.body)});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});} });
app.delete('/api/orders/:id',async(req,res)=>{try{const r=await fetch(`${TRADING_BASE}/v2/orders/${req.params.id}`,{method:'DELETE',headers:alpacaHeaders()});res.status(r.status).json({cancelled:true});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/quotes',   async (req,res) => { try{const r=await fetch(`${DATA_BASE}/v2/stocks/snapshots?symbols=${req.query.symbols||'AAPL'}&feed=iex`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});} });
app.get('/api/bars/:symbol', async (req,res) => {
  try {
    const {symbol}=req.params;
    const days=Math.min(parseInt(req.query.limit)||30,220);
    const start=req.query.start||new Date(Date.now()-days*1.5*86400000).toISOString();
    const end=req.query.end||new Date().toISOString();
    const r=await fetch(`${DATA_BASE}/v2/stocks/${symbol}/bars?timeframe=${req.query.timeframe||'1D'}&start=${start}&end=${end}&limit=${days}&feed=iex`,{headers:alpacaHeaders()});
    res.status(r.status).json(await r.json());
  }catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/latest/:symbol',async(req,res)=>{try{const r=await fetch(`${DATA_BASE}/v2/stocks/${req.params.symbol}/trades/latest?feed=iex`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/clock',    async(req,res)=>{try{const r=await fetch(`${TRADING_BASE}/v2/clock`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/calendar', async(req,res)=>{try{const qs=new URLSearchParams(req.query).toString();const r=await fetch(`${TRADING_BASE}/v2/calendar?${qs}`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/watchlists',async(req,res)=>{try{const r=await fetch(`${TRADING_BASE}/v2/watchlists`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/portfolio/history',async(req,res)=>{try{const qs=new URLSearchParams(req.query).toString();const r=await fetch(`${TRADING_BASE}/v2/account/portfolio/history?${qs}`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/asset/:symbol',async(req,res)=>{try{const r=await fetch(`${TRADING_BASE}/v2/assets/${req.params.symbol.toUpperCase()}`,{headers:alpacaHeaders()});res.status(r.status).json(await r.json());}catch(e){res.status(500).json({error:e.message});}});

// ── ASSET SEARCH — live search across all tradeable US stocks ─────────────────
// Alpaca /v2/assets returns all assets; we filter by query matching ticker or name
app.get('/api/search', async(req,res)=>{
  const q = (req.query.q||'').trim();
  if (!q || q.length < 1) return res.json({results:[]});
  try {
    // Fetch all active US equities from Alpaca
    // status=active, asset_class=us_equity
    const r = await fetch(
      `${TRADING_BASE}/v2/assets?status=active&asset_class=us_equity`,
      { headers: alpacaHeaders() }
    );
    if (!r.ok) return res.status(r.status).json({results:[]});
    const assets = await r.json();

    const ql = q.toLowerCase();
    const qu = q.toUpperCase();

    // Score each asset for relevance
    const scored = [];
    for (const a of assets) {
      if (!a.tradable || !a.symbol) continue;
      const sym  = a.symbol.toUpperCase();
      const name = (a.name||'').toLowerCase();
      let score = 0;
      if (sym === qu)                  score = 100; // exact ticker match
      else if (sym.startsWith(qu))     score = 80;  // ticker starts with query
      else if (name.startsWith(ql))    score = 60;  // name starts with query
      else if (name.includes(' '+ql))  score = 40;  // word in name matches
      else if (name.includes(ql))      score = 20;  // substring in name
      else continue; // no match
      scored.push({ t:sym, n:a.name||sym, s:a.exchange||'', score });
    }

    // Sort by score desc, then alphabetically by ticker
    scored.sort((a,b) => b.score-a.score || a.t.localeCompare(b.t));

    res.json({ results: scored.slice(0,12) });
  } catch(e) {
    console.error('Search error:', e.message);
    res.status(500).json({results:[], error:e.message});
  }
});

app.get('/api/news', async(req,res)=>{
  try{
    const symbols=req.query.symbols||'NVDA,AAPL,TSLA,META,MSFT,AMD,SPY';
    const limit=Math.min(parseInt(req.query.limit)||10,20);
    const [a,b]=await Promise.all([
      fetch(`${DATA_BASE}/v1beta1/news?symbols=${symbols}&limit=${limit}&sort=desc&include_content=false`,{headers:alpacaHeaders()}).then(r=>r.json()).catch(()=>null),
      fetch(`${DATA_BASE}/v1beta1/news?limit=5&sort=desc&include_content=false`,{headers:alpacaHeaders()}).then(r=>r.json()).catch(()=>null),
    ]);
    const seen=new Set();
    const news=[...(a?.news||[]),...(b?.news||[])].filter(n=>{if(seen.has(n.id))return false;seen.add(n.id);return true;}).sort((x,y)=>new Date(y.created_at)-new Date(x.created_at)).slice(0,limit);
    res.json({news,source:'alpaca',count:news.length});
  }catch(e){res.status(500).json({error:e.message,news:[]});}
});

app.get('/api/analyst/:symbol', async(req,res)=>{
  const sym=req.params.symbol.toUpperCase();
  if(!FMP_KEY) return res.status(503).json({error:'FMP_API_KEY not set',noKey:true});
  try{
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
    const daysToEarnings=nextE?.date?Math.round((new Date(nextE.date)-now)/86400000):null;
    res.json({
      symbol:sym,totalBuy:buy,totalHold:hold,totalSell:sell,totalAnalysts:buy+hold+sell,
      rating:buy>hold+sell?(r?.analystRatingsStrongBuy>r?.analystRatingsbuy?'Strong Buy':'Buy'):hold>buy+sell?'Hold':'Sell',
      targetMedian:t?.targetMedian||t?.targetConsensus||null,targetMean:t?.targetMean||null,
      targetHigh:t?.targetHigh||null,targetLow:t?.targetLow||null,
      peRatio:p?.pe?parseFloat(p.pe).toFixed(1)+'×':null,
      sector:p?.sector||null,industry:p?.industry||null,
      marketCap:p?.mktCap||null,description:p?.description||null,
      earningsDate:nextE?.date||null,
      earningsEPS:nextE?.epsEstimated?'$'+parseFloat(nextE.epsEstimated).toFixed(2)+' EPS est':null,
      earningsRevenue:nextE?.revenueEstimated?'$'+(nextE.revenueEstimated/1e9).toFixed(1)+'B est':null,
      daysToEarnings,source:'financialmodelingprep.com',
    });
  }catch(e){res.status(500).json({error:e.message});}
});

// ── AI INTELLIGENCE SUMMARY ───────────────────────────────────────────────────
app.post('/api/analyze', async(req,res)=>{
  if(!OPENAI_KEY) return res.status(503).json({error:'OPENAI_API_KEY not configured.'});

  const {
    symbol,companyName,price,prevClose,change,changePct,
    high,low,volume,vwap,avgVolume,
    rsi,macd,ema9,ema20,sma20,sma50,sma200,
    bbUpper,bbLower,atr,atrPct,rvol,
    marketOpen,recentBars,
    spyChangePct,qqqChangePct,vixLevel,
    sectorSymbol,sectorChangePct,sectorName,
    week52High,week52Low,distFrom52High,distFrom52Low,
    orbHigh,orbLow,orbBreakout,
    daysToEarnings,earningsDate,earningsEPS,
    recentNews,relPerf5d,
  } = req.body;

  // Derived signals
  const aboveVwap=price>vwap, aboveSma50=price>sma50, aboveSma200=price>sma200;
  const macdBull=macd>0, rsiOB=rsi>70, rsiOS=rsi<30;
  const bbPct=bbUpper!==bbLower?((price-bbLower)/(bbUpper-bbLower)*100).toFixed(0):50;
  const earningsNear=daysToEarnings!==null&&daysToEarnings<=14;
  const earningsSoon=daysToEarnings!==null&&daysToEarnings<=30&&!earningsNear;
  const bullCount=[aboveVwap,price>sma20,aboveSma50,aboveSma200,macdBull,!rsiOB].filter(Boolean).length;
  const trendScore=bullCount>=5?'STRONG UPTREND':bullCount>=4?'MODERATE UPTREND':bullCount>=3?'NEUTRAL':bullCount>=2?'MODERATE DOWNTREND':'STRONG DOWNTREND';

  let mom5d=null;
  if(recentBars?.length>=2){const o=recentBars[0]?.c,n=recentBars[recentBars.length-1]?.c;if(o&&n)mom5d=((n-o)/o*100).toFixed(2);}

  // News sentiment — scan headlines for key themes
  const newsText = recentNews?.map(n=>n.headline).join(' ').toLowerCase() || '';
  const hasBullNews = ['beat','upgrade','raised','record','partnership','contract','wins','strong','positive','growth','bullish'].some(w=>newsText.includes(w));
  const hasBearNews = ['miss','downgrade','cut','concern','warning','weak','decline','lawsuit','investigation','loss','bearish','laid off','layoff'].some(w=>newsText.includes(w));
  const newsSignal = hasBullNews && !hasBearNews ? 'BULLISH NEWS FLOW' : hasBearNews && !hasBullNews ? 'BEARISH NEWS FLOW' : recentNews?.length ? 'MIXED/NEUTRAL NEWS' : 'NO RECENT NEWS';

  // ══════════════════════════════════════════════════════════════════
  // PART 2 — DATA PACKAGE SENT TO GPT
  // Rich, structured, complete — everything needed for fundamental analysis
  // ══════════════════════════════════════════════════════════════════
  const dataContext = `
╔══════════════════════════════════════════════════════════════╗
  GFinHub AI Intelligence Summary — Full Analysis Request
  ${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
  Market: ${marketOpen?'OPEN':'CLOSED'} | ${companyName} (${symbol})
╚══════════════════════════════════════════════════════════════╝

━━━ PRICE ACTION (Live — Alpaca Markets) ━━━
Current Price:   $${price}
Previous Close:  $${prevClose}
Today's Change:  ${change>=0?'+':''}$${Number(change).toFixed(2)} (${changePct>=0?'+':''}${Number(changePct).toFixed(2)}%)
Day Range:       $${low} → $${high}
Daily Move Size: $${Number(atr).toFixed(2)} (${Number(atrPct).toFixed(1)}% of price = expected normal daily range)
VWAP:            $${vwap} — price is ${aboveVwap?'ABOVE (institutional buyers have been net buyers today)':'BELOW (sellers have controlled today\'s session)'}

━━━ TREND ALIGNMENT (All timeframes) ━━━
EMA 9  ($${ema9?Number(ema9).toFixed(2):'N/A'}): price ${ema9?price>ema9?'ABOVE — very short-term momentum bullish':'BELOW — very short-term momentum bearish':'N/A'}
EMA 20 ($${ema20?Number(ema20).toFixed(2):'N/A'}): price ${ema20?price>ema20?'ABOVE — short-term trend intact':'BELOW — short-term trend broken':'N/A'}
SMA 50 ($${Number(sma50).toFixed(2)}): price ${aboveSma50?'ABOVE':'BELOW'} by ${Math.abs(((price-sma50)/sma50*100)).toFixed(1)}% [medium-term institutional trend]
SMA 200($${Number(sma200).toFixed(2)}): price ${aboveSma200?'ABOVE':'BELOW'} by ${Math.abs(((price-sma200)/sma200*100)).toFixed(1)}% [long-term bull/bear dividing line]
Overall Trend:   ${trendScore} (${bullCount}/6 signals bullish)

━━━ MOMENTUM ━━━
RSI(14): ${Number(rsi).toFixed(1)} — ${rsiOB?'OVERBOUGHT: buying frenzy, exhaustion risk high':rsiOS?'OVERSOLD: panic selling, bounce likely':'NEUTRAL: room to move either direction'}
MACD:    ${macdBull?'POSITIVE — momentum building to upside':'NEGATIVE — momentum building to downside'}
5-Day Momentum: ${mom5d!==null?(mom5d>=0?'+':'')+mom5d+'%':'N/A'}
BB Position:     ${bbPct}% of trading band (0%=near low, 100%=near high; >80% extended, <20% compressed)

━━━ VOLUME & WHO IS TRADING ━━━
Today Volume: ${Number(volume).toLocaleString()}
Average Volume: ${avgVolume?Number(avgVolume).toLocaleString():'N/A'}
RVOL: ${rvol?Number(rvol).toFixed(2)+'x normal':'N/A'} — ${rvol>2?'INSTITUTIONAL LEVEL: large funds actively buying or selling (not retail)':rvol>1.5?'ABOVE AVERAGE: elevated institutional interest, conviction move':rvol>1?'NORMAL: typical day, no unusual participants':rvol>0.5?'QUIET: mainly retail, no strong institutional signal':'VERY THIN: minimal participation, price moves unreliable'}

━━━ INTRADAY STRUCTURE ━━━
${orbHigh&&orbLow?`Opening Range: $${Number(orbLow).toFixed(2)} – $${Number(orbHigh).toFixed(2)}
Status: ${orbBreakout==='above'?'ABOVE OPENING RANGE — bullish intraday setup confirmed':orbBreakout==='below'?'BELOW OPENING RANGE — bearish intraday breakdown':price>orbHigh?'Testing range high':price<orbLow?'Testing range low':'Consolidating inside range'}`:'Opening range data not available'}

━━━ 52-WEEK POSITIONING ━━━
52-Week High: ${week52High?'$'+Number(week52High).toFixed(2)+' — current price is '+Number(distFrom52High).toFixed(1)+'% BELOW annual high':'N/A'}
52-Week Low:  ${week52Low?'$'+Number(week52Low).toFixed(2)+' — current price is '+Number(distFrom52Low).toFixed(1)+'% ABOVE annual low':'N/A'}
${week52High&&distFrom52High<5?'🚨 NEAR 52-WEEK HIGH: breakout attempt OR major resistance — critical zone':week52High&&distFrom52High>40?'⚠️ DEEP DRAWDOWN: far from highs, either recovery opportunity or sustained downtrend':''}
${week52Low&&distFrom52Low<10?'⚠️ NEAR 52-WEEK LOW: support test or breakdown risk — critical zone':''}

━━━ MARKET ENVIRONMENT ━━━
S&P 500 today:    ${spyChangePct>=0?'+':''}${Number(spyChangePct).toFixed(2)}% (${spyChangePct>0.5?'risk-on environment':spyChangePct<-0.5?'risk-off environment':'flat/neutral market'})
NASDAQ (QQQ):     ${qqqChangePct!=null?(qqqChangePct>=0?'+':'')+Number(qqqChangePct).toFixed(2)+'%':'N/A'}
VIX Fear Index:   ${vixLevel?Number(vixLevel).toFixed(1)+' — '+( vixLevel>30?'ELEVATED FEAR: defensive posture warranted, volatility high':vixLevel>20?'ABOVE NORMAL: uncertainty present, position sizing matters':vixLevel>15?'NORMAL: healthy market':'LOW: complacency, risk-on sentiment'):'N/A'}
Sector (${sectorSymbol||'N/A'}): ${sectorChangePct!=null?(sectorChangePct>=0?'+':'')+Number(sectorChangePct).toFixed(2)+'% today':'N/A'}

Relative Performance vs S&P 500: ${changePct>spyChangePct?'OUTPERFORMING by +'+(changePct-spyChangePct).toFixed(2)+'% — RELATIVE STRENGTH (institutions favour this stock over market)':'UNDERPERFORMING by '+(spyChangePct-changePct).toFixed(2)+'% — RELATIVE WEAKNESS (institutions rotating out)'}
${sectorChangePct!=null?`vs Sector (${sectorName||sectorSymbol||'sector'}): ${changePct>sectorChangePct?'OUTPERFORMING sector by +'+(changePct-sectorChangePct).toFixed(2)+'%':'UNDERPERFORMING sector by '+(sectorChangePct-changePct).toFixed(2)+'%'}`:''}
${relPerf5d!=null?`5-Day vs S&P: ${relPerf5d>=0?'+':''}${Number(relPerf5d).toFixed(2)}% (${Math.abs(relPerf5d)>3?'SIGNIFICANT relative '+(relPerf5d>0?'outperformance':'underperformance'):'In-line with market'})`:''}

━━━ EARNINGS & FUNDAMENTAL CATALYSTS ━━━
${earningsNear?`🚨 EARNINGS IN ${daysToEarnings} DAYS — ${earningsDate}
Expected EPS: ${earningsEPS||'estimate not available'}
CRITICAL: This stock is in pre-earnings mode. The entire analysis must reflect earnings binary risk.
Confidence must be lowered. Scenarios must be wider. Every section must mention earnings as primary driver.
Do NOT give a confident directional call — the earnings outcome will override all technical signals.`
:earningsSoon?`⚡ EARNINGS IN ${daysToEarnings} DAYS — ${earningsDate} (approaching)
Expected EPS: ${earningsEPS||'N/A'}
Factor this into the weekly outlook — earnings is the dominant catalyst this month.`
:`Next Earnings: ${earningsDate||'Not known'} — ${daysToEarnings!==null?daysToEarnings+' days away':'date unknown'}`}

━━━ NEWS & FUNDAMENTAL DRIVERS (Alpaca News API) ━━━
News Sentiment Signal: ${newsSignal}
${recentNews?.length?recentNews.map(n=>`• [${n.time}] ${n.headline}
  Source: ${n.source}`).join('\n\n'):'No recent news available for this ticker'}

IMPORTANT NEWS INSTRUCTION: If there are relevant news headlines above, you MUST:
1. Identify which news items are MOST MARKET-MOVING for this stock
2. Explain specifically WHY each key headline is bullish or bearish for the stock
3. Connect the news to the price action — is today's move explained by a specific headline?
4. If no news: explain the move purely from technical and market context
5. NEVER write generic analysis when specific news is available
`;

  // ══════════════════════════════════════════════════════════════════
  // PART 1 — SYSTEM PROMPT
  // The brain that tells GPT HOW to think, not just what to produce
  // ══════════════════════════════════════════════════════════════════
  const systemPrompt = `You are the Head of Equity Research at GFinHub, a professional financial intelligence platform used by serious investors.

═══════════════════════════════════════════════════════
YOUR FUNDAMENTAL MISSION
═══════════════════════════════════════════════════════
Write a complete investment brief that explains WHY this stock is moving, WHO is driving it, and WHAT is likely to happen next. Think of yourself as the analyst on CNBC who just got 3 minutes to explain the stock to a wide audience — from beginners to professional traders. Every sentence must add genuine value.

The user wants to understand:
→ Is the price move driven by NEWS, EARNINGS, or MARKET CONDITIONS — or purely technical?
→ Are BUYERS or SELLERS in control — and who are they (institutions, retail, algorithmic)?
→ What specific NEWS EVENTS or ECONOMIC FACTORS are impacting this stock right now?
→ What are the EXACT reasons this stock might continue up or reverse?
→ What price levels truly MATTER and why?

═══════════════════════════════════════════════════════
HOW TO ANALYZE — THE ANALYST FRAMEWORK
═══════════════════════════════════════════════════════

STEP 1 — NEWS FIRST
Before anything else, read the news headlines. Ask yourself:
- Is there a specific catalyst explaining today's move? (earnings, guidance, deal, downgrade, macro data)
- If yes: this news is the LEAD of your entire analysis. Build everything around it.
- If no news: the move is technically or market-driven. Explain from that angle.
RULE: Never write "the stock is moving due to technical factors" when there is relevant news.

STEP 2 — FUNDAMENTAL CONTEXT
Based on the company name and sector, apply your knowledge:
- What business does this company do and what drives its revenue?
- What macro or sector trends matter most for this stock right now?
- Is this a growth stock, value stock, dividend stock, or speculative name?
- What is the typical investor base — institutions, hedge funds, retail momentum traders?
NOTE: Use your GPT knowledge about the company combined with the live data provided.

STEP 3 — WHO IS IN CONTROL
Read RVOL + VWAP together to determine WHO is trading:
- RVOL > 1.5x AND above VWAP: Institutional ACCUMULATION — large funds buying on this move
- RVOL > 1.5x AND below VWAP: Institutional DISTRIBUTION — large funds selling/exiting
- RVOL < 0.8x: Retail/thin market — do not trust directional moves as significant
- RVOL near 1.0x: Normal participation — no unusual institutional footprint

STEP 4 — SELL-OFF OR RALLY EXPLANATION
If the stock is down significantly: explain the REAL reason
- Is it news-driven? Name the specific headline
- Is it sector rotation? Name which sector is being sold
- Is it earnings fear? Mention the upcoming date
- Is it macro? (Fed, inflation, jobs data) Connect the dots
- Is it technical breakdown? Name the level that broke
NEVER just say "selling pressure" without explaining why.

Same for rallies — name the actual driver.

STEP 5 — EARNINGS HANDLING
If earnings are within 14 days: THIS DOMINATES EVERYTHING
- Lower your confidence to max 55%
- Make scenarios much wider (earnings can gap 10-20%)
- Open EVERY section with the earnings risk
- Explain specifically what the market expects (EPS estimate) and what could surprise

STEP 6 — MARKET REGIME
Connect the stock to its environment:
- Rising VIX + falling SPY = risk-off. Even strong stocks face headwinds.
- Sector outperforming/underperforming SPY = sector rotation story
- 52-week high proximity = breakout opportunity or resistance wall
- Deep drawdown from highs = either recovery play or sustained downtrend

═══════════════════════════════════════════════════════
WRITING RULES — NON-NEGOTIABLE
═══════════════════════════════════════════════════════
1. PLAIN ENGLISH. Write like a smart professional talking to a smart non-expert.
2. SPECIFIC. Name specific prices, percentages, dates, headlines. Never be vague.
3. EXPLAIN THE WHY. Not "RSI is 65" but "buying pressure has been strong but not extreme — the stock has room to run before traders start taking profits."
4. CONNECT DOTS. Link news → price action → volume → likely next move in one coherent story.
5. HONEST. If you don't know why something is happening, say "the move appears primarily technical with no clear fundamental catalyst in the available news."
6. CONCISE. Each section should be complete but not padded. Remove anything that doesn't add information.
7. NO JARGON DUMPS. Explain every technical concept the first time you use it.
8. ONE DISCLAIMER. Do not repeat risk warnings in every section.

═══════════════════════════════════════════════════════
RESPOND WITH ONLY VALID JSON. Start with { end with }
═══════════════════════════════════════════════════════

{
  "recommendation": "BUY" | "HOLD" | "SELL",
  "confidence": <1-99>,

  "aiSummary": {
    "verdict": "Bullish" | "Cautiously Bullish" | "Neutral" | "Cautiously Bearish" | "Bearish",

    "verdictReason": "<The single most important reason — reference the dominant signal. If news exists, lead with the news catalyst and specific price impact. If no news, reference the most important technical or institutional signal with exact price.>",

    "marketRegime": "<One sentence: current market environment, VIX level, sector direction, and what it means for THIS specific stock. E.g. 'Technology sector is underperforming the market by 1.2% today amid rising rate concerns, creating a headwind for [stock] despite solid fundamentals.'>",

    "whatIsMovingThisStock": "<2-3 sentences. This is the most important field. Explain in plain English the PRIMARY reason the stock is moving today — is it a specific news event, earnings, macro data, sector rotation, institutional buying/selling, or technical? Name the exact cause. If multiple factors: rank them by importance. This replaces generic 'the stock is up/down because of market conditions' — be specific.>",

    "buyerSellerControl": "<2 sentences. Who is in control and why do you believe that? Reference RVOL and VWAP specifically but explain them in plain English: 'Institutions (large funds and hedge funds) appear to be [buying/selling] today, with trading volume running at X times the normal level. This level of activity suggests [conviction/distribution/accumulation/profit-taking] rather than routine retail trading.'>",

    "todayOutlook": "<2-3 sentences max. What is most likely to happen today? Start with the news catalyst if present, then direction. End with the key level that determines the outcome.>",

    "weekOutlook": "<2-3 sentences max. What is the stock likely to do this week? Lead with the strongest fundamental or technical driver. Name the key price level for the week. If earnings are within 30 days, this must dominate.>",

    "keyDrivers": [
      "<Driver 1 — if news exists, this must be the news catalyst with specific detail>",
      "<Driver 2 — institutional flow or trend signal with price>",
      "<Driver 3 — relative performance vs market or sector>",
      "<Driver 4 — earnings or fundamental factor if relevant>",
      "<Driver 5 — only include if genuinely meaningful>"
    ],

    "keyRisks": [
      "<Risk 1 — if earnings within 14 days, this must be earnings risk with date and estimate>",
      "<Risk 2 — specific bearish scenario with price level>",
      "<Risk 3 — macro or sector risk with specific context>"
    ],

    "priceScenarios": {
      "bull": {
        "label": "Bullish Scenario",
        "target": <number>,
        "probability": <0-100>,
        "description": "<What needs to happen and what news/catalyst would drive this. Specific.>"
      },
      "neutral": {
        "label": "Neutral Scenario",
        "target": <number>,
        "probability": <0-100>,
        "description": "<Range-bound outcome and what that looks like.>"
      },
      "bear": {
        "label": "Bearish Scenario",
        "target": <number>,
        "probability": <0-100>,
        "description": "<What triggers downside, specific level, and what news/condition would cause it.>"
      }
    },

    "keyLevels": {
      "support": <number>,
      "supportLabel": "<Plain English: what this level represents — '200-day average — where long-term investors typically step in to buy'>",
      "resistance": <number>,
      "resistanceLabel": "<Plain English explanation of what this resistance represents>",
      "stopReference": <number>,
      "stopNote": "<One sentence: why this is the logical exit point for a risk-managed investor.>"
    },

    "earningsNote": "<null if earnings > 30 days away. If within 30 days: explain what is expected, what would be a beat, what would be a miss, and why this binary event matters more than any technical signal right now.>"
  },

  "todayOutlookFull": {
    "direction": "UP" | "DOWN" | "NEUTRAL",
    "directionLabel": "<Specific label like 'Rallying on Earnings Beat' | 'Selling Off on Guidance Cut' | 'Buyers Defending Key Support' | 'Institutional Distribution'>",
    "expectedHigh": <number>,
    "expectedLow": <number>,
    "keyLevelToWatch": <number>,
    "keyLevelReason": "<Plain English: why this exact dollar level matters today — what happens if it holds vs breaks>",
    "narrative": "<5-6 sentences. Lead with the fundamental reason for today's move (news, earnings, macro). Explain who is trading (institutional level based on RVOL/VWAP). Describe the current momentum state in plain language. Name the key bull and bear levels with dollar prices. Close with the single most likely scenario for the remainder of today's session. Every sentence must add new information.>",
    "facts": [
      {"icon":"📰","title":"What Is Driving Today","body":"<The primary fundamental or news catalyst for today's move — connect headline to price action directly>"},
      {"icon":"🏦","title":"Who Is Trading","body":"<RVOL + VWAP combined: who is in control (institutions/retail) and at what conviction level — plain English>"},
      {"icon":"⚡","title":"Momentum Reading","body":"<RSI and MACD in plain English — is buying/selling pressure building or fading right now>"},
      {"icon":"🎯","title":"The Level That Decides Today","body":"<The single most important price level today and EXACTLY what happens if it holds or breaks>"}
    ]
  },

  "weekOutlookFull": {
    "direction": "UP" | "DOWN" | "NEUTRAL",
    "directionLabel": "<Specific weekly bias like 'Bullish — Earnings Catalyst' | 'Bearish — Trend Breakdown' | 'Range-Bound — Awaiting Catalyst'>",
    "expectedHigh": <number>,
    "expectedLow": <number>,
    "baseCase": <number>,
    "bullCase": <number>,
    "bearCase": <number>,
    "narrative": "<6 sentences. Open with the dominant weekly theme (news, trend, earnings). Explain the fundamental backdrop — what macro or sector forces are at work this week. Describe the technical setup and what trend alignment means practically. Address earnings/catalyst risk for the week. Name the specific support and resistance levels that define this week's range with prices. Close with what investors should watch each day — specific catalysts or levels.>",
    "facts": [
      {"icon":"📰","title":"Fundamental Driver This Week","body":"<The primary news/fundamental theme driving this stock this week — specific>"},
      {"icon":"🌐","title":"Market & Sector Context","body":"<How the market environment and sector trend are helping or hindering this week>"},
      {"icon":"🎯","title":"Make or Break Level","body":"<The support level that if it breaks changes everything about the weekly outlook>"},
      {"icon":"🚧","title":"Resistance to Clear","body":"<The resistance bulls need to clear this week to confirm the uptrend — specific price and what it represents>"},
      {"icon":"⚠️","title":"The Wild Card","body":"<The single event, news item, or level that would completely change the weekly outlook if it happens — specific>"}
    ]
  },

  "threeMonthTargets": {
    "bull": <number>,
    "base": <number>,
    "bear": <number>,
    "bullReasoning": "<2 sentences grounded in fundamental and technical factors — what needs to happen in the business AND technically>",
    "baseReasoning": "<2 sentences — the most probable outcome and why>",
    "bearReasoning": "<2 sentences — what fundamental or macro deterioration produces this outcome>",
    "probabilityBull": <0-100>,
    "probabilityBase": <0-100>,
    "probabilityBear": <0-100>
  },

  "catalysts": {
    "bull": [
      "<Bull catalyst 1 — if news exists, connect it. Specific with numbers or dates.>",
      "<Bull catalyst 2 — technical or fundamental>",
      "<Bull catalyst 3>",
      "<Bull catalyst 4>"
    ],
    "bear": [
      "<Bear risk 1 — the most specific, real risk with price level or event>",
      "<Bear risk 2>",
      "<Bear risk 3>",
      "<Bear risk 4>"
    ]
  },

  "indicators": {
    "trendPanel": {
      "title": "Price Trend — The Big Picture",
      "reading": "BULLISH" | "BEARISH" | "MIXED",
      "summary": "<One sentence verdict that explains what the trend means for an investor — not 'price is above SMA50' but 'the stock is in a confirmed medium-term uptrend with institutional support'>",
      "explanation": "<4-5 sentences. Explain the multi-timeframe trend in plain English — what it means for someone holding this stock. Explain WHY being above or below each average matters in terms of investor behaviour and fund flows. Connect to the current price action and the fundamental backdrop from the news. What does the trend structure tell us about whether institutions are accumulating or distributing over the past weeks and months?>",
      "whatToWatch": "<A specific price level AND a specific event that would change the trend reading. E.g. 'A daily close below $X would break the 50-day average and likely trigger systematic fund selling; conversely, a close above $Y would confirm the uptrend is resuming.'>"
    },
    "momentumPanel": {
      "title": "Momentum — Is the Move Accelerating or Fading?",
      "reading": "STRONG" | "MODERATE" | "WEAK" | "EXHAUSTED" | "RECOVERING",
      "summary": "<One sentence on the momentum state in plain English — what does this mean for timing an entry or exit>",
      "explanation": "<4-5 sentences. Explain RSI without using the word 'overbought' or 'oversold' — describe what it actually means for price action. Is buying pressure building, peaking, or fading? What does the MACD tell us about the direction of that change? Connect the momentum reading to any news catalyst or earnings proximity. What historically happens to this type of stock at this momentum level — does it tend to reverse or continue?>",
      "whatToWatch": "<The specific momentum signal that would change the reading — e.g. 'If the MACD crosses above zero while RSI is below 65, that combination typically signals a momentum shift worth acting on.'>"
    },
    "volumePanel": {
      "title": "Volume & Who Is Really Moving This Stock",
      "reading": "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL" | "CLIMACTIC",
      "summary": "<One sentence on who is in control — institutions, retail, or mixed — and whether that is bullish or bearish>",
      "explanation": "<4-5 sentences. Explain in plain English who is actually trading this stock today — institutions (hedge funds, mutual funds, pension funds) or retail investors. What does trading at Xx the average volume tell us about conviction? Is the price move backed by genuine institutional conviction or is it thin retail noise? Connect the VWAP position to the flow story — institutions use VWAP as their execution benchmark, so whether price is above or below tells us which side is winning. What does this mean for the sustainability of today's move?>",
      "whatToWatch": "<The volume signal that would change the reading — specifically what volume level and price combination would confirm or deny the current institutional narrative.>"
    },
    "volatilityPanel": {
      "title": "Volatility & Risk — How Much Can This Move?",
      "reading": "HIGH" | "NORMAL" | "LOW" | "COMPRESSING",
      "summary": "<One sentence on what the current volatility level means for investors practically — are we in a calm period or a storm>",
      "explanation": "<4-5 sentences. Explain ATR in plain dollar terms — 'this stock typically moves $X in a single session, meaning a $10,000 position has a one-day risk of approximately $Y.' Explain what the Bollinger Band position means without using the technical term — describe it as the stock's position within its recent trading range. Connect volatility to the news or earnings context — is volatility elevated because of upcoming events? What does the current VIX environment mean for this specific stock's risk profile? Give the investor practical context for position sizing.>",
      "whatToWatch": "<A specific volatility signal to watch — e.g. 'If the daily range expands beyond $X on above-average volume, it would signal a volatility expansion is underway and wider stops would be needed.'>"
    }
  },

  "analystNote": "<3-4 sentences. Professional closing paragraph written like a Goldman Sachs research note. Synthesize the complete picture: the fundamental story, the technical setup, the news catalyst, and what the balance of risks looks like. State clearly what professional investors are debating about this stock right now. End with one specific, actionable perspective — not generic advice but a clear view on what the data says. This should leave the reader with a complete understanding of exactly what they are deciding.>",

  "disclaimer": "This analysis is generated by GFinHub AI using live market data and is for informational purposes only. It does not constitute financial advice. Always conduct your own research before making investment decisions."
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{'Authorization':`Bearer ${OPENAI_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:OPENAI_MODEL,
        messages:[
          {role:'system',content:systemPrompt},
          {role:'user',content:`Analyze ${companyName} (${symbol}) and write the complete GFinHub AI Intelligence Summary. Return ONLY valid JSON:\n\n${dataContext}`},
        ],
        temperature:0.25,
        max_tokens:4500,
        response_format:{type:'json_object'},
      }),
    });
    const data=await response.json();
    if(!response.ok){console.error('OpenAI error:',data);return res.status(response.status).json({error:data.error?.message||'OpenAI error'});}
    let analysis;
    try{analysis=JSON.parse(data.choices?.[0]?.message?.content||'{}');}
    catch(e){return res.status(500).json({error:'Failed to parse AI response'});}
    res.json({analysis,model:OPENAI_MODEL,timestamp:new Date().toISOString()});
  }catch(e){console.error('OpenAI error:',e.message);res.status(500).json({error:e.message});}
});

app.listen(PORT,()=>{
  console.log(`GFinHub v7 on port ${PORT} | OpenAI:${!!OPENAI_KEY} | FMP:${!!FMP_KEY}`);
});
