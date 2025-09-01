const client = require("../client/elasticClient");

// Index a new gig or update an existing one
exports.indexGig = async (req, res) => {
  const { id, title, description, category, subcategory, tags } = req.body;

  try {
    const response = await client.index({
      index: "gigs",
      id,
      body: { title, description, category, subcategory, tags },
    });

    await client.indices.refresh({ index: "gigs" }); // make searchable immediately
    res.status(201).json({ message: "Gig indexed successfully", response });
  } catch (err) {
    console.error("Error indexing gig:", err);
    res.status(500).json({ error: "Failed to index gig" });
  }
};

// Delete a gig from index
exports.deleteGig = async (req, res) => {
  const { id } = req.params;

  try {
    await client.delete({ index: "gigs", id });
    await client.indices.refresh({ index: "gigs" });
    res.status(200).json({ message: "Gig deleted from index" });
  } catch (err) {
    console.error("Error deleting gig:", err);
    res.status(500).json({ error: "Failed to delete gig" });
  }
};

// Search gigs
exports.searchGigs = async (req, res) => {
  const { q } = req.query;

  if (!q)
    return res.status(400).json({ error: "Query parameter 'q' is required" });

  try {
    const response = await client.search({
      index: "gigs",
      query: {
        multi_match: {
          query: q,
          fields: ["title^3", "description", "category", "subcategory", "tags"],
          fuzziness: "AUTO",
        },
      },
    });

    const hits = response.hits.hits.map((hit) => ({
      id: hit._id,
      ...hit._source,
    }));
    res.status(200).json(hits);
  } catch (err) {
    console.error("Error searching gigs:", err);
    res.status(500).json({ error: "Search failed" });
  }
};
