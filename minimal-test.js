const puppeteer = require('puppeteer');

async function minimal() {
    console.log('Starting minimal test...');
    try {
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        console.log('Browser launched');
        await browser.close();
        console.log('Browser closed - SUCCESS');
    } catch (error) {
        console.error('Error:', error);
    }
}

minimal();