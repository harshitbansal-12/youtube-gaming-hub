# Gaming Hub 🎮

> Live gaming tools for YouTube channels: countdowns, streamer leaderboards, speedrun trackers, and game stats. Built to drive watch hours and monetization.

## 🌟 Features

| Tool | Description | Status |
|------|-------------|--------|
| **Countdown Hub** | 50+ game launches, seasons, events, tournaments with live timers | ✅ Live |
| **Streamer Leaderboards** | Top 50 Twitch + YouTube streamers for any game, real-time | 🚧 Coming Soon |
| **Speedrun WR Tracker** | World records with historical charts, category support | 🚧 Coming Soon |
| **Game Stats Dashboard** | Player counts, server status, patch notes, event timers | 🚧 Coming Soon |

## 🎯 Built for Monetization

- **SEO Optimized**: Ranks for "when does X launch", "game release dates", "[game] live streamers"
- **Watch Hour Drivers**: Embeddable live pages perfect for YouTube Premieres/livestreams
- **UTM Tracking**: Every outbound link tagged for YouTube Analytics attribution
- **Email Capture Ready**: "Notify me when live" forms (easy to add)
- **Shorts Content**: Clip countdown timers → viral Shorts → channel traffic

## 🚀 Quick Start

### 1. Fork & Clone
```bash
git clone https://github.com/YOUR_USERNAME/youtube-gaming-hub.git
cd youtube-gaming-hub
```

### 2. Customize Branding
Edit `shared/styles.css` - update the brand colors at the top:
```css
--color-white: #FFFFFF;        /* Pure White */
--color-navy: #0B1936;         /* Deep Navy Blue */
--color-cyan: #00C8F8;         /* Bright Cyan */
--color-orange: #FF7A00;       /* Vibrant Orange */
--color-light-gray: #E5ECF0;   /* Light Gray */
```

### 3. Add Your Events
Edit `countdowns/data/events.json` - add your game launches, seasons, tournaments:
```json
{
  "id": "my-game-launch",
  "category": "launches",
  "game": "My Game",
  "event": "Global Launch",
  "date": "2025-12-25T00:00:00Z",
  "icon": "https://example.com/icon.jpg",
  "url": "https://example.com",
  "platforms": ["PC", "PS5", "Xbox"],
  "notes": "Most anticipated launch of the year!"
}
```

### 4. Deploy to GitHub Pages
1. Push to GitHub
2. Go to Settings → Pages → Source: "GitHub Actions"
3. The workflow deploys automatically on every push to main
4. Your site lives at `https://YOUR_USERNAME.github.io/youtube-gaming-hub/`

### 5. Custom Domain (Optional)
Add a `CNAME` file to root with your domain:
```
gaming.yourchannel.com
```
Then configure DNS: `CNAME gaming yourusername.github.io`

## 📁 Project Structure

```
youtube-gaming-hub/
├── index.html                    # Landing page
├── countdowns/
│   ├── index.html               # Countdown hub page
│   ├── app.js                   # Countdown logic
│   └── data/
│       └── events.json          # 🎯 EDIT THIS for new events
├── live/                        # Streamer leaderboards (WIP)
├── speedruns/                   # Speedrun WR tracker (WIP)
├── stats/                       # Game stats dashboard (WIP)
├── shared/
│   ├── styles.css               # 🎨 Brand colors & design system
│   └── utils.js                 # Shared utilities (cache, dates, etc.)
└── .github/workflows/
    └── deploy.yml               # GitHub Pages auto-deploy
```

## 🎨 Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Pure White | `#FFFFFF` | Primary background |
| Deep Navy Blue | `#0B1936` | Text, borders, structure |
| Bright Cyan | `#00C8F8` | Primary accent, CTAs, live indicators |
| Vibrant Orange | `#FF7A00` | Secondary accent, highlights |
| Light Gray | `#E5ECF0` | Subtle backgrounds, dividers |

## 🔧 Adding New Countdowns (No Code Required!)

Just edit `countdowns/data/events.json`:

1. Copy an existing event object
2. Change `id` to unique slug (e.g., `gta6-launch`)
3. Update `game`, `event`, `date` (ISO 8601 UTC)
4. Add `icon` URL (game header art works great)
5. Set `category`: `launches`, `seasons`, `events`, `tournaments`, `updates`
6. Commit & push → Live in ~2 minutes!

## 📊 Analytics

Add to `index.html` and each tool page:
```html
<!-- Plausible (privacy-friendly) -->
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>

<!-- Or Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-XXXXXXXXXX');</script>
```

## 🎥 YouTube Integration Tips

1. **End Screens**: Link to `https://yourdomain.com/countdowns/?event=gta6-launch`
2. **Pinned Comments**: "Track all GTA VI countdowns live: [link]"
3. **Community Posts**: "GTA VI launches in 47 days! Live countdown: [link]"
4. **Shorts**: Record 15s of countdown timer → "Full live tracker in bio"
5. **Live Streams**: Embed countdown page in OBS as browser source

## 🛠️ Tech Stack

- **Vanilla JS/HTML/CSS** - No build step, no dependencies
- **GitHub Pages** - Free hosting, HTTPS, custom domains
- **Client-side caching** - localStorage with TTL, respects API rate limits
- **CSS Variables** - Instant theming, dark/light mode
- **ES Modules** - Clean imports, modern browser support

## 📝 License

MIT - Use freely for your channel. Attribution appreciated but not required.

## 🤝 Contributing

1. Fork it
2. Add your game/events to `events.json`
3. PR welcome!

---

**Built for the YouTube gaming community** — If this helps you hit monetization, drop a star ⭐ and share your channel!