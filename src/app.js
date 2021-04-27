import WebSocket from 'ws';

import config from './config';
import connectionHandler from './lib/connectionHandler';
import MobiusTraderClient from './lib/MobiusTraderClient';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

process.on(
  'unhandledRejection',
  (reason, p, ...args) => {
    console.error(
      'Unhandled Rejection at:',
      p,
      'reason:',
      reason,
      args
    );

    process.exit(1);
  }
);

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception: ', err);
  process.exit(1);
});

(async () => {
  await MobiusTraderClient();

  const wss = new WebSocket.Server({
    port: config.port,
    verifyClient: (info, cb) => {
      if (info.req.headers.authorization !== config.authToken) {
        cb(false, 401, 'Unauthorized')
      } else {
        cb(true)
      }
    }
  });

  wss.on('connection', connectionHandler);
})();
