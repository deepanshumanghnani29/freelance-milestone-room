import app from "./app.js";

const PORT = 4001;

app.listen(PORT, () => {
  console.log(`[test-server] Listening on http://localhost:${PORT}`);
});
