// Test function to simulate the loadMyWeek function
function testLoadMyWeek() {
  console.log('🧪 Testing loadMyWeek function...');

  const cfg = {
    PROJECT: 'of-scheduler-proj',
    LOCATION: 'US',
    TZ: 'America/Denver',
    VIEWS: {
      WEEK_SLOTS: 'eros_core.vw_week_slots_7d_rbac'
    }
  };

  // Simulate different scheduler identities (code + email)
  const testSchedulers = [
    { code: 'PAM', email: 'geesushee07@gmail.com' },
    { code: 'KEVIN', email: 'kevinicer@gmail.com' },
    { code: 'NIELLE', email: 'niefredeluces@gmail.com' }
  ];

  testSchedulers.forEach(({ code, email }) => {
    console.log(`\n📋 Testing for scheduler: ${code} <${email}>`);

    const sql = `
      SELECT creator_id, plan_date,
        FORMAT_TIME('%H:%M', recommended_time) AS hhmm,
        COALESCE(action_type,'PPV') AS action_type,
        recommended_price_usd, reason_time_code, fatigue_risk_band
      FROM
        \`${cfg.PROJECT}.${cfg.VIEWS.WEEK_SLOTS}\`
      WHERE LOWER(scheduler_code)=LOWER('${code}')
      ORDER BY creator_id, plan_date, hhmm`;

    console.log('SQL Query:', sql);
    console.log('Expected: Should return 7 rows (one per day) for assigned creators');
  });

  return 'Test complete - check BigQuery manually';
}

console.log(testLoadMyWeek());
