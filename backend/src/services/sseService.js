class SSEService {
  constructor() {
    this.clients = new Set();
  }

  addClient(req, res) {
    const headers = {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
    };
    res.writeHead(200, headers);

    // Tell the client the connection is established
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    this.clients.add(res);

    req.on('close', () => {
      this.clients.delete(res);
    });
  }

  broadcast(event, data) {
    for (const client of this.clients) {
      // The SSE format requires 'event: <eventName>\n' followed by 'data: <json>\n\n'
      if (event) {
        client.write(`event: ${event}\n`);
      }
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }
}

export const sseService = new SSEService();
