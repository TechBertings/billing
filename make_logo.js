const fs = require('fs');
const b64 = fs.readFileSync('public/fortiserv_logo.png').toString('base64');
fs.writeFileSync('src/logo_b64.js', 'export const LOGO_B64 = "data:image/png;base64,' + b64 + '";');
console.log('Done!');