const puppeteer = require("puppeteer");
require("dotenv").config();

const scrapeGoogleMapsTitlesAndHref = async (query) => {
  let browser = null;
  try {
    // Launch browser with additional configurations
    browser = await puppeteer.launch({
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--single-process",
        "--no-zygote",
        "--disable-dev-shm-usage", // Add this to avoid memory issues
        "--disable-gpu",           // Disable GPU hardware acceleration
        "--disable-extensions",    // Disable extensions to reduce overhead
      ],
      executablePath:
        process.env.NODE_ENV === "production"
          ? process.env.PUPPETEER_EXECUTABLE_PATH
          : puppeteer.executablePath(),
      timeout: 60000, // Increase browser launch timeout
    });

    const page = await browser.newPage();
    
    // Set longer timeouts for navigation and operations
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(60000);

    // Optimize page performance
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Block unnecessary resources
      const blockedResources = ['image', 'stylesheet', 'font', 'media'];
      if (blockedResources.includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    
    // Add retry mechanism for initial navigation
    let retries = 3;
    while (retries > 0) {
      try {
        await page.goto(url, { 
          waitUntil: "networkidle2", // Changed from networkidle0 to networkidle2 for faster load
          timeout: 60000 
        });
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        console.log(`Retrying navigation... ${retries} attempts left`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Wait for the results sidebar with timeout and retry
    const sidebarSelector = `div[aria-label*="Results for ${query}"]`;
    await page.waitForSelector(sidebarSelector, { 
      timeout: 60000,
      visible: true 
    });

    // Modified scrolling logic with better timeout handling
    const startTime = Date.now();
    let previousHeight = 0;
    let consecutiveSameHeight = 0;
    const SCROLL_TIMEOUT = 90000; // 90 seconds total scroll timeout
    
    while (true) {
      if (Date.now() - startTime > SCROLL_TIMEOUT) {
        console.log("Scroll timeout reached after 90 seconds");
        break;
      }

      const sidebar = await page.$(sidebarSelector);
      const currentHeight = await page.evaluate((el) => el.scrollHeight, sidebar);

      if (currentHeight === previousHeight) {
        consecutiveSameHeight++;
        if (consecutiveSameHeight >= 3) { // Reduced from 5 to 3 for faster completion
          console.log("Reached the end of the list");
          break;
        }
      } else {
        consecutiveSameHeight = 0;
      }

      // Smoother scrolling with error handling
      try {
        await page.evaluate(async (selector) => {
          const element = document.querySelector(selector);
          element.scrollBy(0, 300);
          await new Promise((resolve) => setTimeout(resolve, 300));
        }, sidebarSelector);
      } catch (error) {
        console.log("Scroll error, continuing to data extraction:", error.message);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
      previousHeight = currentHeight;
    }

    // Extract data with error handling
    const data = await page.evaluate(() => {
      const elements = document.getElementsByClassName("hfpxzc");
      return Array.from(elements)
        .map((element) => ({
          title: element.getAttribute("aria-label"),
          href: element.getAttribute("href"),
        }))
        .filter((item) => item.title && item.href); // Added href check
    });

    return data;

  } catch (error) {
    const errorMessage = `Error scraping Google Maps data: ${error.message}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  } finally {
    // Ensure browser closes even if there's an error
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error("Error closing browser:", error);
      }
    }
  }
};

module.exports = { scrapeGoogleMapsTitlesAndHref };
