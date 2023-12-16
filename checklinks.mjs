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

// const scrapeCache = {};

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
  const log = baseUrl.indexOf('brea') > 0;

  if (!isValidURL(baseUrl)) {
    if (log) console.log('scrapeLocalLinks', 'invalid url', baseUrl);
    return [];
  }
  if (log) console.log('scrapeLocalLinks', baseUrl);

  const parent = new URL(baseUrl);

  // if (scrapeCache[parent.hostname]) {
  //   return scrapeCache[parent.hostname];
  // }
  // scrapeCache[parent.hostname] = [];
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
  // console.log('test 1');

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

  // console.log('test 2');
  links = [...new Set(links)];

  if (log) console.log(links);

  // console.log('test 3');
  // scrapeCache[parent.hostname] = links;

  return links;
  // } catch (err) {
  //   // console.error('scrapeLocalLinks: ', baseUrl);
  //   throw new Error('scrapeLocalLinks: ' + baseUrl);
  //   // return [];
  // }
}

// async function xxxx() {
//   const urls = await scrapeLocalLinks('https://alwaysplumbingcompany.com/brea/');
//   console.log(urls);
//   let i = urls.length;
//   while (i--) {
//     try {
//       // await sleep(100);
//       const test = await isRedirected(urls[i]);
//       // if (test.redirected) {
//       // job.result[pageUrl].links[urls[i]] = test;
//       console.log(urls[i], '=>', test.redirected);
//       // }
//       // if (depth < maxDepth) {
//       //   await sleep(100);
//       //   scrapePage(urls[i], job, maxDepth, depth + 1);
//       // }
//     } catch (err) {
//       console.log('failed', urls[i]);
//     }
//   }
// }

// xxxx();

// async function checkRedirects(urls) {
//   const result = [];
//   let i = urls.length;
//   while (i--) {
//     result.push(await isRedirected(urls[i]));
//   }
//   return result;
// }

// async function scrapeSite(siteUrl, job) {
//   const cache = {};
//   job.result = {};
//   job.result[siteUrl] = {status:'running', url:siteUrl, links:[]};
//   const homeResult = await scrapePage(siteUrl);
//   result[siteUrl].links = homeResult.links;
//   result.push(homeResult);
//   job.result = result;
//   let i = homeResult.links.length;
//   while (i--) {
//     const link = homeResult.links[i];
//     if (!link.redirected) {
//       if (!cache.hasOwnProperty(link.from)) {
//         cache[link.from] = true;
//         result.push(await scrapePage(link.from));
//         job.result = result;
//       } else {
//         // console.log('skipped');
//       }
//       // console.log({ from: link.from });
//     }
//   }
//   return result;
// }

async function scrapePage(pageUrl, job, maxDepth = 0, depth = 0) {
  if (!isValidURL(pageUrl)) {
    console.log('scrapePage()', 'invalid url', pageUrl);
    return;
  }
  // console.log('scrapePage', pageUrl, depth);
  if (job.result.pages.hasOwnProperty(pageUrl)) return;
  job.result.pages[pageUrl] = { links: {} };
  const urls = await scrapeLocalLinks(pageUrl);
  urls.unshift(pageUrl);
  urls.forEach((url) => (job.result.pages[pageUrl].links[url] = url));
  // console.log({ urls });
  let i = urls.length;
  while (i--) {
    await sleep(100);
    // if (job.result.links.hasOwnProperty(urls[i])) continue;

    try {
      if (urls[i].indexOf('brea/back') > 0) {
        console.log(urls[i]);
      }
      const test = await isRedirected(urls[i]);
      if (urls[i].indexOf('brea/back') > 0) {
        console.log(test);
      }

      job.result.links[urls[i]] = test;
      // if (test.redirected) {
      // job.result.pages[pageUrl].links[urls[i]] = test;
      // console.log(urls[i], '=>', job.result[pageUrl].links[urls[i]].redirected);
      // }
      if (depth < maxDepth) {
        await sleep(100);
        scrapePage(urls[i], job, maxDepth, depth + 1);
      }
    } catch (err) {
      console.log('failed', urls[i]);
    }
  }
}

async function scrapeSite(siteUrl, job) {
  // console.log('scrapeSite()', siteUrl);
  // job.status = 'running';
  job.result = { pages: {}, links: {} };

  const urls = await scrapeLocalLinks(siteUrl);
  job.result.pages[siteUrl] = { links: {} };
  urls.forEach((url) => {
    job.result.pages[siteUrl].links[url] = url;
    job.result.links[url] = { redirected: null };
  });

  let i = urls.length;
  while (i--) {
    if (shouldStop(job)) break;
    const pageUrl = urls[i];
    const subpageUrls = await scrapeLocalLinks(pageUrl);
    job.result.pages[pageUrl] = { links: {} };
    subpageUrls.forEach((url) => {
      job.result.pages[pageUrl].links[url] = url;
      job.result.links[url] = { redirected: null };
    });
  }

  const links = Object.keys(job.result.links);
  i = links.length;
  while (i--) {
    if (shouldStop(job)) break;
    // console.log(links[i]);
    job.result.links[links[i]] = await isRedirected(links[i]);
  }

  // job.status = 'idle';
}

// async function XscrapePage(url) {
//   try {
//     const urls = await scrapeLocalLinks(url);
//     const links = await checkRedirects(urls);
//     return { url, links };
//   } catch (err) {
//     return { error: err };
//   }
// }
export async function runTest(testUrl) {
  // const testUrl = 'https://slapshotsairconditioning.com/'; // 'https://alwaysplumbing.kinsta.cloud';

  const myJob = createJob({ testUrl, test: Date.now() });
  return scrapeSite(testUrl, myJob).then(() => {
    console.log('done');
    // console.log(JSON.stringify(myJob, null, 2));
    return myJob;
  });
}

// setInterval(() => {
//   console.log(myJob);
// }, 2000);

async function collectSiteCities(baseUrl) {
  console.log('collectSiteCities', { baseUrl });
  const u = new URL(baseUrl);
  console.log(u.host, u.hostname);

  return axios
    .get(baseUrl)
    .then(async (response) => {
      const html = response.data;
      const $ = cheerio.load(html);
      return $('.maplinkswrapper a[href]')
        .map((index, element) => {
          let url = $(element).attr('href');
          // console.log('isAbsolute', path.isAbsolute(url), url);
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
    console.log({ siteUrl });
    await scrapeSite(siteUrl, job);
  } else {
    console.log('runJob failed', job.args);
  }

  // job.result.test = {};
  // const cities = await collectSiteCities(siteUrl);
  // cities.push(siteUrl);
  // // cities.splice(2); // FOR TESTING
  // cities.sort().reverse();
  // job.result.test = cities.reduce((o, c) => ({ ...o, [c]: { status: 'idle', result: null } }), {});

  // if (shouldStop(job)) return job;

  // let i = cities.length;
  // while (i--) {
  //   job.result.test[cities[i]] = { status: 'running', result: null };
  //   const cityResult = await checkCityPage(cities[i], job);
  //   job.result.test[cities[i]].result = cityResult;
  //   job.result.test[cities[i]].status = 'done';

  //   if (shouldStop(job)) break;
  // }

  endJob(jobId);
}

// export async function runJob(jobId) {
//   console.log('runJob', jobId);
//   if (!startJob(jobId)) return;
//   const job = getJob(jobId);
//   const siteUrl = job.args.siteUrl;

//   job.result.test = {};
//   const cities = await collectSiteCities(siteUrl);
//   cities.push(siteUrl);
//   // cities.splice(2); // FOR TESTING
//   cities.sort().reverse();
//   job.result.test = cities.reduce((o, c) => ({ ...o, [c]: { status: 'idle', result: null } }), {});

//   if (shouldStop(job)) return job;

//   let i = cities.length;
//   while (i--) {
//     job.result.test[cities[i]] = { status: 'running', result: null };
//     const cityResult = await checkCityPage(cities[i], job);
//     job.result.test[cities[i]].result = cityResult;
//     job.result.test[cities[i]].status = 'done';

//     if (shouldStop(job)) break;
//   }

//   endJob(jobId);
// }
