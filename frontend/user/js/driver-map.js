const socket = io('http://localhost:3000');
const map = L.map('map').setView([13.7563,100.5018],15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let driverMarker;

navigator.geolocation.watchPosition(pos => {
  const latlng = [pos.coords.latitude, pos.coords.longitude];

  if (!driverMarker)
    driverMarker = L.marker(latlng).addTo(map);
  else
    driverMarker.setLatLng(latlng);

  socket.emit('DRIVER_LOCATION', {
    lat: latlng[0],
    lng: latlng[1]
  });
});
