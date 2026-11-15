const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.send('Sección de usuarios');
});

module.exports = router;
