let map, marker, watchId;
let isOnline = false;
let currentJob = null;
let currentRouteLine = null;
let markers = {}; // Store all markers
const socket = io();

// --- Map Initialization (Leaflet) ---
function initMap() {
    console.log('📍 Initializing Driver Map (Leaflet)...');

    // Default Center (Phranakhon Rajabhat)
    map = L.map('map', { zoomControl: false }).setView([13.8729, 100.5973], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Try to get real location immediately
    panToCurrentLocation();
}

initMap();

function panToCurrentLocation() {
    if (navigator.geolocation && map) {
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            map.flyTo([latitude, longitude], 17);

            // Update/Create Driver Marker if not tracking yet
            if (!marker) {
                updateDriverMarker({ lat: latitude, lon: longitude });
            }
        }, (err) => {
            console.log('Location error:', err);
        }, { enableHighAccuracy: true });
    }
}

// --- Driver Marker Helpers ---
function updateDriverMarker(pos) {
    // pos format: { lat: 13.x, lon: 100.x }
    const latLng = [pos.lat, pos.lon];

    if (!marker) {
        // Create custom driver icon
        const driverIcon = L.icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/3097/3097180.png', // Example bike icon or custom
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -20],
            className: 'start-marker'
        });

        marker = L.marker(latLng, { icon: driverIcon }).addTo(map);
        marker.bindPopup('<b>คุณอยู่ที่นี่</b>');
    } else {
        marker.setLatLng(latLng);
    }
}

// --- UI State Management ---
function showPanel(panelId) {
    // Hide all panels
    ['panel-offline', 'panel-searching', 'panel-request', 'panel-active'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    // Show requested
    const p = document.getElementById(panelId);
    if (p) p.classList.remove('hidden');
}

function toggleStatus() {
    isOnline = !isOnline;

    // Sync toggles
    const toggleOff = document.getElementById('toggle-work-off');
    const toggleOn = document.getElementById('toggle-work-on');
    if (toggleOff) toggleOff.checked = isOnline;
    if (toggleOn) toggleOn.checked = isOnline;

    if (isOnline) {
        checkGPSPermissions();
        showPanel('panel-searching');
        startTracking();
    } else {
        showPanel('panel-offline');
        stopTracking();
    }
}

function checkGPSPermissions() {
    if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' }).then(result => {
            if (result.state === 'denied') {
                alert('กรุณาเปิดการใช้งาน Location Service เพื่อรับงาน');
            }
        });
    }
}


function startTracking() {
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            // Update Map
            updateDriverMarker({ lat, lon: lng });

            // Center map if following logic enabled (optional, maybe distinct button)
            // if(isFollowing) map.panTo([lat, lng]);

            // Emit to Server
            if (isOnline) {
                socket.emit('driver_location', {
                    driver_id: localStorage.getItem('name') || 'Driver',
                    lat,
                    lng
                });
            }
        }, err => console.error(err), { enableHighAccuracy: true });
    }
}

function stopTracking() {
    if (watchId) navigator.geolocation.clearWatch(watchId);
}

// --- Job Logic ---
let timerInterval;

socket.on('new_ride_request', (job) => {
    if (!isOnline || currentJob) return;

    currentJob = job;

    // Populate UI
    document.getElementById('job-price').innerText = job.price;
    document.getElementById('job-dist').innerText = job.distance;

    const payBadge = document.getElementById('job-payment-badge');
    if (payBadge) {
        payBadge.innerText = job.paymentMethod === 'cash' ? 'เงินสด' : 'พร้อมเพย์';
        payBadge.style.background = job.paymentMethod === 'cash' ? '#FFD700' : '#00D2FF';
    }

    // Calculate straight-line distance to pickup locally
    if (marker) {
        const driverLatLng = marker.getLatLng();
        const distToPickup = calculateDistance(driverLatLng.lat, driverLatLng.lng, job.pickup.lat, job.pickup.lng);
        document.getElementById('pickup-dist').innerText = distToPickup.toFixed(1) + ' กม.';
    }

    // Show temporary marker for pickup
    if (markers['pickup_req']) map.removeLayer(markers['pickup_req']);

    markers['pickup_req'] = L.marker([job.pickup.lat, job.pickup.lng], {
        icon: createPinIcon('green')
    }).addTo(map).bindPopup('จุดรับ: ' + (job.pickup.name || 'ลูกค้า')).openPopup();

    map.flyTo([job.pickup.lat, job.pickup.lng], 16);

    // Show Panel
    showPanel('panel-request');

    // Timer
    let timeLeft = 100;
    const timerBar = document.getElementById('timer-bar');
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft -= 1;
        if (timerBar) timerBar.style.width = timeLeft + '%';
        if (timeLeft <= 0) rejectJob();
    }, 150); // ~15 sec

    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
});

socket.on('ride_cancelled', (job_id) => {
    if (currentJob && currentJob.id === job_id) {
        alert('ผู้โดยสารยกเลิกรายการ');
        rejectJob();
    }
});

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function acceptJob() {
    if (!currentJob) return;
    if (timerInterval) clearInterval(timerInterval);

    socket.emit('accept_ride', {
        job_id: currentJob.id,
        driver: {
            name: localStorage.getItem('name') || 'พี่วิน',
            plate: 'วิน-' + (Math.floor(Math.random() * 900) + 100),
            lat: marker ? marker.getLatLng().lat : 0,
            lng: marker ? marker.getLatLng().lng : 0,
            phone: localStorage.getItem('phone') || '08X-XXX-XXXX'
        }
    });

    // Update UI
    showPanel('panel-active');

    document.getElementById('active-price').innerText = currentJob.price;
    document.getElementById('active-payment-type').innerText = currentJob.paymentMethod === 'cash' ? 'เงินสด' : 'PromptPay';

    document.getElementById('active-pickup').innerText = currentJob.pickup.name || 'จุดรับ';
    document.getElementById('active-dropoff').innerText = currentJob.dropoff.name || 'จุดส่ง';

    // Reset buttons
    document.getElementById('btn-arrive').classList.remove('hidden');
    document.getElementById('btn-start-trip').classList.add('hidden');
    document.getElementById('btn-finish').classList.add('hidden');

    // Draw route logic
    showRoute(currentJob.pickup, currentJob.dropoff);
}

async function showRoute(start, end) {
    if (currentRouteLine) map.removeLayer(currentRouteLine);

    // Clear temp markers
    if (markers['pickup_req']) map.removeLayer(markers['pickup_req']);

    // Create new route markers
    markers['start'] = L.marker([start.lat, start.lng], { icon: createPinIcon('green') }).addTo(map).bindPopup('รับ: ' + start.name);
    markers['end'] = L.marker([end.lat, end.lng], { icon: createPinIcon('red') }).addTo(map).bindPopup('ส่ง: ' + end.name);

    // Try OSRM
    try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes.length > 0) {
            const route = data.routes[0];
            // GeoJSON coordinates are [lon, lat], Leaflet wants [lat, lon]
            const latLngs = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);

            currentRouteLine = L.polyline(latLngs, {
                color: '#00D2FF',
                weight: 6,
                opacity: 0.8,
                dashArray: '10, 10',
                lineCap: 'round'
            }).addTo(map);

            map.fitBounds(currentRouteLine.getBounds(), { padding: [50, 50] });
        }
    } catch (e) {
        console.warn('Routing error, drawing straight line', e);
        currentRouteLine = L.polyline([
            [start.lat, start.lng],
            [end.lat, end.lng]
        ], { color: 'blue', dashArray: '5, 5' }).addTo(map);
        map.fitBounds(currentRouteLine.getBounds(), { padding: [50, 50] });
    }
}

function createPinIcon(color) {
    return new L.Icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
}

function rejectJob() {
    if (timerInterval) clearInterval(timerInterval);
    currentJob = null;
    showPanel('panel-searching');

    // Clear layers
    if (currentRouteLine) map.removeLayer(currentRouteLine);
    if (markers['pickup_req']) map.removeLayer(markers['pickup_req']);
    if (markers['start']) map.removeLayer(markers['start']);
    if (markers['end']) map.removeLayer(markers['end']);

    // Re-center on driver
    if (marker) map.flyTo(marker.getLatLng(), 16);
}


function arriveAtPickup() {
    socket.emit('arrive_at_pickup', currentJob.id);
    document.getElementById('btn-arrive').classList.add('hidden');
    document.getElementById('btn-start-trip').classList.remove('hidden');
}

function startTrip() {
    socket.emit('start_trip', currentJob.id);
    document.getElementById('btn-start-trip').classList.add('hidden');
    document.getElementById('btn-finish').classList.remove('hidden');
}

function finishJob() {
    socket.emit('finish_ride', { job_id: currentJob.id });

    // Show Modal
    const modal = document.getElementById('payment-modal');
    document.getElementById('panel-active').classList.add('hidden');
    modal.classList.remove('hidden');

    // Confetti
    if (typeof confetti === 'function') {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }

    document.getElementById('final-price').innerText = currentJob.price;

    if (currentJob.paymentMethod === 'promptpay') {
        document.getElementById('qr-section').classList.remove('hidden');
    } else {
        document.getElementById('qr-section').classList.add('hidden');
    }

    saveJobToHistory(currentJob);

    // Clean Map
    if (currentRouteLine) map.removeLayer(currentRouteLine);
    if (markers['start']) map.removeLayer(markers['start']);
    if (markers['end']) map.removeLayer(markers['end']);

    // Re-center
    panToCurrentLocation();
}

function closePaymentModal() {
    document.getElementById('payment-modal').classList.add('hidden');
    currentJob = null;
    showPanel('panel-searching');
}


// --- Stats & History ---

function saveJobToHistory(job) {
    let history = JSON.parse(localStorage.getItem('driver_history') || '[]');
    history.unshift({ ...job, date: new Date().toLocaleString('th-TH') });
    localStorage.setItem('driver_history', JSON.stringify(history));
    updateStats();
}

function updateStats() {
    const history = JSON.parse(localStorage.getItem('driver_history') || '[]');
    const totalIncome = history.reduce((sum, item) => sum + parseInt(item.price.replace('฿', '')), 0);

    const incEl = document.getElementById('today-income');
    const jobEl = document.getElementById('today-jobs');

    if (incEl) incEl.innerText = `฿${totalIncome}`;
    if (jobEl) jobEl.innerText = `${history.length} งาน`;
}

function toggleHistory() {
    const panel = document.getElementById('history-panel');
    const notifPanel = document.getElementById('notification-panel');
    if (notifPanel && notifPanel.classList.contains('open')) notifPanel.classList.remove('open');
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) renderHistory();
}

function toggleNotifications() {
    const panel = document.getElementById('notification-panel');
    const historyPanel = document.getElementById('history-panel');
    if (historyPanel && historyPanel.classList.contains('open')) historyPanel.classList.remove('open');
    panel.classList.toggle('open');
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem('driver_history') || '[]');
    const list = document.getElementById('history-list');
    if (!list) return;

    if (history.length === 0) {
        list.innerHTML = '<div class="empty" style="text-align:center; color:#ccc; margin-top:50px;">ไม่มีข้อมูล</div>';
        return;
    }

    list.innerHTML = history.map(item => `
        <div class="history-item">
            <div>
                <div style="font-size: 0.7rem; color: #aaa;">${item.date}</div>
                <div style="font-weight: 700;">ลูกค้า: ${item.userName || 'Guest'}</div>
            </div>
            <div style="text-align:right;">
                <div style="color: var(--success); font-weight: 800;">${item.price}</div>
                <div style="font-size: 0.8rem;">${item.distance}</div>
            </div>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    updateStats();
    showPanel('panel-offline');
});
