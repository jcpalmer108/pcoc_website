module.exports = [
    {
      name: 'pcoc-website',
      script: 'app.js',
      error_file: '/usr/share/nginx/logs/pm2-error.log',
      out_file: '/usr/share/nginx/logs/pm2-out.log',
      log_file: '/usr/share/nginx/logs/pm2.log'
    },
  ];