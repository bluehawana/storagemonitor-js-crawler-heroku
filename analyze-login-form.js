const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

async function analyzeLoginForm() {
    console.log('🔍 Analyzing Oriola4Care login form...\n');
    
    try {
        // Get the login page
        const response = await axios.get(process.env.LOGIN_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        console.log(`✅ Login page loaded (${response.status})`);
        
        // Parse HTML
        const $ = cheerio.load(response.data);
        
        // Find all forms
        const forms = $('form');
        console.log(`📋 Found ${forms.length} form(s) on the page\n`);
        
        forms.each((i, form) => {
            const $form = $(form);
            const action = $form.attr('action') || 'No action specified';
            const method = $form.attr('method') || 'GET';
            const id = $form.attr('id') || 'No ID';
            const className = $form.attr('class') || 'No class';
            
            console.log(`📝 Form ${i + 1}:`);
            console.log(`   Action: ${action}`);
            console.log(`   Method: ${method.toUpperCase()}`);
            console.log(`   ID: ${id}`);
            console.log(`   Class: ${className}`);
            
            // Find all inputs in this form
            const inputs = $form.find('input, select, textarea');
            console.log(`   Inputs (${inputs.length}):`);
            
            inputs.each((j, input) => {
                const $input = $(input);
                const type = $input.attr('type') || 'text';
                const name = $input.attr('name') || 'No name';
                const id = $input.attr('id') || 'No ID';
                const value = $input.attr('value') || '';
                const placeholder = $input.attr('placeholder') || '';
                
                console.log(`     - ${type}: name="${name}", id="${id}", value="${value}", placeholder="${placeholder}"`);
            });
            
            console.log('');
        });
        
        // Look for specific login elements
        console.log('🔍 Login-specific elements:');
        
        const usernameField = $('#j_username');
        const passwordField = $('#j_password');
        const submitButton = $('button[type="submit"], input[type="submit"]');
        
        console.log(`   Username field (#j_username): ${usernameField.length > 0 ? '✅ Found' : '❌ Not found'}`);
        console.log(`   Password field (#j_password): ${passwordField.length > 0 ? '✅ Found' : '❌ Not found'}`);
        console.log(`   Submit button: ${submitButton.length > 0 ? '✅ Found' : '❌ Not found'}`);
        
        if (usernameField.length > 0) {
            console.log(`     Username field details: name="${usernameField.attr('name')}", form="${usernameField.closest('form').attr('action')}"`);
        }
        
        if (passwordField.length > 0) {
            console.log(`     Password field details: name="${passwordField.attr('name')}", form="${passwordField.closest('form').attr('action')}"`);
        }
        
        // Look for CSRF tokens
        const csrfTokens = $('input[name*="token"], input[name*="csrf"], meta[name*="csrf"]');
        if (csrfTokens.length > 0) {
            console.log('\n🔒 CSRF Protection detected:');
            csrfTokens.each((i, token) => {
                const $token = $(token);
                console.log(`   ${$token.prop('tagName')}: name="${$token.attr('name')}", content="${$token.attr('content') || $token.attr('value')}"`);
            });
        }
        
        // Check for JavaScript-based form handling
        const scripts = $('script');
        let hasFormJS = false;
        scripts.each((i, script) => {
            const scriptContent = $(script).html() || '';
            if (scriptContent.includes('form') && (scriptContent.includes('submit') || scriptContent.includes('login'))) {
                hasFormJS = true;
            }
        });
        
        if (hasFormJS) {
            console.log('\n⚠️  JavaScript form handling detected - may require browser automation');
        }
        
        // Extract the correct form action and method
        const loginForm = usernameField.closest('form');
        if (loginForm.length > 0) {
            const formAction = loginForm.attr('action');
            const formMethod = loginForm.attr('method') || 'POST';
            
            console.log('\n🎯 Login form details:');
            console.log(`   Action: ${formAction}`);
            console.log(`   Method: ${formMethod}`);
            
            // Construct full URL if action is relative
            let fullActionUrl = formAction;
            if (formAction && !formAction.startsWith('http')) {
                const baseUrl = new URL(process.env.LOGIN_URL);
                if (formAction.startsWith('/')) {
                    fullActionUrl = `${baseUrl.protocol}//${baseUrl.host}${formAction}`;
                } else {
                    fullActionUrl = `${baseUrl.protocol}//${baseUrl.host}${baseUrl.pathname}/${formAction}`;
                }
            }
            
            console.log(`   Full action URL: ${fullActionUrl}`);
            
            return {
                actionUrl: fullActionUrl,
                method: formMethod.toUpperCase(),
                hasCSRF: csrfTokens.length > 0,
                requiresJS: hasFormJS
            };
        }
        
        return null;
        
    } catch (error) {
        console.error('❌ Failed to analyze login form:', error.message);
        return null;
    }
}

// Install cheerio if needed and run analysis
async function main() {
    try {
        await analyzeLoginForm();
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('cheerio')) {
            console.log('📦 Installing cheerio...');
            const { execSync } = require('child_process');
            execSync('npm install cheerio', { stdio: 'inherit' });
            
            // Retry after installation
            delete require.cache[require.resolve('cheerio')];
            await analyzeLoginForm();
        } else {
            throw error;
        }
    }
}

main().catch(console.error);