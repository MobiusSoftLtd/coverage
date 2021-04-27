import WebSocket from 'ws';
import EventEmitter from 'events';

export default class WS extends EventEmitter {
  constructor(host, userAgent, session = 'trader') {
    super();

    this._host = host;
    this._userAgent = userAgent;
    this._session = session;
    this._reqId = 0;
    this._callbacks = {};

    this._reconnectInterval = 1000;
  }

  open() {
    this._socket = new WebSocket(
      `wss://${this._host}/websockets?session=${this._session}`,
      '',
      {
        headers: {
          'User-Agent': this._userAgent,
        },
      }
    );

    this._socket.on('open', () => {
      this.emit('open');
    });

    this._socket.on('message', data => {
      const [name, args = [], id] = JSON.parse(data);
      if (name === 'cb') {
        const fn = this._callbacks[id];
        if (fn) {
          delete this._callbacks[id];
          fn(...args);
        }
      } else {
        this.emit(name, ...args);
      }
    });

    this._socket.on('close', e => {
      console.log('close', e);
      this.reconnect(e);
      this.emit('close', e);
    });

    this._socket.on('error', e => {
      console.log('error', e.message || e);
      this.reconnect(e);
    });

    setInterval(() => {
      if (this._socket) {
        this._socket.ping();
      }
    }, 10000);
  }

  send(name, ...args) {
    const len = args.length;
    const data = [name, args];

    if (len && typeof args[len - 1] === 'function') {
      this._callbacks[this._reqId] = args.splice(len - 1, 1)[0];
      data.push(this._reqId++);
    }

    try {
      this._socket.send(JSON.stringify(data));
    } catch (e) {
      this.emit('error', e);
    }
  }

  reconnect() {
    this._socket.removeAllListeners();

    setTimeout(() => {
      this.open();
    }, this._reconnectInterval);
  }

  terminate() {
    if (this._socket) {
      this._socket.terminate();
      this._socket.removeAllListeners();
    }
  }

  close(code, data) {
    if (this._socket) {
      this._socket.close(code, data);
      this._socket.removeAllListeners();
    }
  }
}
