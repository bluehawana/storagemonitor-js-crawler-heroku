const puppeteer = require('puppeteer');

async function testPuppeteerFixes() {
    console.log('Testing Puppeteer with various fixes...\n');
    
    const configs = [
        {
            name: 'Standard headless',
            config: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        },
        {
            name: 'New headless mode',
            config: {
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        },
        {
            name: 'Non-headless',
            config: {
                headless: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        },
        {
            name: 'With additional args',
            config: {
                headless: "new",
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            }
        },
        {
            name: 'With executablePath',
            config: {
                headless: "new",
                executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        }
    ];
    
    for (const { name, config } of configs) {
        console.log(`🔧 Testing: ${name}`);
        
        try {
            const browser = await puppeteer.launch(config);
            const page = await browser.newPage();
            await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 5000 });
            const title = await page.title();
            await browser.close();
            
            console.log(`✅ ${name} - SUCCESS! Title: ${title}\n`);
            return { success: true, workingConfig: config };
            
        } catch (error) {
            console.log(`❌ ${name} - FAILED: ${error.message}\n`);
            continue;
        }
    }
    
    return { success: false, workingConfig: null };
}

testPuppeteerFixes().then(result => {
    if (result.success) {
        console.log('🎉 Found working Puppeteer configuration!');
        console.log('Working config:', JSON.stringify(result.workingConfig, null, 2));
    } else {
        console.log('❌ No working Puppeteer configuration found');
        console.log('💡 Suggestions:');
        console.log('   1. Install Chrome: brew install --cask google-chrome');
        console.log('   2. Update Puppeteer: npm update puppeteer');
        console.log('   3. Clear npm cache: npm cache clean --force');
    }
}).catch(console.error);