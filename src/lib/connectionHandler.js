import MobiusTraderClient from './MobiusTraderClient';

export default async function connectionHandler(ws) {
  const server = await MobiusTraderClient();

  function send(data) {
    try {
      ws.send(JSON.stringify(data));
    } catch (e) {
      ws.terminate();
    }
  }

  server.on('NotifyOrderClose', props => {
    send({
      cmd: `NotifyOrderClose`,
      props,
    });
  });

  ws.on('message', async (message) => {
    try {
      const {id, cmd, props} = JSON.parse(message);

      if (cmd !== 'Ping' && cmd !== 'Pong') {
        console.log('message', {id, cmd, props});
      }

      try {
        let result;
        if (cmd === 'Ping') {
          send({
            cmd: 'Pong',
          });
          return;
        } else if (cmd === 'OrderOpen') {
          result = await server.orderOpen(props);
        } else if (cmd === 'OrderSetTicket') {
          await server.orderSetTicket(props);
        } else if (cmd === 'OrderClose') {
          result = await server.orderClose(props);
        }

        if (result) {
          send({
            id,
            cmd: `Response`,
            result: result,
          });
        }
      } catch (error) {
        send({
          id,
          cmd: `response_${id}`,
          error,
        });
      }
    } catch(e) {
      console.error(e);
    }
  });

  ws.on('close', () => {
    console.log('close')
  });
}
