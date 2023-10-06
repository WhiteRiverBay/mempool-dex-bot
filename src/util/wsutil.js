const sendToAll = (wss, message) => {
    if (wss.clients.size === 0) {
        console.log('No clients connected');
        return;
    }
    // if wss is null
    if (!wss) {
        console.log('No WebSocketServer');
        return;
    }
    // if message is null or empty
    if (!message) {
        console.log('No message');
        return;
    }
    
    // log the message
    console.log('message: ', message);
    
    wss.clients.forEach((client) => {
        client.send(message);
    });
}

export { sendToAll };