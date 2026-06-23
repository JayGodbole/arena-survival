const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});
const path = require('path');

const PORT = process.env.PORT || 3000;

// Serve the game files
app.use(express.static(__dirname));

// Global World State
let players = {};
let buildings = [];

io.on('connection', (socket) => {
    console.log('New survivor joined:', socket.id);

    // 1. Send current world to new player
    socket.emit('init-world', { players, buildings });

    // 2. Handle Player Movement
    socket.on('move', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name,
            pos: data.pos,
            rot: data.rot
        };
        socket.broadcast.emit('player-moved', players[socket.id]);
    });

    // 3. Handle Building
    socket.on('build', (buildData) => {
        buildings.push(buildData);
        io.emit('new-build', buildData);
    });

    // 4. Handle Disconnect
    socket.on('disconnect', () => {
        console.log('Survivor left:', socket.id);
        delete players[socket.id];
        io.emit('player-left', socket.id);
    });
});

http.listen(PORT, () => {
    console.log(`Arena Survival Server running on port ${PORT}`);
});
