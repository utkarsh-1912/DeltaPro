const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            results.push(file);
        }
    });
    return results;
}

const files = walk('src/app/api').filter(f => f.endsWith('route.ts') || f.endsWith('route.js'));
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('export const dynamic')) {
        fs.writeFileSync(file, 'export const dynamic = "force-dynamic";\n' + content);
        console.log(`Updated ${file}`);
    }
});
