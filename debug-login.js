const puppeteer = require('puppeteer');
require('dotenv').config();

async function debugLogin() {
    console.log('🔍 Debugging Oriola4Care login issues...\n');
    
    // Check environment variables first
    console.log('📋 Environment Variables:');
    console.log(`   LOGIN_URL: ${process.env.LOGIN_URL}`);
    console.log(`   USERNAME: ${process.env.USERNAME}`);
    console.log(`   PASSWORD: ${process.env.PASSWORD ? '*'.repeat(process.env.PASSWORD.length) : 'NOT SET'}`);
    console.log(`   USERNAME_SELECTOR: ${process.env.USERNAME_SELECTOR}`);
    console.log(`   PASSWORD_SELECTOR: ${process.env.PASSWORD_SELECTOR}`);
    console.log(`   LOGIN_BUTTON_SELECTOR: ${process.env.LOGIN_BUTTON_SELECTOR}`);
    console.log('');
    
    let browser;
    try {
        console.log('🚀 Launching browser with robust configuration...');
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--ignore-certificate-errors',
                '--ignore-ssl-errors',
                '--ignore-certificate-errors-spki-list'
            ],
            timeout: 60000
        });
        
        const page = await browser.newPage();
        
        // Set longer timeouts
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(30000);
        
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set viewport
        await page.setViewport({ width: 1280, height: 720 });
        
        console.log('📍 Navigating to login page...');
        
        // Try navigation with multiple strategies
        let navigationSuccess = false;
        const strategies = [
            { waitUntil: 'networkidle2' },
            { waitUntil: 'domcontentloaded' },
            { waitUntil: 'load' }
        ];
        
        for (const strategy of strategies) {
            try {
                console.log(`   Trying navigation strategy: ${strategy.waitUntil}`);
                await page.goto(process.env.LOGIN_URL, { 
                    ...strategy,
                    timeout: 20000 
                });
                navigationSuccess = true;
                console.log('   ✅ Navigation successful');
                break;
            } catch (navError) {
                console.log(`   ❌ Strategy failed: ${navError.message}`);
                continue;
            }
        }
        
        if (!navigationSuccess) {
            throw new Error('All navigation strategies failed');
        }
        
        // Wait a bit for dynamic content
        await page.waitForTimeout(3000);
        
        console.log('📄 Page loaded, checking for login form...');
        
        // Check if login form elements exist
        const formCheck = await page.evaluate(() => {
            return {
                usernameField: !!document.querySelector('#j_username'),
                passwordField: !!document.querySelector('#j_password'),
                submitButton: !!document.querySelector('button[type="submit"]'),
                pageTitle: document.title,
                url: window.location.href
            };
        });
        
        console.log('📋 Form check results:');
        console.log(`   Username field (#j_username): ${formCheck.usernameField ? '✅' : '❌'}`);
        console.log(`   Password field (#j_password): ${formCheck.passwordField ? '✅' : '❌'}`);
        console.log(`   Submit button: ${formCheck.submitButton ? '✅' : '❌'}`);
        console.log(`   Page title: ${formCheck.pageTitle}`);
        console.log(`   Current URL: ${formCheck.url}`);
        
        if (!formCheck.usernameField || !formCheck.passwordField) {
            console.log('❌ Login form not found. Taking screenshot for debugging...');
            await page.screenshot({ path: 'login-form-debug.png', fullPage: true });
            console.log('📸 Screenshot saved as login-form-debug.png');
            return false;
        }
        
        console.log('📝 Filling in credentials...');
        
        // Clear and fill username
        await page.click('#j_username');
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await page.type('#j_username', process.env.USERNAME, { delay: 100 });
        
        // Clear and fill password
        await page.click('#j_password');
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await page.type('#j_password', process.env.PASSWORD, { delay: 100 });
        
        console.log('🚀 Submitting login form...');
        
        // Take screenshot before submit
        await page.screenshot({ path: 'before-login-submit.png', fullPage: true });
        
        // Submit form and handle response
        const submitPromise = page.click('button[type="submit"]');
        const navigationPromise = page.waitForNavigation({ 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        }).catch(err => {
            console.log('Navigation timeout (this might be normal):', err.message);
            return null;
        });
        
        await submitPromise;
        await navigationPromise;
        
        // Wait for any redirects or dynamic content
        await page.waitForTimeout(5000);
        
        const finalUrl = page.url();
        console.log('📍 Final URL after login:', finalUrl);
        
        // Take screenshot after login attempt
        await page.screenshot({ path: 'after-login-attempt.png', fullPage: true });
        
        if (finalUrl.includes('/login')) {
            console.log('❌ LOGIN FAILED - Still on login page');
            
            // Look for error messages
            const errorCheck = await page.evaluate(() => {
                const errorSelectors = [
                    '.alert', '.error', '.message', '.form-error', 
                    '[class*="error"]', '[class*="alert"]', '.notification'
                ];
                
                for (const selector of errorSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        return {
                            selector: selector,
                            message: element.textContent.trim()
                        };
                    }
                }
                return null;
            });
            
            if (errorCheck) {
                console.log(`❌ Error found (${errorCheck.selector}): ${errorCheck.message}`);
            } else {
                console.log('❌ No specific error message found');
            }
            
            return false;
        } else {
            console.log('✅ LOGIN SUCCESS - Redirected to:', finalUrl);
            
            // Check for success indicators
            const successCheck = await page.evaluate(() => {
                const successSelectors = [
                    '.user-menu', '.logout', '.dashboard', '.account-info', 
                    'nav', '.main-content', '[data-user]'
                ];
                
                const found = [];
                for (const selector of successSelectors) {
                    if (document.querySelector(selector)) {
                        found.push(selector);
                    }
                }
                return found;
            });
            
            if (successCheck.length > 0) {
                console.log('✅ Success indicators found:', successCheck.join(', '));
            }
            
            return true;
        }
        
    } catch (error) {
        console.error('❌ Debug test failed:', error.message);
        console.error('Stack trace:', error.stack);
        return false;
    } finally {
        if (browser) {
            await browser.close();
        }
        console.log('✅ Debug test completed');
    }
}

debugLogin().then(success => {
    console.log(`\n🎯 Login test result: ${success ? 'SUCCESS' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});