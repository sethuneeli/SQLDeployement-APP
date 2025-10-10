const express = require('express');
const app = express();

app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Test route
app.get('/api/git-test', (req, res) => {
  console.log('Git test route hit!');
  res.json({ message: 'Git test route working', timestamp: new Date().toISOString() });
});

// Existing route pattern
app.get('/api/environments', (req, res) => {
  console.log('Environments route hit!');
  res.json({ success: true, environments: [] });
});

app.listen(3001, () => {
  console.log('Test server running on http://localhost:3001');
});