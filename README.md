# stole.cc Bot — Setup Guide

## 1. Get your Client ID

Go to discord.com/developers/applications → your app → **General Information** → copy **Application ID**.
Paste it into `bot.js` line: `CLIENT_ID: '...'`

## 2. Invite the bot to your server

Replace `YOUR_CLIENT_ID` and open in browser:
```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=2048
```

## 3. Run locally (test)

```bash
npm install
node bot.js
```

## 4. Host for free on Railway

1. Go to railway.app → New Project → Deploy from GitHub
2. Push bot.js + package.json to a GitHub repo
3. Railway auto-detects Node.js and runs `npm start`
4. Set environment variables in Railway dashboard:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `SUPABASE_URL`
   - `SUPABASE_SECRET`
   - `CHANNEL_ID`
   - `GUILD_ID` (your server ID — for instant command updates)

## Commands

| Command | Description |
|---------|-------------|
| `/sotd <spotify_url>` | Set Song of the Day |
| `/sotd clear` | Remove current SOTD |
| `/motd <quote> [author]` | Set Motto of the Day |
| `/motd clear` | Remove current MOTD |
| `/today` | Show what's currently set |

## Notes

- The bot only responds in the channel specified by `CHANNEL_ID`
- Changes appear on stole.cc immediately (Supabase reads on every page load)
- The secret key is only used by the bot (server-side) — never exposed on the website
