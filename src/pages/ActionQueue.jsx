import { useState } from 'react';
import { Plus, X, ClipboardList } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function ActionQueue() {
  const { callOuts, extraTasks, toggleAction, toggleExtraTask, addExtraTask, removeExtraTask } = useApp();
  const [filter, setFilter] = useState('todo'); // 'todo' | 'done' | 'all'
  const [newTask, setNewTask] = useState('');
  const [adding, setAdding] = useState(false);

  // Flatten all call-out action items with context
  const caseItems = callOuts.flatMap(c =>
    c.plan.actionQueue.map(a => ({
      ...a,
      callOutId: c.id,
      context: `${c.employeeName} · ${c.shiftTime}`,
    }))
  );

  const allItems = [
    ...caseItems,
    ...extraTasks.map(t => ({ ...t, callOutId: null, context: 'Custom task' })),
  ];

  const todoItems = allItems.filter(a => !a.done);
  const doneItems = allItems.filter(a => a.done);
  const displayed = filter === 'todo' ? todoItems : filter === 'done' ? doneItems : allItems;

  const todoCount = todoItems.length;
  const doneCount = doneItems.length;

  function handleToggle(item) {
    if (item.callOutId !== null && !item.custom) {
      toggleAction(item.callOutId, item.id);
    } else {
      toggleExtraTask(item.id);
    }
  }

  function handleAdd(e) {
    e.preventDefault();
    if (newTask.trim()) {
      addExtraTask(newTask.trim());
      setNewTask('');
      setAdding(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Action Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">Things you need to communicate or handle manually</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{doneCount}/{allItems.length}</p>
          <p className="text-xs text-gray-400">done</p>
        </div>
      </div>

      {/* Progress bar */}
      {allItems.length > 0 && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${allItems.length > 0 ? (doneCount / allItems.length) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
        {[
          { key: 'todo', label: `To Do (${todoCount})` },
          { key: 'done', label: `Done (${doneCount})` },
          { key: 'all', label: 'All' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {displayed.map(item => (
          <TaskRow key={`${item.callOutId}-${item.id}`} item={item} onToggle={() => handleToggle(item)} onRemove={item.custom ? () => removeExtraTask(item.id) : null} />
        ))}

        {displayed.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ClipboardList size={36} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm">{filter === 'done' ? 'Nothing marked done yet' : 'All tasks are done!'}</p>
          </div>
        )}
      </div>

      {/* Add task */}
      {adding ? (
        <form onSubmit={handleAdd} className="flex items-center gap-2 bg-white border border-orange-300 rounded-xl px-4 py-3 shadow-sm">
          <input
            autoFocus
            type="text"
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            placeholder="What needs to be done or communicated?"
            className="flex-1 text-sm text-gray-800 focus:outline-none placeholder-gray-400"
          />
          <button type="button" onClick={() => { setAdding(false); setNewTask(''); }} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={16} />
          </button>
          <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
            Add
          </button>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-1 py-1 transition-colors"
        >
          <Plus size={16} />
          Add a task
        </button>
      )}
    </div>
  );
}

function TaskRow({ item, onToggle, onRemove }) {
  return (
    <div className={`flex items-start gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 group transition-opacity ${item.done ? 'opacity-55' : ''}`}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          item.done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
        }`}
      >
        {item.done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {item.action}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{item.context}</p>
      </div>

      {/* Remove button (custom tasks only) */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all p-0.5"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
