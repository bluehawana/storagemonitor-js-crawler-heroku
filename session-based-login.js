const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
require('dotenv').config();

// Create axios instance with cookie support
const jar = new tough.CookieJar();
const client = wrapper(axios.create({ jar }));

async function testSessionBasedLogin() {
    console.log('🍪 Testing session-based login approach...\n');
    
    try {
        // Set realistic headers
        client.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        client.defaults.headers.common['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
        client.defaults.headers.common['Accept-Language'] = 'en-US,en;q=0.5';
        client.defaults.headers.common['Accept-Encoding'] = 'gzip, deflate, br';
        client.defaults.headers.common['Connection'] = 'keep-alive';
        client.defaults.headers.common['Upgrade-Insecure-Requests'] = '1';
        
        console.log('📍 Step 1: Getting login page...');
        const loginPageResponse = await client.get(process.env.LOGIN_URL);
        
        console.log(`   Status: ${loginPageResponse.status}`);
        console.log(`   Content-Type: ${loginPageResponse.headers['content-type']}`);
        
        // Check if we got the login page
        if (loginPageResponse.data.includes('j_username') && loginPageResponse.data.includes('j_password')) {
            console.log('✅ Login form found in response');
        } else {
            console.log('❌ Login form not found - possible blocking');
            console.log('Response preview:', loginPageResponse.data.substring(0, 500));
            return false;
        }
        
        // Extract CSRF token or session info if present
        const csrfMatch = loginPageResponse.data.match(/name="_token"[^>]*value="([^"]+)"/);
        const sessionMatch = loginPageResponse.data.match(/JSESSIONID=([^;]+)/);
        
        if (csrfMatch) {
            console.log('🔒 CSRF token found:', csrfMatch[1].substring(0, 10) + '...');
        }
        if (sessionMatch) {
            console.log('🍪 Session ID found:', sessionMatch[1].substring(0, 10) + '...');
        }
        
        console.log('📝 Step 2: Submitting login credentials...');
        
        // Prepare login data
        const loginData = new URLSearchParams({
            j_username: process.env.USERNAME,
            j_password: process.env.PASSWORD
        });
        
        // Add CSRF token if found
        if (csrfMatch) {
            loginData.append('_token', csrfMatch[1]);
        }
        
        // Submit login
        const loginResponse = await client.post(process.env.LOGIN_URL, loginData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': process.env.LOGIN_URL
            },
            maxRedirects: 0, // Handle redirects manually
            validateStatus: (status) => status < 400 // Accept redirects
        });
        
        console.log(`   Login response status: ${loginResponse.status}`);
        console.log(`   Response headers:`, Object.keys(loginResponse.headers));
        
        // Check for redirect (successful login usually redirects)
        if (loginResponse.status >= 300 && loginResponse.status < 400) {
            const redirectLocation = loginResponse.headers.location;
            console.log('🔄 Redirect detected:', redirectLocation);
            
            if (redirectLocation && !redirectLocation.includes('/login')) {
                console.log('✅ LOGIN SUCCESS - Redirected away from login page');
                
                // Follow the redirect to confirm
                const dashboardResponse = await client.get(redirectLocation);
                console.log(`   Dashboard status: ${dashboardResponse.status}`);
                
                // Save cookies for future use
                const cookies = jar.getCookiesSync(process.env.LOGIN_URL);
                console.log('🍪 Session cookies saved:', cookies.length, 'cookies');
                
                // Save cookies to file for reuse
                const fs = require('fs');
                fs.writeFileSync('session-cookies.json', JSON.stringify(cookies.map(c => c.toJSON())));
                console.log('💾 Cookies saved to session-cookies.json');
                
                return true;
            }
        }
        
        // Check response content for success/error indicators
        const responseText = loginResponse.data;
        
        if (responseText.includes('dashboard') || 
            responseText.includes('welcome') || 
            responseText.includes('logout')) {
            console.log('✅ LOGIN SUCCESS - Success indicators found in response');
            return true;
        }
        
        if (responseText.includes('invalid') || 
            responseText.includes('error') || 
            responseText.includes('incorrect')) {
            console.log('❌ LOGIN FAILED - Error indicators found');
            
            // Extract error message
            const errorMatch = responseText.match(/<div[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)</i);
            if (errorMatch) {
                console.log('❌ Error message:', errorMatch[1].trim());
            }
        }
        
        console.log('❌ LOGIN STATUS UNCLEAR - Manual verification needed');
        return false;
        
    } catch (error) {
        console.error('❌ Session-based login failed:', error.message);
        
        if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
            console.log('💡 Network connectivity issue - pharmacy site may be blocking requests');
        } else if (error.response) {
            console.log(`   HTTP Status: ${error.response.status}`);
            console.log(`   Response: ${error.response.data.substring(0, 200)}...`);
        }
        
        return false;
    }
}

async function loadSavedSession() {
    console.log('🔄 Attempting to load saved session...');
    
    try {
        const fs = require('fs');
        const savedCookies = JSON.parse(fs.readFileSync('session-cookies.json', 'utf8'));
        
        // Restore cookies
        for (const cookieData of savedCookies) {
            const cookie = tough.Cookie.fromJSON(cookieData);
            jar.setCookieSync(cookie, process.env.LOGIN_URL);
        }
        
        console.log(`✅ Loaded ${savedCookies.length} saved cookies`);
        
        // Test if session is still valid
        const testResponse = await client.get(process.env.TARGET_WEBSITE_URL || process.env.LOGIN_URL.replace('/login', ''));
        
        if (testResponse.data.includes('logout') || testResponse.data.includes('dashboard')) {
            console.log('✅ Saved session is still valid!');
            return true;
        } else {
            console.log('❌ Saved session expired');
            return false;
        }
        
    } catch (error) {
        console.log('❌ No valid saved session found');
        return false;
    }
}

// Main execution
async function main() {
    console.log('🏥 Pharmacy Website Login Test\n');
    
    // First try to use saved session
    const sessionValid = await loadSavedSession();
    
    if (!sessionValid) {
        // Try fresh login
        const loginSuccess = await testSessionBasedLogin();
        
        if (loginSuccess) {
            console.log('\n🎉 Login successful! Session saved for future use.');
        } else {
            console.log('\n💊 Login failed. Pharmacy websites often have strict protections.');
            console.log('💡 Try these alternatives:');
            console.log('   1. Manual login in browser, then export cookies');
            console.log('   2. Use browser extension to capture session');
            console.log('   3. Contact pharmacy for API access');
        }
    } else {
        console.log('\n🎉 Using existing valid session!');
    }
}

main().catch(console.error);