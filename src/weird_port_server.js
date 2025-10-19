const express = require('express');
const app = express();
const port = 49152;

app.get('/', (req, res) => {
  res.send('Hello from the server on unusual port!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is in use!`);
  } else {
    console.error('Server error:', err);
  }
}); 