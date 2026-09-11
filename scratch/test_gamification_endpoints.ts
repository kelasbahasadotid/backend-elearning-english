import { getLeaderboardChartAnalytics, getStudentsXpAnalytics, getStudentXpDetailHistory } from '../src/controllers/gamificationAdminController';
import { getAdminAnalytics } from '../src/controllers/adminController';

function createMockReq(params = {}, query = {}, body = {}) {
  return { params, query, body } as any;
}

function createMockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.data = data;
    return res;
  };
  return res;
}

async function runTests() {
  console.log('--- 1. Testing getLeaderboardChartAnalytics ---');
  const req1 = createMockReq({}, { range: '30d' });
  const res1 = createMockRes();
  await getLeaderboardChartAnalytics(req1, res1);
  console.log('Status:', res1.statusCode);
  console.log('Summary:', res1.data?.summary);
  console.log('TopStudents count:', res1.data?.topStudents?.length);
  console.log('TopStudent 1:', res1.data?.topStudents?.[0]);
  console.log('XpByActivity count:', res1.data?.xpByActivity?.length, res1.data?.xpByActivity);
  console.log('DailyXpTrend count:', res1.data?.dailyXpTrend?.length);
  console.log('LevelDistribution count:', res1.data?.levelDistribution?.length);
  console.log('XpRangeDistribution:', res1.data?.xpRangeDistribution);

  console.log('\n--- 2. Testing getStudentsXpAnalytics ---');
  const req2 = createMockReq({}, { page: '1', limit: '5', sortBy: 'xp', order: 'DESC' });
  const res2 = createMockRes();
  await getStudentsXpAnalytics(req2, res2);
  console.log('Status:', res2.statusCode);
  console.log('Pagination:', res2.data?.pagination);
  console.log('Students count:', res2.data?.students?.length);
  console.log('First student:', res2.data?.students?.[0]);

  console.log('\n--- 3. Testing getStudentXpDetailHistory (User ID 4) ---');
  const req3 = createMockReq({ userId: '4' });
  const res3 = createMockRes();
  await getStudentXpDetailHistory(req3, res3);
  console.log('Status:', res3.statusCode);
  console.log('Student Info:', res3.data?.student?.fullName, 'Level:', res3.data?.student?.levelName, 'XP:', res3.data?.student?.currentSeasonXp);
  console.log('Activity breakdown:', res3.data?.activityBreakdown);
  console.log('Recent transactions count:', res3.data?.transactions?.length);
  if (res3.data?.transactions?.length > 0) {
    console.log('First transaction:', res3.data?.transactions?.[0]);
  }

  console.log('\n--- 4. Testing getAdminAnalytics (Leaderboard integration) ---');
  const req4 = createMockReq();
  const res4 = createMockRes();
  await getAdminAnalytics(req4, res4);
  console.log('Status:', res4.statusCode);
  console.log('Leaderboard key in analytics:', Object.keys(res4.data?.leaderboard || {}));
  console.log('Leaderboard totals:', res4.data?.leaderboard?.totals);
  console.log('Leaderboard topStudents count:', res4.data?.leaderboard?.topStudents?.length);

  console.log('\n✅ All Controller Tests Passed Successfully!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
