import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Edit3, UserX, Send, AlertTriangle, MessageCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { UrgencyBadge, StatusBadge } from '../components/Badges';

export default function ResolutionPlan() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { callOuts, updateCallOutStatus, sendApprovedMessages, toggleAction, updateDraftMessage } = useApp();
  const { workspace } = useWorkspace();
  const [editMode, setEditMode] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);
  const [selectedReplId, setSelectedReplId] = useState(null);

  const callOut = callOuts.find(c => c.id === Number(id));
  if (!callOut) return (
    <div className="text-center py-16 text-gray-400">
      <p>Call-out case not found.</p>
      <button onClick={() => navigate('/')} className="mt-2 text-orange-500 text-sm">← Back to dashboard</button>
    </div>
  );

  const { plan } = callOut;
  const activeDmMsgId = plan.draftMessages.find(m => m.type === 'DM')?.id;
  const effectiveReplId = selectedReplId ?? plan.replacements[0]?.employeeId;

  function handleSelectReplacement(r) {
    setSelectedReplId(r.employeeId);
    if (activeDmMsgId == null) return;
    const firstName = r.name.split(' ')[0];
    const callerFirst = callOut.employeeName.split(' ')[0];
    updateDraftMessage(
      callOut.id,
      activeDmMsgId,
      `Hey ${firstName}! ${callerFirst} just called out. Any chance you can cover their shift today? Let me know ASAP 🙏`
    );
  }

  function handleApprove() {
    sendApprovedMessages(callOut.id, workspace?.id, effectiveReplId);
    setApproveSuccess(true);
    setTimeout(() => {
      setApproveSuccess(false);
      navigate('/');
    }, 1800);
  }

  function handleReject() {
    updateCallOutStatus(callOut.id, 'unresolved');
    navigate('/');
  }

  function handleMarkCovered() {
    updateCallOutStatus(callOut.id, 'covered');
    navigate('/');
  }

  const isReadOnly = ['covered', 'unresolved'].includes(callOut.status);

  if (approveSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <CheckCircle size={52} className="text-green-500" />
        <p className="text-lg font-semibold text-gray-800">Plan Approved</p>
        <p className="text-sm text-gray-500">Sending coverage messages to Discord now...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-2">
          <UrgencyBadge urgency={callOut.urgency} />
          <StatusBadge status={callOut.status} />
        </div>
      </div>

      {/* Call-out summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-semibold text-sm flex-shrink-0">
            {callOut.employeeName.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">
              {callOut.employeeName}
              <span className="text-gray-500 font-normal"> · {callOut.role}</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {callOut.callOutType} · {callOut.shiftTime} · Detected at {callOut.detectedAt}
            </p>
            <div className="mt-2 bg-slate-50 rounded-lg p-2.5 flex items-start gap-2">
              <MessageCircle size={13} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-600 italic">"{callOut.telegramMessage}"</p>
            </div>
          </div>
        </div>
        {plan.shiftImpact && (
          <div className="mt-3 bg-orange-50 border border-orange-100 rounded-lg p-2.5 flex items-start gap-2">
            <AlertTriangle size={13} className="text-orange-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-orange-800">{plan.shiftImpact}</p>
          </div>
        )}
      </div>

      {/* Coverage response banners */}
      {callOut.status === 'covered' && callOut.coveredBy && (
        <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-xl p-4">
          <ThumbsUp size={16} className="text-green-600 flex-shrink-0" />
          <p className="text-sm font-medium text-green-800">
            <span className="font-semibold">{callOut.coveredBy}</span> confirmed they can cover the shift!
          </p>
        </div>
      )}
      {callOut.coverageDeclined && callOut.status !== 'covered' && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <ThumbsDown size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              <span className="font-semibold">{callOut.declinedBy}</span> can't cover. Contact the next candidate.
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Select another replacement below and re-approve.</p>
          </div>
        </div>
      )}

      {/* Draft coverage messages */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Coverage Messages</h2>
          <span className="text-xs text-gray-400">Sent to Discord on approval</span>
        </div>
        <div className="space-y-2.5">
          {plan.draftMessages.map(msg => (
            <div key={msg.id} className="border border-blue-100 rounded-lg p-3 bg-blue-50">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Send size={11} className="text-blue-500" />
                <span className="text-xs font-medium text-blue-700">
                  {msg.type === 'DM' ? `DM → ${msg.to}` : `Post → ${msg.to}`}
                </span>
              </div>
              {editMode ? (
                <textarea
                  className="w-full text-sm text-gray-700 border border-blue-200 rounded p-2 resize-none bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                  rows={2}
                  value={msg.message}
                  onChange={e => updateDraftMessage(callOut.id, msg.id, e.target.value)}
                />
              ) : (
                <p className="text-sm text-gray-700">{msg.message}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Replacement ranking */}
      {plan.replacements.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">Replacement Options</h2>
            <span className="text-xs text-gray-400">Click to select who to contact</span>
          </div>
          <div className="space-y-2">
            {plan.replacements.slice(0, 3).map((r, i) => {
              const isSelected = r.employeeId === effectiveReplId;
              return (
                <button
                  key={r.employeeId}
                  onClick={() => !isReadOnly && handleSelectReplacement(r)}
                  className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-green-400 bg-green-50 ring-1 ring-green-300'
                      : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-gray-100'
                  } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isSelected ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                    {isSelected ? '✓' : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{r.name} <span className="text-gray-500 font-normal text-xs">· {r.role}</span></p>
                    <p className="text-xs text-gray-500 truncate">{r.reason}</p>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ${isSelected ? 'text-green-600' : 'text-gray-400'}`}>{r.score}%</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Action checklist */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Action Checklist</h2>
        <div className="space-y-1">
          {plan.actionQueue.map(action => (
            <div key={action.id} className={`flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 ${action.done ? 'opacity-50' : ''}`}>
              <button
                onClick={() => toggleAction(callOut.id, action.id)}
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${action.done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}
              >
                {action.done && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <p className={`text-sm flex-1 ${action.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{action.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Action bar */}
      {!isReadOnly && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditMode(e => !e)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${editMode ? 'bg-orange-50 border-orange-200 text-orange-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Edit3 size={14} />
              {editMode ? 'Done Editing' : 'Edit'}
            </button>
            <button
              onClick={handleReject}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <XCircle size={14} />
              Reject
            </button>
            <button
              onClick={handleMarkCovered}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <UserX size={14} />
              Manual
            </button>
          </div>

          <button
            onClick={handleApprove}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <CheckCircle size={16} />
            Approve & Send
          </button>
        </div>
      )}

      {isReadOnly && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center text-sm text-gray-500">
          This case is <StatusBadge status={callOut.status} /> and no longer editable.
          {callOut.status === 'covered' && (
            <span className="ml-1 text-green-600 font-medium">Shift is covered ✓</span>
          )}
        </div>
      )}
    </div>
  );
}
