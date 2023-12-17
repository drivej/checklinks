let job = null;

const blinker = `<div class="spinner-grow spinner-grow-sm text-success" role="status"><span class="visually-hidden">Loading...</span></div>`;

const $form = document.getElementById('checkform');
const $startBtn = document.getElementById('start-btn');
const $stopBtn = document.getElementById('stop-btn');
const $resetBtn = document.getElementById('reset-btn');
const $refreshBtn = document.getElementById('refresh-btn');
const $urlInput = document.querySelector('input[name="url"]');
const $result = document.getElementById('result');
let pollInt;

function onChangeInpput() {
  if ($urlInput.value !== job?.args?.url) {
    stopPoll();
    $startBtn.disabled = false;
    $resetBtn.disabled = true;
    $stopBtn.disabled = true;
  } else {
    startPolling();
  }
}

function startJob(url) {
  localStorage.setItem('url', url);
  fetch(`/checklinks?url=${encodeURIComponent(url)}`)
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

function resetJob() {
  fetch(`/job/${job.id}/reset`)
    .then((r) => r.json())
    .then((r) => {
      job = r;
      displayResult(r);
      startPolling();
    });
}

function refreshJob() {
  fetch(`/job/${job.id}/refresh`)
    .then((r) => r.json())
    .then((r) => {
      job = r;
      displayResult(r);
      startPolling();
    });
}

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
      if (r.status !== 'running') stopPoll();
    });
}

function stopPoll() {
  if (pollInt) clearInterval(pollInt);
}

function getElapsedTime(job) {
  let elapsed = '0:00';
  if (job.started) {
    const endDate = job.status === 'done' ? new Date(Date.parse(job?.completed ?? Date.now())) : new Date();
    const startDate = new Date(Date.parse(job.started));
    const dif = endDate.getTime() - startDate.getTime();
    const s = dif / 1000;
    const ss = ~~(s % 60);
    const mm = ~~(s / 60);
    elapsed = `${mm}:${ss.toFixed(0).padStart(2, '0')}`;
  }
  return elapsed;
}

function getJobProgress(job) {
  let progress = 0;
  if (job?.result?.links) {
    const q = Object.keys(job.result.links);
    const a = q.filter((s) => job.result.links[s].status);
    progress = ~~((100 * a.length) / q.length);
  }
  return progress;
}

function displayResult(data) {
  if (data?.error) {
    $result.innerHTML = `<div class="alert alert-warning" role="alert">${data?.error}</div>`;
    stopPoll();
    return;
  }
  $startBtn.disabled = true;
  $resetBtn.disabled = true;
  $stopBtn.disabled = true;
  $refreshBtn.disabled = true;

  switch (data.status) {
    case 'done':
      $resetBtn.disabled = false;
      $refreshBtn.disabled = false;
      break;
    case 'running':
      $stopBtn.disabled = false;
      break;
    default:
      $startBtn.disabled = false;
  }

  $urlInput.placeholder = data.args.url;

  const htm = [];

  const time = getElapsedTime(data);
  const progress = getJobProgress(data);
  const redirects = data?.result?.links ? Object.keys(data.result.links).filter((s) => data.result.links[s].redirected === true) : [];
  const pages = Object.keys(data?.result?.pages ?? {}).length;
  const links = Object.keys(data?.result?.links ?? {}).length;

  htm.push(`
  <h5 class="p-2 d-flex justify-content-between">
    <div>
        ${data.status === 'running' ? blinker : ''} 
        ${data.status} ${progress}% 
    </div>
    <div>
        Elapsed Time: ${time} 
    </div>
    </div>
    <div>
        ${pages} Pages | 
        ${links} Links |
        <span class="badge ${redirects.length > 0 ? 'text-bg-warning' : 'text-bg-success'}">${redirects.length} Redirects</span>
    </div>
  </h5>`);

  if (data?.result?.pages) {
    htm.push('<div class="d-flex flex-column gap-2">');
    Object.keys(data.result.pages)
      .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0))
      .forEach((u) => {
        const links = Object.keys(data.result.pages[u].links);
        const done = links.filter((s) => data.result.links[s].status);
        const redirected = links.filter((s) => data.result.links[s].redirected);

        htm.push(`<div class="border p-2 rounded d-flex flex-column gap-2 ${redirected.length > 0 ? 'text-bg-warning' : 'bg-light'}">`);
        htm.push(`<div class="d-flex justify-content-between w-100"><a href="${u}">${u}</a> <div>${done.length}/${links.length}</div></div>`);

        if (redirected.length) {
          htm.push(`<div class="d-flex justify-content-end"><table class="table table-bordered"><tbody>`);
          Object.keys(data.result.pages[u].links).forEach((s) => {
            if (data.result.links[s]?.redirected === true) {
              htm.push(`
              <tr>
                <td class="text-nowrap" style="width:50%"><a href="${s}">${s}</a></td>
                <td>=></td>
                <td class="text-nowrap" style="width:50%"><a href="${data.result.links[s].to}">${data.result.links[s].to}</a></td>
              </tr>`);
            }
          });
          htm.push(`</tbody></table></div>`);
        }

        htm.push(`</div>`);
      });
    htm.push('</div>');
  }

  $result.innerHTML = htm.join('');
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
  $stopBtn.addEventListener('click', stopJob);
  $resetBtn.addEventListener('click', resetJob);
  $urlInput.addEventListener('input', onChangeInpput);
  $refreshBtn.addEventListener('click', refreshJob);

  const params = new URLSearchParams(window.location.search);
  let url = '';
  if (params.has('url')) {
    url = params.get('url');
    $urlInput.value = params.get('url');
  }
  startJob(url);
}

init();
