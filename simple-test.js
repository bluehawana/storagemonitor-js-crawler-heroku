require('dotenv').config();
const puppeteer = require('puppeteer');

async function testOriola() {
    console.log('🔍 Testing Oriola4Care login...\n');
    
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        
        console.log('📥 Loading login page...');
        await page.goto('https://oriola4care.oriola-kd.com/login', { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        console.log('✅ Page loaded successfully!');
        
        // Extract form information
        const formInfo = await page.evaluate(() => {
            // Find all input fields
            const inputs = Array.from(document.querySelectorAll('input'));
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            
            const emailInputs = inputs.filter(input => 
                input.type === 'email' || 
                input.type === 'text' ||
                input.name?.toLowerCase().includes('email') ||
                input.id?.toLowerCase().includes('email') ||
                input.placeholder?.toLowerCase().includes('mail') ||
                input.placeholder?.toLowerCase().includes('e-post')
            );
            
            const passwordInputs = inputs.filter(input => 
                input.type === 'password'
            );
            
            const submitButtons = buttons.filter(button =>
                button.type === 'submit' ||
                button.textContent?.toLowerCase().includes('logga') ||
                button.textContent?.toLowerCase().includes('login') ||
                button.textContent?.toLowerCase().includes('skicka')
            );
            
            return {
                emailFields: emailInputs.map(input => ({
                    id: input.id,
                    name: input.name,
                    type: input.type,
                    className: input.className,
                    placeholder: input.placeholder
                })),
                passwordFields: passwordInputs.map(input => ({
                    id: input.id,
                    name: input.name,
                    type: input.type,
                    className: input.className,
                    placeholder: input.placeholder
                })),
                submitButtons: submitButtons.map(button => ({
                    id: button.id,
                    name: button.name,
                    type: button.type,
                    className: button.className,
                    textContent: button.textContent?.trim()
                })),
                pageTitle: document.title,
                url: window.location.href
            };
        });
        
        console.log('📋 Form Analysis Results:\n');
        console.log(`Page Title: ${formInfo.pageTitle}`);
        console.log(`URL: ${formInfo.url}\n`);
        
        console.log('📧 Email/Username fields found:');
        if (formInfo.emailFields.length === 0) {
            console.log('   ❌ No email fields detected');
        } else {
            formInfo.emailFields.forEach((field, index) => {
                console.log(`   ${index + 1}. ID: "${field.id}" | Name: "${field.name}" | Type: ${field.type}`);
                console.log(`      Class: "${field.className}" | Placeholder: "${field.placeholder}"`);
            });
        }
        
        console.log('\n🔒 Password fields found:');
        if (formInfo.passwordFields.length === 0) {
            console.log('   ❌ No password fields detected');
        } else {
            formInfo.passwordFields.forEach((field, index) => {
                console.log(`   ${index + 1}. ID: "${field.id}" | Name: "${field.name}"`);
                console.log(`      Class: "${field.className}" | Placeholder: "${field.placeholder}"`);
            });
        }
        
        console.log('\n🚀 Submit buttons found:');
        if (formInfo.submitButtons.length === 0) {
            console.log('   ❌ No submit buttons detected');
        } else {
            formInfo.submitButtons.forEach((button, index) => {
                console.log(`   ${index + 1}. ID: "${button.id}" | Name: "${button.name}" | Type: ${button.type}`);
                console.log(`      Class: "${button.className}" | Text: "${button.textContent}"`);
            });
        }
        
        // Generate recommended selectors
        console.log('\n🎯 RECOMMENDED SELECTORS FOR .env:\n');
        
        if (formInfo.emailFields.length > 0) {
            const emailField = formInfo.emailFields[0];
            let emailSelector = '';
            if (emailField.id) {
                emailSelector = `#${emailField.id}`;
            } else if (emailField.name) {
                emailSelector = `input[name="${emailField.name}"]`;
            } else if (emailField.type === 'email') {
                emailSelector = 'input[type="email"]';
            } else {
                emailSelector = 'input[type="text"]';
            }
            console.log(`USERNAME_SELECTOR=${emailSelector}`);
        }
        
        if (formInfo.passwordFields.length > 0) {
            const passwordField = formInfo.passwordFields[0];
            let passwordSelector = '';
            if (passwordField.id) {
                passwordSelector = `#${passwordField.id}`;
            } else if (passwordField.name) {
                passwordSelector = `input[name="${passwordField.name}"]`;
            } else {
                passwordSelector = 'input[type="password"]';
            }
            console.log(`PASSWORD_SELECTOR=${passwordSelector}`);
        }
        
        if (formInfo.submitButtons.length > 0) {
            const submitButton = formInfo.submitButtons[0];
            let submitSelector = '';
            if (submitButton.id) {
                submitSelector = `#${submitButton.id}`;
            } else if (submitButton.name) {
                submitSelector = `button[name="${submitButton.name}"]`;
            } else {
                submitSelector = 'button[type="submit"]';
            }
            console.log(`LOGIN_BUTTON_SELECTOR=${submitSelector}`);
        }
        
        console.log('LOGIN_SUCCESS_SELECTOR=.main-content, .dashboard, nav, .user-info\n');
        
        console.log('💡 Browser will stay open for 30 seconds for manual inspection...');
        await page.waitForTimeout(30000);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await browser.close();
    }
}

testOriola().catch(console.error);