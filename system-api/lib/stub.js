// ── Stub routes for remaining endpoints
// These will be fully implemented in subsequent phases

const express = require('express');

function stub(name) {
  const router = express.Router();
  router.all('*', (req, res) => {
    res.json({ message: `${name} route — coming soon`, method: req.method, path: req.path });
  });
  return router;
}

module.exports = { stub };
