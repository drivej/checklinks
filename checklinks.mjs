import axios from 'axios';
import * as cheerio from 'cheerio';
import * as path from 'path';
import crypto from 'crypto';

const jobs = {};

async function collectSiteCities(baseUrl) {
  return axios
    .get(baseUrl)
    .then(async (response) => {
      const html = response.data;
      const $ = cheerio.load(html);
      return $('.maplinkswrapper a[href]')
        .map((index, element) => {
          let url = $(element).attr('href');
          if (path.isAbsolute(url)) {
            const u = new URL(baseUrl);
            u.pathname = path.join(u.pathname, url);
            url = u.href;
          }
          return url;
        })
        .get();
    })
    .catch((error) => {
      console.error('Error fetching the URL:', error);
    });
}

async function checkCityPage(baseUrl, job) {
  // console.log('Check City Page', baseUrl);
  const result = { url: baseUrl, redirects: [] };
  return await axios
    .get(baseUrl)
    .then(async (response) => {
      const html = response.data;
      const $ = cheerio.load(html);
      const urls = $('a[href]:not([href^="tel"]):not([href$=".vcf"])')
        .map((index, element) => {
          let url = $(element).attr('href');
          if (path.isAbsolute(url)) {
            const u = new URL(baseUrl);
            if (url.indexOf('/') === 0) {
              u.pathname = url;
            } else {
              u.pathname = path.join(u.pathname, url);
            }
            url = u.href;
          }
          return url;
        })
        .get();

      let i = urls.length;
      while (i--) {
        result.redirects.push(await isRedirected(urls[i]));
        if (shouldStop(job)) break;
      }
      return result;
    })
    .catch((error) => {
      result.error = 'Error fetching the URL:' + error;
      return result;
    });
}

async function isRedirected(url) {
  //   console.log('isRedirected', url);
  try {
    const response = await axios.head(url, { maxRedirects: 0 });

    // If status is in the range of 3xx, it indicates a redirection
    if (response.status >= 300 && response.status < 400) {
      return { redirected: true, status: response.status, from: url, to: response.headers.location };
    } else {
      return { redirected: false, status: response.status, from: url };
    }
  } catch (error) {
    // get redirect
    let q;
    let toUrl;
    try {
      q = await axios.head(url);
      toUrl = q.request.res.responseUrl;
    } catch (err) {
      toUrl = '';
    }
    // console.log('TEST', q.request.res.responseUrl);

    if (error.response) {
      if (error.response.status > 300 && error.response.status < 400) {
        return { redirected: true, status: error.response.status, from: url, to: toUrl };
      } else {
        return { redirected: false, from: url, to: toUrl };
      }
    } else {
      //   console.error('Error:', error.message);
      // Handle other errors or return a specific value for error cases if needed
      return { redirected: false, from: url, to: toUrl }; // Or handle the error in a different way
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
  if (job.status === 'idle') {
    job.started = new Date().toISOString();
    job.stop = false;
    job.status = 'running';
    return true;
  }
  return false;
}

function endJob(jobId) {
  const job = getJob(jobId);
  job.stop = false;
  job.status = 'idle';
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
  const siteUrl = job.args.siteUrl;

  job.result.test = {};
  const cities = await collectSiteCities(siteUrl);
  cities.push(siteUrl);
  cities.sort().reverse();
  job.result.test = cities.reduce((o, c) => ({ ...o, [c]: { status: 'idle', result: null } }), {});

  if (shouldStop(job)) return job;

  let i = cities.length;
  while (i--) {
    job.result.test[cities[i]] = { status: 'running', result: null };
    const cityResult = await checkCityPage(cities[i], job);
    job.result.test[cities[i]].result = cityResult;
    job.result.test[cities[i]].status = 'done';

    if (shouldStop(job)) break;
  }

  endJob(jobId);
}
