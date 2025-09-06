const axios = require('axios');
const cheerio = require('cheerio');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
require('dotenv').config();

// Create axios instance with cookie support
const jar = new tough.CookieJar();
const client = wrapper(axios.create({ jar }));

async function correctLoginTest() {
    console.log('🎯 Testing correct Oriola4Care login flow...\n');
    
    try {
        // Set realistic headers
        client.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        client.defaults.headers.common['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
        client.defaults.headers.common['Accept-Language'] = 'en-US,en;q=0.5';
        client.defaults.headers.common['Accept-Encoding'] = 'gzip, deflate, br';
        client.defaults.headers.common['Connection'] = 'keep-alive';
        client.defaults.headers.common['Upgrade-Insecure-Requests'] = '1';
        
        console.log('📍 Step 1: Getting login page and CSRF token...');
        const loginPageResponse = await client.get(process.env.LOGIN_URL);
        
        console.log(`   Status: ${loginPageResponse.status}`);
        
        // Parse the HTML to extract CSRF token
        const $ = cheerio.load(loginPageResponse.data);
        const csrfToken = $('input[name="CSRFToken"]').attr('value');
        
        if (!csrfToken) {
            console.log('❌ CSRF token not found');
            return false;
        }
        
        console.log(`🔒 CSRF token extracted: ${csrfToken.substring(0, 10)}...`);
        
        console.log('📝 Step 2: Submitting login to correct endpoint...');
        
        // Prepare login data with CSRF token
        const loginData = new URLSearchParams({
            j_username: process.env.USERNAME,
            j_password: process.env.PASSWORD,
            CSRFToken: csrfToken
        });
        
        console.log(`   Username: ${process.env.USERNAME}`);
        console.log(`   Password: ${'*'.repeat(process.env.PASSWORD.length)}`);
        console.log(`   CSRF Token: ${csrfToken.substring(0, 10)}...`);
        
        // Submit to the correct Spring Security endpoint
        const loginUrl = 'https://oriola4care.oriola-kd.com/j_spring_security_check';
        
        const loginResponse = await client.post(loginUrl, loginData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': process.env.LOGIN_URL
            },
            maxRedirects: 5, // Allow redirects
            validateStatus: (status) => status < 500 // Accept all non-server-error responses
        });
        
        console.log(`   Login response status: ${loginResponse.status}`);
        console.log(`   Final URL: ${loginResponse.request.res.responseUrl || 'No redirect'}`);
        
        const finalUrl = loginResponse.request.res.responseUrl || loginResponse.config.url;
        
        // Check if we were redirected away from login
        if (!finalUrl.includes('/login') && !finalUrl.includes('j_spring_security_check')) {
            console.log('✅ LOGIN SUCCESS - Redirected to:', finalUrl);
            
            // Verify by checking if the response contains logged-in indicators
            const responseText = loginResponse.data;
            const loggedInIndicators = [
                'logout', 'dashboard', 'welcome', 'account', 'profile', 'menu'
            ];
            
            const foundIndicators = loggedInIndicators.filter(indicator => 
                responseText.toLowerCase().includes(indicator)
            );
            
            if (foundIndicators.length > 0) {
                console.log('✅ Logged-in indicators found:', foundIndicators.join(', '));
            }
            
            // Save session cookies
            const cookies = jar.getCookiesSync('https://oriola4care.oriola-kd.com');
            console.log(`🍪 Session cookies: ${cookies.length} cookies saved`);
            
            // Save cookies to file for reuse
            const fs = require('fs');
            const cookieData = cookies.map(c => c.toJSON());
            fs.writeFileSync('oriola-session.json', JSON.stringify(cookieData, null, 2));
            console.log('💾 Session saved to oriola-session.json');
            
            return true;
            
        } else {
            console.log('❌ LOGIN FAILED - Still on login/auth page');
            
            // Check for error messages in the response
            const $ = cheerio.load(loginResponse.data);
            const errorMessages = $('.alert, .error, .message, [class*="error"]');
            
            if (errorMessages.length > 0) {
                console.log('❌ Error messages found:');
                errorMessages.each((i, el) => {
                    const message = $(el).text().trim();
                    if (message) {
                        console.log(`   - ${message}`);
                    }
                });
            } else {
                console.log('❌ No specific error message found');
                console.log('💡 Possible issues:');
                console.log('   - Invalid credentials');
                console.log('   - Account locked/suspended');
                console.log('   - Additional verification required');
                console.log('   - Rate limiting/IP blocking');
            }
            
            return false;
        }
        
    } catch (error) {
        console.error('❌ Login test failed:', error.message);
        
        if (error.response) {
            console.log(`   HTTP Status: ${error.response.status}`);
            console.log(`   Status Text: ${error.response.statusText}`);
            
            if (error.response.status === 403) {
                console.log('💡 403 Forbidden - Possible IP blocking or invalid credentials');
            } else if (error.response.status === 429) {
                console.log('💡 429 Too Many Requests - Rate limiting detected');
            }
        }
        
        return false;
    }
}

async function testSavedSession() {
    console.log('🔄 Testing saved session...');
    
    try {
        const fs = require('fs');
        
        if (!fs.existsSync('oriola-session.json')) {
            console.log('❌ No saved session found');
            return false;
        }
        
        const cookieData = JSON.parse(fs.readFileSync('oriola-session.json', 'utf8'));
        
        // Restore cookies
        for (const cookie of cookieData) {
            const restoredCookie = tough.Cookie.fromJSON(cookie);
            jar.setCookieSync(restoredCookie, 'https://oriola4care.oriola-kd.com');
        }
        
        console.log(`✅ Restored ${cookieData.length} cookies`);
        
        // Test if session is still valid by accessing a protected page
        const testResponse = await client.get('https://oriola4care.oriola-kd.com');
        
        if (testResponse.data.includes('logout') || 
            testResponse.data.includes('dashboard') ||
            !testResponse.data.includes('j_username')) {
            console.log('✅ Saved session is still valid!');
            return true;
        } else {
            console.log('❌ Saved session expired');
            return false;
        }
        
    } catch (error) {
        console.log('❌ Error testing saved session:', error.message);
        return false;
    }
}

// Main execution
async function main() {
    console.log('🏥 Oriola4Care Login Test\n');
    
    // First try saved session
    const sessionValid = await testSavedSession();
    
    if (!sessionValid) {
        console.log('\n🔑 Attempting fresh login...\n');
        const loginSuccess = await correctLoginTest();
        
        if (loginSuccess) {
            console.log('\n🎉 Login successful! You can now use the scraper.');
            console.log('💡 The session has been saved for future use.');
        } else {
            console.log('\n❌ Login failed. Please check:');
            console.log('   1. Username and password in .env file');
            console.log('   2. Account status (not locked/suspended)');
            console.log('   3. Network connectivity');
            console.log('   4. Pharmacy website availability');
        }
    } else {
        console.log('\n🎉 Using existing valid session!');
    }
}

main().catch(console.error);