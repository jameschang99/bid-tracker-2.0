const mongoose = require('mongoose');

// Salary is stored as a plain string, exactly as shown on the web page.
const bidSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true, trim: true, lowercase: true },
    username: { type: String, trim: true, default: '' },
    bidSent: { type: Boolean, default: false },
    jobTitle: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true, default: 'Not disclosed' },
    location: { type: String, trim: true, default: '' },
    locationType: { type: String, trim: true, default: '' },    // Remote / Hybrid / On-site
    employmentType: { type: String, trim: true, default: '' },  // Full time / Contract / ...
    salary: { type: String, default: '' },
    workMethod: { type: String, enum: ['hourly', 'fixed', 'unknown'], default: 'unknown' },
    workContent: { type: String, default: '' },
    jobUrl: { type: String, required: true, trim: true }
  },
  { timestamps: true } // createdAt = day the entry was first saved (used for the daily view)
);

// One record per job per platform; pressing Ctrl+. again updates instead of duplicating.
bidSchema.index({ platform: 1, jobUrl: 1 }, { unique: true });

module.exports = mongoose.model('Bid', bidSchema);
