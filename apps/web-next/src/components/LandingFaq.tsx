'use client';

import { useState } from 'react';
import { copy } from '@taskapp/contracts';

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <div className="xl-faq-list">
      {copy.landingExtended.faq.items.map((item, index) => {
        const open = openIndex === index;
        const panelId = `xl-faq-panel-${index}`;
        const controlId = `xl-faq-question-${index}`;
        return (
          <div className="xl-faq-item" key={item.question}>
            <h3>
              <button
                className="xl-faq-trigger"
                id={controlId}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : index)}
              >
                <span>{item.question}</span>
                <span className="xl-faq-mark" aria-hidden="true">{open ? '−' : '+'}</span>
              </button>
            </h3>
            <div className="xl-faq-answer" id={panelId} role="region" aria-labelledby={controlId} hidden={!open}>
              <p>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
