const http = require('http');

http.get('http://localhost:3000/wabi-wall', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Title match:', data.includes('<title>Wabi Sabi — Wabi Wall Notice Board</title>'));
        console.log('Main title match:', data.includes('<h1 class="board-main-title">Wabi Wall</h1>'));
        console.log('Script match:', data.includes('js/wabi-wall.js'));
        console.log('CSS match:', data.includes('css/wabi-wall.css'));
        console.log('Dock active:', data.includes('class="dock-item active" data-tab="wabi-wall"'));
    });
});
