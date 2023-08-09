const express = require('express');
const router = express.Router();

router.get('/footer', (req, res) => {
    // send image
    return res.sendFile('footer.jpeg', { root: 'public' });
})

module.exports = router;