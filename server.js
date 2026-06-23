const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = './players_database.json';

app.use(express.static(__dirname));

let database = { users: {} };
if (fs.existsSync(DATA_FILE)) {
    try {
        database = JSON.parse(fs.readFileSync(DATA_FILE));
    } catch (e) { console.log("New database created."); }
}

function saveDB() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(database, null, 2));
}

let players = {};
let worldBuildings = [];

io.on('connection', (socket) => {
    socket.on('auth-request', (data) => {
        const { user, pass, type } = data;
        if (type === 'reg') {
            if (database.users[user]) return socket.emit('auth-res', { success: false, msg: 'Name taken!' });
            database.users[user] = { pass, stats: { hp: 100, wood: 50 }, pos: { x: 0, y: 5, z: 0 }, inv: [5, 5, 5, 5] };
            saveDB();
            socket.emit('auth-res', { success: true, user, data: database.users[user] });
        } else {
            const entry = database.users[user];
            if (entry && entry.pass === pass) socket.emit('auth-res', { success: true, user, data: entry });
            else socket.emit('auth-res', { success: false, msg: 'Invalid login!' });
        }
    });

    socket.on('join', (data) => {
        players[socket.id] = { id: socket.id, name: data.name, pos: data.pos, yaw: data.yaw };
        socket.broadcast.emit('p-joined', players[socket.id]);
        socket.emit('init-world', { players, buildings: worldBuildings });
    });

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].pos = data.pos;
            players[socket.id].yaw = data.yaw;
            socket.broadcast.emit('p-moved', { id: socket.id, pos: data.pos, yaw: data.yaw });
        }
    });

    socket.on('build', (b) => {
        worldBuildings.push(b);
        io.emit('b-placed', b);
    });

    socket.on('interact', (id) => {
        if (players[id]) io.to(id).emit('p-interact', players[socket.id].name);
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('p-left', socket.id);
    });
});

http.listen(PORT, () => console.log('Server live at port ' + PORT));
