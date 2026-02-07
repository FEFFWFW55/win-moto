module.exports = (io) => {
  io.on('connection', socket => {

    socket.on('CREATE_ORDER', data => {
      socket.broadcast.emit('DRIVER_NEW_ORDER', data);
    });

    socket.on('DRIVER_ACCEPT', data => {
      io.emit('ORDER_ACCEPTED', data);
    });

    socket.on('DRIVER_LOCATION', data => {
      io.emit('TRACK_DRIVER', data);
    });

  });
};
