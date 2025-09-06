const ProductScraper = require('./src/scrapers/productScraper');
const config = require('./src/config/config');

async function testScraperLogin() {
    console.log('🧪 Testing ProductScraper with corrected login...\n');
    
    try {
        // Get website config
        const websiteConfig = config.getWebsiteConfig();
        
        console.log('📋 Configuration:');
        console.log(`   Login URL: ${websiteConfig.loginUrl}`);
        console.log(`   Username: ${websiteConfig.username}`);
        console.log(`   Password: ${'*'.repeat(websiteConfig.password.length)}`);
        console.log('');
        
        // Create scraper instance
        const scraper = new ProductScraper(websiteConfig);
        
        console.log('🚀 Testing login...');
        const loginSuccess = await scraper.login();
        
        if (loginSuccess) {
            console.log('✅ Scraper login successful!');
            console.log('💡 Your scraper is now ready to monitor products');
            
            // Test if we can access a protected page (optional)
            console.log('🔍 Testing access to main site...');
            // This would be where you'd test product page access
            
        } else {
            console.log('❌ Scraper login failed');
            console.log('💡 Check your credentials and network connection');
        }
        
        // Clean up
        await scraper.close();
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testScraperLogin();