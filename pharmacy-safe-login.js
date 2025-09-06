const puppeteer = require('puppeteer');
require('dotenv').config();

async function testPharmacySafeLogin() {
    console.log('🏥 Testing pharmacy-safe login approach...\n');
    
    let browser;
    try {
        // Use stealth techniques for pharmacy websites
        browser = await puppeteer.launch({
            headless: false, // Start with visible browser
            slowMo: 250, // Slow down actions to appear more human
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled', // Hide automation
                '--disable-dev-shm-usage',
                '--start-maximized',
                '--no-first-run',
                '--disable-extensions-except=/path/to/extension',
                '--disable-plugins-discovery',
                '--disable-default-apps'
            ]
        });
        
        const page = await browser.newPage();
        
        // Remove webdriver traces
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            // Remove automation indicators
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
        });
        
        // Set realistic viewport and user agent
        await page.setViewport({ width: 1366, height: 768 });
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set extra headers to look more legitimate
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        });
        
        console.log('🌐 Navigating to pharmacy website...');
        
        // Navigate with realistic timing
        await page.goto(process.env.LOGIN_URL, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        // Wait like a human would
        await page.waitForTimeout(3000 + Math.random() * 2000);
        
        console.log('📋 Checking page content...');
        
        // Check what we actually got
        const pageInfo = await page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                hasUsernameField: !!document.querySelector('#j_username'),
                hasPasswordField: !!document.querySelector('#j_password'),
                hasLoginButton: !!document.querySelector('button[type="submit"]'),
                bodyText: document.body.innerText.substring(0, 500),
                forms: Array.from(document.forms).map(form => ({
                    action: form.action,
                    method: form.method,
                    inputs: Array.from(form.elements).map(el => ({
                        type: el.type,
                        name: el.name,
                        id: el.id
                    }))
                }))
            };
        });
        
        console.log('📄 Page Analysis:');
        console.log(`   Title: ${pageInfo.title}`);
        console.log(`   URL: ${pageInfo.url}`);
        console.log(`   Username field: ${pageInfo.hasUsernameField ? '✅' : '❌'}`);
        console.log(`   Password field: ${pageInfo.hasPasswordField ? '✅' : '❌'}`);
        console.log(`   Login button: ${pageInfo.hasLoginButton ? '✅' : '❌'}`);
        console.log(`   Forms found: ${pageInfo.forms.length}`);
        
        if (pageInfo.bodyText.toLowerCase().includes('blocked') || 
            pageInfo.bodyText.toLowerCase().includes('access denied') ||
            pageInfo.bodyText.toLowerCase().includes('bot')) {
            console.log('🚫 Possible bot detection:');
            console.log(pageInfo.bodyText);
        }
        
        // Take screenshot for manual inspection
        await page.screenshot({ path: 'pharmacy-page-analysis.png', fullPage: true });
        console.log('📸 Screenshot saved as pharmacy-page-analysis.png');
        
        if (!pageInfo.hasUsernameField || !pageInfo.hasPasswordField) {
            console.log('❌ Login form not accessible - possible bot detection');
            console.log('💡 This pharmacy website may be blocking automated access');
            return false;
        }
        
        console.log('📝 Attempting human-like login...');
        
        // Human-like interactions
        await page.hover('#j_username');
        await page.waitForTimeout(500 + Math.random() * 500);
        await page.click('#j_username');
        await page.waitForTimeout(200);
        
        // Type with human-like delays
        for (const char of process.env.USERNAME) {
            await page.keyboard.type(char);
            await page.waitForTimeout(50 + Math.random() * 100);
        }
        
        await page.waitForTimeout(500 + Math.random() * 500);
        
        await page.hover('#j_password');
        await page.waitForTimeout(300);
        await page.click('#j_password');
        await page.waitForTimeout(200);
        
        for (const char of process.env.PASSWORD) {
            await page.keyboard.type(char);
            await page.waitForTimeout(50 + Math.random() * 100);
        }
        
        await page.waitForTimeout(1000 + Math.random() * 1000);
        
        console.log('🚀 Submitting form...');
        
        // Submit with human timing
        await page.hover('button[type="submit"]');
        await page.waitForTimeout(500);
        
        const [response] = await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => null),
            page.click('button[type="submit"]')
        ]);
        
        await page.waitForTimeout(5000);
        
        const finalUrl = page.url();
        console.log('📍 Final URL:', finalUrl);
        
        // Take final screenshot
        await page.screenshot({ path: 'pharmacy-login-result.png', fullPage: true });
        
        if (finalUrl.includes('/login')) {
            console.log('❌ Still on login page - checking for errors...');
            
            const errorInfo = await page.evaluate(() => {
                const errorSelectors = ['.alert', '.error', '.message', '.notification'];
                for (const selector of errorSelectors) {
                    const el = document.querySelector(selector);
                    if (el && el.textContent.trim()) {
                        return el.textContent.trim();
                    }
                }
                return null;
            });
            
            if (errorInfo) {
                console.log('❌ Error message:', errorInfo);
            }
            
            return false;
        } else {
            console.log('✅ Redirected - possible login success!');
            return true;
        }
        
    } catch (error) {
        console.error('❌ Pharmacy login test failed:', error.message);
        
        if (error.message.includes('socket hang up') || 
            error.message.includes('ECONNRESET') ||
            error.message.includes('net::ERR_')) {
            console.log('💡 This appears to be network-level blocking by the pharmacy website');
            console.log('   Pharmacy sites often have strict anti-automation measures');
        }
        
        return false;
    } finally {
        if (browser) {
            console.log('⏳ Keeping browser open for 10 seconds for manual inspection...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            await browser.close();
        }
    }
}

testPharmacySafeLogin().then(success => {
    if (success) {
        console.log('\n🎉 Pharmacy login test completed successfully!');
    } else {
        console.log('\n💊 Pharmacy website appears to have anti-automation protection');
        console.log('💡 Recommendations:');
        console.log('   1. Use manual login for initial setup');
        console.log('   2. Consider using session cookies after manual login');
        console.log('   3. Implement longer delays between requests');
        console.log('   4. Use residential proxy if needed');
    }
}).catch(console.error);