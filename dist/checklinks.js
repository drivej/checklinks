let job = null;

const blinker = `<div class="spinner-grow spinner-grow-sm text-success" role="status"><span class="visually-hidden">Loading...</span></div>`;

function onSubmit(e) {
  e.preventDefault();
  localStorage.setItem('siteUrl', e.target.siteUrl.value);

  fetch(`/checklinks?siteUrl=${encodeURIComponent(e.target.siteUrl.value)}`)
    .then((r) => r.json())
    .then((r) => {
      job = r;
      displayResult(r);
      $jobData.innerText = JSON.stringify(r, null, 2);
      startPolling();
    });
}

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
      $jobData.innerText = JSON.stringify(r, null, 2);
      displayResult(r);
      if (r.status === 'idle') stopPoll();
    });
}

function stopPoll() {
  if (pollInt) clearInterval(pollInt);
}

const $result = document.getElementById('result');

function displayResult(r) {
  console.log({ r });
  if (r?.error) {
    $result.innerHTML = `<div class="alert alert-warning" role="alert">${r?.error}</div>`;
    stopPoll();
    return;
  }
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
    const startDate = new Date(Date.parse(r.started));
    const dif = Date.now() - startDate.getTime();
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

const $jobData = document.getElementById('job-data');

const $form = document.getElementById('checkform');
$form.addEventListener('submit', onSubmit);

function stopJob() {
  fetch(`/job/${job.id}/stop`)
    .then((r) => r.json())
    .then((r) => {
      $jobData.innerText = JSON.stringify(r, null, 2);
    });
}

const $stopBtn = document.getElementById('stop-btn');
$stopBtn.addEventListener('click', stopJob);

document.querySelector('input[name="siteUrl"]').value = localStorage.getItem('siteUrl');

const jobData = localStorage.getItem('jobData');
if (jobData) {
  job = JSON.parse(jobData);
  console.log({ job });
  startPolling();
  displayResult(job);
}
