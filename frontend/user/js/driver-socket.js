socket.on('DRIVER_NEW_ORDER', order => {
  alert('มีงานเข้า');
});

socket.on('ORDER_ACCEPTED', order => {
  alert('รับงานแล้ว');
});
