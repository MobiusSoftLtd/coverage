require('@babel/register')({
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
          browsers: [
            'last 1 versions',
            'not ie <= 12',
            'not android <= 100',
            'not edge <= 100',
          ],
        },
        useBuiltIns: 'usage',
        corejs: '3',
      },
    ],
  ],
  plugins: [],
});

// Setup global variables for server-side
global.__DEV__ = process.env.NODE_ENV !== 'production';

// Run server
require('./src/app');
