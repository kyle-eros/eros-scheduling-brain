/** ================== DEFAULTS (fallbacks) ================== */
const DEFAULTS = {
  PROJECT: 'of-scheduler-proj',
  LOCATION: 'US',
  TZ: 'America/Denver',
  VIEWS: {
    WEEK_SLOTS: 'eros_core.vw_week_slots_7d_rbac',
    DAILY_RECOMMENDATIONS: 'eros_messaging_mart.enhanced_daily_recommendations',
    CAPTION_DRIP: 'eros_messaging_feat.caption_bank_drip',
    CAPTION_RENEWAL: 'eros_messaging_feat.caption_bank_renewal',
    CAPTION_TIP: 'eros_messaging_feat.caption_bank_tip',
    AUTHENTICITY_MONITOR: 'eros_messaging_feat.authenticity_monitor',
    TIER_ASSIGNMENTS: 'eros_messaging_feat.creator_tier_assignments',
    CAPTION_RANK: 'mart.caption_rank_next24_v3_tbl',
    BRIEF: 'sheets.v_daily_brief_user_flat',
    ALERTS: 'mart.v_weekly_feasibility_alerts'
  },
  SHEETS: {
    WEEK: '📅 Week',
    DAY:  '✅ Day',
    BANK: '🧠 Caption Bank',
    SOP:  '📖 SOP',
    BRIEF:'📋 Brief',
    ALERTS:'⚠ Alerts',
    LOG:  '📝 Log',
    SET:  '⚙ Settings'
  },
  CACHE_TTL_SEC: 1800
};

/** ====== SETTINGS: read from ⚙ Settings (key/value) and merge with defaults ====== */
function readSheetSettings_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(DEFAULTS.SHEETS.SET);
  const out = {};
  if (!sh) return out;
  const last = sh.getLastRow();
  if (last < 2) return out;
  const rows = sh.getRange(2,1,last-1,2).getValues();
  rows.forEach(([k,v]) => { if (k) out[String(k).trim()] = v; });
  return out;
}
function deepClone_(o){ return JSON.parse(JSON.stringify(o||{})); }
function deepMerge_(base, overrides){
  const o = deepClone_(base);
  Object.keys(overrides||{}).forEach(k=>{
    const v = overrides[k];
    if (k.indexOf('sheet_')===0) { /* handled below */ return; }
    if (k==='project_id') o.PROJECT = String(v||o.PROJECT);
    else if (k==='location') o.LOCATION = String(v||o.LOCATION);
    else if (k==='time_zone') o.TZ = String(v||o.TZ);
    else if (k==='caption_rank_view') o.VIEWS.CAPTION_RANK = String(v||o.VIEWS.CAPTION_RANK);
    else o[k] = v;
  });
  // sheet_* keys allow renaming tabs without code changes
  const sheets = deepClone_(base.SHEETS);
  Object.keys(overrides||{}).forEach(k=>{
    if (k==='sheet_week') sheets.WEEK = overrides[k];
    if (k==='sheet_day')  sheets.DAY  = overrides[k];
    if (k==='sheet_bank') sheets.BANK = overrides[k];
    if (k==='sheet_sop')  sheets.SOP  = overrides[k];
    if (k==='sheet_brief')sheets.BRIEF= overrides[k];
    if (k==='sheet_alerts')sheets.ALERTS = overrides[k];
    if (k==='sheet_log')  sheets.LOG  = overrides[k];
    if (k==='sheet_set')  sheets.SET  = overrides[k];
  });
  o.SHEETS = sheets;
  return o;
}
function getCfg_(){
  const s = readSheetSettings_();
  const merged = deepMerge_(DEFAULTS, s);
  // Optional: per-scheduler override
  merged._schedulerOverride = s['scheduler_email (optional override)'] || '';
  return merged;
}

/** ====== utils ====== */
function _email(){ try{ return (Session.getActiveUser().getEmail()||"").toLowerCase(); }catch(e){ return ''; } }
function _bq(sql,cfg){ return BigQuery.Jobs.query({query:sql,useLegacySql:false,location:cfg.LOCATION}, cfg.PROJECT); }
function _rows(res){ const f=(res.schema.fields||"[]").map(v=>v.name); return (res.rows||"[]").map(r=>r.f.reduce((o,c,i)=> (o[f[i]]=c.v, o),{})); }
function _fmtDate(d,cfg){ return Utilities.formatDate(new Date(d), cfg.TZ, 'yyyy-MM-dd'); }
function _hash(s){ const b=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s); return b.map(x=>((x+256)%256).toString(16).padStart(2,'0')).join(''); }

/** ====== menus & init ====== */
function onOpen(){
  const cfg = getCfg_();
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 Scheduler Hub')
    .addItem('📅 Load My Week','loadMyWeek')
    .addItem('✅ Load Day Board','loadDayBoard')
    .addSeparator()
    .addItem('🧠 Pick Caption (Top-N)','showCaptionPicker')
    .addItem('↔ Randomize Minutes (±15)','randomizeMinutes')
    .addSeparator()
    .addItem('📤 Submit Ready/Sent','submitPlan')
    .addItem('❓ Ask EROS (sidebar)','openAskSidebar')
    .addSeparator()
    .addItem('🔧 Test BigQuery Connection','testBigQueryConnection')
    .addToUi();
  ensureTabs_(cfg);
}

/** ====== scaffold & formatting ====== */
function ensureTabs_(cfg){
  try{
    const ss = SpreadsheetApp.getActive();
    // Ensure Settings exists first so admins can edit keys
    const set = ss.getSheetByName(cfg.SHEETS.SET) || ss.insertSheet(cfg.SHEETS.SET);
    if (set.getLastRow()<2){
      set.getRange(1,1,1,2).setValues([['Key','Value']]).setFontWeight('bold');
      set.getRange(2,1,10,2).setValues([
        ['project_id', cfg.PROJECT],
        ['location', cfg.LOCATION],
        ['time_zone', cfg.TZ],
        ['scheduler_email (optional override)',''],
        ['sheet_week', cfg.SHEETS.WEEK],
        ['sheet_day',  cfg.SHEETS.DAY],
        ['caption_rank_view', cfg.VIEWS.CAPTION_RANK],
        ['cache_ttl_sec', DEFAULTS.CACHE_TTL_SEC],
        ['sheet_bank', cfg.SHEETS.BANK],
        ['sheet_sop',  cfg.SHEETS.SOP]
      ]);
      set.setFrozenRows(1);
    }

    // Recompute cfg in case admin just edited the names
    const live = getCfg_();

    // Create tabs by name
    const need = [live.SHEETS.WEEK, live.SHEETS.DAY, live.SHEETS.BANK, live.SHEETS.SOP, live.SHEETS.BRIEF, live.SHEETS.ALERTS, live.SHEETS.LOG];
    need.forEach(n=>{ if (!ss.getSheetByName(n)) ss.insertSheet(n); });

    // Week headers/format (updated for tier system)
    const wk = ss.getSheetByName(live.SHEETS.WEEK);
    wk.getRange(1,1,1,16).setValues([['Date','Day','Creator','Page Handle','Page Type','Tier','Strategy','Time','Price','Daily Limit','Fatigue','CaptionID','Preview','Status','Adjustment','Window']]);
    wk.setFrozenRows(1); wk.setColumnWidths(1,16,100); wk.setColumnWidth(9,80); wk.setColumnWidth(13,200);

    // Day headers/format (updated for tier system)
    const day = ss.getSheetByName(live.SHEETS.DAY);
    day.getRange(1,1,1,16).setValues([['Time','Creator','Page Handle','Page Type','Tier','Price','CaptionID','Preview','Status','Notes','Hash','HOD','Rank','Window','Adjustment','Limit']]);
    day.setFrozenRows(1); day.setColumnWidths(1,16,100); day.setColumnWidth(8,200);

    // **V1.2: Data validation for Status (I column for new layout)**
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Planned','Ready','Sent','Skipped'], true)
      .setAllowInvalid(false)
      .build();
    day.getRange('I2:I').setDataValidation(rule);

  }catch(e){
    console.error('ensureTabs_ error:', e);
    SpreadsheetApp.getUi().alert('Could not set up tabs. Please try again or contact support.');
  }
}

/** ====== weekly loader ====== */
function activeEmail_(cfg){
  const set = SpreadsheetApp.getActive().getSheetByName(cfg.SHEETS.SET);
  const override = set && set.getRange(2,2,set.getLastRow()-1,1).getValues().find(r=>String(r[0]).toLowerCase().includes('@'));
  return override ? String(override[0]).toLowerCase() : _email();
}
function loadMyWeek(){
  const cfg = getCfg_();
  try{
    const email = activeEmail_(cfg);
    const sql = `
      WITH scheduler_assignments AS (
        SELECT DISTINCT username_std, page_handle
        FROM \`${cfg.PROJECT}.eros_source.scheduler_assignments_final\`
        WHERE LOWER(scheduler_email) = LOWER('${email}')
      )
      SELECT
        dr.username_std as creator_id,
        DATE(dr.recommended_send_ts) as plan_date,
        FORMAT_TIMESTAMP('%H:%M', dr.recommended_send_ts) AS hhmm,
        'PPV' as action_type,
        dr.page_handle,
        dr.page_type,
        dr.full_tier_assignment,
        dr.messaging_strategy,
        dr.suggested_price as recommended_price_usd,
        dr.daily_limit,
        CASE
          WHEN dr.fatigue_safety_score < 30 THEN '🔴 HIGH'
          WHEN dr.fatigue_safety_score < 60 THEN '🟡 MOD'
          ELSE '🟢 SAFE'
        END as fatigue_risk_band,
        CASE WHEN dr.in_tier_window THEN '✅' ELSE '⚠️' END as tier_window_indicator,
        dr.adjustment_rule
      FROM \`${cfg.PROJECT}.${cfg.VIEWS.DAILY_RECOMMENDATIONS}\` dr
      INNER JOIN scheduler_assignments sa ON dr.page_handle = sa.page_handle
      WHERE dr.recommendation_date >= CURRENT_DATE()
        AND dr.recommendation_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 6 DAY)
      ORDER BY dr.page_handle, dr.recommended_send_ts`;

    const rows = _rows(_bq(sql, cfg));
    const out = rows.map(r=>{
      const d = new Date(r.plan_date + 'T00:00:00');
      const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
      return [
        r.plan_date,
        day,
        r.creator_id,
        r.page_handle || 'main',
        r.page_type || 'UNKNOWN',
        r.full_tier_assignment || 'UNKNOWN',
        r.messaging_strategy || '',
        r.hhmm,
        Number(r.recommended_price_usd || 0),
        r.daily_limit || 0,
        r.fatigue_risk_band || '',
        '', // CaptionID (empty for now)
        '', // Preview (empty for now)
        'Planned',
        r.adjustment_rule === 'maintain_baseline' ? '' : r.adjustment_rule,
        r.tier_window_indicator || ''
      ];
    });

    const wk = SpreadsheetApp.getActive().getSheetByName(cfg.SHEETS.WEEK);
    wk.getRange(2,1,Math.max(0,wk.getLastRow()-1),16).clearContent();
    if (out.length) wk.getRange(2,1,out.length,16).setValues(out);
    wk.getRange(2,9,Math.max(out.length,1),1).setNumberFormat('$0.00');
    SpreadsheetApp.getActive().toast(`Loaded ${out.length} tier-aware weekly rows for ${email}`);
  }catch(e){
    console.error('Error in loadMyWeek:', e);
    SpreadsheetApp.getUi().alert('Could not load weekly data. Please try again. If this persists, contact support.');
  }
}

/** ====== day board (updated for tier system) ====== */
function loadDayBoard(){
  const cfg = getCfg_();
  try{
    const ss = SpreadsheetApp.getActive();
    const wk = ss.getSheetByName(cfg.SHEETS.WEEK);
    const day = ss.getSheetByName(cfg.SHEETS.DAY);

    // Get all values from week tab (now 16 columns)
    const vals = wk.getRange(2, 1, Math.max(0, wk.getLastRow()-1), 16).getValues();
    const today = _fmtDate(new Date(), cfg);
    const tomorrow = _fmtDate(new Date(Date.now() + 86400000), cfg);

    // Filter for today and tomorrow only
    const keep = vals.filter(r => [today, tomorrow].includes(_fmtDate(r[0], cfg)));

    const out = keep.map(r => {
      const creator = String(r[2] || '');
      const pageHandle = String(r[3] || 'main');
      const pageType = String(r[4] || 'UNKNOWN');
      const tier = String(r[5] || 'UNKNOWN');
      const timeStr = String(r[7] || '00:00');
      const hod = parseInt(timeStr.split(':')[0], 10) || 0;
      const hash = _hash([pageHandle, _fmtDate(r[0], cfg), timeStr, 'PPV'].join('|'));
      const adjustment = String(r[14] || '');
      const window = String(r[15] || '');
      const dailyLimit = r[9] || 0;

      return [
        timeStr,           // Time
        creator,           // Creator
        pageHandle,        // Page Handle
        pageType,          // Page Type
        tier,              // Tier
        Number(r[8] || 0), // Price
        '',                // CaptionID (empty for now)
        '',                // Preview (empty for now)
        'Planned',         // Status
        '',                // Notes
        hash,              // Hash
        hod,               // HOD
        '',                // Rank
        window,            // Window
        adjustment,        // Adjustment
        dailyLimit         // Limit
      ];
    });

    day.getRange(2, 1, Math.max(0, day.getLastRow()-1), 16).clearContent();
    if (out.length) day.getRange(2, 1, out.length, 16).setValues(out);
    day.getRange(2, 6, Math.max(out.length, 1), 1).setNumberFormat('$0.00');

    SpreadsheetApp.getActive().toast(`Loaded ${out.length} tier-aware day board items`);
  }catch(e){
    console.error('Error in loadDayBoard:', e);
    SpreadsheetApp.getUi().alert('Could not load day board. Please try again.');
  }
}

/** ====== caption picker ====== */
function showCaptionPicker(){
  const cfg=getCfg_();
  try{
    const sh=SpreadsheetApp.getActive().getActiveSheet();
    const row=sh.getActiveRange().getRow(); if (row<=1) return;
    const isDay = (sh.getName()===cfg.SHEETS.DAY);
    const creator=String(sh.getRange(row, isDay?2:3).getValue());
    const hod = Number(isDay? sh.getRange(row,11).getValue() : parseInt(String(sh.getRange(row,6).getValue()).split(':')[0],10));
    const upage = creator+'__main';
    const sql = `
      WITH nearest AS (
        SELECT slot_dt_local FROM 
${cfg.PROJECT}.${cfg.VIEWS.CAPTION_RANK}
        WHERE username_page='${upage}' AND hod=${hod}
        ORDER BY slot_dt_local ASC LIMIT 1
      )
      SELECT caption_id, SUBSTR(COALESCE(caption_text,''),1,500) AS caption_text,
             rps_eb_price + COALESCE(se_bonus,0) + COALESCE(style_score,0) AS score
      FROM 
${cfg.PROJECT}.${cfg.VIEWS.CAPTION_RANK}
      WHERE username_page='${upage}' AND hod=${hod}
        AND slot_dt_local = (SELECT slot_dt_local FROM nearest)
      ORDER BY score DESC, rn ASC LIMIT 10`;
    const items=_rows(_bq(sql,cfg)).map(r=> `<div class="item" data-id="${r.caption_id}"><b>${r.caption_id}</b><br>${(r.caption_text||"").replace(/</g,'&lt;')}</div>`).join('');
    const html=HtmlService.createHtmlOutput(`
      <style>.item{border:1px solid #ddd;padding:8px;margin:6px;cursor:pointer;border-radius:8px}
      .item:hover{background:#eef}.btn{padding:8px 12px;margin-top:8px}</style>
      <div><h3>Top Captions — ${creator} @ ${hod}:00</h3>${items}
        <button class="btn" onclick="pick()">Use selected</button></div>
      <script>
        let sel=null; document.querySelectorAll('.item').forEach(d=>d.onclick=()=>{ document.querySelectorAll('.item').forEach(x=>x.style.background=''); d.style.background='#e0e7ff'; sel=d;});
        function pick(){ if(!sel) return alert('Select one');
          google.script.run.withSuccessHandler(()=>google.script.host.close())
            .applyCaptionToRow(${row}, '${sh.getName()}', sel.getAttribute('data-id'), sel.textContent);
        }
      </script>`).setWidth(640).setHeight(520);
    SpreadsheetApp.getUi().showModalDialog(html,'Pick Caption');
  }catch(e){
    console.error('Error in showCaptionPicker:', e);
    SpreadsheetApp.getUi().alert('Could not load captions. Try again.');
  }
}
function applyCaptionToRow(row, sheetName, captionId, captionText){
  const cfg=getCfg_();
  try{
    const sh=SpreadsheetApp.getActive().getSheetByName(sheetName);
    const isDay=(sheetName===cfg.SHEETS.DAY);
    sh.getRange(row, isDay?6:10).setValue(captionId);
    sh.getRange(row, isDay?7:11).setValue(String(captionText||'').substring(0,200));
    // log selection
    const creator=String(sh.getRange(row, isDay?2:3).getValue());
    const dateISO=isDay? Utilities.formatDate(new Date(),cfg.TZ,'yyyy-MM-dd') : Utilities.formatDate(new Date(sh.getRange(row,1).getValue()),cfg.TZ,'yyyy-MM-dd');
    const timeStr=String(sh.getRange(row, isDay?1:6).getValue());
    const hod=parseInt(timeStr.split(':')[0],10)||0;
    const price=Number(sh.getRange(row, isDay?5:7).getValue()||0);
    const hash=isDay? String(sh.getRange(row,10).getValue()): _hash([creator,dateISO,timeStr,'PPV'].join('|'));
    const sql = `
      INSERT \`${cfg.PROJECT}.ops.send_log\`
        (action_ts, action_date, tracking_hash, username_std, page_type, username_page,
         scheduler_code, scheduler_email, date_local, hod_local, price_usd, caption_id, status, action, source)
      SELECT CURRENT_TIMESTAMP(), CURRENT_DATE(), '${hash}','${creator}','main','${creator}__main',
             '', '${activeEmail_(cfg)}', '${dateISO}', ${hod}, ${price}, '${captionId}', 'Planned','caption_selected','sheets_hub_v1'
      WHERE NOT EXISTS (SELECT 1 FROM \`${cfg.PROJECT}.ops.send_log\` WHERE tracking_hash='${hash}' AND action='caption_selected')`;
    _bq(sql,cfg);
  }catch(e){
    console.error('applyCaptionToRow error:', e);
    SpreadsheetApp.getUi().alert('Could not log caption selection.');
  }
}

/** ====== randomize minutes ====== */
function randomizeMinutes(){
  const cfg=getCfg_();
  try{
    const sh=SpreadsheetApp.getActive().getSheetByName(cfg.SHEETS.DAY);
    const vals=sh.getRange(2,1,Math.max(0,sh.getLastRow()-1),12).getValues();
    vals.forEach(r=>{
      if (!r[0]) return;
      const [hh,mm]=String(r[0]).split(':').map(n=>parseInt(n,10)||0);
      const delta = Math.floor(Math.random()*31)-15;
      const d=new Date(2000,0,1,hh,mm+delta,0);
      r[0]=Utilities.formatDate(d, cfg.TZ, 'HH:mm');
    });
    if (vals.length) sh.getRange(2,1,vals.length,12).setValues(vals);
  }catch(e){
    console.error('randomizeMinutes error:', e);
    SpreadsheetApp.getUi().alert('Could not randomize times.');
  }
}

/** ====== submit Ready/Sent ====== */
function submitPlan(){
  const cfg=getCfg_();
  try{
    const sh=SpreadsheetApp.getActive().getSheetByName(cfg.SHEETS.DAY);
    const vals=sh.getRange(2,1,Math.max(0,sh.getLastRow()-1),12).getValues();
    let ready=0, sent=0;
    vals.forEach(r=>{
      const status=String(r[7]||''); if (!['Ready','Sent'].includes(status)) return;
      const creator=String(r[1]||''), up=creator+'__main';
      const dateISO=Utilities.formatDate(new Date(), cfg.TZ, 'yyyy-MM-dd');
      const hod=parseInt(String(r[0]).split(':')[0],10)||0;
      const price=Number(r[4]||0), cap=String(r[5]||''); const hash=String(r[9]||'');
      const act=(status==='Sent')?'sent':'ready';
      const sql = `
        INSERT \`${cfg.PROJECT}.ops.send_log\`
        (action_ts, action_date, tracking_hash, username_std, page_type, username_page,
         scheduler_code, scheduler_email, date_local, hod_local, price_usd, caption_id, status, action, source)
        SELECT CURRENT_TIMESTAMP(), CURRENT_DATE(), '${hash}','${creator}','main','${up}',
               '', '${activeEmail_(cfg)}', '${dateISO}', ${hod}, ${price}, NULLIF('${cap}',''), '${status}', '${act}', 'sheets_hub_v1'
        WHERE NOT EXISTS (SELECT 1 FROM \`${cfg.PROJECT}.ops.send_log\` WHERE tracking_hash='${hash}' AND action='${act}')`;
      _bq(sql,cfg);
      if (act==='sent') sent++; else ready++;
    });
    SpreadsheetApp.getActive().toast(`Submitted ${ready} Ready, ${sent} Sent`);
  }catch(e){
    console.error('submitPlan error:', e);
    SpreadsheetApp.getUi().alert('Could not submit plan. Please try again.');
  }
}

/** ====== testing & debugging ====== */
function testBigQueryConnection(){
  try {
    const cfg = getCfg_();
    const testSql = `SELECT COUNT(*) as row_count FROM \`${cfg.PROJECT}.eros_source.scheduler_assignments_final\``;
    const result = _bq(testSql, cfg);
    const rows = _rows(result);
    SpreadsheetApp.getUi().alert(`BigQuery Test: Found ${rows[0].row_count} scheduler assignments`);
    return true;
  } catch (e) {
    SpreadsheetApp.getUi().alert(`BigQuery Error: ${e.toString()}`);
    return false;
  }
}

/** ====== sidebar Q&A (live BQ) ====== */
function openAskSidebar(){
  const html = HtmlService.createHtmlOutputFromFile('AskSidebar').setTitle('Ask EROS');
  SpreadsheetApp.getUi().showSidebar(html);
}
function qa(creator, kind){
  const cfg=getCfg_();
  try{
    creator=String(creator||"").toLowerCase(); if (!creator) return 'Enter a creator';
    if (kind==='best_hours'){
      const sql=`SELECT plan_date, FORMAT_TIME('%H:%M', recommended_time) AS hhmm, reason_time_code
                 FROM 
${cfg.PROJECT}.${cfg.VIEWS.WEEK_SLOTS}
                 WHERE LOWER(creator_id)=LOWER('${creator}')
                 ORDER BY plan_date, hhmm`;
      return JSON.stringify(_rows(_bq(sql,cfg)),null,2);
    }
    if (kind==='fatigue_today'){
      const sql=`SELECT plan_date, fatigue_risk_band
                 FROM 
${cfg.PROJECT}.${cfg.VIEWS.WEEK_SLOTS}
                 WHERE LOWER(creator_id)=LOWER('${creator}') AND plan_date=CURRENT_DATE('${cfg.TZ}')`;
      return JSON.stringify(_rows(_bq(sql,cfg)),null,2);
    }
    if (kind==='top_captions'){
      const sql=`SELECT caption_id, SUBSTR(caption_text,1,240) AS txt
                 FROM 
${cfg.PROJECT}.${cfg.VIEWS.CAPTION_RANK}
                 WHERE username_page='${creator}__main'
                 ORDER BY rn LIMIT 10`;
      return JSON.stringify(_rows(_bq(sql,cfg)),null,2);
    }
    return 'Unknown query';
  }catch(e){
    console.error('qa error:', e);
    return 'Query failed. Try again.';
  }
}

/** ====== ENHANCED SCHEDULING FUNCTIONS ====== */

/** Load enhanced daily recommendations with mandatory drip bumps and renewals */
function loadEnhancedDayBoard(){
  try {
    const cfg = getCfg_();
    const activeEmail = _email();
    const today = _fmtDate(new Date(), cfg);

    const sql = `
      SELECT
        username_std,
        page_handle,
        FORMAT_TIMESTAMP('%H:%M', recommended_send_ts) as scheduled_time,
        message_type,
        message_subtype,
        slot_description,
        recommendation_rank,
        ROUND(recommendation_score * 100, 1) as score_percent,
        timing_confidence,
        price_tier,
        suggested_price,
        fatigue_safety_score,
        is_mandatory,
        opportunity_quality,
        recommendation_reason,
        time_energy_required,
        caption_guidance,
        spacing_ok
      FROM \`${cfg.PROJECT}.${cfg.VIEWS.DAILY_RECOMMENDATIONS}\`
      WHERE recommendation_date = '${today}'
        AND username_std IN (
          SELECT string_field_1
          FROM \`${cfg.PROJECT}.eros_source.scheduler_assignments_final\`
          WHERE string_field_0 = '${activeEmail}'
        )
      ORDER BY username_std, recommendation_rank
    `;

    const result = _bq(sql, cfg);
    const rows = _rows(result);

    // Write to Day sheet
    const ss = SpreadsheetApp.getActive();
    const daySheet = ss.getSheetByName(cfg.SHEETS.DAY);

    if (!daySheet) {
      SpreadsheetApp.getUi().alert('Day sheet not found. Please create it first.');
      return;
    }

    // Clear existing content
    daySheet.clear();

    // Headers
    const headers = [
      'Creator', 'Page Handle', 'Time', 'Type', 'Subtype', 'Description',
      'Rank', 'Score%', 'Confidence', 'Price Tier', 'Price', 'Fatigue',
      'Mandatory', 'Quality', 'Reason', 'Energy', 'Caption Guidance', 'Spacing OK', 'Status'
    ];
    daySheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Format headers
    daySheet.getRange(1, 1, 1, headers.length)
      .setBackground('#4285f4')
      .setFontColor('white')
      .setFontWeight('bold');

    if (rows.length > 0) {
      const data = rows.map(row => [
        row.username_std,
        row.page_handle,
        row.scheduled_time,
        row.message_type,
        row.message_subtype || '',
        row.slot_description,
        row.recommendation_rank,
        row.score_percent,
        row.timing_confidence,
        row.price_tier,
        row.suggested_price || '',
        row.fatigue_safety_score,
        row.is_mandatory ? 'YES' : 'NO',
        row.opportunity_quality,
        row.recommendation_reason,
        row.time_energy_required,
        row.caption_guidance,
        row.spacing_ok ? 'OK' : 'CHECK',
        'PENDING'  // Status column for scheduler updates
      ]);

      daySheet.getRange(2, 1, data.length, headers.length).setValues(data);

      // Apply conditional formatting
      const range = daySheet.getRange(2, 1, data.length, headers.length);

      // Color code by message type
      data.forEach((row, index) => {
        const rowRange = daySheet.getRange(index + 2, 1, 1, headers.length);

        if (row[3] === 'drip_bump') {
          rowRange.setBackground('#e8f5e8');  // Light green for mandatory drip
        } else if (row[3] === 'renewal_campaign') {
          rowRange.setBackground('#fff3e0');  // Light orange for renewals
        } else if (row[3] === 'ppv') {
          rowRange.setBackground('#f3e5f5');  // Light purple for PPVs
        } else if (row[3] === 'tip_campaign') {
          rowRange.setBackground('#e1f5fe');  // Light blue for tips
        }

        // Highlight mandatory items
        if (row[12] === 'YES') {
          rowRange.setBorder(true, true, true, true, true, true, '#ff0000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
        }
      });
    }

    daySheet.autoResizeColumns(1, headers.length);
    SpreadsheetApp.getActive().toast(`Loaded ${rows.length} enhanced recommendations for ${today}`);

  } catch (e) {
    console.error('loadEnhancedDayBoard error:', e);
    SpreadsheetApp.getUi().alert('Error loading enhanced day board: ' + e.toString());
  }
}

/** Get authentic captions based on message type and time energy */
function getAuthenticCaptions(messageType, timeEnergy, creator = '') {
  try {
    const cfg = getCfg_();
    let tableName = '';
    let typeField = '';

    // Determine which caption bank to query
    switch (messageType) {
      case 'drip_bump':
        tableName = cfg.VIEWS.CAPTION_DRIP;
        typeField = 'drip_type';
        break;
      case 'renewal_campaign':
        tableName = cfg.VIEWS.CAPTION_RENEWAL;
        typeField = 'renewal_type';
        break;
      case 'tip_campaign':
        tableName = cfg.VIEWS.CAPTION_TIP;
        typeField = 'tip_type';
        break;
      default:
        return 'Unknown message type';
    }

    const sql = `
      SELECT
        caption_id,
        caption_text,
        authenticity_score,
        tone,
        tags,
        times_used,
        last_used_date
      FROM \`${cfg.PROJECT}.${tableName}\`
      WHERE time_energy = '${timeEnergy}'
        AND (last_used_date IS NULL OR last_used_date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
      ORDER BY authenticity_score DESC, times_used ASC
      LIMIT 10
    `;

    const result = _bq(sql, cfg);
    const rows = _rows(result);

    if (rows.length === 0) {
      return 'No captions found for this combination';
    }

    return rows.map((row, index) =>
      `${index + 1}. [Score: ${row.authenticity_score}] ${row.caption_text}`
    ).join('\n\n');

  } catch (e) {
    console.error('getAuthenticCaptions error:', e);
    return 'Error loading captions: ' + e.toString();
  }
}

/** Check authenticity status for a creator */
function checkAuthenticityStatus(creator) {
  try {
    const cfg = getCfg_();

    const sql = `
      SELECT
        overall_authenticity_score,
        pattern_risk_level,
        authenticity_alerts,
        improvement_recommendations,
        analysis_date
      FROM \`${cfg.PROJECT}.${cfg.VIEWS.AUTHENTICITY_MONITOR}\`
      WHERE LOWER(username_std) = LOWER('${creator}')
        AND analysis_date = CURRENT_DATE()
    `;

    const result = _bq(sql, cfg);
    const rows = _rows(result);

    if (rows.length === 0) {
      return 'No authenticity data found for this creator';
    }

    const row = rows[0];
    return `
Authenticity Status for ${creator}:
Overall Score: ${row.overall_authenticity_score}/100
Risk Level: ${row.pattern_risk_level}
Alerts: ${row.authenticity_alerts || 'None'}
Recommendations: ${row.improvement_recommendations}
Analysis Date: ${row.analysis_date}
    `;

  } catch (e) {
    console.error('checkAuthenticityStatus error:', e);
    return 'Error checking authenticity: ' + e.toString();
  }
}

/** Get tier information for a creator */
function getTierInfo(creator) {
  try {
    const cfg = getCfg_();

    const sql = `
      SELECT
        full_tier_assignment,
        tier_description,
        base_daily_quota,
        min_daily_ppvs,
        max_daily_ppvs,
        mandatory_drip_bumps,
        mandatory_renewals,
        tier_confidence,
        performance_risk
      FROM \`${cfg.PROJECT}.${cfg.VIEWS.TIER_ASSIGNMENTS}\`
      WHERE LOWER(username_std) = LOWER('${creator}')
        AND assignment_date = CURRENT_DATE()
    `;

    const result = _bq(sql, cfg);
    const rows = _rows(result);

    if (rows.length === 0) {
      return 'No tier assignment found for this creator';
    }

    const row = rows[0];
    return `
Tier Assignment for ${creator}:
Tier: ${row.full_tier_assignment}
Description: ${row.tier_description}
Daily Quota: ${row.base_daily_quota} messages
PPV Range: ${row.min_daily_ppvs}-${row.max_daily_ppvs}
Mandatory: ${row.mandatory_drip_bumps} drips + ${row.mandatory_renewals} renewals
Confidence: ${row.tier_confidence}
Risk Level: ${row.performance_risk}
    `;

  } catch (e) {
    console.error('getTierInfo error:', e);
    return 'Error getting tier info: ' + e.toString();
  }
}

/** Enhanced menu system */
function onOpen(){
  const cfg = getCfg_();
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 Enhanced Scheduler Hub')
    .addItem('📅 Load My Week','loadMyWeek')
    .addItem('✅ Load Enhanced Day Board','loadEnhancedDayBoard')
    .addSeparator()
    .addSubMenu(ui.createMenu('🧠 Smart Captions')
      .addItem('Get Drip Captions','getDripCaptions')
      .addItem('Get Renewal Captions','getRenewalCaptions')
      .addItem('Get Tip Captions','getTipCaptions'))
    .addSeparator()
    .addSubMenu(ui.createMenu('📊 Analytics')
      .addItem('Check Creator Authenticity','checkCreatorAuthenticity')
      .addItem('View Tier Assignment','viewTierAssignment'))
    .addSeparator()
    .addItem('↔ Randomize Minutes (±15)','randomizeMinutes')
    .addItem('📤 Submit Ready/Sent','submitPlan')
    .addItem('❓ Ask EROS (sidebar)','openAskSidebar')
    .addSeparator()
    .addItem('🔧 Test BigQuery Connection','testBigQueryConnection')
    .addToUi();
  ensureTabs_(cfg);
}
