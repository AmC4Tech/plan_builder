
import fs from 'fs-extra';
import path from 'path';

const filePath = path.join(process.cwd(), 'debug-ai-output.json');

async function check() {
    if (!fs.existsSync(filePath)) {
        console.log('File not found');
        return;
    }
    const data = await fs.readJson(filePath);
    console.log('Keys:', Object.keys(data));
}

check().catch(console.error);
