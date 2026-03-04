// JCFalke Contact Hub - Base Logic

// ==========================================
// CONFIGURATION - Update these before deployment
// ==========================================
const CLIENT_ID = '426683158199-u0u1dh5o9m99phbk92r4dne8lgd0vmvp.apps.googleusercontent.com';
const SPREADSHEET_ID = '1afPoLLfBnNywzzHmu26-MxeiTD-6rFZCotN9h_gb8_k';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const DISCOVERY_DOCS = ['https://sheets.googleapis.com/$discovery/rest?version=v4'];

let tokenClient;
let gapiInited = false;
let gisInited = false;
let currentContacts = [];

// UI DOM Elements
const appDiv = document.getElementById('app');
const loginScreen = document.getElementById('loginScreen');
const contactsGrid = document.getElementById('contactsGrid');
const devLoginBtn = document.getElementById('devLoginBtn'); // Fallback dev login
const signOutBtn = document.getElementById('signOutBtn');

// Modals
const addModal = document.getElementById('addModal');
const pasteModal = document.getElementById('pasteModal');
const loadingSpinner = document.getElementById('loading');

export function initApp() {
  bindEvents();

  // Expose Google API callbacks to global scope for the native scripts to find
  window.gapiLoaded = async () => {
    try {
      await new Promise((resolve, reject) => {
        gapi.load('client', { callback: resolve, onerror: reject });
      });
      await gapi.client.init({ discoveryDocs: DISCOVERY_DOCS });
      gapiInited = true;
      maybeEnableButtons();
    } catch (err) {
      console.error('Error initializing GAPI client', err);
    }
  };

  window.gisLoaded = () => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: '', // defined at request time
    });
    gisInited = true;
    maybeEnableButtons();
  };

  // If the scripts loaded before our module ran
  if (window.gapi && window.google) {
    window.gapiLoaded();
    window.gisLoaded();
  }
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    const gsBtn = document.getElementById('googleLoginBtn');
    if (gsBtn) gsBtn.style.opacity = '1';
  }
}

// Make handleAuthClick global so it can be called directly
window.handleAuthClick = async function (event) {
  if (event) event.preventDefault();

  if (!CLIENT_ID || CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
    alert("Please set up the Google Cloud CLIENT_ID in main.js and index.html first. Use 'Developer Login' to bypass API for now.");
    return;
  }


  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      throw (resp);
    }
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('userName').innerText = "Authorized User";
    await fetchContacts();
  };

  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      gapi.client.setToken('');
      document.getElementById('app').classList.add('hidden');
      document.getElementById('loginScreen').classList.remove('hidden');
    });
  }
}

async function fetchContacts() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
    console.warn("Spreadsheet ID missing. Unable to fetch.");
    return;
  }

  try {
    loadingSpinner.classList.remove('hidden');
    contactsGrid.innerHTML = '';

    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A2:G', // Adjust 'Sheet1' if needed
    });

    const range = response.result;
    if (!range || !range.values || range.values.length == 0) {
      console.log('No data found.');
      currentContacts = [];
    } else {
      currentContacts = range.values.map((row, index) => ({
        id: index + 2, // Excel row is index+2 (row 1 is header)
        name: row[0] || '',
        company: row[1] || '',
        email: row[2] || '',
        phone: row[3] || '',
        type: row[4] || 'Client',
        country: row[5] || '',
        notes: row[6] || '',
        year: row[7] || '',
        verified: row[8] || ''
      }));
    }
    renderContacts(currentContacts);
  } catch (err) {
    console.error('Error fetching contacts:', err);
    alert('Error fetching from Google Sheets. Check console for details.');
  } finally {
    loadingSpinner.classList.add('hidden');
  }
}

async function saveContactToSheet(contactData, rowId) {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') return;

  const values = [
    [
      contactData.name,
      contactData.company,
      contactData.email,
      contactData.phone,
      contactData.type,
      contactData.country,
      contactData.notes,
      contactData.year,
      contactData.verified
    ]
  ];
  const body = { values: values };

  try {
    loadingSpinner.classList.remove('hidden');
    if (rowId) {
      // Update existing
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Sheet1!A${rowId}:I${rowId}`,
        valueInputOption: 'USER_ENTERED',
        resource: body,
      });
    } else {
      // Append new
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Sheet1!A2:I',
        valueInputOption: 'USER_ENTERED',
        resource: body,
      });
    }
    await fetchContacts(); // Refresh all
  } catch (err) {
    console.error('Error saving contact:', err);
    alert('Error saving to Google Sheets.');
  } finally {
    loadingSpinner.classList.add('hidden');
  }
}

// ----------------------------------------------------
// UI Logic Binding
// ----------------------------------------------------
function bindEvents() {
  // DEV Login Fallback
  devLoginBtn.addEventListener('click', () => {
    loginScreen.classList.add('hidden');
    appDiv.classList.remove('hidden');
    currentContacts = [
      { id: 2, name: 'Alice Walker', company: 'Acme Corp', email: 'alice@acme.com', phone: '+1 555-0102', type: 'Client', country: 'USA', notes: 'Key account Q3.' }
    ];
    renderContacts(currentContacts);
  });

  signOutBtn.addEventListener('click', handleSignoutClick);

  // Modal Toggles
  document.getElementById('btnAddContact').addEventListener('click', () => {
    document.getElementById('contactForm').reset();
    document.getElementById('contactRowIndex').value = '';
    document.getElementById('modalTitle').innerText = 'Add New Contact';
    addModal.classList.remove('hidden');
  });

  document.getElementById('btnCloseAddModal').addEventListener('click', () => { addModal.classList.add('hidden'); });
  document.getElementById('btnCancelAdd').addEventListener('click', () => { addModal.classList.add('hidden'); });

  // Paste Info Modal Actions
  document.getElementById('btnPasteContact').addEventListener('click', () => {
    document.getElementById('pasteInput').value = '';
    pasteModal.classList.remove('hidden');
  });
  document.getElementById('btnClosePasteModal').addEventListener('click', () => { pasteModal.classList.add('hidden'); });
  document.getElementById('btnCancelPaste').addEventListener('click', () => { pasteModal.classList.add('hidden'); });

  // Save Contact
  document.getElementById('btnSaveContact').addEventListener('click', async (e) => {
    e.preventDefault();
    const fName = document.getElementById('fName').value;
    const fCompany = document.getElementById('fCompany').value;
    const fEmail = document.getElementById('fEmail').value;

    if (!fName || !fCompany || !fEmail) {
      alert("Name, Company, and Email are required fields.");
      return;
    }

    const contactData = {
      name: fName,
      company: fCompany,
      email: fEmail,
      phone: document.getElementById('fPhone').value || '',
      type: document.getElementById('fType').value || 'Client',
      country: document.getElementById('fCountry').value || '',
      notes: document.getElementById('fNotes').value || '',
      year: document.getElementById('fYear').value || new Date().getFullYear().toString(),
      verified: document.getElementById('fVerified').value || new Date().toISOString().split('T')[0]
    };

    const rowId = document.getElementById('contactRowIndex').value;

    addModal.classList.add('hidden');

    if (gapi.client && gapi.client.getToken()) {
      await saveContactToSheet(contactData, rowId);
    } else {
      // Offline fallback behavior
      if (rowId) {
        const item = currentContacts.find(c => c.id == rowId);
        if (item) Object.assign(item, contactData);
      } else {
        contactData.id = currentContacts.length + 2;
        currentContacts.push(contactData);
      }
      renderContacts(currentContacts);
    }
  });

  // Filtering & Searching
  const searchInput = document.getElementById('searchInput');
  const typeFilter = document.getElementById('typeFilter');

  const filterData = () => {
    const term = searchInput.value.toLowerCase();
    const type = typeFilter.value;

    const filtered = currentContacts.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(term) ||
        c.company.toLowerCase().includes(term) ||
        c.country.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term);
      const matchType = type === 'All' ? true : c.type === type;
      return matchSearch && matchType;
    });
    renderContacts(filtered);
  };

  searchInput.addEventListener('input', filterData);
  typeFilter.addEventListener('change', filterData);

  // Parse Paste Button
  document.getElementById('btnParsePaste').addEventListener('click', () => {
    const rawData = document.getElementById('pasteInput').value;
    import('./pasteParser.js').then(({ parseContactString }) => {
      const parsed = parseContactString(rawData);

      pasteModal.classList.add('hidden');

      document.getElementById('fName').value = parsed.name || '';
      document.getElementById('fEmail').value = parsed.email || '';
      document.getElementById('fPhone').value = parsed.phone || '';
      document.getElementById('fCompany').value = parsed.company || '';
      document.getElementById('fNotes').value = rawData;

      const currentYear = new Date().getFullYear();
      const today = new Date().toISOString().split('T')[0];

      document.getElementById('fYear').value = currentYear;
      document.getElementById('fVerified').value = today;

      document.getElementById('modalTitle').innerText = 'Add New Contact (From Paste)';
      document.getElementById('contactRowIndex').value = '';
      addModal.classList.remove('hidden');
    });
  });
}

// Helper function for rendering, assuming it exists or will be added
function isVerifiedRecently(dateString) {
  if (!dateString) return false;
  const verifiedDate = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - verifiedDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 30; // Considered recent if within 30 days
}

function renderContacts(data) {
  contactsGrid.innerHTML = '';
  data.forEach(contact => {
    const badgeClass = contact.type === 'Client' ? 'badge-client' : 'badge-supplier';

    const card = document.createElement('div');
    card.className = 'contact-card glass-panel';
    card.setAttribute('data-type', contact.type);

    card.innerHTML = `
                <div class="contact-header">
        <div>
          <div class="contact-name">${contact.name}</div>
          <div class="contact-company">${contact.company}</div>
        </div>
        <div class="badge ${badgeClass}">${contact.type}</div>
      </div>
                <div class="contact-details mt-4">
                    <div class="detail-row">
                        <svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                        <span>${contact.email || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        <span>${contact.phone || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        <span>${contact.country || 'N/A'}</span>
                    </div>
                    <div class="detail-row" style="margin-top: 0.5rem; justify-content: space-between;">
                        <small style="color: var(--text-muted)">Est. ${contact.year || 'N/A'}</small>
                        <small style="color: ${isVerifiedRecently(contact.verified) ? 'var(--success)' : 'var(--danger)'}">
                            ${contact.verified ? 'Verified: ' + contact.verified : 'Not Verified'}
                        </small>
                    </div>
                </div>
    `;

    // Clicking card opens edit modal
    card.addEventListener('click', () => {
      document.getElementById('contactRowIndex').value = contact.id; // Map to Sheet Row
      document.getElementById('modalTitle').innerText = 'Edit Contact';
      document.getElementById('fName').value = contact.name;
      document.getElementById('fCompany').value = contact.company;
      document.getElementById('fEmail').value = contact.email;
      document.getElementById('fPhone').value = contact.phone || '';
      document.getElementById('fType').value = contact.type;
      document.getElementById('fCountry').value = contact.country || '';
      document.getElementById('fNotes').value = contact.notes || '';
      document.getElementById('fYear').value = contact.year || '';
      document.getElementById('fVerified').value = contact.verified || '';

      addModal.classList.remove('hidden');
    });

    contactsGrid.appendChild(card);
  });
}

initApp();
