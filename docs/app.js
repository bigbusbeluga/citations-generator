/* ══════════════════════════════════════════════════════════════════
   Citation Generator PWA — app.js
   Browser version: localStorage, jsPDF, allorigins CORS proxy
   ══════════════════════════════════════════════════════════════════ */

'use strict';

// ── Register Service Worker ──────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ── App State ────────────────────────────────────────────────────
const STORAGE_KEY = 'citation-pro-data';

let appData = loadData();
let currentFolderId = appData.folders[0]?.id || 'default';
let currentCitation = null;
let attachedFilePath = null;
let authorCount = 0;

// ── Data helpers ─────────────────────────────────────────────────
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.folders) return parsed;
    }
  } catch (e) {}
  return {
    folders: [{ id: 'default', name: 'My Citations', citations: [] }]
  };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// ── DOM refs ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  addAuthorEntry();
  setupEventListeners();
  setupDesktopLayout();
  renderFolders();
  selectFolder(currentFolderId);
  $('accessDateInput').valueAsDate = new Date();
});

// ── Desktop: show form + citations together ──────────────────────
function setupDesktopLayout() {
  if (window.innerWidth >= 768) {
    // Wrap main content panels in a desktop grid
    const main = document.querySelector('.main-content');
    const grid = document.createElement('div');
    grid.className = 'desktop-grid';
    const formPanel = $('panelForm');
    const citPanel  = $('panelCitations');
    main.insertBefore(grid, formPanel);
    grid.appendChild(formPanel);
    grid.appendChild(citPanel);
    formPanel.classList.remove('hidden');
    citPanel.classList.remove('hidden');

    // Keep folders panel outside grid
    $('panelFolders').classList.add('hidden');
  }
}

// ── Event Listeners ──────────────────────────────────────────────
function setupEventListeners() {
  // ── Source type
  $('sourceType').addEventListener('change', handleSourceTypeChange);

  // ── Authors
  $('addAuthorBtn').addEventListener('click', () => addAuthorEntry());

  // ── Lookup
  $('lookupBtn').addEventListener('click', lookupIdentifier);
  $('doiInput').addEventListener('paste', () => setTimeout(lookupIdentifier, 250));

  // ── Citation actions
  $('generateBtn').addEventListener('click', generateCitation);
  $('clearFormBtn').addEventListener('click', clearForm);
  $('copyBtn').addEventListener('click', copyToClipboard);
  $('addToListBtn').addEventListener('click', addToList);

  // ── Exports
  $('exportPdfBtn').addEventListener('click', exportToPdf);
  $('exportDocBtn').addEventListener('click', exportToDoc);
  $('exportBibtexBtn').addEventListener('click', exportToBibtex);

  // ── Butter panel
  $('openButterBtn').addEventListener('click', openButter);
  $('sidebarButterBtn').addEventListener('click', openButter);
  $('closeButterPanel').addEventListener('click', closeButter);
  $('butterOverlay').addEventListener('click', closeButter);
  $('sendButterBtn').addEventListener('click', sendButterMessage);
  $('butterInput').addEventListener('keypress', e => { if (e.key === 'Enter') sendButterMessage(); });

  // ── Quick actions
  document.querySelectorAll('.quick-action').forEach(btn => {
    btn.addEventListener('click', () => {
      $('butterInput').value = btn.dataset.prompt;
      sendButterMessage();
    });
  });

  // ── Preview tabs
  document.querySelectorAll('.preview-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => switchPreviewTab(tab.dataset.tab));
  });

  // ── Folder modal
  $('addFolderBtn').addEventListener('click', () => showFolderModal());
  $('addFolderBtnMobile').addEventListener('click', () => showFolderModal());
  $('saveFolderBtn').addEventListener('click', saveFolder);
  $('cancelFolderBtn').addEventListener('click', closeFolderModal);

  // ── Citation modal
  $('closeCitationModal').addEventListener('click', closeCitationModal);
  $('closeCitationModalBtn').addEventListener('click', closeCitationModal);

  // ── Search
  $('searchCitations').addEventListener('input', () => renderCitations($('searchCitations').value.toLowerCase().trim()));

  // ── Bottom nav
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.target));
  });
}

// ── Tab switching (mobile) ───────────────────────────────────────
function switchTab(target) {
  if (window.innerWidth >= 768) return;
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  $(`panel${target.charAt(0).toUpperCase() + target.slice(1)}`).classList.remove('hidden');
  document.querySelector(`.nav-tab[data-target="${target}"]`).classList.add('active');
  if (target === 'folders') renderFoldersFull();
}

// ── Source type ──────────────────────────────────────────────────
function handleSourceTypeChange() {
  document.querySelectorAll('.source-fields').forEach(f => f.classList.add('hidden'));
  const type = $('sourceType').value;
  $(`${type}Fields`)?.classList.remove('hidden');
}

// ── Author management ────────────────────────────────────────────
function addAuthorEntry(lastName = '', firstName = '', mi = '') {
  const id = `author-${++authorCount}`;
  const div = document.createElement('div');
  div.className = 'author-entry';
  div.dataset.id = id;
  div.innerHTML = `
    <div class="form-group">
      <label>Surname</label>
      <input type="text" class="author-surname" placeholder="Smith" value="${esc(lastName)}">
    </div>
    <div class="form-group">
      <label>First Name</label>
      <input type="text" class="author-firstname" placeholder="John" value="${esc(firstName)}">
    </div>
    <div class="form-group">
      <label>M.I.</label>
      <input type="text" class="author-mi" placeholder="A." maxlength="3" value="${esc(mi)}">
    </div>
    <button type="button" class="btn-remove-author" onclick="removeAuthorEntry('${id}')" title="Remove">✕</button>
  `;
  $('authorsContainer').appendChild(div);
}

window.removeAuthorEntry = function(id) {
  const all = $('authorsContainer').querySelectorAll('.author-entry');
  if (all.length <= 1) { showToast('Need at least one author'); return; }
  $('authorsContainer').querySelector(`[data-id="${id}"]`)?.remove();
};

function getAuthors() {
  return [...$('authorsContainer').querySelectorAll('.author-entry')].map(e => ({
    lastName: e.querySelector('.author-surname').value.trim(),
    firstName: e.querySelector('.author-firstname').value.trim(),
    middleInitial: e.querySelector('.author-mi').value.trim()
  })).filter(a => a.lastName || a.firstName);
}

// ── Auto-fill Lookup ─────────────────────────────────────────────
function isDOI(v) { return /^10\.\d{4,}\//.test(v) || v.includes('doi.org/'); }
function isISBN(v) { const c = v.replace(/[-\s]/g, ''); return /^(978|979)\d{10}$/.test(c) || /^\d{9}[\dX]$/.test(c); }
function isURL(v) { return /^https?:\/\//.test(v); }
function extractDOI(v) { const m = v.match(/10\.\d{4,}\/[^\s]+/); return m ? m[0].replace(/[.,;)>"']$/, '') : v; }

async function lookupIdentifier() {
  const value = $('doiInput').value.trim();
  if (!value) { showToast('Paste a DOI, URL, or ISBN first'); return; }

  $('lookupBtnText').textContent = 'Looking up…';
  $('lookupBtn').disabled = true;

  try {
    let data = null;
    if (isDOI(value))       data = await fetchFromCrossRef(extractDOI(value));
    else if (isISBN(value)) data = await fetchFromOpenLibrary(value.replace(/[-\s]/g, ''));
    else if (isURL(value))  data = await fetchWebMeta(value);
    else { showToast('Paste a full DOI, URL, or ISBN'); return; }

    if (data) { fillForm(data); showToast('Fields filled from lookup!'); }
    else        showToast('No metadata found for this identifier');
  } catch (err) {
    console.error(err);
    showToast('Lookup failed — check your internet connection');
  } finally {
    $('lookupBtnText').textContent = 'Lookup';
    $('lookupBtn').disabled = false;
  }
}

async function fetchFromCrossRef(doi) {
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  if (!res.ok) return null;
  const json = await res.json();
  const msg = json.message;
  const type = msg.type || '';
  let sourceType = 'journal';
  if (type === 'book' || type === 'monograph') sourceType = 'book';
  else if (type === 'proceedings-article') sourceType = 'conference';

  const authors = (msg.author || []).map(a => ({ lastName: a.family || '', firstName: a.given || '', middleInitial: '' }));
  const dp = (msg.published || msg['published-print'] || msg['published-online'] || {})['date-parts']?.[0] || [];
  return {
    sourceType, authors,
    title: (msg.title || [])[0] || '',
    year: dp[0]?.toString() || '',
    doi: `https://doi.org/${msg.DOI}`,
    journalName: (msg['container-title'] || [])[0] || '',
    volume: msg.volume || '', issue: msg.issue || '', pages: msg.page || '',
    publisher: msg.publisher || '',
    conferenceName: (msg['container-title'] || [])[0] || '',
    location: ''
  };
}

async function fetchFromOpenLibrary(isbn) {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) return null;
  const outer = await res.json();
  const data = JSON.parse(outer.contents || '{}');
  const bookData = data[`ISBN:${isbn}`];
  if (!bookData) return null;
  const authors = (bookData.authors || []).map(a => {
    const parts = (a.name || '').trim().split(/\s+/);
    return { lastName: parts[parts.length - 1] || '', firstName: parts[0] || '', middleInitial: parts.length > 2 ? parts.slice(1, -1).join(' ') : '' };
  });
  return {
    sourceType: 'book', authors,
    title: bookData.title || '',
    year: (bookData.publish_date || '').match(/\d{4}/)?.[0] || '',
    publisher: (bookData.publishers || [])[0]?.name || '',
    edition: '', doi: ''
  };
}

async function fetchWebMeta(url) {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) return null;
  const outer = await res.json();
  const html = outer.contents || '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const getMeta = (selectors) => {
    for (const s of selectors) {
      const el = doc.querySelector(s);
      if (el) return el.getAttribute('content') || el.textContent || '';
    }
    return '';
  };

  const title = getMeta(['meta[property="og:title"]', 'meta[name="twitter:title"]', 'title'])
    || doc.title || '';
  const siteName = getMeta(['meta[property="og:site_name"]']) || new URL(url).hostname.replace('www.', '');
  const description = getMeta(['meta[name="description"]', 'meta[property="og:description"]']);
  const authorMeta = getMeta(['meta[name="author"]', 'meta[property="article:author"]']);

  const authors = authorMeta
    ? [{ lastName: authorMeta.split(' ').pop() || authorMeta, firstName: authorMeta.split(' ')[0] || '', middleInitial: '' }]
    : [{ lastName: siteName, firstName: '', middleInitial: '' }];

  return {
    sourceType: 'website', authors,
    title: title.replace(/\s+/g, ' ').trim(),
    year: new Date().getFullYear().toString(),
    doi: url, websiteName: siteName,
    abstractNotes: description
  };
}

function fillForm(data) {
  if (data.sourceType) { $('sourceType').value = data.sourceType; handleSourceTypeChange(); }
  if (data.authors?.length) {
    $('authorsContainer').innerHTML = '';
    data.authors.forEach(a => addAuthorEntry(a.lastName, a.firstName, a.middleInitial || ''));
  }
  if (data.title)          $('titleInput').value        = data.title;
  if (data.year)           $('yearInput').value         = data.year;
  if (data.doi)            $('doiField').value          = data.doi;
  if (data.journalName)    $('journalName').value       = data.journalName;
  if (data.volume)         $('volumeInput').value       = data.volume;
  if (data.issue)          $('issueInput').value        = data.issue;
  if (data.pages)          $('pagesInput').value        = data.pages;
  if (data.publisher)      $('publisherInput').value    = data.publisher;
  if (data.edition)        $('editionInput').value      = data.edition;
  if (data.websiteName)    $('websiteNameInput').value  = data.websiteName;
  if (data.conferenceName) $('conferenceNameInput').value = data.conferenceName;
  if (data.location)       $('locationInput').value     = data.location;
  if (data.abstractNotes)  $('abstractNotes').value     = data.abstractNotes;
}

// ── Get form data ────────────────────────────────────────────────
function getFormData() {
  return {
    sourceType: $('sourceType').value,
    format: $('citationFormat').value,
    authors: getAuthors(),
    title: $('titleInput').value.trim(),
    year: $('yearInput').value.trim(),
    doi: $('doiField').value.trim(),
    abstractNotes: $('abstractNotes').value.trim(),
    journalName: $('journalName').value.trim(),
    volume: $('volumeInput').value.trim(),
    issue: $('issueInput').value.trim(),
    pages: $('pagesInput').value.trim(),
    publisher: $('publisherInput').value.trim(),
    edition: $('editionInput').value.trim(),
    websiteName: $('websiteNameInput').value.trim(),
    accessDate: $('accessDateInput').value,
    conferenceName: $('conferenceNameInput').value.trim(),
    location: $('locationInput').value.trim()
  };
}

// ── Citation Generators ──────────────────────────────────────────
function generateAPACitation(data) {
  const authors = data.authors;
  function fmt(a) { let s = `${a.lastName}, ${a.firstName.charAt(0)}.`; if (a.middleInitial) s = s.slice(0,-1) + ` ${a.middleInitial.replace(/\.$/,'')+'.'}`; return s; }
  let authorStr = authors.length === 1 ? fmt(authors[0])
    : authors.length === 2 ? `${fmt(authors[0])}, & ${fmt(authors[1])}`
    : `${authors.slice(0,-1).map(fmt).join(', ')}, & ${fmt(authors[authors.length-1])}`;

  switch (data.sourceType) {
    case 'journal': {
      let c = `${authorStr} (${data.year}). ${data.title}. <i>${data.journalName}</i>`;
      if (data.volume) c += `, <i>${data.volume}</i>`;
      if (data.issue)  c += `(${data.issue})`;
      if (data.pages)  c += `, ${data.pages}`;
      c += '.';
      if (data.doi) c += ` ${data.doi}`;
      return c;
    }
    case 'book': {
      let c = `${authorStr} (${data.year}). <i>${data.title}</i>`;
      if (data.edition) c += ` (${data.edition} ed.)`;
      c += '.';
      if (data.publisher) c += ` ${data.publisher}.`;
      return c;
    }
    case 'website': {
      let c = `${authorStr} (${data.year}). ${data.title}. <i>${data.websiteName}</i>.`;
      if (data.accessDate) { const d = new Date(data.accessDate); c += ` Retrieved ${d.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}, from`; }
      if (data.doi) c += ` ${data.doi}`;
      return c;
    }
    case 'conference': {
      let c = `${authorStr} (${data.year}). ${data.title}. In <i>${data.conferenceName}</i>`;
      if (data.location) c += `, ${data.location}`;
      c += '.';
      if (data.doi) c += ` ${data.doi}`;
      return c;
    }
  }
  return '';
}

function generateACMCitation(data) {
  const authors = data.authors;
  function fmt(a) { return `${a.firstName}${a.middleInitial ? ' '+a.middleInitial : ''} ${a.lastName}`; }
  let authorStr = authors.length === 1 ? fmt(authors[0])
    : authors.length === 2 ? `${fmt(authors[0])} and ${fmt(authors[1])}`
    : `${authors.slice(0,-1).map(fmt).join(', ')}, and ${fmt(authors[authors.length-1])}`;

  switch (data.sourceType) {
    case 'journal': {
      let c = `${authorStr}. ${data.year}. ${data.title}. <i>${data.journalName}</i>`;
      if (data.volume) c += ` ${data.volume}`;
      if (data.issue)  c += `, ${data.issue}`;
      if (data.pages)  c += ` (${data.year}), ${data.pages}`;
      c += '.';
      if (data.doi) c += ` ${data.doi}`;
      return c;
    }
    case 'book': {
      let c = `${authorStr}. ${data.year}. <i>${data.title}</i>.`;
      if (data.publisher) c += ` ${data.publisher}`;
      if (data.edition)   c += `, ${data.edition} edition`;
      return c + '.';
    }
    case 'website': {
      let c = `${authorStr}. ${data.year}. ${data.title}. <i>${data.websiteName}</i>.`;
      if (data.doi) c += ` ${data.doi}`;
      if (data.accessDate) { const d = new Date(data.accessDate); c += ` Accessed: ${d.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}.`; }
      return c;
    }
    case 'conference': {
      let c = `${authorStr}. ${data.year}. ${data.title}. In <i>${data.conferenceName}</i>`;
      if (data.location) c += `, ${data.location}`;
      return c + '.';
    }
  }
  return '';
}

function generateASCECitation(data) {
  const authors = data.authors;
  function fmt(a) { let s = `${a.lastName}, ${a.firstName.charAt(0)}.`; if (a.middleInitial) s += ` ${a.middleInitial.endsWith('.')?a.middleInitial:a.middleInitial+'.'}`; return s; }
  let authorStr = authors.length === 1 ? fmt(authors[0])
    : authors.length === 2 ? `${fmt(authors[0])}, and ${fmt(authors[1])}`
    : `${authors.slice(0,-1).map(fmt).join(', ')}, and ${fmt(authors[authors.length-1])}`;

  switch (data.sourceType) {
    case 'journal': {
      let c = `${authorStr} (${data.year}). "${data.title}." <i>${data.journalName}</i>`;
      if (data.volume) { c += `, ${data.volume}`; if (data.issue) c += `(${data.issue})`; }
      if (data.pages) c += `, ${data.pages}`;
      c += '.';
      if (data.doi) c += ` ${data.doi}`;
      return c;
    }
    case 'book': {
      let c = `${authorStr} (${data.year}). <i>${data.title}</i>`;
      if (data.edition) c += `, ${data.edition} ed.`;
      c += '.';
      if (data.publisher) c += ` ${data.publisher}.`;
      return c;
    }
    case 'website': {
      let c = `${authorStr} (${data.year}). "${data.title}." <i>${data.websiteName}</i>.`;
      if (data.doi) c += ` ${data.doi}`;
      if (data.accessDate) { const d = new Date(data.accessDate); c += ` (accessed ${d.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}).`; }
      return c;
    }
    case 'conference': {
      let c = `${authorStr} (${data.year}). "${data.title}." <i>Proc., ${data.conferenceName}</i>`;
      if (data.location) c += `, ${data.location}`;
      c += ', ASCE.';
      if (data.doi) c += ` ${data.doi}`;
      return c;
    }
  }
  return '';
}

function generateBibTeX(data) {
  const authors = data.authors;
  const authorStr = authors.map(a => `${a.lastName}, ${a.firstName}${a.middleInitial ? ' '+a.middleInitial : ''}`).join(' and ');
  const key = (authors[0]?.lastName || 'unknown').toLowerCase().replace(/\s/g,'') + (data.year || '');
  let bib = '';

  const line = (k, v) => v ? `,\n  ${k} = {${v}}` : '';

  switch (data.sourceType) {
    case 'journal':
      bib = `@article{${key},\n  author = {${authorStr}},\n  title = {${data.title}},\n  journal = {${data.journalName}},\n  year = {${data.year}}${line('volume',data.volume)}${line('number',data.issue)}${line('pages',data.pages)}${line('doi',data.doi?.replace('https://doi.org/',''))}\n}`;
      break;
    case 'book':
      bib = `@book{${key},\n  author = {${authorStr}},\n  title = {${data.title}},\n  year = {${data.year}}${line('publisher',data.publisher)}${line('edition',data.edition)}\n}`;
      break;
    case 'website':
      bib = `@misc{${key},\n  author = {${authorStr}},\n  title = {${data.title}},\n  year = {${data.year}}${line('howpublished',`\\url{${data.doi}}`)}${line('note',data.accessDate ? `Accessed: ${data.accessDate}` : '')}\n}`;
      break;
    case 'conference':
      bib = `@inproceedings{${key},\n  author = {${authorStr}},\n  title = {${data.title}},\n  booktitle = {${data.conferenceName}},\n  year = {${data.year}}${line('address',data.location)}${line('doi',data.doi?.replace('https://doi.org/',''))}\n}`;
      break;
  }
  return bib;
}

// ── Generate citation ────────────────────────────────────────────
function generateCitation() {
  const data = getFormData();
  if (!data.authors.length || !data.title || !data.year) {
    showToast('Fill in Authors, Title, and Year at minimum');
    return;
  }

  let formatted = data.format === 'apa' ? generateAPACitation(data)
    : data.format === 'acm' ? generateACMCitation(data)
    : generateASCECitation(data);

  const bibtex = generateBibTeX(data);
  const sortKey = (data.authors[0]?.lastName || 'Z').toUpperCase();
  const plainText = formatted.replace(/<[^>]*>/g, '');

  currentCitation = { formatted, plainText, bibtex, format: data.format.toUpperCase(), sourceType: data.sourceType, data, abstractNotes: data.abstractNotes, sortKey, id: Date.now().toString() };

  $('formattedPreview').innerHTML = `<p>${formatted}</p>`;
  $('bibtexPreview').innerHTML = `<pre>${bibtex}</pre>`;
  $('previewCard').style.display = '';
  $('copyBtn').disabled = false;
  $('addToListBtn').disabled = false;
  showToast('Citation generated!');
}

// ── Clear form ───────────────────────────────────────────────────
function clearForm() {
  $('authorsContainer').innerHTML = '';
  addAuthorEntry();
  ['titleInput','yearInput','doiField','doiInput','abstractNotes','journalName','volumeInput','issueInput','pagesInput','publisherInput','editionInput','websiteNameInput','conferenceNameInput','locationInput'].forEach(id => { if ($(id)) $(id).value = ''; });
  $('accessDateInput').valueAsDate = new Date();
  $('previewCard').style.display = 'none';
  $('formattedPreview').innerHTML = '';
  $('bibtexPreview').innerHTML = '';
  currentCitation = null;
}

// ── Preview tabs ─────────────────────────────────────────────────
function switchPreviewTab(tab) {
  document.querySelectorAll('.preview-tabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.preview-text').forEach(p => p.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
  $(tab + 'Preview').classList.add('active');
}

// ── Copy ─────────────────────────────────────────────────────────
async function copyToClipboard() {
  const activeTab = document.querySelector('.preview-tabs .tab.active').dataset.tab;
  const text = activeTab === 'bibtex' ? currentCitation.bibtex : currentCitation.plainText;
  try { await navigator.clipboard.writeText(text); showToast('Copied!'); }
  catch { showToast('Copy failed'); }
}

// ── Add to list ──────────────────────────────────────────────────
function addToList() {
  if (!currentCitation) return;
  const folder = appData.folders.find(f => f.id === currentFolderId);
  if (folder) {
    folder.citations.push({ ...currentCitation });
    saveData();
    renderCitations();
    generateAlphaNav();
    showToast('Added to list!');
    // On mobile, switch to citations tab
    if (window.innerWidth < 768) switchTab('citations');
  }
}

// ── Render citations ─────────────────────────────────────────────
function renderCitations(query = '') {
  const folder = appData.folders.find(f => f.id === currentFolderId);
  const citations = folder ? folder.citations : [];
  $('currentFolderName').textContent = folder?.name || 'Citations';
  $('citationCount').textContent = citations.length;

  let filtered = citations;
  if (query) {
    filtered = citations.filter(c =>
      c.plainText.toLowerCase().includes(query) ||
      c.data?.title?.toLowerCase().includes(query) ||
      c.data?.authors?.some(a => a.lastName.toLowerCase().includes(query))
    );
  }

  const container = $('citationsList');

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><div class="es-icon">📭</div><h3>${query ? 'No results' : 'No citations yet'}</h3><p>${query ? 'Try a different search term' : 'Generate a citation and click Add to List!'}</p></div>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => (a.sortKey || 'Z').localeCompare(b.sortKey || 'Z'));
  const grouped = {};
  sorted.forEach(c => {
    const letter = (c.sortKey || 'Z')[0];
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(c);
  });

  container.innerHTML = Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).map(([letter, cits]) => `
    <div class="letter-group" data-letter="${letter}">
      <div class="letter-group-header">
        <div class="letter-badge">${letter}</div>
        <div class="letter-line"></div>
      </div>
      ${cits.map(c => `
        <div class="citation-card" onclick="window.openCitationModal('${c.id}')">
          <div class="citation-card-top">
            <div class="citation-badges">
              <span class="badge badge-format">${c.format}</span>
              <span class="badge badge-type">${c.sourceType}</span>
              ${c.abstractNotes ? '<span class="badge badge-notes">notes</span>' : ''}
            </div>
          </div>
          <div class="citation-text">${c.formatted}</div>
          <div class="citation-card-actions">
            <button class="btn-card-action" onclick="copyCitationText('${c.id}', event)">Copy</button>
            <button class="btn-card-action del" onclick="deleteCitation('${c.id}', event)">Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

// ── Alpha nav ────────────────────────────────────────────────────
function generateAlphaNav() {
  const folder = appData.folders.find(f => f.id === currentFolderId);
  const letters = new Set((folder?.citations || []).map(c => (c.sortKey || 'Z')[0].toUpperCase()));
  $('alphaNav').innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l =>
    `<button class="alpha-btn${letters.has(l)?' has-items':''}" ${!letters.has(l)?'disabled':''} onclick="scrollToLetter('${l}')">${l}</button>`
  ).join('');
}

window.scrollToLetter = function(letter) {
  document.querySelector(`.letter-group[data-letter="${letter}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ── Delete / copy individual citation ────────────────────────────
window.deleteCitation = function(id, e) {
  e?.stopPropagation();
  const folder = appData.folders.find(f => f.id === currentFolderId);
  if (folder) { folder.citations = folder.citations.filter(c => c.id !== id); saveData(); renderCitations(); generateAlphaNav(); showToast('Deleted'); }
};

window.copyCitationText = async function(id, e) {
  e?.stopPropagation();
  const folder = appData.folders.find(f => f.id === currentFolderId);
  const c = folder?.citations.find(c => c.id === id);
  if (c) { try { await navigator.clipboard.writeText(c.plainText); showToast('Copied!'); } catch { showToast('Copy failed'); } }
};

// ── Citation detail modal ─────────────────────────────────────────
window.openCitationModal = function(id) {
  const folder = appData.folders.find(f => f.id === currentFolderId);
  const c = folder?.citations.find(c => c.id === id);
  if (!c) return;

  let html = `
    <div class="citation-detail-section"><h4>Formatted Citation (${c.format})</h4><div class="citation-formatted">${c.formatted}</div></div>
    <div class="citation-detail-section"><h4>BibTeX</h4><pre style="background:var(--bg-app);padding:12px;border-radius:6px;font-size:0.82rem;overflow-x:auto;white-space:pre-wrap">${c.bibtex}</pre></div>
  `;
  if (c.abstractNotes) html += `<div class="citation-detail-section"><h4>Abstract / Notes</h4><div class="abstract-text">${c.abstractNotes}</div></div>`;

  $('citationModalBody').innerHTML = html;
  $('citationModal').classList.add('show');
};

function closeCitationModal() { $('citationModal').classList.remove('show'); }

// ── Folder management ─────────────────────────────────────────────
function renderFolders() {
  $('folderList').innerHTML = appData.folders.map(f => `
    <li class="folder-item${f.id === currentFolderId ? ' active' : ''}">
      <button class="folder-item-btn" onclick="selectFolder('${f.id}')">📁 ${esc(f.name)}</button>
      ${f.id !== 'default' ? `<div class="folder-item-actions"><button class="btn-icon-tiny del" onclick="deleteFolder('${f.id}')">🗑</button></div>` : ''}
    </li>
  `).join('');
}

function renderFoldersFull() {
  $('folderListFull').innerHTML = appData.folders.map(f => `
    <li class="folder-full-item${f.id === currentFolderId ? ' active' : ''}" onclick="selectFolderAndSwitch('${f.id}')">
      <div class="folder-full-name">📁 ${esc(f.name)}</div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="folder-full-count">${f.citations.length} citation${f.citations.length !== 1 ? 's' : ''}</span>
        ${f.id !== 'default' ? `<button class="btn-folder-action del" onclick="event.stopPropagation();deleteFolder('${f.id}')">🗑</button>` : ''}
      </div>
    </li>
  `).join('');
}

window.selectFolder = function(id) {
  currentFolderId = id;
  const folder = appData.folders.find(f => f.id === id);
  if (folder) { renderFolders(); renderCitations(); generateAlphaNav(); }
};

window.selectFolderAndSwitch = function(id) {
  selectFolder(id);
  if (window.innerWidth < 768) switchTab('citations');
};

function showFolderModal(editId = null) {
  $('folderModalTitle').textContent = editId ? 'Edit Folder' : 'New Folder';
  $('folderNameInput').value = editId ? (appData.folders.find(f=>f.id===editId)?.name || '') : '';
  $('folderModal').dataset.editId = editId || '';
  $('folderModal').classList.add('show');
  setTimeout(() => $('folderNameInput').focus(), 100);
}

function closeFolderModal() { $('folderModal').classList.remove('show'); $('folderNameInput').value = ''; }

function saveFolder() {
  const name = $('folderNameInput').value.trim();
  if (!name) { showToast('Enter a folder name'); return; }
  const editId = $('folderModal').dataset.editId;
  if (editId) {
    const f = appData.folders.find(f => f.id === editId);
    if (f) f.name = name;
  } else {
    appData.folders.push({ id: 'folder-' + Date.now(), name, citations: [] });
  }
  saveData();
  renderFolders();
  if (window.innerWidth < 768) renderFoldersFull();
  closeFolderModal();
  showToast(editId ? 'Folder updated' : 'Folder created');
}

window.deleteFolder = function(id) {
  if (!confirm('Delete this folder and all its citations?')) return;
  appData.folders = appData.folders.filter(f => f.id !== id);
  if (currentFolderId === id) currentFolderId = appData.folders[0]?.id || 'default';
  saveData();
  renderFolders();
  if (window.innerWidth < 768) renderFoldersFull();
  renderCitations();
  generateAlphaNav();
  showToast('Folder deleted');
};

// ── Export ───────────────────────────────────────────────────────
function getSorted() {
  const folder = appData.folders.find(f => f.id === currentFolderId);
  return [...(folder?.citations || [])].sort((a,b) => (a.sortKey||'Z').localeCompare(b.sortKey||'Z'));
}

function exportToPdf() {
  const sorted = getSorted();
  if (!sorted.length) { showToast('No citations to export'); return; }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const margin = 20, pageW = doc.internal.pageSize.getWidth(), textW = pageW - margin*2;
    let y = margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('References', pageW/2, y, { align:'center' });
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    sorted.forEach((c, i) => {
      const lines = doc.splitTextToSize(`${i+1}. ${c.plainText}`, textW);
      if (y + lines.length * 6 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
      doc.text(lines, margin, y);
      y += lines.length * 6 + 4;
    });

    const folder = appData.folders.find(f => f.id === currentFolderId);
    doc.save(`${(folder?.name||'citations').replace(/\s+/g,'_')}_citations.pdf`);
    showToast('PDF downloaded!');
  } catch (e) {
    console.error(e);
    showToast('PDF export failed — reload the page and try again');
  }
}

function exportToDoc() {
  const sorted = getSorted();
  if (!sorted.length) { showToast('No citations to export'); return; }
  const folder = appData.folders.find(f => f.id === currentFolderId);
  const content = 'References\n\n' + sorted.map((c,i) => `${i+1}. ${c.plainText}`).join('\n\n');
  downloadBlob(content, `${(folder?.name||'citations').replace(/\s+/g,'_')}_citations.doc`, 'application/msword');
  showToast('Word document downloaded!');
}

function exportToBibtex() {
  const sorted = getSorted();
  if (!sorted.length) { showToast('No citations to export'); return; }
  const folder = appData.folders.find(f => f.id === currentFolderId);
  const content = sorted.map(c => c.bibtex).join('\n\n');
  downloadBlob(content, `${(folder?.name||'citations').replace(/\s+/g,'_')}_references.bib`, 'text/plain');
  showToast('BibTeX file downloaded!');
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Butter AI ────────────────────────────────────────────────────
function openButter() {
  $('butterPanel').classList.add('open');
  $('butterOverlay').classList.add('show');
  setTimeout(() => $('butterInput').focus(), 300);
}
function closeButter() {
  $('butterPanel').classList.remove('open');
  $('butterOverlay').classList.remove('show');
}

function sendButterMessage() {
  const msg = $('butterInput').value.trim();
  if (!msg) return;
  addButterMessage(msg, 'user');
  $('butterInput').value = '';

  const typingId = showButterTyping();
  setTimeout(() => {
    removeButterTyping(typingId);
    addButterMessage(generateButterResponse(msg), 'bot');
  }, 800 + Math.random() * 600);
}

function showButterTyping() {
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.className = 'ai-message bot';
  div.id = id;
  div.innerHTML = `<div class="message-content"><div class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>`;
  $('butterMessages').appendChild(div);
  $('butterMessages').scrollTop = $('butterMessages').scrollHeight;
  return id;
}

function removeButterTyping(id) { $(id)?.remove(); }

function addButterMessage(content, type) {
  const div = document.createElement('div');
  div.className = `ai-message ${type}`;
  div.innerHTML = `<div class="message-content"><p>${content}</p></div>`;
  $('butterMessages').appendChild(div);
  $('butterMessages').scrollTop = $('butterMessages').scrollHeight;
}

function generateButterResponse(query) {
  const q = query.toLowerCase();

  if (q.match(/^(hi|hello|hey|howdy|sup|yo)\b/)) {
    const g = [
      `*wags tail* Hey hey! Butter here 🐶 Ready to fetch some citation help! What do you need?`,
      `WOOF! Hi there! 🐶 Butter the citation dog is on duty! What can I sniff out for you?`,
      `*bork bork* Hello! 🐶 Throw me a question and I'll fetch the answer!`
    ];
    return g[Math.floor(Math.random()*g.length)];
  }

  if (q.includes('check') || q.includes('validate') || q.includes('is this right')) {
    return `Ooh ooh, let me sniff that! 🐶<br><br>Paste the citation and tell me the format (APA, ACM, or ASCE) and I'll look for issues like:<br><br>• Missing author initials or year<br>• Punctuation and italics placement<br>• Required fields for the source type<br>• DOI formatting<br><br><b>Pro tip:</b> Use the form to auto-generate a perfectly formatted citation — then you never have to worry! 😄`;
  }

  if (q.includes('apa') && (q.includes('journal') || q.includes('article'))) {
    return `Fetched it! 🐶 APA 7th edition journal format:<br><br><b>Format:</b><br>Author, A. A., &amp; Author, B. B. (Year). Title. <i>Journal, Volume</i>(Issue), Pages. DOI<br><br><b>Tip:</b> Paste the DOI in the lookup field and I'll go fetch the form fields! 🎾`;
  }
  if (q.includes('apa') && q.includes('book')) {
    return `*sniffs book* APA book citation 🐶<br><br><b>Format:</b><br>Author, A. A. (Year). <i>Title</i> (Xth ed.). Publisher.<br><br>Edited book? Replace author with editor and add (Ed.) after name!`;
  }
  if (q.includes('apa') && (q.includes('website') || q.includes('web'))) {
    return `On it! *runs around* 🐶 APA website citation:<br><br>Author, A. A. (Year, Month Day). Title. <i>Site Name</i>. Retrieved Date, from URL<br><br>• No author? Use org name<br>• No date? Use <b>(n.d.)</b><br><br>Paste the URL in the lookup field and I'll fetch metadata automatically! 🎾`;
  }
  if ((q.includes('apa') && q.includes('acm')) || q.includes('difference between') || q.includes('which format')) {
    return `*sits and thinks really hard* 🐶 Here's the breakdown:<br><br><b>APA</b> (Psychology/Education): Last, F. M. (Year). Title. <i>Journal, Vol</i>(Issue).<br><br><b>ACM</b> (Computer Science): First Last. Year. Title. <i>Journal Vol</i>, Issue.<br><br><b>ASCE</b> (Engineering): Last, F. M. (Year). "Title." <i>Journal</i>, Vol(No.).<br><br>Not sure? Ask your professor or check the journal guidelines!`;
  }
  if (q.includes('acm') && !q.includes('apa')) {
    return `ACM citation style — I fetched it! 🐶<br><br><b>Journal:</b> First M. Last. Year. Title. <i>Journal Vol</i>, Issue (Year), Pages. DOI<br><b>Book:</b> First A. Author. Year. <i>Title</i>. Publisher, Xth edition.<br><b>Conference:</b> Author. Year. Title. In <i>Proc. Conference</i>, Location.<br><br>Select <b>ACM</b> from the format dropdown!`;
  }
  if (q.includes('asce') || q.includes('civil engineer')) {
    return `ASCE format 🐶<br><br><b>Journal:</b> Last, F. M. (Year). "Title." <i>Journal</i>, Vol(No.), Pages. DOI<br><b>Book:</b> Last, F. M. (Year). <i>Title</i>, Xth ed. Publisher.<br><b>Conference:</b> Last, F. M. (Year). "Title." <i>Proc., Name</i>, Location, ASCE.<br><br>Select <b>ASCE</b> from the dropdown!`;
  }
  if (q.includes('book') || q.includes('textbook') || q.includes('isbn')) {
    return `Ooh a book! *wag wag* 🐶<br><br><b>APA:</b> Author, A. A. (Year). <i>Title</i> (ed.). Publisher.<br><b>ACM:</b> Author. Year. <i>Title</i>. Publisher, edition.<br><b>ASCE:</b> Author (Year). <i>Title</i>, ed. Publisher.<br><br>Got an ISBN? Paste it in the lookup field — I'll fetch the details automatically! 📚`;
  }
  if (q.includes('website') || q.includes('web page') || q.includes('online')) {
    return `*sniff sniff* Citing a website? I got it! 🐶<br><br><b>APA:</b> Author (Year). Title. <i>Site</i>. Retrieved from URL<br><b>ACM:</b> Author. Year. Title. <i>Site</i>. URL. Accessed: Date.<br><b>ASCE:</b> Author (Year). "Title." <i>Site</i>. URL (accessed Date).<br><br>Paste the URL in the lookup bar and I'll fetch the title! 🎾`;
  }
  if (q.includes('bibtex') || q.includes('latex') || q.includes('overleaf')) {
    return `BibTeX + Overleaf — fetching the steps! 🐶<br><br>1. Click <b>Export BibTeX</b> to download a <code>.bib</code> file<br>2. Upload it to your Overleaf project<br>3. Add to your <code>.tex</code> file:<br>&nbsp;&nbsp;<code>\\bibliography{name}</code><br>&nbsp;&nbsp;<code>\\bibliographystyle{apalike}</code><br>4. Cite with <code>\\cite{key}</code><br><br>Keys are auto-generated as <b>lastname + year</b>! *sits and waits*`;
  }
  if (q.includes('autofill') || q.includes('auto-fill') || q.includes('lookup') || q.includes('doi') || q.includes('fill')) {
    return `Ooh ooh! Auto-fill is one of my favourite tricks! 🐶<br><br>1. Paste DOI, URL, or ISBN in the <b>lookup bar</b><br>2. Click <b>Lookup</b><br>3. Watch me fetch all the details! 🎾✨<br><br><b>Supported:</b><br>• <b>DOI</b> — via CrossRef (journals/articles)<br>• <b>URL</b> — scrapes title, site name<br>• <b>ISBN</b> — via Open Library (books)`;
  }
  if (q.includes('export') || q.includes('pdf') || q.includes('word') || q.includes('download')) {
    return `I'll fetch that info! 🐶 Export options:<br><br>• <b>PDF</b> — formatted reference list, ready to submit<br>• <b>Word (.doc)</b> — editable, paste into your paper<br>• <b>BibTeX (.bib)</b> — for LaTeX and Overleaf<br><br>Find the export buttons in the <b>Citations</b> tab!`;
  }
  if (q.includes('my citation') || q.includes('summarize') || q.includes('how many')) {
    const folder = appData.folders.find(f => f.id === currentFolderId);
    const count = folder?.citations.length || 0;
    if (!count) return `*sniffs around* Your "<b>${folder?.name || 'current folder'}</b>" is empty! 🐶<br><br>Generate a citation and tap <b>Add to List</b>!`;
    const formats = {}, types = {};
    folder.citations.forEach(c => { formats[c.format] = (formats[c.format]||0)+1; types[c.sourceType] = (types[c.sourceType]||0)+1; });
    let s = `*wags tail* Here's your "<b>${folder.name}</b>" summary 🐶<br><br>📚 Total: <b>${count}</b><br><br><b>By Format:</b><br>`;
    Object.entries(formats).forEach(([f,c]) => { s += `• ${f}: ${c}<br>`; });
    s += `<br><b>By Type:</b><br>`;
    Object.entries(types).forEach(([t,c]) => { s += `• ${t}: ${c}<br>`; });
    return s + `<br>Export using the buttons in the Citations tab! 🎾`;
  }
  if (q.includes('folder') || q.includes('organis') || q.includes('project')) {
    return `Folders! I know how those work! 🐶<br><br>• Tap <b>+ New Folder</b> to create one<br>• Name it after your project ("Thesis Ch.2")<br>• Switch folders to manage different reference lists<br>• Think of them as different toy boxes — one for each project! 📁`;
  }
  if (q.includes('thanks') || q.includes('thank you') || q.includes('awesome') || q.includes('great') || q.includes('good boy') || q.includes('good dog')) {
    const r = [`*tail wagging intensifies* 🐶 Happy to help!`, `Arf arf! Thank you! 🐾 That's what Butter's here for!`, `*does a little spin* So glad I could help! 🐶`];
    return r[Math.floor(Math.random()*r.length)];
  }
  if (q.includes('help') || q.includes('what can you') || q.includes('features')) {
    return `*spins in a circle* Woof! I'm Butter 🐶 — your citation dog! Here's what I can fetch:<br><br>🎾 <b>Auto-fill</b> — DOI, URL, or ISBN lookup<br>📝 <b>Format help</b> — APA, ACM, ASCE rules<br>✅ <b>Citation checking</b> — common mistake tips<br>📚 <b>Your library</b> — summarise saved citations<br>📤 <b>Exports</b> — PDF, Word, BibTeX guidance<br>📁 <b>Folders</b> — organise by project<br><br>Just ask — I don't bite! 🐾`;
  }

  const d = [
    `*tilts head* Hmm, not sure about that one 🐶 I'm best at citation formats (APA/ACM/ASCE), auto-fill, and exports. Try: <i>"How do I cite a journal in APA?"</i>`,
    `*sniffs around confused* That one's tricky for me 🐶 Ask me about citation formats, auto-fill, BibTeX, or your saved citations!`,
    `*sits and looks up at you* Still learning some things! 🐶 But I know citations like the back of my paw — try APA, ACM, ASCE, auto-fill, or exports.`
  ];
  return d[Math.floor(Math.random()*d.length)];
}

// ── Toast ─────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  $('toastMessage').textContent = msg;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000);
}

// ── Util ──────────────────────────────────────────────────────────
function esc(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
