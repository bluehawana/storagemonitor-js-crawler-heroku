const puppeteer = require('puppeteer');
require('dotenv').config();

async function testLogin() {
    console.log('🔍 Testing Oriola4care login...\n');
    
    let browser;
    let success = false;
    
    try {
        // Try different browser configurations
        const configs = [
            {
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            },
            {
                headless: false,
                args: ['--no-sandbox', '--disable-web-security', '--disable-features=VizDisplayCompositor']
            }
        ];
        
        for (let i = 0; i < configs.length && !success; i++) {
            console.log(`Trying browser config ${i + 1}...`);
            
            try {
                browser = await puppeteer.launch(configs[i]);
                const page = await browser.newPage();
                
                // Set a more complete user agent
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                
                console.log('📍 Navigating to login page...');
                await page.goto(process.env.LOGIN_URL, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 20000 
                });
                
                // Wait a bit for dynamic content
                await page.waitForTimeout(2000);
                
                console.log('📝 Filling credentials...');
                
                // Fill username
                await page.waitForSelector('#j_username', { timeout: 10000 });
                await page.evaluate(() => document.querySelector('#j_username').value = '');
                await page.type('#j_username', process.env.USERNAME, { delay: 50 });
                
                // Fill password
                await page.waitForSelector('#j_password', { timeout: 10000 });
                await page.evaluate(() => document.querySelector('#j_password').value = '');
                await page.type('#j_password', process.env.PASSWORD, { delay: 50 });
                
                console.log('🚀 Submitting form...');
                
                // Submit and handle potential navigation
                const [response] = await Promise.all([
                    page.waitForResponse(response => response.url().includes('login') || response.url().includes('home') || response.url().includes('dashboard'), { timeout: 15000 }).catch(() => null),
                    page.click('button[type="submit"]')
                ]);
                
                // Wait a bit for the response to process
                await page.waitForTimeout(3000);
                
                const currentUrl = page.url();
                console.log('📍 Current URL:', currentUrl);
                
                // Check if login was successful
                if (!currentUrl.includes('/login')) {
                    console.log('✅ LOGIN SUCCESS! Redirected away from login page');
                    success = true;
                    
                    // Look for success indicators
                    const indicators = await page.evaluate(() => {
                        const selectors = ['.user-info', '.logout', '.dashboard', 'nav', '.account'];
                        return selectors.map(sel => ({
                            selector: sel,
                            found: !!document.querySelector(sel)
                        })).filter(item => item.found);
                    });
                    
                    if (indicators.length > 0) {
                        console.log('✅ Success indicators found:', indicators.map(i => i.selector).join(', '));
                    }
                    
                    // Get page title
                    const title = await page.title();
                    console.log('📄 Page title:', title);
                    
                } else {
                    // Check for error messages
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
                        console.log('❌ Login error:', errors);
                    } else {
                        console.log('❌ Login failed - still on login page');
                    }
                }
                
                // Keep browser open briefly if not headless for manual inspection
                if (!configs[i].headless) {
                    console.log('⏳ Keeping browser open for 5 seconds...');
                    await page.waitForTimeout(5000);
                }
                
                break; // Exit the config loop since we got this far
                
            } catch (configError) {
                console.log(`Config ${i + 1} failed:`, configError.message);
                if (browser) {
                    await browser.close();
                    browser = null;
                }
                continue;
            }
        }
        
        if (!success) {
            console.log('❌ All browser configurations failed');
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    } finally {
        if (browser) {
            await browser.close();
        }
        console.log('✅ Login test completed');
    }
}

// Run the test
testLogin().then(success => {
    if (success) {
        console.log('\n🎉 Login test PASSED! Ready to proceed with monitoring setup.');
    } else {
        console.log('\n💡 If login issues persist, we can proceed with manual configuration.');
    }
}).catch(console.error);