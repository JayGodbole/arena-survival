const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = './players_database.json';

app.use(express.static(__dirname));

// Persistent database
let database = { users: {} };
if (fs.existsSync(DATA_FILE)) {
    try {
        database = JSON.parse(fs.readFileSync(DATA_FILE));
    } catch (e) { console.error("DB Load Error", e); }
}

function saveDB() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(database, null, 2));
}

let activePlayers = {}; 
let globalBuildings = []; 

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('auth-request', (data) => {
        const { username, password, type } = data;
        
        if (type === 'register') {
            if (database.users[username]) {
                socket.emit('auth-response', { success: false, msg: 'User already exists!' });
            } else {
                database.users[username] = {
                    password,
                    stats: { hp: 100, hunger: 100, thirst: 100, wood: 50 },
                    inv: [5, 5, 5, 5],
                    pos: { x: 0, y: 5, z: 0 },
                    buildings: []
                };
                saveDB();
                socket.emit('auth-response', { success: true, user: username, data: database.users[username] });
            }
        } else {
            // Explicit Login
            const user = database.users[username];
            if (user) {
                if (user.password === password) {
                    socket.emit('auth-response', { success: true, user: username, data: user });
                } else {
                    socket.emit('auth-response', { success: false, msg: 'Wrong password!' });
                }
            } else {
                socket.emit('auth-response', { success: false, msg: 'Account not found. Please register.' });
            }
        }
    });

    socket.on('join-game', (data) => {
        activePlayers[socket.id] = {
            id: socket.id,
            name: data.name,
            pos: data.pos,
            rot: data.rot
        };
        socket.broadcast.emit('player-joined', activePlayers[socket.id]);
        socket.emit('init-world', { 
            players: activePlayers, 
            buildings: globalBuildings 
        });
    });

    socket.on('move', (data) => {
        if (activePlayers[socket.id]) {
            activePlayers[socket.id].pos = data.pos;
            activePlayers[socket.id].rot = data.rot;
            socket.broadcast.emit('player-moved', { id: socket.id, pos: data.pos, rot: data.rot });
        }
    });

    socket.on('build', (buildData) => {
        globalBuildings.push(buildData);
        io.emit('new-build', buildData);
    });

    socket.on('interact', (targetId) => {
        const initiator = activePlayers[socket.id];
        if (initiator && activePlayers[targetId]) {
            io.to(targetId).emit('interact-receive', { from: initiator.name });
            socket.emit('interact-confirm', { to: activePlayers[targetId].name });
        }
    });

    socket.on('save-progress', (data) => {
        if (database.users[data.username]) {
            database.users[data.username].stats = data.stats;
            database.users[data.username].pos = data.pos;
            saveDB();
        }
    });

    socket.on('disconnect', () => {
        socket.broadcast.emit('player-left', socket.id);
        delete activePlayers[socket.id];
    });
});

http.listen(PORT, () => {
    console.log(`Arena Survival Server running on port ${PORT}`);
});
