// Press Ctrl + .  on a job page: the details are scraped with the site's adapter
// and sent to the API via background.js. Salary is kept as the exact text shown on the page.
(() => {
  const DEBUG = true; // logs what was extracted to the page console (F12)

  // ---------- pure helpers (unit-testable in Node) ----------
  // Every "$177,700.00 - $229,900.00" style range, kept exactly as written, joined with " | ".
  const salaryRanges = (text) => {
    const re = /(?:US\s*)?\$\s?([\d,]+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(?:(?:US\s*)?\$\s?)?([\d,]+(?:\.\d+)?)/gi;
    const seen = new Set();
    const out = [];
    let m;
    while ((m = re.exec(text || ''))) {
      const min = parseFloat(m[1].replace(/,/g, ''));
      const max = parseFloat(m[2].replace(/,/g, ''));
      const raw = m[0].trim();
      if (!(min >= 10) || !(max >= min) || seen.has(raw)) continue;
      seen.add(raw);
      out.push(raw);
    }
    return out.join(' | ');
  };

  const salaryDetails = (text) => {
    const lines = String(text || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
    return [...new Set(lines.filter((line) => /\b(?:salary|compensation|pay|hourly|annual|per (?:hour|week|month|year))\b|[$€£]/i.test(line)))].join('\n');
  };

  // "Full-Stack Engineer, AI Platform @ Thumbtack" -> { title, company }
  const parseTitleMeta = (s) => {
    const i = (s || '').lastIndexOf(' @ ');
    return i === -1 ? { title: (s || '').trim(), company: '' } : { title: s.slice(0, i).trim(), company: s.slice(i + 3).trim() };
  };

  const htmlToText = (html) => {
    const withBreaks = String(html || '').replace(/<\/(p|li|h\d|div|ul|ol)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
    const t = new DOMParser().parseFromString(withBreaks, 'text/html').documentElement.textContent || '';
    return t.replace(/\n{3,}/g, '\n\n').trim();
  };

  const EMPLOYMENT = { FULL_TIME: 'Full time', PART_TIME: 'Part time', CONTRACTOR: 'Contract', CONTRACT: 'Contract', TEMPORARY: 'Temporary', INTERN: 'Intern', INTERNSHIP: 'Intern' };
  const ldEmployment = (ld) => (ld && ld.employmentType ? [].concat(ld.employmentType).map((x) => EMPLOYMENT[x] || x).join(', ') : '');
  const ldLocation = (ld) => [].concat((ld && ld.jobLocation) || []).map((job) => {
    if (typeof job === 'string') return job.trim();
    const address = job && job.address;
    if (typeof address === 'string') return address.trim();
    if (!address || typeof address !== 'object') return '';
    const country = address.addressCountry;
    return [address.addressLocality, address.addressRegion, typeof country === 'object' ? country.name : country]
      .filter(Boolean)
      .join(', ');
  }).filter(Boolean).join(' / ');

  if (typeof module !== 'undefined') {
    module.exports = { salaryRanges, salaryDetails, parseTitleMeta, ldLocation };
    return; // Node test environment: stop here
  }

  // ---------- DOM helpers ----------
  const first = (selectors) => {
    for (const s of selectors) {
      const el = document.querySelector(s);
      const t = el && (el.value || el.innerText || el.textContent || '').trim();
      if (t) return t;
    }
    return '';
  };
  const meta = (name) => {
    const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    return el ? (el.content || '').trim() : '';
  };

  // Upwork forms: value of the <input> that sits near a label matching `re` — exactly as typed/shown.
  const inputByLabel = (re) => {
    const nodes = document.querySelectorAll('label, h3, h4, strong, span, div');
    for (const n of nodes) {
      if (n.children.length > 3) continue;
      const t = (n.textContent || '').trim();
      if (!t || t.length > 80 || !re.test(t)) continue;
      let box = n;
      for (let i = 0; i < 4 && box; i++, box = box.parentElement) {
        const input = box.querySelector('input[type="text"], input[type="number"], input:not([type])');
        if (input && input.value) return input.value.trim();
      }
    }
    return '';
  };

  // Text of the element following a leaf element whose text matches `re`
  // (Ashby: "Location Type" -> "Remote", "Employment Type" -> "Full time").
  const valueAfterLabel = (re, maxLen = 120) => {
    for (const el of document.querySelectorAll('h1,h2,h3,h4,h5,h6,dt,label,span,div,p')) {
      if (el.children.length > 0) continue;
      const t = (el.textContent || '').trim();
      if (!t || t.length > 40 || !re.test(t)) continue;
      const next = el.nextElementSibling || (el.parentElement && el.parentElement.nextElementSibling);
      const v = next && next.textContent.trim();
      if (v && v.length < maxLen) return v;
    }
    return '';
  };

  const jobPostingLd = () => {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const j = JSON.parse(s.textContent);
        for (const o of Array.isArray(j) ? j : [j]) if (o && o['@type'] === 'JobPosting') return o;
      } catch (_) {}
    }
    return null;
  };

  // ---------- Site adapters. If a site changes its HTML, edit the selectors here. ----------
  const ADAPTERS = {
    'www.upwork.com': {
      platform: 'upwork',
      url: () => location.href,
      extract() {
        const title =
          first(['[data-test="job-title"]', '[data-test="job-details-title"]', 'h1']) ||
          document.title.replace(/\s*-\s*Upwork.*$/i, '').trim();
        const company = first([
          '[data-test="client-company-name"]',
          '[data-qa="client-company-profile-name"]',
          '[data-test="company-name"]'
        ]);
        const location = first(['[data-test="job-location"]', '[data-test="location"]']) || valueAfterLabel(/^location$/i);
        const body = document.body.innerText;
        const workMethod = /fixed-price/i.test(body) ? 'fixed' : /hourly/i.test(body) ? 'hourly' : 'unknown';
        return { jobTitle: title, companyName: company, location, workMethod };
      }
    },

    'www.freelancer.com': {
      platform: 'freelancer',
      url: () => location.href,
      extract() {
        return {
          jobTitle: first(['h1', '[data-test="project-title"]']) || document.title,
          companyName: first(['[data-test="employer-name"]', '.employer-name']),
          location: first(['[data-test="project-location"]', '.project-location']) || valueAfterLabel(/^location$/i),
          workMethod: 'fixed'
        };
      }
    },

    'jobs.ashbyhq.com': {
      platform: 'ashby',
      cache: true, // if you press Ctrl+. on the application form, reuse details seen on the overview page
      url: () => location.origin + location.pathname.replace(/\/application\/?$/, '').replace(/\/+$/, ''),
      extract() {
        const ld = jobPostingLd();
        const fromMeta = parseTitleMeta(meta('title') || document.title);
        const jobTitle = (ld && ld.title) || meta('og:title') || fromMeta.title;
        const companyName = (ld && ld.hiringOrganization && ld.hiringOrganization.name) || fromMeta.company;

        const location = valueAfterLabel(/^location$/i) || ldLocation(ld);
        let locationType = valueAfterLabel(/^location type$/i);
        if (!locationType && ld && ld.jobLocationType === 'TELECOMMUTE') locationType = 'Remote';
        const employmentType = valueAfterLabel(/^employment type$/i) || ldEmployment(ld);

        let workContent = ld && ld.description ? htmlToText(ld.description) : '';
        if (!workContent) {
          workContent =
            first(['[class*="descriptionText"]', '[class*="_description_"]', '[data-testid="job-description"]']) ||
            meta('og:description') ||
            meta('description');
        }
        workContent = workContent.slice(0, 20000);

        // Keep the full compensation text, including notes and benefits around any numeric range.
        const compensation = valueAfterLabel(/^compensation$/i, 20000);
        const salary = compensation || salaryDetails(workContent) || salaryRanges(workContent);

        return { jobTitle, companyName, location, locationType, employmentType, salary, workContent };
      }
    }
  };

  const genericAdapter = {
    platform: location.hostname.replace(/^www\./i, ''),
    url: () => location.href,
    extract() {
      const ld = jobPostingLd();
      const fromMeta = parseTitleMeta(meta('title') || document.title);
      const jobTitle = (ld && ld.title) || meta('og:title') || first(['h1']) || fromMeta.title;
      const companyName = (ld && ld.hiringOrganization && ld.hiringOrganization.name) ||
        meta('og:site_name') || meta('author') || fromMeta.company;
      const location = valueAfterLabel(/^location$/i) || ldLocation(ld);
      let locationType = valueAfterLabel(/^location type$/i);
      if (!locationType && ld && ld.jobLocationType === 'TELECOMMUTE') locationType = 'Remote';
      const employmentType = valueAfterLabel(/^employment type$/i) || ldEmployment(ld);
      const pageContent = first(['main', 'article', '[role="main"]']) || document.body.innerText || '';
      const workContent = htmlToText(ld && ld.description ? ld.description : pageContent).slice(0, 20000);
      const compensation = valueAfterLabel(/^(compensation|salary|salary range|pay range)$/i, 20000);
      const salary = compensation || salaryDetails(workContent) || salaryRanges(workContent);
      const body = document.body.innerText || '';
      const workMethod = /fixed-price/i.test(body) ? 'fixed' : /hourly/i.test(body) ? 'hourly' : 'unknown';
      return { jobTitle, companyName, location, locationType, employmentType, salary, workMethod, workContent };
    }
  };

  const adapter = ADAPTERS[location.hostname] || genericAdapter;

  const BLANK = { location: '', locationType: '', employmentType: '', salary: '', workMethod: 'unknown', workContent: '' };
  const isEmpty = (v) => v == null || String(v).trim() === '' || v === 'unknown';
  const merge = (cached, fresh) => {
    const out = { ...(cached || {}) };
    for (const [k, v] of Object.entries(fresh)) if (!isEmpty(v)) out[k] = v;
    return out;
  };
  const cacheKey = () => 'job:' + adapter.url();

  // Ashby: remember the job details while the overview page is on screen.
  if (adapter.cache) {
    let timer;
    const snapshot = async () => {
      const d = adapter.extract();
      if (d.jobTitle && d.workContent && d.workContent.length > 200) {
        if (DEBUG) console.debug('[BidTracker] snapshot', d);
        try { await chrome.storage.local.set({ [cacheKey()]: d }); } catch (_) {}
      }
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(snapshot, 1200); };
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    schedule();
  }

  const toast = (msg, ok = true) => {
    const d = document.createElement('div');
    d.textContent = msg;
    Object.assign(d.style, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: 2147483647,
      padding: '10px 14px', borderRadius: '8px', font: '13px system-ui, sans-serif',
      color: '#fff', background: ok ? '#15803d' : '#b45309', boxShadow: '0 4px 12px rgba(0,0,0,.25)',
      maxWidth: 'min(360px, calc(100vw - 32px))', overflowWrap: 'anywhere'
    });
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 3500);
  };

  let lastSent = 0;
  const save = async () => {
    if (Date.now() - lastSent < 1000) return;
    lastSent = Date.now();

    let data = adapter.extract();
    if (adapter.cache) {
      try {
        const c = (await chrome.storage.local.get(cacheKey()))[cacheKey()];
        if (c) data = merge(c, data);
      } catch (_) {}
    }
    const payload = {
      ...BLANK,
      ...data,
      platform: adapter.platform,
      jobUrl: adapter.url(),
      jobTitle: data.jobTitle || 'Untitled job',
      companyName: data.companyName || 'Not disclosed'
    };
    if (DEBUG) console.debug('[BidTracker] sending', payload);

    chrome.runtime.sendMessage({ type: 'SAVE_BID', payload }, (res) => {
      if (chrome.runtime.lastError) {
        console.error('[BidTracker] extension error:', chrome.runtime.lastError.message);
        return toast(`Save failed: ${chrome.runtime.lastError.message}`, false);
      }
      if (res && res.ok) return toast('job work added success');
      const error = (res && res.error) || 'unknown error';
      console.error('[BidTracker] save failed:', error);
      toast(`${res && res.queued ? 'Queued locally' : 'Save failed'}: ${error}`, false);
    });
  };

  window.addEventListener(
    'keydown',
    (e) => {
      const isHotkey = e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey &&
        (e.key === '.' || e.key === 'Decimal' || e.code === 'Period' || e.code === 'NumpadDecimal');
      if (!isHotkey) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) save();
    },
    true // capture phase: runs before the site's own key handlers
  );
})();
