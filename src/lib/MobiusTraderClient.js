import { EventEmitter } from 'events';

import config from '../config';
import WebSocket from './WebSocket';

function toInt(number, digits) {
  return Math.floor(parseFloat(`${number}e${digits}`));
}

function toFloat(number, digits) {
  return parseFloat(`${number}e-${digits}`);
}

const TRADE_CMD = {
  BUY: 0,
  SELL: 1,
}

const STATE = {
  NOT_CONNECTED: 0,
  CONNECTING: 1,
  CONNECTED: 1,
}

const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36';

class MobiusTraderClient extends EventEmitter {
  constructor() {
    super();
    this.orderClose = this.orderClose.bind(this);
    this.orderOpen = this.orderOpen.bind(this);
    this.orderSetTicket = this.orderSetTicket.bind(this);
    this.onDisconnect = this.onDisconnect.bind(this);
    this.onConnect = this.onConnect.bind(this);
    this.tradeServerNotify = this.tradeServerNotify.bind(this);

    this.setMaxListeners(1000);

    this._state = STATE.NOT_CONNECTED;
    const { host } = config.account;

    this._symbols = {};
    this._currencies = {};
    this._orders = [];

    this._socket = new WebSocket(host, userAgent, 'trader');
    this._socket.open();

    this._socket.on('init', data => {
      this._orders = data.Orders;
      this._currencies = data.Currencies;
      this._symbols = data.Symbols;

      this._state = STATE.CONNECTED;
      this.emit('connect');
      console.log('connected');
    });

    this._socket.on('close', this.onDisconnect);
    this._socket.on('TradeServerNotify', this.tradeServerNotify);
  }

  onDisconnect() {
    console.log('disconnect');
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this._state === STATE.CONNECTED) {
        resolve();
        return;
      }

      this.once('connect', resolve);

      if (this._state === STATE.CONNECTING) {
        return;
      }

      this._state = STATE.CONNECTING;

      const { login, password, accountNumberId } = config.account;

      this._socket.on('open', () => {
        this._socket.send('Auth', {Login: login, Password: password}, (err, jwt) => {
          if (err) {
            reject(err);
            return;
          }

          this._socket.send('Login', {
            JWT: jwt,
            AccountNumberId: accountNumberId,
          });
        });
      });
    });
  }

  priceToFloat(value, symbolId) {
    const symbol = this._symbols[symbolId];
    return toFloat(value, symbol.FractionalDigits);
  }

  priceToInt(value, symbolId) {
    const symbol = this._symbols[symbolId];
    return toInt(value, symbol.FractionalDigits);
  }

  getVolumeDigits(symbolId) {
    const symbol = this._symbols[symbolId];
    const marginCurrencyData = this._currencies[symbol.MarginCurrencyId];
    return marginCurrencyData ? marginCurrencyData.VolumeFractionalDigits : 0;
  }

  volumeToFloat(value, symbolId) {
    return toFloat(value, this.getVolumeDigits(symbolId));
  }

  volumeToInt(value, symbolId) {
    return toInt(value, this.getVolumeDigits(symbolId));
  }

  orderOpen({SymbolName, Volume, TradeCmd, Price}) {
    return new Promise((resolve, reject) => {
      const symbol = Object.values(this._symbols).find(({Name}) => Name === SymbolName);
      if (!symbol) {
        throw 'SymbolNotFound';
      }
      const symbolId = symbol.Id;

      this._socket.send('OrderOpen', {
        Volume: this.volumeToInt(Volume, symbolId),
        Price: this.priceToInt(Price, symbolId),
        SymbolId: symbolId,
        TradeCmd: TradeCmd === 0 ? TRADE_CMD.BUY : TRADE_CMD.SELL,
      }, (error, orders) => {
        if (error) {
          reject(error);
        } else {
          resolve(orders.map(order => ({
            Ticket: order.Ticket,
            OpenPrice: this.priceToFloat(order.OpenPrice, symbolId),
            Volume: this.volumeToFloat(order.Volume, symbolId),
          })));
        }
      });
    });
  }

  orderSetTicket({Ticket, MobiusTicket}) {
    this._socket.send('OrderModify', {
      Ticket,
      Comment: `#${MobiusTicket}`
    });
  }

  orderClose({MobiusTicket, SymbolName}) {
    return new Promise((resolve, reject) => {
      const existOrder = this._orders.find(({Comment}) => Comment === `#${MobiusTicket}`);
      if (!existOrder) {
        throw 'OrderNotFound';
      }
      const symbol = Object.values(this._symbols).find(({Name}) => Name === SymbolName);
      if (!symbol) {
        throw 'SymbolNotFound';
      }
      const symbolId = symbol.Id;

      this._socket.send('OrderClose', {
        Ticket: existOrder.Ticket,
        Volume: existOrder.Volume,
      }, (error, orders) => {
        if (error) {
          reject(error);
        } else {
          resolve(orders.map(order => ({
            Ticket: order.Ticket,
            ClosePrice: this.priceToFloat(order.ClosePrice, symbolId),
            Volume: this.volumeToFloat(order.Volume, symbolId),
          })));
        }
      });
    });
  }

  tradeServerNotify(message) {
    const order = message.Result;

    if (message.Cmd === 'NotifyOrderOpen') {
      this._orders.push(order);
    } else if (message.Cmd === 'NotifyOrderModify') {
      this._orders = this._orders.map(o => o.Ticket === order.Ticket ? order : o);
    } else if (message.Cmd === 'NotifyOrderClose') {
      this._orders = this._orders.filter(({Ticket}) => Ticket !== order.Ticket)

      if (/#\d+/.test(order.Comment)) {
        const symbol = this._symbols[order.SymbolId];
        this.emit('NotifyOrderClose', {
          Ticket: Number(order.Comment.replace('#', '')),
          ClosePrice: this.priceToFloat(order.ClosePrice, symbol.Id),
          Volume: this.volumeToFloat(order.Volume, symbol.Id),
        });
      }
    }
  }
}

let connect;

export default async () => {
  if (!connect) {
    connect = new MobiusTraderClient();
  }
  await connect.connect();
  return connect;
}
