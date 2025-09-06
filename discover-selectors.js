require('dotenv').config();
const puppeteer = require('puppeteer');

async function discoverSelectors() {
    console.log('🔍 Discovering CSS selectors for login form...\n');
    
    const loginUrl = process.env.LOGIN_URL;
    if (!loginUrl) {
        console.error('❌ LOGIN_URL not set in .env file');
        return;
    }
    
    console.log(`🌐 Analyzing: ${loginUrl}`);
    
    const browser = await puppeteer.launch({ 
        headless: false,  // Show browser for debugging
        devtools: true    // Open devtools
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        
        console.log('📥 Loading login page...');
        await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait a bit for dynamic content
        await page.waitForTimeout(3000);
        
        console.log('🔎 Analyzing page structure...\n');
        
        // Discover selectors
        const selectors = await page.evaluate(() => {
            const results = {
                username: [],
                password: [],
                submit: [],
                forms: [],
                success_indicators: []
            };
            
            // Find all forms
            const forms = document.querySelectorAll('form');
            forms.forEach((form, index) => {
                const formInfo = {
                    index,
                    action: form.action || 'No action',
                    method: form.method || 'GET',
                    id: form.id || 'No ID',
                    className: form.className || 'No class'
                };
                results.forms.push(formInfo);
            });
            
            // Username/Email field patterns
            const usernamePatterns = [
                'input[type="email"]',
                'input[type="text"]',
                'input[name*="email"]',
                'input[name*="username"]',
                'input[name*="user"]',
                'input[name*="login"]',
                '#email', '#username', '#user', '#login',
                '.email', '.username', '.user-input',
                'input[placeholder*="email" i]',
                'input[placeholder*="username" i]',
                'input[placeholder*="user" i]'
            ];
            
            usernamePatterns.forEach(pattern => {
                const elements = document.querySelectorAll(pattern);
                elements.forEach(el => {
                    if (el.type !== 'password' && el.type !== 'submit' && el.type !== 'hidden') {
                        results.username.push({
                            selector: pattern,
                            id: el.id || 'No ID',
                            name: el.name || 'No name',
                            type: el.type,
                            placeholder: el.placeholder || 'No placeholder',
                            className: el.className || 'No class'
                        });
                    }
                });
            });
            
            // Password field patterns
            const passwordPatterns = [
                'input[type="password"]',
                'input[name*="password"]',
                'input[name*="pass"]',
                '#password', '#pass',
                '.password', '.pass-input'
            ];
            
            passwordPatterns.forEach(pattern => {
                const elements = document.querySelectorAll(pattern);
                elements.forEach(el => {
                    results.password.push({
                        selector: pattern,
                        id: el.id || 'No ID',
                        name: el.name || 'No name',
                        type: el.type,
                        placeholder: el.placeholder || 'No placeholder',
                        className: el.className || 'No class'
                    });
                });
            });
            
            // Submit button patterns
            const submitPatterns = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button[name*="login"]',
                'button[name*="submit"]',
                '#login', '#submit', '#login-button',
                '.login-btn', '.submit-btn', '.btn-login',
                'button:contains("Login")',
                'button:contains("Sign In")',
                'button:contains("Submit")'
            ];
            
            submitPatterns.forEach(pattern => {
                try {
                    const elements = document.querySelectorAll(pattern);
                    elements.forEach(el => {
                        results.submit.push({
                            selector: pattern,
                            id: el.id || 'No ID',
                            name: el.name || 'No name',
                            type: el.type || 'button',
                            textContent: el.textContent.trim() || 'No text',
                            className: el.className || 'No class'
                        });
                    });
                } catch (e) {
                    // Skip patterns that don't work in querySelectorAll
                }
            });
            
            // Look for potential success indicators
            const successPatterns = [
                '.dashboard', '.main-content', '.user-nav', '.account',
                '.profile', '.logout', '.user-menu', '.main-nav',
                '#dashboard', '#main-content', '#user-nav'
            ];
            
            successPatterns.forEach(pattern => {
                const elements = document.querySelectorAll(pattern);
                if (elements.length > 0) {
                    results.success_indicators.push({
                        selector: pattern,
                        count: elements.length,
                        visible: Array.from(elements).some(el => 
                            el.offsetWidth > 0 && el.offsetHeight > 0
                        )
                    });
                }
            });
            
            return results;
        });
        
        // Display results
        console.log('📋 ANALYSIS RESULTS:\n');
        
        console.log('🏁 Forms found:');
        selectors.forms.forEach(form => {
            console.log(`   Form ${form.index}: ${form.action} (${form.method})`);
            console.log(`   ID: ${form.id}, Class: ${form.className}\n`);
        });
        
        console.log('👤 Username/Email fields:');
        if (selectors.username.length === 0) {
            console.log('   ❌ No username fields found');
        } else {
            selectors.username.forEach(field => {
                console.log(`   ✅ ${field.selector}`);
                console.log(`      ID: ${field.id}, Name: ${field.name}`);
                console.log(`      Type: ${field.type}, Placeholder: ${field.placeholder}\n`);
            });
        }
        
        console.log('🔒 Password fields:');
        if (selectors.password.length === 0) {
            console.log('   ❌ No password fields found');
        } else {
            selectors.password.forEach(field => {
                console.log(`   ✅ ${field.selector}`);
                console.log(`      ID: ${field.id}, Name: ${field.name}\n`);
            });
        }
        
        console.log('🚀 Submit buttons:');
        if (selectors.submit.length === 0) {
            console.log('   ❌ No submit buttons found');
        } else {
            selectors.submit.forEach(btn => {
                console.log(`   ✅ ${btn.selector}`);
                console.log(`      ID: ${btn.id}, Name: ${btn.name}`);
                console.log(`      Text: "${btn.textContent}"\n`);
            });
        }
        
        // Recommend best selectors
        console.log('🎯 RECOMMENDED SELECTORS:\n');
        
        const bestUsername = selectors.username[0];
        const bestPassword = selectors.password[0];
        const bestSubmit = selectors.submit[0];
        
        if (bestUsername) {
            const usernameSelector = bestUsername.id ? `#${bestUsername.id}` : 
                                   bestUsername.name ? `input[name="${bestUsername.name}"]` :
                                   bestUsername.selector;
            console.log(`USERNAME_SELECTOR=${usernameSelector}`);
        }
        
        if (bestPassword) {
            const passwordSelector = bestPassword.id ? `#${bestPassword.id}` : 
                                   bestPassword.name ? `input[name="${bestPassword.name}"]` :
                                   bestPassword.selector;
            console.log(`PASSWORD_SELECTOR=${passwordSelector}`);
        }
        
        if (bestSubmit) {
            const submitSelector = bestSubmit.id ? `#${bestSubmit.id}` : 
                                 bestSubmit.name ? `button[name="${bestSubmit.name}"]` :
                                 bestSubmit.selector;
            console.log(`LOGIN_BUTTON_SELECTOR=${submitSelector}`);
        }
        
        console.log('LOGIN_SUCCESS_SELECTOR=.dashboard, .main-content, .user-nav');
        
        console.log('\n💡 Please manually inspect the page and update your .env file with the correct selectors.');
        console.log('   The browser window will stay open for 30 seconds for you to inspect...');
        
        // Keep browser open for inspection
        await page.waitForTimeout(30000);
        
    } catch (error) {
        console.error('❌ Error analyzing page:', error.message);
        
        if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
            console.log('\n💡 The website appears to be unreachable. Please check:');
            console.log('   - Is the URL correct?');
            console.log('   - Is your internet connection working?');
            console.log('   - Is the website accessible from your location?');
            console.log('   - Does the website require VPN access?');
        }
        
    } finally {
        await browser.close();
    }
}

discoverSelectors().catch(console.error);