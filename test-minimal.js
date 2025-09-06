require('dotenv').config();

async function testMinimal() {
    console.log('🔍 Testing minimal browser setup...\n');
    
    let puppeteer;
    try {
        puppeteer = require('puppeteer');
    } catch (err) {
        console.error('❌ Puppeteer not installed properly:', err.message);
        return;
    }
    
    console.log('✅ Puppeteer loaded');
    console.log(`📍 Login URL: ${process.env.LOGIN_URL}`);
    console.log(`👤 Username: ${process.env.USERNAME}`);
    
    let browser = null;
    
    try {
        console.log('🚀 Launching browser...');
        browser = await puppeteer.launch({
            headless: 'new',  // Use new headless mode
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ],
            timeout: 30000
        });
        
        console.log('✅ Browser launched successfully');
        
        const page = await browser.newPage();
        console.log('✅ New page created');
        
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        console.log('✅ User agent set');
        
        console.log('🌐 Navigating to login page...');
        await page.goto(process.env.LOGIN_URL, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        console.log('✅ Page loaded successfully!');
        
        // Get page title and URL to confirm we're on the right page
        const pageTitle = await page.title();
        const currentUrl = page.url();
        
        console.log(`📄 Page Title: "${pageTitle}"`);
        console.log(`🔗 Current URL: ${currentUrl}`);
        
        // Look for form fields
        console.log('\n🔍 Looking for form fields...');
        
        const formElements = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input'));
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            
            return {
                inputs: inputs.map(input => ({
                    type: input.type,
                    name: input.name || '',
                    id: input.id || '',
                    placeholder: input.placeholder || '',
                    className: input.className || ''
                })).slice(0, 10), // Limit to first 10 inputs
                buttons: buttons.map(button => ({
                    type: button.type || '',
                    textContent: button.textContent?.trim() || '',
                    id: button.id || '',
                    className: button.className || ''
                })).slice(0, 5), // Limit to first 5 buttons
                hasEmailInput: !!document.querySelector('input[type="email"]'),
                hasPasswordInput: !!document.querySelector('input[type="password"]'),
                hasTextInputs: document.querySelectorAll('input[type="text"]').length > 0
            };
        });
        
        console.log('📊 Form Analysis:');
        console.log(`   📧 Has email input: ${formElements.hasEmailInput}`);
        console.log(`   🔒 Has password input: ${formElements.hasPasswordInput}`);
        console.log(`   📝 Has text inputs: ${formElements.hasTextInputs}`);
        
        if (formElements.inputs.length > 0) {
            console.log('\n📝 Input fields found:');
            formElements.inputs.forEach((input, index) => {
                console.log(`   ${index + 1}. Type: ${input.type} | ID: "${input.id}" | Name: "${input.name}"`);
                if (input.placeholder) console.log(`      Placeholder: "${input.placeholder}"`);
            });
        }
        
        if (formElements.buttons.length > 0) {
            console.log('\n🔘 Buttons found:');
            formElements.buttons.forEach((button, index) => {
                console.log(`   ${index + 1}. Type: ${button.type} | Text: "${button.textContent}" | ID: "${button.id}"`);
            });
        }
        
        // Try to find login form
        const loginAttempt = await page.evaluate(() => {
            // Look for email/username field
            const emailField = document.querySelector('input[type="email"]') || 
                              document.querySelector('input[name*="email"]') ||
                              document.querySelector('input[placeholder*="E-post"]') ||
                              document.querySelector('input[placeholder*="email"]') ||
                              document.querySelector('input[type="text"]');
                              
            const passwordField = document.querySelector('input[type="password"]');
            const submitButton = document.querySelector('button[type="submit"]') || 
                               document.querySelector('input[type="submit"]') ||
                               document.querySelector('button');
            
            return {
                hasEmailField: !!emailField,
                hasPasswordField: !!passwordField,
                hasSubmitButton: !!submitButton,
                emailSelector: emailField ? (emailField.id ? `#${emailField.id}` : 
                              emailField.name ? `input[name="${emailField.name}"]` : 
                              `input[type="${emailField.type}"]`) : null,
                passwordSelector: passwordField ? (passwordField.id ? `#${passwordField.id}` : 
                                 passwordField.name ? `input[name="${passwordField.name}"]` : 
                                 'input[type="password"]') : null,
                submitSelector: submitButton ? (submitButton.id ? `#${submitButton.id}` : 
                              submitButton.type === 'submit' ? `${submitButton.tagName.toLowerCase()}[type="submit"]` : 
                              submitButton.tagName.toLowerCase()) : null
            };
        });
        
        console.log('\n🎯 Login Form Analysis:');
        console.log(`   📧 Email field found: ${loginAttempt.hasEmailField}`);
        console.log(`   🔒 Password field found: ${loginAttempt.hasPasswordField}`);
        console.log(`   🚀 Submit button found: ${loginAttempt.hasSubmitButton}`);
        
        if (loginAttempt.emailSelector) {
            console.log(`   📧 Suggested email selector: ${loginAttempt.emailSelector}`);
        }
        if (loginAttempt.passwordSelector) {
            console.log(`   🔒 Suggested password selector: ${loginAttempt.passwordSelector}`);
        }
        if (loginAttempt.submitSelector) {
            console.log(`   🚀 Suggested submit selector: ${loginAttempt.submitSelector}`);
        }
        
        // If we have all fields, try the login
        if (loginAttempt.hasEmailField && loginAttempt.hasPasswordField && loginAttempt.hasSubmitButton) {
            console.log('\n🔐 All login fields found! Attempting login...');
            
            try {
                await page.type(loginAttempt.emailSelector, process.env.USERNAME);
                console.log('✅ Username entered');
                
                await page.type(loginAttempt.passwordSelector, process.env.PASSWORD);
                console.log('✅ Password entered');
                
                await page.click(loginAttempt.submitSelector);
                console.log('✅ Login button clicked');
                
                await page.waitForTimeout(5000); // Wait 5 seconds for response
                
                const afterLoginUrl = page.url();
                const afterLoginTitle = await page.title();
                
                console.log(`📄 After login - Title: "${afterLoginTitle}"`);
                console.log(`🔗 After login - URL: ${afterLoginUrl}`);
                
                if (afterLoginUrl !== currentUrl || afterLoginTitle !== pageTitle) {
                    console.log('🎉 LOGIN SUCCESSFUL! Page changed after login.');
                } else {
                    console.log('⚠️  Login may have failed - page didn\'t change.');
                }
                
            } catch (loginError) {
                console.error('❌ Login attempt failed:', loginError.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.message.includes('ERR_NAME_NOT_RESOLVED')) {
            console.log('💡 The website may be unreachable from this location');
        }
        if (error.message.includes('timeout')) {
            console.log('💡 The website is taking too long to respond');
        }
    } finally {
        if (browser) {
            await browser.close();
            console.log('🧹 Browser closed');
        }
    }
}

testMinimal().catch(console.error);