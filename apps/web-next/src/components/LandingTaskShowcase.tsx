'use client';

import { useState } from 'react';
import { copy } from '@taskapp/contracts';
import { ImageIcon } from '@/components/icons';
import { LandingNewTaskLink } from '@/components/LandingCta';

/** Public marketing fixtures, never user data or an API response. */
export type LandingPreviewTask = {
  title: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  date: string;
  body: string;
};

export function LandingTaskShowcase({ tasks }: { tasks: readonly LandingPreviewTask[] }) {
  const [query, setQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [highOnly, setHighOnly] = useState(false);
  const filtered = tasks.filter((task) =>
    task.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
    (!activeOnly || task.status !== 'completed') &&
    (!highOnly || task.priority === 'high'),
  );

  return (
    <div className="xl-task-showcase">
      <div className="xl-task-toolbar">
        <label className="xl-task-search">
          <span className="visually-hidden">{copy.task.search.label}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.task.search.label}
          />
        </label>
        <div className="xl-task-filters" aria-label={copy.filter.applied}>
          <button type="button" aria-pressed={activeOnly} onClick={() => setActiveOnly((value) => !value)}>
            {copy.landingExtended.taskShowcase.activeFilter}
          </button>
          <button type="button" aria-pressed={highOnly} onClick={() => setHighOnly((value) => !value)}>
            {copy.landingExtended.taskShowcase.highFilter}
          </button>
        </div>
        <div className="xl-task-create"><LandingNewTaskLink /></div>
      </div>
      <div className="xl-task-grid" aria-live="polite">
        {filtered.length ? filtered.map((task) => (
          <article className="xl-task-card" key={task.title}>
            <h3>{task.title}</h3>
            <div className="xl-task-card-badges">
              <span className="badge" data-kind="status" data-value={task.status}>
                {copy.task.status[task.status]}
              </span>
              <span className="badge" data-kind="priority" data-value={task.priority}>
                {copy.task.priority[task.priority]}
              </span>
            </div>
            <p>{task.body}</p>
            <div className="xl-task-card-foot">
              <span>{task.date}</span>
              <span className="xl-task-image" aria-hidden="true"><ImageIcon size={18} strokeWidth={1.6} /></span>
            </div>
          </article>
        )) : (
          <p className="xl-task-no-results">{copy.landingExtended.taskShowcase.none}</p>
        )}
      </div>
    </div>
  );
}
