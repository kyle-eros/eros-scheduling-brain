# EROS Intelligence Engine - Google Apps Script Integration

This directory contains Google Apps Script code that provides automation and integration between the EROS Intelligence Engine and Google Sheets for content creator management.

## 📁 Files

- **`Code.gs`** - Main Apps Script functions for automation
- **`AskSidebar.html`** - HTML sidebar interface for Google Sheets
- **`appsscript.json`** - Apps Script project configuration
- **`.clasp.json`** - Google clasp CLI configuration

## 🎯 Features

### Scheduling Automation
- Automated creator scheduling based on ML recommendations
- Integration with BigQuery for real-time data access
- Fatigue detection and optimal timing suggestions

### Dashboard Integration
- Interactive sidebar for Google Sheets
- Real-time data visualization and insights
- Creator performance monitoring

### Workflow Management
- Automated assignment distribution to schedulers
- Performance tracking and analytics
- Alert system for optimization opportunities

## 🚀 Setup

### Prerequisites
- Google Apps Script access
- Google Sheets with EROS template
- BigQuery permissions for data access

### Installation
1. **Create new Apps Script project** in Google Drive
2. **Copy code from `Code.gs`** into the script editor
3. **Add HTML file** using `AskSidebar.html` content
4. **Configure permissions** for BigQuery and Sheets access
5. **Deploy as web app** or add-on as needed

### Configuration
Update the `DEFAULTS` object in `Code.gs`:
```javascript
const DEFAULTS = {
  PROJECT: 'your-project-id',
  LOCATION: 'US',
  TZ: 'America/Denver',
  // ... other settings
};
```

## 📊 Data Integration

The Apps Script connects to:
- **BigQuery views** for ML recommendations
- **Google Sheets** for scheduler assignments
- **EROS Dataform pipeline** for real-time insights

## 🔧 Deployment

### Local Development
1. Install Google `clasp` CLI: `npm install -g @google/clasp`
2. Login: `clasp login`
3. Configure: Update `.clasp.json` with your script ID
4. Deploy: `clasp push`

### Production
- Deploy as Google Workspace add-on
- Set up triggers for automated execution
- Configure permissions and sharing settings

## 📈 Usage

1. **Open Google Sheets** with EROS template
2. **Access sidebar** via Extensions menu
3. **Review recommendations** from the ML pipeline
4. **Execute scheduling** with one-click automation
5. **Monitor performance** through integrated dashboards

This integration brings the power of the EROS Intelligence Engine directly into the familiar Google Sheets environment for content creators and schedulers.