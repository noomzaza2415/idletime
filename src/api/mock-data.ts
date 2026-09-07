import type { IdleTimeRecord } from '@/types';

export const MOCK_RECORDS: IdleTimeRecord[] = [
  {
    id: '1', no: 1, date: '2026-09-04', line: 'Line1', item: 'Line1',
    workOrder: '6JMGF02J', modelSuffix: 'T13X2EHHTXA.ANBEECD', lotSize: 147,
    idleTimeIssue: '', action: '', startTime: '13:37', endTime: '13:37', totalMins: 0.63,
    stopPoint: 'Line Stop', vendor: false, dj: false, manPower: '', type: '', dept: '', remark: '',
  },
  {
    id: '5', no: 5, date: '2026-09-04', line: 'Line1', item: 'Line1',
    workOrder: '6J1F01BA', modelSuffix: 'T13H7EHHTW.ABWELAT', lotSize: 250,
    idleTimeIssue: '', action: '', startTime: '13:24', endTime: '13:25', totalMins: 0.63,
    stopPoint: 'Line Stop', vendor: false, dj: false, manPower: '', type: '', dept: '', remark: '',
  },
  {
    id: '7', no: 7, date: '2026-09-04', line: 'Line1', item: 'Line1',
    workOrder: '6J1F01BA', modelSuffix: 'T13H7EHHTW.ABWELAT', lotSize: 250,
    idleTimeIssue: '', action: '', startTime: '13:16', endTime: '13:17', totalMins: 0.62,
    stopPoint: 'Line Stop', vendor: false, dj: false, manPower: '', type: '', dept: '', remark: '',
  },
  {
    id: '12', no: 12, date: '2026-09-04', line: 'Line1', item: 'Line1',
    workOrder: '611F00WS', modelSuffix: 'T13H9EFNT2R.AKOR', lotSize: 204,
    idleTimeIssue: 'พักเบรก', action: '', startTime: '11:30', endTime: '12:31', totalMins: 61.52,
    stopPoint: 'Line Stop', vendor: false, dj: false, manPower: '', type: '', dept: '', remark: '',
    isBreakTime: true,
  },
  {
    id: '14', no: 14, date: '2026-09-04', line: 'Line1', item: 'Line1',
    workOrder: '611F00WS', modelSuffix: 'T13H9EFNT2R.AKOR', lotSize: 204,
    idleTimeIssue: '', action: '', startTime: '11:26', endTime: '11:28', totalMins: 1.77,
    stopPoint: 'Line Stop', vendor: false, dj: false, manPower: '', type: '', dept: '', remark: '',
  },
];
