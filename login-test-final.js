const puppeteer = require('puppeteer');
require('dotenv').config();

async function testLogin() {
    console.log('🔍 Testing Oriola4care login with credentials...\n');
    
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
        console.log('📍 Navigating to login page...');
        await page.goto(process.env.LOGIN_URL, { waitUntil: 'networkidle2' });
        
        console.log('📝 Filling in credentials...');
        console.log(`   Email: ${process.env.USERNAME}`);
        console.log(`   Password: ${'*'.repeat(process.env.PASSWORD.length)}`);
        
        // Fill username
        await page.waitForSelector('#j_username', { timeout: 10000 });
        await page.type('#j_username', process.env.USERNAME);
        
        // Fill password
        await page.waitForSelector('#j_password', { timeout: 10000 });
        await page.type('#j_password', process.env.PASSWORD);
        
        console.log('🚀 Submitting login form...');
        
        // Click login button and wait for navigation
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
            page.click('button[type="submit"]')
        ]);
        
        const currentUrl = page.url();
        console.log('📍 After login URL:', currentUrl);
        
        // Check if we're still on login page (login failed)
        if (currentUrl.includes('/login')) {
            console.log('❌ LOGIN FAILED - Still on login page');
            
            // Look for error messages
            try {
                const errorMessage = await page.$eval('.alert, .error, .message', el => el.textContent.trim());
                console.log('❌ Error message:', errorMessage);
            } catch (e) {
                console.log('❌ No specific error message found');
            }
        } else {
            console.log('✅ LOGIN SUCCESS - Redirected away from login page');
            
            // Try to find success indicators
            const successSelectors = [
                '.main-content',
                '.dashboard', 
                'nav',
                '.user-info',
                '.account-info',
                '.logout',
                '[data-user]'
            ];
            
            for (const selector of successSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 5000 });
                    console.log(`✅ Success indicator found: ${selector}`);
                    break;
                } catch (e) {
                    // Continue
                }
            }
        }
        
        // Take a screenshot for verification
        await page.screenshot({ path: 'login-result.png', fullPage: true });
        console.log('📸 Screenshot saved as login-result.png');
        
        console.log('\n⏳ Keeping browser open for 15 seconds for inspection...');
        await new Promise(resolve => setTimeout(resolve, 15000));
        
    } catch (error) {
        console.error('❌ Login test failed:', error.message);
    } finally {
        await browser.close();
        console.log('✅ Test completed');
    }
}

testLogin();