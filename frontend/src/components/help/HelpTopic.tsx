import { cn } from '@/lib/utils';
import { HelpTopic as HelpTopicType } from '@/types/help';
import type { User } from '@/types/auth';
import ScreenshotPlaceholder from './ScreenshotPlaceholder';
import { Lightbulb, Circle } from 'lucide-react';

interface HelpTopicProps {
  topic: HelpTopicType;
  searchQuery: string;
  user: User | null;
}

function replacePlaceholders(text: string, user: User | null): string {
  const orgName = user?.name || 'your school';
  return text.replace(/\{\{organizationName\}\}/g, orgName);
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (!lowerText.includes(lowerQuery)) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let index = lowerText.indexOf(lowerQuery, lastIndex);

  while (index !== -1) {
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }
    parts.push(
      <mark key={index} className="bg-yellow-200/60 dark:bg-yellow-900/40 rounded px-0.5">
        {text.slice(index, index + query.length)}
      </mark>
    );
    lastIndex = index + query.length;
    index = lowerText.indexOf(lowerQuery, lastIndex);
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
}

export default function HelpTopicComponent({ topic, searchQuery, user }: HelpTopicProps) {
  const stepCount = topic.steps.length;

  return (
    <div
      id={topic.id}
      className={cn(
        'scroll-mt-28 rounded-xl border bg-card p-5 sm:p-6 transition-shadow',
        'hover:shadow-sm'
      )}
    >
      {/* Topic title */}
      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4 flex items-start gap-2">
        <Circle className="h-2 w-2 mt-2.5 shrink-0 fill-primary text-primary" />
        <HighlightText text={topic.title} query={searchQuery} />
      </h3>

      {/* Steps timeline */}
      <ol className="relative list-none">
        {topic.steps.map((step, idx) => {
          const isLast = idx === stepCount - 1;
          return (
            <li key={step.order} className="relative pl-8 pb-4 last:pb-0">
              {/* Connector line */}
              {!isLast && (
                <span
                  className="absolute left-[11px] top-7 bottom-0 w-px bg-border"
                  aria-hidden="true"
                />
              )}

              {/* Step number */}
              <span
                className={cn(
                  'absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                  'bg-primary text-primary-foreground shadow-sm'
                )}
              >
                {step.order}
              </span>

              <div className="flex-1">
                <p className="text-sm text-foreground leading-relaxed pt-0.5">
                  <HighlightText
                    text={replacePlaceholders(step.instruction, user)}
                    query={searchQuery}
                  />
                </p>

                {step.tip && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-lg border-l-4 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200">
                    <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <span className="leading-relaxed">{step.tip}</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {topic.screenshotCaption && (
        <div className="mt-5 pt-5 border-t border-dashed border-border/60">
          <ScreenshotPlaceholder caption={topic.screenshotCaption} />
        </div>
      )}
    </div>
  );
}
