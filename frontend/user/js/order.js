const socket = io(); // Connects to the same host

function confirmOrder() {
  if (!pickup || !dropoff) return;

  const orderData = {
    id: Date.now(),
    userName: localStorage.getItem('name') || 'ผู้โดยสาร',
    pickup: pickup,
    dropoff: dropoff,
    price: document.getElementById('price-val').innerText,
    distance: document.getElementById('dist-val').innerText
  };

  // Show loading
  document.getElementById('loading').style.display = 'flex';
  document.getElementById('loading-text').innerHTML = `
    <div style="font-size:1.2rem; font-weight:700;">กำลังค้นหาพี่วิน...</div>
    <div style="font-size:0.9rem; opacity:0.8; margin-top:10px;">ระบบกำลังแจ้งเตือนพี่วินในพื้นที่</div>
  `;

  socket.emit('request_ride', orderData);
}

socket.on('ride_accepted', (driverData) => {
  document.getElementById('loading-text').innerHTML = `
    <div style="font-size:1.5rem; color:#2ecc71;"><i class="fas fa-check-circle"></i></div>
    <div style="font-size:1.2rem; font-weight:700;">พี่วิน ${driverData.name} รับงานแล้ว!</div>
    <div style="font-size:1rem; margin-top:5px;">ทะเบียน: ${driverData.plate}</div>
  `;

  setTimeout(() => {
    document.getElementById('loading').style.display = 'none';
    showNotification(`พี่วินกำลังเดินทางมาหาคุณ`);
  }, 3000);
});
