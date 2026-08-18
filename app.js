const $ = (selector) => document.querySelector(selector);
const state = $('#state');
const results = $('#results');
const form = $('#referral-form');

function initialsColor(initials) {
  const colors = ['#f0c9b8', '#cadfda', '#dfd3ec', '#f1dfa9'];
  return colors[[...initials].reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length];
}

async function api(path) {
  const response = await fetch(path);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The network request failed.');
  return body;
}

function setState(kind, title, copy) {
  results.hidden = true;
  state.hidden = false;
  state.className = `state ${kind}`;
  state.innerHTML = `<div class="state-graphic">${kind === 'error' ? '!' : '⌁'}</div><h3>${title}</h3><p>${copy}</p>`;
}

function renderLoading() {
  state.hidden = true; results.hidden = false;
  results.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
}

function card(item, index) {
  const names = item.pathNames?.length ? item.pathNames : ['Outside current network', item.name];
  const path = names.map((name, i) => `${i ? '<span class="arrow">→</span>' : ''}<span class="path-node">${name.replace('Dr. ', '')}</span>`).join('');
  return `<article class="card">
    <span class="rank">#${String(index + 1).padStart(2, '0')}</span>
    <div class="doctor"><span class="avatar" style="background:${initialsColor(item.avatar)}">${item.avatar}</span><div><h3>${item.name}</h3><p>${item.title}</p></div><div class="score">${item.score}<small>MATCH</small></div></div>
    <div class="path"><div class="path-label">TRUSTED PATH · ${item.hops === 99 ? 'DISCOVERY' : `${item.hops} HOP${item.hops === 1 ? '' : 'S'}`}</div><div class="path-nodes">${path}</div></div>
    <div class="meta"><span>Availability<b>${item.nextAvailable}</b></span><span>Experience<b>${item.experience} years · ★ ${item.rating}</b></span><span>Facility<b>${item.facility}</b></span><span>Coverage<b>${item.insurance.slice(0,2).join(', ')}</b></span></div>
    <button class="card-action" data-index="${index}">View referral rationale →</button>
  </article>`;
}

let lastResults = [];
function showDetails(item) {
  const rationale = item.hops === 99
    ? `${item.name} is a strong clinical and availability match outside the starting clinician's recorded network.`
    : `A ${item.hops}-hop professional path connects the starting clinician to ${item.name}, adding a transparent trust signal to the clinical fit.`;
  $('#dialog-content').innerHTML = `<div class="eyebrow">EXPLAINABLE RECOMMENDATION</div><h2 class="detail-title">${item.name}</h2><p>${item.title} at ${item.facility}, ${item.city}.</p><div class="detail-path"><b>Why this match</b><p>${rationale}</p><ol>${(item.pathNames || []).map((name, i) => `<li>${name}${item.pathTypes?.[i] ? ` — ${item.pathTypes[i].toLowerCase().replaceAll('_', ' ')}` : ''}</li>`).join('')}</ol></div><button class="primary" onclick="document.querySelector('#details').close()">Done</button>`;
  $('#details').showModal();
}

async function bootstrap() {
  try {
    const [clinicians, specialties] = await Promise.all([api('/api/clinicians'), api('/api/specialties')]);
    $('#source').innerHTML = clinicians.map((c) => `<option value="${c.id}" ${c.id === 'c1' ? 'selected' : ''}>${c.name}</option>`).join('');
    $('#specialty').innerHTML = specialties.map((s) => `<option value="${s.slug}" ${s.slug === 'cardiology' ? 'selected' : ''}>${s.name} · ${s.clinicianCount}</option>`).join('');
  } catch (error) {
    $('#source').innerHTML = '<option>Unavailable</option>';
    $('#specialty').innerHTML = '<option>Unavailable</option>';
    setState('error', 'The referral network is offline', 'Add valid CognoDB settings, seed the graph, and refresh this page.');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button'); button.disabled = true; renderLoading();
  const params = new URLSearchParams(new FormData(form));
  try {
    lastResults = await api(`/api/recommendations?${params}`);
    if (!lastResults.length) return setState('', 'No matches in this network', 'Try another specialty or remove the insurance filter.');
    $('#result-copy').textContent = `${lastResults.length} matches ranked by relationship strength, fit, and availability`;
    results.innerHTML = lastResults.map(card).join('');
  } catch (error) { setState('error', 'We could not search the network', error.message); }
  finally { button.disabled = false; }
});

results.addEventListener('click', (event) => { const button = event.target.closest('[data-index]'); if (button) showDetails(lastResults[button.dataset.index]); });
$('.close').addEventListener('click', () => $('#details').close());
$('.menu').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
bootstrap();
