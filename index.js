const express = require("express");
const { scrapeGoogleMapsTitlesAndHref } = require("./scraper");
const app = express();

const PORT = process.env.PORT || 4000;

app.get("/", (req, res) => {
  res.send("Render Puppeteer server is up and running!");
});

app.get("/gmurl", async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) {
      return res.status(400).send("Error: input query is required");
    }

    const data = await scrapeGoogleMapsTitlesAndHref(query);
    res.json(data);
  } catch (error) {
    const errorMessage = `Error: ${error.message}`;
    res.status(500).send(errorMessage);
  }
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
