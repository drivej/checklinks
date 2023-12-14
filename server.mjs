import express from 'express';
import path from 'path';
// import { runJob, createJob, getJob, stopJob } from './checklinks.mjs';

const app = express();
const PORT = process.env.PORT || 3010;

app.use(express.static('dist'));

// app.get('/checklinks', async (req, res) => {
//   const job = createJob(req.query);
//   runJob(job.id);
//   res.json(job);
// });

// app.get('/job/:id/stop', async (req, res) => {
//   res.json(stopJob(req.params.id));
// });

// app.get('/job/:id', async (req, res) => {
//   res.json(getJob(req.params.id));
// });

app.get('*', (req, res) => {
  res.sendFile(path.resolve('./dist/index.html'));
});

app.listen(PORT, () => {
  console.log('Running on port', PORT);
});
