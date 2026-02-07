const socket = io("http://localhost:3000");

navigator.geolocation.watchPosition(pos => {
  socket.emit("driver_location", {
    driver_id: 1,
    lat: pos.coords.latitude,
    lng: pos.coords.longitude
  });
}, err => console.log(err), {
  enableHighAccuracy: true
});
