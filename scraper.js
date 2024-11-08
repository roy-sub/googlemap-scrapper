const puppeteer = require("puppeteer");
require("dotenv").config();

const scrapeGoogleMapsTitlesAndHref = async (query) => {
  try {
    const browser = await puppeteer.launch({
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--single-process",
        "--no-zygote",
      ],
      executablePath:
        process.env.NODE_ENV === "production"
          ? process.env.PUPPETEER_EXECUTABLE_PATH
          : puppeteer.executablePath(),
    });

    const page = await browser.newPage();
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: "networkidle0" });

    // Wait for the results sidebar to load
    const sidebarSelector = `div[aria-label*="Results for ${query}"]`;
    await page.waitForSelector(sidebarSelector);

    // Keep scrolling until we reach the end or timeout
    const startTime = Date.now();
    let previousHeight = 0;
    let consecutiveSameHeight = 0;

    while (true) {
      // Get the sidebar and its current height
      const sidebar = await page.$(sidebarSelector);
      const currentHeight = await page.evaluate((el) => el.scrollHeight, sidebar);

      // Break conditions
      if (Date.now() - startTime > 60000) {
        console.log("Timeout reached after 60 seconds");
        break;
      }

      if (currentHeight === previousHeight) {
        consecutiveSameHeight++;
        if (consecutiveSameHeight >= 5) {
          // If height remains the same for 5 iterations
          console.log("Reached the end of the list");
          break;
        }
      } else {
        consecutiveSameHeight = 0;
      }

      // Improved scrolling mechanism
      await page.evaluate(async (selector) => {
        const element = document.querySelector(selector);
        // Scroll down twice with a small delay
        element.scrollBy(0, 400);
        await new Promise((resolve) => setTimeout(resolve, 500));
        element.scrollBy(0, 400);
      }, sidebarSelector);

      // Wait for content to load
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if we've reached "You've reached the end of the list" message
      const endOfListFound = await page.evaluate(() => {
        return document.documentElement.outerHTML.includes(
          "You've reached the end of the list"
        );
      });

      if (endOfListFound) {
        console.log("Found end of list message");
        break;
      }

      previousHeight = currentHeight;
    }

    // Extract data from elements with retry mechanism
    const data = await page.evaluate(() => {
      const elements = document.getElementsByClassName("hfpxzc");
      return Array.from(elements).map((element) => ({
        title: element.getAttribute("aria-label"),
        href: element.getAttribute("href"),
      })).filter((item) => item.title);
    });

    await browser.close();
    return data;
  } catch (error) {
    const errorMessage = `Error scraping Google Maps data: ${error.message}`;
    throw new Error(errorMessage);
  }
};

module.exports = { scrapeGoogleMapsTitlesAndHref };
