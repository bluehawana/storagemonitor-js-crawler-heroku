const puppeteer = require('puppeteer');

async function testPuppeteer() {
    console.log('Testing basic Puppeteer functionality...');
    
    try {
        console.log('1. Launching browser...');
        const browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        console.log('2. Creating new page...');
        const page = await browser.newPage();
        
        console.log('3. Navigating to Google...');
        await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
        
        console.log('4. Getting page title...');
        const title = await page.title();
        console.log('   Title:', title);
        
        console.log('5. Closing browser...');
        await browser.close();
        
        console.log('✅ Puppeteer test successful!');
        return true;
        
    } catch (error) {
        console.error('❌ Puppeteer test failed:', error.message);
        console.error('Error details:', error);
        return false;
    }
}

testPuppeteer();