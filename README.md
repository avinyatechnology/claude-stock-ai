# Claude Stock AI — Alpaca Trading App

Mobile-first stock analysis app powered by Claude Stock AI rules + Alpaca API.
Your API keys stay secure on the server. The browser never sees them.

---

## Deploy to Render in 5 steps

### Step 1 — Push this folder to GitHub
1. Go to github.com → New repository → name it `claude-stock-ai`
2. Upload all files from this folder (drag and drop works)
3. Click Commit changes

### Step 2 — Create a Render account
Go to render.com → Sign up free (no credit card needed)

### Step 3 — Create a new Web Service
1. Click **New** → **Web Service**
2. Connect your GitHub account
3. Select the `claude-stock-ai` repository
4. Render auto-detects the settings from render.yaml — do NOT change anything

### Step 4 — Add your Alpaca API keys (this is the only thing you fill in)
In the Render dashboard after creating the service:
1. Click **Environment** in the left sidebar
2. Add these two variables:

   | Key | Value |
   |-----|-------|
   | ALPACA_KEY | your Alpaca API Key ID |
   | ALPACA_SECRET | your Alpaca Secret Key |

   ALPACA_MODE is already set to `paper` in render.yaml

3. Click **Save Changes**

### Step 5 — Open your app
Render gives you a URL like: `https://claude-stock-ai.onrender.com`
Open it on your phone — the app loads, connects to Alpaca, and shows live data.

---

## Get your free Alpaca API keys
1. Go to alpaca.markets → Sign up free
2. Dashboard → Paper Trading → API Keys → Generate
3. Copy the Key ID and Secret Key into Render environment variables

---

## How it works (security model)

```
Your Phone (browser)
      ↓  calls /api/account, /api/quotes, /api/orders
Your Render Server (server/index.js)
      ↓  adds ALPACA_KEY + ALPACA_SECRET headers
Alpaca API (alpaca.markets)
```

Your API keys are stored only in Render's encrypted environment variables.
They never appear in the browser, in the HTML, or in any code file.

---

## File structure
```
claude-stock-ai/
├── server/
│   └── index.js        ← Express backend (proxy to Alpaca)
├── public/
│   └── index.html      ← Mobile app (served by Express)
├── package.json
├── render.yaml         ← Render deployment config (no changes needed)
└── .gitignore
```

---

## Claude Stock AI rules applied
- 30+ technical indicators (RSI, MACD, VWAP, Bollinger Bands, ATR, SMA, EMA, OBV, RVOL)
- 5-category signal scoring system
- Day-by-day weekly scenario with holiday detection
- ATR-based stop sizing (1.5× ATR rule)
- Position sizer with 1-2% account risk enforcement
- Intraday timing rules (avoid open chaos, lunchtime trap, Power Hour)
- RSI overbought entry rule enforced
- Long + short trade setups with R/R ratio
- Live order placement via Alpaca paper/live trading API
