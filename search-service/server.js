// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');

// const app = express();
// app.use(cors());
// app.use(express.json());

// // Health check
// app.get('/health', (req, res) => res.json({ status: 'search-service running' }));

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log('search-service listening on port', PORT));

require("dotenv").config();
const express = require("express");
const client = require("./client/elasticClient");

const app = express();
app.use(express.json());

const INDEX_NAME = "gigs";

// Health check
app.get("/", (req, res) => res.send("Search service running"));

// Index a gig
app.post("/index", async (req, res) => {
  const gig = req.body; // { id, title, description, category, subcategory, tags }

  try {
    const response = await client.index({
      index: INDEX_NAME,
      id: gig.id,
      document: gig,
    });
    await client.indices.refresh({ index: INDEX_NAME });
    res.status(201).json({ message: "Gig indexed", response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to index gig" });
  }
});

// Search gigs
app.get("/search", async (req, res) => {
  const { q } = req.query; // search query string

  try {
    const result = await client.search({
      index: INDEX_NAME,
      query: {
        multi_match: {
          query: q,
          fields: ["title^3", "description", "category", "subcategory", "tags"],
        },
      },
    });

    const hits = result.hits.hits.map((hit) => hit._source);
    res.status(200).json(hits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

// Optional: Delete a gig from index
app.delete("/delete/:id", async (req, res) => {
  try {
    await client.delete({
      index: INDEX_NAME,
      id: req.params.id,
    });
    res.json({ message: "Gig deleted from index" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Search service running on port ${PORT}`));
