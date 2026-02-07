let map;
let pickup = null;
let dropoff = null;
let currentRideId = null;
let vehicleType = 'standard';
let userRating = 0;
let markers = {};
let routeLine = null;

const socket = io('http://localhost:3007');

// PNRU Buildings Data (GeoJSON-like structure)
const PNRU_LOCATIONS = [];

// --- Map Initialization ---
function initMap() {
  // Center of Rajabhat Phranakhon University (Campus Focus)
  map = L.map('map', { zoomControl: false }).setView([13.8760, 100.5930], 17);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);


  // Add Markers
  PNRU_LOCATIONS.forEach(loc => {
    const marker = L.marker([loc.lat, loc.lng]).addTo(map);
    marker.bindPopup(`<b>${loc.name}</b><br><button onclick="selectLocation('${loc.id}')">เลือกจุดนี้</button>`);
    marker.on('click', () => handleMarkerClick(loc, marker));
    markers[loc.id] = marker;
  });

  // Enable Free Selection
  map.on('click', (e) => {
    const { lat, lng } = e.latlng;

    // Remove previous temp marker if exists
    if (markers['temp']) {
      map.removeLayer(markers['temp']);
      delete markers['temp'];
    }

    const tempLoc = {
      id: 'temp_' + Date.now(),
      name: "พิกัดที่เลือก",
      lat: lat,
      lng: lng
    };

    const tempMarker = L.marker([lat, lng], {
      draggable: true,
      icon: createCustomIcon('blue')
    }).addTo(map);
    tempMarker.bindPopup(`<b>📍 พิกัดที่เลือก</b><br><button onclick="selectLocation('${tempLoc.id}')">ยืนยันจุดนี้</button>`).openPopup();

    markers['temp'] = tempMarker;

    // Update tempLoc when dragged
    tempMarker.on('dragend', (evt) => {
      const newPos = evt.target.getLatLng();
      tempLoc.lat = newPos.lat;
      tempLoc.lng = newPos.lng;
    });

    // Store in global array temporarily for selection logic
    PNRU_LOCATIONS.push(tempLoc);
    handleMarkerClick(tempLoc, tempMarker);
  });

  initUserProfile();

}

function handleMarkerClick(loc, marker) {
  window.tempSelection = loc;

  // UI Feedback
  const confirmPill = document.getElementById('selection-confirm');
  const text = document.getElementById('selection-text');
  text.innerText = !pickup ? `รับที่: ${loc.name}?` : `ส่งที่: ${loc.name}?`;
  confirmPill.style.display = 'flex';

  // Pan to marker
  map.flyTo([loc.lat, loc.lng], 18);
}

// Global scope for popup button
window.selectLocation = (id) => {
  const loc = PNRU_LOCATIONS.find(l => l.id === id);
  if (loc) {
    window.tempSelection = loc;
    confirmLocation();
  }
};

function confirmLocation() {
  const loc = window.tempSelection;
  if (!pickup || (pickup && dropoff)) {
    resetBooking();
    pickup = loc;
    showToast(`📍 จุดรับ: ${loc.name}`, 'info');

    // Visual indicator for pickup
    if (markers[loc.id]) markers[loc.id].setIcon(createCustomIcon('green'));

  } else {
    if (pickup.id === loc.id) return showToast('❌ จุดส่งต้องไม่ซ้ำกับจุดรับ', 'warning');
    dropoff = loc;
    showToast(`🚩 จุดส่ง: ${loc.name}`, 'info');

    // Visual indicator for dropoff
    if (markers[loc.id]) markers[loc.id].setIcon(createCustomIcon('red'));

    calculateTrip();
  }
  document.getElementById('selection-confirm').style.display = 'none';
  map.closePopup();
}

function createCustomIcon(color) {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}

// --- Booking Logic ---
async function calculateTrip() {
  const p1 = L.latLng(pickup.lat, pickup.lng);
  const p2 = L.latLng(dropoff.lat, dropoff.lng);

  let km, min, coordinates;

  try {
    // Use OSRM Public API for demo (Note: In production use your own server/token)
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`);
    const data = await response.json();

    if (data.code === 'Ok' && data.routes.length > 0) {
      const route = data.routes[0];
      coordinates = route.geometry.coordinates.map(c => [c[1], c[0]]); // GeoJSON [lng,lat] -> Leaflet [lat,lng]
      km = (route.distance / 1000).toFixed(1);
      min = Math.ceil(route.duration / 60) + 2; // Duration in seconds -> minutes + buffer
    } else {
      throw new Error('No route found');
    }
  } catch (e) {
    console.warn("Routing API failed, using straight line fallback.", e);
    // Fallback: Straight line
    const distMeters = p1.distanceTo(p2);
    km = (distMeters / 1000).toFixed(1);
    min = Math.ceil(km * 5) + 5;
    coordinates = [[p1.lat, p1.lng], [p2.lat, p2.lng]];
  }

  // Update UI Stats
  document.getElementById('val-dist').innerText = `${km} กม.`;
  document.getElementById('val-time').innerText = `~${min} นาที`;

  // Pricing Logic
  const basePrice = 20;
  const standard = Math.ceil(basePrice + (km * 15));
  const express = standard + 10;

  document.getElementById('price-standard').innerText = `฿${standard}`;
  document.getElementById('price-express').innerText = `฿${express}`;

  // Draw Route Line
  if (routeLine) map.removeLayer(routeLine);
  routeLine = L.polyline(coordinates, {
    color: '#00b3ffff',
    weight: 6,
    opacity: 0.9,
    dashArray: '12, 12',
    lineCap: 'round',
    className: 'active-route-anim'
  }).addTo(map);

  map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

  window.tripStats = { km, price: standard, time: min };

  const panel = document.getElementById('panel-booking');
  panel.classList.remove('hide-panel');
  panel.classList.add('animate__slideInUp');
}

function selectVehicle(type) {
  vehicleType = type;
  document.querySelectorAll('.v-btn').forEach(btn => btn.classList.remove('active'));
  event.currentTarget.classList.add('active');
  window.tripStats.price = type === 'standard' ? parseInt(document.getElementById('price-standard').innerText.slice(1)) : parseInt(document.getElementById('price-express').innerText.slice(1));
}

function requestRide() {
  const order = {
    id: Date.now(),
    userName: localStorage.getItem('name') || 'ผู้ใช้',
    userPhone: localStorage.getItem('phone') || '0XXXXXXXXX',
    pickup: pickup,
    dropoff: dropoff,
    price: `฿${window.tripStats.price}`,
    distance: `${window.tripStats.km} กม.`,
    vehicle: vehicleType,
    paymentMethod: document.getElementById('pay-method').value,
    status: 'WAITING'
  };

  currentRideId = order.id;
  socket.emit('request_ride', order);

  document.getElementById('panel-booking').classList.add('hide-panel');
  document.getElementById('panel-status').classList.remove('hide-panel');
  document.getElementById('status-finding').style.display = 'block';
}

function cancelRequest() {
  socket.emit('cancel_ride', currentRideId);
  resetBooking();
  document.getElementById('panel-status').classList.add('hide-panel');
  showToast('ยกเลิกการเรียกรถแล้ว', 'warning');
}

// --- 4. สถานะ & 5. Real-time Tracking ---
socket.on('ride_accepted', (data) => {
  const { driver, ride_id } = data;
  currentRideId = ride_id;

  document.getElementById('status-finding').style.display = 'none';
  document.getElementById('status-active').style.display = 'block';

  document.getElementById('driver-name-val').innerText = driver.name;
  document.getElementById('driver-plate-val').innerText = driver.plate;
  document.getElementById('driver-phone-btn').href = `tel:${driver.phone}`;
  document.getElementById('driver-avatar').src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${driver.name}`;

  updateStepper('picking_up');
  showToast(`✅ พี่วินรับงานแล้ว! ${driver.name} กำลังมาครับ`, 'success');
});

// Removed old driver_location_update as it was SVG specific and not provided in new snippet.
// If driver tracking is needed, it would involve adding a Leaflet marker for the driver.

socket.on('driver_arrived', () => {
  updateStepper('arrived');
  showToast('📍 พี่วินถึงจุดรับแล้วครับ!', 'info');
});

socket.on('trip_started', () => {
  updateStepper('in_progress');
  showToast('🏍️ เริ่มการเดินทาง!', 'info');
});

socket.on('ride_finished', (ride) => {
  // Removed old driver-marker display none as it was SVG specific.
  document.getElementById('panel-status').classList.add('hide-panel');
  document.getElementById('actual-price-val').innerText = ride.price;
  document.getElementById('modal-rating').classList.remove('hide-panel');
  showToast('🏁 ถึงที่หมายแล้ว!', 'success');
  createConfetti(); // Gimmick: Celebration
  saveRideToHistory(ride);
  resetBooking(); // Pre-reset map
});

// --- 9. ประวัติการเดินทาง Logic ---
function saveRideToHistory(ride) {
  let history = JSON.parse(localStorage.getItem('user_ride_history') || '[]');
  const job = {
    date: new Date().toLocaleString('th-TH'),
    pickup: pickup ? pickup.name : 'Unknown',
    dropoff: dropoff ? dropoff.name : 'Unknown',
    price: ride.price,
    vehicle: vehicleType === 'express' ? 'วินด่วน' : 'วินมอเตอร์ไซค์'
  };
  history.unshift(job);
  localStorage.setItem('user_ride_history', JSON.stringify(history.slice(0, 10)));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list-content');
  const history = JSON.parse(localStorage.getItem('user_ride_history') || '[]');

  if (history.length === 0) {
    list.innerHTML = `<div class="empty-history"><i class="fas fa-route"></i><p>ยังไม่มีประวัติการเดินทาง</p></div>`;
    return;
  }

  list.innerHTML = history.map(item => `
        <div class="history-card">
            <div class="hist-date">${item.date}</div>
            <div class="hist-route">
                <p><i class="fas fa-circle" style="color:var(--success); font-size:0.6rem;"></i> ${item.pickup}</p>
                <p><i class="fas fa-map-marker-alt" style="color:var(--danger); font-size:0.8rem;"></i> ${item.dropoff}</p>
            </div>
            <div class="hist-meta">
                <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">${item.vehicle}</span>
                <span class="hist-price">${item.price}</span>
            </div>
        </div>
    `).join('');
}

function toggleHistory() {
  const drawer = document.getElementById('drawer-history');
  drawer.classList.toggle('open');
  if (drawer.classList.contains('open')) renderHistory();
}

// --- 8. รีวิว & คะแนน ---
document.querySelectorAll('.star-group i').forEach(star => {
  star.onclick = (e) => {
    userRating = parseInt(e.target.dataset.s);
    document.querySelectorAll('.star-group i').forEach((s, idx) => {
      s.className = idx < userRating ? 'fas fa-star active' : 'far fa-star';
    });
  };
});

function submitRatingAndFinish() {
  const review = document.getElementById('review-input').value;
  socket.emit('rate_driver', { job_id: currentRideId, rating: userRating, review });
  showToast('ขอบคุณที่ใช้บริการครับ!', 'success');
  createConfetti();
  setTimeout(() => location.reload(), 1500); // Wait for confetti before reload
}

// Gimmick: Confetti Function
function createConfetti() {
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-piece animate__animated animate__fadeOut';
    confetti.style.left = (Math.random() * 100) + 'vw';
    // Use vibrant colors from css variables (approximated here)
    confetti.style.backgroundColor = ['#FFD700', '#FF0055', '#00E5FF', '#00FF99'][Math.floor(Math.random() * 4)];
    confetti.style.width = (Math.random() * 10 + 5) + 'px';
    confetti.style.height = (Math.random() * 10 + 5) + 'px';

    document.body.appendChild(confetti);

    const duration = Math.random() * 2 + 1;
    const endX = (Math.random() - 0.5) * 200; // Drift left/right

    confetti.animate([
      { top: '-20px', opacity: 1, transform: 'rotate(0deg)' },
      { top: '100vh', opacity: 0, transform: `translateX(${endX}px) rotate(${Math.random() * 720}deg)` }
    ], {
      duration: duration * 1000,
      easing: 'cubic-bezier(.11,.77,.2,1)'
    });

    setTimeout(() => confetti.remove(), duration * 1000);
  }
}

function showToast(text, type = 'default') {
  const container = document.getElementById('notification-v3');
  const t = document.createElement('div');
  t.className = `toast ${type} animate__animated animate__fadeInUp`;
  t.innerText = text;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// --- Utils & Map Controls ---
function updateStepper(phase) {
  const phases = { 'picking_up': 't-picking', 'arrived': 't-arrived', 'in_progress': 't-trip' };
  document.querySelectorAll('.t-step').forEach(s => s.classList.remove('active'));
  if (phases[phase]) document.getElementById(phases[phase]).classList.add('active');
}

function initUserProfile() {
  const phone = localStorage.getItem('phone');
  console.log('Current User Phone:', phone);

  const displayPhone = (phone && phone !== 'undefined') ? phone : '0XX-XXX-XXXX';
  document.getElementById('user-phone-val').innerText = displayPhone;
  document.getElementById('user-avatar-main').src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayPhone}`;
}

let userLocationMarker = null;
let accuracyCircle = null;

function goToCurrentPos() {
  if (!navigator.geolocation) {
    showToast('เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง', 'warning');
    fallbackLocation();
    return;
  }

  showToast('กำลังค้นหาตำแหน่งของคุณ...', 'info');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      const latLng = [latitude, longitude];

      // Update or Create Marker
      if (userLocationMarker) {
        userLocationMarker.setLatLng(latLng);
        accuracyCircle.setLatLng(latLng);
        accuracyCircle.setRadius(accuracy);
      } else {
        userLocationMarker = L.circleMarker(latLng, {
          color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.9, radius: 10, weight: 3
        }).addTo(map).bindPopup("คุณอยู่ที่นี่");

        accuracyCircle = L.circle(latLng, { radius: accuracy, color: '#3b82f6', fillOpacity: 0.2, weight: 1 }).addTo(map);
      }

      map.flyTo(latLng, 18);
      showToast('📍 พบตำแหน่งของคุณแล้ว', 'success');
    },
    (error) => {
      console.error(error);
      showToast('ไม่สามารถระบุตำแหน่งได้ ใช้ตำแหน่งจำลองแทน', 'warning');
      fallbackLocation();
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  );
}

function fallbackLocation() {
  const mockLat = 13.8718;
  const mockLng = 100.5965;
  map.flyTo([mockLat, mockLng], 18);
  // Keep mock marker logic if needed
}

function resetBooking() {
  pickup = null; dropoff = null;
  if (routeLine) map.removeLayer(routeLine);

  // Clear temp marker
  if (markers['temp']) {
    map.removeLayer(markers['temp']);
    delete markers['temp'];
  }

  // Clean up temp locations from array
  // Note: In a real app we might handle this differently, but for now basic cleanup
  const keepIds = new Set(['b15', 'b14', 'b12', 'cafe', 'gym', 'gate1', 'gate2']);
  // Filter logic if needed, or just rely on markers map cleanup

  // Reset Markers
  Object.values(markers).forEach(m => {
    if (m && m.setIcon) m.setIcon(new L.Icon.Default());
  });

  document.getElementById('panel-booking').classList.add('hide-panel');
  map.setView([13.8729, 100.5973], 17); // Reset map view to initial center and zoom
}

window.onload = initMap;
