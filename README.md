# GFinHub — AI Stock Intelligence Platform

Professional mobile stock analysis app powered by Claude Stock AI rules + Alpaca Markets API.
Live market data, AI-generated verdicts, institutional flow analysis, news sentiment, and market direction — all in a clean mobile interface.

---

## What this app does

- **Market Direction** — live overview of S&P 500, NASDAQ tech, and key sector performance with breadth scoring
- **News Sentiment** — live financial news pulled from Alpaca News API with AI sentiment scoring (Bullish / Bearish / Neutral)
- **Stock Analysis** — tap any ticker for a full AI analyst verdict: BUY / HOLD / SELL with plain-English reasoning
- **AI Analyst Verdict** — explains why a stock is selling off or rallying, institutional flow signals, market context, and trend health
- **Indicators** — professional plain-English insights replacing raw numbers: Price Trend, Momentum, Volume & Institutional Activity, Volatility
- **Outlook tab** — Today's and This Week's narrative outlook plus 3-month Bull / Base / Bear price targets
- **Watchlist** — NVDA, AAPL, TSLA, META, MSFT, AMD, SPY with live quotes and quick AI signals

---

## Deploy to Render — 4 steps

### Step 1 — Push to GitHub
1. Go to github.com → New repository → name: `gfinhub`
2. Upload all files from this folder (drag and drop the contents, not the folder itself)
3. Click **Commit changes**

### Step 2 — Create Render Web Service
1. Go to render.com → **New** → **Web Service**
2. Connect your GitHub account → select `gfinhub` repo
3. Render auto-reads `render.yaml` — do NOT change any settings
4. Click **Create Web Service**

### Step 3 — Add your Alpaca API keys (only thing you fill in)
In Render dashboard → **Environment** → Add these variables:

| Key | Value |
|-----|-------|
| `ALPACA_KEY` | Your Alpaca API Key ID |
| `ALPACA_SECRET` | Your Alpaca Secret Key |
| `ALPACA_MODE` | `paper` |

Click **Save Changes** → Render restarts automatically.

### Step 4 — Open on your phone
Your live URL: `https://gfinhub.onrender.com` (or whatever Render assigns)

**iPhone:** Safari → Share → Add to Home Screen → GFinHub → Add
**Android:** Chrome → three dots → Add to Home Screen → Add

---

## Get your free Alpaca API keys
1. alpaca.markets → Sign up free
2. Dashboard → **Paper Trading** → **API Keys** → Generate
3. Copy Key ID and Secret → paste into Render Environment

---

## API endpoints (14 total)

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Server health + key status check |
| `GET /api/account` | Portfolio value, buying power, P&L |
| `GET /api/positions` | Open positions with unrealized P&L |
| `GET /api/quotes?symbols=` | Live snapshots: price, VWAP, volume, bars |
| `GET /api/bars/:symbol` | Historical OHLCV bar data |
| `GET /api/latest/:symbol` | Latest trade for a ticker |
| `GET /api/clock` | Market open/closed status + next open/close |
| `GET /api/calendar` | Trading calendar |
| `GET /api/orders` | Order history |
| `POST /api/orders` | Place an order |
| `DELETE /api/orders/:id` | Cancel an order |
| `GET /api/watchlists` | Alpaca watchlists |
| `GET /api/portfolio/history` | Equity curve history |
| `GET /api/news?symbols=` | Live financial news with ticker association |

---

## Security model

```
Your Phone (browser)
      ↓  calls /api/* — no keys ever in browser
Your Render Server (server/index.js)
      ↓  adds ALPACA_KEY + ALPACA_SECRET server-side
Alpaca Markets API
```

API keys live only in Render's encrypted environment variables. Never exposed to the browser.

---

## File structure

```
gfinhub/
├── server/
│   └── index.js        ← Express backend (Alpaca proxy, 14 endpoints)
├── public/
│   └── index.html      ← Full mobile app (served by Express)
├── package.json
├── render.yaml         ← Render auto-deploy config (no changes needed)
├── .gitignore
└── README.md
```

---

## Claude Stock AI rules applied

All analysis follows the Claude Stock AI framework v2.0:
- 30+ technical indicators across 6 categories
- Institutional flow analysis (VWAP, volume, RVOL)
- Stock-specific sell-off and rally explanations
- Market breadth and relative strength context
- AI sentiment scoring on live news
- Professional plain-English insights (not raw numbers)
- 3-month Bull / Base / Bear price projections
- Analyst consensus with Buy / Hold / Sell breakdown

---

## Disclaimer

GFinHub is an AI-powered stock analysis platform for informational and educational purposes only.
Not financial advice. Not a registered investment advisor. Not FDIC insured.
Always conduct your own research and consult a qualified financial advisor before making investment decisions.

© 2026 GFinHub
