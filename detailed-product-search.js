const axios = require('axios');
const cheerio = require('cheerio');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
require('dotenv').config();

// Create axios instance with cookie support
const jar = new tough.CookieJar();
const client = wrapper(axios.create({ jar }));

async function detailedProductSearch() {
    console.log('🔍 Detailed product search on Oriola4Care...\n');
    
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
        }
        
        // Set realistic headers
        client.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        
        for (const productCode of productCodes) {
            console.log(`🔍 Searching for product: ${productCode}`);
            
            try {
                // Get search results page
                const searchUrl = `https://oriola4care.oriola-kd.com/search?q=${productCode}`;
                const searchResponse = await client.get(searchUrl);
                
                if (searchResponse.status === 200) {
                    const $ = cheerio.load(searchResponse.data);
                    
                    console.log(`   📄 Search page loaded, analyzing results...`);
                    
                    // Look for product links in search results
                    const productLinks = [];
                    
                    // Common selectors for product links
                    const linkSelectors = [
                        'a[href*="/product/"]',
                        'a[href*="/artikel/"]', 
                        'a[href*="/item/"]',
                        '.product-link a',
                        '.search-result a',
                        '.product-item a',
                        '.artikel a'
                    ];
                    
                    for (const selector of linkSelectors) {
                        $(selector).each((i, element) => {
                            const href = $(element).attr('href');
                            const text = $(element).text().trim();
                            
                            if (href && (text.includes(productCode) || href.includes(productCode))) {
                                const fullUrl = href.startsWith('http') ? href : `https://oriola4care.oriola-kd.com${href}`;
                                productLinks.push({
                                    url: fullUrl,
                                    text: text,
                                    selector: selector
                                });
                            }
                        });
                    }
                    
                    console.log(`   Found ${productLinks.length} potential product links`);
                    
                    // If no direct links found, look for any links that might lead to products
                    if (productLinks.length === 0) {
                        console.log('   🔍 Looking for indirect product references...');
                        
                        // Look for any text containing the product code
                        const pageText = $.text();
                        if (pageText.includes(productCode)) {
                            console.log('   ✅ Product code found on page');
                            
                            // Look for any clickable elements near the product code
                            $('*').each((i, element) => {
                                const elementText = $(element).text();
                                if (elementText.includes(productCode)) {
                                    const nearbyLinks = $(element).find('a').add($(element).closest('a'));
                                    nearbyLinks.each((j, link) => {
                                        const href = $(link).attr('href');
                                        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                                            const fullUrl = href.startsWith('http') ? href : `https://oriola4care.oriola-kd.com${href}`;
                                            productLinks.push({
                                                url: fullUrl,
                                                text: $(link).text().trim(),
                                                context: 'near product code'
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    }
                    
                    // Try to fetch detailed info for each potential product link
                    for (const link of productLinks.slice(0, 3)) { // Limit to first 3 to avoid too many requests
                        console.log(`   🔗 Checking: ${link.url}`);
                        
                        try {
                            const productResponse = await client.get(link.url, { timeout: 10000 });
                            
                            if (productResponse.status === 200) {
                                const $product = cheerio.load(productResponse.data);
                                
                                // Extract detailed product information
                                const productInfo = extractDetailedProductInfo($product, link.url, productCode);
                                
                                if (productInfo && productInfo.isValidProduct) {
                                    console.log(`   ✅ Valid product found!`);
                                    console.log(`      Name: ${productInfo.name}`);
                                    console.log(`      Price: ${productInfo.price}`);
                                    console.log(`      Stock: ${productInfo.stock}`);
                                    console.log(`      Description: ${productInfo.description?.substring(0, 100)}...`);
                                    
                                    foundProducts.push({
                                        code: productCode,
                                        ...productInfo
                                    });
                                    
                                    break; // Found the product, move to next code
                                }
                            }
                            
                            // Add delay between requests
                            await new Promise(resolve => setTimeout(resolve, 1500));
                            
                        } catch (error) {
                            console.log(`   ❌ Failed to fetch ${link.url}: ${error.message}`);
                        }
                    }
                    
                    // If still no product found, save the search page info
                    if (!foundProducts.find(p => p.code === productCode)) {
                        console.log(`   ⚠️  No direct product page found, saving search results`);
                        
                        const searchInfo = {
                            code: productCode,
                            name: `Search results for ${productCode}`,
                            url: searchUrl,
                            price: extractPriceFromSearch($),
                            stock: 'Unknown - requires manual verification',
                            isSearchResult: true,
                            potentialLinks: productLinks.map(l => l.url)
                        };
                        
                        foundProducts.push(searchInfo);
                    }
                }
                
            } catch (error) {
                console.error(`❌ Error searching for ${productCode}:`, error.message);
            }
            
            console.log(''); // Add spacing
        }
        
        // Save results
        if (foundProducts.length > 0) {
            const fs = require('fs');
            fs.writeFileSync('detailed-products.json', JSON.stringify(foundProducts, null, 2));
            console.log(`💾 Saved ${foundProducts.length} products to detailed-products.json`);
            
            // Show summary
            console.log('\n📋 Product Summary:');
            foundProducts.forEach((product, index) => {
                console.log(`${index + 1}. ${product.name}`);
                console.log(`   Code: ${product.code}`);
                console.log(`   URL: ${product.url}`);
                console.log(`   Price: ${product.price}`);
                console.log(`   Type: ${product.isSearchResult ? 'Search Result' : 'Product Page'}`);
                console.log('');
            });
        }
        
        return foundProducts;
        
    } catch (error) {
        console.error('❌ Detailed search failed:', error.message);
        return [];
    }
}

function extractDetailedProductInfo($, currentUrl, productCode) {
    // Check if this is actually a product page
    const title = $('title').text().toLowerCase();
    const h1 = $('h1').first().text();
    const pageText = $.text();
    
    // Look for product-specific indicators
    const hasProductCode = pageText.includes(productCode);
    const hasProductStructure = $('.product-info, .product-details, .product-title, .artikel-info').length > 0;
    const hasAddToCart = $('.add-to-cart, .lägg-i-varukorg, button[type="submit"]').length > 0;
    
    if (!hasProductCode && !hasProductStructure) {
        return null;
    }
    
    // Extract product information
    const name = h1 || 
                 $('.product-title, .product-name, .artikel-titel').first().text().trim() || 
                 $('h2').first().text().trim() || 
                 'Unknown Product';
    
    const price = $('.price, .product-price, .pris, .cost').first().text().trim() || 
                  $('[class*="price"]').first().text().trim() || 
                  'Price not found';
    
    const stock = $('.stock, .stock-status, .availability, .lagerstatus, .tillgänglighet').first().text().trim() || 
                  $('[class*="stock"]').first().text().trim() || 
                  'Stock status unknown';
    
    const description = $('.product-description, .beskrivning, .product-info p').first().text().trim() || 
                       $('.description').first().text().trim() || 
                       '';
    
    // Determine if this looks like a valid product page
    const isValidProduct = hasProductCode && 
                          name && 
                          name !== 'Unknown Product' && 
                          !name.includes('Du sökte på') && // Not a search result page
                          (hasProductStructure || hasAddToCart);
    
    return {
        name: name,
        url: currentUrl,
        price: price,
        stock: stock,
        description: description,
        productCode: productCode,
        isValidProduct: isValidProduct,
        hasAddToCart: hasAddToCart
    };
}

function extractPriceFromSearch($) {
    // Look for price information in search results
    const priceSelectors = [
        '.price', '.pris', '.cost', '[class*="price"]', '[class*="pris"]'
    ];
    
    for (const selector of priceSelectors) {
        const priceElement = $(selector).first();
        if (priceElement.length > 0) {
            const priceText = priceElement.text().trim();
            if (priceText && (priceText.includes('SEK') || priceText.includes('kr') || /\d+[,.]?\d*/.test(priceText))) {
                return priceText;
            }
        }
    }
    
    return 'Price not found';
}

// Run the detailed search
detailedProductSearch().then(products => {
    console.log(`\n🎯 Detailed search complete! Found ${products.length} products.`);
    
    if (products.length > 0) {
        const validProducts = products.filter(p => !p.isSearchResult);
        const searchResults = products.filter(p => p.isSearchResult);
        
        console.log(`   - ${validProducts.length} direct product pages`);
        console.log(`   - ${searchResults.length} search result pages`);
        
        if (validProducts.length > 0) {
            console.log('\n✅ Ready to set up monitoring for direct product pages');
        }
        
        if (searchResults.length > 0) {
            console.log('\n⚠️  Some products need manual URL verification');
            console.log('💡 Check detailed-products.json for potential product links');
        }
    }
}).catch(console.error);