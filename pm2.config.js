module.exports = {
  apps: [
    {
      name: 'coverage',
      script: './build/app.js',
      args: '',
      cwd: '/www/coverage/',
      watch: false,
      interpreter: 'node',
      instance_var: 'INSTANCE_ID',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    }
  ],
};
