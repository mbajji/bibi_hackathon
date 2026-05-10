export function UrgencyBadge({ urgency }) {
  const styles = {
    Critical: 'bg-red-100 text-red-700 border border-red-200',
    High: 'bg-orange-100 text-orange-700 border border-orange-200',
    Medium: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    Low: 'bg-gray-100 text-gray-600 border border-gray-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[urgency] || styles.Low}`}>
      {urgency === 'Critical' && '🔴 '}
      {urgency === 'High' && '🟠 '}
      {urgency === 'Medium' && '🟡 '}
      {urgency}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    'pending-approval': { label: 'Needs Approval', cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
    'outreach-sent': { label: 'Outreach Sent', cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
    'covered': { label: 'Covered', cls: 'bg-green-100 text-green-700 border border-green-200' },
    'unresolved': { label: 'Unresolved', cls: 'bg-red-100 text-red-700 border border-red-200' },
    'draft': { label: 'Draft', cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
  };
  const { label, cls } = map[status] || map['draft'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

export function ShiftStatusBadge({ status }) {
  const map = {
    'scheduled': { label: 'Scheduled', cls: 'bg-green-100 text-green-700' },
    'called-out': { label: 'Called Out', cls: 'bg-red-100 text-red-700' },
    'pending-coverage': { label: 'Pending Coverage', cls: 'bg-blue-100 text-blue-700' },
    'covered': { label: 'Covered', cls: 'bg-green-100 text-green-700' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function ActionStatusBadge({ status }) {
  const map = {
    'not-started': { label: 'Not Started', cls: 'bg-gray-100 text-gray-600' },
    'in-progress': { label: 'In Progress', cls: 'bg-blue-100 text-blue-700' },
    'done': { label: 'Done', cls: 'bg-green-100 text-green-700' },
    'blocked': { label: 'Blocked', cls: 'bg-red-100 text-red-700' },
    'skipped': { label: 'Skipped', cls: 'bg-gray-100 text-gray-400' },
  };
  const { label, cls } = map[status] || map['not-started'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
