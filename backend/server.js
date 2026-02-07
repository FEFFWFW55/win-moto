const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors()); // เก็บไว้เผื่อใช้ Live Server
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // อนุญาต Socket.IO
});

const authRoutes = require('./routes/auth.routes');
// const adminRoutes = require('./routes/admin.routes'); // ถ้ามี

app.use('/api/auth', authRoutes);
// app.use('/api/admin', adminRoutes);

// In-memory data store for Rides
const activeRides = new Map();
const rideHistory = [];

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('driver_location', data => {
    socket.broadcast.emit('driver_location_update', data);
  });

  socket.on('request_ride', rideData => {
    console.log('New ride request:', rideData);
    rideData.user_socket = socket.id;
    rideData.status = 'searching';
    activeRides.set(rideData.id, rideData);
    socket.broadcast.emit('new_ride_request', rideData);
  });

  socket.on('cancel_ride', (job_id) => {
    if (activeRides.has(job_id)) {
      activeRides.delete(job_id);
      socket.broadcast.emit('ride_cancelled', job_id);
      console.log(`Ride ${job_id} cancelled by user`);
    }
  });

  socket.on('accept_ride', data => {
    const { job_id, driver } = data;
    const ride = activeRides.get(job_id);

    if (ride) {
      ride.driver = driver;
      ride.driver_socket = socket.id;
      ride.status = 'picking_up';
      io.to(ride.user_socket).emit('ride_accepted', { driver, ride_id: job_id });
      console.log(`Ride ${job_id} accepted`);
    }
  });

  socket.on('arrive_at_pickup', (job_id) => {
    const ride = activeRides.get(job_id);
    if (ride) {
      ride.status = 'arrived';
      io.to(ride.user_socket).emit('driver_arrived', job_id);
    }
  });

  socket.on('start_trip', (job_id) => {
    const ride = activeRides.get(job_id);
    if (ride) {
      ride.status = 'in_progress';
      io.to(ride.user_socket).emit('trip_started', job_id);
    }
  });

  socket.on('finish_ride', (data) => {
    const { job_id } = data;
    const ride = activeRides.get(job_id);

    if (ride) {
      ride.status = 'completed';
      ride.completedAt = new Date();
      rideHistory.push({ ...ride });
      io.to(ride.user_socket).emit('ride_finished', ride);
      activeRides.delete(job_id);
    }
  });

  socket.on('rate_driver', (data) => {
    // TODO: Save rating to DB (MSSQL)
    console.log('Rate driver:', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Error handlers
app.use((req, res) => {
  res.status(404).json({ message: '404 Not Found' });
});

app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err);
  res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3007; // บังคับใช้ 3007 หรือตาม .env
server.listen(PORT, () => {
  console.log(`🚀 Win Driver Local Server running on port ${PORT}`);
});
