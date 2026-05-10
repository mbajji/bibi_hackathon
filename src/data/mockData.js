export const RESTAURANT_NAME = 'The Golden Fork';

export const EMPLOYEES = [
  { id: 1, name: 'Maria Santos', role: 'Server', telegram: '@mariasantos', hoursThisWeek: 24, phone: '555-0101', initials: 'MS' },
  { id: 2, name: 'Jake Thompson', role: 'Line Cook', telegram: '@jakethompson', hoursThisWeek: 32, phone: '555-0102', initials: 'JT' },
  { id: 3, name: 'Priya Patel', role: 'Server', telegram: '@priyapatel', hoursThisWeek: 16, phone: '555-0103', initials: 'PP' },
  { id: 4, name: 'Carlos Rivera', role: 'Bartender', telegram: '@carlosrivera', hoursThisWeek: 28, phone: '555-0104', initials: 'CR' },
  { id: 5, name: 'Emma Wilson', role: 'Host', telegram: '@emmawilson', hoursThisWeek: 20, phone: '555-0105', initials: 'EW' },
  { id: 6, name: 'Darius Okafor', role: 'Line Cook', telegram: '@dariusokafor', hoursThisWeek: 40, phone: '555-0106', initials: 'DO' },
  { id: 7, name: 'Sophie Chen', role: 'Server', telegram: '@sophiechen', hoursThisWeek: 12, phone: '555-0107', initials: 'SC' },
  { id: 8, name: 'Marcus Bell', role: 'Server', telegram: '@marcusbell', hoursThisWeek: 28, phone: '555-0108', initials: 'MB' },
  { id: 9, name: 'Tina Kowalski', role: 'Sous Chef', telegram: '@tinakowalski', hoursThisWeek: 36, phone: '555-0109', initials: 'TK' },
  { id: 10, name: 'Luis Mendez', role: 'Busser', telegram: '@luismendez', hoursThisWeek: 18, phone: '555-0110', initials: 'LM' },
];

// 24h time format ("HH:MM") for timeline calculations
export const WEEKLY_SHIFTS = {
  Mon: [
    { employeeId: 3, employeeName: 'Priya Patel', role: 'Server', start: '11:00', end: '16:00', status: 'scheduled' },
    { employeeId: 9, employeeName: 'Tina Kowalski', role: 'Sous Chef', start: '10:00', end: '18:00', status: 'scheduled' },
    { employeeId: 10, employeeName: 'Luis Mendez', role: 'Busser', start: '11:00', end: '16:00', status: 'scheduled' },
    { employeeId: 5, employeeName: 'Emma Wilson', role: 'Host', start: '10:30', end: '15:30', status: 'scheduled' },
  ],
  Tue: [
    { employeeId: 1, employeeName: 'Maria Santos', role: 'Server', start: '11:00', end: '16:00', status: 'scheduled' },
    { employeeId: 3, employeeName: 'Priya Patel', role: 'Server', start: '17:00', end: '22:00', status: 'scheduled' },
    { employeeId: 2, employeeName: 'Jake Thompson', role: 'Line Cook', start: '10:00', end: '18:00', status: 'scheduled' },
    { employeeId: 9, employeeName: 'Tina Kowalski', role: 'Sous Chef', start: '10:00', end: '18:00', status: 'scheduled' },
    { employeeId: 4, employeeName: 'Carlos Rivera', role: 'Bartender', start: '16:00', end: '22:00', status: 'scheduled' },
  ],
  Wed: [
    { employeeId: 7, employeeName: 'Sophie Chen', role: 'Server', start: '11:00', end: '16:00', status: 'scheduled' },
    { employeeId: 8, employeeName: 'Marcus Bell', role: 'Server', start: '17:00', end: '22:00', status: 'scheduled' },
    { employeeId: 6, employeeName: 'Darius Okafor', role: 'Line Cook', start: '10:00', end: '16:00', status: 'scheduled' },
    { employeeId: 9, employeeName: 'Tina Kowalski', role: 'Sous Chef', start: '09:00', end: '17:00', status: 'scheduled' },
    { employeeId: 5, employeeName: 'Emma Wilson', role: 'Host', start: '10:30', end: '15:30', status: 'scheduled' },
    { employeeId: 10, employeeName: 'Luis Mendez', role: 'Busser', start: '17:00', end: '22:00', status: 'scheduled' },
  ],
  Thu: [
    { employeeId: 1, employeeName: 'Maria Santos', role: 'Server', start: '11:00', end: '16:00', status: 'scheduled' },
    { employeeId: 3, employeeName: 'Priya Patel', role: 'Server', start: '11:00', end: '16:00', status: 'scheduled' },
    { employeeId: 7, employeeName: 'Sophie Chen', role: 'Server', start: '17:00', end: '22:00', status: 'scheduled' },
    { employeeId: 2, employeeName: 'Jake Thompson', role: 'Line Cook', start: '10:00', end: '16:00', status: 'scheduled' },
    { employeeId: 6, employeeName: 'Darius Okafor', role: 'Line Cook', start: '16:00', end: '22:00', status: 'scheduled' },
    { employeeId: 9, employeeName: 'Tina Kowalski', role: 'Sous Chef', start: '09:00', end: '17:00', status: 'scheduled' },
    { employeeId: 4, employeeName: 'Carlos Rivera', role: 'Bartender', start: '16:00', end: '23:00', status: 'scheduled' },
    { employeeId: 5, employeeName: 'Emma Wilson', role: 'Host', start: '17:00', end: '22:00', status: 'scheduled' },
  ],
  Fri: [
    { employeeId: 1, employeeName: 'Maria Santos', role: 'Server', start: '17:00', end: '23:00', status: 'scheduled' },
    { employeeId: 3, employeeName: 'Priya Patel', role: 'Server', start: '11:00', end: '16:00', status: 'scheduled' },
    { employeeId: 7, employeeName: 'Sophie Chen', role: 'Server', start: '11:00', end: '16:00', status: 'scheduled' },
    { employeeId: 8, employeeName: 'Marcus Bell', role: 'Server', start: '17:00', end: '23:00', status: 'scheduled' },
    { employeeId: 2, employeeName: 'Jake Thompson', role: 'Line Cook', start: '10:00', end: '16:00', status: 'scheduled' },
    { employeeId: 6, employeeName: 'Darius Okafor', role: 'Line Cook', start: '16:00', end: '23:00', status: 'scheduled' },
    { employeeId: 9, employeeName: 'Tina Kowalski', role: 'Sous Chef', start: '09:00', end: '21:00', status: 'scheduled' },
    { employeeId: 4, employeeName: 'Carlos Rivera', role: 'Bartender', start: '15:00', end: '23:00', status: 'scheduled' },
    { employeeId: 5, employeeName: 'Emma Wilson', role: 'Host', start: '17:00', end: '23:00', status: 'scheduled' },
    { employeeId: 10, employeeName: 'Luis Mendez', role: 'Busser', start: '17:00', end: '23:00', status: 'scheduled' },
  ],
  Sat: [
    { employeeId: 1, employeeName: 'Maria Santos', role: 'Server', start: '11:00', end: '16:00', status: 'called-out' },
    { employeeId: 2, employeeName: 'Jake Thompson', role: 'Line Cook', start: '10:00', end: '16:00', status: 'called-out' },
    { employeeId: 3, employeeName: 'Priya Patel', role: 'Server', start: '11:00', end: '16:00', status: 'scheduled' },
    { employeeId: 4, employeeName: 'Carlos Rivera', role: 'Bartender', start: '12:00', end: '20:00', status: 'scheduled' },
    { employeeId: 5, employeeName: 'Emma Wilson', role: 'Host', start: '10:30', end: '15:30', status: 'scheduled' },
    { employeeId: 6, employeeName: 'Darius Okafor', role: 'Line Cook', start: '16:00', end: '22:00', status: 'scheduled' },
    { employeeId: 7, employeeName: 'Sophie Chen', role: 'Server', start: '11:00', end: '16:00', status: 'scheduled' },
    { employeeId: 8, employeeName: 'Marcus Bell', role: 'Server', start: '16:00', end: '22:00', status: 'scheduled' },
    { employeeId: 9, employeeName: 'Tina Kowalski', role: 'Sous Chef', start: '09:00', end: '17:00', status: 'scheduled' },
    { employeeId: 10, employeeName: 'Luis Mendez', role: 'Busser', start: '11:00', end: '16:00', status: 'scheduled' },
  ],
  Sun: [
    { employeeId: 3, employeeName: 'Priya Patel', role: 'Server', start: '10:00', end: '15:00', status: 'scheduled' },
    { employeeId: 4, employeeName: 'Carlos Rivera', role: 'Bartender', start: '11:00', end: '16:00', status: 'scheduled' },
    { employeeId: 5, employeeName: 'Emma Wilson', role: 'Host', start: '10:00', end: '15:00', status: 'scheduled' },
    { employeeId: 6, employeeName: 'Darius Okafor', role: 'Line Cook', start: '09:00', end: '15:00', status: 'scheduled' },
    { employeeId: 7, employeeName: 'Sophie Chen', role: 'Server', start: '10:00', end: '15:00', status: 'scheduled' },
    { employeeId: 8, employeeName: 'Marcus Bell', role: 'Server', start: '10:00', end: '15:00', status: 'scheduled' },
    { employeeId: 9, employeeName: 'Tina Kowalski', role: 'Sous Chef', start: '09:00', end: '15:00', status: 'scheduled' },
    { employeeId: 10, employeeName: 'Luis Mendez', role: 'Busser', start: '10:00', end: '15:00', status: 'scheduled' },
  ],
};

export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEK_DATES = ['May 5', 'May 6', 'May 7', 'May 8', 'May 9', 'May 10', 'May 11'];
export const TODAY_DAY_INDEX = 5; // Saturday

export const INITIAL_CALL_OUTS = [
  {
    id: 1,
    employeeName: 'Maria Santos',
    employeeId: 1,
    role: 'Server',
    telegramMessage: "hey guys im so sorry but im super sick today 🤒 cant make my lunch shift, going to urgent care rn. so sorry for the short notice!!",
    telegramUsername: '@mariasantos',
    detectedAt: '9:23 AM',
    shift: 'Lunch Shift',
    shiftTime: '11:00 AM – 4:00 PM',
    callOutType: 'Illness',
    reason: 'Sick — going to urgent care',
    urgency: 'High',
    urgencyReason: 'Shift starts in 90 minutes, peak lunch service',
    confidence: 96,
    status: 'pending-approval',
    plan: {
      shiftImpact: '1 server short during Saturday lunch — typically 85–110 covers. Risk of slow table turns and guest dissatisfaction.',
      replacements: [
        { employeeId: 8, name: 'Marcus Bell', role: 'Server', reason: 'Off today, 28 hrs/week (under cap), previously volunteered for extra shifts', score: 94 },
        { employeeId: 7, name: 'Sophie Chen', role: 'Server', reason: 'Already scheduled today — could come in 2 hours early (only 12 hrs this week)', score: 78 },
        { employeeId: 3, name: 'Priya Patel', role: 'Server', reason: 'Already working lunch — extend shift as last resort only', score: 45 },
      ],
      draftMessages: [
        { id: 1, to: 'Marcus Bell', type: 'DM', message: "Hey Marcus! Maria called out sick for the lunch shift (11am–4pm) today. Any chance you could cover? We really need the help — let us know ASAP! 🙏" },
        { id: 2, to: 'Staff Group', type: 'Group', message: "📢 Heads up team — we're short one server for today's lunch shift (11am–4pm). If anyone can come in or come in early, please reply here or DM me. Thanks!" },
      ],
      temporaryPlan: 'Have Priya Patel take an extra table section until replacement arrives. If kitchen backs up, Tina (Sous Chef) can assist expo.',
      actionQueue: [
        { id: 1, action: 'Tell Priya she\'s taking an extra section until coverage arrives', owner: 'Manager', done: false },
        { id: 2, action: 'Update the floor map for 3-server coverage and leave it at the host stand', owner: 'Manager', done: false },
        { id: 3, action: 'Let Emma (Host) know the section layout has changed', owner: 'Manager', done: false },
        { id: 4, action: 'Give the kitchen a heads-up: lighter server count, may need to pace ticket output', owner: 'Manager', done: false },
      ],
    },
  },
  {
    id: 2,
    employeeName: 'Jake Thompson',
    employeeId: 2,
    role: 'Line Cook',
    telegramMessage: "not going to be able to make it in today guys. family emergency came up last night. really sorry",
    telegramUsername: '@jakethompson',
    detectedAt: '7:45 AM',
    shift: 'Lunch Shift',
    shiftTime: '10:00 AM – 4:00 PM',
    callOutType: 'Emergency',
    reason: 'Family emergency',
    urgency: 'Critical',
    urgencyReason: 'Line cook is essential — no backup currently scheduled for lunch kitchen',
    confidence: 88,
    status: 'outreach-sent',
    outreachTarget: 'Darius Okafor',
    plan: {
      shiftImpact: 'Critical kitchen gap. Only 1 line cook (Tina) scheduled for lunch. Cannot run full menu. Risk of long ticket times and early 86s.',
      replacements: [
        { employeeId: 6, name: 'Darius Okafor', role: 'Line Cook', reason: 'Scheduled for dinner shift — could shift to AM with overtime pay offer', score: 91 },
        { employeeId: 9, name: 'Tina Kowalski', role: 'Sous Chef', reason: 'Already working — can cover some stations but will be stretched very thin', score: 55 },
      ],
      draftMessages: [
        { id: 3, to: 'Darius Okafor', type: 'DM', message: "Hey Darius! Jake had a family emergency and can't make it for lunch. Any chance you can come in at 10am instead of 4pm? We'd comp your dinner shift and work out time 🙏" },
      ],
      temporaryPlan: 'Run limited menu (drop 3 most complex items from specials). Tina handles grill + sauté simultaneously until Darius arrives.',
      actionQueue: [
        { id: 5, action: 'Pull the limited menu binder from the office (red folder on top shelf)', owner: 'Manager', done: false },
        { id: 6, action: 'Brief Tina on the coverage plan before service — she\'s running solo for now', owner: 'Manager', done: true },
        { id: 7, action: 'Erase the 86\'d items from the specials board', owner: 'Manager', done: false },
        { id: 8, action: 'Tell servers the menu is limited today and coach them on redirecting guests', owner: 'Manager', done: false },
      ],
    },
  },
];

export const TELEGRAM_MESSAGES = [
  { id: 1, sender: 'Emma Wilson', username: '@emmawilson', initials: 'EW', time: '7:02 AM', text: 'Good morning everyone! Ready for a busy Saturday 💪', isCallOut: false, isBot: false },
  { id: 2, sender: 'Tina Kowalski', username: '@tinakowalski', initials: 'TK', time: '7:14 AM', text: 'Morning! Just prepping some stock. See you all soon', isCallOut: false, isBot: false },
  { id: 3, sender: 'Jake Thompson', username: '@jakethompson', initials: 'JT', time: '7:45 AM', text: 'not going to be able to make it in today guys. family emergency came up last night. really sorry', isCallOut: true, callOutId: 2, isBot: false },
  { id: 4, sender: 'ShiftSaver Bot', username: '@shiftsaverbot', initials: '🤖', time: '7:45 AM', text: '🚨 Call-out detected from Jake Thompson (Line Cook, 10am–4pm). Confidence: 88%. Creating recovery case for manager review...', isCallOut: false, isBot: true },
  { id: 5, sender: 'Tina Kowalski', username: '@tinakowalski', initials: 'TK', time: '7:47 AM', text: 'oh no jake, hope everything is okay! take care of yourself 🙏', isCallOut: false, isBot: false },
  { id: 6, sender: 'Carlos Rivera', username: '@carlosrivera', initials: 'CR', time: '8:10 AM', text: 'running ~5 min late, parking situation is rough today', isCallOut: false, isBot: false },
  { id: 7, sender: 'Priya Patel', username: '@priyapatel', initials: 'PP', time: '8:30 AM', text: 'on my way!', isCallOut: false, isBot: false },
  { id: 8, sender: 'Emma Wilson', username: '@emmawilson', initials: 'EW', time: '9:01 AM', text: 'Reservation system is showing 47 covers for noon — going to be a full house', isCallOut: false, isBot: false },
  { id: 9, sender: 'Maria Santos', username: '@mariasantos', initials: 'MS', time: '9:23 AM', text: 'hey guys im so sorry but im super sick today 🤒 cant make my lunch shift, going to urgent care rn. so sorry for the short notice!!', isCallOut: true, callOutId: 1, isBot: false },
  { id: 10, sender: 'ShiftSaver Bot', username: '@shiftsaverbot', initials: '🤖', time: '9:23 AM', text: '🚨 Call-out detected from Maria Santos (Server, 11am–4pm). Confidence: 96%. Creating recovery case for manager review...', isCallOut: false, isBot: true },
  { id: 11, sender: 'Emma Wilson', username: '@emmawilson', initials: 'EW', time: '9:25 AM', text: 'oh no maria!! feel better soon 💛', isCallOut: false, isBot: false },
  { id: 12, sender: 'Sophie Chen', username: '@sophiechen', initials: 'SC', time: '9:28 AM', text: 'feel better! hope urgent care goes quick', isCallOut: false, isBot: false },
];
