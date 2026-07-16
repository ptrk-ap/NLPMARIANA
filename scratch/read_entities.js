const fs = require('fs');
const path = require('path');

const dirPath = path.join(__dirname, '..', 'src', 'data', 'entidades');
const files = fs.readdirSync(dirPath);

files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).slice(0, 10);
    console.log(`=== File: ${file} ===`);
    lines.forEach(line => console.log(line));
    console.log('');
});
