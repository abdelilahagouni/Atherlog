module.exports = {
  apps: [
    {
      name: 'aetherlog-backend',
      cwd: './backend',
      script: 'npm',
      args: 'run start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      }
    },
    {
      name: 'aetherlog-python',
      cwd: './python-service',
      script: './venv/bin/python',
      args: 'app.py',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PORT: 5001,
        PYTHONUNBUFFERED: '1'
      }
    }
  ]
};
