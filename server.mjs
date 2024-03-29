import express from 'express';
import path from 'path';
import { runJob, createJob, getJob, stopJob, resetJob, refreshJob, isRedirected } from './checklinks.mjs';

const app = express();
const PORT = process.env.PORT || 3010;

app.use(express.static('dist'));

app.get('/checklinks', async (req, res) => {
  const job = createJob(req.query);
  runJob(job.id);
  res.json(job);
});

app.get('/job/:id/stop', async (req, res) => {
  res.json(stopJob(req.params.id));
});

app.get('/job/:id/reset', async (req, res) => {
  res.json(resetJob(req.params.id));
});

app.get('/job/:id/refresh', async (req, res) => {
  refreshJob(req.params.id);
  res.json(getJob(req.params.id));
});

app.get('/job/:id', async (req, res) => {
  res.json(getJob(req.params.id));
});

app.get('/checkredirect', async (req, res) => {
  res.json(await isRedirected(req.query.url));
});

app.get('*', (req, res) => {
  res.sendFile(path.resolve('./dist/index.html'));
});

app.listen(PORT, () => {
  console.log('Running on port', PORT);
});
