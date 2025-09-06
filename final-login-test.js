const puppeteer = require('puppeteer');
require('dotenv').config();

async function testOriola4CareLogin() {
    console.log('🔍 Testing Oriola4Care login with actual credentials...\n');
    
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log('📍 Loading login page...');
        await page.goto('https://oriola4care.oriola-kd.com/login', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        console.log('✅ Login page loaded');
        console.log(`📧 Username: ${process.env.USERNAME}`);
        console.log(`🔒 Password: ${'*'.repeat(process.env.PASSWORD.length)}`);
        
        // Wait for and fill username
        await page.waitForSelector('#j_username', { timeout: 10000 });
        await page.clear('#j_username');
        await page.type('#j_username', process.env.USERNAME, { delay: 100 });
        
        // Wait for and fill password  
        await page.waitForSelector('#j_password', { timeout: 10000 });
        await page.clear('#j_password');
        await page.type('#j_password', process.env.PASSWORD, { delay: 100 });
        
        console.log('📝 Credentials filled');
        
        // Submit form
        console.log('🚀 Submitting login...');
        const navigationPromise = page.waitForNavigation({ 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        }).catch(() => {
            // Navigation timeout is okay, might stay on same page
            return null;
        });
        
        await page.click('button[type="submit"]');
        await navigationPromise;
        
        // Check current URL and page content
        const currentUrl = page.url();
        console.log('📍 Current URL:', currentUrl);
        
        if (currentUrl.includes('/login')) {
            console.log('❌ LOGIN FAILED - Still on login page');
            
            // Look for error messages
            const errorSelectors = [
                '.alert',
                '.error', 
                '.message',
                '.form-error',
                '[class*="error"]'
            ];
            
            let errorFound = false;
            for (const selector of errorSelectors) {
                try {
                    const errorElement = await page.$(selector);
                    if (errorElement) {
                        const errorText = await page.evaluate(el => el.textContent.trim(), errorElement);
                        if (errorText) {
                            console.log('❌ Error:', errorText);
                            errorFound = true;
                            break;
                        }
                    }
                } catch (e) {
                    // Continue
                }
            }
            
            if (!errorFound) {
                console.log('❌ No specific error message found');
                console.log('💡 Possible issues:');
                console.log('   - Invalid credentials');
                console.log('   - Account locked/suspended');
                console.log('   - Additional verification required');
            }
            
        } else {
            console.log('✅ LOGIN SUCCESSFUL - Redirected to:', currentUrl);
            
            // Look for logged-in indicators
            const loggedInSelectors = [
                '.user-menu',
                '.logout',
                '.dashboard',
                '.account-info', 
                'nav',
                '.main-content'
            ];
            
            for (const selector of loggedInSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        console.log(`✅ Found logged-in indicator: ${selector}`);
                        break;
                    }
                } catch (e) {
                    // Continue
                }
            }
        }
        
        // Get page title for verification
        const pageTitle = await page.title();
        console.log('📄 Page title:', pageTitle);
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (browser) {
            await browser.close();
        }
        console.log('✅ Test completed');
    }
}

// Add promise error handler
process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

testOriola4CareLogin();