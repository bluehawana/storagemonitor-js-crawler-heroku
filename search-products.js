const axios = require('axios');
const cheerio = require('cheerio');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
require('dotenv').config();

// Create axios instance with cookie support
const jar = new tough.CookieJar();
const client = wrapper(axios.create({ jar }));

async function searchProducts() {
    console.log('🔍 Searching for products on Oriola4Care...\n');
    
    const productCodes = ['7323190179114', '7332551949327'];
    const foundProducts = [];
    
    try {
        // Load saved session
        const fs = require('fs');
        if (fs.existsSync('oriola-session.json')) {
            const cookieData = JSON.parse(fs.readFileSync('oriola-session.json', 'utf8'));
            for (const cookie of cookieData) {
                const restoredCookie = tough.Cookie.fromJSON(cookie);
                jar.setCookieSync(restoredCookie, 'https://oriola4care.oriola-kd.com');
            }
            console.log('✅ Loaded saved session');
        } else {
            console.log('❌ No saved session found - please run login test first');
            return;
        }
        
        // Set realistic headers
        client.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        
        for (const productCode of productCodes) {
            console.log(`🔍 Searching for product: ${productCode}`);
            
            try {
                // Try different search approaches
                const searchUrls = [
                    `https://oriola4care.oriola-kd.com/search?q=${productCode}`,
                    `https://oriola4care.oriola-kd.com/products/search?query=${productCode}`,
                    `https://oriola4care.oriola-kd.com/sok?q=${productCode}`, // Swedish for search
                    `https://oriola4care.oriola-kd.com/product/${productCode}`,
                    `https://oriola4care.oriola-kd.com/artikel/${productCode}` // Swedish for article
                ];
                
                let productFound = false;
                
                for (const searchUrl of searchUrls) {
                    try {
                        console.log(`   Trying: ${searchUrl}`);
                        
                        const response = await client.get(searchUrl, {
                            timeout: 10000,
                            validateStatus: (status) => status < 500
                        });
                        
                        if (response.status === 200) {
                            const $ = cheerio.load(response.data);
                            
                            // Look for product information
                            const productInfo = extractProductInfo($, response.config.url, productCode);
                            
                            if (productInfo) {
                                console.log(`   ✅ Found product!`);
                                console.log(`      Name: ${productInfo.name}`);
                                console.log(`      URL: ${productInfo.url}`);
                                console.log(`      Price: ${productInfo.price}`);
                                console.log(`      Stock: ${productInfo.stock}`);
                                
                                foundProducts.push({
                                    code: productCode,
                                    ...productInfo
                                });
                                
                                productFound = true;
                                break;
                            }
                        }
                        
                        // Add delay between requests
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                    } catch (error) {
                        console.log(`   ❌ ${searchUrl} failed: ${error.message}`);
                        continue;
                    }
                }
                
                if (!productFound) {
                    console.log(`   ❌ Product ${productCode} not found with standard search`);
                    
                    // Try to search through the main site
                    await searchThroughSite(productCode);
                }
                
            } catch (error) {
                console.error(`❌ Error searching for ${productCode}:`, error.message);
            }
            
            console.log(''); // Add spacing between products
        }
        
        // Save found products
        if (foundProducts.length > 0) {
            fs.writeFileSync('found-products.json', JSON.stringify(foundProducts, null, 2));
            console.log(`💾 Saved ${foundProducts.length} products to found-products.json`);
            
            // Update the monitoring configuration
            await updateMonitoringConfig(foundProducts);
        } else {
            console.log('❌ No products found. They might be:');
            console.log('   - Not available on this website');
            console.log('   - Require different search method');
            console.log('   - Behind additional authentication');
        }
        
        return foundProducts;
        
    } catch (error) {
        console.error('❌ Search failed:', error.message);
        return [];
    }
}

function extractProductInfo($, currentUrl, productCode) {
    // Look for various product indicators
    const productSelectors = [
        '.product-title, .product-name, h1',
        '.price, .product-price, .pris',
        '.stock, .stock-status, .availability, .lagerstatus',
        '.product-info, .product-details'
    ];
    
    // Check if this looks like a product page
    const title = $('title').text();
    const h1 = $('h1').first().text();
    
    // Look for the product code in the page
    const pageText = $('body').text();
    const hasProductCode = pageText.includes(productCode);
    
    if (!hasProductCode && !title.includes(productCode)) {
        // This might be a search results page
        const searchResults = $('.product-item, .search-result, .artikel');
        
        if (searchResults.length > 0) {
            console.log(`   Found ${searchResults.length} search results`);
            
            // Look through search results for our product
            for (let i = 0; i < searchResults.length; i++) {
                const result = searchResults.eq(i);
                const resultText = result.text();
                
                if (resultText.includes(productCode)) {
                    const link = result.find('a').first().attr('href');
                    if (link) {
                        const fullUrl = link.startsWith('http') ? link : `https://oriola4care.oriola-kd.com${link}`;
                        console.log(`   Found product link: ${fullUrl}`);
                        return { url: fullUrl, name: 'Product found in search', needsDetailFetch: true };
                    }
                }
            }
        }
        
        return null;
    }
    
    // Extract product information
    const name = h1 || $('.product-title, .product-name').first().text().trim() || 'Unknown Product';
    const price = $('.price, .product-price, .pris').first().text().trim() || 'Price not found';
    const stock = $('.stock, .stock-status, .availability, .lagerstatus').first().text().trim() || 'Stock status unknown';
    
    return {
        name: name,
        url: currentUrl,
        price: price,
        stock: stock,
        productCode: productCode
    };
}

async function searchThroughSite(productCode) {
    console.log(`   🔍 Searching through main site for ${productCode}`);
    
    try {
        // Try to access the main product catalog or search page
        const mainPageResponse = await client.get('https://oriola4care.oriola-kd.com');
        const $ = cheerio.load(mainPageResponse.data);
        
        // Look for search form
        const searchForm = $('form[action*="search"], form[action*="sok"]');
        if (searchForm.length > 0) {
            const searchAction = searchForm.attr('action');
            const searchMethod = searchForm.attr('method') || 'GET';
            
            console.log(`   Found search form: ${searchAction} (${searchMethod})`);
            
            // Try to submit search
            if (searchMethod.toUpperCase() === 'GET') {
                const searchUrl = `https://oriola4care.oriola-kd.com${searchAction}?q=${productCode}`;
                console.log(`   Trying search URL: ${searchUrl}`);
                
                const searchResponse = await client.get(searchUrl);
                if (searchResponse.status === 200) {
                    const $search = cheerio.load(searchResponse.data);
                    const productInfo = extractProductInfo($search, searchUrl, productCode);
                    
                    if (productInfo) {
                        console.log(`   ✅ Found via site search!`);
                        return productInfo;
                    }
                }
            }
        }
        
        // Look for category links or product navigation
        const categoryLinks = $('a[href*="product"], a[href*="artikel"], a[href*="kategori"]');
        console.log(`   Found ${categoryLinks.length} potential category links`);
        
    } catch (error) {
        console.log(`   ❌ Site search failed: ${error.message}`);
    }
    
    return null;
}

async function updateMonitoringConfig(foundProducts) {
    console.log('\n📝 Updating monitoring configuration...');
    
    const config = require('./src/config/config');
    
    // Clear existing products
    const existingProducts = config.getTrackedProducts();
    for (const product of existingProducts) {
        try {
            config.removeProduct(product.id);
        } catch (error) {
            // Product might not exist
        }
    }
    
    // Add found products
    for (const product of foundProducts) {
        const productConfig = {
            name: product.name || `Product ${product.code}`,
            url: product.url,
            stockSelector: '.stock-status, .availability, .in-stock, .lagerstatus',
            maxPrice: 200, // Default max price
            enabled: true,
            orderConditions: {
                autoOrder: true,
                quantity: 1,
                maxDailyOrders: 2,
                keywords: ['in stock', 'available', 'tillgänglig', 'i lager'],
                minStock: 1
            }
        };
        
        try {
            const addedProduct = config.addProduct(productConfig);
            console.log(`✅ Added to monitoring: ${addedProduct.name}`);
        } catch (error) {
            console.error(`❌ Failed to add ${product.name}:`, error.message);
        }
    }
    
    console.log('✅ Monitoring configuration updated');
}

// Run the search
searchProducts().then(products => {
    console.log(`\n🎯 Search complete! Found ${products.length} products.`);
    
    if (products.length > 0) {
        console.log('\n💡 Next steps:');
        console.log('   1. Review found-products.json');
        console.log('   2. Test product monitoring');
        console.log('   3. Start the monitoring service');
    } else {
        console.log('\n💡 Try manual search:');
        console.log('   1. Login to Oriola4Care website manually');
        console.log('   2. Search for the product codes');
        console.log('   3. Copy the product URLs');
        console.log('   4. Update the configuration manually');
    }
}).catch(console.error);