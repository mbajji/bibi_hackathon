import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Send, CheckCircle, ArrowRight, MessageCircle, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UrgencyBadge } from '../components/Badges';

const TODAY_LABEL = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

export default function Dashboard() {
  const { callOuts } = useApp();
  const navigate = useNavigate();

  const needsApproval = callOuts.filter(c => c.status === 'pending-approval');
  const outreachSent = callOuts.filter(c => c.status === 'outreach-sent');
  const resolved = callOuts.filter(c => ['covered', 'unresolved'].includes(c.status));

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Active Cases</h1>
        <p className="text-sm text-gray-500 mt-0.5">{TODAY_LABEL} · Lunch & dinner service</p>
      </div>

      {/* Needs approval */}
      {needsApproval.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={<AlertTriangle size={14} className="text-orange-500" />}
            label="Needs Approval"
            count={needsApproval.length}
            color="orange"
          />
          {needsApproval.map(c => (
            <CaseCard key={c.id} callOut={c} variant="approval" onPress={() => navigate(`/callout/${c.id}`)} />
          ))}
        </section>
      )}

      {/* Outreach sent */}
      {outreachSent.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={<Send size={14} className="text-blue-500" />}
            label="Outreach Sent — Waiting for Response"
            count={outreachSent.length}
            color="blue"
          />
          {outreachSent.map(c => (
            <CaseCard key={c.id} callOut={c} variant="outreach" onPress={() => navigate(`/callout/${c.id}`)} />
          ))}
        </section>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={<CheckCircle size={14} className="text-green-500" />}
            label="Resolved"
            count={resolved.length}
            color="green"
          />
          {resolved.map(c => (
            <CaseCard key={c.id} callOut={c} variant="resolved" onPress={() => navigate(`/callout/${c.id}`)} />
          ))}
        </section>
      )}

      {callOuts.length === 0 && (
        <div className="text-center py-20">
          <CheckCircle size={44} className="mx-auto mb-3 text-green-300" />
          <p className="font-semibold text-gray-600">All shifts covered</p>
          <p className="text-sm text-gray-400 mt-1">No call-outs detected from Telegram</p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon, label, count, color }) {
  const countColors = { orange: 'text-orange-600', blue: 'text-blue-600', green: 'text-green-600' };
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <span className={`text-sm font-bold ${countColors[color]}`}>({count})</span>
    </div>
  );
}

function CaseCard({ callOut, variant, onPress }) {
  const borderColors = {
    approval: 'border-l-orange-400',
    outreach: 'border-l-blue-400',
    resolved: 'border-l-green-400',
  };
  const isResolved = variant === 'resolved';
  const isApproval = variant === 'approval';

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderColors[variant]} ${isResolved ? 'opacity-70' : ''}`}>
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isResolved ? 'bg-gray-100 text-gray-500' : isApproval ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
              {callOut.employeeName.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{callOut.employeeName}</span>
                <span className="text-gray-400">·</span>
                <span className="text-sm text-gray-500">{callOut.role}</span>
                <UrgencyBadge urgency={callOut.urgency} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {callOut.callOutType} · {callOut.shiftTime} · Detected {callOut.detectedAt}
              </p>
            </div>
          </div>

          <button
            onClick={onPress}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
              isApproval
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {isApproval ? 'Review & Approve' : 'View'}
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Telegram message */}
        <div className="mt-3 flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2">
          <MessageCircle size={12} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-600 italic leading-relaxed">"{callOut.telegramMessage}"</p>
        </div>

        {/* Status line */}
        <div className="mt-2.5 flex items-center gap-1.5 text-xs">
          {isApproval && (
            <>
              <Clock size={11} className="text-orange-500" />
              <span className="text-orange-600 font-medium">{callOut.urgencyReason}</span>
            </>
          )}
          {variant === 'outreach' && (
            <>
              <Send size={11} className="text-blue-400" />
              <span className="text-blue-600">Waiting on {callOut.outreachTarget} · Sent at {callOut.detectedAt}</span>
            </>
          )}
          {isResolved && (
            <>
              <CheckCircle size={11} className="text-green-500" />
              <span className="text-green-600">
                {callOut.status === 'covered' ? 'Shift covered' : 'Marked unresolved — handled manually'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
