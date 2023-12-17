import axios from 'axios';
import * as cheerio from 'cheerio';
import * as path from 'path';
import crypto from 'crypto';

const jobs = {};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDomain(url) {
  return /^http/.test(url);
}

function isTel(url) {
  return /^tel:/.test(url);
}

function isVcf(url) {
  return /.vcf$/.test(url);
}

function isAnchor(url) {
  return /^#/.test(url);
}

function isAllowed(url) {
  return !isTel(url) && !isVcf(url) && !isAnchor(url);
}

function isValidURL(urlString) {
  try {
    new URL(urlString);
    return true;
  } catch (error) {
    return false;
  }
}

async function getPageHTML(url) {
  return await axios.get(url).catch((err) => {
    if (err.response) {
      return { status: err.response.status };
    } else if (err.request) {
      return { status: 500 };
    } else {
      return { status: 500 };
    }
  });
}

async function scrapeLocalLinks(baseUrl) {
  const log = false; //baseUrl.indexOf('brea') > 0;

  if (!isValidURL(baseUrl)) {
    if (log) console.log('scrapeLocalLinks', 'invalid url', baseUrl);
    return [];
  }
  if (log) console.log('scrapeLocalLinks', baseUrl);

  const parent = new URL(baseUrl);

  let response;
  response = await getPageHTML(baseUrl);

  if (response.status !== 200) {
    if (log) console.log('-->', 'load failed 1', response.status, baseUrl);
    await sleep(5000);
    response = await getPageHTML(baseUrl);
  }

  if (response.status !== 200) {
    if (log) console.log('-->', 'load failed 2', response.status, baseUrl);
    await sleep(5000);
    response = await getPageHTML(baseUrl);
  }

  if (response.status !== 200) {
    if (log) console.log('-->', 'load failed 3 - Abort', response.status, baseUrl);
    return [];
  }
  if (log) console.log('-->', 'load success', baseUrl);

  const $ = cheerio.load(response.data);

  // Extract all anchor tags (links)
  let links = [];
  $('a[href]').each((index, element) => {
    const href = $(element).attr('href');
    links.push(href);
  });

  // filter and normalize to absolute urls
  links = links
    .filter(isAllowed)
    .map((url) => {
      let child;
      if (isDomain(url)) {
        child = new URL(url);
      } else {
        child = new URL(baseUrl);
        child.pathname = path.isAbsolute(url) ? url : path.join(child.pathname, url);
      }
      return child;
    })
    .filter((child) => child.hostname === parent.hostname)
    .map((child) => child.href)
    .sort();

  links = [...new Set(links)];
  if (log) console.log(links);
  return links;
}

async function scrapePage(pageUrl, job) {
  const urls = await scrapeLocalLinks(pageUrl);
  job.result.pages[pageUrl] = { links: {} };
  urls.forEach((url) => {
    job.result.pages[pageUrl].links[url] = url;
    job.result.links[url] = { redirected: null };
  });
  return urls;
}

async function scrapeSite(siteUrl, job) {
  job.result = { pages: {}, links: {} };
  const urls = await scrapePage(siteUrl, job);

  let i = urls.length;
  while (i--) {
    if (shouldStop(job)) break;
    const pageUrl = urls[i];
    await scrapePage(pageUrl, job);
    if (Object.keys(job.result.links).length > 2000) break;
  }

  const links = Object.keys(job.result.links);
  i = links.length;
  while (i--) {
    if (shouldStop(job)) break;
    job.result.links[links[i]] = await isRedirected(links[i]);
  }
}

export async function isRedirected(url, retry = true) {
  //   console.log('isRedirected', url);
  try {
    const response = await axios.head(url, { maxRedirects: 0 });
    // console.log('red', response.status);

    // If status is in the range of 3xx, it indicates a redirection
    if (response.status >= 300 && response.status < 400) {
      return { redirected: true, status: response.status, from: url, to: response.headers.location };
    } else {
      return { redirected: false, status: response.status, from: url };
    }
  } catch (error) {
    if (retry && error.status === 429) {
      await sleep(3000);
      console.log(429, url);
      return await isRedirected(url, false);
    }
    const status = error?.response?.status ?? error?.status ?? 0;

    if (status >= 300 && status < 400) {
      return { redirected: true, status, from: url, to: error?.response?.headers?.location ?? '' };
    } else {
      return { redirected: false, status, from: url };
    }
  }
}

export function createJob(args) {
  const jobId = crypto.createHash('sha256').update(JSON.stringify(args)).digest('hex');
  if (!hasJob(jobId)) {
    jobs[jobId] = {
      created: new Date().toISOString(), //
      args,
      status: 'idle',
      id: jobId,
      result: {},
      stop: false
    };
  }
  return getJob(jobId);
}

export function hasJob(jobId) {
  return jobs.hasOwnProperty(jobId);
}

export function getJob(jobId) {
  if (hasJob(jobId)) {
    return jobs[jobId];
  }
  return { error: 'Job not found' };
}

export function stopJob(jobId) {
  const job = getJob(jobId);
  if (job) job.stop = true;
  return job;
}

function startJob(jobId) {
  const job = getJob(jobId);
  if (job.status !== 'running') {
    job.started = new Date().toISOString();
    job.stop = false;
    job.status = 'running';
    return true;
  }
  return false;
}

function endJob(jobId) {
  const job = getJob(jobId);
  job.completed = new Date().toISOString();
  job.stop = false;
  job.status = 'done';
}

export function deleteJob(jobId) {
  if (hasJob(jobId)) {
    delete jobs[jobId];
  }
}

export function resetJob(jobId) {
  const job = getJob(jobId);
  if (job) {
    job.started = null;
    job.completed = null;
    job.result = {};
    job.status = 'idle';
  }
  return job;
}

export async function refreshJob(jobId) {
  const job = getJob(jobId);
  if (startJob(jobId)) {
    job.status = 'running';
    const urls = Object.keys(job.result.links).filter((url) => job.result.links[url].redirected === true);
    urls.forEach((url) => (job.result.links[url] = { redirected: null }));
    let i = urls.length;
    while (i--) {
      if (shouldStop(job)) break;
      const url = urls[i];
      job.result.links[url] = await isRedirected(url);
    }
    endJob(jobId);
  }
}

function shouldStop(job) {
  if (job.stop === true) {
    job.status = 'idle';
    return true;
  }
  return false;
}

export async function runJob(jobId) {
  console.log('runJob', jobId);
  if (!startJob(jobId)) return;
  const job = getJob(jobId);
  const siteUrl = job.args.url;

  if (isValidURL(siteUrl)) {
    await scrapeSite(siteUrl, job);
  } else {
    console.log('runJob failed', job.args);
  }
  endJob(jobId);
}
