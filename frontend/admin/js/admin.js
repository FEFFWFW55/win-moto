fetch('http://localhost:3000/api/admin/users')
  .then(res => res.json())
  .then(data => console.table(data));
