const socket = io("http://localhost:3000");

socket.on("order_waiting", (order) => {
  document.getElementById("orders").innerHTML += `
    <div>
      งานใหม่ (${order.pickup_lat}, ${order.pickup_lng})
      <button onclick="acceptOrder()">รับงาน</button>
    </div>
  `;
});

function acceptOrder() {
  socket.emit("driver_accept", { status: "accepted" });
}
