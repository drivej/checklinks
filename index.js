const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

// const siteUrl = 'https://calleconomydrainclean.com'; // Replace with your URL

async function collectSiteCities(baseUrl) {
  return axios
    .get(baseUrl)
    .then(async (response) => {
      const html = response.data;
      const $ = cheerio.load(html);

      // Now you can use Cheerio to parse and manipulate the HTML
      // For example, find elements using selectors:
      const urls = $('.maplinkswrapper a[href]')
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
      //   console.log(urls);
      return urls;
    })
    .catch((error) => {
      console.error('Error fetching the URL:', error);
    });
}

async function checkCityPage(baseUrl) {
  //   console.log('Check City Page', baseUrl);
  await axios
    .get(baseUrl)
    .then(async (response) => {
      const html = response.data;
      const $ = cheerio.load(html);

      // Now you can use Cheerio to parse and manipulate the HTML
      // For example, find elements using selectors:
      const urls = $('a[href]:not([href^="tel"]):not([href$=".vcf"])')
        .map((index, element) => {
          let url = $(element).attr('href');
          if (path.isAbsolute(url)) {
            const u = new URL(baseUrl);
            if (url.indexOf('/') === 0) {
              u.pathname = url; //path.join(u.pathname, url);
            } else {
              u.pathname = path.join(u.pathname, url);
              console.log('found relative path', url);
            }
            url = u.href;
          }
          return url;
        })
        .get();

      /* START: method fast */
      //   const results = await Promise.all(urls.map(isRedirected));
      //   const errs = results.filter((r, i) => r.redirected);
      //   if (errs.length) {
      //     console.log(baseUrl);
      //     console.table(errs, ['from', 'to']);
      //   } else {
      //     console.log(baseUrl, '--> No errors found.');
      //   }
      /* END: method fast */

      /* START: method slow */
      const found = [];
      let i = urls.length;
      while (i--) {
        // console.log('test', urls[i]);
        const isRe = await isRedirected(urls[i]);
        if (isRe.redirected) {
          found.push(isRe);
          // console.log(i,isRe);
        }
      }
      if (found.length) {
        console.table(found, ['from', 'to']);
      } else {
        console.log(baseUrl, '--> No errors found.');
      }
      /* END: method slow */
    })
    .catch((error) => {
      console.error('Error fetching the URL:', error);
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

async function runJob(siteUrl) {
  //   console.log('Scanning', siteUrl);
  const cities = await collectSiteCities(siteUrl);
  console.log(`Found ${cities.length} cities.`);
  await checkCityPage(siteUrl);
  try {
    let i = cities.length;
    // await Promise.all(cities.map((c) => checkCityPage(c)));
    while (i--) {
      //   console.log(i, ':', 'Check City Page', cities[i]);
      await checkCityPage(cities[i]);
    }
  } catch (err) {}
  console.log('done');
}

// isRedirected('https://alwaysplumbing.kinsta.cloud/about-us/').then(r => console.log(r));
runJob(process.argv[2]);
