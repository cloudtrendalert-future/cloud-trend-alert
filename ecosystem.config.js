module.exports = {
  apps: [
    {
      name: 'cloud-trend-alert',
      script: 'src/app/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        TZ: 'UTC'
      }
    }
  ]
};
