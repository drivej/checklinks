const $result = document.getElementById('result');
const $pre = document.getElementById('data');

function init() {
  const params = new URLSearchParams(window.location.search);
  fetch(`/test?url=${encodeURIComponent(params.get('url'))}`)
    .then((r) => r.json())
    .then(setJob);
}

function buildLink(url) {
  return `<a href="${url}" target="_blank">${url}</a><a href="/checkredirect?url=${encodeURIComponent(url)}" target="_blank">&check;</a>`;
}

function anchorize(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '');
}

function setJob(data) {
  $pre.innerText = JSON.stringify(data.result.links, null, 2);
  const htm = [];

  Object.keys(data.result.pages)
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0))
    .forEach((u) => {
      htm.push(`<div><a href="#${anchorize(u)}">${u}</a></div>`);
    });

  Object.keys(data.result.pages)
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0))
    .forEach((u) => {
      htm.push(`<div class="p-3 border">`);
      htm.push(`<a id="${anchorize(u)}">${u}</a>`);
      Object.keys(data.result.pages[u].links).forEach((s) => {
        htm.push(`<div><a href="${s}">${s}</a> ${data.result.links[s]?.redirected} ${data.result.links[s]?.error ?? ''}</div>`);
      });
      htm.push(`</div>`);
    });
  /*
  const htm = [];
  htm.push(`<table class="table table-bordered table-sm"><tbody>`);
  Object.keys(data.result).forEach((pageUrl) => {
    htm.push(`<tr><td colspan="4">`);
    htm.push(buildLink(pageUrl));
    htm.push(`</td></tr>`);

    Object.keys(data.result[pageUrl].links)
      //   .filter((link) => data.result[pageUrl].links[link].redirected)
      .forEach((link) => {
        htm.push('<tr>');
        htm.push('<td width="100%">----------></td>');
        htm.push('<td>');
        htm.push(buildLink(data.result[pageUrl].links[link].from));
        // htm.push(`<a href="${data.result[pageUrl].links[link].from}" target="_blank">${data.result[pageUrl].links[link].from}</a>`);
        htm.push('</td>');
        htm.push('<td>');
        // htm.push(`<a href="${data.result[pageUrl].links[link].to}" target="_blank">${data.result[pageUrl].links[link].to}</a>`);
        htm.push(buildLink(data.result[pageUrl].links[link]?.to ?? '-'));
        htm.push('</td>');
        htm.push(`<td>${data.result[pageUrl].links[link].redirected}</td>`);
        htm.push('</tr>');
      });
  });
  htm.push(`</tbody></table>`);
  */

  $result.innerHTML = htm.join('');
}

init();
