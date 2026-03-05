# Deploy Guide

## GitHub
```bash
git add -A
git commit -m "feat: build lane-based futures telegram bot skeleton"
git push
```

## VPS (PM2)
```bash
ssh user@your-vps
cd /path/to/CLOUD-TREND-ALERT
git pull
npm ci --omit=dev
pm2 start ecosystem.config.js --env production || pm2 restart cloud-trend-alert
pm2 save
pm2 logs cloud-trend-alert --lines 200
```
