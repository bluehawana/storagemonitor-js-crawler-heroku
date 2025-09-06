const puppeteer = require('puppeteer');
require('dotenv').config();

async function testOriolaLogin() {
    console.log('🔍 Testing Oriola4Care login with your credentials...\n');
    
    let browser;
    try {
        // Launch browser with specific settings for Swedish pharmacy
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-features=VizDisplayCompositor',
                '--disable-web-security',
                '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        });
        
        const page = await browser.newPage();
        
        // Set Swedish locale and timezone
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        
        console.log('📍 Navigating to Oriola4Care login...');
        console.log(`   URL: ${process.env.LOGIN_URL}`);
        
        // Navigate with longer timeout for Swedish servers
        await page.goto(process.env.LOGIN_URL, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        // Wait for page to fully load
        await page.waitForTimeout(3000);
        
        console.log('📋 Checking page content...');
        const title = await page.title();
        console.log(`   Page title: ${title}`);
        
        // Check if login form is present
        const loginFormExists = await page.$('#j_username') !== null;
        console.log(`   Login form found: ${loginFormExists ? '✅' : '❌'}`);
        
        if (!loginFormExists) {
            console.log('❌ Login form not found. The page might have changed.');
            return false;
        }
        
        console.log('📝 Filling credentials...');
        console.log(`   Email: ${process.env.USERNAME}`);
        console.log(`   Password: ${'*'.repeat(process.env.PASSWORD.length)}`);
        
        // Clear and fill username
        await page.evaluate(() => {
            const usernameField = document.querySelector('#j_username');
            if (usernameField) usernameField.value = '';
        });
        await page.type('#j_username', process.env.USERNAME, { delay: 100 });
        
        // Clear and fill password
        await page.evaluate(() => {
            const passwordField = document.querySelector('#j_password');
            if (passwordField) passwordField.value = '';
        });
        await page.type('#j_password', process.env.PASSWORD, { delay: 100 });
        
        console.log('🚀 Submitting login form...');
        
        // Submit form and wait for navigation or response
        const submitPromise = page.click('button[type="submit"]');
        const navigationPromise = page.waitForNavigation({ 
            waitUntil: 'domcontentloaded',
            timeout: 20000 
        }).catch(() => {
            console.log('   No navigation detected');
            return null;
        });
        
        await submitPromise;
        await navigationPromise;
        
        // Wait for any dynamic content to load
        await page.waitForTimeout(5000);
        
        const currentUrl = page.url();
        console.log('📍 After login attempt:');
        console.log(`   Current URL: ${currentUrl}`);
        
        // Check for successful login indicators
        const loginSuccess = !currentUrl.includes('/login');
        
        if (loginSuccess) {
            console.log('✅ LOGIN SUCCESSFUL! Redirected away from login page');
            
            // Look for success indicators specific to Oriola4Care
            const successIndicators = await page.evaluate(() => {
                const indicators = [
                    { name: 'Main content', selector: '.main-content' },
                    { name: 'User info', selector: '.user-info' },
                    { name: 'Navigation', selector: 'nav' },
                    { name: 'Account info', selector: '.account-info' },
                    { name: 'Dashboard', selector: '.dashboard' },
                    { name: 'Logout link', selector: 'a[href*="logout"]' }
                ];
                
                return indicators.filter(indicator => 
                    document.querySelector(indicator.selector) !== null
                );
            });
            
            if (successIndicators.length > 0) {
                console.log('✅ Success indicators found:');
                successIndicators.forEach(indicator => {
                    console.log(`   - ${indicator.name}`);
                });
            }
            
            // Get user-specific information if available
            const userInfo = await page.evaluate(() => {
                const userEmail = document.querySelector('.user-email, .account-email, [data-user-email]');
                const userName = document.querySelector('.user-name, .account-name, [data-user-name]');
                
                return {
                    email: userEmail ? userEmail.textContent.trim() : null,
                    name: userName ? userName.textContent.trim() : null
                };
            });
            
            if (userInfo.email || userInfo.name) {
                console.log('👤 User information:');
                if (userInfo.name) console.log(`   Name: ${userInfo.name}`);
                if (userInfo.email) console.log(`   Email: ${userInfo.email}`);
            }
            
        } else {
            console.log('❌ LOGIN FAILED - Still on login page');
            
            // Look for error messages
            const errorMessage = await page.evaluate(() => {
                const errorSelectors = [
                    '.alert-danger',
                    '.error-message', 
                    '.login-error',
                    '[class*="error"]',
                    '.alert'
                ];
                
                for (const selector of errorSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        return element.textContent.trim();
                    }
                }
                return null;
            });
            
            if (errorMessage) {
                console.log(`❌ Error message: ${errorMessage}`);
            }
        }
        
        // Take screenshot for debugging
        await page.screenshot({ 
            path: 'oriola-login-result.png', 
            fullPage: true 
        });
        console.log('📸 Screenshot saved as oriola-login-result.png');
        
        return loginSuccess;
        
    } catch (error) {
        console.error('❌ Login test failed:', error.message);
        return false;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the test
console.log('🇸🇪 Oriola4Care Login Test');
console.log('============================\n');

testOriolaLogin()
    .then(success => {
        if (success) {
            console.log('\n🎉 LOGIN TEST PASSED!');
            console.log('✅ Your credentials are working');
            console.log('✅ Ready to set up product monitoring');
            console.log('\n🔧 Next steps:');
            console.log('   1. Add your product URLs to .env file');
            console.log('   2. Run: node configure-orders.js --safe-defaults');
            console.log('   3. Run: node monitor-products.js');
        } else {
            console.log('\n❌ LOGIN TEST FAILED');
            console.log('💡 Possible issues:');
            console.log('   - Check username/password in .env file');
            console.log('   - Oriola4Care might have changed their login system');
            console.log('   - Two-factor authentication might be required');
            console.log('   - Account might be locked or suspended');
        }
    })
    .catch(console.error);