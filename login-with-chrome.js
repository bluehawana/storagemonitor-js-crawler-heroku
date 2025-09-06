const puppeteer = require('puppeteer');
require('dotenv').config();

async function testLoginWithChrome() {
    console.log('🔍 Testing login with explicit Chrome path...\n');
    
    let browser;
    try {
        // Try with explicit Chrome path
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu'
            ]
        });
        
        console.log('✅ Browser launched with Chrome');
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log('📍 Loading login page...');
        await page.goto(process.env.LOGIN_URL, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        console.log('✅ Page loaded successfully');
        console.log(`📧 Username: ${process.env.USERNAME}`);
        console.log(`🔒 Password: ${'*'.repeat(process.env.PASSWORD.length)}`);
        
        // Fill credentials
        await page.waitForSelector('#j_username', { timeout: 10000 });
        await page.type('#j_username', process.env.USERNAME, { delay: 100 });
        
        await page.waitForSelector('#j_password', { timeout: 10000 });
        await page.type('#j_password', process.env.PASSWORD, { delay: 100 });
        
        console.log('📝 Credentials filled');
        console.log('🚀 Submitting login...');
        
        // Submit and wait
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => null),
            page.click('button[type="submit"]')
        ]);
        
        await page.waitForTimeout(2000);
        
        const currentUrl = page.url();
        const pageTitle = await page.title();
        
        console.log('📍 Current URL:', currentUrl);
        console.log('📄 Page title:', pageTitle);
        
        if (!currentUrl.includes('/login')) {
            console.log('✅ LOGIN SUCCESS! Redirected away from login page');
            
            // Look for logged-in indicators
            const indicators = await page.evaluate(() => {
                const selectors = [
                    '.user-menu', '.logout', '.dashboard', '.account-info', 
                    'nav', '.main-content', '.user-info'
                ];
                return selectors.map(sel => ({
                    selector: sel,
                    found: !!document.querySelector(sel),
                    text: document.querySelector(sel)?.textContent?.trim()?.substring(0, 50)
                })).filter(item => item.found);
            });
            
            console.log('✅ Found success indicators:');
            indicators.forEach(ind => {
                console.log(`   - ${ind.selector}${ind.text ? ': ' + ind.text : ''}`);
            });
            
            return true;
        } else {
            console.log('❌ LOGIN FAILED - Still on login page');
            
            // Check for errors
            const errors = await page.evaluate(() => {
                const errorSelectors = ['.alert', '.error', '.message', '[class*="error"]'];
                for (const selector of errorSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        return element.textContent.trim();
                    }
                }
                return null;
            });
            
            if (errors) {
                console.log('❌ Error message:', errors);
            }
            
            return false;
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

testLoginWithChrome().then(success => {
    if (success) {
        console.log('\n🎉 LOGIN TEST PASSED! We can now proceed with product monitoring setup.');
    } else {
        console.log('\n❌ Login test failed. Please check credentials or try manual login to verify.');
    }
});