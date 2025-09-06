require('dotenv').config();
const ProductScraper = require('./src/scrapers/productScraper');
const config = require('./src/config/config');

async function testLogin() {
    console.log('🔍 Testing login functionality...\n');
    
    // Check if required environment variables are set
    const requiredVars = ['LOGIN_URL', 'USERNAME', 'PASSWORD'];
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(varName => console.error(`   - ${varName}`));
        console.log('\nPlease update your .env file with these values.');
        return;
    }
    
    console.log('✅ Environment variables configured');
    console.log(`   - Login URL: ${process.env.LOGIN_URL}`);
    console.log(`   - Username: ${process.env.USERNAME}`);
    console.log(`   - Password: ${'*'.repeat(process.env.PASSWORD.length)}\n`);
    
    const websiteConfig = config.getWebsiteConfig();
    const scraper = new ProductScraper(websiteConfig);
    
    try {
        console.log('🚀 Initializing browser...');
        const initialized = await scraper.initialize();
        
        if (!initialized) {
            console.error('❌ Failed to initialize browser');
            return;
        }
        
        console.log('✅ Browser initialized successfully');
        console.log('\n🔐 Attempting login...');
        
        const loginSuccess = await scraper.login();
        
        if (loginSuccess) {
            console.log('✅ Login successful!');
            console.log('🎉 The automation system should work with this website.');
        } else {
            console.log('❌ Login failed!');
            console.log('💡 Possible issues:');
            console.log('   - Incorrect username/password');
            console.log('   - Wrong CSS selectors for login form');
            console.log('   - Website has captcha or additional security');
            console.log('   - Website blocks automated browsers');
        }
        
    } catch (error) {
        console.error('❌ Error during login test:', error.message);
        console.log('\n💡 Debug information:');
        console.log('   - Make sure the website URL is correct');
        console.log('   - Check if CSS selectors match the website structure');
        console.log('   - Some websites may require different selectors');
    } finally {
        console.log('\n🧹 Cleaning up...');
        await scraper.close();
        console.log('✅ Test completed');
    }
}

// Run the test
testLogin().catch(console.error);