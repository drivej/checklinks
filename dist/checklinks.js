let job = null;

const blinker = `<div class="spinner-grow spinner-grow-sm text-success" role="status"><span class="visually-hidden">Loading...</span></div>`;

const $form = document.getElementById('checkform');
const $startBtn = document.getElementById('start-btn');
const $stopBtn = document.getElementById('stop-btn');
const $resetBtn = document.getElementById('reset-btn');
const $urlInput = document.querySelector('input[name="siteUrl"]');
// function onSubmit(e) {
//   e.preventDefault();
//   scanUrl(e.target.siteUrl.value);
// }

$urlInput.addEventListener('input', () => {
  if ($urlInput.value !== job?.args?.siteUrl) {
    stopPoll();
    $startBtn.disabled = false;
    $resetBtn.disabled = true;
    $stopBtn.disabled = true;
  } else {
    startPolling();
  }
});

function startJob(url) {
  localStorage.setItem('siteUrl', url);
  fetch(`/checklinks?siteUrl=${encodeURIComponent(url)}`)
    .then((r) => r.json())
    .then((r) => {
      job = r;
      displayResult(r);
      startPolling();
    });
}

function stopJob() {
  fetch(`/job/${job.id}/stop`)
    .then((r) => r.json())
    .then((r) => {
      displayResult(r);
    });
}

$stopBtn.addEventListener('click', stopJob);

function restartJob() {
  fetch(`/job/${job.id}/restart`)
    .then((r) => r.json())
    .then((r) => {
      job = r;
      displayResult(r);
      startPolling();
    });
}

$resetBtn.addEventListener('click', restartJob);

let pollInt;

function startPolling() {
  stopPoll();
  pollInt = setInterval(doPoll, 2000);
}

function doPoll() {
  fetch(`/job/${job.id}`)
    .then((r) => r.json())
    .then((r) => {
      localStorage.setItem('jobData', JSON.stringify(r));
      displayResult(r);
      if (r.status === 'idle') stopPoll();
    });
}

function stopPoll() {
  if (pollInt) clearInterval(pollInt);
}

const $result = document.getElementById('result');

function displayResult(r) {
  if (r?.error) {
    $result.innerHTML = `<div class="alert alert-warning" role="alert">${r?.error}</div>`;
    stopPoll();
    return;
  }
  $startBtn.disabled = true;
  $resetBtn.disabled = true;
  $stopBtn.disabled = true;

  switch (r.status) {
    case 'done':
      $resetBtn.disabled = false;
      break;
    case 'running':
      $stopBtn.disabled = false;
      break;
    default:
      $startBtn.disabled = false;
  }

  $urlInput.placeholder = r.args.siteUrl;

  const cities = Object.keys(r.result?.test ?? {})
    .map((url) => ({ url, ...r.result.test[url] }))
    .sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));

  const htm = cities.map((city) => {
    const cls = city.status === 'running' ? 'text-bg-warning' : city.status === 'done' ? 'text-bg-secondary' : '';
    return `
      <tr>
          <td><a href="${city.url}">${city.url}</a></td>
          <td class="${cls} status_${city.status}">${city.status} ${city.status === 'running' ? blinker : ''}</td>
      </tr>
      ${showErrors(city)}
  `;
  });

  let elapsed = '0:00';
  if (r.started) {
    const endDate = r.status === 'done' ? new Date(Date.parse(r?.completed ?? Date.now())) : new Date();
    const startDate = new Date(Date.parse(r.started));
    const dif = endDate.getTime() - startDate.getTime();
    const s = dif / 1000;
    const ss = ~~(s % 60);
    const mm = ~~(s / 60);
    elapsed = `${mm}:${ss.toFixed(0).padStart(2, '0')}`;
  }

  const cls = r?.status === 'idle' ? 'text-bg-success' : 'text-bg-warning';

  $result.innerHTML = `
  <div class="p-1">Status: <span class="badge ${cls}">${r?.status ?? 'loading...'}</span> | Time Elapsed: ${elapsed}</div>
  <table border="1" class="table table-sm table-bordered table-condensed">
    <tbody>${htm.join('')}</tbody>
  </table>`;
}

function showErrors(city) {
  const errs = city?.result?.redirects?.filter((r) => r.redirected === true) ?? [];
  if (errs.length > 0) {
    return `
    <tr>
      <td colspan="2">
          <table border="1" class="error-table table table-sm table-bordered table-condensed table-warning mb-0">
              <tbody>
                  ${city?.result?.redirects
                    ?.filter((r) => r.redirected === true)
                    .map((r) => {
                      return `
                      <tr>
                          <td><a href="${r.from}">${r.from}</a></td>
                          <td>=></td>
                          <td><a href="${r.to}">${r.to}</a></td>
                      </tr>`;
                    })
                    .join('')}
              </tbody>
          </table>
      </td>
  </tr>`;
  }
  return '';
}

function init() {
  const params = new URLSearchParams(window.location.search);
  let url = '';
  if (params.has('siteUrl')) {
    url = params.get('siteUrl');
    $urlInput.value = params.get('siteUrl');
    //   } else {
    //     url = localStorage.getItem('siteUrl');
    // document.querySelector('input[name="siteUrl"]').value = url;
    // const jobData = localStorage.getItem('jobData');
    // if (jobData) {
    //   job = JSON.parse(jobData);
    //   startPolling();
    //   displayResult(job);
    // }
  }
  startJob(url);
  // $form.addEventListener('submit', onSubmit);
}

init();
