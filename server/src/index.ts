import express, { } from 'express';
import path from 'path';
import socket from 'socket.io';
import http from "http";




var env = process.env.NODE_ENV || 'development';
console.log(`Running in ${env} enviroment`)
if (env == "development") {
  require('dotenv').config({ path: '../.env' })
}


const PORT = process.env.PORT || 5000



type UserData = {
  room: string;
  user: string;
}



const app = express();
app.set("port", PORT);


if (env == "development") {

  const livereload = require("livereload");
  const connectLivereload = require("connect-livereload");
  // open livereload high port and start to watch public directory for changes
  const liveReloadServer = livereload.createServer();
  liveReloadServer.watch(path.join(__dirname, '../_dist/public'));
  // ping browser on Express boot, once browser has reconnected and handshaken
  liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
      liveReloadServer.refresh("/");
    }, 100);
  });

  console.warn("live reload activated")
  // monkey patch every served HTML so they know of changes
  app.use(connectLivereload());
}

var httpServer = new http.Server(app);
const io = new socket.Server(httpServer);

io.on('connection', socket => {
  let room: string | undefined;
  let user: string | undefined;
  console.log('connected');
  socket.onAny((message, data: UserData) => {
    if (!data) {
      console.error(`Recived ${message} without data`)
      return;
    }
    console.log(`Recived ${message} from ${data.user}`)
    socket.to(data.room).emit(message, data);
    // join the room if not already
    if (!socket.rooms.has(data.room)) {
      room = data.room;
      user = data.user;
      console.log(`Join ${data.user} in ${data.room}`)
      socket.join(data.room);
    }
  })

  socket.on('disconnect', reason => {
    console.log(`Recived disconect from ${user} ${room}`)
    if (room) {
      io.to(room).emit('left', { user: user });
      console.log(`send ${user} user had left`)
    }
  })
});


app.use(express.static(path.join(__dirname, 'public')))
  .use(express.json())
  .use(express.urlencoded({ extended: false }))



// start our simple server up on localhost:PORT
const server = httpServer
  .listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));

