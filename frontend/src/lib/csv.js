import { dateKey, timeStr } from './days.js';
import { salaryMethod, salaryValue } from './salary.js';

export const CSV_COLUMNS = [
  ['Date', (b) => dateKey(b.createdAt)],
  ['Time', (b) => timeStr(b.createdAt)],
  ['Bid sent', (b) => b.bidSent ? 'Sent' : 'Not sent'],
  ['Username', (b) => b.username],
  ['Platform', (b) => b.platform],
  ['Job title', (b) => b.jobTitle],
  ['Company', (b) => b.companyName],
  ['Location', (b) => b.location],
  ['Location type', (b) => b.locationType],
  ['Employment type', (b) => b.employmentType],
  ['Salary', (b) => salaryValue(b.salary)],
  ['Salary Method', (b) => salaryMethod(b.workMethod)],
  ['Job URL', (b) => b.jobUrl],
  ['Work content', (b) => b.workContent]
];

// Quote fields containing , " or newlines. A leading = + - @ would be run as a formula by
// Excel, so those get a leading apostrophe.
const cell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows) =>
  [CSV_COLUMNS.map(([label]) => cell(label)).join(',')]
    .concat(rows.map((b) => CSV_COLUMNS.map(([, get]) => cell(get(b))).join(',')))
    .join('\r\n');

export const downloadCsv = (filename, csv) => {
  // BOM so Excel opens UTF-8 correctly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
