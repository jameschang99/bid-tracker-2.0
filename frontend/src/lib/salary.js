export const salaryValue = (value) => {
  const matches = String(value ?? '').match(/(?:US\s*)?\$\s*[\d,]+(?:\.\d+)?(?:\s*(?:-|–|—|to)\s*(?:(?:US\s*)?\$\s*)?[\d,]+(?:\.\d+)?)?/gi) || [];
  return [...new Set(matches.map((match) => match.replace(/\s+/g, ' ').trim()))].join(' | ');
};

export const salaryMethod = (value) => String(value ?? '').trim();